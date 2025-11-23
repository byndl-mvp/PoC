import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function BauherrEmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, expired
  const [message, setMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Kein Verifizierungs-Token vorhanden.');
      return;
    }
    
    const verifyEmail = async () => {
      try {
        const response = await fetch(apiUrl(`/api/bauherr/verify-email?token=${token}`));
        const data = await response.json();
        
        if (response.ok && data.success) {
          setStatus('success');
          setUserName(data.name || '');
          
          // Token und User-Daten speichern
          if (data.token) {
            const userData = {
              id: data.id,
              name: data.name,
              email: data.email,
              emailVerified: true
            };
            
            sessionStorage.setItem('bauherrToken', data.token);
            sessionStorage.setItem('bauherrData', JSON.stringify(userData));
            // Rückwärtskompatibilität
            sessionStorage.setItem('userData', JSON.stringify(userData));
          }
          
          // Countdown starten
          const timer = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                clearInterval(timer);
                navigate('/bauherr/dashboard');
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
          
          return () => clearInterval(timer);
        } else {
          setStatus('error');
          setMessage(data.error || 'Verifizierung fehlgeschlagen');
          
          // Prüfe ob Token abgelaufen
          if (data.error?.toLowerCase().includes('abgelaufen') || 
              data.error?.toLowerCase().includes('expired') ||
              data.expired) {
            setStatus('expired');
            setMessage('Der Verifizierungslink ist abgelaufen.');
          }
        }
      } catch (error) {
        console.error('Verifizierungsfehler:', error);
        setStatus('error');
        setMessage('Ein Netzwerkfehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
      }
    };
    
    verifyEmail();
  }, [searchParams, navigate]);
  
  const handleResend = async () => {
    if (!resendEmail) {
      setMessage('Bitte geben Sie Ihre E-Mail-Adresse ein.');
      return;
    }

    // E-Mail-Format validieren
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resendEmail)) {
      setMessage('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }

    setResending(true);
    setMessage('');
    
    try {
      const response = await fetch(apiUrl('/api/bauherr/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.toLowerCase() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatus('success');
        setMessage('Eine neue Verifizierungs-E-Mail wurde an Ihre Adresse gesendet. Bitte prüfen Sie Ihren Posteingang.');
        setResendEmail('');
      } else {
        setMessage(data.error || 'E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.');
      }
    } catch (error) {
      console.error('Resend error:', error);
      setMessage('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative max-w-md w-full mx-4">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-4xl font-bold text-white hover:text-teal-400 transition-colors">byndl</h1>
          </Link>
          <p className="text-gray-300 mt-2">E-Mail-Verifizierung</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          
          {/* Verifying State */}
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

          {/* Success State */}
          {status === 'success' && !message.includes('neue') && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center animate-bounce-once">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4">
                ✅ E-Mail erfolgreich verifiziert!
              </h2>
              
              {userName && (
                <p className="text-lg text-gray-300 mb-4">
                  Willkommen, <span className="font-semibold text-teal-400">{userName}</span>!
                </p>
              )}
              
              <div className="bg-white/5 rounded-lg p-4 mb-6">
                <p className="text-gray-300 text-sm mb-2">
                  Sie werden in <span className="text-2xl font-bold text-teal-400">{countdown}</span> Sekunde{countdown !== 1 ? 'n' : ''} weitergeleitet...
                </p>
                <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                  <div 
                    className="bg-gradient-to-r from-teal-500 to-blue-600 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${((3 - countdown) / 3) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <Link
                to="/bauherr/dashboard"
                className="inline-block px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
              >
                Sofort zum Dashboard →
              </Link>
            </div>
          )}

          {/* Error State */}
          {status === 'error' && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4">
                ⚠️ Verifizierung fehlgeschlagen
              </h2>
              
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                <p className="text-red-200">{message || 'Ein unbekannter Fehler ist aufgetreten.'}</p>
              </div>
              
              <div className="space-y-3">
                <Link
                  to="/bauherr/login"
                  className="block w-full px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all text-center"
                >
                  Zur Login-Seite
                </Link>
                
                <button
                  onClick={() => setStatus('expired')}
                  className="block w-full px-6 py-3 bg-teal-500/20 border border-teal-500/30 rounded-lg text-teal-300 hover:bg-teal-500/30 transition-all text-center"
                >
                  Neue Verifizierungs-E-Mail anfordern
                </button>
              </div>
            </div>
          )}

          {/* Expired State */}
          {status === 'expired' && (
            <div>
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto bg-yellow-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4 text-center">
                ⏱️ Link abgelaufen
              </h2>
              
              <p className="text-gray-300 mb-6 text-center">
                Der Verifizierungslink ist abgelaufen. Fordern Sie einen neuen an, um Ihre E-Mail-Adresse zu bestätigen.
              </p>
              
              {message && (
                <div className={`${message.includes('gesendet') ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'} border rounded-lg p-4 mb-6`}>
                  <p className={message.includes('gesendet') ? 'text-green-200' : 'text-red-200'}>{message}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-white font-medium mb-2">
                    E-Mail-Adresse
                  </label>
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleResend()}
                    placeholder="ihre-email@beispiel.de"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    disabled={resending}
                  />
                </div>
                
                <button
                  onClick={handleResend}
                  disabled={resending || !resendEmail}
                  className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {resending ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Wird gesendet...
                    </span>
                  ) : (
                    '📧 Neue Verifizierungs-E-Mail anfordern'
                  )}
                </button>
                
                <Link
                  to="/bauherr/login"
                  className="block w-full px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all text-center"
                >
                  Zurück zum Login
                </Link>
              </div>
            </div>
          )}

          {/* Resend Success Message */}
          {status === 'success' && message.includes('neue') && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                  </svg>
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-white mb-4">
                📬 E-Mail wurde gesendet!
              </h2>
              
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                <p className="text-green-200">{message}</p>
              </div>
              
              <Link
                to="/bauherr/login"
                className="inline-block px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
              >
                Zum Login
              </Link>
            </div>
          )}
        </div>

        {/* Footer Help Text */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Probleme? Kontaktieren Sie uns unter{' '}
            <a href="mailto:support@byndl.de" className="text-teal-400 hover:text-teal-300 transition-colors">
              support@byndl.de
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
