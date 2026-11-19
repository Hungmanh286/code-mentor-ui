// Sample tool-call args for the 5 backend tools in PLAN.md section 4.5.
// Each tool has:
//   full      – complete, contract-conformant args
//   partial   – what a renderer may see mid-stream (missing fields, cut-off arrays/strings, empty objects)
//   malformed – wrong types / out-of-range values, to prove renderers never throw on bad data
// Used by the C1 render self-check (renderToString on every variant x every status).

const QUIZ_FULL = {
  title: "Kiểm tra nhanh: Đa hình trong Java",
  questions: [
    {
      id: "q1",
      question: "Điều nào sau đây CHỈ đúng với lớp trừu tượng, không đúng với interface?",
      options: [
        "Có thể khai báo phương thức không có thân hàm",
        "Có thể mang trường dữ liệu thể hiện (instance field)",
        "Không thể tạo đối tượng trực tiếp",
        "Có thể được nhiều lớp cùng sử dụng",
      ],
      answer_index: 1,
      explanation:
        "Interface chỉ mô tả **hành vi** và hằng số `static final`; trạng thái thể hiện là thứ chỉ lớp trừu tượng giữ được.",
      difficulty: "easy",
    },
    {
      id: "q2",
      question: "Đa hình lúc chạy (runtime polymorphism) trong Java được quyết định dựa vào đâu?",
      options: [
        "Kiểu khai báo của biến",
        "Kiểu thực của đối tượng",
        "Số lượng tham số truyền vào",
        "Thứ tự khai báo phương thức",
      ],
      answer_index: 1,
      explanation:
        "Trình biên dịch chỉ kiểm tra kiểu khai báo; JVM chọn phương thức theo **kiểu thực** của đối tượng:\n\n```java\nShape s = new Circle();\ns.area(); // gọi Circle.area()\n```",
      difficulty: "medium",
    },
    {
      id: "q3",
      question: "Nạp chồng phương thức (overloading) được phân giải khi nào?",
      options: ["Lúc biên dịch", "Lúc nạp lớp", "Lúc chạy", "Lúc thu gom rác"],
      answer_index: 0,
      explanation:
        "Overloading dựa hoàn toàn vào chữ ký tham số nên trình biên dịch chốt được ngay. Tra bảng phương thức ảo khi chạy tốn $O(1)$, còn overloading không tốn gì lúc chạy.",
      difficulty: "hard",
    },
  ],
};

const MINDMAP_FULL = {
  title: "Sơ đồ: Lập trình hướng đối tượng",
  root: {
    id: "root",
    label: "Lập trình hướng đối tượng",
    children: [
      {
        id: "enc",
        label: "Đóng gói",
        children: [
          { id: "enc-1", label: "Phạm vi truy cập private/protected/public" },
          { id: "enc-2", label: "Getter và setter" },
        ],
      },
      {
        id: "inh",
        label: "Kế thừa",
        children: [
          { id: "inh-1", label: "Từ khóa extends" },
          { id: "inh-2", label: "Ghi đè phương thức (@Override)" },
          {
            id: "inh-3",
            label: "Lớp trừu tượng",
            children: [{ id: "inh-3-1", label: "Phương thức abstract" }],
          },
        ],
      },
      {
        id: "poly",
        label: "Đa hình",
        children: [
          { id: "poly-1", label: "Đa hình lúc biên dịch (overloading)" },
          { id: "poly-2", label: "Đa hình lúc chạy (overriding)" },
        ],
      },
      {
        id: "abs",
        label: "Trừu tượng",
        children: [
          { id: "abs-1", label: "Interface" },
          { id: "abs-2", label: "Abstract class" },
          { id: "abs-3", label: "Che giấu chi tiết cài đặt" },
        ],
      },
    ],
  },
};

// Builds a chain deeper than the 6-level render limit.
function deepChain(levels) {
  let node = { id: `deep-${levels}`, label: `Cấp ${levels}` };
  for (let i = levels - 1; i >= 1; i -= 1) {
    node = { id: `deep-${i}`, label: `Cấp ${i}`, children: [node] };
  }
  return node;
}

