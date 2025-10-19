import React, { useState, useEffect } from "react";
import "../assets/css/StudioDashboard.css";

const StudioDashboard = ({ onCollapsedChange, sessionUUID }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [loadingQuiz, setLoadingQuiz] = useState(false);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [userAnswers, setUserAnswers] = useState({});
    const [showingResults, setShowingResults] = useState({});

    // Thông báo lên App khi trạng thái thu gọn thay đổi
    useEffect(() => {
        if (onCollapsedChange) {
            onCollapsedChange(collapsed);
        }
    }, [collapsed, onCollapsedChange]);

    useEffect(() => {
        if (!sessionUUID) {
            setProjects([]);
            return;
        }
        const fetchProjects = async () => {
            try {
                const projectsRes = await fetch(`http://0.0.0.0:8686/session-projects/${sessionUUID}`);
                const projectsData = await projectsRes.json();
                setProjects(projectsData.projects || []);
            } catch (e) {
                setProjects([]);
            }
        };
        fetchProjects();
    }, [sessionUUID]);

    const handleQuizClick = async () => {
        if (!sessionUUID) return;
        setLoadingQuiz(true);
        try {
            const response = await fetch('http://0.0.0.0:8686/process', {
                method: 'POST',
                headers: {},
                body: (() => {
                    const form = new FormData();
                    form.append('session_id', sessionUUID);
                    form.append('project_name', 'Quiz Project');
                    return form;
                })(),
            });
            await response.json();
            // Lấy danh sách project sau khi xử lý xong
            const projectsRes = await fetch(`http://0.0.0.0:8686/session-projects/${sessionUUID}`);
            const projectsData = await projectsRes.json();
            setProjects(projectsData.projects || []);
        } catch (e) {
            // Xử lý lỗi nếu cần
        } finally {
            setLoadingQuiz(false);
        }
    };

    const handleProjectClick = async (projectId) => {
        setLoadingQuestions(true);
        setSelectedProject(projectId);
        try {
            const response = await fetch(`http://0.0.0.0:8686/project-questions/${projectId}`);
            const data = await response.json();
            setQuestions(data.questions || []);
            setCurrentQuestionIndex(0);
        } catch (error) {
            console.error("Error fetching questions:", error);
            setQuestions([]);
        } finally {
            setLoadingQuestions(false);
        }
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
        }
    };

    const handlePrevQuestion = () => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(currentQuestionIndex - 1);
        }
    };

    const closeQuestions = () => {
        setSelectedProject(null);
        setQuestions([]);
    };

    const handleOptionClick = (questionIndex, optionIndex) => {
        // Chỉ cho phép chọn khi chưa hiển thị kết quả
        if (!showingResults[questionIndex]) {
            setUserAnswers(prev => ({
                ...prev,
                [questionIndex]: optionIndex
            }));

            setShowingResults(prev => ({
                ...prev,
                [questionIndex]: true
            }));
        }
    };

    useEffect(() => {
        if (currentQuestionIndex !== null) {
            setUserAnswers({});
            setShowingResults({});
        }
    }, [currentQuestionIndex]);

    const tools = [
        { title: "Bản đồ tư duy", color: "mindmap", onClick: () => { } },
        { title: "File câu hỏi", color: "flashcard", onClick: () => { } },
        { title: "Bài kiểm tra", color: "quiz", onClick: handleQuizClick },
    ];

    const notes = [
    ];

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
                                onClick={item.color === 'quiz' ? (sessionUUID ? item.onClick : null) : item.onClick}
                                style={item.color === 'quiz' && !sessionUUID ? { opacity: 0.6, cursor: 'not-allowed' } : { cursor: 'pointer' }}
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

                    {loadingQuiz && (
                        <div style={{ margin: '16px 0', textAlign: 'center', color: '#1890ff', fontWeight: 500 }}>
                            Đang xử lý bài kiểm tra...
                        </div>
                    )}

                    <div className="studio-list">
                        {projects.length > 0 ? (
                            projects.map((p, i) => (
                                <div key={i} className="note-item" onClick={() => handleProjectClick(p.id)} style={{ cursor: 'pointer' }}>
                                    <div className="note-left">
                                        <div className="note-icon" style={{ cursor: 'pointer' }}>📁</div>
                                        <div className="note-text">
                                            <p className="note-title">{p.name}</p>
                                            <p className="note-info">ID: {p.id}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ color: '#888', textAlign: 'center', fontSize: '0.9rem' }}>Chưa có project nào</div>
                        )}
                    </div>

                    {selectedProject && (
                        <div className="questions-container" style={{
                            margin: '20px 0',
                            padding: '15px',
                            backgroundColor: '#f9f9f9',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ margin: '0 0 15px 0' }}>Bài kiểm tra</h4>
                                <button
                                    onClick={closeQuestions}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '18px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            {loadingQuestions ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    Đang tải câu hỏi...
                                </div>
                            ) : (
                                <>
                                    {questions.length > 0 ? (
                                        <div>
                                            <div style={{
                                                position: 'relative',
                                                padding: '15px',
                                                backgroundColor: 'white',
                                                borderRadius: '8px',
                                                marginBottom: '15px',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                                            }}>
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '10px',
                                                    right: '10px',
                                                    fontSize: '12px',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    backgroundColor: questions[currentQuestionIndex].difficulty === 'easy' ? '#e6f7ff' :
                                                        questions[currentQuestionIndex].difficulty === 'medium' ? '#fff7e6' : '#fff1f0',
                                                    color: questions[currentQuestionIndex].difficulty === 'easy' ? '#1890ff' :
                                                        questions[currentQuestionIndex].difficulty === 'medium' ? '#fa8c16' : '#f5222d'
                                                }}>
                                                    {questions[currentQuestionIndex].difficulty === 'easy' ? 'Dễ' :
                                                        questions[currentQuestionIndex].difficulty === 'medium' ? 'Trung bình' : 'Khó'}
                                                </div>

                                                <p style={{
                                                    fontSize: '16px',
                                                    fontWeight: '500',
                                                    marginTop: '5px'
                                                }}>
                                                    Câu {currentQuestionIndex + 1}/{questions.length}: {questions[currentQuestionIndex].question}
                                                </p>

                                                <div style={{ marginTop: '15px' }}>
                                                    {questions[currentQuestionIndex].options.map((option, idx) => (
                                                        <div key={idx} style={{
                                                            padding: '10px 15px',
                                                            margin: '8px 0',
                                                            borderRadius: '4px',
                                                            border: '1px solid #e8e8e8',
                                                            cursor: 'pointer',
                                                            backgroundColor: userAnswers[currentQuestionIndex] === idx ?
                                                                (questions[currentQuestionIndex].correct_answer === idx ? '#f6ffed' : '#fff1f0') : 'white',
                                                            borderColor: userAnswers[currentQuestionIndex] === idx ?
                                                                (questions[currentQuestionIndex].correct_answer === idx ? '#b7eb8f' : '#ffa39e') : '#e8e8e8',
                                                            transition: 'all 0.3s'
                                                        }}
                                                            onClick={() => handleOptionClick(currentQuestionIndex, idx)}>
                                                            <span style={{
                                                                display: 'inline-block',
                                                                width: '24px',
                                                                height: '24px',
                                                                lineHeight: '24px',
                                                                textAlign: 'center',
                                                                borderRadius: '50%',
                                                                marginRight: '10px',
                                                                backgroundColor: userAnswers[currentQuestionIndex] === idx ?
                                                                    (questions[currentQuestionIndex].correct_answer === idx ? '#52c41a' : '#f5222d') : '#f5f5f5',
                                                                color: userAnswers[currentQuestionIndex] === idx ? 'white' : 'rgba(0,0,0,0.65)'
                                                            }}>
                                                                {String.fromCharCode(65 + idx)}
                                                            </span>
                                                            {option}
                                                        </div>
                                                    ))}
                                                </div>

                                                {showingResults[currentQuestionIndex] && (
                                                    <div style={{
                                                        marginTop: '15px',
                                                        padding: '10px',
                                                        backgroundColor: '#f6ffed',
                                                        borderRadius: '4px',
                                                        border: '1px solid #b7eb8f'
                                                    }}>
                                                        <strong>Giải thích:</strong> {questions[currentQuestionIndex].explanation}
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
                                                <button
                                                    onClick={handlePrevQuestion}
                                                    disabled={currentQuestionIndex === 0}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #d9d9d9',
                                                        backgroundColor: currentQuestionIndex === 0 ? '#f5f5f5' : 'white',
                                                        cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer',
                                                        opacity: currentQuestionIndex === 0 ? 0.6 : 1
                                                    }}
                                                >
                                                    ← Câu trước
                                                </button>

                                                <div style={{ fontSize: '14px', lineHeight: '32px' }}>
                                                    {currentQuestionIndex + 1} / {questions.length}
                                                </div>

                                                <button
                                                    onClick={handleNextQuestion}
                                                    disabled={currentQuestionIndex === questions.length - 1}
                                                    style={{
                                                        padding: '8px 16px',
                                                        borderRadius: '4px',
                                                        border: '1px solid #d9d9d9',
                                                        backgroundColor: currentQuestionIndex === questions.length - 1 ? '#f5f5f5' : 'white',
                                                        cursor: currentQuestionIndex === questions.length - 1 ? 'not-allowed' : 'pointer',
                                                        opacity: currentQuestionIndex === questions.length - 1 ? 0.6 : 1
                                                    }}
                                                >
                                                    Câu tiếp →
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                                            Không có câu hỏi nào cho project này
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
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
