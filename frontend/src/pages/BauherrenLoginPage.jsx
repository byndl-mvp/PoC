// src/components/BauherrenLoginPage.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function BauherrenLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginMode, setLoginMode] = useState('password'); // 'password' oder 'emailOnly'

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.email) {
      setError('Bitte geben Sie Ihre E-Mail-Adresse ein.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Neuer Login mit Passwort
      const res = await fetch(apiUrl('/api/bauherr/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password || null
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {  // <-- DIESE ZEILE FEHLT BEI DIR!
        // Token und Daten speichern
        if (data.token) {
          sessionStorage.setItem('bauherrToken', data.token);
        }
        sessionStorage.setItem('bauherrData', JSON.stringify({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          userId: data.user.id,
          emailVerified: data.user.emailVerified !== false
        }));
        // Für Rückwärtskompatibilität:
        sessionStorage.setItem('userData', JSON.stringify({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          userId: data.user.id
        }));
        
        // Zum Dashboard navigieren
        navigate('/bauherr/dashboard');
      } else {
        if (data.error === 'Passwort erforderlich') {
          // Account hat Passwort, aber keines wurde eingegeben
          setLoginMode('password');
          setError('Dieser Account benötigt ein Passwort. Bitte geben Sie Ihr Passwort ein.');
        } else {
          setError(data.error || 'Anmeldung fehlgeschlagen');
        }
      }
    } catch (err) {
      console.error('Login-Fehler:', err);
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!resetEmail) {
      setError('Bitte geben Sie Ihre E-Mail-Adresse ein.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(apiUrl('/api/bauherr/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail })
      });
      
      if (res.ok) {
        alert('Wir haben Ihnen eine E-Mail mit Anweisungen zum Zurücksetzen Ihres Passworts gesendet.');
        setShowForgotPassword(false);
        setResetEmail('');
      } else {
        setError('E-Mail-Versand fehlgeschlagen. Bitte versuchen Sie es später erneut.');
      }
    } catch (err) {
      setError('Ein Fehler ist aufgetreten.');
    } finally {
      setLoading(false);
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
          
          {!showForgotPassword ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Anmelden
              </h2>
              
              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-white font-medium mb-2">
                    E-Mail-Adresse
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="max.mustermann@email.de"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>

                {loginMode === 'password' && (
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Passwort
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                      >
                        {showPassword ? '👁' : '👁‍🗨'}
                      </button>
                    </div>
                    
                    <div className="mt-2 text-right">
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-teal-400 hover:text-teal-300 text-sm transition-colors"
                      >
                        Passwort vergessen?
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-teal-500 to-blue-600 text-white font-semibold py-3 rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Anmelden...
                    </span>
                  ) : (
                    'Anmelden'
                  )}
                </button>
              </form>
            </>
          ) : (
            // Passwort vergessen Form
            <>
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Passwort zurücksetzen
              </h2>
              
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <p className="text-gray-300 text-sm">
                  Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen Anweisungen zum Zurücksetzen Ihres Passworts.
                </p>
                
                <div>
                  <label className="block text-white font-medium mb-2">
                    E-Mail-Adresse
                  </label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="max.mustermann@email.de"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                
                {error && (
                  <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                    <p className="text-red-200 text-sm">{error}</p>
                  </div>
                )}
                
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmail('');
                      setError('');
                    }}
                    className="flex-1 px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
                  >
                    Zurück
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50"
                  >
                    {loading ? 'Wird gesendet...' : 'E-Mail senden'}
                  </button>
                </div>
              </form>
            </>
          )}

          {!showForgotPassword && (
            <>
              <div className="mt-8 pt-6 border-t border-white/20">
                <p className="text-center text-gray-300">
                  Noch kein Konto?
                </p>
                <Link
                  to="/bauherr/register"
                  className="block mt-4 w-full text-center px-6 py-3 bg-gradient-to-r from-teal-500/20 to-blue-600/20 backdrop-blur border border-teal-400/50 rounded-lg text-white hover:from-teal-500/30 hover:to-blue-600/30 transition-all"
                >
                  Jetzt als Bauherr registrieren
                </Link>
              </div>

              <div className="mt-4 text-center">
                <p className="text-gray-400 text-sm">
                  Oder starten Sie direkt ein neues Projekt:
                </p>
                <Link
                  to="/start"
                  className="inline-block mt-2 text-teal-400 hover:text-teal-300 text-sm transition-colors"
                >
                  Projekt starten →
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/handwerker/login"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Sind Sie Handwerker? Hier zum Handwerker-Login →
          </Link>
        </div>
      </div>
    </div>
  );
}