const SOURCES_FULL = {
  sources: [
    {
      file_id: "f1",
      file_name: "Bài 1 — Tổng quan LTHĐT.pdf",
      page: 7,
      quote: "Đa hình cho phép một biến kiểu lớp cha tham chiếu tới đối tượng của bất kỳ lớp con nào.",
    },
    {
      file_id: "f2",
      file_name: "Kế thừa và đa hình.pdf",
      page: 3,
      quote: "Phương thức được gọi được xác định dựa trên kiểu thực của đối tượng tại thời điểm chạy.",
    },
    {
      file_id: "f3",
      file_name: "Bài tập chương 3.pdf",
      quote: "Viết lớp Shape trừu tượng với phương thức area() và hai lớp con Circle, Rectangle.",
    },
  ],
};

const FOLLOWUPS_FULL = {
  questions: [
    "Khi nào nên dùng abstract class thay vì interface?",
    "Cho ví dụ nạp chồng phương thức dễ gây nhầm lẫn",
    "Đa hình có làm chương trình chạy chậm hơn không?",
  ],
};

const PRESENT_UI_FULL = {
  title: "So sánh abstract class và interface",
  blocks: [
    {
      type: "comparison_table",
      columns: ["Tiêu chí", "Abstract class", "Interface"],
      rows: [
        ["Đa kế thừa", "Không (chỉ extends một lớp)", "Có (implements nhiều interface)"],
        ["Trạng thái (field)", "Có field thể hiện", "Chỉ hằng số static final"],
        ["Constructor", "Có", "Không"],
        ["Phương thức có thân", "Có", "Có từ Java 8 (default/static)"],
      ],
      highlight_col: 2,
    },
    {
      type: "callout",
      tone: "tip",
      title: "Mẹo chọn nhanh",
      body_md: "Hỏi: quan hệ **là một** (`is-a`) thì dùng abstract class; quan hệ **làm được** (`can-do`) thì dùng interface.",
    },
    {
      type: "code_diff",
      language: "java",
      before: "abstract class Flyable {\n    abstract void fly();\n}\n\nclass Bird extends Flyable {\n    void fly() { System.out.println(\"Vỗ cánh\"); }\n}",
      after: "interface Flyable {\n    void fly();\n}\n\nclass Bird extends Animal implements Flyable {\n    public void fly() { System.out.println(\"Vỗ cánh\"); }\n}",
      explanation_md: "Chuyển `Flyable` thành interface giúp `Bird` vẫn kế thừa được `Animal` — Java chỉ cho phép **một** lớp cha.",
    },
    {
      type: "steps",
      items: [
        { title: "Xác định hành vi chung", body_md: "Liệt kê các phương thức mà mọi lớp con đều cần." },
        { title: "Kiểm tra trạng thái dùng chung", body_md: "Nếu cần field chung, chọn `abstract class`." },
        { title: "Kiểm tra đa kế thừa", body_md: "Nếu lớp cần nhiều \"khả năng\" độc lập, tách thành nhiều `interface`." },
      ],
    },
    {
      type: "concept_card",
      term: "Interface",
      definition_md: "Bản hợp đồng mô tả **những gì** một lớp làm được, không quy định **cách** làm. Độ phức tạp tra cứu phương thức: $O(1)$.",
      example_code: "interface Shape {\n    double area();\n}",
      language: "java",
    },
    {
      type: "callout",
      tone: "warning",
      title: "Lưu ý",
      body_md: "Từ Java 8 interface có `default method`, nhưng vẫn **không** có field thể hiện.",
    },
    {
      type: "callout",
      tone: "info",
      title: "Ghi nhớ",
      body_md: "Một lớp có thể vừa `extends` một lớp vừa `implements` nhiều interface.",
    },
  ],
};

