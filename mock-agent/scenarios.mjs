// Kịch bản của mock AG-UI agent (xem docs/agui/PLAN.md mục 4.5–4.7 và 6.D).
//
// Module này chỉ quyết định "nói gì": chọn kịch bản theo input và gọi API của
// `ctx` (do server.mjs cung cấp). Mọi chi tiết giao thức (thứ tự event, id,
// nhịp 20–40 ms, transcript, state) nằm trong server.mjs.
//
// API của ctx mà kịch bản được dùng:
//   ctx.newId(prefix)                      -> id duy nhất trên toàn server
//   ctx.startText()                        -> { id, write(text, opts?), end() }
//   ctx.text(content, opts?)               -> messageId (START + CONTENT… + END)
//   ctx.toolCall(name, args, parentMsgId)  -> toolCallId (START, ARGS…, END, RESULT "ok")
//   ctx.stateDelta(ops)                    -> phát STATE_DELTA (RFC 6902) và cập nhật state
//   ctx.setInterrupt(interrupt)            -> RUN_FINISHED sẽ mang outcome interrupt
//   ctx.fail(message, code)                -> phát RUN_ERROR (kết thúc run)

export const DEFAULT_QUIZ_COUNT = 5;
export const INTERRUPT_DEFAULTS = Object.freeze({ count: 10, difficulty: "medium" });
const MAX_QUIZ_COUNT = 50;
const SLOW_MS = parsePositiveInt(process.env.MOCK_SLOW_MS, 15_000);

const DIFFICULTIES = ["easy", "medium", "hard"];
const DIFFICULTY_LABEL = { easy: "Dễ", medium: "Vừa", hard: "Khó" };

// ---------------------------------------------------------------------------
// State mặc định (mục 4.7)
// ---------------------------------------------------------------------------

export function initialState() {
  return { artifacts: { quizzes: [], mindmaps: [] }, jobs: {} };
}

// ---------------------------------------------------------------------------
// Chọn kịch bản
// ---------------------------------------------------------------------------

// Ranh giới từ theo Unicode: "khác" không khớp trong "khách", "lỗi" không khớp
// giữa một từ khác. Văn bản được chuẩn hóa NFC + chữ thường trước khi so.
const WORD_CHAR = "[\\p{L}\\p{M}\\p{N}_]";
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const keywordRegExp = (words) =>
  new RegExp(
    `(?<!${WORD_CHAR})(?:${words.map((w) => escapeRegExp(w.normalize("NFC"))).join("|")})(?!${WORD_CHAR})`,
    "iu",
  );

// Ưu tiên từ trên xuống (bảng ở mục 6.D).
const KEYWORD_RULES = [
  { name: "error", re: keywordRegExp(["lỗi", "error", "errors"]), run: errorFlow },
  { name: "slow", re: keywordRegExp(["chậm", "slow"]), run: slowFlow },
  { name: "config", re: keywordRegExp(["cấu hình", "config", "configure", "configuration"]), run: configFlow },
  {
    name: "quiz",
    re: keywordRegExp(["quiz", "quizz", "quizzes", "câu hỏi", "kiểm tra"]),
    run: (ctx) => quizFlow(ctx, { count: DEFAULT_QUIZ_COUNT }),
  },
  { name: "compare", re: keywordRegExp(["so sánh", "khác", "compare", "comparison"]), run: compareFlow },
  { name: "mindmap", re: keywordRegExp(["mindmap", "mindmaps", "mind map", "sơ đồ"]), run: (ctx) => mindmapFlow(ctx) },
];

const REQUESTED_TOOL_FLOWS = { "generate-questions": "quiz", mindmap: "mindmap" };

/**
 * Quyết định kịch bản cho một run.
 *
 * User message "mới" (mục 4.6) = message `role:"user"` có `id` chưa từng xuất
 * hiện trong transcript đã lưu của thread. Client gửi lại transcript với id giữ
 * nguyên, nên message cũ không bị thêm trùng (kể cả ở run resume).
 *
 * @param {object} input   RunAgentInput đã qua kiểm tra cơ bản ở server.
 * @param {{ pendingInterruptId: string | null, hasMessage: (id: string) => boolean }} thread
 * @returns {{ name: string, newUserMessages: object[], run: (ctx) => Promise<void> }}
 */
