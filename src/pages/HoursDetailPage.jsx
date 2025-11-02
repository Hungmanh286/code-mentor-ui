import { BookOpen, ArrowLeft, Calendar, TrendingUp, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

export default function HoursDetailPage({ onBack }) {
    const weeklyData = [
        { day: 'T2', hours: 1.5, target: 2 },
        { day: 'T3', hours: 2.3, target: 2 },
        { day: 'T4', hours: 1.2, target: 2 },
        { day: 'T5', hours: 2.8, target: 2 },
        { day: 'T6', hours: 1.8, target: 2 },
        { day: 'T7', hours: 2.1, target: 2 },
        { day: 'CN', hours: 0.8, target: 2 },
    ];

    const subjects = [
        { name: 'Toán học', hours: 4.5, color: 'bg-blue-500', percentage: 36 },
        { name: 'Tiếng Anh', hours: 3.2, color: 'bg-green-500', percentage: 26 },
        { name: 'Vật lý', hours: 2.8, color: 'bg-purple-500', percentage: 22 },
        { name: 'Khác', hours: 2.0, color: 'bg-gray-500', percentage: 16 },
    ];

    const handleExportPDF = async () => {
        toast.loading('Đang xuất báo cáo giờ học...', { id: 'hours-pdf' });

        try {
            const element = document.getElementById('hours-content');
            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: 'a4',
            });

            const imgWidth = pdf.internal.pageSize.getWidth();
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save('hours-report.pdf');

            toast.success('✅ Xuất PDF thành công!', { id: 'hours-pdf' });
        } catch (error) {
            toast.error('❌ Lỗi khi xuất PDF', { id: 'hours-pdf' });
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <Button variant="ghost" onClick={onBack} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                </Button>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1>Thống kê giờ học</h1>
                            <p className="text-gray-500">Theo dõi thời gian học tập của bạn</p>
                        </div>
                    </div>
                </div>
            </div>

            <div id="hours-content">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* This Week */}
                    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <BookOpen className="w-5 h-5" />
                                <span>Tuần này</span>
                            </div>
                            <div className="mb-1">12.5 giờ</div>
                            <p className="text-blue-100 text-sm">
                                Cao hơn 85% người dùng! 🧠
                            </p>
                        </CardContent>
                    </Card>

                    {/* This Month */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 mb-2 text-gray-600">
                                <Calendar className="w-5 h-5" />
                                <span>Tháng này</span>
                            </div>
                            <div className="mb-1">48.3 giờ</div>
                            <p className="text-gray-500 text-sm">
                                Tăng 15% so với tháng trước
                            </p>
                        </CardContent>
                    </Card>

                    {/* Average per Day */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 mb-2 text-gray-600">
                                <TrendingUp className="w-5 h-5" />
                                <span>Trung bình mỗi ngày</span>
                            </div>
                            <div className="mb-1">1.8 giờ</div>
                            <p className="text-gray-500 text-sm">
                                Trong 30 ngày qua
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Weekly Chart */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Biểu đồ học tập tuần này</CardTitle>
                        <CardDescription>
                            Mục tiêu: 2 giờ mỗi ngày
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {weeklyData.map((item, index) => (
                                <div key={index} className="flex items-center gap-4">
                                    <span className="text-gray-500 w-12">{item.day}</span>
                                    <div className="flex-1 relative h-10 bg-gray-100 rounded-lg overflow-hidden">
                                        <div
                                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-400 to-blue-600 rounded-lg"
                                            style={{ width: `${(item.hours / 3) * 100}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center px-3">
                                            <span className="text-sm">{item.hours}h</span>
                                        </div>
                                    </div>
                                    {item.hours >= item.target && (
                                        <Badge className="bg-green-500">✓ Đạt</Badge>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Tips Card */}
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                        <CardTitle className="text-blue-800">📊 Phân tích của bạn</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-blue-900">
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                <span>Bạn học tập hiệu quả nhất vào buổi sáng (7h-9h)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                <span>Thời gian tập trung trung bình: 35 phút/phiên</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-blue-600">•</span>
                                <span>Gợi ý: Nên nghỉ ngơi 5-10 phút sau mỗi 45 phút học</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
