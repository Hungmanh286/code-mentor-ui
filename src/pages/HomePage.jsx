import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function HomePage() {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
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
            console.error("Failed to fetch sessions:", err);
            setError("Failed to load sessions. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    const createNewSession = () => {
        // Generate a random UUID for the new session
        const randomSessionId = Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);

        // Navigate to the new session page with the generated ID
        navigate(`/session/${randomSessionId}`);
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
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8 flex-1">
                <div className="max-w-5xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-semibold text-gray-800">Your Sessions</h2>
                        <button
                            onClick={createNewSession}
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
                                onClick={createNewSession}
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
                                onClick={createNewSession}
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
                            {sessions.map((session, index) => (
                                <Link
                                    key={index}
                                    to={`/session/${session}`}
                                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow"
                                    onClick={(e) => {
                                        // Ensure the session ID is properly passed in the URL
                                        e.preventDefault();
                                        navigate(`/session/${session}`);
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-lg font-medium text-gray-800">Session {session.substring(0, 8)}...</h3>
                                            <p className="text-sm text-gray-500 mt-1">Continue your learning</p>
                                        </div>
                                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Active</span>
                                    </div>
                                    <div className="mt-4 flex items-center text-sm text-gray-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Last active: Recently
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="w-full bg-white border-t border-gray-200 py-4 mt-auto">
                <div className="container mx-auto px-4">
                    <p className="text-center text-gray-500 text-sm">© 2023 Learning Platform. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}

export default HomePage;