export function planRun(input, thread) {
  const messages = Array.isArray(input.messages) ? input.messages.filter(isPlainObject) : [];
  const newUserMessages = findNewUserMessages(messages, thread);
  const requestedTools = parseRequestedTools(input.context);
  const resume = Array.isArray(input.resume) && input.resume.length > 0 ? input.resume : null;

  if (resume) {
    const entry = resume.find((e) => e.interruptId === thread.pendingInterruptId) ?? resume[0];
    // resolved: luôn theo nhánh resolved, kể cả khi kèm user message mới.
    if (entry.status === "resolved") {
      const payload = isPlainObject(entry.payload) ? entry.payload : {};
      const count = normalizeCount(payload.count, INTERRUPT_DEFAULTS.count);
      const difficulty = DIFFICULTIES.includes(payload.difficulty) ? payload.difficulty : null;
      return {
        name: "resume:resolved",
        newUserMessages,
        run: (ctx) => quizFlow(ctx, { count, difficulty, fromConfig: true }),
      };
    }
    // cancelled + có user message mới = steer away (useAgUiSteerAway gửi resume
    // cancelled KÈM message mới): bỏ interrupt, xử lý message mới như run thường.
    if (newUserMessages.length > 0) {
      const text = extractText(newUserMessages.at(-1).content);
      const routed = routeByMessage(text, requestedTools);
      return { name: `steer-away:${routed.name}`, newUserMessages, run: routed.run };
    }
    // cancelled + không có message mới = hủy.
    return { name: "resume:cancelled", newUserMessages, run: cancelledFlow };
  }

  const lastUser = findLast(messages, (m) => m.role === "user");
  const routed = routeByMessage(lastUser ? extractText(lastUser.content) : "", requestedTools);
  return { name: routed.name, newUserMessages, run: routed.run };
}

function findNewUserMessages(messages, thread) {
  const seen = new Set();
  const out = [];
  messages.forEach((m, index) => {
    if (m.role !== "user") return;
    const hasId = typeof m.id === "string" && m.id.length > 0;
    // Message không có id (sai schema) chỉ được coi là mới nếu nằm cuối input.
    if (!hasId && index !== messages.length - 1) return;
    if (hasId && (thread.hasMessage(m.id) || seen.has(m.id))) return;
    if (hasId) seen.add(m.id);
    out.push(m);
  });
  return out;
}

function routeByMessage(text, requestedTools) {
  // `requested_tools` thắng mọi từ khóa ("bất kể từ khóa", mục 6.D).
  const flows = [...new Set(requestedTools.map((t) => REQUESTED_TOOL_FLOWS[t]).filter(Boolean))];
  if (flows.length > 0) {
    return { name: `requested_tools:${flows.join("+")}`, run: (ctx) => requestedToolsFlow(ctx, flows) };
  }
  const normalized = text.normalize("NFC").toLowerCase().replace(/\s+/gu, " ");
  for (const rule of KEYWORD_RULES) {
    if (rule.re.test(normalized)) return { name: rule.name, run: rule.run };
  }
  return { name: "default", run: defaultFlow };
}

export function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p) => isPlainObject(p) && p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("\n");
  }
  return "";
}

function parseRequestedTools(context) {
  if (!Array.isArray(context)) return [];
  const out = [];
  for (const entry of context) {
    if (!isPlainObject(entry) || entry.description !== "requested_tools" || typeof entry.value !== "string") continue;
    let value;
    try {
      value = JSON.parse(entry.value);
    } catch {
      value = entry.value.split(",");
    }
    if (Array.isArray(value)) {
      for (const v of value) if (typeof v === "string" && v.trim()) out.push(v.trim());
    }
  }
  return out;
}

function normalizeCount(value, fallback) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), MAX_QUIZ_COUNT);
}

// ---------------------------------------------------------------------------
// Kịch bản
// ---------------------------------------------------------------------------

async function defaultFlow(ctx) {
  const messageId = await ctx.text(POLYMORPHISM_MD);
  await ctx.toolCall("cite_sources", { sources: POLYMORPHISM_SOURCES }, messageId);
  await ctx.toolCall("suggest_followups", { questions: FOLLOWUP_QUESTIONS }, messageId);
}

async function errorFlow(ctx) {
  const msg = await ctx.startText();
  await msg.write("Mình đang tra cứu các tài liệu liên quan để trả lời câu hỏi của bạn");
  await msg.write(", vui lòng chờ trong giây lát…");
  // Cố ý KHÔNG đóng message: RUN_ERROR được phép khi còn message mở (mục 4.8.4).
  await ctx.fail("Mô phỏng lỗi từ agent", "MOCK_ERROR");
}

