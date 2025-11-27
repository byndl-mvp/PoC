// PROFESSIONELLE VERSION mit Vorname/Nachname getrennt
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function BauherrenSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Form States - NEU: firstName und lastName getrennt
  const [personalData, setPersonalData] = useState({
    firstName: '',
    lastName: '',
    name: '',  // Für Rückwärtskompatibilität
    email: '',
    phone: '',
    street: '',
    houseNumber: '',
    zipCode: '',
    city: ''
  });
  
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsNotifications: false,
    projectUpdates: true,
    offerAlerts: true,
    weeklyDigest: false
  });
  
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [billingAddressSameAsPersonal, setBillingAddressSameAsPersonal] = useState(true);
  const [billingAddress, setBillingAddress] = useState({
    companyName: '',
    fullName: '',
    street: '',
    houseNumber: '',
    zipCode: '',
    city: '',
    country: 'DE',
    vatId: ''
  });
  // Für spätere Stripe-Integration:
  // const [showPaymentModal, setShowPaymentModal] = useState(false);
  // const [selectedPaymentType, setSelectedPaymentType] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [createdAt, setCreatedAt] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  
  useEffect(() => {
    const userData = sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData');
    if (!userData) {
      navigate('/bauherr/login');
      return;
    }
    
    const user = JSON.parse(userData);
    
    const loadSettings = async (userId) => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl(`/api/bauherr/${userId}/settings`));
        if (res.ok) {
          const data = await res.json();
          
          // NEU: firstName und lastName korrekt mappen
          setPersonalData({
            firstName: data.firstName || data.first_name || (data.name ? data.name.split(' ')[0] : ''),
            lastName: data.lastName || data.last_name || (data.name ? data.name.split(' ').slice(1).join(' ') : ''),
            name: data.name || '',
            email: data.email || '',
            phone: data.phone || '',
            street: data.street || '',
            houseNumber: data.house_number || data.houseNumber || '',
            zipCode: data.zip || data.zipCode || '',
            city: data.city || ''
          });
          
          setNotifications(data.notification_settings || notifications);
          setTwoFactorEnabled(data.two_factor_enabled || false);
          setPaymentMethods(data.payment_methods || []);
          setPaymentHistory(data.payment_history || []);
          setBillingAddressSameAsPersonal(data.billing_address_same_as_personal !== false);
          if (data.billing_address) {
            setBillingAddress(data.billing_address);
          }
          // E-Mail Verified Status - prüfe verschiedene mögliche Feldnamen
          const isVerified = data.email_verified || data.emailVerified || 
                            data.email_verified_at !== null || data.emailVerifiedAt !== null || false;
          setEmailVerified(isVerified);
          // Created At - prüfe verschiedene mögliche Feldnamen
          setCreatedAt(data.created_at || data.createdAt || data.registered_at || data.registeredAt);
        }
      } catch (err) {
        setError('Fehler beim Laden der Einstellungen');
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings(user.id);
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const savePersonalData = async () => {
    try {
      setLoading(true);
      setError('');
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      // Kombiniere firstName und lastName für Rückwärtskompatibilität
      const dataToSend = {
        ...personalData,
        name: `${personalData.firstName} ${personalData.lastName}`.trim()
      };
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/personal`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });
      
      if (res.ok) {
        // Session Storage aktualisieren
        const updatedUserData = {
          ...userData,
          name: dataToSend.name,
          firstName: personalData.firstName,
          lastName: personalData.lastName
        };
        sessionStorage.setItem('userData', JSON.stringify(updatedUserData));
        sessionStorage.setItem('bauherrData', JSON.stringify(updatedUserData));
        
        setMessage('Persönliche Daten erfolgreich gespeichert');
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error('Speichern fehlgeschlagen');
      }
    } catch (err) {
      setError('Fehler beim Speichern der Daten');
    } finally {
      setLoading(false);
    }
  };
  
  const saveNotifications = async () => {
    try {
      setLoading(true);
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/notifications`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifications)
      });
      
      if (res.ok) {
        setMessage('Benachrichtigungen aktualisiert');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };
  
  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }
    
    if (newPassword.length < 8) {
      setError('Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/password`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword
        })
      });
      
      if (res.ok) {
        setMessage('Passwort erfolgreich geändert');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Passwortänderung fehlgeschlagen');
      }
    } catch (err) {
      setError(err.message || 'Fehler beim Ändern des Passworts');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleTwoFactor = async () => {
    try {
      setLoading(true);
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/two-factor`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !twoFactorEnabled })
      });
      
      if (res.ok) {
        setTwoFactorEnabled(!twoFactorEnabled);
        setMessage(`Zwei-Faktor-Authentifizierung ${!twoFactorEnabled ? 'aktiviert' : 'deaktiviert'}`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Fehler beim Ändern der 2FA-Einstellungen');
    } finally {
      setLoading(false);
    }
  };
  
  const exportData = async () => {
    try {
      setLoading(true);
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/export`));
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `byndl-daten-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
        setMessage('Daten erfolgreich exportiert');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Fehler beim Datenexport');
    } finally {
      setLoading(false);
    }
  };
  
  const deleteAccount = async () => {
    const confirmed = window.confirm(
      'Sind Sie sicher, dass Sie Ihren Account unwiderruflich löschen möchten? ' +
      'Alle Ihre Daten werden permanent gelöscht.'
    );
    
    if (!confirmed) return;
    
    const doubleConfirmed = window.confirm(
      'Diese Aktion kann NICHT rückgängig gemacht werden. ' +
      'Wirklich löschen?'
    );
    
    if (!doubleConfirmed) return;
    
    try {
      setLoading(true);
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}`), {
        method: 'DELETE'
      });
      
      if (res.ok) {
        sessionStorage.clear();
        navigate('/');
      }
    } catch (err) {
      setError('Fehler beim Löschen des Accounts');
    } finally {
      setLoading(false);
    }
  };

  const sendFeedback = async () => {
  if (!feedbackText.trim()) {
    setError('Bitte geben Sie ein Feedback ein');
    setTimeout(() => setError(''), 3000);
    return;
  }
  
  try {
    setFeedbackLoading(true);
    setError('');
    const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
    
    const res = await fetch(apiUrl('/api/feedback'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userData.id,
        userName: userData.name || `${userData.firstName} ${userData.lastName}`,
        userEmail: userData.email,
        userType: 'bauherr',
        feedbackText: feedbackText
      })
    });
    
    if (res.ok) {
      setMessage('Vielen Dank für Ihr Feedback! Wir haben Ihre Nachricht erhalten.');
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
  
  // ============ PAYMENT FUNKTIONEN ============
  
  const openPaymentModal = (type) => {
    // Hier wird später Stripe Elements integriert
    // Für jetzt zeigen wir eine Info-Meldung
    const typeNames = {
      card: 'Kreditkarte',
      paypal: 'PayPal',
      sepa: 'SEPA-Lastschrift',
      giropay: 'Giropay',
      sofort: 'Sofortüberweisung',
      apple_pay: 'Apple Pay',
      google_pay: 'Google Pay'
    };
    alert(`${typeNames[type] || type} wird in Kürze über Stripe verfügbar sein.`);
  };
  
  const setDefaultPaymentMethod = async (methodId) => {
    try {
      setLoading(true);
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/payment-methods/${methodId}/default`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        // Update lokalen State
        setPaymentMethods(prev => prev.map(method => ({
          ...method,
          isDefault: method.id === methodId
        })));
        setMessage('Standard-Zahlungsmethode aktualisiert');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Fehler beim Setzen der Standard-Zahlungsmethode');
    } finally {
      setLoading(false);
    }
  };
  
  const removePaymentMethod = async (methodId) => {
    const confirmed = window.confirm('Möchten Sie diese Zahlungsmethode wirklich entfernen?');
    if (!confirmed) return;
    
    try {
      setLoading(true);
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/payment-methods/${methodId}`), {
        method: 'DELETE'
      });
      
      if (res.ok) {
        setPaymentMethods(prev => prev.filter(method => method.id !== methodId));
        setMessage('Zahlungsmethode entfernt');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Fehler beim Entfernen der Zahlungsmethode');
    } finally {
      setLoading(false);
    }
  };
  
  const saveBillingAddress = async () => {
    try {
      setLoading(true);
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const addressToSave = billingAddressSameAsPersonal ? {
        sameAsPersonal: true
      } : {
        sameAsPersonal: false,
        ...billingAddress
      };
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/billing-address`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressToSave)
      });
      
      if (res.ok) {
        setMessage('Rechnungsadresse gespeichert');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Fehler beim Speichern der Rechnungsadresse');
    } finally {
      setLoading(false);
    }
  };
  
  const downloadInvoices = async () => {
    try {
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/invoices/download-all`));
      
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rechnungen_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError('Fehler beim Herunterladen der Rechnungen');
    }
  };

  const tabs = [
    { id: 'personal', label: 'Persönliche Daten', icon: '👤' },
    { id: 'payment', label: 'Zahlungsmethoden', icon: '💳' },
    { id: 'notifications', label: 'Benachrichtigungen', icon: '🔔' },
    { id: 'security', label: 'Sicherheit', icon: '🔒' },
    { id: 'privacy', label: 'Datenschutz', icon: '🛡️' },
    { id: 'help', label: 'Hilfe', icon: '❓' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <nav className="bg-black/30 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link to="/bauherr/dashboard" className="text-2xl font-bold text-white hover:text-teal-400 transition-colors">
              byndl
            </Link>
            <div className="flex items-center gap-4">
              <Link 
                to="/bauherr/dashboard" 
                className="text-gray-300 hover:text-white transition-colors"
              >
                ← Zurück zum Dashboard
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Einstellungen</h1>
        
        {/* Success/Error Messages */}
        {message && (
          <div className="mb-6 bg-green-500/20 border border-green-500/50 rounded-lg p-4">
            <p className="text-green-300">{message}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="md:w-64 flex-shrink-0">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <nav className="space-y-2">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                      activeTab === tab.id 
                        ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' 
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            
            {/* Personal Data Tab */}
            {activeTab === 'personal' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Persönliche Daten</h2>
                
                {/* E-Mail Verifizierungsstatus */}
                <div className={`mb-6 p-4 rounded-lg ${
                  emailVerified 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : 'bg-yellow-500/10 border border-yellow-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={emailVerified ? 'text-green-400' : 'text-yellow-400'}>
                      {emailVerified ? '✓' : '⚠'}
                    </span>
                    <span className={emailVerified ? 'text-green-300' : 'text-yellow-300'}>
                      {emailVerified 
                        ? 'E-Mail-Adresse verifiziert' 
                        : 'E-Mail-Adresse noch nicht verifiziert'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-6">
                  {/* NEU: Vorname und Nachname getrennt */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white/70 text-sm mb-2">Vorname</label>
                      <input
                        type="text"
                        value={personalData.firstName}
                        onChange={(e) => setPersonalData({...personalData, firstName: e.target.value})}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Max"
                      />
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm mb-2">Nachname</label>
                      <input
                        type="text"
                        value={personalData.lastName}
                        onChange={(e) => setPersonalData({...personalData, lastName: e.target.value})}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Mustermann"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-white/70 text-sm mb-2">E-Mail</label>
                    <input
                      type="email"
                      value={personalData.email}
                      disabled
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400 cursor-not-allowed"
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      E-Mail-Adresse kann nicht geändert werden
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-white/70 text-sm mb-2">Telefon</label>
                    <input
                      type="tel"
                      value={personalData.phone}
                      onChange={(e) => setPersonalData({...personalData, phone: e.target.value})}
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="+49 221 12345678"
                    />
                  </div>
                  
                  <hr className="border-white/20" />
                  
                  <h3 className="text-lg font-semibold text-white">Adresse</h3>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-white/70 text-sm mb-2">Straße</label>
                      <input
                        type="text"
                        value={personalData.street}
                        onChange={(e) => setPersonalData({...personalData, street: e.target.value})}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Musterstraße"
                      />
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm mb-2">Hausnummer</label>
                      <input
                        type="text"
                        value={personalData.houseNumber}
                        onChange={(e) => setPersonalData({...personalData, houseNumber: e.target.value})}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="12a"
                      />
                    </div>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-white/70 text-sm mb-2">PLZ</label>
                      <input
                        type="text"
                        value={personalData.zipCode}
                        onChange={(e) => setPersonalData({...personalData, zipCode: e.target.value})}
                        maxLength="5"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="50667"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-white/70 text-sm mb-2">Stadt</label>
                      <input
                        type="text"
                        value={personalData.city}
                        onChange={(e) => setPersonalData({...personalData, city: e.target.value})}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        placeholder="Köln"
                      />
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={savePersonalData}
                  disabled={loading}
                  className="mt-6 px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:shadow-lg transform hover:scale-[1.02] transition-all font-semibold disabled:opacity-50"
                >
                  {loading ? 'Speichern...' : 'Änderungen speichern'}
                </button>
              </div>
            )}
            
            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Zahlungsmethoden</h2>
                
                <div className="space-y-6">
                  {/* Gespeicherte Zahlungsmethoden */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Gespeicherte Zahlungsmethoden</h3>
                    
                    {paymentMethods.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-3">💳</div>
                        <p className="text-gray-400">Keine Zahlungsmethoden hinterlegt</p>
                        <p className="text-gray-500 text-sm mt-1">Fügen Sie eine Zahlungsmethode hinzu, um Zahlungen zu tätigen.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {paymentMethods.map((method, index) => (
                          <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex items-center gap-4">
                              <div className="text-2xl">
                                {method.type === 'card' && '💳'}
                                {method.type === 'paypal' && '🅿️'}
                                {method.type === 'sepa' && '🏦'}
                                {method.type === 'giropay' && '🔵'}
                                {method.type === 'sofort' && '🟠'}
                              </div>
                              <div>
                                <p className="text-white font-medium">
                                  {method.type === 'card' && `•••• •••• •••• ${method.last4}`}
                                  {method.type === 'paypal' && method.email}
                                  {method.type === 'sepa' && `IBAN: •••• ${method.last4}`}
                                  {method.type === 'giropay' && 'Giropay'}
                                  {method.type === 'sofort' && 'Sofortüberweisung'}
                                </p>
                                <p className="text-gray-400 text-sm">
                                  {method.type === 'card' && `${method.brand} • Gültig bis ${method.expMonth}/${method.expYear}`}
                                  {method.type === 'sepa' && method.bankName}
                                  {method.isDefault && <span className="text-teal-400 ml-2">★ Standard</span>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!method.isDefault && (
                                <button
                                  onClick={() => setDefaultPaymentMethod(method.id)}
                                  className="px-3 py-1 text-sm text-teal-400 hover:text-teal-300 transition-colors"
                                >
                                  Als Standard
                                </button>
                              )}
                              <button
                                onClick={() => removePaymentMethod(method.id)}
                                className="px-3 py-1 text-sm text-red-400 hover:text-red-300 transition-colors"
                              >
                                Entfernen
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Neue Zahlungsmethode hinzufügen */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Zahlungsmethode hinzufügen</h3>
                    
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Kreditkarte */}
                      <button
                        onClick={() => openPaymentModal('card')}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/20 hover:border-teal-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">💳</span>
                          <span className="text-white font-medium group-hover:text-teal-400 transition-colors">Kreditkarte</span>
                        </div>
                        <p className="text-gray-400 text-sm text-left">Visa, Mastercard, American Express</p>
                        <div className="flex gap-2 mt-3">
                          <img src="https://cdn.jsdelivr.net/gh/nicoprofe/logos@main/visa.svg" alt="Visa" className="h-6 opacity-60" onError={(e) => e.target.style.display='none'} />
                          <img src="https://cdn.jsdelivr.net/gh/nicoprofe/logos@main/mastercard.svg" alt="Mastercard" className="h-6 opacity-60" onError={(e) => e.target.style.display='none'} />
                          <img src="https://cdn.jsdelivr.net/gh/nicoprofe/logos@main/amex.svg" alt="Amex" className="h-6 opacity-60" onError={(e) => e.target.style.display='none'} />
                        </div>
                      </button>
                      
                      {/* PayPal */}
                      <button
                        onClick={() => openPaymentModal('paypal')}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/20 hover:border-teal-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">🅿️</span>
                          <span className="text-white font-medium group-hover:text-teal-400 transition-colors">PayPal</span>
                        </div>
                        <p className="text-gray-400 text-sm text-left">Schnell und sicher bezahlen</p>
                        <div className="flex gap-2 mt-3">
                          <div className="px-3 py-1 bg-[#003087] rounded text-white text-xs font-bold">PayPal</div>
                        </div>
                      </button>
                      
                      {/* SEPA Lastschrift */}
                      <button
                        onClick={() => openPaymentModal('sepa')}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/20 hover:border-teal-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">🏦</span>
                          <span className="text-white font-medium group-hover:text-teal-400 transition-colors">SEPA-Lastschrift</span>
                        </div>
                        <p className="text-gray-400 text-sm text-left">Direkt vom Bankkonto abbuchen</p>
                        <div className="flex gap-2 mt-3">
                          <div className="px-3 py-1 bg-blue-600 rounded text-white text-xs font-bold">SEPA</div>
                        </div>
                      </button>
                      
                      {/* Giropay */}
                      <button
                        onClick={() => openPaymentModal('giropay')}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/20 hover:border-teal-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">🔵</span>
                          <span className="text-white font-medium group-hover:text-teal-400 transition-colors">Giropay</span>
                        </div>
                        <p className="text-gray-400 text-sm text-left">Online-Überweisung mit Ihrer Bank</p>
                        <div className="flex gap-2 mt-3">
                          <div className="px-3 py-1 bg-[#003a7d] rounded text-white text-xs font-bold">giropay</div>
                        </div>
                      </button>
                      
                      {/* Sofortüberweisung / Klarna */}
                      <button
                        onClick={() => openPaymentModal('sofort')}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/20 hover:border-teal-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">🟠</span>
                          <span className="text-white font-medium group-hover:text-teal-400 transition-colors">Sofortüberweisung</span>
                        </div>
                        <p className="text-gray-400 text-sm text-left">Powered by Klarna</p>
                        <div className="flex gap-2 mt-3">
                          <div className="px-3 py-1 bg-[#ff6900] rounded text-white text-xs font-bold">Klarna</div>
                        </div>
                      </button>
                      
                      {/* Apple Pay */}
                      <button
                        onClick={() => openPaymentModal('apple_pay')}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/20 hover:border-teal-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">🍎</span>
                          <span className="text-white font-medium group-hover:text-teal-400 transition-colors">Apple Pay</span>
                        </div>
                        <p className="text-gray-400 text-sm text-left">Schnell mit Apple Geräten</p>
                        <div className="flex gap-2 mt-3">
                          <div className="px-3 py-1 bg-black rounded text-white text-xs font-bold"> Pay</div>
                        </div>
                      </button>
                      
                      {/* Google Pay */}
                      <button
                        onClick={() => openPaymentModal('google_pay')}
                        className="p-4 bg-white/5 hover:bg-white/10 rounded-lg border border-white/20 hover:border-teal-500/50 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">🔷</span>
                          <span className="text-white font-medium group-hover:text-teal-400 transition-colors">Google Pay</span>
                        </div>
                        <p className="text-gray-400 text-sm text-left">Schnell mit Google bezahlen</p>
                        <div className="flex gap-2 mt-3">
                          <div className="px-3 py-1 bg-white rounded text-gray-800 text-xs font-bold">G Pay</div>
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  {/* Rechnungsadresse */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Rechnungsadresse</h3>
                    
                    <div className="space-y-4">
                      <label className="flex items-center gap-3 text-white cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={billingAddressSameAsPersonal}
                          onChange={(e) => setBillingAddressSameAsPersonal(e.target.checked)}
                          className="w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded" 
                        />
                        <span>Gleiche Adresse wie persönliche Daten</span>
                      </label>
                      
                      {!billingAddressSameAsPersonal && (
                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="block text-white/70 text-sm mb-2">Firmenname (optional)</label>
                            <input
                              type="text"
                              value={billingAddress.companyName}
                              onChange={(e) => setBillingAddress({...billingAddress, companyName: e.target.value})}
                              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                              placeholder="Firma GmbH"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-white/70 text-sm mb-2">Vollständiger Name</label>
                            <input
                              type="text"
                              value={billingAddress.fullName}
                              onChange={(e) => setBillingAddress({...billingAddress, fullName: e.target.value})}
                              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                              placeholder="Max Mustermann"
                            />
                          </div>
                          
                          <div className="md:col-span-2 grid md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                              <label className="block text-white/70 text-sm mb-2">Straße</label>
                              <input
                                type="text"
                                value={billingAddress.street}
                                onChange={(e) => setBillingAddress({...billingAddress, street: e.target.value})}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            </div>
                            <div>
                              <label className="block text-white/70 text-sm mb-2">Hausnummer</label>
                              <input
                                type="text"
                                value={billingAddress.houseNumber}
                                onChange={(e) => setBillingAddress({...billingAddress, houseNumber: e.target.value})}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-white/70 text-sm mb-2">PLZ</label>
                            <input
                              type="text"
                              value={billingAddress.zipCode}
                              onChange={(e) => setBillingAddress({...billingAddress, zipCode: e.target.value})}
                              maxLength="5"
                              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-white/70 text-sm mb-2">Stadt</label>
                            <input
                              type="text"
                              value={billingAddress.city}
                              onChange={(e) => setBillingAddress({...billingAddress, city: e.target.value})}
                              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-white/70 text-sm mb-2">Land</label>
                            <select
                              value={billingAddress.country}
                              onChange={(e) => setBillingAddress({...billingAddress, country: e.target.value})}
                              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                            >
                              <option value="DE">Deutschland</option>
                              <option value="AT">Österreich</option>
                              <option value="CH">Schweiz</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-white/70 text-sm mb-2">USt-IdNr. (optional)</label>
                            <input
                              type="text"
                              value={billingAddress.vatId}
                              onChange={(e) => setBillingAddress({...billingAddress, vatId: e.target.value})}
                              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                              placeholder="DE123456789"
                            />
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={saveBillingAddress}
                        disabled={loading}
                        className="mt-4 px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        Rechnungsadresse speichern
                      </button>
                    </div>
                  </div>
                  
                  {/* Zahlungshistorie */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-white">Zahlungshistorie</h3>
                      <button
                        onClick={downloadInvoices}
                        className="text-teal-400 hover:text-teal-300 text-sm transition-colors"
                      >
                        Alle Rechnungen herunterladen
                      </button>
                    </div>
                    
                    {paymentHistory.length === 0 ? (
                      <p className="text-gray-400 text-center py-4">Noch keine Zahlungen getätigt</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="text-left text-gray-400 text-sm border-b border-white/10">
                              <th className="pb-3">Datum</th>
                              <th className="pb-3">Beschreibung</th>
                              <th className="pb-3">Betrag</th>
                              <th className="pb-3">Status</th>
                              <th className="pb-3">Rechnung</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentHistory.map((payment, index) => (
                              <tr key={index} className="border-b border-white/5">
                                <td className="py-3 text-gray-300">
                                  {new Date(payment.date).toLocaleDateString('de-DE')}
                                </td>
                                <td className="py-3 text-white">{payment.description}</td>
                                <td className="py-3 text-white font-medium">
                                  {payment.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                                </td>
                                <td className="py-3">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    payment.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                    payment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                    payment.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                                  }`}>
                                    {payment.status === 'completed' ? 'Bezahlt' :
                                     payment.status === 'pending' ? 'Ausstehend' :
                                     payment.status === 'failed' ? 'Fehlgeschlagen' :
                                     payment.status === 'refunded' ? 'Erstattet' : payment.status}
                                  </span>
                                </td>
                                <td className="py-3">
                                  {payment.invoiceUrl && (
                                    <a
                                      href={payment.invoiceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-teal-400 hover:text-teal-300 text-sm"
                                    >
                                      PDF ↓
                                    </a>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  
                  {/* Sicherheitshinweis */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-xl">🔒</span>
                      <div>
                        <p className="text-blue-300 font-medium">Sichere Zahlungsabwicklung</p>
                        <p className="text-blue-200/70 text-sm mt-1">
                          Alle Zahlungen werden über Stripe abgewickelt. Ihre Zahlungsdaten werden verschlüsselt übertragen 
                          und niemals auf unseren Servern gespeichert. Stripe ist PCI DSS Level 1 zertifiziert.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Benachrichtigungen</h2>
                
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-4 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                    <div>
                      <p className="text-white font-medium">E-Mail-Benachrichtigungen</p>
                      <p className="text-gray-400 text-sm">Erhalten Sie wichtige Updates per E-Mail</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.emailNotifications}
                      onChange={(e) => setNotifications({...notifications, emailNotifications: e.target.checked})}
                      className="w-5 h-5 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between p-4 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                    <div>
                      <p className="text-white font-medium">Projekt-Updates</p>
                      <p className="text-gray-400 text-sm">Benachrichtigungen bei Änderungen an Ihren Projekten</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.projectUpdates}
                      onChange={(e) => setNotifications({...notifications, projectUpdates: e.target.checked})}
                      className="w-5 h-5 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
                    />
                  </label>
                  
                  <label className="flex items-center justify-between p-4 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                    <div>
                      <p className="text-white font-medium">Angebots-Benachrichtigungen</p>
                      <p className="text-gray-400 text-sm">Sofortige Benachrichtigung bei neuen Angeboten</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.offerAlerts}
                      onChange={(e) => setNotifications({...notifications, offerAlerts: e.target.checked})}
                      className="w-5 h-5 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
                    />
                  </label>

                 <label className="flex items-center justify-between p-4 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                    <div>
                      <p className="text-white font-medium">Wöchentliche Zusammenfassung</p>
                      <p className="text-gray-400 text-sm">Erhalten Sie eine wöchentliche Übersicht</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.weeklyDigest}
                      onChange={(e) => setNotifications({...notifications, weeklyDigest: e.target.checked})}
                      className="w-5 h-5 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
                    />
                  </label>
                </div>
                  
                <button
                  onClick={saveNotifications}
                  disabled={loading}
                  className="mt-6 px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:shadow-lg transform hover:scale-[1.02] transition-all font-semibold disabled:opacity-50"
                >
                  {loading ? 'Speichern...' : 'Einstellungen speichern'}
                </button>
              </div>
            )}
            
            {/* Security Tab */}
            {activeTab === 'security' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Sicherheit</h2>
                
                <div className="space-y-6">
                  {/* Password Change */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Passwort ändern</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-white/70 text-sm mb-2">Aktuelles Passwort</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-white/70 text-sm mb-2">Neues Passwort</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-white/70 text-sm mb-2">Passwort bestätigen</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <button
                        onClick={changePassword}
                        disabled={loading || !currentPassword || !newPassword}
                        className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        Passwort ändern
                      </button>
                    </div>
                  </div>
                  
                  {/* Two-Factor Authentication */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-2">Zwei-Faktor-Authentifizierung</h3>
                        <p className="text-gray-400 text-sm">
                          Erhöhen Sie die Sicherheit Ihres Accounts mit 2FA
                        </p>
                      </div>
                      <button
                        onClick={toggleTwoFactor}
                        disabled={loading}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          twoFactorEnabled
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-teal-500 hover:bg-teal-600 text-white'
                        }`}
                      >
                        {twoFactorEnabled ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Account Info */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Account-Informationen</h3>
                    <div className="space-y-2 text-gray-300">
                      <p>
                        <span className="text-gray-500">Registriert am:</span>{' '}
                        {createdAt ? new Date(createdAt).toLocaleDateString('de-DE') : '-'}
                      </p>
                      <p>
                        <span className="text-gray-500">E-Mail Status:</span>{' '}
                        <span className={emailVerified ? 'text-green-400' : 'text-yellow-400'}>
                          {emailVerified ? 'Verifiziert' : 'Nicht verifiziert'}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Datenschutz</h2>
                
                <div className="space-y-6">
                  {/* Data Export */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">Datenexport (DSGVO)</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Laden Sie alle Ihre gespeicherten Daten herunter
                    </p>
                    <button
                      onClick={exportData}
                      disabled={loading}
                      className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      Daten exportieren
                    </button>
                  </div>
                  
                  {/* Privacy Settings */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Datenschutzeinstellungen</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 text-white cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded" />
                        <span>Anonyme Nutzungsstatistiken teilen</span>
                      </label>
                      <label className="flex items-center gap-3 text-white cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded" />
                        <span>Personalisierte Empfehlungen</span>
                      </label>
                      <label className="flex items-center gap-3 text-white cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 text-teal-500 bg-white/20 border-white/30 rounded" />
                        <span>Marketing-Kommunikation</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Account Deletion */}
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-red-400 mb-2">Account löschen</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Diese Aktion kann nicht rückgängig gemacht werden. Alle Ihre Daten werden permanent gelöscht.
                    </p>
                    <button
                      onClick={deleteAccount}
                      disabled={loading}
                      className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      Account unwiderruflich löschen
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Help Tab */}
            {activeTab === 'help' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Hilfe & Support</h2>
                
                <div className="space-y-6">
                  {/* FAQ Suche */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <label className="block text-white/90 text-sm font-medium mb-2">FAQ durchsuchen</label>
                    <input
                      type="search"
                      placeholder="Frage oder Stichwort eingeben..."
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  {/* Erste Schritte */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Erste Schritte</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Was ist byndl und wie funktioniert es?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p>byndl ist Ihre digitale Plattform für Bauprojekte. Wir helfen Ihnen vom ersten Projektgedanken bis zur fertigen Baustelle.</p>
                          <p className="font-medium text-white">Die Vorteile auf einen Blick:</p>
                          <ul className="list-none space-y-1">
                            <li>✓ Zeitersparnis: Keine mühsame LV-Erstellung per Hand</li>
                            <li>✓ Transparenz: Klare Preise und vergleichbare Angebote</li>
                            <li>✓ Sicherheit: VOB-konforme Verträge und geprüfte Handwerker</li>
                            <li>✓ Unterstützung: KI-gestützte Bewertung und Terminplanung</li>
                            <li>✓ Alles an einem Ort: Von der Planung bis zur Abnahme</li>
                          </ul>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wie starte ich mein erstes Projekt?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p><strong className="text-white">1. Projekt anlegen (5-10 Minuten)</strong></p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Projektadresse eingeben</li>
                            <li>Kategorien wählen</li>
                            <li>Vorhaben beschreiben</li>
                          </ul>
                          <p><strong className="text-white">2. KI-Gewerkeerkennung (automatisch)</strong></p>
                          <ul className="list-disc list-inside ml-2">
                            <li>KI analysiert Ihre Beschreibung</li>
                            <li>Erkennt benötigte Gewerke</li>
                          </ul>
                          <p><strong className="text-white">3. Fragen beantworten (10-30 Min. pro Gewerk)</strong></p>
                          <p><strong className="text-white">4. LV-Generierung & Ausschreibung (automatisch)</strong></p>
                        </div>
                      </details>
                    </div>
                  </div>

                  {/* Leistungsverzeichnisse */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Leistungsverzeichnisse</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Was ist ein Leistungsverzeichnis?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <p className="mt-3 text-gray-300 text-sm pl-4">
                          Ein Leistungsverzeichnis (LV) ist die detaillierte Auflistung aller Bauleistungen. 
                          Es ist die Grundlage für vergleichbare Angebote und verbindliche Verträge.
                        </p>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Kann ich das LV nachträglich ändern?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <p className="mt-3 text-gray-300 text-sm pl-4">
                          Ja! Sie können Positionen bearbeiten, löschen oder neue hinzufügen. 
                          Nach der Ausschreibung ist das LV fixiert. Änderungen sind dann nur über Nachträge möglich.
                        </p>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wie funktioniert die Ausschreibung?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <p className="mt-3 text-gray-300 text-sm pl-4">
                          Nach Erstellung der Leistungsverzeichnisse werden diese automatisch an passende, 
                          verifizierte Handwerker in Ihrer Region gesendet. Diese können dann Angebote abgeben, 
                          die Sie direkt vergleichen können.
                        </p>
                      </details>
                    </div>
                  </div>

                  {/* Kosten */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Kosten & Preise</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Was kostet byndl?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p className="font-medium text-white">Einmalige Gebühr pro Projekt:</p>
                          <ul className="list-none space-y-1">
                            <li>• 1-2 Gewerke: <span className="text-teal-400 font-semibold">29,90 €</span></li>
                            <li>• 3-5 Gewerke: <span className="text-teal-400 font-semibold">59,90 €</span></li>
                            <li>• Ab 6 Gewerken: <span className="text-teal-400 font-semibold">99,90 €</span></li>
                          </ul>
                          <p className="text-green-400 font-medium mt-2">KEINE Provisionen, KEINE versteckten Kosten!</p>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wann muss ich bezahlen?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <p className="mt-3 text-gray-300 text-sm pl-4">
                          Die Zahlung erfolgt erst nach erfolgreicher Gewerkeerkennung und Empfehlungen zu Ihrem Projekt, 
                          aber bevor die Leistungsverzeichnisse zu Ihrem Projekt erstellt werden können.
                        </p>
                      </details>
                    </div>
                  </div>

                  {/* Handwerker & Angebote */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Handwerker & Angebote</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wie werden Handwerker ausgewählt?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <p className="mt-3 text-gray-300 text-sm pl-4">
                          Alle Handwerker auf byndl durchlaufen einen strengen Verifizierungsprozess und weisen qualifizierte Nachweise vor – 
                          darunter Handwerkskammer-Eintragung und Betriebshaftpflichtversicherung. Die intelligente Zuordnung von Projekten erfolgt nach Fachgebiet, Standort und Verfügbarkeit, um eine optimale Vermittlung zu gewährleisten.
                        </p>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wie vergleiche ich Angebote?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <p className="mt-3 text-gray-300 text-sm pl-4">
                          In Ihrem Dashboard sehen Sie alle eingegangenen Angebote übersichtlich. 
                          Sie können Preise, Bewertungen und Verfügbarkeit direkt vergleichen. 
                          Die KI hilft bei der Einschätzung der Angebote.
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
                  
                  {/* Feedback */}
<div className="bg-white/5 rounded-lg p-6">
  <h3 className="text-lg font-semibold text-white mb-4">Feedback senden</h3>
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
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}
