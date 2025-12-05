// PROFESSIONELLE VERSION mit Vorname/Nachname getrennt
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';
import InvoicesTab from './InvoicesTab';
import PaymentMethodsTab from './PaymentMethodsTab';

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
    name: '',  
    email: '',
    phone: '',
    street: '',
    houseNumber: '',
    zipCode: '',
    city: ''
  });
  
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
  const [emailVerified, setEmailVerified] = useState(false);
  const [createdAt, setCreatedAt] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [faqSearchTerm, setFaqSearchTerm] = useState('');
  const [supportForm, setSupportForm] = useState({ subject: '', message: '' });
  const [supportLoading, setSupportLoading] = useState(false);
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [confirmNewEmail, setConfirmNewEmail] = useState('');
  
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

  // Vor savePersonalData() einfügen:
const changeEmail = async () => {
  // Validierung
  if (!newEmail.trim()) {
    setError('Bitte geben Sie eine neue E-Mail-Adresse ein');
    setTimeout(() => setError(''), 3000);
    return;
  }
  
  if (newEmail !== confirmNewEmail) {
    setError('Die E-Mail-Adressen stimmen nicht überein');
    setTimeout(() => setError(''), 3000);
    return;
  }
  
  // E-Mail Format validieren
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    setError('Ungültige E-Mail-Adresse');
    setTimeout(() => setError(''), 3000);
    return;
  }
  
  try {
    setLoading(true);
    setError('');
    const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
    
    const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/personal`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...personalData,
        email: newEmail
      })
    });
    
    if (res.ok) {
      // Update local state
      setPersonalData({...personalData, email: newEmail});
      
      // Session Storage aktualisieren
      const updatedUserData = {
        ...userData,
        email: newEmail
      };
      sessionStorage.setItem('userData', JSON.stringify(updatedUserData));
      sessionStorage.setItem('bauherrData', JSON.stringify(updatedUserData));
      
      // Felder zurücksetzen und ausblenden
      setNewEmail('');
      setConfirmNewEmail('');
      setShowEmailChange(false);
      
      setMessage('✅ E-Mail-Adresse erfolgreich geändert');
      setTimeout(() => setMessage(''), 3000);
    } else {
      throw new Error('Speichern fehlgeschlagen');
    }
  } catch (err) {
    setError('Fehler beim Ändern der E-Mail-Adresse');
  } finally {
    setLoading(false);
  }
};
  
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
  
  /* Coming Soon
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
  */
  
  /* Moved to Admin Panel
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
  */
  
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

// Support-Anfrage senden
  const sendSupportRequest = async () => {
    if (!supportForm.subject.trim() || !supportForm.message.trim()) {
      setError('Bitte füllen Sie Betreff und Nachricht aus.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    try {
      setSupportLoading(true);
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl('/api/feedback'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userData?.id,
          userType: 'bauherr',
          userName: `${personalData.firstName} ${personalData.lastName}`,
          userEmail: personalData.email,
          feedbackText: `[${supportForm.subject}]\n\n${supportForm.message}`
        })
      });
      
      if (res.ok) {
        setSupportForm({ subject: '', message: '' });
        setMessage('✅ Support-Anfrage erfolgreich gesendet! Wir melden uns innerhalb von 24 Stunden.');
        setTimeout(() => setMessage(''), 5000);
      } else {
        throw new Error('Senden fehlgeschlagen');
      }
    } catch (err) {
      setError('Fehler beim Senden der Anfrage. Bitte versuchen Sie es erneut.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setSupportLoading(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Persönliche Daten', icon: '👤' },
    { id: 'payment', label: 'Zahlungsmethoden', icon: '💳' },
    { id: 'invoices', label: 'Rechnungen', icon: '🧾' }, 
    { id: 'account', label: 'Account', icon: '🔒' },
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
  <div className="flex gap-2">
    <input
      type="email"
      value={personalData.email}
      disabled
      className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-gray-400"
    />
    <button
      type="button"
      onClick={() => setShowEmailChange(!showEmailChange)}
      className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors whitespace-nowrap"
    >
      {showEmailChange ? 'Abbrechen' : 'E-Mail-Adresse ändern'}
    </button>
  </div>
  
  {/* Zusätzliche Felder wenn showEmailChange = true */}
  {showEmailChange && (
    <div className="mt-4 p-4 bg-white/5 rounded-lg border border-white/10 space-y-4">
      <div>
        <label className="block text-white/70 text-sm mb-2">Neue E-Mail-Adresse</label>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="neue@email.de"
        />
      </div>
      
      <div>
        <label className="block text-white/70 text-sm mb-2">Neue E-Mail-Adresse bestätigen</label>
        <input
          type="email"
          value={confirmNewEmail}
          onChange={(e) => setConfirmNewEmail(e.target.value)}
          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          placeholder="neue@email.de"
        />
      </div>
      
      <button
        type="button"
        onClick={changeEmail}
        disabled={loading || !newEmail || !confirmNewEmail}
        className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
      >
        ✓ Änderung bestätigen
      </button>
    </div>
  )}
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
              <PaymentMethodsTab 
                userType="bauherr" 
                userId={JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData') || '{}').id} 
              />
            )}
            
            {/* Rechnungen Tab */}
            {activeTab === 'invoices' && (
              <InvoicesTab 
                userType="bauherr" 
                userId={JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData') || '{}').id} 
              />
            )}

            {/* Security Tab */}
            {activeTab === 'account' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-6">Account</h2>
                
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
                  
                  {/* Two-Factor Authentication - Coming Soon
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
                  */}
                  
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
                  
                  {/* DSGVO Hinweis */}
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-400 mb-2">Datenauskunft (DSGVO)</h3>
                    <p className="text-gray-300 text-sm mb-3">
                      Sie haben das Recht auf Auskunft über Ihre gespeicherten personenbezogenen Daten gemäß Art. 15 DSGVO.
                    </p>
                    <p className="text-gray-300 text-sm">
                      Für Anfragen zur Datenauskunft oder zum Datenexport senden Sie bitte eine E-Mail an:{' '}
                      <a href="mailto:info@byndl.de" className="text-teal-400 hover:text-teal-300 font-semibold">
                        info@byndl.de
                      </a>
                    </p>
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

              {/* HIER EINFÜGEN */}
              {message && (
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-4">
                  <p className="text-green-300">{message}</p>
                </div>
              )}
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-4">
                  <p className="text-red-300">{error}</p>
                </div>
              )}
                
                <div className="space-y-6">
                  {/* FAQ Suche - Funktional */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <label className="block text-white/90 text-sm font-medium mb-2">FAQ durchsuchen</label>
                    <div className="relative">
                      <input
                        type="search"
                        placeholder="Frage oder Stichwort eingeben..."
                        value={faqSearchTerm}
                        onChange={(e) => setFaqSearchTerm(e.target.value)}
                        className="w-full px-4 py-3 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                      </svg>
                    </div>
                    {faqSearchTerm && (
                      <p className="text-gray-400 text-sm mt-2">
                        Zeige Ergebnisse für: <span className="text-teal-400">"{faqSearchTerm}"</span>
                      </p>
                    )}
                  </div>

                  {/* Plattform-Vorteile */}
                  {(!faqSearchTerm || 'vorteile plattform unterschied byndl ki'.includes(faqSearchTerm.toLowerCase())) && (
                  <div className="bg-gradient-to-br from-teal-900/30 to-blue-900/30 border border-teal-500/30 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-teal-400 mb-4">Warum byndl?</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3" open>
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Was unterscheidet byndl von anderen Plattformen?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-3">
                          <p>byndl revolutioniert die Art, wie Bauprojekte geplant und umgesetzt werden:</p>
                          
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="font-medium text-teal-400 mb-2">🤖 KI-gestützte Projekterfassung</p>
                            <p>Beschreiben Sie Ihr Projekt in eigenen Worten – unsere KI erkennt automatisch die benötigten Gewerke und erstellt professionelle Leistungsverzeichnisse. Kein Fachwissen erforderlich!</p>
                          </div>
                          
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="font-medium text-teal-400 mb-2">📋 Professionelle Leistungsverzeichnisse</p>
                            <p>Statt vager Projektbeschreibungen erhalten Handwerker detaillierte, VOB-konforme Leistungsverzeichnisse. Das ermöglicht präzise, vergleichbare Angebote.</p>
                          </div>
                          
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="font-medium text-teal-400 mb-2">🤝 Zweistufige Vergabe</p>
                            <p>Erst vorläufige Beauftragung mit Kennenlernphase, dann verbindlicher Vertrag. Sie und der Handwerker können sich kennenlernen und Details klären, bevor es verbindlich wird.</p>
                          </div>
                          
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="font-medium text-teal-400 mb-2">📦 Projektbündelung</p>
                            <p>Ähnliche Projekte in Ihrer Region werden gebündelt – Handwerker sparen Fahrtwege und können bessere Preise anbieten.</p>
                          </div>
                          
                          <div className="bg-white/5 rounded-lg p-3">
                            <p className="font-medium text-teal-400 mb-2">💰 Faire, transparente Preise</p>
                            <p>Sie zahlen nur für die Erstellung der Leistungsverzeichnisse – keine Provisionen, keine versteckten Kosten bei der Auftragsvergabe.</p>
                          </div>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Was ist die zweistufige Vergabe und warum ist sie vorteilhaft?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p className="font-medium text-white">Stufe 1: Vorläufige Beauftragung</p>
                          <ul className="list-disc list-inside ml-2 mb-3">
                            <li>Sie wählen ein Angebot aus und geben die Kontaktdaten frei</li>
                            <li>Kennenlernphase: Ortstermin, Videocall oder Telefongespräch</li>
                            <li>Der Handwerker kann sein Angebot nach der Besichtigung anpassen</li>
                            <li>Beide Seiten können ohne Verpflichtung zurücktreten</li>
                          </ul>
                          <p className="font-medium text-white">Stufe 2: Verbindliche Beauftragung</p>
                          <ul className="list-disc list-inside ml-2 mb-3">
                            <li>Nach der Kennenlernphase bestätigt der Handwerker sein finales Angebot</li>
                            <li>Sie erteilen den verbindlichen Auftrag</li>
                            <li>Der Werkvertrag kommt zustande</li>
                          </ul>
                          <p className="text-teal-400 font-medium">Vorteil: Keine Überraschungen! Sie kennen den Handwerker und er kennt Ihr Projekt, bevor es verbindlich wird.</p>
                        </div>
                      </details>
                    </div>
                  </div>
                  )}

                  {/* Erste Schritte */}
                  {(!faqSearchTerm || 'start anfang projekt erstellen anlegen'.includes(faqSearchTerm.toLowerCase())) && (
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Erste Schritte</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wie starte ich mein erstes Projekt?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p><strong className="text-white">1. Projekt anlegen (5-10 Minuten)</strong></p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Klicken Sie auf "Neues Projekt" im Dashboard</li>
                            <li>Geben Sie die Projektadresse ein</li>
                            <li>Beschreiben Sie Ihr Vorhaben in eigenen Worten</li>
                          </ul>
                          <p><strong className="text-white">2. KI-Analyse (automatisch)</strong></p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Die KI analysiert Ihre Beschreibung</li>
                            <li>Erkennt automatisch die benötigten Gewerke</li>
                            <li>Schlägt passende Leistungen vor</li>
                          </ul>
                          <p><strong className="text-white">3. Fragen beantworten (5-15 Min. pro Gewerk)</strong></p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Beantworten Sie spezifische Fragen zu jedem Gewerk</li>
                            <li>Je genauer Ihre Angaben, desto präziser die Angebote</li>
                          </ul>
                          <p><strong className="text-white">4. Zahlung & LV-Erstellung</strong></p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Bezahlen Sie die Gebühr für die Leistungsverzeichnisse</li>
                            <li>Die KI erstellt professionelle LVs für jedes Gewerk</li>
                          </ul>
                          <p><strong className="text-white">5. Ausschreibung & Angebote</strong></p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Passende Handwerker werden automatisch benachrichtigt</li>
                            <li>Sie erhalten vergleichbare Angebote</li>
                          </ul>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Was passiert nach der Angebotsannahme?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p><strong className="text-white">Nach der vorläufigen Beauftragung:</strong></p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Kontaktdaten werden ausgetauscht</li>
                            <li>Vereinbaren Sie einen Ortstermin oder Videocall</li>
                            <li>Der Handwerker prüft die Gegebenheiten vor Ort</li>
                            <li>Bei Bedarf wird das Angebot angepasst</li>
                          </ul>
                          <p><strong className="text-white">Nach der verbindlichen Beauftragung:</strong></p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Der Werkvertrag kommt zustande</li>
                            <li>Terminplanung und Bauablauf werden festgelegt</li>
                            <li>Kommunikation läuft über die Plattform</li>
                            <li>Nachträge können transparent abgewickelt werden</li>
                          </ul>
                        </div>
                      </details>
                    </div>
                  </div>
                  )}

                  {/* Leistungsverzeichnisse */}
                  {(!faqSearchTerm || 'lv leistungsverzeichnis ändern bearbeiten'.includes(faqSearchTerm.toLowerCase())) && (
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Leistungsverzeichnisse</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Was ist ein Leistungsverzeichnis (LV)?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p>Ein Leistungsverzeichnis ist die detaillierte Auflistung aller Bauleistungen mit Mengen, Einheiten und Beschreibungen.</p>
                          <p className="font-medium text-white">Vorteile eines professionellen LV:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Handwerker wissen genau, was zu tun ist</li>
                            <li>Angebote sind direkt vergleichbar</li>
                            <li>Grundlage für verbindliche Verträge</li>
                            <li>Weniger Nachträge und Überraschungen</li>
                            <li>VOB-konform und rechtssicher</li>
                          </ul>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wie erstellt die KI das Leistungsverzeichnis?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p>Die KI nutzt Ihre Projektbeschreibung und Ihre Antworten auf die Detailfragen:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Erkennung der Bauleistungen aus Ihrer Beschreibung</li>
                            <li>Zuordnung zu Standardpositionen nach VOB</li>
                            <li>Berechnung realistischer Mengen basierend auf Ihren Angaben</li>
                            <li>Ergänzung typischer Nebenpositionen (z.B. Untergrund vorbereiten)</li>
                            <li>Realistische Kostenschätzung aus Marktdaten</li>
                          </ul>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Kann ich das LV nachträglich ändern?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <p className="mt-3 text-gray-300 text-sm pl-4">
                          Ja, vor der Ausschreibung können Sie Positionen bearbeiten, löschen oder neue hinzufügen. 
                          Nach der Ausschreibung ist das LV fixiert – Änderungen sind dann nur noch über das Nachtragssystem möglich.
                        </p>
                      </details>
                    </div>
                  </div>
                  )}

                  {/* Kosten & Gebühren */}
                  {(!faqSearchTerm || 'kosten preis gebühr zahlung bezahlen euro'.includes(faqSearchTerm.toLowerCase())) && (
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Kosten & Gebühren</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Was kostet die Nutzung von byndl?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p className="font-medium text-white">Gebühren pro Leistungsverzeichnis:</p>
                          <div className="bg-white/5 rounded-lg p-3 space-y-2">
                            <div className="flex justify-between items-center">
                              <span>1-2 Gewerke im Projekt:</span>
                              <span className="text-teal-400 font-semibold">9,90 € pro LV</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>3-5 Gewerke im Projekt:</span>
                              <span className="text-teal-400 font-semibold">8,90 € pro LV</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Ab 6 Gewerke im Projekt:</span>
                              <span className="text-teal-400 font-semibold">7,90 € pro LV</span>
                            </div>
                          </div>
                          <p className="text-gray-400 text-xs mt-2">
                            Beispiel: Badsanierung mit 4 Gewerken = 4 × 8,90 € = 35,60 € gesamt
                          </p>
                          <p className="text-green-400 font-medium mt-3">✓ Keine Provisionen auf Auftragssummen</p>
                          <p className="text-green-400 font-medium">✓ Keine versteckten Kosten</p>
                          <p className="text-green-400 font-medium">✓ Keine Abo-Gebühren</p>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wann muss ich bezahlen?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <p className="mt-3 text-gray-300 text-sm pl-4">
                          Die Zahlung erfolgt nach der Gewerkeerkennung und bevor die Leistungsverzeichnisse erstellt werden. 
                          Sie sehen vorher genau, wie viele Gewerke erkannt wurden und was die Erstellung kostet.
                        </p>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Welche Zahlungsmethoden werden akzeptiert?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p>Wir bieten alle gängigen Zahlungsmethoden über unseren sicheren Zahlungsdienstleister Stripe:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Kreditkarte (Visa, Mastercard, American Express)</li>
                            <li>SEPA-Lastschrift</li>
                            <li>PayPal</li>
                            <li>Apple Pay & Google Pay</li>
                            <li>Klarna (Sofortüberweisung)</li>
                            <li>giropay</li>
                          </ul>
                          <p className="text-gray-400 text-xs mt-2">Ihre Zahlungsmethoden können Sie unter "Zahlungsmethoden" verwalten.</p>
                        </div>
                      </details>
                    </div>
                  </div>
                  )}

                  {/* Handwerker & Angebote */}
                  {(!faqSearchTerm || 'handwerker angebot auswahl vergleich'.includes(faqSearchTerm.toLowerCase())) && (
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Handwerker & Angebote</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wie werden Handwerker auf byndl geprüft?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p>Alle Handwerker durchlaufen einen Verifizierungsprozess:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Gewerbeanmeldung wird geprüft</li>
                            <li>Handwerkskammer-Eintragung (falls erforderlich)</li>
                            <li>Nachweis einer Betriebshaftpflichtversicherung</li>
                            <li>Prüfung der angegebenen Qualifikationen</li>
                          </ul>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wie vergleiche ich Angebote am besten?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p>Alle Angebote basieren auf demselben Leistungsverzeichnis – das macht sie direkt vergleichbar:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li><strong>Preis:</strong> Gesamtpreis und Einzelpreise pro Position</li>
                            <li><strong>Verfügbarkeit:</strong> Wann kann der Handwerker starten?</li>
                            <li><strong>Bewertungen:</strong> Erfahrungen anderer Bauherren</li>
                            <li><strong>Profil:</strong> Referenzen und Spezialisierungen</li>
                          </ul>
                          <p className="text-teal-400 mt-2">Tipp: Der günstigste Preis ist nicht immer die beste Wahl – achten Sie auch auf Bewertungen und Verfügbarkeit.</p>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Was passiert beim Ortstermin?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p>Der Ortstermin findet in der Kennenlernphase (Stufe 1) statt:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Der Handwerker prüft die örtlichen Gegebenheiten</li>
                            <li>Eventuelle Besonderheiten werden besprochen</li>
                            <li>Das Angebot kann bei Bedarf angepasst werden</li>
                            <li>Sie lernen den Handwerker persönlich kennen</li>
                          </ul>
                          <p className="text-gray-400 mt-2">Alternativ zum Ortstermin ist auch ein Videocall möglich.</p>
                        </div>
                      </details>
                    </div>
                  </div>
                  )}

                  {/* Nachträge */}
                  {(!faqSearchTerm || 'nachtrag änderung zusatz mehr'.includes(faqSearchTerm.toLowerCase())) && (
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Nachträge & Änderungen</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Was sind Nachträge?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p>Nachträge sind zusätzliche oder geänderte Leistungen, die nach Vertragsschluss entstehen:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>Unvorhergesehene Arbeiten (z.B. versteckter Schaden)</li>
                            <li>Änderungswünsche des Bauherrn</li>
                            <li>Mengenänderungen gegenüber dem LV</li>
                          </ul>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wie funktioniert das Nachtragssystem?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p>Nachträge werden transparent über die Plattform abgewickelt:</p>
                          <ol className="list-decimal list-inside ml-2">
                            <li>Der Handwerker stellt einen Nachtrag mit Begründung und Preis</li>
                            <li>Sie erhalten eine Benachrichtigung</li>
                            <li>Prüfen Sie den Nachtrag und die Begründung</li>
                            <li>Akzeptieren oder lehnen Sie ab</li>
                            <li>Bei Akzeptanz wird der Nachtrag Teil des Auftrags</li>
                          </ol>
                          <p className="text-teal-400 mt-2">Vorteil: Alles ist dokumentiert – keine mündlichen Absprachen, die später zu Streit führen.</p>
                        </div>
                      </details>
                    </div>
                  </div>
                  )}

                  {/* Sicherheit & Datenschutz */}
                  {(!faqSearchTerm || 'sicherheit daten datenschutz vertrag'.includes(faqSearchTerm.toLowerCase())) && (
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Sicherheit & Datenschutz</h3>
                    <div className="space-y-3">
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wie sicher sind meine Daten?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <div className="mt-3 text-gray-300 text-sm pl-4 space-y-2">
                          <p>Wir nehmen Datenschutz sehr ernst:</p>
                          <ul className="list-disc list-inside ml-2">
                            <li>DSGVO-konforme Datenverarbeitung</li>
                            <li>Verschlüsselte Datenübertragung (SSL/TLS)</li>
                            <li>Server in Deutschland</li>
                            <li>Keine Weitergabe an Dritte ohne Ihre Zustimmung</li>
                          </ul>
                        </div>
                      </details>
                      
                      <details className="group border-b border-white/10 pb-3">
                        <summary className="cursor-pointer text-white hover:text-teal-400 transition-colors font-medium flex justify-between items-center">
                          <span>Wer schließt den Vertrag mit dem Handwerker?</span>
                          <span className="text-teal-400 group-open:rotate-45 transition-transform">+</span>
                        </summary>
                        <p className="mt-3 text-gray-300 text-sm pl-4">
                          Der Werkvertrag kommt direkt zwischen Ihnen und dem Handwerker zustande. 
                          byndl ist nur Vermittler und nicht Vertragspartei. Sie haben alle Rechte und Pflichten 
                          direkt gegenüber dem Handwerker – wie bei einem traditionellen Auftrag, nur besser dokumentiert.
                        </p>
                      </details>
                    </div>
                  </div>
                  )}

                  {/* Support kontaktieren */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Support kontaktieren</h3>
                    
                    {/* Kontakt-Info */}
                    <div className="mb-6 p-4 bg-teal-900/20 border border-teal-500/30 rounded-lg">
                      <a href="mailto:support@byndl.de" className="flex items-center gap-3 text-teal-400 hover:text-teal-300 transition-colors text-lg font-medium">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                        </svg>
                        <span>support@byndl.de</span>
                      </a>
                      <p className="text-gray-400 text-sm mt-2 ml-9">
                        Antwort innerhalb von 24 Stunden (werktags)
                      </p>
                    </div>
                    
                    {/* Support-Formular */}
                    <div className="space-y-4">
                      <h4 className="text-white font-medium">Oder senden Sie uns direkt eine Nachricht:</h4>
                      
                      <div>
                        <label className="block text-gray-300 text-sm mb-1">Betreff</label>
                        <select
                          value={supportForm.subject}
                          onChange={(e) => setSupportForm({...supportForm, subject: e.target.value})}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="" className="bg-slate-800">Bitte wählen...</option>
                          <option value="Technisches Problem" className="bg-slate-800">Technisches Problem</option>
                          <option value="Frage zur Nutzung" className="bg-slate-800">Frage zur Nutzung</option>
                          <option value="Frage zu Kosten/Zahlung" className="bg-slate-800">Frage zu Kosten/Zahlung</option>
                          <option value="Problem mit Handwerker" className="bg-slate-800">Problem mit Handwerker</option>
                          <option value="Problem mit Projekt" className="bg-slate-800">Problem mit Projekt</option>
                          <option value="Feedback/Verbesserungsvorschlag" className="bg-slate-800">Feedback/Verbesserungsvorschlag</option>
                          <option value="Sonstiges" className="bg-slate-800">Sonstiges</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-gray-300 text-sm mb-1">Ihre Nachricht</label>
                        <textarea
                          placeholder="Beschreiben Sie Ihr Anliegen..."
                          value={supportForm.message}
                          onChange={(e) => setSupportForm({...supportForm, message: e.target.value})}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 h-32 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                          disabled={supportLoading}
                        />
                      </div>
                      
                      <button
                        onClick={sendSupportRequest}
                        disabled={supportLoading || !supportForm.subject || !supportForm.message.trim()}
                        className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                        </svg>
                        {supportLoading ? 'Wird gesendet...' : 'Anfrage senden'}
                      </button>
                    </div>
                  </div>
                  
                  {/* Feedback */}
                  <div className="bg-white/5 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Feedback & Verbesserungsvorschläge</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Ihre Meinung ist uns wichtig! Helfen Sie uns, byndl noch besser zu machen.
                    </p>
                    <textarea
                      placeholder="Was gefällt Ihnen? Was können wir verbessern?"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 h-32 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
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
