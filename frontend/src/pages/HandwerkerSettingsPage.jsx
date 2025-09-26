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
  // HIER NEU:
  const [documents, setDocuments] = useState({
    gewerbeschein: null,
    handwerkskarte: null,
    others: []
  });
  
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
    loadDocuments();
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

  const uploadDocument = async (file) => {
  const formData = new FormData();
  formData.append('document', file);
  
  // Dokumententyp bestimmen
  let docType = 'other';
  if (file.name.toLowerCase().includes('gewerbe')) {
    docType = 'gewerbeschein';
  } else if (file.name.toLowerCase().includes('handwerk')) {
    docType = 'handwerkskarte';
  }
  
  formData.append('document_type', docType);
  
  try {
    const res = await fetch('/api/handwerker/documents/upload', {
      method: 'POST',
      body: formData
    });
    
    if (res.ok) {
      setMessage('Dokument erfolgreich hochgeladen');
      loadDocuments(); // Dokumente neu laden
    } else {
      setError('Upload fehlgeschlagen');
    }
  } catch (err) {
    setError('Upload-Fehler: ' + err.message);
  }
};

const downloadDocument = async (docId) => {
  try {
    const res = await fetch(`/api/handwerker/documents/${docId}`);
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
    const res = await fetch(`/api/handwerker/documents/${docId}`, {
      method: 'DELETE'
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
    const res = await fetch('/api/handwerker/documents');
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

          {/* Mein Profil Tab */}
{activeTab === 'profil' && (
  <div className="space-y-4">
    <h2 className="text-2xl font-bold text-white mb-4">Mein Profil</h2>
    
    <div className="bg-white/5 rounded-lg p-6">
      <div className="flex items-center gap-6 mb-6">
        <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center">
          <span className="text-3xl">👷</span>
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{handwerkerData?.companyName}</h3>
          <p className="text-gray-400">ID: {handwerkerData?.companyId}</p>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm ${
            handwerkerData?.verificationStatus === 'verified' 
              ? 'bg-green-500/20 text-green-300' 
              : 'bg-yellow-500/20 text-yellow-300'
          }`}>
            {handwerkerData?.verificationStatus === 'verified' ? '✓ Verifiziert' : '⏳ In Prüfung'}
          </span>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-gray-400 text-sm">Registriert seit</p>
          <p className="text-white">{new Date(handwerkerData?.createdAt || Date.now()).toLocaleDateString('de-DE')}</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Aktive Aufträge</p>
          <p className="text-white">0</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Abgeschlossene Projekte</p>
          <p className="text-white">0</p>
        </div>
        <div>
          <p className="text-gray-400 text-sm">Bewertung</p>
          <p className="text-white">⭐ Noch keine Bewertungen</p>
        </div>
      </div>
    </div>
  </div>
)}
          
          {/* Einzugsgebiet Tab */}
{activeTab === 'coverage' && (
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

          {activeTab === 'documents' && (
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

        </div>
      </div>
    </div>
  );
}
