import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function HandwerkerLoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    companyId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.companyId) {
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
      // Versuche Handwerker-Login
      const res = await fetch(apiUrl('/api/handwerker/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          companyId: formData.companyId
        })
      });
      
      if (res.ok) {
  const handwerkerData = await res.json();
  
  // Speichere ALLE Daten inkl. DB-ID
  sessionStorage.setItem('handwerkerData', JSON.stringify({
    id: handwerkerData.id, // NEU: DB-ID
    companyName: handwerkerData.companyName,
    email: handwerkerData.email,
    companyId: handwerkerData.companyId,
    trades: handwerkerData.trades || [],
    region: handwerkerData.region,
    actionRadius: handwerkerData.actionRadius
  }));
  
  navigate('/handwerker/dashboard');
      } else if (res.status === 404) {
        setError('Betrieb nicht gefunden. Bitte registrieren Sie sich zuerst.');
      } else if (res.status === 401) {
        setError('Ungültige Anmeldedaten. Bitte überprüfen Sie Ihre Eingaben.');
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
          <p className="text-gray-300 mt-2">Handwerker-Bereich</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            Handwerker-Login
          </h2>
          
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Betriebs-ID */}
            <div>
              <label className="block text-white font-medium mb-2">
                Betriebs-ID
              </label>
              <input
                type="text"
                name="companyId"
                value={formData.companyId}
                onChange={handleChange}
                placeholder="z.B. HW-2024-001"
                className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                required
              />
              <p className="text-gray-400 text-xs mt-1">
                Ihre eindeutige Betriebs-ID erhalten Sie bei der Registrierung
              </p>
            </div>

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
              Noch nicht registriert?
            </p>
            <Link
              to="/handwerker/register"
              className="block mt-4 w-full text-center px-6 py-3 bg-gradient-to-r from-teal-500/20 to-blue-600/20 backdrop-blur border border-teal-400/50 rounded-lg text-white hover:from-teal-500/30 hover:to-blue-600/30 transition-all"
            >
              Als Handwerksbetrieb registrieren
            </Link>
          </div>

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
