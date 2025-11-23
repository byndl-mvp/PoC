import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';

// Landing & Auth Pages
import LandingPage from './pages/LandingPage';
import AGB from './pages/AGB';
import Impressum from './pages/Impressum';
import Datenschutz from './pages/Datenschutz';
import Disclaimer from './pages/Disclaimer';
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
import LVPreviewPage from './pages/LVPreviewPage';
import BauherrenSettingsPage from './pages/BauherrenSettingsPage';
import OfferDetailPage from './pages/OfferDetailPage';
import BauherrenNachtragsPruefungPage from './pages/BauherrenNachtragsPruefungPage';
import BauherrenNachtraegeUebersichtPage from './pages/BauherrenNachtraegeUebersichtPage';
import HandwerkerRatingPage from './pages/HandwerkerRatingPage';

// Handwerker Pages
import HandwerkerDashboardPage from './pages/HandwerkerDashboardPage';
import HandwerkerSettingsPage from './pages/HandwerkerSettingsPage';
import HandwerkerOfferPage from './pages/HandwerkerOfferPage';
import HandwerkerOfferDetailsPage from './pages/HandwerkerOfferDetailsPage';
import HandwerkerOfferConfirmPage from './pages/HandwerkerOfferConfirmPage';
import HandwerkerBundleOfferPage from './pages/HandwerkerBundleOfferPage';
import HandwerkerLVDetailsPage from './pages/HandwerkerLVDetailsPage';
import OrtsterminPage from './pages/OrtsterminPage';
import HandwerkerNachtragPage from './pages/HandwerkerNachtragPage';
import HandwerkerNachtraegeUebersichtPage from './pages/HandwerkerNachtraegeUebersichtPage';
import HandwerkerNachtragDetailsPage from './pages/HandwerkerNachtragDetailsPage';

// Admin Pages
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';

// Protected Route Component
import ProtectedRoute from './pages/ProtectedRoute.jsx';

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

          {/* Rechtliche Seiten */}
          <Route path="/agb" element={<AGB />} />
          <Route path="/impressum" element={<Impressum />} />
          <Route path="/datenschutz" element={<Datenschutz />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          
          {/* ============= Bauherren Routen ============= */}
          {/* Auth-Routen */}
          <Route path="/bauherr/login" element={<BauherrLoginPage />} />
          <Route path="/bauherr/register" element={<BauherrRegisterPage />} />
          <Route path="/bauherr/verify" element={<BauherrEmailVerification />} />
          <Route path="/bauherr/reset-password" element={<BauherrPasswordResetPage />} />

          {/* NEUE ROUTE HIER */}
          <Route path="/project/:projectId/offer/:offerId" element={<OfferDetailPage />} />

          <Route path="/project/:projectId/tender/:tenderId/lv-preview" element={<LVPreviewPage />} />
          
          {/* Geschützte Bauherren-Routen */}
          <Route 
            path="/bauherr/dashboard" 
            element={
              <ProtectedRoute userType="bauherr">
                <BauherrenDashboardPage />
              </ProtectedRoute>
            } 
          />
          <Route 
  path="/bauherr/settings" 
  element={
    <ProtectedRoute userType="bauherr">
      <BauherrenSettingsPage />
    </ProtectedRoute>
  } 
/>          

          {/* Bauherr Nachträge */}
<Route path="/bauherr/nachtraege/:nachtragId/pruefen" element={<BauherrenNachtragsPruefungPage />} />
<Route path="/bauherr/auftrag/:orderId/nachtraege" element={<BauherrenNachtraegeUebersichtPage />} />          
          
<Route path="/bauherr/auftrag/:orderId/bewerten" element={<HandwerkerRatingPage />} />
          
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
          <Route path="/ortstermin/:offerId" element={<OrtsterminPage />} />
          
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
<Route 
  path="/handwerker/offer/:offerId/details" 
  element={
    <ProtectedRoute userType="handwerker">
      <HandwerkerOfferDetailsPage />
    </ProtectedRoute>
  }
/>
          
{/* Angebot bestätigen nach Ortstermin */}
<Route 
  path="/handwerker/offer/:offerId/confirm" 
  element={
    <ProtectedRoute userType="handwerker">
      <HandwerkerOfferConfirmPage />
    </ProtectedRoute>
  } 
/>
{/* Handwerker Tender Angebot */}
<Route 
  path="/handwerker/tender/:tenderId/offer" 
  element={
    <ProtectedRoute userType="handwerker">
      <HandwerkerOfferPage />
    </ProtectedRoute>
  } 
/>

<Route path="/handwerker/bundle/:bundleId/offer" element={<HandwerkerBundleOfferPage />} />
          
{/* LV-Details für Handwerker - geschützt */}
<Route 
  path="/handwerker/order/:orderId/lv-details" 
  element={
    <ProtectedRoute userType="handwerker">
      <HandwerkerLVDetailsPage />
    </ProtectedRoute>
  }
/>
          
{/* Handwerker Nachträge */}
<Route path="/handwerker/auftrag/:orderId/nachtrag/neu" element={<HandwerkerNachtragPage />} />
<Route path="/handwerker/auftrag/:orderId/nachtraege" element={<HandwerkerNachtraegeUebersichtPage />} />
<Route path="/handwerker/nachtraege/:nachtragId/details" element={<HandwerkerNachtragDetailsPage />} />
          
{/* Ortstermin Route - für beide Nutzertypen */}
<Route 
  path="/offer/:offerId/appointment" 
  element={
    <ProtectedRoute userType="any">
      <OrtsterminPage />
    </ProtectedRoute>
  } 
/>

{/* LV-Details für Bauherr - geschützt */}
<Route 
  path="/bauherr/order/:orderId/lv-details" 
  element={
    <ProtectedRoute userType="bauherr">
      <HandwerkerLVDetailsPage />
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
