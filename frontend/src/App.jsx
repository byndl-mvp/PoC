import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';

// Pages
import LandingPage from './pages/LandingPage';
import ProjectFormPage from './pages/ProjectFormPage';
import IntakeQuestionsPage from './pages/IntakeQuestionsPage';
import TradeConfirmationPage from './pages/TradeConfirmationPage';
import QuestionsPage from './pages/QuestionsPage';
import ResultPage from './pages/ResultPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdditionalTradeSelectionPage from './pages/AdditionalTradeSelectionPage';
import LVReviewPage from './pages/LVReviewPage';  // NEU: Import hinzufügen

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Navigation Header */}
        <nav className="bg-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="flex items-center">
                  <span className="text-2xl font-bold text-indigo-600">BYNDL</span>
                  <span className="ml-2 text-sm text-gray-500">VOB-konforme LVs in Minuten</span>
                </Link>
              </div>
              <div className="flex items-center space-x-4">
                <Link 
                  to="/start" 
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Neues Projekt
                </Link>
                <Link 
                  to="/admin" 
                  className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Admin
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/start" element={<ProjectFormPage />} />
            
            {/* Project Flow */}
            <Route path="/project/:projectId/intake" element={<IntakeQuestionsPage />} />
            <Route path="/project/:projectId/trades" element={<TradeConfirmationPage />} />
            <Route path="/project/:projectId/lv-review" element={<LVReviewPage />} />  {/* NEU: Route hinzufügen */}
            <Route path="/project/:projectId/trade/:tradeId/questions" element={<QuestionsPage />} />
            <Route path="/project/:projectId/result" element={<ResultPage />} />
            <Route path="/project/:projectId/add-trade" element={<AdditionalTradeSelectionPage />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLoginPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            
            {/* 404 Fallback */}
            <Route path="*" element={
              <div className="text-center py-16">
                <h1 className="text-4xl font-bold text-gray-800 mb-4">404</h1>
                <p className="text-gray-600 mb-8">Seite nicht gefunden</p>
                <Link to="/" className="text-indigo-600 hover:underline">
                  Zurück zur Startseite
                </Link>
              </div>
            } />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-white mt-auto">
          <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
            <div className="text-center text-sm text-gray-500">
              © 2024 BYNDL - Intelligente Leistungsverzeichnisse
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
