import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function BauherrenSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Form States
  const [personalData, setPersonalData] = useState({
    name: '',
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
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  useEffect(() => {
  const userData = sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData');
  if (!userData) {
    navigate('/bauherr/login');
    return;
  }
  
  const user = JSON.parse(userData);
  
  // loadSettings direkt im useEffect definieren
  const loadSettings = async (userId) => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/bauherr/${userId}/settings`));
      if (res.ok) {
        const data = await res.json();
        setPersonalData({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          street: data.street || '',
          houseNumber: data.house_number || '',
          zipCode: data.zip || '',
          city: data.city || ''
        });
        setNotifications(data.notification_settings || notifications);
        setTwoFactorEnabled(data.two_factor_enabled || false);
        setPaymentMethods(data.payment_methods || []);
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
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/personal`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personalData)
      });
      
      if (res.ok) {
        setMessage('Persönliche Daten gespeichert');
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error('Speichern fehlgeschlagen');
      }
    } catch (err) {
      setError('Fehler beim Speichern');
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
        throw new Error('Passwortänderung fehlgeschlagen');
      }
    } catch (err) {
      setError('Fehler beim Ändern des Passworts');
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
    const confirmText = prompt('Bitte geben Sie "LÖSCHEN" ein, um Ihren Account unwiderruflich zu löschen:');
    if (confirmText !== 'LÖSCHEN') {
      setError('Löschvorgang abgebrochen');
      return;
    }
    
    const password = prompt('Bitte geben Sie Ihr Passwort zur Bestätigung ein:');
    if (!password) {
      setError('Passwort erforderlich');
      return;
    }
    
    try {
      setLoading(true);
      const userData = JSON.parse(sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData'));
      
      const res = await fetch(apiUrl(`/api/bauherr/${userData.id}/account`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      
      if (res.ok) {
        sessionStorage.clear();
        navigate('/');
      } else {
        throw new Error('Account-Löschung fehlgeschlagen');
      }
    } catch (err) {
      setError('Fehler beim Löschen des Accounts');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Persönliche Daten', icon: '👤' },
    { id: 'payment', label: 'Zahlungen', icon: '💳' },
    { id: 'notifications', label: 'Benachrichtigungen', icon: '🔔' },
    { id: 'security', label: 'Sicherheit', icon: '🔒' },
    { id: 'privacy', label: 'Datenschutz', icon: '🛡️' },
    { id: 'help', label: 'Hilfe & Support', icon: '❓' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/bauherr/dashboard" className="text-2xl font-bold text-white hover:text-teal-400 transition-colors">
                ← Zurück zum Dashboard
              </Link>
            </div>
            <h1 className="text-xl text-white">Mein Profil & Einstellungen</h1>
          </div>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {message && (
          <div className="mb-4 bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-3">
            <p className="text-green-300">{message}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3">
            <p className="text-red-300">{error}</p>
          </div>
        )}
        
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-teal-500 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          
          {/* Personal Data Tab */}
          {activeTab === 'personal' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Persönliche Daten</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 text-sm mb-2">Name</label>
                  <input
                    type="text"
                    value={personalData.name}
                    onChange={(e) => setPersonalData({...personalData, name: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">E-Mail</label>
                  <input
                    type="email"
                    value={personalData.email}
                    onChange={(e) => setPersonalData({...personalData, email: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">Telefon</label>
                  <input
                    type="tel"
                    value={personalData.phone}
                    onChange={(e) => setPersonalData({...personalData, phone: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">Straße</label>
                  <input
                    type="text"
                    value={personalData.street}
                    onChange={(e) => setPersonalData({...personalData, street: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">Hausnummer</label>
                  <input
                    type="text"
                    value={personalData.houseNumber}
                    onChange={(e) => setPersonalData({...personalData, houseNumber: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">PLZ</label>
                  <input
                    type="text"
                    value={personalData.zipCode}
                    onChange={(e) => setPersonalData({...personalData, zipCode: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">Stadt</label>
                  <input
                    type="text"
                    value={personalData.city}
                    onChange={(e) => setPersonalData({...personalData, city: e.target.value})}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  />
                </div>
              </div>
              <button
                onClick={savePersonalData}
                disabled={loading}
                className="mt-6 px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          )}
          
          {/* Payment Tab */}
          {activeTab === 'payment' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Zahlungsmethoden</h2>
              
              <div className="space-y-4 mb-6">
                {paymentMethods.length === 0 ? (
                  <p className="text-gray-400">Keine Zahlungsmethoden hinterlegt</p>
                ) : (
                  paymentMethods.map((method, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-4 flex justify-between items-center">
                      <div>
                        <p className="text-white font-medium">{method.type}</p>
                        <p className="text-gray-400 text-sm">{method.details}</p>
                      </div>
                      <button className="text-red-400 hover:text-red-300">
                        Entfernen
                      </button>
                    </div>
                  ))
                )}
              </div>
              
              <button className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors">
                + Zahlungsmethode hinzufügen
              </button>
            </div>
          )}
          
          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Benachrichtigungen</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white font-medium">E-Mail-Benachrichtigungen</p>
                    <p className="text-gray-400 text-sm">Erhalten Sie Updates per E-Mail</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.emailNotifications}
                      onChange={(e) => setNotifications({...notifications, emailNotifications: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white font-medium">SMS-Benachrichtigungen</p>
                    <p className="text-gray-400 text-sm">Wichtige Updates per SMS</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.smsNotifications}
                      onChange={(e) => setNotifications({...notifications, smsNotifications: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Projekt-Updates</p>
                    <p className="text-gray-400 text-sm">Fortschritte und Änderungen in Ihren Projekten</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.projectUpdates}
                      onChange={(e) => setNotifications({...notifications, projectUpdates: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white font-medium">Angebots-Benachrichtigungen</p>
                    <p className="text-gray-400 text-sm">Neue Angebote von Handwerkern</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.offerAlerts}
                      onChange={(e) => setNotifications({...notifications, offerAlerts: e.target.checked})}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                  </label>
                </div>
              </div>
              
              <button
                onClick={saveNotifications}
                disabled={loading}
                className="mt-6 px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:opacity-50"
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
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm mb-2">Neues Passwort</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm mb-2">Passwort bestätigen</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
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
                    <label className="flex items-center gap-3 text-white">
                      <input type="checkbox" className="w-4 h-4" />
                      <span>Anonyme Nutzungsstatistiken teilen</span>
                    </label>
                    <label className="flex items-center gap-3 text-white">
                      <input type="checkbox" className="w-4 h-4" />
                      <span>Personalisierte Empfehlungen</span>
                    </label>
                    <label className="flex items-center gap-3 text-white">
                      <input type="checkbox" className="w-4 h-4" />
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
                {/* FAQ */}
                <div className="bg-white/5 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Häufig gestellte Fragen</h3>
                  <div className="space-y-3">
                    <details className="group">
                      <summary className="cursor-pointer text-white hover:text-teal-400">
                        Wie erstelle ich ein neues Projekt?
                      </summary>
                      <p className="mt-2 text-gray-400 text-sm pl-4">
                        Klicken Sie auf "Neues Projekt" im Dashboard und folgen Sie dem Assistenten...
                      </p>
                    </details>
                    <details className="group">
                      <summary className="cursor-pointer text-white hover:text-teal-400">
                        Wie funktioniert die Ausschreibung?
                      </summary>
                      <p className="mt-2 text-gray-400 text-sm pl-4">
                        Nach Erstellung der LVs können Sie diese an passende Handwerker senden...
                      </p>
                    </details>
                    <details className="group">
                      <summary className="cursor-pointer text-white hover:text-teal-400">
                        Was kostet der Service?
                      </summary>
                      <p className="mt-2 text-gray-400 text-sm pl-4">
                        Byndl arbeitet mit erfolgsbasierten Provisionen...
                      </p>
                    </details>
                  </div>
                </div>
                
                {/* Contact Support */}
                <div className="bg-white/5 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Support kontaktieren</h3>
                  <div className="space-y-4">
                    <a href="mailto:support@byndl.de" className="flex items-center gap-3 text-teal-400 hover:text-teal-300">
                      <span>📧</span>
                      <span>support@byndl.de</span>
                    </a>
                    <a href="tel:+4989123456789" className="flex items-center gap-3 text-teal-400 hover:text-teal-300">
                      <span>📞</span>
                      <span>+49 89 123456789</span>
                    </a>
                    <p className="text-gray-400 text-sm">
                      Erreichbar: Mo-Fr 9:00-18:00 Uhr
                    </p>
                  </div>
                </div>
                
                {/* Feedback */}
                <div className="bg-white/5 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Feedback senden</h3>
                  <textarea
                    placeholder="Ihr Feedback hilft uns, byndl zu verbessern..."
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white h-32"
                  />
                  <button className="mt-4 px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors">
                    Feedback senden
                  </button>
                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
