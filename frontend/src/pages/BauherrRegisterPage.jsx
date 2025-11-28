// src/components/BauherrRegisterPage.jsx
// PROFESSIONELLE VERSION mit Vorname/Nachname, AGB-Checkbox, E-Mail-Verifizierungs-Pflicht
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { apiUrl } from '../api';
import { EmailVerificationModal } from './EmailVerificationModal';

export default function BauherrRegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',      // NEU: Vorname
    lastName: '',       // NEU: Nachname
    phone: '',
    street: '',
    houseNumber: '',
    zipCode: '',
    city: ''
  });
  
  // NEU: AGB und Datenschutz Akzeptanz
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [registrationData, setRegistrationData] = useState(null);
  
  // Projekt-ID aus dem State (von TradeConfirmationPage)
  const projectId = location.state?.projectId;
  const fromTradeConfirmation = location.state?.fromTradeConfirmation;
  
  useEffect(() => {
    if (!projectId && !fromTradeConfirmation) {
      console.log('Info: Direkte Registrierung ohne Projekt');
    }
  }, [projectId, fromTradeConfirmation]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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

  // Prüfen ob Formular vollständig ist
  const isFormValid = () => {
    return (
      formData.email &&
      formData.password &&
      formData.confirmPassword &&
      formData.firstName &&
      formData.lastName &&
      formData.phone &&
      formData.password === formData.confirmPassword &&
      formData.password.length >= 8 &&
      acceptedTerms &&
      acceptedPrivacy
    );
  };

  const handleResendVerificationEmail = async () => {
    try {
      const res = await fetch(apiUrl('/api/bauherr/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: registrationData?.user?.email 
        })
      });
      
      await res.json();
      return { success: res.ok };
    } catch (error) {
      console.error('Resend email error:', error);
      return { success: false };
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validierung
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName || !formData.phone) {
      setError('Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }
    
    if (formData.password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
      return;
    }

    // NEU: AGB und Datenschutz Prüfung
    if (!acceptedTerms || !acceptedPrivacy) {
      setError('Bitte akzeptieren Sie die AGB und Datenschutzbestimmungen.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Registrierung mit Projekt-ID falls vorhanden
      const res = await fetch(apiUrl('/api/bauherr/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          // Kombinierter Name für Rückwärtskompatibilität
          name: `${formData.firstName} ${formData.lastName}`,
          phone: formData.phone,
          street: formData.street,
          houseNumber: formData.houseNumber,
          zipCode: formData.zipCode,
          city: formData.city,
          projectId: projectId,
          acceptedTermsAt: new Date().toISOString(),
          acceptedPrivacyAt: new Date().toISOString()
        })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // WICHTIG: Token wird NICHT gespeichert - User muss erst E-Mail verifizieren!
        // Kein sessionStorage.setItem hier!
        
        // Projekt-ID für später speichern falls vorhanden
        if (projectId) {
          sessionStorage.setItem('pendingLvProject', projectId);
        }
        
        // Zeige Verification Modal
        setRegistrationData(data);
        setShowVerificationModal(true);
        
      } else {
        setError(data.error || 'Registrierung fehlgeschlagen');
      }
    } catch (err) {
      console.error('Registrierungsfehler:', err);
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* E-Mail Verification Modal */}
      <EmailVerificationModal
        isOpen={showVerificationModal}
        email={registrationData?.user?.email || formData.email}
        userName={registrationData?.user?.name || formData.firstName}
        onResendEmail={handleResendVerificationEmail}
        onClose={() => setShowVerificationModal(false)}
        userType="bauherr"
      />
      
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-4xl font-bold text-white hover:text-teal-400 transition-colors">byndl</h1>
          </Link>
          <h2 className="text-2xl text-white mt-4">Bauherren-Registrierung</h2>
          <p className="text-gray-400 mt-2">Erstellen Sie Ihr kostenloses Konto</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Persönliche Daten - NEU: Vorname und Nachname getrennt */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Persönliche Daten</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Vorname *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Max"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">
                    Nachname *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Mustermann"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-white font-medium mb-2">
                    Telefon *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+49 221 12345678"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Zugangsdaten */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Zugangsdaten</h3>
              
              <div className="mb-4">
                <label className="block text-white font-medium mb-2">
                  E-Mail-Adresse *
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
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Passwort *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Min. 8 Zeichen"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-12"
                      required
                      minLength="8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  
                  {formData.password && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/60 text-xs">Stärke:</span>
                        <span className={`text-xs ${getPasswordStrengthColor(formData.password)}`}>
                          {getPasswordStrengthText(formData.password)}
                        </span>
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div 
                          className={`h-full rounded-full transition-all ${getPasswordStrengthClass(formData.password)}`}
                          style={{ width: `${getPasswordStrength(formData.password)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">
                    Passwort bestätigen *
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Passwort wiederholen"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 pr-12"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
                    >
                      {showConfirmPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-red-400 text-xs mt-1">Passwörter stimmen nicht überein</p>
                  )}
                  {formData.password && formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="text-green-400 text-xs mt-1">✓ Passwörter stimmen überein</p>
                  )}
                </div>
              </div>
            </div>

            {/* Adresse (Optional) */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">
                Adresse <span className="text-gray-400 text-sm font-normal">(optional)</span>
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-white font-medium mb-2">Straße</label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleChange}
                    placeholder="Musterstraße"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">Hausnr.</label>
                  <input
                    type="text"
                    name="houseNumber"
                    value={formData.houseNumber}
                    onChange={handleChange}
                    placeholder="12a"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">PLZ</label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    pattern="[0-9]{5}"
                    maxLength="5"
                    placeholder="50667"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-white font-medium mb-2">Stadt</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Köln"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* NEU: AGB und Datenschutz Checkboxen */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white mb-4">Rechtliches</h3>
              
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="w-5 h-5 min-w-[20px] min-h-[20px] flex-shrink-0 mt-0.5 rounded border-white/30 bg-white/20 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                />
                <span className="text-gray-300 text-sm group-hover:text-white transition-colors">
                  Ich habe die{' '}
                  <Link 
                    to="/AGB" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:text-teal-300 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Allgemeinen Geschäftsbedingungen (AGB)
                  </Link>{' '}
                  und die{' '}
                  <Link 
                    to="/nutzungsbedingungen" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:text-teal-300 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Nutzungsbedingungen
                  </Link>{' '}
                  gelesen und akzeptiere diese. *
                </span>
              </label>
              
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  className="w-5 h-5 min-w-[20px] min-h-[20px] flex-shrink-0 mt-0.5 rounded border-white/30 bg-white/20 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                />
                <span className="text-gray-300 text-sm group-hover:text-white transition-colors">
                  Ich habe die{' '}
                  <Link 
                    to="/datenschutz" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:text-teal-300 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Datenschutzbestimmungen
                  </Link>{' '}
                  gelesen und stimme der Verarbeitung meiner Daten gemäß dieser Bestimmungen zu. *
                </span>
              </label>
              
              <p className="text-gray-500 text-xs mt-2">
                Weitere Informationen finden Sie auch in unserem{' '}
                <Link to="/disclaimer" target="_blank" className="text-teal-400 hover:text-teal-300 underline">
                  Disclaimer / Haftungsausschluss
                </Link>
              </p>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-200">{error}</p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
              >
                Zurück
              </button>
              
              <button
                type="submit"
                disabled={loading || !isFormValid()}
                className={`flex-1 px-6 py-3 rounded-lg shadow-lg font-semibold transition-all ${
                  isFormValid()
                    ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white hover:shadow-xl transform hover:scale-[1.02]'
                    : 'bg-gray-500/50 text-gray-400 cursor-not-allowed'
                }`}
              >
                {loading ? 'Registrierung läuft...' : 'Registrieren'}
              </button>
            </div>
            
            {/* Hinweis warum Button deaktiviert */}
            {!isFormValid() && (
              <p className="text-gray-400 text-xs text-center">
                Bitte füllen Sie alle Pflichtfelder aus und akzeptieren Sie die AGB sowie Datenschutzbestimmungen.
              </p>
            )}
          </form>

          <div className="mt-8 pt-6 border-t border-white/20">
            <p className="text-center text-gray-300">
              Bereits registriert?{' '}
              <Link to="/bauherr/login" className="text-teal-400 hover:text-teal-300 transition-colors">
                Zum Login
              </Link>
            </p>
          </div>
        </div>
        
        {projectId && (
          <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              <strong>Hinweis:</strong> Nach der Registrierung und E-Mail-Bestätigung können Sie direkt mit Ihrem Projekt fortfahren 
              und die KI-generierte Ausschreibung erstellen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