export const FIXTURES = {
  show_quiz: {
    full: QUIZ_FULL,
    partial: {
      title: "Kiểm tra nhanh: Đa h",
      questions: [
        QUIZ_FULL.questions[0],
        {
          id: "q2",
          question: "Đa hình lúc chạy trong Java được quyết định",
          options: ["Kiểu khai báo của biến", "Kiểu th"],
        },
        {},
      ],
    },
    malformed: {
      title: 42,
      questions: [
        null,
        "không phải object",
        { id: "x1", question: { text: "object thay vì string" }, options: "abc", answer_index: 9 },
        { id: "x2", question: "Chỉ số đáp án ngoài phạm vi?", options: ["A", "B"], answer_index: 5 },
        {
          id: "x3",
          question: "Câu hợp lệ duy nhất (độ khó lạ, option không phải string)?",
          options: ["Có", 2, null, { a: 1 }],
          answer_index: 0,
          explanation: ["không", "phải", "string"],
          difficulty: "impossible",
        },
      ],
    },
  },

  show_mindmap: {
    full: MINDMAP_FULL,
    partial: {
      title: "Sơ đồ: Lập trình hướng",
      root: {
        id: "root",
        label: "Lập trình hướng đối tượng",
        children: [
          {
            id: "enc",
            label: "Đóng gói",
            children: [{ id: "enc-1", label: "Phạm vi truy cập pri" }],
          },
          { id: "inh" },
          {},
        ],
      },
    },
    malformed: {
      title: ["không", "phải", "string"],
      root: {
        id: 1,
        label: 12345,
        children: [
          null,
          "chuỗi",
          { id: "dup", label: "Trùng id", children: "không phải mảng" },
          { id: "dup", label: { nested: true } },
          deepChain(10),
        ],
      },
    },
  },

  cite_sources: {
    full: SOURCES_FULL,
    partial: {
      sources: [
        { file_id: "f1", file_name: "Bài 1 — Tổng quan LTHĐT.pdf", page: 7, quote: "Đa hình cho phép một biến" },
        { file_id: "f2" },
        {},
      ],
    },
    malformed: {
      sources: [null, 7, { file_id: { x: 1 }, file_name: ["a"], page: "7", quote: 99 }, { file_name: "Âm trang.pdf", page: -3 }],
    },
  },

  suggest_followups: {
    full: FOLLOWUPS_FULL,
    partial: {
      questions: ["Khi nào nên dùng abstract class thay vì", ""],
    },
    malformed: {
      questions: [null, 3, { q: "object" }, "Câu hợp lệ duy nhất?", "Câu hợp lệ duy nhất?"],
    },
  },

  present_ui: {
    full: PRESENT_UI_FULL,
    partial: {
      title: "So sánh abstract",
      blocks: [
        { type: "callout", tone: "ti", title: "Mẹo" },
        {
          type: "comparison_table",
          columns: ["Tiêu chí", "Abstract class"],
          rows: [["Đa kế thừa", "Không"], ["Trạng"]],
        },
        { type: "steps", items: [{ title: "Xác định" }, {}] },
        { type: "code_diff", language: "ja", before: "abstract class Fly" },
        { type: "concept_c" },
      ],
    },
    malformed: {
      title: { not: "string" },
      blocks: [
        { type: "chart", data: [1, 2, 3] },
        null,
        "chuỗi",
        { tone: "info" },
        { type: "callout", tone: 7, title: ["x"], body_md: { md: true } },
        { type: "steps", items: "không phải mảng" },
        { type: "comparison_table", columns: null, rows: [["a", "b", "c"], "hàng hỏng", [1, null, { x: 1 }]], highlight_col: 99 },
        { type: "code_diff", language: null, before: 1, after: ["x"], explanation_md: null },
        { type: "concept_card", term: { a: 1 }, definition_md: 5, example_code: 10 },
        { type: "__proto__" },
        { type: "toString" },
      ],
    },
  },
};

export default FIXTURES;
