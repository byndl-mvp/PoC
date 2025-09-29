import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

// Landing & Auth Pages
import LandingPage from './pages/LandingPage';
import BauherrLoginPage from './pages/BauherrenLoginPage';
import BauherrRegisterPage from './pages/BauherrRegisterPage';
import BauherrEmailVerification from './pages/BauherrEmailVerification';
import BauherrPasswordResetPage from './pages/BauherrPasswordResetPage';
import HandwerkerLoginPage from './pages/HandwerkerLoginPage';
import HandwerkerRegisterPage from './pages/HandwerkerRegisterPage';
import HandwerkerEmailVerification from './pages/HandwerkerEmailVerification';
import HandwerkerPasswordResetPage from './pages/HandwerkerPasswordResetPage';

// Bauherren Pages
import ProjectFormPage from './pages/ProjectFormPage';
import IntakeQuestionsPage from './pages/IntakeQuestionsPage';
import TradeConfirmationPage from './pages/TradeConfirmationPage';
import QuestionsPage from './pages/QuestionsPage';
import ResultPage from './pages/ResultPage';
import AdditionalTradeSelectionPage from './pages/AdditionalTradeSelectionPage';
import LVReviewPage from './pages/LVReviewPage';
import BauherrenDashboardPage from './pages/BauherrenDashboardPage';

// Handwerker Pages
import HandwerkerDashboardPage from './pages/HandwerkerDashboardPage';
import HandwerkerSettingsPage from './pages/HandwerkerSettingsPage';

// Admin Pages
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

// Protected Route Component
import ProtectedRoute from './components/ProtectedRoute';

// Layout Component mit bedingtem Header
function Layout({ children }) {
  const location = useLocation();
  
  // Nur Admin-Seiten bekommen Header und Footer
  const isAdminPage = location.pathname.startsWith('/admin');
  
  // Wenn keine Admin-Seite, nur children rendern
  if (!isAdminPage) {
    return <>{children}</>;
  }
  
  // Nur für Admin-Seiten mit Header und Footer
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation Header - nur für Admin */}
      <nav className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/admin/dashboard" className="flex items-center">
                <span className="text-2xl font-bold text-indigo-600">BYNDL</span>
                <span className="ml-2 text-sm text-gray-500">Admin Dashboard</span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                to="/" 
                className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Zur Hauptseite
              </Link>
              <Link 
                to="/admin/dashboard" 
                className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            © 2024 BYNDL - Admin Bereich
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* ============= Öffentliche Routen ============= */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/start" element={<ProjectFormPage />} />
          
          {/* ============= Bauherren Routen ============= */}
          {/* Auth-Routen */}
          <Route path="/bauherr/login" element={<BauherrLoginPage />} />
          <Route path="/bauherr/register" element={<BauherrRegisterPage />} />
          <Route path="/bauherr/verify" element={<BauherrEmailVerification />} />
          <Route path="/bauherr/reset-password" element={<BauherrPasswordResetPage />} />
          
          {/* Geschützte Bauherren-Routen */}
          <Route 
            path="/bauherr/dashboard" 
            element={
              <ProtectedRoute userType="bauherr">
                <BauherrenDashboardPage />
              </ProtectedRoute>
            } 
          />
          
          {/* Legacy/Alternative Routen für Bauherren */}
          <Route path="/bauherren/login" element={<BauherrLoginPage />} />
          <Route path="/bauherren/dashboard" element={<BauherrenDashboardPage />} />
          
          {/* ============= Projekt-Workflow Routen ============= */}
          <Route path="/project/:projectId/intake" element={<IntakeQuestionsPage />} />
          <Route path="/project/:projectId/trades" element={<TradeConfirmationPage />} />
          <Route path="/project/:projectId/trades/confirm" element={<TradeConfirmationPage />} />
          <Route path="/project/:projectId/lv-review" element={<LVReviewPage />} />
          <Route path="/project/:projectId/trade/:tradeId/questions" element={<QuestionsPage />} />
          <Route path="/project/:projectId/result" element={<ResultPage />} />
          <Route path="/project/:projectId/add-trade" element={<AdditionalTradeSelectionPage />} />
          
          {/* Alternative Projekt-Routen (mit :id statt :projectId) */}
          <Route path="/project/:id/intake" element={<IntakeQuestionsPage />} />
          <Route path="/project/:id/trades/confirm" element={<TradeConfirmationPage />} />
          <Route path="/project/:id/lv-review" element={<LVReviewPage />} />
          
          {/* ============= Handwerker Routen ============= */}
          {/* Auth-Routen */}
          <Route path="/handwerker/login" element={<HandwerkerLoginPage />} />
          <Route path="/handwerker/register" element={<HandwerkerRegisterPage />} />
          <Route path="/handwerker/verify" element={<HandwerkerEmailVerification />} />
          <Route path="/handwerker/reset-password" element={<HandwerkerPasswordResetPage />} />
          
          {/* Geschützte Handwerker-Routen */}
          <Route 
            path="/handwerker/dashboard" 
            element={
              <ProtectedRoute userType="handwerker">
                <HandwerkerDashboardPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/handwerker/settings" 
            element={
              <ProtectedRoute userType="handwerker">
                <HandwerkerSettingsPage />
              </ProtectedRoute>
            } 
          />
          
          {/* ============= Admin Routen - mit Header/Footer ============= */}
          <Route path="/admin" element={<AdminLoginPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute userType="admin">
                <AdminDashboardPage />
              </ProtectedRoute>
            } 
          />
          
          {/* ============= 404 Fallback ============= */}
          <Route path="*" element={
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-white mb-4">404</h1>
                <p className="text-gray-300 mb-8 text-xl">Seite nicht gefunden</p>
                <Link to="/" className="text-teal-400 hover:text-teal-300 text-lg underline">
                  Zurück zur Startseite
                </Link>
              </div>
            </div>
          } />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
