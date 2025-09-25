import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function BauherrenLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email) {
      setError('Bitte geben Sie Ihre E-Mail-Adresse ein.');
      return;
    }

    // E-Mail Validierung
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Versuche Nutzerdaten zu laden
      const res = await fetch(apiUrl(`/api/users/verify?email=${encodeURIComponent(email)}`));
      
      if (res.ok) {
        const userData = await res.json();
        
        // Speichere Nutzerdaten in Session
        sessionStorage.setItem('userData', JSON.stringify({
          name: userData.name,
          email: userData.email,
          userId: userData.id
        }));
        
        // Navigiere zum Dashboard
        navigate('/bauherr/dashboard');
      } else if (res.status === 404) {
        setError('Keine Projekte mit dieser E-Mail-Adresse gefunden. Bitte legen Sie zuerst ein Projekt an.');
      } else {
        throw new Error('Anmeldung fehlgeschlagen');
      }
    } catch (err) {
      console.error('Login-Fehler:', err);
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
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
          <p className="text-gray-300 mt-2">Bauherren-Bereich</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="max.mustermann@email.de"
                className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
              <p className="text-gray-400 text-sm mt-2">
                Verwenden Sie die E-Mail-Adresse, mit der Sie Ihr Projekt angelegt haben.
              </p>
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

          <div className="mt-8 pt-6 border-t border-white/20">
            <p className="text-center text-gray-300">
              Noch kein Projekt angelegt?
            </p>
            <Link
              to="/start"
              className="block mt-4 w-full text-center px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
            >
              Jetzt Projekt starten
            </Link>
          </div>

          <div className="mt-4 text-center">
            <p className="text-gray-400 text-sm">
              Hinweis: Aus Sicherheitsgründen verwenden wir keine Passwörter. 
              Der Zugang erfolgt ausschließlich über Ihre registrierte E-Mail-Adresse.
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-300 text-sm text-center">
            <strong>ℹ️ Tipp:</strong> Nach der Anmeldung können Sie alle Ihre Projekte verwalten, 
            Ausschreibungen starten und Angebote vergleichen.
          </p>
        </div>
      </div>
    </div>
  );
}