async function slowFlow(ctx) {
  const startedAt = Date.now();
  const msg = await ctx.startText();
  const oneWord = { minWords: 1, maxWords: 1 };
  await msg.write(SLOW_INTRO, oneWord);
  for (let i = 0; Date.now() - startedAt < SLOW_MS; i++) {
    const section = SLOW_SECTIONS[i % SLOW_SECTIONS.length];
    const suffix = i >= SLOW_SECTIONS.length ? " (ôn lại)" : "";
    await msg.write(`\n\n### ${i + 1}. ${section.title}${suffix}\n\n${section.body}`, oneWord);
  }
  await msg.write(`\n\n${SLOW_OUTRO}`, oneWord);
  await msg.end();
}

async function cancelledFlow(ctx) {
  await ctx.text("Đã hủy sinh câu hỏi.");
}

async function configFlow(ctx) {
  // Trước interrupt luôn có một assistant text message (mục 4.6).
  await ctx.text(
    "Mình có thể sinh bộ câu hỏi trắc nghiệm từ các tài liệu bạn đang bật. " +
      "Hãy chọn số câu và độ khó bên dưới để mình bắt đầu nhé.",
  );
  ctx.setInterrupt({
    id: ctx.newId("int"),
    reason: "input_required",
    message: "Sinh câu hỏi từ tài liệu đang bật?",
    metadata: { kind: "quiz_config", defaults: { ...INTERRUPT_DEFAULTS }, documents: [] },
  });
}

/**
 * Job quiz: STATE_DELTA progress 0 → 40 → 80 → done, rồi show_quiz, rồi thêm
 * artifact vào /artifacts/quizzes/-. Text dẫn nhập được stream xen giữa các
 * bước tiến độ để Studio kịp hiển thị job đang chạy.
 */
async function quizFlow(ctx, { count, difficulty = null, fromConfig = false }) {
  const quiz = buildQuiz(ctx, count, difficulty);
  const jobId = ctx.newId("job");
  const jobPath = `/jobs/${jobId}`;

  await ctx.stateDelta([
    { op: "add", path: jobPath, value: { kind: "quiz", label: "Đang sinh câu hỏi", progress: 0, status: "running" } },
  ]);

  // Delta 1–2 từ để job "running" hiện đủ lâu (~1,5 giây) trên Studio.
  const fine = { minWords: 1, maxWords: 2 };
  const msg = await ctx.startText();
  if (fromConfig) {
    const level = difficulty ? DIFFICULTY_LABEL[difficulty] : "theo mặc định của từng câu";
    await msg.write(`Đã nhận cấu hình: **${count} câu**, độ khó **${level}**. `, fine);
  } else {
    await msg.write(`Mình sẽ tạo bộ **${count} câu hỏi trắc nghiệm** về lập trình hướng đối tượng trong Java. `, fine);
  }
  await ctx.stateDelta([{ op: "replace", path: `${jobPath}/progress`, value: 40 }]);
  await msg.write("Mình đang chọn các ý trọng tâm về đóng gói, kế thừa, đa hình và trừu tượng, ", fine);
  await ctx.stateDelta([{ op: "replace", path: `${jobPath}/progress`, value: 80 }]);
  await msg.write("rồi soạn đáp án kèm giải thích cho từng câu. Chúc bạn làm bài tốt!", fine);
  await msg.end();

  await ctx.stateDelta([
    { op: "replace", path: `${jobPath}/progress`, value: 100 },
    { op: "replace", path: `${jobPath}/status`, value: "done" },
    { op: "replace", path: `${jobPath}/label`, value: `Đã sinh ${count} câu hỏi` },
  ]);

  await ctx.toolCall("show_quiz", quiz.args, msg.id);
  await ctx.stateDelta([
    { op: "add", path: "/artifacts/quizzes/-", value: { id: quiz.id, title: quiz.args.title, count } },
  ]);
  return msg.id;
}

