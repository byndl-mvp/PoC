import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix für Leaflet Marker Icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function HandwerkerSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('firmendaten');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false); // DIESE ZEILE HINZUFÜGEN
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [ratingSummary, setRatingSummary] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [showAllRatings, setShowAllRatings] = useState(false);
  const [profileStats, setProfileStats] = useState({
  activeOrders: 0,
  completedOrders: 0,
  totalRevenue: 0,
  createdAt: null
 });
  
  // HIER NEU:
  const [documents, setDocuments] = useState({
    gewerbeschein: null,
    handwerkskarte: null,
    others: []
  });

  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  
  const [handwerkerData, setHandwerkerData] = useState(null);
  const [formData, setFormData] = useState({
    // Firmendaten
    companyName: '',
    email: '',
    phone: '',
    street: '',
    houseNumber: '',
    zipCode: '',
    city: '',
    website: '',

    // NEU: Ansprechpartner mit Vorname/Nachname getrennt
    contactFirstName: '',
    contactLastName: '',
    contactPerson: '', // Für Rückwärtskompatibilität
     
    // Gewerke
    trades: [],
    
    // Einsatzgebiet
    actionRadius: 25,
    excludedAreas: [],
    
    // Verfügbarkeit
    vacationDates: [],
    earliestStart: '',
    capacity: 100,
    
    // Preise
    minOrderValue: '',
    travelCostPerKm: 0.50,
    hourlyRates: {},
    
    // Benachrichtigungen
    emailNotifications: true,
    smsNotifications: false,
    newsletterSubscribed: false,
    
    // Zahlungsdaten
    bankIban: '',
    bankBic: '',
    paymentTerms: 'Netto 30 Tage',
    invoiceAddress: '',
    
    // Account
    twoFactorEnabled: false,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

useEffect(() => {
  const storedData = sessionStorage.getItem('handwerkerData');
  if (!storedData) {
    navigate('/handwerker/login');
    return;
  }
  
  const data = JSON.parse(storedData);
  setHandwerkerData(data);
  loadSettings(data.id || data.companyId);
  // loadDocuments() kann hier noch nicht aufgerufen werden, da handwerkerData noch null ist
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [navigate]);

// Separater useEffect für loadDocuments
useEffect(() => {
  if (handwerkerData) {
    loadDocuments();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [handwerkerData]);

// Stats laden wenn Profil-Tab aktiv
useEffect(() => {
  const loadStats = async () => {
    if (!handwerkerData?.id) return;
    
    try {
      const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/stats`));
      if (res.ok) {
        const data = await res.json();
        setProfileStats({
          activeOrders: data.activeOrders,
          completedOrders: data.completedOrders,
          totalRevenue: data.totalRevenue,
          createdAt: data.createdAt
        });
      }
    } catch (err) {
      console.error('Stats laden fehlgeschlagen:', err);
    }
  };

  if (activeTab === 'profil') {
    loadStats();
  }
}, [activeTab, handwerkerData?.id]);
  
useEffect(() => {
  const loadRatings = async () => {
    if (!handwerkerData?.id) return;
    
    try {
      setLoadingRatings(true);
      
      // Bewertungssummary laden
      const summaryRes = await fetch(
        apiUrl(`/api/handwerker/${handwerkerData.id}/ratings-summary`),
        {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
          }
        }
      );
      
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setRatingSummary(summaryData);
      }
      
      // Detaillierte Bewertungen laden
      const ratingsRes = await fetch(
        apiUrl(`/api/handwerker/${handwerkerData.id}/ratings`),
        {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
          }
        }
      );
      
      if (ratingsRes.ok) {
        const ratingsData = await ratingsRes.json();
        setRatings(ratingsData);
      }
      
    } catch (err) {
      console.error('Fehler beim Laden der Bewertungen:', err);
    } finally {
      setLoadingRatings(false);
    }
  };

  const loadProfileStats = async () => {
    if (!handwerkerData?.id) return;
    
    try {
      const res = await fetch(
        apiUrl(`/api/handwerker/${handwerkerData.id}/stats`),
        {
          headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
          }
        }
      );
      
      if (res.ok) {
        const stats = await res.json();
        setProfileStats({
          activeOrders: stats.activeOrders || 0,
          completedOrders: stats.completedOrders || 0,
          totalRevenue: stats.totalRevenue 
            ? `${parseFloat(stats.totalRevenue).toLocaleString('de-DE')} €` 
            : '0 €'
        });
      }
    } catch (err) {
      console.error('Fehler beim Laden der Statistiken:', err);
    }
  };

  if (activeTab === 'profil' && handwerkerData?.id) {
    loadRatings();
    loadProfileStats();
  }
}, [activeTab, handwerkerData?.id]);
  
 const loadSettings = async (handwerkerId) => {
  try {
    setLoading(true);
    
    // Settings laden
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerId}/settings`), {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
      }
    });
    
    if (res.ok) {
      const settings = await res.json();
      
      setFormData(prev => ({
        ...prev,
        ...settings,
        // NEU: contactFirstName und contactLastName - Backend liefert jetzt direkt
        contactFirstName: settings.contactFirstName || 
                         (settings.contactPerson ? settings.contactPerson.split(' ')[0] : ''),
        contactLastName: settings.contactLastName || 
                        (settings.contactPerson ? settings.contactPerson.split(' ').slice(1).join(' ') : ''),
        contactPerson: settings.contactPerson || '',
        // Restliche Felder
        companyName: settings.companyName || '',
        email: settings.email || '',
        phone: settings.phone || '',
        website: settings.website || '',
        street: settings.street || '',
        houseNumber: settings.houseNumber || '',
        zipCode: settings.zipCode || '',
        city: settings.city || '',
        companyType: settings.companyType || '',
        registrationNumber: settings.registrationNumber || '',
        taxNumber: settings.taxNumber || '',
        actionRadius: settings.actionRadius || 25,
        // NEU: Verifizierungs- und AGB-Status
        emailVerified: settings.emailVerified || false,
        emailVerifiedAt: settings.emailVerifiedAt || null,
        acceptedTermsAt: settings.acceptedTermsAt || null,
        acceptedPrivacyAt: settings.acceptedPrivacyAt || null
      }));
    }
    
    // Gewerke laden
    const tradesRes = await fetch(apiUrl(`/api/handwerker/${handwerkerId}/trades`), {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
      }
    });
    
    if (tradesRes.ok) {
      const tradesData = await tradesRes.json();
      setFormData(prev => ({
        ...prev,
        trades: tradesData.trades || []
      }));
    }
    
  } catch (err) {
    console.error('Fehler beim Laden der Einstellungen:', err);
  } finally {
    setLoading(false);
  }
};

 const handleSave = async (section) => {
  try {
    setSaving(true);
    setLoading(true);
    setError('');
    
    // Map Frontend-Namen zu Backend-Endpoints
    const endpointMap = {
      'einsatzgebiet': 'einsatzgebiet',
      'einzugsgebiet': 'einsatzgebiet',
      'coverage': 'einsatzgebiet',  
      'dokumente': 'documents',
      'firmendaten': 'firmendaten',
      'verfuegbarkeit': 'verfuegbarkeit',
      'preise': 'preise',
      'benachrichtigungen': 'benachrichtigungen',
      'zahlungsdaten': 'zahlungsdaten',
      'account': 'account'
    };
    
    // Bei firmendaten: contactPerson aus Vorname/Nachname generieren
    let dataToSend = { ...formData };
    if (section === 'firmendaten') {
      dataToSend.contactPerson = `${formData.contactFirstName || ''} ${formData.contactLastName || ''}`.trim();
      dataToSend.contactFirstName = formData.contactFirstName || '';
      dataToSend.contactLastName = formData.contactLastName || '';
    }
    
    const endpointSection = endpointMap[section] || section;
    const endpoint = `/api/handwerker/${handwerkerData.id || handwerkerData.companyId}/${endpointSection}`;
    
    const res = await fetch(apiUrl(endpoint), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
      },
      body: JSON.stringify(dataToSend)
    });
    
    if (res.ok) {
      // Session Storage aktualisieren bei firmendaten
      if (section === 'firmendaten') {
        const updatedData = {
          ...handwerkerData,
          companyName: formData.companyName,
          contactPerson: dataToSend.contactPerson,
          contactFirstName: formData.contactFirstName,
          contactLastName: formData.contactLastName,
          email: formData.email,
          phone: formData.phone
        };
        sessionStorage.setItem('handwerkerData', JSON.stringify(updatedData));
      }
      
      setMessage('Einstellungen gespeichert!');
      setTimeout(() => setMessage(''), 3000);
    } else {
      throw new Error('Speichern fehlgeschlagen');
    }
  } catch (err) {
    setError('Fehler beim Speichern');
  } finally {
    setSaving(false);
    setLoading(false);
  }
};

  const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append('document', file);
  
  let docType = 'other';
  if (file.name.toLowerCase().includes('gewerbe')) {
    docType = 'gewerbeschein';
  } else if (file.name.toLowerCase().includes('handwerk')) {
    docType = 'handwerkskarte';
  }
  
  formData.append('document_type', docType);
  
  try {
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/documents/upload`), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
      },
      body: formData
    });
    
    if (res.ok) {
      setMessage('Dokument erfolgreich hochgeladen');
      loadDocuments();
    } else {
      setError('Upload fehlgeschlagen');
    }
  } catch (err) {
    setError('Upload-Fehler: ' + err.message);
  }
};

const downloadDocument = async (docId) => {
  try {
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/documents/${docId}`), {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
      }
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dokument_${docId}.pdf`;
      a.click();
    }
  } catch (err) {
    setError('Download fehlgeschlagen');
  }
};

const deleteDocument = async (docId, docType) => {
  if (!window.confirm('Dokument wirklich löschen?')) return;
  
  try {
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/documents/${docId}`), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
      }
    });
    
    if (res.ok) {
      setMessage('Dokument gelöscht');
      loadDocuments();
    }
  } catch (err) {
    setError('Löschen fehlgeschlagen');
  }
};

