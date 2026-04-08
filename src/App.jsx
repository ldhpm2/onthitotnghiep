import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StudentHome from './views/StudentHome';
import StudentQuiz from './views/StudentQuiz';
import AdminDashboard from './views/AdminDashboard';
import Login from './views/Login';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StudentHome />} />
        <Route path="/quiz/:id" element={<StudentQuiz />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
