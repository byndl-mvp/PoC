import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

// Exakte Gewerke aus der PostgreSQL Datenbank mit Code-Abkürzungen
const AVAILABLE_TRADES = [
  { id: 'AUSS', name: 'Außenanlagen / GaLaBau', dbId: 1 },
  { id: 'BOD', name: 'Bodenbelagsarbeiten', dbId: 2 },
  { id: 'DACH', name: 'Dachdeckerarbeiten', dbId: 3 },
  { id: 'ELEKT', name: 'Elektroinstallation', dbId: 4 },
  { id: 'ESTR', name: 'Estricharbeiten', dbId: 5 },
  { id: 'FASS', name: 'Fassadenbau / -sanierung', dbId: 6 },
  { id: 'FEN', name: 'Fenster & Türen', dbId: 7 },
  { id: 'FLI', name: 'Fliesen- und Plattenarbeiten', dbId: 8 },
  { id: 'GER', name: 'Gerüstbau', dbId: 9 },
  { id: 'HEI', name: 'Heizungsinstallation', dbId: 10 },
  { id: 'MAL', name: 'Maler- & Lackierarbeiten', dbId: 11 },
  { id: 'ROH', name: 'Rohbau / Mauer- & Betonarbeiten', dbId: 12 },
  { id: 'SAN', name: 'Sanitärinstallation', dbId: 13 },
  { id: 'SCHL', name: 'Schlosser- / Metallbau', dbId: 14 },
  { id: 'TIS', name: 'Tischler / Innenausbau', dbId: 15 },
  { id: 'TRO', name: 'Trockenbau', dbId: 16 },
  { id: 'ABBR', name: 'Abbruch / Entkernung', dbId: 19 },
  { id: 'KLIMA', name: 'Lüftung- und Klimatechnik', dbId: 22 },
  { id: 'PV', name: 'Photovoltaik/Solartechnik', dbId: 23 },
  { id: 'ZIMM', name: 'Zimmerer / Holzbau', dbId: 25 }
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
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Firmendaten
    companyName: '',
    companyType: '',
    registrationNumber: '',
    taxNumber: '',
    // Kontaktdaten
    contactPerson: '',
    email: '',
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTradeToggle = (tradeId) => {
    setFormData(prev => ({
      ...prev,
      trades: prev.trades.includes(tradeId)
        ? prev.trades.filter(t => t !== tradeId)
        : [...prev.trades, tradeId]
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
      if (!formData.companyName || !formData.contactPerson || !formData.email || !formData.phone) {
        setError('Bitte füllen Sie alle Pflichtfelder aus.');
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
        return false;
      }
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
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
      // Datum darf nicht in der Vergangenheit liegen
      const selectedDate = new Date(formData.availableFrom);
      const today = new Date();
      today.setHours(0,0,0,0);
      if (selectedDate < today) {
        setError('Das Verfügbarkeitsdatum kann nicht in der Vergangenheit liegen.');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep()) return;
    
    setLoading(true);
    setError('');

    try {
      // Generiere Betriebs-ID
      const companyId = generateCompanyId();
      
      const submitData = {
        ...formData,
        companyId,
        registeredAt: new Date().toISOString()
      };

      const res = await fetch(apiUrl('/api/handwerker/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (res.ok) {
        const data = await res.json();
        
        // Speichere Handwerker-Daten in Session
        sessionStorage.setItem('handwerkerData', JSON.stringify({
          companyName: formData.companyName,
          email: formData.email,
          companyId: data.companyId || companyId,
          trades: formData.trades,
          region: `${formData.zipCode} ${formData.city}`,
          actionRadius: formData.actionRadius
        }));
        
        // Zeige Erfolgs-Modal mit Betriebs-ID
        alert(`✅ Registrierung erfolgreich!\n\nIhre Betriebs-ID: ${data.companyId || companyId}\n\n⚠️ WICHTIG: Bitte notieren Sie sich diese ID für den Login!\n\nSie werden nun zum Dashboard weitergeleitet.`);
        
        navigate('/handwerker/dashboard');
      } else {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Registrierung fehlgeschlagen');
      }
    } catch (err) {
      console.error('Registrierungsfehler:', err);
      setError(err.message || 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <h1 className="text-4xl font-bold text-white hover:text-teal-400 transition-colors">byndl</h1>
          </Link>
          <h2 className="text-2xl text-white">Handwerker-Registrierung</h2>
          <p className="text-gray-300 mt-2">Werden Sie Teil des byndl-Netzwerks</p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-between items-center mb-8 max-w-md mx-auto">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                s < step ? 'bg-teal-600 text-white' :
                s === step ? 'bg-teal-500 text-white' : 
                'bg-white/20 text-white/60'
              }`}>
                {s < step ? '✓' : s}
              </div>
              {s < 4 && <div className={`w-full h-0.5 ${s < step ? 'bg-teal-600' : 'bg-white/20'}`}></div>}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit}>
            
            {/* Step 1: Firmendaten */}
            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white mb-4">Schritt 1: Firmendaten</h3>
                
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
                  
                  <div>
                    <label className="block text-white font-medium mb-2">Ansprechpartner *</label>
                    <input
                      type="text"
                      name="contactPerson"
                      value={formData.contactPerson}
                      onChange={handleChange}
                      placeholder="Max Mustermann"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-white font-medium mb-2">E-Mail *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="info@handwerk.de"
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
                      placeholder="0221 123456"
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
                      placeholder="www.handwerk.de"
                      className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Firmenadresse */}
            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white mb-4">Schritt 2: Firmensitz</h3>
                
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
                    <label className="block text-white font-medium mb-2">Ort *</label>
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
                    <strong>ℹ️ Wichtig:</strong> Der Firmensitz ist entscheidend für das regionale Matching mit Bauherren-Projekten.
                  </p>
                </div>
              </div>
            )}

            {/* Step 3: Gewerke & Matching */}
            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white mb-4">Schritt 3: Gewerke & Einsatzbereich</h3>
                
                {/* Gewerke-Auswahl */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Ihre Gewerke * <span className="text-gray-400 text-sm">(Mehrfachauswahl möglich)</span>
                  </label>
                  <div className="bg-white/10 rounded-lg p-4 max-h-60 overflow-y-auto grid md:grid-cols-2 gap-2">
                    {AVAILABLE_TRADES.map(trade => (
                      <label
                        key={trade.id}
                        className="flex items-center text-white hover:bg-white/10 rounded p-2 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.trades.includes(trade.id)}
                          onChange={() => handleTradeToggle(trade.id)}
                          className="mr-3 w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
                        />
                        <span>{trade.name}</span>
                      </label>
                    ))}
                  </div>
                  {formData.trades.length > 0 && (
                    <p className="text-teal-300 text-sm mt-2">
                      {formData.trades.length} Gewerk(e) ausgewählt
                    </p>
                  )}
                </div>

                {/* Aktionsradius */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Aktionsradius: {formData.actionRadius} km
                  </label>
                  <input
                    type="range"
                    name="actionRadius"
                    value={formData.actionRadius}
                    onChange={handleChange}
                    min="5"
                    max="100"
                    className="w-full"
                  />
                  <div className="flex justify-between text-gray-400 text-sm">
                    <span>5 km (nur lokal)</span>
                    <span>100 km (überregional)</span>
                  </div>
                </div>

                {/* Max. Projektvolumen */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Max. Projektvolumen je Auftrag
                  </label>
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

                {/* Verfügbarkeit */}
                <div>
                  <label className="block text-white font-medium mb-2">
                    Verfügbar für Aufträge ab *
                  </label>
                  <input
                    type="date"
                    name="availableFrom"
                    value={formData.availableFrom}
                    onChange={handleChange}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    required
                  />
                  <p className="text-gray-400 text-xs mt-1">
                    Ab diesem Datum können Sie Aufträge über die Plattform annehmen
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Zusätzliche Informationen */}
            {step === 4 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-white mb-4">Schritt 4: Qualifikationen & Versicherungen</h3>
                
                {/* Mitarbeiterzahl */}
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

                {/* Versicherungen */}
                <div>
                  <label className="block text-white font-medium mb-2">Versicherungen</label>
                  <div className="space-y-2">
                    {['Betriebshaftpflicht', 'Berufshaftpflicht', 'Baugewährleistungsversicherung'].map(insurance => (
                      <label key={insurance} className="flex items-center text-white">
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

                {/* Zertifizierungen */}
                <div>
                  <label className="block text-white font-medium mb-2">Zertifizierungen & Qualifikationen</label>
                  <div className="bg-white/10 rounded-lg p-4 max-h-40 overflow-y-auto grid md:grid-cols-2 gap-2">
                    {CERTIFICATIONS.map(cert => (
                      <label key={cert} className="flex items-center text-white">
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

                {/* Referenzen */}
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
                  <p className="text-gray-400 text-xs mt-1">
                    Referenzen erhöhen Ihre Chancen auf Aufträge erheblich
                  </p>
                </div>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-green-300 text-sm">
                    <strong>✓ Fast geschafft!</strong> Nach der Registrierung erhalten Sie Ihre Betriebs-ID und können sofort auf passende Ausschreibungen zugreifen.
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
              
              {step < 4 ? (
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
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold disabled:opacity-50"
                >
                  {loading ? 'Registrierung läuft...' : 'Registrierung abschließen'}
                </button>
              )}
            </div>
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