const loadDocuments = async () => {
  try {
    if (!handwerkerData) return;
    
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/documents`), {
      headers: {
        'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      setDocuments({
        gewerbeschein: data.find(d => d.document_type === 'gewerbeschein'),
        handwerkskarte: data.find(d => d.document_type === 'handwerkskarte'),
        others: data.filter(d => !['gewerbeschein', 'handwerkskarte'].includes(d.document_type))
      });
    }
  } catch (err) {
    console.error('Fehler beim Laden der Dokumente:', err);
  }
};
  
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const tabs = [
    { id: 'profil', label: 'Mein Profil', icon: '👤' }, // NEU
    { id: 'gewerke', label: 'Meine Gewerke', icon: '🔧' },
    { id: 'firmendaten', label: 'Firmendaten', icon: '🏢' },
    { id: 'einsatzgebiet', label: 'Einsatzgebiet', icon: '📍' },
    { id: 'verfuegbarkeit', label: 'Verfügbarkeit', icon: '📅' },
    { id: 'preise', label: 'Preise', icon: '💰' },
    { id: 'benachrichtigungen', label: 'Benachrichtigungen', icon: '🔔' },
    { id: 'zahlungsdaten', label: 'Zahlungsdaten', icon: '🏦' },
    { id: 'dokumente', label: 'Dokumente', icon: '📄' },
    { id: 'account', label: 'Account', icon: '⚙️' },
    { id: 'hilfe', label: 'Hilfe & Feedback', icon: '💬' }
  ];

  const handlePasswordChange = async () => {
  if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
    setError('Bitte füllen Sie alle Passwortfelder aus');
    return;
  }
  
  if (formData.newPassword !== formData.confirmPassword) {
    setError('Die neuen Passwörter stimmen nicht überein');
    return;
  }
  
  if (formData.newPassword.length < 8) {
    setError('Das neue Passwort muss mindestens 8 Zeichen lang sein');
    return;
  }
  
  try {
    setSaving(true);
    setError('');
    
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/password`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
      },
      body: JSON.stringify({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword
      })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      setMessage('Passwort erfolgreich geändert');
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }));
      setTimeout(() => setMessage(''), 3000);
    } else {
      setError(data.error || 'Passwortänderung fehlgeschlagen');
    }
  } catch (err) {
    setError('Fehler beim Ändern des Passworts');
  } finally {
    setSaving(false);
  }
};

const handleSaveTwoFactor = async (enabled) => {
  try {
    setSaving(true);
    
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/two-factor`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
      },
      body: JSON.stringify({ twoFactorEnabled: enabled })
    });
    
    if (res.ok) {
      setMessage(enabled ? '2FA aktiviert' : '2FA deaktiviert');
      setTimeout(() => setMessage(''), 3000);
    }
  } catch (err) {
    setError('Fehler beim Ändern der 2FA-Einstellung');
  } finally {
    setSaving(false);
  }
};

const handleAccountDelete = async () => {
  if (!deletePassword) {
    setError('Bitte geben Sie Ihr Passwort ein');
    return;
  }
  
  if (!window.confirm('Sind Sie WIRKLICH sicher? Diese Aktion kann nicht rückgängig gemacht werden!')) {
    return;
  }
  
  try {
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/account`), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
      },
      body: JSON.stringify({ password: deletePassword })
    });
    
    if (res.ok) {
      sessionStorage.clear();
      localStorage.clear();
      navigate('/');
    } else {
      const data = await res.json();
      setError(data.error || 'Account-Löschung fehlgeschlagen');
    }
  } catch (err) {
    setError('Fehler beim Löschen des Accounts');
  }
};

