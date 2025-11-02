import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SessionPage from './pages/SessionPage';
import LearningProgressPage from './pages/LearningProgressPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import AchievementsDetailPage from './pages/AchievementsDetailPage';
import HoursDetailPage from './pages/HoursDetailPage';
import StreakDetailPage from './pages/StreakDetailPage';
import './assets/css/cusstom.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/session" element={<SessionPage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
        <Route path="/progress" element={<LearningProgressPage />} />
        <Route path="/project/:projectId" element={<ProjectDetailPage />} />
        <Route path="/achievements" element={<AchievementsDetailPage />} />
        <Route path="/hours-detail" element={<HoursDetailPage />} />
        <Route path="/streaks" element={<StreakDetailPage />} />
      </Routes>
    </Router>
  );
}

export default App;