async function mindmapFlow(ctx, { parentMessageId = null } = {}) {
  const messageId =
    parentMessageId ??
    (await ctx.text(
      "Đây là sơ đồ tư duy tổng hợp **bốn trụ cột** của lập trình hướng đối tượng trong Java. " +
        "Bấm vào từng nhánh để mở rộng hoặc thu gọn.",
    ));
  const mapId = ctx.newId("mindmap");
  const title = "Sơ đồ tư duy: Lập trình hướng đối tượng";
  await ctx.toolCall("show_mindmap", { title, root: buildMindmapTree(mapId) }, messageId);
  await ctx.stateDelta([{ op: "add", path: "/artifacts/mindmaps/-", value: { id: mapId, title } }]);
  return messageId;
}

async function compareFlow(ctx) {
  const messageId = await ctx.text(
    "Dưới đây là phần so sánh **abstract class** và **interface** trong Java (từ Java 8 trở đi), " +
      "kèm ví dụ chuyển đổi và các bước chọn lựa khi thiết kế.",
  );
  await ctx.toolCall("present_ui", COMPARE_PRESENT_UI, messageId);
}

/**
 * Chạy các tool được chọn ở composer trong MỘT assistant message: quiz luôn
 * chạy trước (nó tự mở text dẫn nhập xen với tiến độ job), mindmap gắn tool
 * call vào cùng message đó; nếu chỉ có mindmap thì mindmap tự mở text.
 */
async function requestedToolsFlow(ctx, flows) {
  let messageId = null;
  if (flows.includes("quiz")) messageId = await quizFlow(ctx, { count: DEFAULT_QUIZ_COUNT });
  if (flows.includes("mindmap")) await mindmapFlow(ctx, { parentMessageId: messageId });
}

// ---------------------------------------------------------------------------
// Dữ liệu: quiz
// ---------------------------------------------------------------------------

const QUIZ_BANK = [
  {
    question: "Tính đóng gói (encapsulation) trong Java thường được hiện thực bằng cách nào?",
    options: [
      "Khai báo mọi field là public để lớp khác truy cập trực tiếp",
      "Khai báo field là private và cung cấp getter/setter khi cần",
      "Đặt mọi phương thức là static",
      "Gộp toàn bộ code vào một lớp duy nhất",
    ],
    answer_index: 1,
    explanation:
      "Đóng gói nghĩa là **che giấu trạng thái bên trong**: field để `private`, bên ngoài chỉ thao tác qua " +
      "phương thức công khai (getter/setter hoặc hành vi nghiệp vụ). Nhờ vậy lớp kiểm soát được dữ liệu hợp lệ.",
    difficulty: "easy",
  },
  {
    question: "Một lớp Java có thể kế thừa trực tiếp (extends) tối đa bao nhiêu lớp?",
    options: ["1", "2", "3", "Không giới hạn"],
    answer_index: 0,
    explanation:
      "Java chỉ cho phép **đơn kế thừa** với lớp: `class B extends A`. Để có nhiều kiểu cha, một lớp có thể " +
      "`implements` nhiều interface cùng lúc.",
    difficulty: "easy",
  },
  {
    question: "Phát biểu nào đúng về nạp chồng phương thức (overloading)?",
    options: [
      "Lớp con định nghĩa lại phương thức của lớp cha với cùng chữ ký",
      "Chỉ cần khác kiểu trả về là đủ",
      "Chỉ áp dụng được cho phương thức static",
      "Các phương thức cùng tên nhưng khác danh sách tham số",
    ],
    answer_index: 3,
    explanation:
      "Overloading là **cùng tên, khác số lượng/kiểu/thứ tự tham số**, được chọn lúc biên dịch. Chỉ khác kiểu " +
      "trả về thì **không** hợp lệ. Lớp con định nghĩa lại phương thức của lớp cha là *overriding*.",
    difficulty: "medium",
  },
  {
    question:
      "Cho lớp B extends A và B ghi đè phương thức hi() của A. Với khai báo A x = new B(); thì lời gọi x.hi() chạy phiên bản nào?",
    options: [
      "Phiên bản của A, vì biến x có kiểu khai báo là A",
      "Phiên bản của B, nhờ liên kết động (dynamic dispatch)",
      "Báo lỗi biên dịch vì kiểu không khớp",
      "Tùy vào JVM đang chạy",
    ],
    answer_index: 1,
    explanation:
      "Phương thức instance được chọn theo **kiểu thực tế của đối tượng** lúc chạy, không theo kiểu khai báo " +
      "của biến. Vì đối tượng là `B`, `x.hi()` chạy `B.hi()` — đây chính là đa hình lúc chạy.",
    difficulty: "medium",
  },
  {
    question: "Phát biểu nào đúng về interface trong Java 8 trở lên?",
    options: [
      "Interface có thể có constructor",
      "Field khai báo trong interface có thể gán lại giá trị",
      "Interface có thể chứa phương thức default có thân hàm",
      "Một lớp chỉ được implements một interface",
    ],
    answer_index: 2,
    explanation:
      "Từ Java 8, interface có thể có phương thức `default` và `static` có thân hàm. Interface **không** có " +
      "constructor, mọi field đều là `public static final`, và một lớp có thể implements nhiều interface.",
    difficulty: "hard",
  },
];

