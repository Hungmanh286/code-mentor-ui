import { useState } from 'react';
import { Flame, ArrowLeft, TrendingUp, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useNavigate } from 'react-router-dom';

export default function StreakDetailPage() {
    const navigate = useNavigate();
    const weekData = [
        { day: 'T2', date: '28/10', active: true, minutes: 45 },
        { day: 'T3', date: '29/10', active: true, minutes: 60 },
        { day: 'T4', date: '30/10', active: true, minutes: 30 },
        { day: 'T5', date: '31/10', active: true, minutes: 75 },
        { day: 'T6', date: '01/11', active: true, minutes: 90 },
        { day: 'T7', date: '02/11', active: true, minutes: 50 },
        { day: 'CN', date: '03/11', active: true, minutes: 40 },
    ];

    const monthlyStreak = [
        { week: 1, days: 7 },
        { week: 2, days: 6 },
        { week: 3, days: 5 },
        { week: 4, days: 7 },
    ];


    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                </Button>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center">
                            <Flame className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1>Chuỗi ngày học liên tiếp</h1>
                            <p className="text-gray-500">Duy trì thói quen học tập mỗi ngày</p>
                        </div>
                    </div>
                </div>
            </div>

            <div id="streak-content">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* Current Streak */}
                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Flame className="w-5 h-5" />
                                <span>Chuỗi hiện tại</span>
                            </div>
                            <div className="mb-1">7 ngày</div>
                            <p className="text-orange-100 text-sm">
                                Tốt lắm! Tiếp tục phát huy nhé! 🔥
                            </p>
                        </CardContent>
                    </Card>

                    {/* Longest Streak */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 mb-2 text-gray-600">
                                <TrendingUp className="w-5 h-5" />
                                <span>Kỷ lục dài nhất</span>
                            </div>
                            <div className="mb-1">21 ngày</div>
                            <p className="text-gray-500 text-sm">
                                Đạt được vào tháng 9/2024
                            </p>
                        </CardContent>
                    </Card>

                    {/* Total Days */}
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center gap-2 mb-2 text-gray-600">
                                <Calendar className="w-5 h-5" />
                                <span>Tổng số ngày học</span>
                            </div>
                            <div className="mb-1">143 ngày</div>
                            <p className="text-gray-500 text-sm">
                                Trong 6 tháng qua
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="week" className="mb-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="week">Tuần này</TabsTrigger>
                        <TabsTrigger value="month">Tháng này</TabsTrigger>
                    </TabsList>

                    <TabsContent value="week">
                        <Card>
                            <CardHeader>
                                <CardTitle>Hoạt động 7 ngày qua</CardTitle>
                                <CardDescription>
                                    Bạn đã học liên tục 7 ngày! Tuyệt vời! 🎉
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-7 gap-4">
                                    {weekData.map((item, index) => (
                                        <div key={index} className="flex flex-col items-center">
                                            <div
                                                className={`w-full aspect-square rounded-xl flex items-center justify-center mb-2 ${item.active
                                                    ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                                                    : 'bg-gray-100 text-gray-400'
                                                    }`}
                                            >
                                                {item.active && <Flame className="w-6 h-6" />}
                                            </div>
                                            <span className="text-sm text-gray-600">{item.day}</span>
                                            <span className="text-xs text-gray-400">{item.date}</span>
                                            {item.active && (
                                                <span className="text-xs text-orange-600 mt-1">
                                                    {item.minutes}p
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="month">
                        <Card>
                            <CardHeader>
                                <CardTitle>Hoạt động tháng này</CardTitle>
                                <CardDescription>
                                    Bạn đã học 25/30 ngày trong tháng
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {monthlyStreak.map((item, index) => (
                                        <div key={index} className="flex items-center gap-4">
                                            <span className="text-gray-500 w-20">Tuần {item.week}</span>
                                            <div className="flex-1 flex gap-2">
                                                {Array.from({ length: 7 }).map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={`flex-1 h-10 rounded ${i < item.days
                                                            ? 'bg-orange-500'
                                                            : 'bg-gray-200'
                                                            }`}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-gray-600 w-16">{item.days}/7 ngày</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Tips Card */}
                <Card className="bg-orange-50 border-orange-200">
                    <CardHeader>
                        <CardTitle className="text-orange-800">💡 Mẹo duy trì chuỗi học</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-orange-900">
                            <li className="flex items-start gap-2">
                                <span className="text-orange-600">•</span>
                                <span>Đặt mục tiêu học ít nhất 15 phút mỗi ngày</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-orange-600">•</span>
                                <span>Chọn một thời gian cố định để học hàng ngày</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-orange-600">•</span>
                                <span>Bật thông báo nhắc nhở để không bỏ lỡ bất kỳ ngày nào</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
