import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api';

const TOOLS = [
    {
        id: 'mindmap',
        title: 'Bản đồ tư duy',
        icon: (
            <>
                <circle cx="12" cy="12" r="2.6" /><circle cx="5" cy="6" r="2.2" /><circle cx="19" cy="6" r="2.2" />
                <circle cx="5" cy="18" r="2.2" /><circle cx="19" cy="18" r="2.2" />
                <path d="M10 10.6 6.6 7.6M14 10.6l3.4-3M10 13.4l-3.4 3M14 13.4l3.4 3" />
            </>
        ),
    },
    {
        id: 'flashcard',
        title: 'Thẻ ghi nhớ',
        icon: (<><rect x="4" y="4" width="16" height="16" rx="2.5" /><path d="M8.5 9.5h7M8.5 13h4.5" /></>),
    },
    {
        id: 'quiz',
        title: 'Bài kiểm tra',
        icon: (<><path d="M9 11.5 11 13.5 15.5 9" /><rect x="4" y="4" width="16" height="16" rx="2.5" /></>),
    },
];

function ToolCard({ tool, subtitle, active, disabled, busy, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled || busy}
            className={`w-full min-h-[60px] flex items-center gap-3 py-3 px-3.5 rounded-[10px] border text-left transition-colors
                        ${active ? 'border-accent bg-accent-tint' : 'border-hairline-soft hover:border-hairline hover:bg-surface'}
                        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
            <svg className="w-[18px] h-[18px] shrink-0 text-accent" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {tool.icon}
            </svg>
            <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold">{tool.title}</span>
                <span className="block text-[11px] text-muted mt-0.5">{busy ? 'Đang tạo…' : subtitle}</span>
            </span>
            {tool.id === 'quiz' && !busy && !disabled && (
                <svg className="w-[15px] h-[15px] shrink-0 text-accent" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" />
                </svg>
            )}
            {busy && <span className="w-3.5 h-3.5 shrink-0 rounded-full border-2 border-primary-orange border-t-transparent animate-spin" />}
        </button>
    );
}

const StudioDashboard = ({ sessionUUID }) => {
    const [projects, setProjects] = useState([]);
    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [error, setError] = useState(null);

    const [selectedProject, setSelectedProject] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Đáp án đã chọn, khoá theo chỉ số câu. Bản cũ xoá sạch state này mỗi lần
    // đổi câu nên bấm "Câu tiếp" rồi "Câu trước" là mất hết kết quả đã làm.
    const [answers, setAnswers] = useState({});

    const fetchProjects = useCallback(async () => {
        if (!sessionUUID) { setProjects([]); return; }
        try {
            const res = await apiFetch(`/session-projects/${encodeURIComponent(sessionUUID)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setProjects(data.projects || []);
        } catch (err) {
            console.error('Không tải được danh sách project:', err);
            setProjects([]);
        }
    }, [sessionUUID]);

    useEffect(() => { fetchProjects(); }, [fetchProjects]);

    const handleQuizClick = async () => {
        if (!sessionUUID) return;
        setLoadingQuiz(true);
        setError(null);
        try {
            const form = new FormData();
            form.append('session_id', sessionUUID);
            const res = await apiFetch('/process', { method: 'POST', body: form });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await res.json();
            await fetchProjects();
        } catch (err) {
            // Bản cũ nuốt lỗi ở đây: spinner chạy rồi tắt, không project nào
            // sinh ra và người dùng không biết vì sao.
            console.error('Tạo bài kiểm tra thất bại:', err);
            setError('Không tạo được bài kiểm tra. Máy chủ chưa trả lời được yêu cầu này.');
        } finally {
            setLoadingQuiz(false);
        }
    };

    const openProject = async (projectId) => {
        setLoadingQuestions(true);
        setSelectedProject(projectId);
        setCurrentIndex(0);
        setAnswers({});
        setError(null);
        try {
            const res = await apiFetch(`/project-questions/${encodeURIComponent(projectId)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setQuestions(data.questions || []);
        } catch (err) {
            console.error('Không tải được câu hỏi:', err);
            setQuestions([]);
            setError('Không tải được câu hỏi của bài kiểm tra này.');
        } finally {
            setLoadingQuestions(false);
        }
    };

    const closeQuestions = () => {
        setSelectedProject(null);
        setQuestions([]);
        setAnswers({});
        setCurrentIndex(0);
    };

    const pickAnswer = (optionIndex) => {
        if (answers[currentIndex] !== undefined) return; // đã trả lời thì không đổi
        setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
    };

    if (!sessionUUID) {
        return <p className="p-4 text-[13px] text-muted">Đang mở phiên…</p>;
    }

    const current = questions[currentIndex];
    const picked = answers[currentIndex];
    const answered = picked !== undefined;

    return (
        <div className="p-3.5 flex flex-col gap-4">
            {selectedProject === null ? (
                <>
                    <div className="flex flex-col gap-2">
                        <ToolCard tool={TOOLS[0]} subtitle="Sắp có" disabled onClick={() => { }} />
                        <ToolCard tool={TOOLS[1]} subtitle="Sắp có" disabled onClick={() => { }} />
                        <ToolCard
                            tool={TOOLS[2]}
                            subtitle={projects.length ? 'Tạo bài mới từ tài liệu đang bật' : 'Tạo từ tài liệu đang bật'}
                            active
                            busy={loadingQuiz}
                            onClick={handleQuizClick}
                        />
                    </div>

                    {error && (
                        <p role="alert" className="py-2.5 px-3 rounded-lg border border-error-red/25 bg-error-red/5 text-[12.5px] leading-relaxed text-error-red">
                            {error}
                        </p>
                    )}

                    <div className="pt-3.5 border-t border-hairline-soft flex flex-col gap-2.5">
                        <span className="label-caps">Đã tạo</span>
                        {projects.length === 0 ? (
                            <p className="text-[12.5px] leading-relaxed text-muted">
                                Chưa có bài nào. Bấm “Bài kiểm tra” ở trên để tạo từ tài liệu đang bật.
                            </p>
                        ) : (
                            projects.map((project) => (
                                <button
                                    key={project.id}
                                    type="button"
                                    onClick={() => openProject(project.id)}
                                    className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-surface transition-colors"
                                >
                                    <svg className="w-4 h-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h7A1.5 1.5 0 0 1 19 10v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 17z" />
                                    </svg>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[13px] truncate">{project.name}</span>
                                        <span className="block text-[10.5px] text-muted-soft mt-0.5 truncate">ID: {project.id}</span>
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-col gap-3.5">
                    <div className="flex items-center gap-2.5">
                        <button type="button" onClick={closeQuestions} aria-label="Quay lại Studio"
                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-main-text hover:bg-surface transition-colors">
                            <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="m15 5-7 7 7 7" /></svg>
                        </button>
                        <span className="flex-1 text-[13.5px] font-semibold">Bài kiểm tra</span>
                        {questions.length > 0 && (
                            <span className="text-[11.5px] text-muted">Câu {currentIndex + 1}/{questions.length}</span>
                        )}
                    </div>

                    {loadingQuestions ? (
                        <p className="py-6 text-center text-[13px] text-muted">Đang tải câu hỏi…</p>
                    ) : questions.length === 0 ? (
                        <p className="py-6 text-center text-[13px] text-muted">Bài này chưa có câu hỏi nào.</p>
                    ) : (
                        <>
                            <div className="h-[3px] rounded-sm bg-hairline-soft overflow-hidden">
                                <div className="h-full rounded-sm bg-accent transition-all"
                                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }} />
                            </div>

                            <p className="text-[14px] font-semibold leading-snug">{current.question}</p>

                            <div className="flex flex-col gap-2">
                                {(current.options || []).map((option, i) => {
                                    const isPick = picked === i;
                                    const isRight = i === current.correct_answer;
                                    let box = 'border-hairline-soft bg-panel hover:border-hairline';
                                    let badge = 'bg-surface text-main-text/60';
                                    if (answered && isRight) {
                                        box = 'border-ok/50 bg-ok/5';
                                        badge = 'bg-ok text-white';
                                    } else if (isPick) {
                                        box = 'border-error-red/45 bg-error-red/5';
                                        badge = 'bg-error-red text-white';
                                    }
                                    return (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => pickAnswer(i)}
                                            disabled={answered}
                                            className={`w-full flex items-start gap-2.5 py-2.5 px-3 rounded-[9px] border text-left transition-colors ${box}
                                                        ${answered ? 'cursor-default' : ''}`}
                                        >
                                            <span className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold ${badge}`}>
                                                {String.fromCharCode(65 + i)}
                                            </span>
                                            <span className="text-[12.5px] leading-relaxed">{option}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {answered && (
                                <div className="py-2.5 px-3 rounded-[9px] border border-ok/25 bg-ok/5">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ok">
                                        {picked === current.correct_answer ? 'Chính xác' : 'Chưa đúng'}
                                    </div>
                                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-main-text/75">{current.explanation}</p>
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                                    disabled={currentIndex === 0}
                                    className="h-8 px-3.5 rounded-lg border border-hairline bg-panel text-[12.5px]
                                               hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Câu trước
                                </button>
                                <span className="flex-1" />
                                <button
                                    type="button"
                                    onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                                    disabled={currentIndex === questions.length - 1}
                                    className="h-8 px-3.5 rounded-lg text-[12.5px] font-semibold text-white bg-accent
                                               hover:bg-accent-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Câu tiếp
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default StudioDashboard;