/** Quiz `count` câu: 5 câu gốc, vượt 5 thì lặp lại có xoay thứ tự đáp án. */
function buildQuiz(ctx, count, difficulty) {
  const quizId = ctx.newId("quiz");
  const questions = [];
  for (let i = 0; i < count; i++) {
    const base = QUIZ_BANK[i % QUIZ_BANK.length];
    const round = Math.floor(i / QUIZ_BANK.length);
    const n = base.options.length;
    const shift = round % n;
    const options = base.options.map((_, j) => base.options[(j + shift) % n]);
    const answerIndex = (base.answer_index - shift + n) % n;
    questions.push({
      id: `${quizId}-q${i + 1}`,
      question: round === 0 ? base.question : `${base.question} (biến thể ${round + 1})`,
      options,
      answer_index: answerIndex,
      explanation: base.explanation,
      difficulty: difficulty ?? base.difficulty,
    });
  }
  const level = difficulty ? ` · ${DIFFICULTY_LABEL[difficulty]}` : "";
  return { id: quizId, args: { title: `Quiz OOP trong Java (${count} câu${level})`, questions } };
}

// ---------------------------------------------------------------------------
// Dữ liệu: mindmap
// ---------------------------------------------------------------------------

const MINDMAP_BRANCHES = [
  ["Đóng gói", ["Access modifier (private, protected, public)", "Getter / Setter", "Che giấu trạng thái bên trong"]],
  ["Kế thừa", ["Từ khóa extends", "Gọi lớp cha bằng super", "Đơn kế thừa với lớp"]],
  ["Đa hình", ["Overloading (lúc biên dịch)", "Overriding (lúc chạy)", "Dynamic dispatch"]],
  ["Trừu tượng", ["Abstract class", "Interface"]],
];

