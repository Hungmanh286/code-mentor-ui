import { Trophy, Star, Award, TrendingUp, Flame, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export default function AchievementsDetailPage({ onBack }) {
  const achievements = [
    {
      id: 1,
      name: 'Người học siêng năng',
      description: 'Học 7 ngày liên tiếp',
      icon: Trophy,
      color: 'from-yellow-400 to-yellow-600',
      unlocked: true,
      unlockedDate: '02/11/2024',
    },
    {
      id: 2,
      name: 'Bậc thầy thời gian',
      description: 'Học 50 giờ trong tháng',
      icon: Star,
      color: 'from-blue-400 to-blue-600',
      unlocked: true,
      unlockedDate: '28/10/2024',
    },
    {
      id: 3,
      name: 'Chiến binh cuối tuần',
      description: 'Học vào tất cả các ngày cuối tuần trong tháng',
      icon: Award,
      color: 'from-purple-400 to-purple-600',
      unlocked: true,
      unlockedDate: '15/10/2024',
    },
    {
      id: 4,
      name: 'Người mở đường',
      description: 'Hoàn thành 5 khóa học',
      icon: TrendingUp,
      color: 'from-green-400 to-green-600',
      unlocked: true,
      unlockedDate: '10/10/2024',
    },
    {
      id: 5,
      name: 'Kỷ lục gia',
      description: 'Học 21 ngày liên tiếp',
      icon: Flame,
      color: 'from-orange-400 to-orange-600',
      unlocked: false,
      progress: 7,
      total: 21,
    },
    {
      id: 6,
      name: 'Chuyên gia',
      description: 'Đạt 90% trở lên trong 10 bài kiểm tra',
      icon: Star,
      color: 'from-pink-400 to-pink-600',
      unlocked: false,
      progress: 6,
      total: 10,
    },
    {
      id: 7,
      name: 'Người hướng dẫn',
      description: 'Giúp đỡ 5 người học khác',
      icon: Award,
      color: 'from-indigo-400 to-indigo-600',
      unlocked: false,
      progress: 2,
      total: 5,
    },
    {
      id: 8,
      name: 'Siêu sao 100 giờ',
      description: 'Học tập tổng cộng 100 giờ',
      icon: Trophy,
      color: 'from-red-400 to-red-600',
      unlocked: false,
      progress: 73,
      total: 100,
    },
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1>Thành tích của bạn</h1>
            <p className="text-gray-500">Khám phá và mở khóa các thành tích</p>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="mb-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-yellow-900">Tiến trình tổng thể</h3>
              <p className="text-yellow-700">
                Bạn đã mở khóa {unlockedCount}/{totalCount} thành tích
              </p>
            </div>
            <div className="text-right">
              <div className="text-yellow-900">
                {Math.round((unlockedCount / totalCount) * 100)}%
              </div>
              <p className="text-sm text-yellow-700">Hoàn thành</p>
            </div>
          </div>
          <Progress
            value={(unlockedCount / totalCount) * 100}
            className="h-3"
          />
        </CardContent>
      </Card>

      {/* Achievements Grid */}
      <Tabs defaultValue="all" className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="all">Tất cả</TabsTrigger>
          <TabsTrigger value="unlocked">Đã mở khóa</TabsTrigger>
          <TabsTrigger value="locked">Chưa mở khóa</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="unlocked" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {achievements
              .filter((a) => a.unlocked)
              .map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
          </div>
        </TabsContent>

        <TabsContent value="locked" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {achievements
              .filter((a) => !a.unlocked)
              .map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Hoạt động gần đây</CardTitle>
          <CardDescription>Các thành tích bạn vừa mở khóa</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {achievements
              .filter((a) => a.unlocked)
              .slice(0, 3)
              .map((achievement) => {
                const Icon = achievement.icon;
                return (
                  <div
                    key={achievement.id}
                    className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                  >
                    <div
                      className={`w-12 h-12 bg-gradient-to-br ${achievement.color} rounded-xl flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="mb-1">{achievement.name}</div>
                      <p className="text-sm text-gray-500">
                        {achievement.description}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      {achievement.unlockedDate}
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AchievementCard({ achievement }) {
  const Icon = achievement.icon;

  return (
    <Card
      className={`${achievement.unlocked
          ? 'border-yellow-200 bg-gradient-to-br from-white to-yellow-50'
          : 'opacity-60'
        }`}
    >
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div
            className={`w-16 h-16 bg-gradient-to-br ${achievement.color} rounded-2xl flex items-center justify-center mb-3 ${!achievement.unlocked && 'grayscale'
              }`}
          >
            <Icon className="w-8 h-8 text-white" />
          </div>
          <h3 className="mb-1">{achievement.name}</h3>
          <p className="text-sm text-gray-500 mb-3">
            {achievement.description}
          </p>
          {achievement.unlocked ? (
            <Badge className="bg-yellow-500">
              ✓ Đã mở khóa
            </Badge>
          ) : achievement.progress !== undefined ? (
            <div className="w-full">
              <div className="text-xs text-gray-500 mb-1">
                {achievement.progress}/{achievement.total}
              </div>
              <Progress
                value={(achievement.progress / achievement.total) * 100}
                className="h-2"
              />
            </div>
          ) : (
            <Badge variant="outline">🔒 Chưa mở khóa</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