// Logo hochladen
const handleLogoUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  // Validierung
  if (!file.type.startsWith('image/')) {
    alert('Bitte nur Bilddateien hochladen');
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) {
    alert('Datei ist zu groß (max. 5MB)');
    return;
  }
  
  const formDataUpload = new FormData();
  formDataUpload.append('logo', file);
  
  try {
    setLoading(true);
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/logo`), {
      method: 'POST',
      body: formDataUpload
    });
    
    if (res.ok) {
      const data = await res.json();
      setFormData(prev => ({ ...prev, logoUrl: data.logoUrl }));
      setMessage('Logo erfolgreich hochgeladen');
      setTimeout(() => setMessage(''), 3000);
    } else {
      throw new Error('Upload fehlgeschlagen');
    }
  } catch (err) {
    setError('Fehler beim Hochladen des Logos');
  } finally {
    setLoading(false);
  }
};

// Logo löschen
const handleLogoDelete = async () => {
  if (!window.confirm('Logo wirklich entfernen?')) return;
  
  try {
    setLoading(true);
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/logo`), {
      method: 'DELETE'
    });
    
    if (res.ok) {
      setFormData(prev => ({ ...prev, logoUrl: null }));
      setMessage('Logo entfernt');
      setTimeout(() => setMessage(''), 3000);
    }
  } catch (err) {
    setError('Fehler beim Löschen des Logos');
  } finally {
    setLoading(false);
  }
};

// Feedback senden
const sendFeedback = async () => {
  if (!feedbackText.trim()) {
    setError('Bitte geben Sie ein Feedback ein');
    setTimeout(() => setError(''), 3000);
    return;
  }
  
  try {
    setFeedbackLoading(true);
    setError('');
    const storedData = sessionStorage.getItem('handwerkerData');
    const userData = JSON.parse(storedData);
    
    const res = await fetch(apiUrl('/api/feedback'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userData.id,
        userName: userData.companyName || formData.companyName,
        userEmail: userData.email || formData.email,
        userType: 'handwerker',
        feedbackText: feedbackText
      })
    });
    
    if (res.ok) {
      setMessage('Vielen Dank für Ihr Feedback! Wir haben Ihre Nachricht erhalten und Sie bekommen eine Bestätigung per E-Mail.');
      setFeedbackText('');
      setTimeout(() => setMessage(''), 5000);
    } else {
      throw new Error('Senden fehlgeschlagen');
    }
  } catch (err) {
    setError('Fehler beim Senden des Feedbacks. Bitte versuchen Sie es später erneut.');
    setTimeout(() => setError(''), 5000);
  } finally {
    setFeedbackLoading(false);
  }
};
  
  // Passwort-Stärke-Funktionen
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
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/handwerker/dashboard" className="text-white hover:text-teal-400">
                ← Zurück zum Dashboard
              </Link>
            </div>
            <h1 className="text-xl font-bold text-white">Einstellungen</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-teal-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-4 bg-green-500/20 border border-green-500/50 rounded-lg p-4">
            <p className="text-green-300">{message}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          
          {/* Firmendaten Tab */}
{activeTab === 'firmendaten' && (
  <div className="space-y-4">
    <h2 className="text-2xl font-bold text-white mb-4">Firmendaten</h2>
    
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <label className="block text-white font-medium mb-2">Firmenname</label>
        <input
          type="text"
          value={formData.companyName}
          onChange={(e) => handleChange('companyName', e.target.value)}
          className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
        />
      </div>
      
      <div>
        <label className="block text-white font-medium mb-2">E-Mail</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
        />
      </div>
      
      {/* NEU: Ansprechpartner aufgeteilt in Vorname und Nachname */}
      <div>
        <label className="block text-white font-medium mb-2">Ansprechpartner Vorname *</label>
        <input
          type="text"
          value={formData.contactFirstName || ''}
          onChange={(e) => handleChange('contactFirstName', e.target.value)}
          placeholder="Vorname"
          className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/50"
        />
      </div>
      
      <div>
        <label className="block text-white font-medium mb-2">Ansprechpartner Nachname *</label>
        <input
          type="text"
          value={formData.contactLastName || ''}
          onChange={(e) => handleChange('contactLastName', e.target.value)}
          placeholder="Nachname"
          className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/50"
        />
      </div>
      
      <div>
        <label className="block text-white font-medium mb-2">Telefon</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
        />
      </div>
      
      <div>
        <label className="block text-white font-medium mb-2">Website</label>
        <input
          type="url"
          value={formData.website}
          onChange={(e) => handleChange('website', e.target.value)}
          placeholder="https://www.beispiel.de"
          className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/50"
        />
      </div>
    </div>
    
    <div className="grid md:grid-cols-4 gap-4">
      <div className="md:col-span-2">
        <label className="block text-white font-medium mb-2">Straße</label>
        <input
          type="text"
          value={formData.street}
          onChange={(e) => handleChange('street', e.target.value)}
          className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
        />
      </div>
      
      <div>
        <label className="block text-white font-medium mb-2">Hausnummer</label>
        <input
          type="text"
          value={formData.houseNumber}
          onChange={(e) => handleChange('houseNumber', e.target.value)}
          className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
        />
      </div>
      
      <div>
        <label className="block text-white font-medium mb-2">PLZ</label>
        <input
          type="text"
          value={formData.zipCode}
          onChange={(e) => handleChange('zipCode', e.target.value)}
          className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
        />
      </div>
      
      <div className="md:col-span-2">
        <label className="block text-white font-medium mb-2">Stadt</label>
        <input
          type="text"
          value={formData.city}
          onChange={(e) => handleChange('city', e.target.value)}
          className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
        />
      </div>
    </div>
    
    <button
      onClick={() => handleSave('firmendaten')}
      disabled={loading}
      className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Speichern...' : 'Speichern'}
    </button>
  </div>
)}

