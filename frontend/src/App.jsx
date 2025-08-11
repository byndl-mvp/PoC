import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';
import ProjectFormPage from './pages/ProjectFormPage.jsx';
import QuestionsPage from './pages/QuestionsPage.jsx';
import ResultPage from './pages/ResultPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import AdminDashboardPage from './pages/AdminDashboardPage.jsx';

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-indigo-600 text-white p-4 flex justify-between items-center shadow">
        <Link to="/" className="text-xl font-bold">BYNDL</Link>
        <nav className="space-x-4">
          <Link to="/" className="hover:underline">Start</Link>
          <Link to="/admin/login" className="hover:underline">Admin Login</Link>
        </nav>
      </header>
      <main className="flex-1 container mx-auto p-4 w-full max-w-4xl">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/start" element={<ProjectFormPage />} />
          <Route path="/project/:projectId/trade/:tradeId/questions" element={<QuestionsPage />} />
          <Route path="/project/:projectId/result" element={<ResultPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
        </Routes>
      </main>
    </div>
  );
}