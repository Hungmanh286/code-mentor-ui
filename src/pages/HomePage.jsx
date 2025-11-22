import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, Calendar, Target, Trophy, Star } from 'lucide-react';

function HomePage() {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showNameDialog, setShowNameDialog] = useState(false);
    const [sessionName, setSessionName] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('http://0.0.0.0:8686/sessions');

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            setSessions(data.sessions || []);
        } catch (err) {

        } finally {
            setIsLoading(false);
        }
    };

    const openCreateSessionDialog = () => {
        setShowNameDialog(true);
        setSessionName('');
    };

    const createNewSession = async () => {
        if (!sessionName.trim()) {
            alert('Vui lòng nhập tên session!');
            return;
        }

        try {
            setIsLoading(true);
            setShowNameDialog(false);

            // Generate a random UUID for the new session
            const randomSessionId = Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15);

            // Create FormData for the request
            const formData = new FormData();
            formData.append('session_id', randomSessionId);
            formData.append('session_name', sessionName.trim());

            // Call the create-session endpoint
            const response = await fetch('http://0.0.0.0:8686/create-session', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log("Session created:", data);

            // Navigate to the new session page with the generated ID
            navigate(`/session/${randomSessionId}`);
        } catch (err) {
            console.error("Failed to create session:", err);
            setError("Failed to create new session. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const deleteSession = async (sessionId, sessionName, e) => {
        e.preventDefault(); // Ngăn navigation khi click delete
        e.stopPropagation();

        const displayName = sessionName || sessionId.substring(0, 8) + '...';
        if (!confirm(`Bạn có chắc muốn xóa session "${displayName}"?`)) {
            return;
        }

        try {
            setIsLoading(true);
            const response = await fetch(`http://0.0.0.0:8686/sessions/${sessionId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Session deleted:", data);

            // Refresh sessions list
            await fetchSessions();

        } catch (err) {
            console.error("Failed to delete session:", err);
            setError("Failed to delete session. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50">
            {/* Header */}
            <header className="w-full bg-white shadow-sm py-4">
                <div className="container mx-auto px-4 flex items-center justify-between">
                    <div className="flex items-center">
                        <img src="/logo-code.png" className="h-8" alt="logo" />
                        <h1 className="ml-3 text-xl font-bold text-gray-800">Learning Platform</h1>
                    </div>
                    <button
                        onClick={() => navigate('/progress')}
                        className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                        <Trophy size={18} />
                        Tiến trình học tập
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8 flex-1">
                <div className="max-w-5xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-semibold text-gray-800">Your Sessions</h2>
                        <button
                            onClick={openCreateSessionDialog}
                            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                            disabled={isLoading}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            Create New Session
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <p className="text-gray-600 mb-4">You don't have any sessions yet.</p>
                            <button
                                onClick={openCreateSessionDialog}
                                className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Start Your First Session
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* New Session Card */}
                            <div
                                className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 shadow-sm p-5 cursor-pointer hover:shadow-md transition-shadow flex flex-col items-center justify-center h-48"
                                onClick={openCreateSessionDialog}
                            >
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-800">Create New Session</h3>
                                <p className="text-sm text-gray-600 text-center mt-2">Start a new learning session</p>
                            </div>

                            {/* Existing Session Cards */}
                            {sessions.map((session, index) => {
                                // Support both string (session_id) and object {session_id, session_name}
                                const sessionId = typeof session === 'string' ? session : session.session_id;
                                const sessionName = typeof session === 'object' ? session.session_name : null;
                                const displayName = sessionName || `Session ${sessionId.substring(0, 8)}...`;
                                
                                return (
                                    <Link
                                        key={index}
                                        to={`/session/${sessionId}`}
                                        className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
                                        onClick={(e) => {
                                            // Ensure the session ID is properly passed in the URL
                                            e.preventDefault();
                                            navigate(`/session/${sessionId}`);
                                        }}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-lg font-medium text-gray-800 truncate">{displayName}</h3>
                                                <p className="text-sm text-gray-500 mt-1">Tiếp tục học tập</p>
                                            </div>
                                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full whitespace-nowrap ml-2">Active</span>
                                        </div>
                                        <div className="mt-4 flex items-center text-sm text-gray-600">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Hoạt động gần đây
                                        </div>
                                        <button
                                            onClick={(e) => deleteSession(sessionId, sessionName, e)}
                                            className="mt-2 px-2 py-1 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                                        >
                                            Xóa
                                        </button>
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    {/* Learning Insights Section */}
                    <div className="mt-12">
                        <div className="mb-6">
                            <h2 className="text-gray-900 mb-2">Thông tin học tập</h2>
                            <p className="text-gray-600">Theo dõi hoạt động và thành tích của bạn</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Learning Streak */}
                            <Card
                                className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => navigate('/streaks')}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-400/20 to-red-400/20 rounded-full -mr-16 -mt-16" />
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
                                            <Flame className="text-white" size={24} />
                                        </div>
                                        <Badge variant="secondary" className="gap-1">
                                            <TrendingUp size={12} />
                                            +2 ngày
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-gray-900">7</span>
                                            <span className="text-sm text-gray-600">ngày liên tiếp</span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Học liên tục để duy trì chuỗi streak! 🔥
                                        </p>
                                        <div className="flex gap-1 pt-2">
                                            {[...Array(7)].map((_, i) => (
                                                <div
                                                    key={i}
                                                    className={`h-1.5 flex-1 rounded-full ${i < 7 ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-gray-200'
                                                        }`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* This Week Activity */}
                            <Card
                                className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => navigate('/hours-detail')}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-indigo-400/20 rounded-full -mr-16 -mt-16" />
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl shadow-lg">
                                            <Calendar className="text-white" size={24} />
                                        </div>
                                        <Badge variant="secondary" className="gap-1">
                                            <Target size={12} />
                                            Tuần này
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-gray-900">12.5</span>
                                            <span className="text-sm text-gray-600">giờ học</span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Bạn đã học nhiều hơn 85% người dùng khác! 📚
                                        </p>
                                        <div className="grid grid-cols-7 gap-1 pt-2">
                                            {[3, 2, 4, 1, 3, 2, 0].map((hours, i) => (
                                                <div key={i} className="flex flex-col items-center gap-1">
                                                    <div className="relative w-full">
                                                        <div className="h-8 bg-gray-100 rounded-t" />
                                                        <div
                                                            className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-indigo-500 rounded-t transition-all"
                                                            style={{ height: `${(hours / 4) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[8px] text-gray-400">
                                                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i]}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Achievements */}
                            <Card
                                className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => navigate('/achievements')}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-amber-400/20 rounded-full -mr-16 -mt-16" />
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-yellow-500 to-amber-500 rounded-xl shadow-lg">
                                            <Trophy className="text-white" size={24} />
                                        </div>
                                        <Badge variant="secondary" className="gap-1">
                                            <Star size={12} />
                                            Mới nhất
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-gray-900">15</span>
                                            <span className="text-sm text-gray-600">thành tích</span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Bạn vừa mở khóa "Người học siêng năng"! 🏆
                                        </p>
                                        <div className="flex gap-2 pt-1">
                                            <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 rounded-lg border-2 border-yellow-300">
                                                <Trophy className="text-yellow-600" size={18} />
                                            </div>
                                            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg border-2 border-blue-300">
                                                <Target className="text-blue-600" size={18} />
                                            </div>
                                            <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg border-2 border-purple-300">
                                                <Star className="text-purple-600" size={18} />
                                            </div>
                                            <div className="flex items-center justify-center w-10 h-10 bg-gray-100 rounded-lg border-2 border-gray-200">
                                                <span className="text-xs text-gray-400">+12</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </main>

            {/* Create Session Dialog */}
            {showNameDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-96 max-w-md shadow-xl">
                        <h3 className="text-xl font-semibold text-gray-800 mb-4">Tạo Session Mới</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tên Session
                            </label>
                            <input
                                type="text"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        createNewSession();
                                    }
                                }}
                                placeholder="Nhập tên session..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowNameDialog(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={createNewSession}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                disabled={!sessionName.trim()}
                            >
                                Tạo Session
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <footer className="w-full bg-white border-t border-gray-200 py-4 mt-auto">
                <div className="container mx-auto px-4">
                    <p className="text-center text-gray-500 text-sm">© 2025 Learning Platform. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}

export default HomePage;