{/* Mein Profil Tab */}
    {activeTab === 'profil' && (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white mb-4">Mein Profil</h2>
        
{/* Profil Header */}
<div className="bg-white/5 rounded-lg p-6">
  <div className="flex items-center gap-6 mb-6">
    {/* Logo mit Upload-Funktion */}
    <div className="relative group">
      <div className="w-24 h-24 bg-gradient-to-br from-teal-500 to-teal-700 rounded-full flex items-center justify-center shadow-lg overflow-hidden">
        {formData.logoUrl ? (
          <img 
            src={apiUrl(formData.logoUrl)} 
            alt="Firmenlogo" 
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-4xl">🏢</span>
        )}
      </div>
      
      {/* Upload Overlay */}
      <label className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
        <input
          type="file"
          accept="image/*"
          onChange={handleLogoUpload}
          className="hidden"
        />
        <span className="text-white text-xs text-center px-2">
          {formData.logoUrl ? '📷 Ändern' : '📷 Logo hochladen'}
        </span>
      </label>
      
      {/* Löschen Button (nur wenn Logo vorhanden) */}
      {formData.logoUrl && (
        <button
          onClick={handleLogoDelete}
          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          title="Logo entfernen"
        >
          ✕
        </button>
      )}
    </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-white">{formData.companyName || handwerkerData?.companyName}</h3>
          <p className="text-gray-400">
            Ansprechpartner: {formData.contactFirstName || handwerkerData?.contactFirstName} {formData.contactLastName || handwerkerData?.contactLastName}
          </p>
          <p className="text-gray-500 text-sm">Betriebs-ID: {handwerkerData?.companyId}</p>
          
          <div className="flex items-center gap-3 mt-3">
            {/* Verifizierungsstatus */}
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
              handwerkerData?.verificationStatus === 'verified' 
                ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                : handwerkerData?.verificationStatus === 'pending'
                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
            }`}>
              {handwerkerData?.verificationStatus === 'verified' ? '✓ Verifiziert' : 
               handwerkerData?.verificationStatus === 'pending' ? '⏳ In Prüfung' : '○ Nicht verifiziert'}
            </span>
            
            {/* E-Mail Verifizierungsstatus */}
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
              formData.emailVerified 
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
            }`}>
              {formData.emailVerified ? '✉ E-Mail bestätigt' : '⚠ E-Mail nicht bestätigt'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Kontaktdaten Übersicht */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-white/10">
        <div>
          <p className="text-gray-400 text-sm">E-Mail</p>
          <p className="text-white">{formData.email || handwerkerData?.email}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Telefon</p>
          <p className="text-white">{formData.phone || handwerkerData?.phone || '-'}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Website</p>
          <p className="text-white">
            {formData.website ? (
              <a href={formData.website} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300">
                {formData.website}
              </a>
            ) : '-'}
          </p>
        </div>
        <div className="md:col-span-2 lg:col-span-3">
          <p className="text-gray-400 text-sm">Adresse</p>
          <p className="text-white">
            {formData.street || formData.houseNumber || formData.zipCode || formData.city ? (
              `${formData.street || ''} ${formData.houseNumber || ''}, ${formData.zipCode || ''} ${formData.city || ''}`
            ) : '-'}
          </p>
        </div>
      </div>
    </div>
    
    {/* Bewertungen Sektion */}
    <div className="bg-white/5 rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        ⭐ Meine Bewertungen
        {ratingSummary && ratingSummary.total_ratings > 0 && (
          <span className="text-sm font-normal text-gray-400">
            ({ratingSummary.total_ratings} {ratingSummary.total_ratings === 1 ? 'Bewertung' : 'Bewertungen'})
          </span>
        )}
      </h3>
      
      {loadingRatings ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
        </div>
      ) : ratingSummary && parseFloat(ratingSummary.total_ratings) > 0 ? (
        <>
          {/* Bewertungsübersicht */}
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            {/* Gesamtbewertung */}
            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-lg p-4 text-center border border-yellow-500/30">
              <div className="text-4xl font-bold text-yellow-400">
                {parseFloat(ratingSummary.average_rating).toFixed(1)}
              </div>
              <div className="text-yellow-300 text-lg">
                {'⭐'.repeat(Math.round(parseFloat(ratingSummary.average_rating)))}
              </div>
              <p className="text-gray-400 text-sm mt-1">Gesamtbewertung</p>
            </div>
            
            {/* Einzelne Kategorien */}
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {parseFloat(ratingSummary.avg_cost).toFixed(1)}
              </div>
              <div className="text-yellow-400 text-sm">
                {'⭐'.repeat(Math.round(parseFloat(ratingSummary.avg_cost)))}
              </div>
              <p className="text-gray-400 text-sm mt-1">💰 Kosten</p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {parseFloat(ratingSummary.avg_schedule).toFixed(1)}
              </div>
              <div className="text-yellow-400 text-sm">
                {'⭐'.repeat(Math.round(parseFloat(ratingSummary.avg_schedule)))}
              </div>
              <p className="text-gray-400 text-sm mt-1">📅 Termintreue</p>
            </div>
            
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {parseFloat(ratingSummary.avg_quality).toFixed(1)}
              </div>
              <div className="text-yellow-400 text-sm">
                {'⭐'.repeat(Math.round(parseFloat(ratingSummary.avg_quality)))}
              </div>
              <p className="text-gray-400 text-sm mt-1">✨ Qualität</p>
            </div>
          </div>
          
          {/* Einzelne Bewertungen */}
          {ratings && ratings.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-white font-medium border-b border-white/10 pb-2">
                Letzte Bewertungen
              </h4>
              {ratings.slice(0, 5).map((rating) => (
                <div key={rating.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-white font-medium">{rating.trade_name}</p>
                      <p className="text-gray-400 text-sm">
                        {rating.project_zip} {rating.project_city}
                        {rating.bauherr_name && ` • ${rating.bauherr_name}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-yellow-400">
                        {'⭐'.repeat(Math.round(parseFloat(rating.overall_rating)))}
                      </div>
                      <p className="text-gray-500 text-xs">
                        {new Date(rating.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  
                  {/* Detail-Bewertungen */}
                  <div className="flex gap-4 text-sm text-gray-400 mt-2">
                    <span>💰 {rating.cost_rating}/5</span>
                    <span>📅 {rating.schedule_rating}/5</span>
                    <span>✨ {rating.quality_rating}/5</span>
                  </div>
                  
                  {/* Kommunikations-Anmerkungen */}
                  {rating.communication_notes && (
                    <div className="mt-3 p-3 bg-blue-500/10 border-l-2 border-blue-500 rounded-r text-sm">
                      <p className="text-gray-400 text-xs mb-1">💬 Anmerkungen:</p>
                      <p className="text-gray-300 italic">"{rating.communication_notes}"</p>
                    </div>
                  )}
                </div>
              ))}
              
              {ratings.length > 5 && (
                <button 
                  onClick={() => setShowAllRatings(!showAllRatings)}
                  className="w-full py-2 text-teal-400 hover:text-teal-300 text-sm"
                >
                  {showAllRatings ? 'Weniger anzeigen' : `Alle ${ratings.length} Bewertungen anzeigen`}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <div className="text-5xl mb-4">⭐</div>
          <p className="text-gray-400">Noch keine Bewertungen erhalten</p>
          <p className="text-gray-500 text-sm mt-2">
            Bewertungen werden nach Abschluss von Aufträgen von Bauherren vergeben.
          </p>
        </div>
      )}
    </div>
    
    {/* Statistiken */}
    <div className="bg-white/5 rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-4">📊 Statistiken</h3>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-teal-400">{profileStats.activeOrders || 0}</p>
          <p className="text-gray-400 text-sm">Aktive Aufträge</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{profileStats.completedOrders || 0}</p>
          <p className="text-gray-400 text-sm">Abgeschlossen</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{profileStats.totalRevenue || '0 €'}</p>
          <p className="text-gray-400 text-sm">Gesamtumsatz</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-purple-400">
            {new Date(handwerkerData?.createdAt || Date.now()).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}
          </p>
          <p className="text-gray-400 text-sm">Dabei seit</p>
        </div>
      </div>
    </div>
</div>
)}
    
          {/* Einzugsgebiet Tab */}
{(activeTab === 'einsatzgebiet' || activeTab === 'einzugsgebiet') && (
  <div className="space-y-6">
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-6">Einzugsgebiet & Arbeitsbereich</h2>
      
      {/* Aktionsradius */}
      <div className="mb-6">
        <label className="block text-white font-medium mb-2">
          Aktionsradius
          <span className="text-red-400 ml-1">*</span>
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="5"
            max="200"
            value={formData.action_radius || 25}
            onChange={(e) => setFormData({...formData, action_radius: parseInt(e.target.value)})}
            className="flex-1"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="5"
              max="200"
              value={formData.action_radius || 25}
              onChange={(e) => setFormData({...formData, action_radius: parseInt(e.target.value)})}
              className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-center"
            />
            <span className="text-white">km</span>
          </div>
        </div>
      </div>

      {/* Live Karte */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Ihr Arbeitsbereich</h3>
        <div className="h-[400px] rounded-lg overflow-hidden border border-white/20">
          <MapContainer
            center={[
              parseFloat(formData.latitude) || 50.9375, 
              parseFloat(formData.longitude) || 6.9603
            ]}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            
            {/* Firmensitz Marker */}
            <Marker position={[
              parseFloat(formData.latitude) || 50.9375,
              parseFloat(formData.longitude) || 6.9603
            ]}>
              <Popup>
                <strong>{formData.company_name}</strong><br />
                {formData.street} {formData.house_number}<br />
                {formData.zip_code} {formData.city}
              </Popup>
            </Marker>
            
            {/* Arbeitsbereich Kreis */}
            <Circle
              center={[
                parseFloat(formData.latitude) || 50.9375,
                parseFloat(formData.longitude) || 6.9603
              ]}
              radius={(formData.action_radius || 25) * 1000}
              fillColor="#14b8a6"
              fillOpacity={0.2}
              color="#14b8a6"
              weight={2}
            />
          </MapContainer>
        </div>
      </div>

      {/* Adresse für Kartenzentrum */}
      <div className="mb-6 grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-white font-medium mb-2">Straße & Hausnummer</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.street || ''}
              onChange={(e) => setFormData({...formData, street: e.target.value})}
              className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              placeholder="Straße"
            />
            <input
              type="text"
              value={formData.house_number || ''}
              onChange={(e) => setFormData({...formData, house_number: e.target.value})}
              className="w-24 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              placeholder="Nr."
            />
          </div>
        </div>
        <div>
          <label className="block text-white font-medium mb-2">PLZ & Stadt</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={formData.zip_code || ''}
              onChange={(e) => setFormData({...formData, zip_code: e.target.value})}
              className="w-24 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              placeholder="PLZ"
            />
            <input
              type="text"
              value={formData.city || ''}
              onChange={(e) => setFormData({...formData, city: e.target.value})}
              className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              placeholder="Stadt"
            />
          </div>
        </div>
      </div>

      {/* Button zum Geocoding */}
      <button
        onClick={async () => {
          const address = `${formData.street} ${formData.house_number}, ${formData.zip_code} ${formData.city}, Germany`;
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
            );
            const data = await response.json();
            if (data && data[0]) {
              setFormData({
                ...formData,
                latitude: data[0].lat,
                longitude: data[0].lon
              });
            }
          } catch (err) {
            console.error('Geocoding failed:', err);
          }
        }}
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg mb-6"
      >
        📍 Adresse auf Karte anzeigen
      </button>

      {/* Bevorzugte PLZ-Bereiche */}
      <div className="mb-6">
        <label className="block text-white font-medium mb-2">
          Bevorzugte PLZ-Bereiche
        </label>
        <textarea
          value={formData.preferred_zip_codes || ''}
          onChange={(e) => setFormData({...formData, preferred_zip_codes: e.target.value})}
          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          rows="2"
          placeholder="z.B. 50667, 50668, 50670-50679"
        />
      </div>

      {/* Ausgeschlossene Gebiete */}
      <div className="mb-6">
        <label className="block text-white font-medium mb-2">
          Ausgeschlossene Gebiete
        </label>
        <textarea
          value={formData.excluded_areas || ''}
          onChange={(e) => setFormData({...formData, excluded_areas: e.target.value})}
          className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          rows="2"
          placeholder="z.B. Stadtteile oder PLZ-Bereiche"
        />
      </div>

      {/* Fahrtkosten */}
      <div className="mb-6">
        <label className="block text-white font-medium mb-2">
          Fahrtkosten pro Kilometer
        </label>
        <div className="flex items-center gap-4">
          <input
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={formData.travel_cost_per_km || 0.5}
            onChange={(e) => setFormData({...formData, travel_cost_per_km: parseFloat(e.target.value)})}
            className="w-32 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          />
          <span className="text-white">€/km</span>
        </div>
      </div>

      {/* Speichern Button */}
      <div className="flex justify-end">
        <button
          onClick={() => handleSave('coverage')}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:from-teal-600 hover:to-blue-700 transition-all disabled:opacity-50"
        >
          {saving ? 'Wird gespeichert...' : 'Einzugsgebiet speichern'}
        </button>
      </div>
    </div>
  </div>
)}

{activeTab === 'gewerke' && (
  <div className="space-y-4">
    <h2 className="text-2xl font-bold text-white mb-4">Meine Gewerke</h2>
    
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
      <p className="text-blue-300 text-sm">
        <strong>ℹ️ Wichtig:</strong> Wählen Sie alle Gewerke aus, für die Sie Ausschreibungen erhalten möchten.
      </p>
    </div>
    
    <div className="bg-white/10 rounded-lg p-4 max-h-96 overflow-y-auto">
      <div className="grid md:grid-cols-2 gap-2">
        {[
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
        ].map(trade => (
          <label
            key={trade.code}
            className="flex items-center text-white hover:bg-white/10 rounded p-2 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={formData.trades?.includes(trade.code)}
              onChange={() => {
                const newTrades = formData.trades?.includes(trade.code)
                  ? formData.trades.filter(t => t !== trade.code)
                  : [...(formData.trades || []), trade.code];
                setFormData(prev => ({ ...prev, trades: newTrades }));
              }}
              className="mr-3 w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
            />
            <span className="text-sm">{trade.name}</span>
          </label>
        ))}
      </div>
    </div>
    
    <p className="text-gray-400 text-sm">
      {formData.trades?.length || 0} Gewerk(e) ausgewählt
    </p>
    
    <button
      onClick={() => handleSave('gewerke')}
      disabled={loading || !formData.trades?.length}
      className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50"
    >
      {loading ? 'Speichert...' : 'Gewerke speichern'}
    </button>
  </div>
)}
          
          {/* Verfügbarkeit Tab */}
          {activeTab === 'verfuegbarkeit' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Verfügbarkeit</h2>
              
              <div>
                <label className="block text-white font-medium mb-2">
                  Frühester Arbeitsbeginn
                </label>
                <input
                  type="date"
                  value={formData.earliestStart}
                  onChange={(e) => handleChange('earliestStart', e.target.value)}
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-white font-medium mb-2">
                  Kapazitätsauslastung: {formData.capacity}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={formData.capacity}
                  onChange={(e) => handleChange('capacity', e.target.value)}
                  className="w-full"
                />
              </div>
              
              <button
                onClick={() => handleSave('verfuegbarkeit')}
                disabled={loading}
                className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                Speichern
              </button>
            </div>
          )}

          {/* Preise Tab */}
          {activeTab === 'preise' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Preiseinstellungen</h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Mindestauftragswert (€)
                  </label>
                  <input
                    type="number"
                    value={formData.minOrderValue}
                    onChange={(e) => handleChange('minOrderValue', e.target.value)}
                    className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">
                    Anfahrtskosten pro km (€)
                  </label>
                  <input
                    type="number"
                    step="0.10"
                    value={formData.travelCostPerKm}
                    onChange={(e) => handleChange('travelCostPerKm', e.target.value)}
                    className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  />
                </div>
              </div>
              
              <button
                onClick={() => handleSave('preise')}
                disabled={loading}
                className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                Speichern
              </button>
            </div>
          )}

          {/* Benachrichtigungen Tab */}
{activeTab === 'benachrichtigungen' && (
  <div className="space-y-4">
    <h2 className="text-2xl font-bold text-white mb-4">Benachrichtigungen</h2>
    
    {/* Kontaktdaten für Benachrichtigungen */}
    <div className="bg-white/5 rounded-lg p-4 mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">Kontaktdaten für Benachrichtigungen</h3>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-white font-medium mb-2">
            E-Mail für Benachrichtigungen
            <span className="text-red-400 ml-1">*</span>
          </label>
          <input
            type="email"
            value={formData.notificationEmail || formData.email}
            onChange={(e) => handleChange('notificationEmail', e.target.value)}
            placeholder="benachrichtigungen@firma.de"
            className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/50"
          />
          <p className="text-white/60 text-sm mt-1">
            An diese E-Mail werden alle Benachrichtigungen gesendet
          </p>
        </div>
        
        <div>
          <label className="block text-white font-medium mb-2">
            Telefonnummer für SMS
            <span className="text-white/60 ml-1">(optional)</span>
          </label>
          <input
            type="tel"
            value={formData.notificationPhone || formData.phone}
            onChange={(e) => handleChange('notificationPhone', e.target.value)}
            placeholder="+49 151 12345678"
            className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-white/50"
          />
          <p className="text-white/60 text-sm mt-1">
            Für dringende Benachrichtigungen per SMS
          </p>
        </div>
      </div>
    </div>
    
    {/* Benachrichtigungsarten */}
    <div className="bg-white/5 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Benachrichtigungsarten</h3>
      
      <div className="space-y-3">
        <label className="flex items-center text-white cursor-pointer hover:text-teal-300 transition-colors">
          <input
            type="checkbox"
            checked={formData.emailNotifications}
            onChange={(e) => handleChange('emailNotifications', e.target.checked)}
            className="mr-3 w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
          />
          <div>
            <span className="font-medium">E-Mail-Benachrichtigungen</span>
            <p className="text-white/60 text-sm">Erhalten Sie E-Mails bei neuen Ausschreibungen in Ihrem Bereich</p>
          </div>
        </label>
        
        <label className="flex items-center text-white cursor-pointer hover:text-teal-300 transition-colors">
          <input
            type="checkbox"
            checked={formData.smsNotifications}
            onChange={(e) => handleChange('smsNotifications', e.target.checked)}
            disabled={!formData.notificationPhone}
            className="mr-3 w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500 disabled:opacity-50"
          />
          <div>
            <span className="font-medium">SMS-Benachrichtigungen</span>
            <p className="text-white/60 text-sm">
              Für dringende Anfragen und zeitkritische Projekte
              {!formData.notificationPhone && <span className="text-yellow-300"> (Telefonnummer erforderlich)</span>}
            </p>
          </div>
        </label>
        
        <label className="flex items-center text-white cursor-pointer hover:text-teal-300 transition-colors">
          <input
            type="checkbox"
            checked={formData.newsletterSubscribed}
            onChange={(e) => handleChange('newsletterSubscribed', e.target.checked)}
            className="mr-3 w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
          />
          <div>
            <span className="font-medium">Newsletter</span>
            <p className="text-white/60 text-sm">Tipps, Updates und neue Features per E-Mail</p>
          </div>
        </label>
      </div>
    </div>
    
    {/* Benachrichtigungszeiten */}
    <div className="bg-white/5 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">Benachrichtigungszeiten</h3>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-white font-medium mb-2">
            Früheste Benachrichtigung
          </label>
          <input
            type="time"
            value={formData.notificationStartTime || '08:00'}
            onChange={(e) => handleChange('notificationStartTime', e.target.value)}
            className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
          />
        </div>
        
        <div>
          <label className="block text-white font-medium mb-2">
            Späteste Benachrichtigung
          </label>
          <input
            type="time"
            value={formData.notificationEndTime || '18:00'}
            onChange={(e) => handleChange('notificationEndTime', e.target.value)}
            className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
          />
        </div>
      </div>
      <p className="text-white/60 text-sm mt-2">
        Außerhalb dieser Zeiten werden nur kritische Benachrichtigungen versendet
      </p>
    </div>
    
    {/* Speichern Button */}
    <div className="flex justify-end gap-4">
      <button
        onClick={() => {
          setFormData(prev => ({
            ...prev,
            notificationEmail: handwerkerData?.email || '',
            notificationPhone: handwerkerData?.phone || ''
          }));
        }}
        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
      >
        Zurücksetzen
      </button>
      <button
        onClick={() => handleSave('benachrichtigungen')}
        disabled={loading || (!formData.notificationEmail && !formData.email)}
        className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50"
      >
        {loading ? 'Wird gespeichert...' : 'Speichern'}
      </button>
    </div>
  </div>
)}

          {/* Zahlungsdaten Tab */}
          {activeTab === 'zahlungsdaten' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Zahlungsdaten</h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white font-medium mb-2">IBAN</label>
                  <input
                    type="text"
                    value={formData.bankIban}
                    onChange={(e) => handleChange('bankIban', e.target.value)}
                    placeholder="DE89 3704 0044 0532 0130 00"
                    className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">BIC</label>
                  <input
                    type="text"
                    value={formData.bankBic}
                    onChange={(e) => handleChange('bankBic', e.target.value)}
                    placeholder="COBADEFFXXX"
                    className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">Zahlungsbedingungen</label>
                  <select
                    value={formData.paymentTerms}
                    onChange={(e) => handleChange('paymentTerms', e.target.value)}
                    className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="Sofort">Sofort fällig</option>
                    <option value="Netto 14 Tage">Netto 14 Tage</option>
                    <option value="Netto 30 Tage">Netto 30 Tage</option>
                    <option value="2% Skonto 10 Tage, Netto 30 Tage">2% Skonto 10 Tage, Netto 30 Tage</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-white font-medium mb-2">Rechnungsadresse (falls abweichend)</label>
                <textarea
                  value={formData.invoiceAddress}
                  onChange={(e) => handleChange('invoiceAddress', e.target.value)}
                  rows="3"
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                />
              </div>
              
              <button
                onClick={() => handleSave('zahlungsdaten')}
                disabled={loading}
                className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                Speichern
              </button>
            </div>
          )}

          {/* Account Tab */}
{activeTab === 'account' && (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold text-white mb-4">Account-Einstellungen</h2>
    
    {/* Sicherheitswarnung */}
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div>
          <p className="text-yellow-300 font-medium">Sicherheitshinweis</p>
          <p className="text-yellow-300/80 text-sm">
            Änderungen in diesem Bereich können Ihren Zugang zum System beeinflussen. 
            Stellen Sie sicher, dass Sie sich Ihre neuen Zugangsdaten merken.
          </p>
        </div>
      </div>
    </div>
    
    {/* Passwort ändern */}
    <div className="bg-white/5 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Passwort ändern</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-white font-medium mb-2">
            Aktuelles Passwort
            <span className="text-red-400 ml-1">*</span>
          </label>
          <div className="relative">
            <input
              type={showCurrentPassword ? "text" : "password"}
              value={formData.currentPassword || ''}
              onChange={(e) => handleChange('currentPassword', e.target.value)}
              className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white pr-12"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
            >
              {showCurrentPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-white font-medium mb-2">
            Neues Passwort
            <span className="text-red-400 ml-1">*</span>
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? "text" : "password"}
              value={formData.newPassword || ''}
              onChange={(e) => handleChange('newPassword', e.target.value)}
              className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white pr-12"
              placeholder="Min. 8 Zeichen"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
            >
              {showNewPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          
          {/* Passwort-Stärke-Anzeige */}
          {formData.newPassword && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white/60 text-xs">Passwortstärke:</span>
                <span className={`text-xs ${getPasswordStrengthColor(formData.newPassword)}`}>
                  {getPasswordStrengthText(formData.newPassword)}
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div 
                  className={`h-full rounded-full transition-all ${getPasswordStrengthClass(formData.newPassword)}`}
                  style={{ width: `${getPasswordStrength(formData.newPassword)}%` }}
                />
              </div>
              <p className="text-white/60 text-xs mt-1">
                Mindestens 8 Zeichen, idealerweise mit Groß- und Kleinbuchstaben, Zahlen und Sonderzeichen
              </p>
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-white font-medium mb-2">
            Neues Passwort bestätigen
            <span className="text-red-400 ml-1">*</span>
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={formData.confirmPassword || ''}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white pr-12"
              placeholder="Passwort wiederholen"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
            >
              {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
          {formData.newPassword && formData.confirmPassword && formData.newPassword !== formData.confirmPassword && (
            <p className="text-red-400 text-xs mt-1">Die Passwörter stimmen nicht überein</p>
          )}
        </div>
        
        <div className="flex justify-end gap-4">
          <button
            onClick={() => {
              setFormData(prev => ({
                ...prev,
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
              }));
            }}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handlePasswordChange}
            disabled={
              saving || 
              !formData.currentPassword || 
              !formData.newPassword || 
              !formData.confirmPassword ||
              formData.newPassword !== formData.confirmPassword ||
              formData.newPassword.length < 8
            }
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Wird geändert...' : 'Passwort ändern'}
          </button>
        </div>
      </div>
    </div>
    
    {/* Zwei-Faktor-Authentifizierung */}
    <div className="bg-white/5 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Zwei-Faktor-Authentifizierung</h3>
      
      <div className="space-y-4">
        <label className="flex items-center justify-between">
          <div className="flex items-center text-white">
            <input
              type="checkbox"
              checked={formData.twoFactorEnabled || false}
              onChange={(e) => {
                handleChange('twoFactorEnabled', e.target.checked);
                handleSaveTwoFactor(e.target.checked);
              }}
              className="mr-3 w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
            />
            <div>
              <span className="font-medium">2FA aktivieren</span>
              <p className="text-white/60 text-sm">
                Erhöht die Sicherheit Ihres Accounts durch eine zusätzliche Verifizierung
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm ${
            formData.twoFactorEnabled 
              ? 'bg-green-500/20 text-green-300' 
              : 'bg-gray-500/20 text-gray-300'
          }`}>
            {formData.twoFactorEnabled ? 'Aktiv' : 'Inaktiv'}
          </span>
        </label>
        
        {formData.twoFactorEnabled && (
          <div className="mt-4 p-4 bg-white/5 rounded-lg">
            <p className="text-white/80 text-sm">
              📱 SMS-Verifizierung wird an Ihre hinterlegte Nummer gesendet: 
              <span className="text-teal-300 ml-2">{formData.phone || 'Keine Nummer hinterlegt'}</span>
            </p>
          </div>
        )}
      </div>
    </div>
    
    {/* Login-Informationen */}
    <div className="bg-white/5 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Login-Informationen</h3>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-white/60 text-sm">Betriebs-ID</p>
          <p className="text-white font-mono">
            {handwerkerData?.companyId || 'Nicht verfügbar'}
          </p>
        </div>
        <div>
          <p className="text-white/60 text-sm">E-Mail-Adresse</p>
          <p className="text-white">
            {handwerkerData?.email || formData.email}
          </p>
        </div>
        <div>
          <p className="text-white/60 text-sm">Letzter Login</p>
          <p className="text-white">
            {formData.lastLogin 
              ? new Date(formData.lastLogin).toLocaleString('de-DE')
              : 'Keine Daten vorhanden'}
          </p>
        </div>
        <div>
          <p className="text-white/60 text-sm">Account erstellt</p>
          <p className="text-white">
            {handwerkerData?.createdAt 
              ? new Date(handwerkerData.createdAt).toLocaleDateString('de-DE')
              : 'Keine Daten vorhanden'}
          </p>
        </div>
      </div>
    </div>
    
    {/* Account löschen */}
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-red-300 mb-4">Gefahrenzone</h3>
      
      <div className="space-y-4">
        <p className="text-white/80">
          Das Löschen Ihres Accounts ist endgültig und kann nicht rückgängig gemacht werden. 
          Alle Ihre Daten, Projekte und Bewertungen werden unwiderruflich gelöscht.
        </p>
        
        {showDeleteConfirm ? (
          <div className="space-y-4">
            <div>
              <label className="block text-white font-medium mb-2">
                Geben Sie Ihr Passwort zur Bestätigung ein:
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="w-full bg-white/20 border border-red-500/50 rounded-lg px-4 py-2 text-white"
                placeholder="Passwort zur Bestätigung"
              />
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                }}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAccountDelete}
                disabled={!deletePassword}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Account endgültig löschen
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 rounded-lg transition-colors"
          >
            Account löschen
          </button>
        )}
      </div>
    </div>
  </div>
)}

          {activeTab === 'dokumente' && (
  <div className="space-y-6">
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-6">Dokumente & Nachweise</h2>
      
      {/* Upload Bereich */}
      <div className="mb-8">
        <div className="border-2 border-dashed border-white/30 rounded-lg p-8 text-center">
          <input
            type="file"
            id="doc-upload"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={async (e) => {
              const files = Array.from(e.target.files);
              for (const file of files) {
                await uploadDocument(file);
              }
            }}
            className="hidden"
          />
          <label htmlFor="doc-upload" className="cursor-pointer">
            <div className="text-white/60 hover:text-white transition-colors">
              <p className="text-4xl mb-4">📁</p>
              <p className="text-lg font-medium">Dokumente hochladen</p>
              <p className="text-sm mt-2">PDF, JPG, PNG (max. 5MB)</p>
            </div>
          </label>
        </div>
      </div>

      {/* Dokumenten-Kategorien */}
      <div className="space-y-6">
        {/* Gewerbeschein */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Gewerbeschein</h3>
          {documents.gewerbeschein ? (
            <div className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <div>
                  <p className="text-white">{documents.gewerbeschein.file_name}</p>
                  <p className="text-white/60 text-sm">
                    Hochgeladen: {new Date(documents.gewerbeschein.uploaded_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadDocument(documents.gewerbeschein.id)}
                  className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30"
                >
                  Ansehen
                </button>
                <button
                  onClick={() => deleteDocument(documents.gewerbeschein.id, 'gewerbeschein')}
                  className="px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30"
                >
                  Löschen
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-300">⚠️ Noch nicht hochgeladen - Erforderlich für Verifizierung</p>
            </div>
          )}
        </div>

        {/* Handwerkskarte */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Handwerkskarte</h3>
          {documents.handwerkskarte ? (
            <div className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎫</span>
                <div>
                  <p className="text-white">{documents.handwerkskarte.file_name}</p>
                  <p className="text-white/60 text-sm">
                    Hochgeladen: {new Date(documents.handwerkskarte.uploaded_at).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadDocument(documents.handwerkskarte.id)}
                  className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30"
                >
                  Ansehen
                </button>
                <button
                  onClick={() => deleteDocument(documents.handwerkskarte.id, 'handwerkskarte')}
                  className="px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30"
                >
                  Löschen
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-white/60">Optional - Erhöht Vertrauenswürdigkeit</p>
            </div>
          )}
        </div>

        {/* Weitere Dokumente */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Weitere Dokumente</h3>
          {documents.others && documents.others.length > 0 ? (
            <div className="space-y-2">
              {documents.others.map(doc => (
                <div key={doc.id} className="bg-white/5 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📎</span>
                    <div>
                      <p className="text-white">{doc.file_name}</p>
                      <p className="text-white/60 text-sm">
                        {doc.document_type} • {new Date(doc.uploaded_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => downloadDocument(doc.id)}
                      className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded hover:bg-blue-500/30"
                    >
                      Ansehen
                    </button>
                    <button
                      onClick={() => deleteDocument(doc.id, 'other')}
                      className="px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/5 rounded-lg p-4">
              <p className="text-white/60">Keine weiteren Dokumente hochgeladen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)}

           {/* Hilfe & Feedback Tab */}
          {activeTab === 'hilfe' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white mb-6">Hilfe & Feedback</h2>
              
              <div className="grid gap-6">
                {/* FAQ Bereich */}
                <div className="bg-white/5 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Häufig gestellte Fragen</h3>
                  <div className="space-y-3">
                    <details className="group border-b border-white/10 pb-3">
                      <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                        <span>Wie funktioniert die Projektvergabe auf byndl?</span>
                        <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                      </summary>
                      <p className="mt-3 text-gray-300 text-sm pl-4">
                        Sie erhalten qualifizierte Anfragen mit vollständigen Leistungsverzeichnissen basierend auf Ihrem Fachgebiet und Einsatzgebiet. 
                        Sie können dann Angebote abgeben und Bauherren wählen das beste Angebot aus.
                      </p>
                    </details>
                    
                    <details className="group border-b border-white/10 pb-3">
                      <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                        <span>Was kostet die Nutzung von byndl?</span>
                        <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                      </summary>
                      <p className="mt-3 text-gray-300 text-sm pl-4">
                        Die Registrierung und das Erstellen von Angeboten sind kostenlos. 
                        Bei erfolgreicher Auftragsvergabe fällt eine Provision von 3-5% auf die Auftragssumme an.
                      </p>
                    </details>
                    
                    <details className="group border-b border-white/10 pb-3">
                      <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                        <span>Wie ändere ich mein Einsatzgebiet?</span>
                        <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                      </summary>
                      <p className="mt-3 text-gray-300 text-sm pl-4">
                        Gehen Sie zum Tab "Einsatzgebiet" und passen Sie Ihren Radius oder ausgeschlossene Bereiche an. 
                        Die Änderungen werden sofort gespeichert und beeinflussen zukünftige Projektvorschläge.
                      </p>
                    </details>
                    
                    <details className="group border-b border-white/10 pb-3">
                      <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                        <span>Wie werden Projekte regional gebündelt?</span>
                        <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                      </summary>
                      <p className="mt-3 text-gray-300 text-sm pl-4">
                        byndl analysiert automatisch Projekte in Ihrer Region und schlägt Ihnen Aufträge vor, 
                        die Sie effizient kombinieren können. So optimieren Sie Fahrtzeiten und Auslastung.
                      </p>
                    </details>
                  </div>
                </div>

                {/* Support kontaktieren */}
                <div className="bg-white/5 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Support kontaktieren</h3>
                  <div className="space-y-4">
                    <a href="mailto:info@byndl.de" className="flex items-center gap-3 text-teal-400 hover:text-teal-300 transition-colors">
                      <span className="text-xl">📧</span>
                      <span>info@byndl.de</span>
                    </a>
                    <a href="mailto:support@byndl.de" className="flex items-center gap-3 text-teal-400 hover:text-teal-300 transition-colors">
                      <span className="text-xl">📧</span>
                      <span>support@byndl.de</span>
                    </a>
                    <p className="flex items-center gap-3 text-gray-300">
                      <span className="text-xl">📞</span>
                      <span>+49 221 / 123 456 789 (Mo-Fr 9-17 Uhr)</span>
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      Antwort innerhalb 24 Stunden (werktags)
                    </p>
                  </div>
                </div>

                {/* Feedback senden */}
                <div className="bg-white/5 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Feedback senden</h3>
                  <p className="text-gray-300 text-sm mb-4">
                    Ihre Meinung ist uns wichtig! Teilen Sie uns mit, wie wir byndl für Sie verbessern können.
                  </p>
                  <textarea
                    placeholder="Ihr Feedback hilft uns, byndl zu verbessern..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 h-32 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    disabled={feedbackLoading}
                  />
                  <button 
                    onClick={sendFeedback}
                    disabled={feedbackLoading || !feedbackText.trim()}
                    className="mt-4 px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
                  >
                    {feedbackLoading ? 'Wird gesendet...' : 'Feedback senden'}
                  </button>
                </div>

                {/* Nützliche Links */}
                <div className="bg-white/5 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Nützliche Links</h3>
                  <div className="space-y-2">
                    <a href="/agb" target="_blank" className="block text-teal-400 hover:text-teal-300 transition-colors">
                      → Allgemeine Geschäftsbedingungen
                    </a>
                    <a href="/datenschutz" target="_blank" className="block text-teal-400 hover:text-teal-300 transition-colors">
                      → Datenschutzerklärung
                    </a>
                    <a href="/impressum" target="_blank" className="block text-teal-400 hover:text-teal-300 transition-colors">
                      → Impressum
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}         
        </div>
      </div>
    </div>
  );
}
