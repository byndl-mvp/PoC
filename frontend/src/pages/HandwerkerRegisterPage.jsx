// PROFESSIONELLE VERSION mit Vorname/Nachname, AGB-Checkbox, E-Mail-Verifizierungs-Pflicht
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../api';
import { EmailVerificationModal } from './EmailVerificationModal';

// Exakte Gewerke aus der PostgreSQL Datenbank mit Code-Abkürzungen
const AVAILABLE_TRADES = [
  { code: 'AUSS', name: 'Außenanlagen / GaLaBau' },
  { code: 'BOD', name: 'Bodenbelagsarbeiten' },
  { code: 'DACH', name: 'Dachdeckerarbeiten' },
  { code: 'ELEKT', name: 'Elektroinstallation' },
  { code: 'ESTR', name: 'Estricharbeiten' },
  { code: 'FASS', name: 'Fassadenbau / -sanierung' },
  { code: 'FEN', name: 'Fenster & Türen' },
  { code: 'FLI', name: 'Fliesen- und Plattenarbeiten' },
  { code: 'GER', name: 'Gerüstbau' },
  { code: 'HEI', name: 'Heizungsinstallation' },
  { code: 'MAL', name: 'Maler- & Lackierarbeiten' },
  { code: 'ROH', name: 'Rohbau / Mauer- & Betonarbeiten' },
  { code: 'SAN', name: 'Sanitärinstallation' },
  { code: 'SCHL', name: 'Schlosser- / Metallbau' },
  { code: 'TIS', name: 'Tischler / Innenausbau' },
  { code: 'TRO', name: 'Trockenbau' },
  { code: 'ABBR', name: 'Abbruch / Entkernung' },
  { code: 'KLIMA', name: 'Lüftung- und Klimatechnik' },
  { code: 'PV', name: 'Photovoltaik/Solartechnik' },
  { code: 'ZIMM', name: 'Zimmerer / Holzbau' }
];

// Verfügbare Zertifizierungen
const CERTIFICATIONS = [
  'Meisterbetrieb',
  'ISO 9001',
  'DGNB Zertifizierung',
  'Energieberater',
  'Denkmalschutz',
  'Brandschutz',
  'Elektro-Fachbetrieb',
  'Gas-/Wasser-Installation'
];