function buildMindmapTree(mapId) {
  let seq = 0;
  const nodeId = () => `${mapId}-n${++seq}`;
  return {
    id: `${mapId}-root`,
    label: "Lập trình hướng đối tượng",
    children: MINDMAP_BRANCHES.map(([label, leaves]) => ({
      id: nodeId(),
      label,
      children: leaves.map((leaf) => ({ id: nodeId(), label: leaf })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Dữ liệu: so sánh (present_ui)
// ---------------------------------------------------------------------------

const COMPARE_PRESENT_UI = {
  title: "Abstract class và Interface trong Java",
  blocks: [
    {
      type: "comparison_table",
      columns: ["Tiêu chí", "Abstract class", "Interface"],
      rows: [
        ["Kế thừa", "Một lớp chỉ extends được 1 abstract class", "Một lớp implements được nhiều interface"],
        ["Trạng thái (field)", "Có field instance, mọi access modifier", "Chỉ có hằng số public static final"],
        ["Constructor", "Có", "Không"],
        ["Phương thức", "Cả abstract lẫn có thân hàm", "Abstract, default, static, private (Java 9+)"],
        ["Access modifier của phương thức", "public, protected, package-private, private", "Mặc định public"],
        ["Khi nào dùng", "Các lớp con chung code và trạng thái (quan hệ is-a)", "Định nghĩa khả năng chung (quan hệ can-do)"],
      ],
      highlight_col: 2,
    },
    {
      type: "callout",
      tone: "tip",
      title: "Mẹo chọn nhanh",
      body_md:
        "Mặc định chọn **interface** để định nghĩa hợp đồng. Chỉ dùng **abstract class** khi các lớp con thật sự " +
        "cần chung *trạng thái* hoặc *code cài đặt sẵn*.",
    },
    {
      type: "code_diff",
      language: "java",
      before: [
        "abstract class Animal {",
        "    protected final String name;",
        "",
        "    Animal(String name) { this.name = name; }",
        "",
        "    abstract String sound();",
        "",
        "    void introduce() {",
        '        System.out.println(name + " kêu: " + sound());',
        "    }",
        "}",
        "",
        "class Dog extends Animal {",
        '    Dog() { super("Chó"); }',
        "",
        "    @Override",
        '    String sound() { return "Gâu gâu"; }',
        "}",
      ].join("\n"),
      after: [
        "interface Animal {",
        "    String name();",
        "    String sound();",
        "",
        "    default void introduce() {",
        '        System.out.println(name() + " kêu: " + sound());',
        "    }",
        "}",
        "",
        "class Dog implements Animal {",
        "    @Override",
        '    public String name() { return "Chó"; }',
        "",
        "    @Override",
        '    public String sound() { return "Gâu gâu"; }',
        "}",
      ].join("\n"),
      explanation_md:
        "Bản **abstract class** giữ được trạng thái chung (`name`) và constructor. Bản **interface** không có " +
        "field instance nên mỗi lớp tự cung cấp `name()`, đổi lại `Dog` vẫn còn chỗ `extends` một lớp khác và " +
        "có thể implements thêm nhiều interface.",
    },
    {
      type: "steps",
      items: [
        {
          title: "Xác định quan hệ",
          body_md: "Quan hệ **is-a** và các lớp con chia sẻ code/trạng thái → cân nhắc *abstract class*.",
        },
        {
          title: "Tách hợp đồng",
          body_md: "Hành vi mà nhiều lớp không liên quan cùng có (như `Comparable`, `Runnable`) → đưa vào *interface*.",
        },
        {
          title: "Kết hợp khi cần",
          body_md: "Khai báo interface làm kiểu công khai, rồi cung cấp abstract class cài đặt sẵn một phần (mẫu `List` → `AbstractList`).",
        },
        {
          title: "Lập trình theo interface",
          body_md: "Khai báo biến và tham số theo kiểu interface (`List<String> xs = new ArrayList<>();`) để dễ thay cài đặt.",
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Dữ liệu: mặc định (đa hình)
// ---------------------------------------------------------------------------

const POLYMORPHISM_MD = `## Đa hình (Polymorphism) trong Java

**Đa hình** là khả năng một tham chiếu kiểu cha trỏ tới nhiều loại đối tượng con khác nhau, và lời gọi phương thức sẽ chạy đúng phiên bản của lớp con tại thời điểm chạy.

Java có hai dạng đa hình:

1. **Đa hình lúc biên dịch** (*compile-time*): nạp chồng phương thức (*overloading*) — cùng tên, khác danh sách tham số.
2. **Đa hình lúc chạy** (*runtime*): ghi đè phương thức (*overriding*) — lớp con định nghĩa lại phương thức của lớp cha, JVM chọn phiên bản phù hợp nhờ *dynamic dispatch*.

\`\`\`java
abstract class Shape {
    abstract double area();
}

class Circle extends Shape {
    private final double r;
    Circle(double r) { this.r = r; }
    @Override double area() { return Math.PI * r * r; }
}

class Square extends Shape {
    private final double a;
    Square(double a) { this.a = a; }
    @Override double area() { return a * a; }
}

public class Main {
    public static void main(String[] args) {
        Shape[] shapes = { new Circle(1), new Square(2) };
        for (Shape s : shapes) {
            System.out.println(s.area()); // gọi đúng area() của từng lớp con
        }
    }
}
\`\`\`

Về chi phí, mỗi lời gọi phương thức ảo được JVM tra qua bảng phương thức (*vtable*) với độ phức tạp $O(1)$, nên đa hình gần như không làm chậm chương trình.

> **Mẹo:** hãy lập trình theo kiểu trừu tượng (\`Shape\`) thay vì kiểu cụ thể (\`Circle\`) để code dễ mở rộng.`;

const POLYMORPHISM_SOURCES = [
  {
    file_id: "doc_oop_java_textbook",
    file_name: "Giao-trinh-Lap-trinh-huong-doi-tuong-Java.pdf",
    page: 87,
    quote:
      "Đa hình cho phép cùng một lời gọi phương thức thực hiện các hành vi khác nhau tùy theo kiểu thực tế của đối tượng tại thời điểm chạy.",
  },
  {
    file_id: "doc_java_lecture_05",
    file_name: "Bai-giang-tuan-05-Ke-thua-va-Da-hinh.pdf",
    page: 14,
    quote:
      "Phương thức ghi đè phải có cùng tên, cùng danh sách tham số và kiểu trả về tương thích với phương thức của lớp cha.",
  },
];

const FOLLOWUP_QUESTIONS = [
  "So sánh abstract class và interface khác nhau thế nào?",
  "Tạo quiz kiểm tra kiến thức về đa hình",
  "Vẽ sơ đồ mindmap các khái niệm OOP",
];

// ---------------------------------------------------------------------------
// Dữ liệu: kịch bản chậm (~15 giây, dùng để thử nút Dừng)
// ---------------------------------------------------------------------------

const SLOW_INTRO =
  "Câu trả lời này được stream **chậm** có chủ đích để bạn thử nút Dừng. Mình sẽ điểm qua các nguyên tắc thiết kế hướng đối tượng quan trọng.";

const SLOW_SECTIONS = [
  {
    title: "Single Responsibility",
    body: "Mỗi lớp chỉ nên có một lý do để thay đổi. Khi một lớp vừa đọc file, vừa tính toán, vừa in báo cáo, mọi thay đổi nhỏ đều có nguy cơ làm hỏng phần khác. Hãy tách thành các lớp nhỏ, mỗi lớp lo một việc.",
  },
  {
    title: "Open/Closed",
    body: "Lớp nên mở để mở rộng nhưng đóng để sửa đổi. Thay vì thêm một nhánh if mới cho mỗi loại hình, hãy để mỗi loại hình là một lớp con cài đặt phương thức chung, nhờ vậy code cũ không cần sửa khi thêm loại mới.",
  },
  {
    title: "Liskov Substitution",
    body: "Đối tượng của lớp con phải thay thế được đối tượng của lớp cha mà chương trình vẫn đúng. Nếu lớp con ném ngoại lệ cho một phương thức mà lớp cha hứa hỗ trợ, quan hệ kế thừa đó đang bị dùng sai.",
  },
  {
    title: "Interface Segregation",
    body: "Không nên ép một lớp cài đặt những phương thức nó không dùng. Một interface lớn nên được tách thành nhiều interface nhỏ, tập trung, để mỗi lớp chỉ implements đúng phần mình cần.",
  },
  {
    title: "Dependency Inversion",
    body: "Module cấp cao không nên phụ thuộc trực tiếp vào module cấp thấp; cả hai nên phụ thuộc vào trừu tượng. Trong Java, điều này thường có nghĩa là nhận interface qua constructor thay vì tự tạo đối tượng cụ thể bên trong.",
  },
  {
    title: "Ưu tiên composition hơn kế thừa",
    body: "Kế thừa tạo ra ràng buộc chặt giữa lớp cha và lớp con. Khi chỉ cần tái sử dụng hành vi, hãy cân nhắc giữ một đối tượng khác làm field và ủy quyền công việc cho nó; cách này linh hoạt và dễ kiểm thử hơn.",
  },
  {
    title: "Che giấu chi tiết cài đặt",
    body: "Chỉ công khai những gì bên ngoài thật sự cần. Field để private, phương thức hỗ trợ để private hoặc package-private, và trả về bản sao hoặc tập hợp chỉ đọc thay vì để lộ cấu trúc dữ liệu bên trong.",
  },
  {
    title: "Đặt tên theo nghiệp vụ",
    body: "Tên lớp và phương thức nên phản ánh khái niệm của bài toán, chẳng hạn Order, Invoice, calculateTotal, thay vì Manager hay Helper chung chung. Tên rõ ràng giúp người đọc hiểu thiết kế mà không cần đọc hết code.",
  },
  {
    title: "Bất biến khi có thể",
    body: "Đối tượng bất biến, với field final và không có setter, an toàn khi dùng chung giữa nhiều luồng và dễ suy luận hơn. Các lớp như String hay record trong Java là ví dụ điển hình.",
  },
  {
    title: "Kiểm thử theo hành vi",
    body: "Viết unit test cho hành vi công khai của lớp thay vì chi tiết bên trong. Khi thiết kế tốt, bạn có thể thay đổi cài đặt mà các bài test vẫn giữ nguyên, và đó là dấu hiệu các lớp đang được đóng gói hợp lý.",
  },
];

const SLOW_OUTRO = "Vậy là xong phần ôn tập nguyên tắc thiết kế. Bạn muốn đi sâu vào nguyên tắc nào?";

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findLast(list, predicate) {
  for (let i = list.length - 1; i >= 0; i--) if (predicate(list[i])) return list[i];
  return undefined;
}

function parsePositiveInt(raw, fallback) {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
