import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function HandwerkerSettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('firmendaten');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
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
  }, [navigate]);

  const loadSettings = async (handwerkerId) => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/handwerker/${handwerkerId}/settings`), {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
        }
      });
      
      if (res.ok) {
        const settings = await res.json();
        setFormData(prev => ({
          ...prev,
          ...settings
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
      setLoading(true);
      setError('');
      
      const endpoint = `/api/handwerker/${handwerkerData.id || handwerkerData.companyId}/${section}`;
      const res = await fetch(apiUrl(endpoint), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('handwerkerToken')}`
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setMessage('Einstellungen gespeichert!');
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

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const tabs = [
    { id: 'firmendaten', label: 'Firmendaten', icon: '🏢' },
    { id: 'einsatzgebiet', label: 'Einsatzgebiet', icon: '📍' },
    { id: 'verfuegbarkeit', label: 'Verfügbarkeit', icon: '📅' },
    { id: 'preise', label: 'Preise', icon: '💰' },
    { id: 'benachrichtigungen', label: 'Benachrichtigungen', icon: '🔔' },
    { id: 'zahlungsdaten', label: 'Zahlungsdaten', icon: '🏦' },
    { id: 'dokumente', label: 'Dokumente', icon: '📄' },
    { id: 'account', label: 'Account', icon: '⚙️' }
  ];

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
                    className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
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
                className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                Speichern
              </button>
            </div>
          )}

          {/* Einsatzgebiet Tab */}
          {activeTab === 'einsatzgebiet' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Einsatzgebiet</h2>
              
              <div>
                <label className="block text-white font-medium mb-2">
                  Aktionsradius: {formData.actionRadius} km
                </label>
                <input
                  type="range"
                  min="5"
                  max="200"
                  value={formData.actionRadius}
                  onChange={(e) => handleChange('actionRadius', e.target.value)}
                  className="w-full"
                />
                <div className="flex justify-between text-gray-400 text-sm">
                  <span>5 km</span>
                  <span>200 km</span>
                </div>
              </div>
              
              <div>
                <label className="block text-white font-medium mb-2">
                  Ausschlussgebiete (PLZ, kommagetrennt)
                </label>
                <textarea
                  value={formData.excludedAreas.join(', ')}
                  onChange={(e) => handleChange('excludedAreas', e.target.value.split(',').map(s => s.trim()))}
                  rows="3"
                  placeholder="z.B. 12345, 67890"
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                />
              </div>
              
              <button
                onClick={() => handleSave('einsatzgebiet')}
                disabled={loading}
                className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                Speichern
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
              
              <div className="space-y-3">
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    checked={formData.emailNotifications}
                    onChange={(e) => handleChange('emailNotifications', e.target.checked)}
                    className="mr-3"
                  />
                  E-Mail-Benachrichtigungen bei neuen Ausschreibungen
                </label>
                
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    checked={formData.smsNotifications}
                    onChange={(e) => handleChange('smsNotifications', e.target.checked)}
                    className="mr-3"
                  />
                  SMS-Benachrichtigungen für dringende Anfragen
                </label>
                
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    checked={formData.newsletterSubscribed}
                    onChange={(e) => handleChange('newsletterSubscribed', e.target.checked)}
                    className="mr-3"
                  />
                  Newsletter abonnieren
                </label>
              </div>
              
              <button
                onClick={() => handleSave('benachrichtigungen')}
                disabled={loading}
                className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                Speichern
              </button>
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
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Account-Einstellungen</h2>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-300 text-sm">
                  ⚠️ Vorsicht: Änderungen in diesem Bereich können Ihren Zugang beeinflussen.
                </p>
              </div>
              
              <div>
                <label className="flex items-center text-white mb-4">
                  <input
                    type="checkbox"
                    checked={formData.twoFactorEnabled}
                    onChange={(e) => handleChange('twoFactorEnabled', e.target.checked)}
                    className="mr-3"
                  />
                  Zwei-Faktor-Authentifizierung aktivieren
                </label>
              </div>
              
              <hr className="border-white/20" />
              
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Passwort ändern</h3>
                
                <div>
                  <label className="block text-white font-medium mb-2">Aktuelles Passwort</label>
                  <input
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) => handleChange('currentPassword', e.target.value)}
                    className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">Neues Passwort</label>
                  <input
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => handleChange('newPassword', e.target.value)}
                    className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-white font-medium mb-2">Neues Passwort bestätigen</label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  />
                </div>
                
                <button
                  onClick={() => handleSave('password')}
                  disabled={loading}
                  className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  Passwort ändern
                </button>
              </div>
              
              <hr className="border-white/20" />
              
              <div className="pt-4">
                <button className="px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 rounded-lg">
                  Account löschen
                </button>
              </div>
            </div>
          )}

          {/* Dokumente Tab */}
          {activeTab === 'dokumente' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white mb-4">Dokumente verwalten</h2>
              
              <div className="space-y-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">Meisterbrief</p>
                      <p className="text-gray-400 text-sm">Hochgeladen am: 15.03.2024</p>
                    </div>
                    <button className="text-teal-400 hover:text-teal-300">
                      Aktualisieren
                    </button>
                  </div>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">Betriebshaftpflichtversicherung</p>
                      <p className="text-gray-400 text-sm">Gültig bis: 31.12.2025</p>
                    </div>
                    <button className="text-teal-400 hover:text-teal-300">
                      Aktualisieren
                    </button>
                  </div>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-medium">AGBs</p>
                      <p className="text-gray-400 text-sm">Version 2.1</p>
                    </div>
                    <button className="text-teal-400 hover:text-teal-300">
                      Hochladen
                    </button>
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
