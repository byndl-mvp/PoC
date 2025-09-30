// components/ProtectedRoute.jsx
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, userType }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [emailVerified, setEmailVerified] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        let token = null;
        let userData = {};
        
        // Spezielle Behandlung für Admin
        if (userType === 'admin') {
          token = localStorage.getItem('adminToken');
          
          if (!token) {
            setIsAuthenticated(false);
            setLoading(false);
            return;
          }
          
          // Admin braucht keine userData oder E-Mail-Verifizierung
          setIsAuthenticated(true);
          setEmailVerified(true);
          setLoading(false);
          return;
        }
        
        // Für Bauherr und Handwerker
        token = sessionStorage.getItem(`${userType}Token`) || 
                localStorage.getItem(`${userType}Token`);
        
        if (!token) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }
        
        // User Data prüfen (für Bauherr/Handwerker)
        userData = JSON.parse(
          sessionStorage.getItem(`${userType}Data`) || 
          localStorage.getItem(`${userType}Data`) || 
          '{}'
        );
        
        if (userData.id || userType === 'admin') {
          setIsAuthenticated(true);
          setEmailVerified(userData.emailVerified !== false);
        } else {
          setIsAuthenticated(false);
        }
        
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, [userType]);

  // Lade-Zustand
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 mx-auto text-teal-500 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-white">Authentifizierung wird geprüft...</p>
        </div>
      </div>
    );
  }

  // Nicht authentifiziert - Redirect zum passenden Login
  if (!isAuthenticated) {
    let loginPath = '/';
    
    switch(userType) {
      case 'admin':
        loginPath = '/admin/login';
        break;
      case 'handwerker':
        loginPath = '/handwerker/login';
        break;
      case 'bauherr':
        loginPath = '/bauherr/login';
        break;
      default:
        loginPath = '/';
    }
    
    return <Navigate to={loginPath} replace />;
  }

  // E-Mail-Verifizierung nur für Bauherr/Handwerker relevant
  if (!emailVerified && userType !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <EmailVerificationReminder userType={userType} />
        {children}
      </div>
    );
  }

  // Authentifiziert - Komponente rendern
  return children;
}

// Komponente für E-Mail-Verifizierungs-Erinnerung
function EmailVerificationReminder({ userType }) {
  const [show, setShow] = useState(true);
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    
    try {
      const userData = JSON.parse(
        sessionStorage.getItem(`${userType}Data`) || 
        localStorage.getItem(`${userType}Data`) || 
        '{}'
      );
      
      const response = await fetch(`/api/${userType}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userData.email })
      });
      
      if (response.ok) {
        alert('Verifizierungs-E-Mail wurde erneut gesendet.');
      } else {
        alert('E-Mail konnte nicht gesendet werden.');
      }
    } catch (error) {
      alert('Ein Fehler ist aufgetreten.');
    } finally {
      setResending(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="bg-yellow-500/90 backdrop-blur-sm px-4 py-3 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-900 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-yellow-900 text-sm font-medium">
              Ihre E-Mail-Adresse ist noch nicht verifiziert. Bitte prüfen Sie Ihr Postfach.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResend}
              disabled={resending}
              className="px-3 py-1 bg-yellow-700 text-white text-sm rounded hover:bg-yellow-800 transition-colors disabled:opacity-50"
            >
              {resending ? 'Wird gesendet...' : 'Erneut senden'}
            </button>
            <button
              onClick={() => setShow(false)}
              className="text-yellow-900 hover:text-yellow-800"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
