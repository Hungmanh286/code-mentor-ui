import { useState, useEffect } from 'react';
import { ArrowLeft, Trophy, TrendingUp, Award, Star, CheckCircle, Filter, Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '@/config';

function LearningProgressPage() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [learningRecords, setLearningRecords] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProjectScores = async () => {
            try {
                const response = await fetch(`${API_URL}/project-scores`);
                const data = await response.json();

                // Transform API data to match component format
                const transformedData = data.projects.map(project => {
                    const scorePercentage = project.total_questions > 0
                        ? Math.round((project.total_score / project.total_questions) * 100)
                        : 0;

                    let status = 'completed';
                    if (scorePercentage === 0) {
                        status = 'in-progress';
                    } else if (scorePercentage < 70) {
                        status = 'failed';
                    }

                    return {
                        id: project.project_id,
                        lessonName: project.project_name,
                        sessionId: project.session_id,
                        score: scorePercentage,
                        status: status,
                        date: new Date().toISOString().split('T')[0],
                        duration: `${project.total_questions} câu hỏi`,
                        totalQuestions: project.total_questions,
                        totalScore: project.total_score
                    };
                });

                setLearningRecords(transformedData);
            } catch (error) {
                console.error('Error fetching project scores:', error);
                setLearningRecords([]);
            } finally {
                setLoading(false);
            }
        };

        fetchProjectScores();
    }, []);

    const filteredRecords = learningRecords.filter(record => {
        const matchesSearch = record.lessonName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.sessionId.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || record.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const completedRecords = learningRecords.filter(r => r.status === 'completed');
    const stats = {
        totalLessons: learningRecords.length,
        completed: completedRecords.length,
        averageScore: completedRecords.length > 0
            ? Math.round(completedRecords.reduce((acc, r) => acc + r.score, 0) / completedRecords.length)
            : 0,
        passRate: completedRecords.length > 0
            ? Math.round((learningRecords.filter(r => r.score >= 70).length / completedRecords.length) * 100)
            : 0
    };

    const getScoreColor = (score) => {
        if (score >= 90) return 'text-green-600 bg-green-50';
        if (score >= 70) return 'text-blue-600 bg-blue-50';
        if (score >= 50) return 'text-orange-600 bg-orange-50';
        return 'text-red-600 bg-red-50';
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Hoàn thành</Badge>;
            case 'failed':
                return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Chưa đạt</Badge>;
            case 'in-progress':
                return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Đang học</Badge>;
            default:
                return null;
        }
    };

    const handleViewLesson = (projectId) => {
        navigate(`/project/${projectId}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                                <ArrowLeft size={20} />
                            </Button>
                            <div>
                                <h1 className="text-gray-900">Tiến trình học tập</h1>
                                <p className="text-sm text-gray-600">Theo dõi kết quả học tập của bạn</p>
                            </div>
                        </div>
                        <Button variant="outline" className="gap-2">
                            <Download size={16} />
                            Xuất báo cáo
                        </Button>
                    </div>
                </div>
            </header>

            <div className="container mx-auto px-6 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Tổng bài học</p>
                                    <p className="text-gray-900">{stats.totalLessons}</p>
                                </div>
                                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                                    <Trophy className="text-blue-600" size={24} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Đã hoàn thành</p>
                                    <p className="text-gray-900">{stats.completed}</p>
                                    <Progress value={(stats.completed / stats.totalLessons) * 100} className="h-1 mt-2" />
                                </div>
                                <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg">
                                    <CheckCircle className="text-green-600" size={24} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Điểm trung bình</p>
                                    <p className="text-gray-900">{stats.averageScore}/100</p>
                                </div>
                                <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg">
                                    <Star className="text-purple-600" size={24} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-orange-500">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Tỷ lệ đạt</p>
                                    <p className="text-gray-900">{stats.passRate}%</p>
                                </div>
                                <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-lg">
                                    <TrendingUp className="text-orange-600" size={24} />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Lịch sử học tập</CardTitle>
                        <CardDescription>Xem chi tiết kết quả các bài học đã hoàn thành</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-4 mb-6">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                <Input
                                    placeholder="Tìm kiếm bài học hoặc session..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="w-full md:w-[200px]">
                                    <Filter size={16} className="mr-2" />
                                    <SelectValue placeholder="Lọc theo trạng thái" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    <SelectItem value="completed">Hoàn thành</SelectItem>
                                    <SelectItem value="in-progress">Đang học</SelectItem>
                                    <SelectItem value="failed">Chưa đạt</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Table */}
                        <div className="rounded-lg border border-gray-200 overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead className="w-[40%]">Tên bài học</TableHead>
                                        <TableHead className="w-[20%]">Session ID</TableHead>
                                        <TableHead className="w-[15%] text-center">Điểm số</TableHead>
                                        <TableHead className="w-[15%]">Trạng thái</TableHead>
                                        <TableHead className="w-[10%] text-right">Chi tiết</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                                Đang tải dữ liệu...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredRecords.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                                Không tìm thấy kết quả phù hợp
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredRecords.map((record) => (
                                            <TableRow key={record.id} className="hover:bg-gray-50 transition-colors">
                                                <TableCell>
                                                    <div>
                                                        <p className="text-sm text-gray-900">{record.lessonName}</p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            {record.duration} • Tổng điểm: {record.totalScore}/{record.totalQuestions}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-mono text-xs">
                                                        {record.sessionId}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {record.status === 'in-progress' ? (
                                                        <span className="text-sm text-gray-400">-</span>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg ${getScoreColor(record.score)}`}>
                                                                <span className="text-sm">{record.score}</span>
                                                            </div>
                                                            {record.score >= 90 && <Award className="text-yellow-500" size={18} />}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(record.status)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleViewLesson(record.id)}
                                                    >
                                                        Xem
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Achievement Section */}
                <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                    <CardContent className="py-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-white mb-2">Thành tích của bạn</h3>
                                <p className="text-blue-100 mb-4">
                                    Bạn đã hoàn thành {stats.completed} bài học với điểm trung bình {stats.averageScore}
                                </p>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-2">
                                        <Trophy className="text-yellow-300" size={20} />
                                        <span className="text-sm text-white">
                                            {learningRecords.filter(r => r.score >= 90).length} bài đạt xuất sắc
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Star className="text-yellow-300" size={20} />
                                        <span className="text-sm text-white">
                                            Tỷ lệ đạt {stats.passRate}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="hidden md:flex items-center justify-center w-24 h-24 bg-white/20 rounded-full">
                                <Award className="text-yellow-300" size={48} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default LearningProgressPage;
