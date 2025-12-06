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
    const [quizScore, setQuizScore] = useState(null);
    const [showScoreModal, setShowScoreModal] = useState(false);
    const [mindmapImage, setMindmapImage] = useState(null);
    const [showMindmap, setShowMindmap] = useState(false);
    const [loadingMindmap, setLoadingMindmap] = useState(false);
    const [mindmapList, setMindmapList] = useState([]);
    const [showMindmapList, setShowMindmapList] = useState(false);
    const [selectedMindmapId, setSelectedMindmapId] = useState(null);
    const [showProjectList, setShowProjectList] = useState(false);

    useEffect(() => {
        if (onCollapsedChange) {
            onCollapsedChange(collapsed);
        }
    }, [collapsed, onCollapsedChange]);

    // Không tự động fetch projects khi vào session nữa
    // Chỉ fetch khi user click vào "Bài kiểm tra"

    useEffect(() => {
        if (!sessionUUID) return;

        console.log(`[SSE] Connecting to SSE for session: ${sessionUUID}`);
        const sse = new EventSource(`http://0.0.0.0:8686/sse/notify?session_id=${sessionUUID}`);

        sse.onopen = function () {
            console.log(`[SSE] Connected successfully for session: ${sessionUUID}`);
        };

        sse.onmessage = function (event) {
            console.log(`[SSE] Raw event received:`, {
                data: event.data,
                type: typeof event.data,
                session: sessionUUID
            });

            // Parse event data nếu là JSON
            let eventData;
            try {
                eventData = JSON.parse(event.data);
            } catch (e) {
                eventData = { type: event.data };
            }

            // Xử lý event "mindmap_done"
            if (eventData.type === "mindmap_done") {
                console.log(`[SSE] 🗺️ 'mindmap_done' event received!`, eventData);

                // Lấy mindmap_id từ event hoặc từ danh sách mindmap
                // Đầu tiên gọi API list để lấy mindmap mới nhất
                fetch(`http://0.0.0.0:8686/mindmap/list/${sessionUUID}`)
                    .then(res => res.json())
                    .then(async (mindmapList) => {
                        console.log("[SSE] Mindmap list received:", mindmapList);
                        if (mindmapList.length > 0) {
                            // Lấy mindmap mới nhất (cuối cùng trong list)
                            const latestMindmap = mindmapList[mindmapList.length - 1];
                            const mindmapId = latestMindmap.id;
                            console.log(`[SSE] Auto-loading latest mindmap: ${mindmapId}`);

                            // Gọi API lấy mindmap với ID
                            const response = await fetch(`http://0.0.0.0:8686/mindmap/mindmap/${mindmapId}?session_id=${sessionUUID}`);
                            const data = await response.json();

                            if (data.error) {
                                console.error("[SSE] Error loading mindmap:", data.error);
                            } else {
                                console.log("[SSE] Mindmap loaded successfully!");
                                setMindmapImage(data.image_base64);
                                setShowMindmap(true);
                            }
                        } else {
                            console.warn("[SSE] No mindmaps found in list");
                        }
                    })
                    .catch(err => {
                        console.error("[SSE] Error fetching mindmap:", err);
                    });
            }
            // Xử lý event "done" (sinh câu hỏi xong)
            else if (event.data === "done" || eventData.type === "done") {
                console.log(`[SSE] ✨ 'done' event matched! Fetching projects for session: ${sessionUUID}`);
                fetch(`http://0.0.0.0:8686/session-projects/${sessionUUID}`)
                    .then(res => {
                        console.log(`[SSE]  Fetch response status:`, res.status);
                        return res.json();
                    })
                    .then(async data => {
                        console.log(`[SSE] 📦 Projects data received:`, data);
                        const newProjects = data.projects || [];
                        setProjects(newProjects);
                        console.log(`[SSE]  Projects updated, count: ${newProjects.length}`);

                        // Tự động chọn project mới nhất
                        if (newProjects.length > 0) {
                            const latestProject = newProjects[newProjects.length - 1];
                            const projectId = latestProject.id;
                            console.log(`[SSE]  Auto-selecting latest project: ${projectId}`);

                            setLoadingQuestions(true);
                            setSelectedProject(projectId);
                            try {
                                const response = await fetch(`http://0.0.0.0:8686/project-questions/${projectId}`);
                                const qData = await response.json();
                                console.log(`[SSE] Questions loaded for project ${projectId}:`, qData.questions?.length || 0);
                                setQuestions(qData.questions || []);
                                setCurrentQuestionIndex(0);
                            } catch (error) {
                                console.error("[SSE] Error fetching questions:", error);
                                setQuestions([]);
                            } finally {
                                setLoadingQuestions(false);
                            }
                        } else {
                            console.log(`[SSE]  No projects found to auto-select`);
                        }
                    })
                    .catch(err => {
                        console.error(`[SSE]  Error fetching projects:`, err);
                        setProjects([]);
                    });
            } else {
                console.log(`[SSE]  Event data is NOT recognized, ignoring. Data:`, eventData);
            }
        };

        sse.onerror = function (error) {
            console.error(`[SSE]  Connection error for session ${sessionUUID}:`, error);
            sse.close();
        };

        return () => {
            console.log(`[SSE] 🔌 Closing SSE connection for session: ${sessionUUID}`);
            sse.close();
        };
    }, [sessionUUID]);

    const handleQuizClick = async () => {
        if (!sessionUUID) return;

        // Fetch danh sách project và hiển thị modal
        setLoadingQuiz(true);
        try {
            const projectsRes = await fetch(`http://0.0.0.0:8686/session-projects/${sessionUUID}`);
            const projectsData = await projectsRes.json();
            const projectList = projectsData.projects || [];

            if (projectList.length === 0) {
                alert("Chưa có project nào cho session này");
            } else {
                setProjects(projectList);
                setShowProjectList(true);
            }
        } catch (e) {
            console.error("Error fetching projects:", e);
            alert("Không thể tải danh sách project");
            setProjects([]);
        } finally {
            setLoadingQuiz(false);
        }
    };

    const handleProjectClick = async (projectId) => {
        setLoadingQuestions(true);
        setSelectedProject(projectId);
        setShowProjectList(false); // Đóng modal danh sách
        try {
            const response = await fetch(`http://0.0.0.0:8686/project-questions/${projectId}`);
            const data = await response.json();
            setQuestions(data.questions || []);
            setCurrentQuestionIndex(0);
        } catch (error) {
            console.error("Error fetching questions:", error);
            alert("Không thể tải câu hỏi");
            setQuestions([]);
        } finally {
            setLoadingQuestions(false);
        }
    };

    const closeProjectList = () => {
        setShowProjectList(false);
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
        setUserAnswers({});
        setShowingResults({});
        setQuizScore(null);
        setShowScoreModal(false);
    };

    const handleOptionClick = async (questionIndex, optionIndex) => {
        // Chỉ cho phép chọn khi chưa hiển thị kết quả
        if (!showingResults[questionIndex]) {
            const newUserAnswers = {
                ...userAnswers,
                [questionIndex]: optionIndex
            };

            setUserAnswers(newUserAnswers);

            setShowingResults(prev => ({
                ...prev,
                [questionIndex]: true
            }));

            // Gửi đáp án về server
            const questionId = questions[questionIndex].id;
            try {
                const formData = new FormData();
                formData.append('answer', optionIndex);

                await fetch(`http://0.0.0.0:8686/add_answer/${questionId}`, {
                    method: 'POST',
                    body: formData
                });
            } catch (error) {
                console.error("Error submitting answer:", error);
            }

            // Kiểm tra xem đã trả lời hết tất cả câu hỏi chưa
            const totalAnswered = Object.keys(newUserAnswers).length;
            if (totalAnswered === questions.length) {
                // Tự động chấm điểm khi hoàn thành tất cả câu hỏi
                setTimeout(() => {
                    handleFinishQuiz();
                }, 500); // Delay 500ms để người dùng thấy đáp án được chọn
            }
        }
    };

    const calculateScore = () => {
        let correctCount = 0;
        let totalAnswered = 0;

        questions.forEach((question, index) => {
            if (userAnswers[index] !== undefined) {
                totalAnswered++;
                if (userAnswers[index] === question.correct_answer) {
                    correctCount++;
                }
            }
        });

        return {
            correct: correctCount,
            total: questions.length,
            answered: totalAnswered,
            percentage: questions.length > 0 ? ((correctCount / questions.length) * 100).toFixed(1) : 0
        };
    };

    const handleFinishQuiz = () => {
        const score = calculateScore();
        setQuizScore(score);
        setShowScoreModal(true);
    };

    const handleMindmapClick = async () => {
        if (!sessionUUID) return;

        setLoadingMindmap(true);
        try {
            const response = await fetch(`http://0.0.0.0:8686/mindmap/list/${sessionUUID}`);
            const data = await response.json();

            if (data.error) {
                alert(data.error);
            } else if (data.length === 0) {
                alert("Chưa có mind map nào cho session này");
            } else {
                setMindmapList(data);
                setShowMindmapList(true);
            }
        } catch (error) {
            console.error("Error fetching mindmap list:", error);
            alert("Không thể tải danh sách mind map");
        } finally {
            setLoadingMindmap(false);
        }
    };

    const handleSelectMindmap = async (mindmapId) => {
        if (!sessionUUID) return;

        setLoadingMindmap(true);
        setSelectedMindmapId(mindmapId);
        setShowMindmapList(false); // Đóng modal danh sách
        try {
            const response = await fetch(`http://0.0.0.0:8686/mindmap/mindmap/${mindmapId}?session_id=${sessionUUID}`);
            const data = await response.json();

            if (data.error) {
                alert(data.error);
                setMindmapImage(null);
            } else {
                setMindmapImage(data.image_base64);
            }
        } catch (error) {
            console.error("Error fetching mindmap:", error);
            alert("Không thể tải mind map");
            setMindmapImage(null);
        } finally {
            setLoadingMindmap(false);
        }
    };

    const closeMindmap = () => {
        setMindmapImage(null);
        setSelectedMindmapId(null);
    };

    const closeMindmapList = () => {
        setShowMindmapList(false);
        setMindmapList([]);
    };

    const tools = [
        { title: "Bản đồ tư duy", color: "mindmap", onClick: handleMindmapClick },
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
                                className={`studio-card ${item.color} ${!sessionUUID ? 'disabled' : ''}`}
                                onClick={sessionUUID ? item.onClick : null}
                                style={!sessionUUID ? { opacity: 0.6, cursor: 'not-allowed' } : { cursor: 'pointer' }}
                            >
                                <span>{item.title}</span>
                                <button className="edit-btn">✏️</button>
                                {!sessionUUID && (
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

                    {loadingMindmap && (
                        <div style={{ margin: '16px 0', textAlign: 'center', color: '#52c41a', fontWeight: 500 }}>
                            Đang tải mind map...
                        </div>
                    )}

                    {showProjectList && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1000,
                            padding: '20px'
                        }}>
                            <div style={{
                                backgroundColor: 'white',
                                padding: '20px',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                maxWidth: '600px',
                                width: '100%',
                                maxHeight: '80vh',
                                overflow: 'auto'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '20px'
                                }}>
                                    <h3 style={{ margin: 0, color: '#1890ff' }}>Danh sách Project</h3>
                                    <button
                                        onClick={closeProjectList}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            fontSize: '24px',
                                            cursor: 'pointer',
                                            color: '#999'
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {projects.map((p, index) => (
                                        <div
                                            key={p.id}
                                            onClick={() => handleProjectClick(p.id)}
                                            style={{
                                                padding: '15px',
                                                border: '1px solid #e8e8e8',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s',
                                                backgroundColor: selectedProject === p.id ? '#e6f7ff' : 'white',
                                                borderColor: selectedProject === p.id ? '#1890ff' : '#e8e8e8'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (selectedProject !== p.id) {
                                                    e.currentTarget.style.borderColor = '#1890ff';
                                                    e.currentTarget.style.backgroundColor = '#f0f5ff';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (selectedProject !== p.id) {
                                                    e.currentTarget.style.borderColor = '#e8e8e8';
                                                    e.currentTarget.style.backgroundColor = 'white';
                                                }
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '24px' }}>📁</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                                                        {p.name || `Project ${index + 1}`}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#999' }}>
                                                        ID: {p.id}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

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

                    {showMindmapList && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1000,
                            padding: '20px'
                        }}>
                            <div style={{
                                backgroundColor: 'white',
                                padding: '20px',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                maxWidth: '600px',
                                width: '100%',
                                maxHeight: '80vh',
                                overflow: 'auto'
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '20px'
                                }}>
                                    <h3 style={{ margin: 0, color: '#1890ff' }}>Danh sách Mind Map</h3>
                                    <button
                                        onClick={closeMindmapList}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            fontSize: '24px',
                                            cursor: 'pointer',
                                            color: '#999'
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {mindmapList.map((mm, index) => (
                                        <div
                                            key={mm.id}
                                            onClick={() => handleSelectMindmap(mm.id)}
                                            style={{
                                                padding: '15px',
                                                border: '1px solid #e8e8e8',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s',
                                                backgroundColor: selectedMindmapId === mm.id ? '#e6f7ff' : 'white',
                                                borderColor: selectedMindmapId === mm.id ? '#1890ff' : '#e8e8e8'
                                            }}
                                            onMouseEnter={(e) => {
                                                if (selectedMindmapId !== mm.id) {
                                                    e.currentTarget.style.borderColor = '#1890ff';
                                                    e.currentTarget.style.backgroundColor = '#f0f5ff';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (selectedMindmapId !== mm.id) {
                                                    e.currentTarget.style.borderColor = '#e8e8e8';
                                                    e.currentTarget.style.backgroundColor = 'white';
                                                }
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '24px' }}>🗺️</span>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                                                        {mm.name || `Mind Map ${index + 1}`}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#999' }}>
                                                        {new Date(mm.created_at).toLocaleString('vi-VN')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedMindmapId && mindmapImage && (
                        <div className="mindmap-container" style={{
                            margin: '20px 0',
                            padding: '15px',
                            backgroundColor: '#f9f9f9',
                            borderRadius: '8px',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h4 style={{ margin: 0 }}>Bản đồ tư duy</h4>
                                <button
                                    onClick={closeMindmap}
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

                            {loadingMindmap ? (
                                <div style={{ textAlign: 'center', padding: '20px' }}>
                                    Đang tải mind map...
                                </div>
                            ) : (
                                <div style={{
                                    backgroundColor: 'white',
                                    padding: '15px',
                                    borderRadius: '8px',
                                    overflow: 'auto',
                                    maxHeight: '70vh'
                                }}>
                                    <img
                                        src={`data:image/png;base64,${mindmapImage}`}
                                        alt="Mind Map"
                                        style={{
                                            maxWidth: '100%',
                                            height: 'auto',
                                            display: 'block',
                                            margin: '0 auto'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {showScoreModal && quizScore && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1000
                        }}>
                            <div style={{
                                backgroundColor: 'white',
                                padding: '30px',
                                borderRadius: '12px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                minWidth: '300px',
                                textAlign: 'center'
                            }}>
                                <h3 style={{ marginTop: 0, color: '#1890ff' }}>Kết quả bài kiểm tra</h3>

                                <div style={{
                                    fontSize: '48px',
                                    fontWeight: 'bold',
                                    color: quizScore.percentage >= 80 ? '#52c41a' :
                                        quizScore.percentage >= 50 ? '#fa8c16' : '#f5222d',
                                    margin: '20px 0'
                                }}>
                                    {quizScore.percentage}%
                                </div>

                                <div style={{ fontSize: '16px', color: '#595959', marginBottom: '20px' }}>
                                    <div style={{ marginBottom: '8px' }}>
                                        Đúng: <strong style={{ color: '#52c41a' }}>{quizScore.correct}</strong> / {quizScore.total}
                                    </div>
                                    <div style={{ marginBottom: '8px' }}>
                                        Sai: <strong style={{ color: '#f5222d' }}>{quizScore.total - quizScore.correct}</strong> / {quizScore.total}
                                    </div>
                                    {quizScore.answered < quizScore.total && (
                                        <div style={{ color: '#fa8c16', fontSize: '14px', marginTop: '10px' }}>
                                            ⚠️ Bạn chưa trả lời {quizScore.total - quizScore.answered} câu
                                        </div>
                                    )}
                                </div>

                                <div style={{
                                    padding: '12px',
                                    backgroundColor: '#f0f5ff',
                                    borderRadius: '6px',
                                    marginBottom: '20px',
                                    fontSize: '14px'
                                }}>
                                    {quizScore.percentage >= 80 ? '🎉 Xuất sắc!' :
                                        quizScore.percentage >= 50 ? '👍 Khá tốt!' : '💪 Cố gắng hơn nhé!'}
                                </div>

                                <button
                                    onClick={() => setShowScoreModal(false)}
                                    style={{
                                        padding: '10px 24px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        backgroundColor: '#1890ff',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: '16px',
                                        fontWeight: '500'
                                    }}
                                >
                                    Đóng
                                </button>
                            </div>
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
                </>
            )}
        </div>
    );
};

export default StudioDashboard;
