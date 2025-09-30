// src/components/BauherrEmailVerification.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function BauherrEmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
  const token = searchParams.get('token');
  
  if (!token) {
    setStatus('error');
    setMessage('Kein Verifizierungs-Token vorhanden.');
    return;
  }
  
  const verifyEmail = async (token) => {
    try {
      const response = await fetch(apiUrl('/api/bauherr/verify-email?token=' + token));
      const data = await response.json();
      
      if (response.ok) {
        setStatus('success');
        setName(data.name || '');
        setTimeout(() => {
          navigate('/bauherr/dashboard');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Verifizierung fehlgeschlagen');
        if (data.error?.includes('abgelaufen')) {
          setStatus('expired');
        }
      }
    } catch (error) {
      console.error('Verifizierungsfehler:', error);
      setStatus('error');
      setMessage('Ein Fehler ist aufgetreten.');
    }
  };
  
  verifyEmail(token);
}, [searchParams, navigate]); // navigate als dependency hinzufügen

  const handleResend = async () => {
    if (!resendEmail) {
      alert('Bitte geben Sie Ihre E-Mail-Adresse ein.');
      return;
    }

    setResending(true);
    
    try {
      const response = await fetch(apiUrl('/api/bauherr/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Eine neue Verifizierungs-E-Mail wurde gesendet.');
        setResendEmail('');
      } else {
        alert(data.error || 'E-Mail konnte nicht gesendet werden.');
      }
    } catch (error) {
      alert('Ein Fehler ist aufgetreten.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-4xl font-bold text-white hover:text-teal-400 transition-colors">byndl</h1>
          </Link>
          <p className="text-gray-300 mt-2">Bauherren-Bereich</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          
          {status === 'verifying' && (
            <div className="text-center">
              <div className="mb-6">
                <svg className="animate-spin h-16 w-16 mx-auto text-teal-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">E-Mail wird verifiziert...</h2>
              <p className="text-gray-300">Bitte warten Sie einen Moment.</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">E-Mail erfolgreich verifiziert!</h2>
              {name && (
                <p className="text-lg text-gray-300 mb-4">Willkommen, {name}!</p>
              )}
              <p className="text-gray-400 mb-6">
                Sie werden in 5 Sekunden zur Login-Seite weitergeleitet...
              </p>
              <Link
                to="/bauherr/login"
                className="inline-block px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
              >
                Jetzt anmelden
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Verifizierung fehlgeschlagen</h2>
              <p className="text-gray-300 mb-6">{message}</p>
              <Link
                to="/bauherr/login"
                className="inline-block px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
              >
                Zur Login-Seite
              </Link>
            </div>
          )}

          {status === 'expired' && (
            <div>
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto bg-yellow-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4 text-center">Link abgelaufen</h2>
              <p className="text-gray-300 mb-6 text-center">
                Der Verifizierungslink ist abgelaufen. Bitte fordern Sie einen neuen an.
              </p>
              
              <div className="space-y-4">
                <input
                  type="email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="Ihre E-Mail-Adresse"
                  className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold disabled:opacity-50"
                >
                  {resending ? 'Wird gesendet...' : 'Neue E-Mail anfordern'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
