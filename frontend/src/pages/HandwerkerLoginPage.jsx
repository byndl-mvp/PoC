import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function HandwerkerLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setError('Bitte füllen Sie alle Felder aus.');
      return;
    }

    // E-Mail Validierung
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Login mit Passwort
      const res = await fetch(apiUrl('/api/handwerker/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          rememberMe: formData.rememberMe
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Speichere Token
        if (data.token) {
          sessionStorage.setItem('handwerkerToken', data.token);
          
          // Bei "Angemeldet bleiben" auch in localStorage
          if (formData.rememberMe) {
            localStorage.setItem('handwerkerToken', data.token);
          }
        }
        
        // Speichere Handwerker-Daten
const handwerkerData = {
  id: data.handwerker.id,
  verified: data.handwerker.verified,                         
  verification_status: data.handwerker.verification_status,  
  companyId: data.handwerker.companyId,
  companyName: data.handwerker.companyName,
  email: data.handwerker.email,
  trades: data.trades || [],
  region: data.handwerker.address?.city,
  actionRadius: data.handwerker.actionRadius,
  lastLogin: data.handwerker.lastLogin
};
        
        sessionStorage.setItem('handwerkerData', JSON.stringify(handwerkerData));
        
        if (formData.rememberMe) {
          localStorage.setItem('handwerkerData', JSON.stringify(handwerkerData));
        }
        
        navigate('/handwerker/dashboard');
      } else {
        setError(data.error || 'Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Zugangsdaten.');
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
      const res = await fetch(apiUrl('/api/handwerker/forgot-password'), {
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
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-md w-full mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-4xl font-bold text-white hover:text-teal-400 transition-colors">byndl</h1>
          </Link>
          <p className="text-gray-300 mt-2">Handwerker-Bereich</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          
          {!showForgotPassword ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Handwerker-Login
              </h2>
              
              <form onSubmit={handleLogin} className="space-y-6">
                {/* E-Mail */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    E-Mail-Adresse
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="info@handwerksbetrieb.de"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Passwort */}
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
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Optionen */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center text-white">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={handleChange}
                      className="mr-2 w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
                    />
                    <span className="text-sm">Angemeldet bleiben</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-teal-400 hover:text-teal-300 text-sm transition-colors"
                  >
                    Passwort vergessen?
                  </button>
                </div>

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
                    placeholder="info@handwerksbetrieb.de"
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

          {/* Registrierung Link - nur im Login-Modus anzeigen */}
          {!showForgotPassword && (
            <div className="mt-8 pt-6 border-t border-white/20">
              <p className="text-center text-gray-300">
                Noch nicht registriert?
              </p>
              <Link
                to="/handwerker/register"
                className="block mt-4 w-full text-center px-6 py-3 bg-gradient-to-r from-teal-500/20 to-blue-600/20 backdrop-blur border border-teal-400/50 rounded-lg text-white hover:from-teal-500/30 hover:to-blue-600/30 transition-all"
              >
                Als Handwerksbetrieb registrieren
              </Link>
            </div>
          )}

          {/* Info Box */}
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-300 text-sm">
              <strong>💡 Vorteile für Handwerksbetriebe:</strong>
            </p>
            <ul className="text-yellow-200 text-sm mt-2 space-y-1 list-disc list-inside">
              <li>Qualifizierte Anfragen mit vollständigen LVs</li>
              <li>Regionale Projektbündelung für bessere Auslastung</li>
              <li>Keine Akquisekosten - nur Provision bei Auftrag</li>
              <li>Digitale Abwicklung spart Zeit und Papier</li>
            </ul>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 text-center">
          <Link
            to="/bauherr/login"
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Sind Sie Bauherr? Hier zum Bauherren-Login →
          </Link>
        </div>
      </div>
    </div>
  );
}
