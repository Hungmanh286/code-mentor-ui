import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Circle, Clock, PlayCircle, FileText, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '@/config';

function ProjectDetailPage() {
    const navigate = useNavigate();
    const { projectId } = useParams();
    const [questions, setQuestions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [projectInfo, setProjectInfo] = useState(null);

    useEffect(() => {
        fetchProjectDetails();
    }, [projectId]);

    const fetchProjectDetails = async () => {
        try {
            setIsLoading(true);

            // Fetch questions detail for this project
            const questionsResponse = await fetch(`${API_URL}/project-questions-detail/${projectId}`);
            const questionsData = await questionsResponse.json();

            // Fetch full questions to get question text and options
            const fullQuestionsResponse = await fetch(`${API_URL}/project-questions/${projectId}`);
            const fullQuestionsData = await fullQuestionsResponse.json();

            // Fetch project scores to get project info
            const scoresResponse = await fetch(`${API_URL}/project-scores`);
            const scoresData = await scoresResponse.json();
            const project = scoresData.projects.find(p => p.project_id === projectId);

            // Merge questions data
            const mergedQuestions = (questionsData.questions || []).map((detailQ) => {
                const fullQ = (fullQuestionsData.questions || []).find(fq => fq.id === detailQ.id);
                return {
                    ...detailQ,
                    question: fullQ?.question || '',
                    options: fullQ?.options || [],
                    type: fullQ?.type || ''
                };
            });

            setQuestions(mergedQuestions);
            setProjectInfo(project);
        } catch (error) {
            console.error('Error fetching project details:', error);
            setQuestions([]);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    const answeredQuestions = questions.filter(q => q.answer !== null && q.answer !== undefined).length;
    const correctAnswers = questions.filter(q => q.answer === q.correct_answer).length;
    const progress = questions.length > 0 ? Math.round((answeredQuestions / questions.length) * 100) : 0;
    const scorePercentage = questions.length > 0 ? Math.round((correctAnswers / questions.length) * 100) : 0;

    const getDifficultyBadge = (difficulty) => {
        const colors = {
            easy: 'bg-green-100 text-green-700',
            medium: 'bg-orange-100 text-orange-700',
            hard: 'bg-red-100 text-red-700'
        };
        const labels = {
            easy: 'Dễ',
            medium: 'Trung bình',
            hard: 'Khó'
        };
        return (
            <Badge className={`${colors[difficulty]} hover:${colors[difficulty]}`}>
                {labels[difficulty]}
            </Badge>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container mx-auto px-6 py-4">
                    <Button variant="ghost" onClick={() => navigate('/progress')} className="mb-2">
                        <ArrowLeft className="mr-2" size={20} />
                        Quay lại
                    </Button>
                </div>
            </header>

            <div className="container mx-auto px-6 py-8">
                {/* Project Info Header */}
                <div className="bg-white rounded-lg p-8 shadow-sm mb-6">
                    <div className="max-w-4xl">
                        <h1 className="text-gray-900 mb-2">{projectInfo?.project_name || 'Chi tiết bài học'}</h1>
                        <p className="text-gray-600 mb-6">Session: {projectInfo?.session_id || 'N/A'}</p>

                        <div className="flex flex-wrap gap-6 mb-6">
                            <div className="flex items-center gap-2">
                                <FileText size={20} className="text-gray-500" />
                                <span className="text-sm text-gray-700">{questions.length} câu hỏi</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 size={20} className="text-gray-500" />
                                <span className="text-sm text-gray-700">{correctAnswers} câu đúng</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Award size={20} className="text-gray-500" />
                                <span className="text-sm text-gray-700">Điểm: {scorePercentage}%</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Tiến độ hoàn thành</span>
                                <span className="text-sm text-gray-900">{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-3" />
                            <p className="text-sm text-gray-600">
                                {answeredQuestions}/{questions.length} câu hỏi đã trả lời
                            </p>
                        </div>
                    </div>
                </div>

                {/* Questions List */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Danh sách câu hỏi</CardTitle>
                                <CardDescription>Chi tiết các câu hỏi trong bài kiểm tra</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {questions.map((question, index) => {
                                        const isAnswered = question.answer !== null && question.answer !== undefined;
                                        const isCorrect = question.answer === question.correct_answer;

                                        return (
                                            <div
                                                key={question.id}
                                                className="p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-start gap-3 flex-1">
                                                        {isAnswered ? (
                                                            isCorrect ? (
                                                                <CheckCircle2 className="text-green-600 mt-1 flex-shrink-0" size={20} />
                                                            ) : (
                                                                <Circle className="text-red-600 mt-1 flex-shrink-0" size={20} />
                                                            )
                                                        ) : (
                                                            <Circle className="text-gray-400 mt-1 flex-shrink-0" size={20} />
                                                        )}
                                                        <div className="flex-1">
                                                            <p className="text-sm text-gray-900 mb-2">
                                                                <strong>Câu {index + 1}:</strong> {question.question}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {getDifficultyBadge(question.difficulty)}
                                                </div>

                                                {/* Options */}
                                                <div className="ml-8 space-y-2">
                                                    {question.options.map((option, optIdx) => {
                                                        const isUserAnswer = question.answer === optIdx;
                                                        const isCorrectOption = question.correct_answer === optIdx;

                                                        let bgColor = 'bg-gray-50';
                                                        let textColor = 'text-gray-700';

                                                        if (isAnswered) {
                                                            if (isCorrectOption) {
                                                                bgColor = 'bg-green-50 border-green-200';
                                                                textColor = 'text-green-900';
                                                            } else if (isUserAnswer && !isCorrect) {
                                                                bgColor = 'bg-red-50 border-red-200';
                                                                textColor = 'text-red-900';
                                                            }
                                                        }

                                                        return (
                                                            <div
                                                                key={optIdx}
                                                                className={`p-2 rounded border ${bgColor} ${textColor} text-sm flex items-center gap-2`}
                                                            >
                                                                <span className="font-semibold">{String.fromCharCode(65 + optIdx)}.</span>
                                                                {option}
                                                                {isCorrectOption && isAnswered && (
                                                                    <CheckCircle2 className="text-green-600 ml-auto" size={16} />
                                                                )}
                                                                {isUserAnswer && !isCorrect && (
                                                                    <span className="text-red-600 ml-auto text-xs">(Đã chọn)</span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Explanation */}
                                                {isAnswered && question.explanation && (
                                                    <div className="ml-8 mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                                                        <p className="text-sm text-blue-900">
                                                            <strong>Giải thích:</strong> {question.explanation}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="lg:col-span-1">
                        <Card className="sticky top-24">
                            <CardHeader>
                                <CardTitle>Thống kê</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Tổng câu hỏi</span>
                                        <span className="text-lg font-semibold text-gray-900">{questions.length}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Đã trả lời</span>
                                        <span className="text-lg font-semibold text-blue-600">{answeredQuestions}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Câu đúng</span>
                                        <span className="text-lg font-semibold text-green-600">{correctAnswers}</span>
                                    </div>
                                    <Separator />
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600">Câu sai</span>
                                        <span className="text-lg font-semibold text-red-600">
                                            {answeredQuestions - correctAnswers}
                                        </span>
                                    </div>
                                </div>

                                <Separator />

                                {/* Score badge */}
                                <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-white text-center">
                                    <p className="text-sm opacity-90 mb-1">Điểm số</p>
                                    <p className="text-3xl font-bold">{scorePercentage}%</p>
                                    <p className="text-xs opacity-75 mt-1">
                                        {scorePercentage >= 80 ? '🎉 Xuất sắc!' :
                                            scorePercentage >= 50 ? '👍 Khá tốt!' : '💪 Cố gắng hơn!'}
                                    </p>
                                </div>

                                <Separator />

                                {/* Difficulty breakdown */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Độ khó câu hỏi</h4>
                                    <div className="space-y-2">
                                        {['easy', 'medium', 'hard'].map(difficulty => {
                                            const count = questions.filter(q => q.difficulty === difficulty).length;
                                            if (count === 0) return null;
                                            return (
                                                <div key={difficulty} className="flex justify-between items-center">
                                                    {getDifficultyBadge(difficulty)}
                                                    <span className="text-sm text-gray-600">{count} câu</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProjectDetailPage;
