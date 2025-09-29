// src/components/BauherrPasswordResetPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function BauherrPasswordResetPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);

  useEffect(() => {
    const resetToken = searchParams.get('token');
    
    if (!resetToken) {
      setTokenValid(false);
      setError('Kein gültiger Reset-Token vorhanden.');
    } else {
      setToken(resetToken);
    }
  }, [searchParams]);

  const getPasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 12.5;
    if (/[^a-zA-Z\d]/.test(password)) strength += 12.5;
    return Math.min(100, strength);
  };

  const getPasswordStrengthText = (password) => {
    const strength = getPasswordStrength(password);
    if (strength < 30) return 'Sehr schwach';
    if (strength < 50) return 'Schwach';
    if (strength < 70) return 'Mittel';
    if (strength < 90) return 'Stark';
    return 'Sehr stark';
  };

  const getPasswordStrengthColor = (password) => {
    const strength = getPasswordStrength(password);
    if (strength < 30) return 'text-red-400';
    if (strength < 50) return 'text-orange-400';
    if (strength < 70) return 'text-yellow-400';
    if (strength < 90) return 'text-green-400';
    return 'text-green-500';
  };

  const getPasswordStrengthClass = (password) => {
    const strength = getPasswordStrength(password);
    if (strength < 30) return 'bg-red-500';
    if (strength < 50) return 'bg-orange-500';
    if (strength < 70) return 'bg-yellow-500';
    if (strength < 90) return 'bg-green-500';
    return 'bg-green-600';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setError('Bitte füllen Sie alle Felder aus.');
      return;
    }
    
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(apiUrl('/api/bauherr/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          newPassword: password
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/bauherr/login');
        }, 3000);
      } else {
        setError(data.error || 'Passwort-Reset fehlgeschlagen');
        if (data.error?.includes('abgelaufen') || data.error?.includes('Ungültig')) {
          setTokenValid(false);
        }
      }
    } catch (err) {
      console.error('Reset-Fehler:', err);
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
          <p className="text-gray-300 mt-2">Neues Passwort festlegen</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          
          {success ? (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Passwort erfolgreich zurückgesetzt!</h2>
              <p className="text-gray-300 mb-6">
                Sie können sich jetzt mit Ihrem neuen Passwort anmelden.
              </p>
              <p className="text-gray-400">
                Sie werden in 3 Sekunden zur Login-Seite weitergeleitet...
              </p>
            </div>
          ) : !tokenValid ? (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-20 h-20 mx-auto bg-red-500 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Ungültiger oder abgelaufener Link</h2>
              <p className="text-gray-300 mb-6">
                {error || 'Dieser Reset-Link ist ungültig oder abgelaufen.'}
              </p>
              <Link
                to="/bauherr/login"
                className="inline-block w-full text-center px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
              >
                Zur Login-Seite
              </Link>
              <p className="text-gray-400 text-center mt-4 text-sm">
                Sie können dort erneut "Passwort vergessen" anklicken.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-6 text-center">
                Neues Passwort festlegen
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Neues Passwort
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mindestens 8 Zeichen"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-12"
                      required
                      minLength="8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                    >
                      {showPassword ? '👁' : '👁‍🗨'}
                    </button>
                  </div>
                  
                  {password && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/60 text-xs">Passwortstärke:</span>
                        <span className={`text-xs ${getPasswordStrengthColor(password)}`}>
                          {getPasswordStrengthText(password)}
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div 
                          className={`h-full rounded-full transition-all ${getPasswordStrengthClass(password)}`}
                          style={{ width: `${getPasswordStrength(password)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">
                    Passwort bestätigen
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? '👁' : '👁‍🗨'}
                    </button>
                  </div>
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">Die Passwörter stimmen nicht überein</p>
                  )}
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
                  {loading ? 'Wird gespeichert...' : 'Passwort zurücksetzen'}
                </button>
              </form>
              
              <div className="mt-6 text-center">
                <Link 
                  to="/bauherr/login" 
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  ← Zurück zum Login
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