export default function HandwerkerRegisterPage() {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [registrationData, setRegistrationData] = useState(null);
  
  // NEU: AGB und Datenschutz Akzeptanz
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedCommission, setAcceptedCommission] = useState(false);
  
  const [formData, setFormData] = useState({
    // Firmendaten
    companyName: '',
    companyType: '',
    registrationNumber: '',
    taxNumber: '',
    // Kontaktdaten - NEU: Vorname und Nachname getrennt
    contactFirstName: '',
    contactLastName: '',
    contactPerson: '', // Wird aus Vorname + Nachname generiert
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    website: '',
    // Adresse
    street: '',
    houseNumber: '',
    zipCode: '',
    city: '',
    // Matching-relevante Daten
    trades: [],
    actionRadius: 25,
    maxProjectVolume: 50000,
    availableFrom: '',
    // Zusätzliche Infos
    employees: '',
    references: '',
    insurances: [],
    certifications: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadedDocuments, setUploadedDocuments] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({});
  
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
  
  const handleTradeToggle = (tradeCode) => {
    setFormData(prev => ({
      ...prev,
      trades: prev.trades.includes(tradeCode)
        ? prev.trades.filter(t => t !== tradeCode)
        : [...prev.trades, tradeCode]
    }));
  };

  const handleInsuranceToggle = (insurance) => {
    setFormData(prev => ({
      ...prev,
      insurances: prev.insurances.includes(insurance)
        ? prev.insurances.filter(i => i !== insurance)
        : [...prev.insurances, insurance]
    }));
  };

  const handleCertificationToggle = (certification) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.includes(certification)
        ? prev.certifications.filter(c => c !== certification)
        : [...prev.certifications, certification]
    }));
  };

  const validateStep = () => {
    if (step === 1) {
      // Erweiterte Validierung mit Vorname/Nachname
      if (!formData.companyName || !formData.contactFirstName || !formData.contactLastName || 
          !formData.email || !formData.phone || !formData.password || !formData.confirmPassword) {
        setError('Bitte füllen Sie alle Pflichtfelder aus.');
        return false;
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
        return false;
      }
      
      if (formData.password.length < 8) {
        setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
        return false;
      }
      
      if (formData.password !== formData.confirmPassword) {
        setError('Die Passwörter stimmen nicht überein.');
        return false;
      }
      
      const phoneRegex = /^[\d\s\-+()]+$/;
      if (!phoneRegex.test(formData.phone)) {
        setError('Bitte geben Sie eine gültige Telefonnummer ein.');
        return false;
      }
    }
    
    if (step === 2) {
      if (!formData.street || !formData.houseNumber || !formData.zipCode || !formData.city) {
        setError('Bitte geben Sie die vollständige Firmenadresse an.');
        return false;
      }
      if (formData.zipCode.length !== 5 || !/^\d{5}$/.test(formData.zipCode)) {
        setError('Bitte geben Sie eine gültige 5-stellige Postleitzahl ein.');
        return false;
      }
    }
    
    if (step === 3) {
      if (formData.trades.length === 0) {
        setError('Bitte wählen Sie mindestens ein Gewerk aus.');
        return false;
      }
      if (!formData.availableFrom) {
        setError('Bitte geben Sie an, ab wann Sie Aufträge annehmen können.');
        return false;
      }
      const selectedDate = new Date(formData.availableFrom);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (selectedDate < today) {
        setError('Das Verfügbarkeitsdatum kann nicht in der Vergangenheit liegen.');
        return false;
      }
    }
    
     // Step 5: AGB, Datenschutz UND Pflichtdokumente prüfen
  if (step === 5) {
    if (!acceptedTerms || !acceptedPrivacy) {
      setError('Bitte akzeptieren Sie die AGB und Datenschutzbestimmungen.');
      return false;
    }
    
    // NEU: Pflichtdokumente prüfen
    if (!uploadedFiles.gewerbeschein || !uploadedFiles.handwerkskarte) {
      setError('Bitte laden Sie mindestens Gewerbeschein und Handwerkskarte hoch.');
      return false;
    }
  }
    
    setError('');
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
    window.scrollTo(0, 0);
  };

  const generateCompanyId = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `HW-${year}-${random}`;
  };

  const handleFileUpload = async (e, documentType) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert('Datei ist zu groß (max. 5MB)');
      return;
    }
    
   // Speichere File-Objekt UND Dateinamen
  setUploadedFiles(prev => ({
    ...prev,
    [documentType]: file
  }));
  
  setUploadedDocuments(prev => ({
    ...prev,
    [documentType]: file.name
  }));
};

  const handleResendVerificationEmail = async () => {
    try {
      const res = await fetch(apiUrl('/api/handwerker/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: registrationData?.handwerker?.email 
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
  
  if (!validateStep()) return;
  
  setLoading(true);
  setError('');
  
  try {
    const companyId = generateCompanyId();
    const contactPerson = `${formData.contactFirstName} ${formData.contactLastName}`;
    const { confirmPassword, ...submitDataWithoutConfirm } = formData;
    
    const submitData = {
      ...submitDataWithoutConfirm,
      contactPerson,
      contactFirstName: formData.contactFirstName,
      contactLastName: formData.contactLastName,
      trades: formData.trades,
      companyId,
      registeredAt: new Date().toISOString(),
      acceptedTermsAt: new Date().toISOString(),
      acceptedPrivacyAt: new Date().toISOString()
    };
    
    // 1. REGISTRIERUNG
    const res = await fetch(apiUrl('/api/handwerker/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submitData)
    });
    
    if (res.ok) {
      const data = await res.json();
      const handwerkerId = data.handwerker.id;
      
      // 2. DOKUMENTE HOCHLADEN (bevor Modal angezeigt wird!)
      if (Object.keys(uploadedFiles).length > 0) {
        console.log('Lade Dokumente hoch für Handwerker-ID:', handwerkerId);
        await uploadDocumentsForRegistration(handwerkerId, uploadedFiles);
      }
      
      // 3. ERST JETZT Modal anzeigen
      setRegistrationData(data);
      setShowVerificationModal(true);
      
    } else {
      const errorData = await res.json();
      throw new Error(errorData.error || errorData.message || 'Registrierung fehlgeschlagen');
    }
  } catch (err) {
    console.error('Registrierungsfehler:', err);
    setError(err.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
  } finally {
    setLoading(false);
  }
};

// NEU: Funktion zum Hochladen der Dokumente bei Registrierung
const uploadDocumentsForRegistration = async (handwerkerId, files) => {
  const typeMapping = {
    'gewerbeschein': 'gewerbeschein',        // Bleibt gleich
    'handwerkskarte': 'handwerkskarte',      // Bleibt gleich
    'versicherung': 'versicherungsnachweis', // Optional
    'weitere': 'weitere'                      // Optional
  };
  
  for (const [key, file] of Object.entries(files)) {
    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('document_type', typeMapping[key] || key);
      
      const uploadRes = await fetch(apiUrl(`/api/handwerker/${handwerkerId}/documents/upload`), {
        method: 'POST',
        body: formData
      });
      
      if (uploadRes.ok) {
        console.log(`✓ Dokument ${key} erfolgreich hochgeladen`);
      } else {
        console.error(`✗ Fehler beim Upload von ${key}`);
      }
    } catch (err) {
      console.error(`Fehler beim Upload von ${key}:`, err);
      // Nicht abbrechen, versuche nächstes Dokument
    }
  }
};

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* E-Mail Verification Modal */}
      <EmailVerificationModal
        isOpen={showVerificationModal}
        email={registrationData?.handwerker?.email || formData.email}
        userName={registrationData?.handwerker?.companyName || formData.companyName}
        companyId={registrationData?.companyId}
        onResendEmail={handleResendVerificationEmail}
        onClose={() => setShowVerificationModal(false)}
        userType="handwerker"
      />
      
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <h1 className="text-4xl font-bold text-white hover:text-teal-400 transition-colors">byndl</h1>
          </Link>
          <h2 className="text-2xl text-white">Handwerker-Registrierung</h2>
          <p className="text-gray-300 mt-2">Werden Sie Teil des byndl-Netzwerks</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between items-center mb-8 max-w-md mx-auto">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                s < step ? 'bg-teal-600 text-white' :
                s === step ? 'bg-teal-500 text-white' : 
                'bg-white/20 text-white/60'
              }`}>
                {s < step ? '✔' : s}
              </div>
              {s < 5 && <div className={`w-8 h-0.5 ${s < step ? 'bg-teal-600' : 'bg-white/20'}`}></div>}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit}>
            
            {/* Step 1: Firmendaten & Zugangsdaten */}
            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white mb-4">Schritt 1: Firmendaten & Zugangsdaten</h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-medium mb-2">Firmenname *</label>
                    <input
                      type="text"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleChange}
                      placeholder="Mustermann GmbH"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white font-medium mb-2">Rechtsform</label>
                    <select
                      name="companyType"
                      value={formData.companyType}
                      onChange={handleChange}
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="" className="bg-slate-800">Bitte wählen</option>
                      <option value="einzelunternehmen" className="bg-slate-800">Einzelunternehmen</option>
                      <option value="gbr" className="bg-slate-800">GbR</option>
                      <option value="gmbh" className="bg-slate-800">GmbH</option>
                      <option value="ug" className="bg-slate-800">UG</option>
                      <option value="gmbh_co_kg" className="bg-slate-800">GmbH & Co. KG</option>
                    </select>
                  </div>
                  
                  {/* NEU: Vorname und Nachname getrennt */}
                  <div>
                    <label className="block text-white font-medium mb-2">Vorname Ansprechpartner *</label>
                    <input
                      type="text"
                      name="contactFirstName"
                      value={formData.contactFirstName}
                      onChange={handleChange}
                      placeholder="Max"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white font-medium mb-2">Nachname Ansprechpartner *</label>
                    <input
                      type="text"
                      name="contactLastName"
                      value={formData.contactLastName}
                      onChange={handleChange}
                      placeholder="Mustermann"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white font-medium mb-2">Telefon *</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+49 221 123456"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white font-medium mb-2">Website</label>
                    <input
                      type="url"
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      placeholder="https://www.handwerk.de"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* Zugangsdaten Section */}
                <div className="mt-6 pt-6 border-t border-white/20">
                  <h4 className="text-lg font-semibold text-white mb-4">Zugangsdaten für Ihr Konto</h4>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-white font-medium mb-2">E-Mail-Adresse *</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="info@handwerk.de"
                        className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        required
                      />
                      <p className="text-gray-400 text-xs mt-1">
                        Diese E-Mail wird für den Login und wichtige Benachrichtigungen verwendet
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-white font-medium mb-2">Passwort *</label>
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
                      <label className="block text-white font-medium mb-2">Passwort bestätigen *</label>
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

                {/* Weitere optionale Felder */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-medium mb-2">Handelsregisternummer</label>
                    <input
                      type="text"
                      name="registrationNumber"
                      value={formData.registrationNumber}
                      onChange={handleChange}
                      placeholder="HRB 12345"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white font-medium mb-2">Steuernummer</label>
                    <input
                      type="text"
                      name="taxNumber"
                      value={formData.taxNumber}
                      onChange={handleChange}
                      placeholder="123/456/78901"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Adresse */}
            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white mb-4">Schritt 2: Firmenadresse</h3>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-white font-medium mb-2">Straße *</label>
                    <input
                      type="text"
                      name="street"
                      value={formData.street}
                      onChange={handleChange}
                      placeholder="Musterstraße"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white font-medium mb-2">Hausnr. *</label>
                    <input
                      type="text"
                      name="houseNumber"
                      value={formData.houseNumber}
                      onChange={handleChange}
                      placeholder="12a"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white font-medium mb-2">PLZ *</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleChange}
                      pattern="[0-9]{5}"
                      maxLength="5"
                      placeholder="50667"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-white font-medium mb-2">Stadt *</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Köln"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                </div>
                
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-300 text-sm">
                    <strong>Hinweis:</strong> Ihre Adresse wird verwendet, um Ihren Aktionsradius zu berechnen und passende Projekte in Ihrer Nähe zu finden.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Gewerke & Einsatzgebiet */}
            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white mb-4">Schritt 3: Gewerke & Einsatzgebiet</h3>
                
                <div>
                  <label className="block text-white font-medium mb-2">
                    Ihre Gewerke * <span className="text-gray-400 text-sm">({formData.trades.length} ausgewählt)</span>
                  </label>
                  <div className="bg-white/5 rounded-lg p-4 max-h-60 overflow-y-auto">
                    <div className="grid md:grid-cols-2 gap-2">
                      {AVAILABLE_TRADES.map(trade => (
                        <label 
                          key={trade.code} 
                          className={`flex items-center p-2 rounded cursor-pointer transition-colors ${
                            formData.trades.includes(trade.code) 
                              ? 'bg-teal-500/20 border border-teal-500/50' 
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.trades.includes(trade.code)}
                            onChange={() => handleTradeToggle(trade.code)}
                            className="w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
                          />
                          <span className="ml-3 text-white text-sm">{trade.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white font-medium mb-2">Aktionsradius (km) *</label>
                    <input
                      type="range"
                      name="actionRadius"
                      value={formData.actionRadius}
                      onChange={handleChange}
                      min="5"
                      max="100"
                      step="5"
                      className="w-full"
                    />
                    <div className="flex justify-between text-gray-400 text-sm mt-1">
                      <span>5 km</span>
                      <span className="text-teal-400 font-bold">{formData.actionRadius} km</span>
                      <span>100 km</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-white font-medium mb-2">Max. Projektvolumen</label>
                    <select
                      name="maxProjectVolume"
                      value={formData.maxProjectVolume}
                      onChange={handleChange}
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="10000" className="bg-slate-800">Bis 10.000 €</option>
                      <option value="25000" className="bg-slate-800">Bis 25.000 €</option>
                      <option value="50000" className="bg-slate-800">Bis 50.000 €</option>
                      <option value="100000" className="bg-slate-800">Bis 100.000 €</option>
                      <option value="250000" className="bg-slate-800">Bis 250.000 €</option>
                      <option value="500000" className="bg-slate-800">Bis 500.000 €</option>
                      <option value="999999999" className="bg-slate-800">Unbegrenzt</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Verfügbar für Aufträge ab *</label>
                  <input
                    type="date"
                    name="availableFrom"
                    value={formData.availableFrom}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                </div>
              </div>
            )}

            {/* Step 4: Qualifikationen */}
            {step === 4 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white mb-4">Schritt 4: Qualifikationen & Versicherungen</h3>
                
                <div>
                  <label className="block text-white font-medium mb-2">Anzahl Mitarbeiter</label>
                  <select
                    name="employees"
                    value={formData.employees}
                    onChange={handleChange}
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="" className="bg-slate-800">Bitte wählen</option>
                    <option value="1" className="bg-slate-800">1 (Einzelunternehmer)</option>
                    <option value="2-5" className="bg-slate-800">2-5 Mitarbeiter</option>
                    <option value="6-10" className="bg-slate-800">6-10 Mitarbeiter</option>
                    <option value="11-20" className="bg-slate-800">11-20 Mitarbeiter</option>
                    <option value="21-50" className="bg-slate-800">21-50 Mitarbeiter</option>
                    <option value="50+" className="bg-slate-800">Über 50 Mitarbeiter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Versicherungen</label>
                  <div className="space-y-2">
                    {['Betriebshaftpflicht', 'Berufshaftpflicht', 'Baugewährleistungsversicherung'].map(insurance => (
                      <label key={insurance} className="flex items-center text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.insurances.includes(insurance)}
                          onChange={() => handleInsuranceToggle(insurance)}
                          className="mr-3 w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
                        />
                        <span>{insurance}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Zertifizierungen & Qualifikationen</label>
                  <div className="bg-white/10 rounded-lg p-4 max-h-40 overflow-y-auto grid md:grid-cols-2 gap-2">
                    {CERTIFICATIONS.map(cert => (
                      <label key={cert} className="flex items-center text-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.certifications.includes(cert)}
                          onChange={() => handleCertificationToggle(cert)}
                          className="mr-3 w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
                        />
                        <span className="text-sm">{cert}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">Referenzen (optional)</label>
                  <textarea
                    name="references"
                    value={formData.references}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Beschreiben Sie kurz 2-3 Ihrer wichtigsten Referenzprojekte..."
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}

            {/* Step 5: Dokumente & AGB */}
{step === 5 && (
  <div className="space-y-6">
    <h3 className="text-xl font-semibold text-white mb-4">Schritt 5: Nachweise & Abschluss</h3>
    
    {/* Wichtiger Hinweis */}
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
      <p className="text-blue-300 text-sm">
        <strong>ℹ️ Wichtig:</strong> Diese Dokumente werden für die Verifizierung durch unser Team benötigt. 
        Sie können erst auf Ausschreibungen zugreifen und Angebote erstellen, nachdem Ihr Account verifiziert wurde. 
        Die Prüfung dauert in der Regel 1-2 Werktage.
      </p>
    </div>
    
    {/* Dokument-Upload */}
    <div className="space-y-4">
      {/* Gewerbeschein - PFLICHT */}
      <div className="bg-white/5 rounded-lg p-4 border-l-4 border-red-500">
        <label className="block text-white font-medium mb-2">
          Gewerbeschein / Gewerbeanmeldung *
          <span className="text-gray-400 text-sm block mt-1">
            Erforderlich - Nachweis der Gewerbeanmeldung
          </span>
        </label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFileUpload(e, 'gewerbeschein')}
          className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-500 file:text-white hover:file:bg-teal-600 cursor-pointer"
        />
        {uploadedDocuments.gewerbeschein && (
          <p className="text-green-400 text-sm mt-2 flex items-center gap-2">
            <span>✔</span>
            <span>{uploadedDocuments.gewerbeschein}</span>
          </p>
        )}
        {!uploadedDocuments.gewerbeschein && (
          <p className="text-red-400 text-xs mt-2">⚠️ Pflichtdokument</p>
        )}
      </div>
      
      {/* Handwerkskarte/Meisterbrief - PFLICHT */}
      <div className="bg-white/5 rounded-lg p-4 border-l-4 border-red-500">
        <label className="block text-white font-medium mb-2">
          Handwerkskarte / Meisterbrief *
          <span className="text-gray-400 text-sm block mt-1">
            Erforderlich - Je nach Gewerk: Meisterbrief, Gesellenbrief oder §7b-Bescheinigung
          </span>
        </label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFileUpload(e, 'handwerkskarte')}
          className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-500 file:text-white hover:file:bg-teal-600 cursor-pointer"
        />
        {uploadedDocuments.handwerkskarte && (
          <p className="text-green-400 text-sm mt-2 flex items-center gap-2">
            <span>✔</span>
            <span>{uploadedDocuments.handwerkskarte}</span>
          </p>
        )}
        {!uploadedDocuments.handwerkskarte && (
          <p className="text-red-400 text-xs mt-2">⚠️ Pflichtdokument</p>
        )}
      </div>
      
      {/* Betriebshaftpflicht - EMPFOHLEN */}
      <div className="bg-white/5 rounded-lg p-4 border-l-4 border-yellow-500">
        <label className="block text-white font-medium mb-2">
          Betriebshaftpflichtversicherung
          <span className="text-gray-400 text-sm block mt-1">
            Stark empfohlen - Erhöht das Vertrauen der Bauherren erheblich
          </span>
        </label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFileUpload(e, 'versicherung')}
          className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-500 file:text-white hover:file:bg-teal-600 cursor-pointer"
        />
        {uploadedDocuments.versicherung && (
          <p className="text-green-400 text-sm mt-2 flex items-center gap-2">
            <span>✔</span>
            <span>{uploadedDocuments.versicherung}</span>
          </p>
        )}
        {!uploadedDocuments.versicherung && (
          <p className="text-yellow-400 text-xs mt-2">💡 Optional, aber empfohlen</p>
        )}
      </div>
      
      {/* Weitere Nachweise - OPTIONAL */}
      <div className="bg-white/5 rounded-lg p-4">
        <label className="block text-white font-medium mb-2">
          Weitere Nachweise (optional)
          <span className="text-gray-400 text-sm block mt-1">
            z.B. Zertifizierungen (ISO 9001), Berufsgenossenschaft-Nachweis, Referenzen
          </span>
        </label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => handleFileUpload(e, 'weitere')}
          className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-teal-500 file:text-white hover:file:bg-teal-600 cursor-pointer"
        />
        {uploadedDocuments.weitere && (
          <p className="text-green-400 text-sm mt-2 flex items-center gap-2">
            <span>✔</span>
            <span>{uploadedDocuments.weitere}</span>
          </p>
        )}
      </div>
    </div>

    {/* Hinweis zu fehlenden Dokumenten */}
    {(!uploadedDocuments.gewerbeschein || !uploadedDocuments.handwerkskarte) && (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-red-300 text-sm">
          <strong>⚠️ Pflichtdokumente fehlen:</strong> Bitte laden Sie mindestens den Gewerbeschein 
          und die Handwerkskarte hoch, um die Registrierung abzuschließen.
        </p>
      </div>
    )}

    {/* AGB und Datenschutz Checkboxen */}
    <div className="space-y-4 pt-6 border-t border-white/20">
      <h4 className="text-lg font-semibold text-white">Rechtliches</h4>
      
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

      <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={acceptedCommission}
                  onChange={(e) => setAcceptedCommission(e.target.checked)}
                  className="w-5 h-5 min-w-[20px] min-h-[20px] flex-shrink-0 mt-0.5 rounded border-white/30 bg-white/20 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                />
                <span className="text-gray-300 text-sm group-hover:text-white transition-colors">
                  Ich stimme dem automatischen Einzug der{' '}
                  <Link 
                    to="/agb#gebuehren-handwerker" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-teal-400 hover:text-teal-300 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Vermittlungsprovision
                  </Link>{' '}
                  bei verbindlicher Auftragserteilung zu. Die Provision beträgt 3% (bis 10.000€), 2% (10.001-20.000€) bzw. 1,5% (ab 20.001€) der Netto-Auftragssumme. *
                </span>
              </label>
      
      <p className="text-gray-500 text-xs mt-2">
        Weitere Informationen finden Sie auch in unserem{' '}
        <Link to="/disclaimer" target="_blank" className="text-teal-400 hover:text-teal-300 underline">
          Disclaimer / Haftungsausschluss
        </Link>
      </p>
    </div>

    {/* Erfolgshinweis */}
    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
      <p className="text-green-300 text-sm">
        <strong>✓ Fast geschafft!</strong> Nach der Registrierung erhalten Sie eine E-Mail zur Bestätigung Ihrer Adresse.
        Sobald unser Team Ihre Dokumente geprüft hat (1-2 Werktage), können Sie sich anmelden und auf passende Ausschreibungen zugreifen.
      </p>
    </div>
  </div>
)}
            
            {/* Error Message */}
            {error && (
              <div className="mt-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
                >
                  ← Zurück
                </button>
              )}
              
              {step < 5 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
                >
                  Weiter →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !acceptedTerms || !acceptedPrivacy}
                  className={`flex-1 px-6 py-3 rounded-lg shadow-lg font-semibold transition-all ${
                    acceptedTerms && acceptedPrivacy
                      ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white hover:shadow-xl transform hover:scale-[1.02]'
                      : 'bg-gray-500/50 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {loading ? 'Registrierung läuft...' : 'Registrierung abschließen'}
                </button>
              )}
            </div>
            
            {/* Hinweis warum Button deaktiviert */}
            {step === 5 && (!acceptedTerms || !acceptedPrivacy) && (
              <p className="text-gray-400 text-xs text-center mt-4">
                Bitte akzeptieren Sie die AGB und Datenschutzbestimmungen, um fortzufahren.
              </p>
            )}
          </form>
        </div>

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-400">
            Bereits registriert?{' '}
            <Link to="/handwerker/login" className="text-teal-400 hover:text-teal-300 transition-colors">
              Zum Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
