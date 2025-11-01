import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SessionPage from './pages/SessionPage';
import LearningProgressPage from './pages/LearningProgressPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
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
      </Routes>
    </Router>
  );
}

export default App;