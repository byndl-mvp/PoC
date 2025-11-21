import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

// Helper Components
const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };
  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500', warning: 'bg-orange-500' };

  return (
    <div className={`fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50`}>
      <span className="text-xl">{icons[type]}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">✕</button>
    </div>
  );
};

const SettingsCard = ({ title, description, children, className = '' }) => (
  <div className={`bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10 ${className}`}>
    {title && (
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
      </div>
    )}
    {children}
  </div>
);

const InputField = ({ label, type = 'text', value, onChange, placeholder, error, required = false, disabled = false, helperText, ...props }) => (
  <div className="space-y-1">
    {label && (
      <label className="block text-white/90 text-sm font-medium">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
    )}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full px-3 py-2 bg-white/10 border ${error ? 'border-red-500' : 'border-white/20'} rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 transition-all`}
      {...props}
    />
    {error && <p className="text-red-400 text-xs">{error}</p>}
    {helperText && !error && <p className="text-gray-400 text-xs">{helperText}</p>}
  </div>
);

const ToggleSwitch = ({ label, checked, onChange, description }) => (
  <div className="flex items-start justify-between py-3">
    <div className="flex-1">
      <label className="text-white font-medium cursor-pointer" onClick={() => onChange(!checked)}>{label}</label>
      {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors ${checked ? 'bg-teal-500' : 'bg-gray-600'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  </div>
);
// eslint-disable-next-line no-unused-vars
const SelectField = ({ label, value, onChange, options, error }) => (
  <div className="space-y-1">
    {label && <label className="block text-white/90 text-sm font-medium">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className={`w-full px-3 py-2 bg-white/10 border ${error ? 'border-red-500' : 'border-white/20'} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500`}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
      ))}
    </select>
    {error && <p className="text-red-400 text-xs">{error}</p>}
  </div>
);

// FAQ Component
const FAQItem = ({ question, answer, isExpanded, onToggle }) => (
  <div className="border-b border-white/10 last:border-0">
    <button
      onClick={onToggle}
      className="w-full flex justify-between items-start py-4 text-left hover:bg-white/5 px-4 rounded transition-colors"
    >
      <span className="text-white font-medium pr-4">{question}</span>
      <span className="text-teal-400 text-xl flex-shrink-0">{isExpanded ? '−' : '+'}</span>
    </button>
    {isExpanded && (
      <div className="px-4 pb-4">
        <p className="text-gray-300 text-sm whitespace-pre-line leading-relaxed">{answer}</p>
      </div>
    )}
  </div>
);

// Main Component
export default function BauherrenSettingsPage() {
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [userData, setUserData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFAQs, setExpandedFAQs] = useState([]);
  
  const [personalData, setPersonalData] = useState({
    firstName: '', lastName: '', email: '', phone: '', alternativePhone: '',
    street: '', houseNumber: '', zipCode: '', city: '', state: '',
    country: 'Deutschland', isCompany: false, companyName: '', vatId: '',
    commercialRegister: '', emailVerified: false, profileImage: null
  });
  const [originalPersonalData, setOriginalPersonalData] = useState({});
  
  const [securityData, setSecurityData] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
    twoFactorEnabled: false, showPassword: false, passwordStrength: 0, lastPasswordChange: null
  });

  const [notifications, setNotifications] = useState({
    email: {
      projectUpdates: { newOffer: true, offerAccepted: true, lvGenerated: true, milestone: false },
      tenders: { published: true, deadlineWarning: true, noOffers: false },
      orders: { orderPlaced: true, phaseStarted: true, supplementSubmitted: true, scheduleChange: true },
      messages: { newMessage: true, dailyDigest: false, onlyImportant: false },
      marketing: { productUpdates: false, tips: false, newsletter: false, offers: false }
    },
    push: { enabled: false, criticalOnly: true },
    sms: { enabled: false, criticalOnly: true },
    digest: { enabled: false, frequency: 'daily', time: '08:00', day: 'monday' },
    doNotDisturb: { enabled: false, startTime: '22:00', endTime: '08:00', allowCritical: true }
  });

  const [errors, setErrors] = useState({});

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setInitialLoading(true);
        const storedUserData = sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData');
        const token = sessionStorage.getItem('bauherrToken');
        
        if (!storedUserData || !token) {
          navigate('/bauherr/login');
          return;
        }
        
        const user = JSON.parse(storedUserData);
        setUserData(user);
        
        const res = await fetch(apiUrl(`/api/bauherr/${user.id}/settings`));
        if (res.ok) {
          const data = await res.json();
          
          const personalDataLoaded = {
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            email: data.email || '',
            phone: data.phone || '',
            alternativePhone: data.alternative_phone || '',
            street: data.street || '',
            houseNumber: data.house_number || '',
            zipCode: data.zip || '',
            city: data.city || '',
            state: data.state || '',
            country: data.country || 'Deutschland',
            isCompany: data.is_company || false,
            companyName: data.company_name || '',
            vatId: data.vat_id || '',
            commercialRegister: data.commercial_register || '',
            emailVerified: data.email_verified || false,
            profileImage: data.profile_image || null
          };
          
          setPersonalData(personalDataLoaded);
          setOriginalPersonalData(personalDataLoaded);
          
          setSecurityData(prev => ({
            ...prev,
            twoFactorEnabled: data.two_factor_enabled || false,
            lastPasswordChange: data.last_password_change || null
          }));
          
          if (data.notification_settings) setNotifications(data.notification_settings);
        }
        
      } catch (error) {
        console.error('Error loading settings:', error);
        showToast('Fehler beim Laden der Einstellungen', 'error');
      } finally {
        setInitialLoading(false);
      }
    };
    
    loadInitialData();
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToast = (message, type = 'success') => setToast({ message, type });
  const hideToast = () => setToast(null);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone) => /^[\d\s+\-()]+$/.test(phone) && phone.replace(/\D/g, '').length >= 10;
  const validateZipCode = (zip) => /^\d{5}$/.test(zip);

  const validatePersonalData = () => {
    const newErrors = {};
    if (!personalData.firstName.trim()) newErrors.firstName = 'Vorname ist erforderlich';
    if (!personalData.lastName.trim()) newErrors.lastName = 'Nachname ist erforderlich';
    if (!validateEmail(personalData.email)) newErrors.email = 'Ungültige E-Mail-Adresse';
    if (personalData.phone && !validatePhone(personalData.phone)) newErrors.phone = 'Ungültige Telefonnummer';
    if (personalData.zipCode && !validateZipCode(personalData.zipCode)) newErrors.zipCode = 'PLZ muss 5 Ziffern haben';
    if (personalData.isCompany && !personalData.companyName.trim()) newErrors.companyName = 'Firmenname ist erforderlich';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 20;
    if (/[a-z]/.test(password)) strength += 20;
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[0-9]/.test(password)) strength += 10;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 10;
    return Math.min(strength, 100);
  };

  const savePersonalData = async () => {
    if (!validatePersonalData()) {
      showToast('Bitte korrigieren Sie die Fehler', 'error');
      return false;
    }
    
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/personal`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personalData)
      });
      
      if (res.ok) {
        setOriginalPersonalData(personalData);
        setUnsavedChanges(false);
        showToast('Persönliche Daten gespeichert', 'success');
        return true;
      } else {
        throw new Error('Speichern fehlgeschlagen');
      }
    } catch (error) {
      showToast('Fehler beim Speichern', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    const newErrors = {};
    if (!securityData.currentPassword) newErrors.currentPassword = 'Aktuelles Passwort erforderlich';
    if (!securityData.newPassword) newErrors.newPassword = 'Neues Passwort erforderlich';
    else if (securityData.newPassword.length < 8) newErrors.newPassword = 'Mindestens 8 Zeichen erforderlich';
    if (securityData.newPassword !== securityData.confirmPassword) newErrors.confirmPassword = 'Passwörter stimmen nicht überein';
    
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showToast('Bitte korrigieren Sie die Fehler', 'error');
      return false;
    }
    
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/password`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: securityData.currentPassword,
          newPassword: securityData.newPassword
        })
      });
      
      if (res.ok) {
        setSecurityData(prev => ({
          ...prev,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
          lastPasswordChange: new Date().toISOString()
        }));
        setUnsavedChanges(false);
        showToast('Passwort erfolgreich geändert', 'success');
        return true;
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Passwortänderung fehlgeschlagen');
      }
    } catch (error) {
      showToast(error.message, 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const saveNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/notifications`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifications)
      });
      
      if (res.ok) {
        setUnsavedChanges(false);
        showToast('Benachrichtigungen aktualisiert', 'success');
        return true;
      } else {
        throw new Error('Speichern fehlgeschlagen');
      }
    } catch (error) {
      showToast('Fehler beim Speichern', 'error');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/export`));
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `byndl-daten-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        showToast('Daten erfolgreich exportiert', 'success');
      } else {
        throw new Error('Export fehlgeschlagen');
      }
    } catch (error) {
      showToast('Fehler beim Datenexport', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    const confirmText = 'ACCOUNT LÖSCHEN';
    const userInput = window.prompt(
      `Diese Aktion kann nicht rückgängig gemacht werden. Alle Ihre Daten werden permanent gelöscht.\n\nGeben Sie "${confirmText}" ein, um fortzufahren:`
    );
    
    if (userInput !== confirmText) return;
    
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/delete`), {
        method: 'DELETE'
      });
      
      if (res.ok) {
        sessionStorage.clear();
        showToast('Account wurde gelöscht', 'success');
        setTimeout(() => navigate('/'), 2000);
      } else {
        throw new Error('Löschung fehlgeschlagen');
      }
    } catch (error) {
      showToast('Fehler beim Löschen des Accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  // FAQ Data (gekürzt - vollständige Version siehe Konzept)
  const faqData = {
    'Erste Schritte': [
      {
        question: 'Was ist byndl und wie funktioniert es?',
        answer: `byndl ist Ihre digitale Plattform für Bauprojekte. Wir helfen Ihnen vom ersten Projektgedanken bis zur fertigen Baustelle.

Die Vorteile auf einen Blick:
✓ Zeitersparnis: Keine mühsame LV-Erstellung per Hand
✓ Transparenz: Klare Preise und vergleichbare Angebote  
✓ Sicherheit: VOB-konforme Verträge und geprüfte Handwerker
✓ Unterstützung: KI-gestützte Bewertung und Terminplanung
✓ Alles an einem Ort: Von der Planung bis zur Abnahme`
      },
      {
        question: 'Wie starte ich mein erstes Projekt?',
        answer: `1. Projekt anlegen (5-10 Minuten)
- Projektadresse eingeben
- Kategorien wählen
- Vorhaben beschreiben

2. KI-Gewerkeerkennung (automatisch)
- KI analysiert Ihre Beschreibung
- Erkennt benötigte Gewerke

3. Fragen beantworten (10-30 Min. pro Gewerk)

4. LV-Generierung & Ausschreibung (automatisch)`
      }
    ],
    'Leistungsverzeichnisse': [
      {
        question: 'Was ist ein Leistungsverzeichnis?',
        answer: `Ein Leistungsverzeichnis (LV) ist die detaillierte Auflistung aller Bauleistungen. Es ist die Grundlage für vergleichbare Angebote und verbindliche Verträge.`
      },
      {
        question: 'Kann ich das LV nachträglich ändern?',
        answer: `Ja! Sie können Positionen bearbeiten, löschen oder neue hinzufügen. Nach der Ausschreibung ist das LV fixiert. Änderungen sind dann nur über Nachträge möglich.`
      }
    ],
    'Kosten': [
      {
        question: 'Was kostet byndl?',
        answer: `Einmalige Gebühr pro Projekt:
- 1-2 Gewerke: 29,90 €
- 3-5 Gewerke: 59,90 €
- Ab 6 Gewerken: 99,90 €

KEINE Provisionen, KEINE versteckten Kosten!`
      }
    ],
    'Support': [
      {
        question: 'Wie erreiche ich den Support?',
        answer: `E-Mail: info@byndl.de
Support: support@byndl.de
Telefon: +49 221 / 123 456 789 (Mo-Fr 9-17 Uhr)

Antwort innerhalb 24 Stunden (werktags)`
      }
    ]
  };

  const filteredFAQs = Object.entries(faqData).map(([category, items]) => ({
    category,
    items: items.filter(item => 
      searchQuery === '' || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.items.length > 0);

  const toggleFAQ = (category, index) => {
    const key = `${category}-${index}`;
    setExpandedFAQs(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-white">Lade Einstellungen...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'personal', icon: '👤', label: 'Persönliche Daten' },
    { id: 'security', icon: '🔐', label: 'Sicherheit' },
    { id: 'notifications', icon: '🔔', label: 'Benachrichtigungen' },
    { id: 'payment', icon: '💳', label: 'Zahlungsmethoden' },
    { id: 'appearance', icon: '🎨', label: 'Darstellung' },
    { id: 'privacy', icon: '🔒', label: 'Datenschutz' },
    { id: 'data', icon: '📊', label: 'Meine Daten' },
    { id: 'help', icon: '❓', label: 'Hilfe & Support' },
    { id: 'about', icon: 'ℹ️', label: 'Über byndl' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/bauherr/dashboard')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Zurück zum Dashboard
              </button>
              <h1 className="text-2xl font-bold text-white">Einstellungen</h1>
            </div>
            {unsavedChanges && (
              <div className="flex items-center gap-3">
                <span className="text-orange-400 text-sm">Ungespeicherte Änderungen</span>
                <button
                  onClick={() => {
                    if (activeTab === 'personal') savePersonalData();
                    else if (activeTab === 'security') changePassword();
                    else if (activeTab === 'notifications') saveNotifications();
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-[250px_1fr] gap-6">
          {/* Sidebar Navigation */}
          <div className="space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
                  activeTab === tab.id
                    ? 'bg-teal-500 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="space-y-6">
            {/* PERSONAL DATA SECTION */}
            {activeTab === 'personal' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Persönliche Daten</h2>
                
                {!personalData.emailVerified && (
                  <div className="bg-orange-500/20 border border-orange-500/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-orange-400 text-xl">⚠️</span>
                      <div className="flex-1">
                        <p className="text-orange-300 font-semibold">E-Mail noch nicht verifiziert</p>
                        <p className="text-orange-200 text-sm mt-1">
                          Bitte überprüfen Sie Ihr Postfach und klicken Sie auf den Bestätigungslink.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <SettingsCard title="Kontaktdaten">
                  <div className="grid md:grid-cols-2 gap-4">
                    <InputField
                      label="Vorname"
                      value={personalData.firstName}
                      onChange={(e) => {
                        setPersonalData({ ...personalData, firstName: e.target.value });
                        setUnsavedChanges(true);
                      }}
                      error={errors.firstName}
                      required
                    />
                    <InputField
                      label="Nachname"
                      value={personalData.lastName}
                      onChange={(e) => {
                        setPersonalData({ ...personalData, lastName: e.target.value });
                        setUnsavedChanges(true);
                      }}
                      error={errors.lastName}
                      required
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <InputField
                      label="E-Mail-Adresse"
                      type="email"
                      value={personalData.email}
                      onChange={(e) => {
                        setPersonalData({ ...personalData, email: e.target.value });
                        setUnsavedChanges(true);
                      }}
                      error={errors.email}
                      required
                    />
                    <InputField
                      label="Telefon"
                      type="tel"
                      value={personalData.phone}
                      onChange={(e) => {
                        setPersonalData({ ...personalData, phone: e.target.value });
                        setUnsavedChanges(true);
                      }}
                      error={errors.phone}
                      placeholder="+49 123 456789"
                    />
                  </div>
                </SettingsCard>

                <SettingsCard title="Adresse">
                  <div className="grid md:grid-cols-[1fr_auto] gap-4">
                    <InputField
                      label="Straße"
                      value={personalData.street}
                      onChange={(e) => {
                        setPersonalData({ ...personalData, street: e.target.value });
                        setUnsavedChanges(true);
                      }}
                    />
                    <InputField
                      label="Hausnr."
                      value={personalData.houseNumber}
                      onChange={(e) => {
                        setPersonalData({ ...personalData, houseNumber: e.target.value });
                        setUnsavedChanges(true);
                      }}
                      className="md:w-24"
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-[auto_1fr] gap-4 mt-4">
                    <InputField
                      label="PLZ"
                      value={personalData.zipCode}
                      onChange={(e) => {
                        setPersonalData({ ...personalData, zipCode: e.target.value });
                        setUnsavedChanges(true);
                      }}
                      error={errors.zipCode}
                      maxLength={5}
                      className="md:w-32"
                    />
                    <InputField
                      label="Stadt"
                      value={personalData.city}
                      onChange={(e) => {
                        setPersonalData({ ...personalData, city: e.target.value });
                        setUnsavedChanges(true);
                      }}
                    />
                  </div>
                </SettingsCard>

                <SettingsCard title="Firmendaten (optional)">
                  <ToggleSwitch
                    label="Ich bin ein gewerblicher Bauherr"
                    checked={personalData.isCompany}
                    onChange={(checked) => {
                      setPersonalData({ ...personalData, isCompany: checked });
                      setUnsavedChanges(true);
                    }}
                  />
                  
                  {personalData.isCompany && (
                    <div className="space-y-4 mt-4 pl-4 border-l-2 border-teal-500/30">
                      <InputField
                        label="Firmenname"
                        value={personalData.companyName}
                        onChange={(e) => {
                          setPersonalData({ ...personalData, companyName: e.target.value });
                          setUnsavedChanges(true);
                        }}
                        error={errors.companyName}
                        required
                      />
                      <div className="grid md:grid-cols-2 gap-4">
                        <InputField
                          label="USt-ID"
                          value={personalData.vatId}
                          onChange={(e) => {
                            setPersonalData({ ...personalData, vatId: e.target.value });
                            setUnsavedChanges(true);
                          }}
                          placeholder="DE123456789"
                        />
                        <InputField
                          label="Handelsregisternr."
                          value={personalData.commercialRegister}
                          onChange={(e) => {
                            setPersonalData({ ...personalData, commercialRegister: e.target.value });
                            setUnsavedChanges(true);
                          }}
                          placeholder="HRB 12345"
                        />
                      </div>
                    </div>
                  )}
                </SettingsCard>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setPersonalData(originalPersonalData);
                      setUnsavedChanges(false);
                      setErrors({});
                    }}
                    disabled={!unsavedChanges || loading}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={savePersonalData}
                    disabled={!unsavedChanges || loading}
                    className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Speichern...' : 'Änderungen speichern'}
                  </button>
                </div>
              </div>
            )}

            {/* SECURITY SECTION */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Sicherheit & Anmeldung</h2>
                
                <SettingsCard title="Passwort ändern">
                  {securityData.lastPasswordChange && (
                    <p className="text-gray-400 text-sm mb-4">
                      Zuletzt geändert: {new Date(securityData.lastPasswordChange).toLocaleDateString('de-DE')}
                    </p>
                  )}
                  
                  <div className="space-y-4">
                    <InputField
                      label="Aktuelles Passwort"
                      type={securityData.showPassword ? 'text' : 'password'}
                      value={securityData.currentPassword}
                      onChange={(e) => {
                        setSecurityData({ ...securityData, currentPassword: e.target.value });
                        setUnsavedChanges(true);
                      }}
                      error={errors.currentPassword}
                    />
                    
                    <InputField
                      label="Neues Passwort"
                      type={securityData.showPassword ? 'text' : 'password'}
                      value={securityData.newPassword}
                      onChange={(e) => {
                        const newPass = e.target.value;
                        setSecurityData({
                          ...securityData,
                          newPassword: newPass,
                          passwordStrength: calculatePasswordStrength(newPass)
                        });
                        setUnsavedChanges(true);
                      }}
                      error={errors.newPassword}
                    />
                    
                    {securityData.newPassword && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Passwortstärke</span>
                          <span className={`font-semibold ${
                            securityData.passwordStrength < 40 ? 'text-red-400' :
                            securityData.passwordStrength < 70 ? 'text-orange-400' :
                            'text-green-400'
                          }`}>
                            {securityData.passwordStrength < 40 ? 'Schwach' :
                             securityData.passwordStrength < 70 ? 'Mittel' : 'Stark'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              securityData.passwordStrength < 40 ? 'bg-red-500' :
                              securityData.passwordStrength < 70 ? 'bg-orange-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${securityData.passwordStrength}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    <InputField
                      label="Passwort bestätigen"
                      type={securityData.showPassword ? 'text' : 'password'}
                      value={securityData.confirmPassword}
                      onChange={(e) => {
                        setSecurityData({ ...securityData, confirmPassword: e.target.value });
                        setUnsavedChanges(true);
                      }}
                      error={errors.confirmPassword}
                    />
                    
                    <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={securityData.showPassword}
                        onChange={(e) => setSecurityData({ ...securityData, showPassword: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">Passwort anzeigen</span>
                    </label>
                    
                    <button
                      onClick={changePassword}
                      disabled={loading || !securityData.currentPassword || !securityData.newPassword}
                      className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Ändern...' : 'Passwort ändern'}
                    </button>
                  </div>
                </SettingsCard>

                <SettingsCard title="Zwei-Faktor-Authentifizierung (2FA)">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-semibold">
                        Status: {securityData.twoFactorEnabled ? (
                          <span className="text-green-400">✓ Aktiviert</span>
                        ) : (
                          <span className="text-gray-400">Inaktiv</span>
                        )}
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        Erhöhen Sie die Sicherheit Ihres Accounts mit 2FA
                      </p>
                    </div>
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* NOTIFICATIONS SECTION */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Benachrichtigungen</h2>
                
                <SettingsCard title="E-Mail-Benachrichtigungen">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-white font-semibold mb-2">Projekt-Updates</h4>
                      <ToggleSwitch
                        label="Neues Angebot eingegangen"
                        checked={notifications.email.projectUpdates.newOffer}
                        onChange={(checked) => {
                          setNotifications({
                            ...notifications,
                            email: {
                              ...notifications.email,
                              projectUpdates: { ...notifications.email.projectUpdates, newOffer: checked }
                            }
                          });
                          setUnsavedChanges(true);
                        }}
                      />
                      <ToggleSwitch
                        label="Angebot akzeptiert/abgelehnt"
                        checked={notifications.email.projectUpdates.offerAccepted}
                        onChange={(checked) => {
                          setNotifications({
                            ...notifications,
                            email: {
                              ...notifications.email,
                              projectUpdates: { ...notifications.email.projectUpdates, offerAccepted: checked }
                            }
                          });
                          setUnsavedChanges(true);
                        }}
                      />
                    </div>

                    <div>
                      <h4 className="text-white font-semibold mb-2">Aufträge</h4>
                      <ToggleSwitch
                        label="Auftrag wurde erteilt"
                        checked={notifications.email.orders.orderPlaced}
                        onChange={(checked) => {
                          setNotifications({
                            ...notifications,
                            email: {
                              ...notifications.email,
                              orders: { ...notifications.email.orders, orderPlaced: checked }
                            }
                          });
                          setUnsavedChanges(true);
                        }}
                      />
                      <ToggleSwitch
                        label="Nachtrag eingereicht"
                        checked={notifications.email.orders.supplementSubmitted}
                        onChange={(checked) => {
                          setNotifications({
                            ...notifications,
                            email: {
                              ...notifications.email,
                              orders: { ...notifications.email.orders, supplementSubmitted: checked }
                            }
                          });
                          setUnsavedChanges(true);
                        }}
                      />
                    </div>
                  </div>
                </SettingsCard>

                <div className="flex justify-end">
                  <button
                    onClick={saveNotifications}
                    disabled={!unsavedChanges || loading}
                    className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Speichern...' : 'Änderungen speichern'}
                  </button>
                </div>
              </div>
            )}

            {/* PAYMENT, APPEARANCE, PRIVACY - Placeholders */}
            {(activeTab === 'payment' || activeTab === 'appearance' || activeTab === 'privacy') && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">
                  {activeTab === 'payment' && 'Zahlungsmethoden'}
                  {activeTab === 'appearance' && 'Darstellung & Sprache'}
                  {activeTab === 'privacy' && 'Datenschutz & Privatsphäre'}
                </h2>
                <SettingsCard>
                  <p className="text-gray-400">Dieser Bereich wird noch implementiert.</p>
                </SettingsCard>
              </div>
            )}

            {/* DATA SECTION */}
            {activeTab === 'data' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Meine Daten & Downloads</h2>
                
                <SettingsCard title="Datenexport (DSGVO Art. 15)">
                  <p className="text-gray-400 text-sm mb-4">
                    Laden Sie alle Ihre gespeicherten Daten herunter. Der Export enthält alle Projekte, LVs, Nachrichten, Verträge und mehr.
                  </p>
                  
                  <button
                    onClick={exportData}
                    disabled={loading}
                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Exportiere...' : 'Daten exportieren'}
                  </button>
                </SettingsCard>

                <SettingsCard title="Account löschen" className="bg-red-500/10 border-red-500/30">
                  <p className="text-gray-300 text-sm mb-4">
                    Diese Aktion kann nicht rückgängig gemacht werden. Alle Ihre Daten werden permanent gelöscht.
                  </p>
                  <button
                    onClick={deleteAccount}
                    disabled={loading}
                    className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Account unwiderruflich löschen
                  </button>
                </SettingsCard>
              </div>
            )}

            {/* HELP SECTION */}
            {activeTab === 'help' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Hilfe & Support</h2>
                
                <SettingsCard>
                  <InputField
                    label="FAQ durchsuchen"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Frage oder Stichwort eingeben..."
                  />
                </SettingsCard>

                {filteredFAQs.map(({ category, items }) => (
                  <SettingsCard key={category} title={category}>
                    {items.map((item, idx) => (
                      <FAQItem
                        key={idx}
                        question={item.question}
                        answer={item.answer}
                        isExpanded={expandedFAQs.includes(`${category}-${idx}`)}
                        onToggle={() => toggleFAQ(category, idx)}
                      />
                    ))}
                  </SettingsCard>
                ))}

                <SettingsCard title="Support kontaktieren">
                  <div className="space-y-3">
                    <a href="mailto:info@byndl.de" className="flex items-center gap-3 text-teal-400 hover:text-teal-300">
                      <span>📧</span>
                      <span>info@byndl.de</span>
                    </a>
                    <a href="mailto:support@byndl.de" className="flex items-center gap-3 text-teal-400 hover:text-teal-300">
                      <span>📧</span>
                      <span>support@byndl.de</span>
                    </a>
                    <p className="flex items-center gap-3 text-gray-300">
                      <span>📞</span>
                      <span>+49 221 / 123 456 789 (Mo-Fr 9-17 Uhr)</span>
                    </p>
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* ABOUT SECTION */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Über byndl</h2>
                
                <SettingsCard title="byndl Web App">
                  <div className="space-y-3 text-gray-300">
                    <p><strong>Version:</strong> 2.4.1</p>
                    <p><strong>Letztes Update:</strong> 15.11.2024</p>
                    <p className="text-sm mt-4">
                      byndl ist Ihre digitale Plattform für Bauprojekte - von der Planung bis zur Abnahme.
                    </p>
                  </div>
                </SettingsCard>

                <SettingsCard title="Rechtliches">
                  <div className="space-y-2">
                    <a href="/agb" className="block text-teal-400 hover:text-teal-300">Allgemeine Geschäftsbedingungen</a>
                    <a href="/datenschutz" className="block text-teal-400 hover:text-teal-300">Datenschutzerklärung</a>
                    <a href="/impressum" className="block text-teal-400 hover:text-teal-300">Impressum</a>
                  </div>
                </SettingsCard>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
