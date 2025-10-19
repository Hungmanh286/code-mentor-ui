import React, { useState, useEffect } from "react";
import "../assets/css/StudioDashboard.css";

const StudioDashboard = ({ onCollapsedChange, sessionUUID }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [showQuiz, setShowQuiz] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState([]);

    // Thông báo lên App khi trạng thái thu gọn thay đổi
    useEffect(() => {
        if (onCollapsedChange) {
            onCollapsedChange(collapsed);
        }
    }, [collapsed, onCollapsedChange]);

    const fetchQuizData = async () => {
        if (!sessionUUID) {
            console.log("Cannot fetch quiz data: No session UUID available");
            return; // Chưa có session thì không gọi API
        }

        try {
            console.log("Fetching quiz data with session:", sessionUUID);
            const formData = new FormData();
            formData.append("session_id", sessionUUID);
            const response = await fetch("http://0.0.0.0:8686/process", {
                method: "POST",
                body: formData
            });

            console.log("Quiz data response status:", response.status);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const questions = await response.json();
            console.log("Received quiz data:", questions);
            const arr = Array.isArray(questions) ? questions : [questions];
            setQuizQuestions(arr);
            setAnswers(new Array(arr.length).fill(null));
            setCurrentIndex(0);
            setSelectedAnswer(null);
            setShowQuiz(true);
        } catch (error) {
            console.error("Error fetching quiz data:", error);
        }
    };

    const handleQuizClick = () => {
        fetchQuizData();
    };

    const handleAnswerSelect = (optionIndex) => {
        setSelectedAnswer(optionIndex);
        setAnswers((prev) => {
            const copy = prev ? [...prev] : [];
            copy[currentIndex] = optionIndex;
            return copy;
        });
    };

    const handleNext = () => {
        if (currentIndex >= quizQuestions.length - 1) {
            setShowQuiz(false);
            return;
        }
        setCurrentIndex((i) => i + 1);
        setSelectedAnswer(answers[currentIndex + 1] ?? null);
    };

    const handlePrev = () => {
        if (currentIndex <= 0) return;
        setCurrentIndex((i) => i - 1);
        setSelectedAnswer(answers[currentIndex - 1] ?? null);
    };

    const tools = [
        { title: "Bản đồ tư duy", color: "mindmap", onClick: () => { } },
        { title: "File câu hỏi", color: "flashcard", onClick: () => { } },
        { title: "Bài kiểm tra", color: "quiz", onClick: handleQuizClick },
    ];

    const notes = [
    ];

    const renderQuizSummary = () => {
        const total = quizQuestions.length;
        const correct = quizQuestions.reduce((acc, q, i) => {
            const ans = answers[i];
            return acc + (ans === q.correct_answer ? 1 : 0);
        }, 0);

        return (
            <div className="quiz-summary" style={{ padding: '8px' }}>
                <h4>Kết quả</h4>
                <p>{`Bạn trả lời đúng ${correct} trên ${total} câu.`}</p>
                <button className="ml-1 border rounded px-2" onClick={() => {
                    setShowQuiz(true);
                    setCurrentIndex(0);
                    setSelectedAnswer(answers[0] ?? null);
                }}>Làm lại</button>
            </div>
        );
    };

    return (
        <div className={`studio-container ${collapsed ? 'collapsed' : ''}`}>
            {/* Header */}
            <div className="studio-header">
                <h3>Studio</h3>
                <button
                    className="collapse-btn"
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? "Mở rộng" : "Thu gọn"}
                >
                    {collapsed ? "→" : "←"}
                </button>
            </div>

            {!collapsed && (
                <>
                    <div className="session-info" style={{ fontSize: "0.8rem", margin: "8px 0", padding: "4px", backgroundColor: "#f0f5ff", borderRadius: "4px" }}>
                        Session ID: <strong>{sessionUUID || "default-session"}</strong>
                        {!sessionUUID && (
                            <span style={{ color: "orange", marginLeft: "4px", fontSize: "0.7rem" }}>
                                (Chờ session)
                            </span>
                        )}
                    </div>

                    <div className="studio-grid">
                        {tools.map((item, index) => (
                            <div
                                key={index}
                                className={`studio-card ${item.color} ${item.color === 'quiz' && !sessionUUID ? 'disabled' : ''}`}
                                onClick={sessionUUID || item.color !== 'quiz' ? item.onClick : null}
                                style={item.color === 'quiz' && !sessionUUID ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                            >
                                <span>{item.title}</span>
                                <button className="edit-btn">✏️</button>
                                {item.color === 'quiz' && !sessionUUID && (
                                    <div style={{ fontSize: '0.6rem', color: '#ff6b6b', marginTop: '2px' }}>
                                        Chờ session
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {showQuiz && quizQuestions.length > 0 && (
                        <div className="quiz-container" style={{ padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', marginTop: '8px', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ margin: 0 }}>Quiz</h4>
                                <div style={{ fontSize: '0.85rem', color: '#374151' }}>
                                    {`${currentIndex + 1} / ${quizQuestions.length}`}
                                </div>
                            </div>

                            <div className="quiz-question" style={{ marginTop: '8px' }}>
                                {quizQuestions[currentIndex] && (
                                    <>
                                        <p style={{ margin: '6px 0', fontSize: '0.95rem' }}><strong>{quizQuestions[currentIndex].question}</strong></p>

                                        <div className="quiz-options" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {quizQuestions[currentIndex].options.map((option, index) => (
                                                <div
                                                    key={index}
                                                    className={`quiz-option ${answers[currentIndex] === index ? 'selected' : ''}`}
                                                    onClick={() => handleAnswerSelect(index)}
                                                    style={{
                                                        padding: '8px',
                                                        borderRadius: '6px',
                                                        border: answers[currentIndex] === index ? '2px solid #2563eb' : '1px solid #e5e7eb',
                                                        background: answers[currentIndex] === index ? '#f0f9ff' : '#fff',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {option}
                                                </div>
                                            ))}
                                        </div>

                                        {(answers[currentIndex] !== null) && (
                                            <div className="quiz-explanation" style={{ marginTop: '10px', padding: '8px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e6eef8' }}>
                                                <p style={{ margin: 0 }}>
                                                    {answers[currentIndex] === quizQuestions[currentIndex].correct_answer ? (
                                                        <span className="correct-answer" style={{ color: '#16a34a' }}>Correct!</span>
                                                    ) : (
                                                        <span className="incorrect-answer" style={{ color: '#dc2626' }}>
                                                            Incorrect. The correct answer is: {quizQuestions[currentIndex].options[quizQuestions[currentIndex].correct_answer]}
                                                        </span>
                                                    )}
                                                </p>
                                                <p style={{ marginTop: '8px' }}><strong>Explanation:</strong> {quizQuestions[currentIndex].explanation}</p>
                                            </div>
                                        )}

                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginTop: '12px' }}>
                                            <div>
                                                <button className="ml-1 border rounded px-2" onClick={handlePrev} disabled={currentIndex === 0}>Prev</button>
                                            </div>
                                            <div>
                                                <button className="ml-1 border rounded px-2" onClick={handleNext} disabled={answers[currentIndex] === null}>
                                                    {currentIndex === quizQuestions.length - 1 ? 'Hoàn thành' : 'Next'}
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {!showQuiz && quizQuestions.length > 0 && answers.some(a => a !== null) && (
                        renderQuizSummary()
                    )}

                    <div className="studio-list">
                        {notes.map((n, i) => (
                            <div key={i} className="note-item">
                                <div className="note-left">
                                    <div className="note-icon">{n.icon}</div>
                                    <div className="note-text">
                                        <p className="note-title">{n.title}</p>
                                        <p className="note-info">{n.info}</p>
                                    </div>
                                </div>
                                <div className="note-actions">
                                    {n.play && <button className="icon-btn">▶️</button>}
                                    <button className="icon-btn">⋮</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button className="add-btn">➕ Thêm ghi chú</button>
                </>
            )}
        </div>
    );
};

export default StudioDashboard;
