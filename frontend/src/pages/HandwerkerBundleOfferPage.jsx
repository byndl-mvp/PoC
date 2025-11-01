import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix für Leaflet Marker Icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function formatCurrency(value) {
  if (!value && value !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

export default function HandwerkerBundleOfferPage() {
  const { bundleId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState(null);
  const [projectOffers, setProjectOffers] = useState({});
  const [bundleDiscount, setBundleDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  
  useEffect(() => {
    loadBundleDetails();
  }, [bundleId]); // eslint-disable-line

  const loadBundleDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/bundles/${bundleId}/details`));
      if (res.ok) {
        const data = await res.json();
        setBundle(data);
        
        // Initialisiere projektOffers mit LV-Daten
        const initialOffers = {};
        data.projects.forEach(project => {
          const lvData = typeof project.lv_data === 'string' 
            ? JSON.parse(project.lv_data) 
            : project.lv_data;
          
          initialOffers[project.tender_id] = {
            tender_id: project.tender_id,
            project_id: project.project_id,
            positions: lvData?.positions || [],
            amount: lvData?.totalSum || 0,
            notes: ''
          };
        });
        setProjectOffers(initialOffers);
      } else {
        throw new Error('Fehler beim Laden des Bündels');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Fehler beim Laden des Bündels');
      navigate('/handwerker/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalAmount = () => {
    const total = Object.values(projectOffers).reduce((sum, offer) => {
      return sum + (parseFloat(offer.amount) || 0);
    }, 0);
    
    // Mit Rabatt
    return total * (1 - bundleDiscount / 100);
  };

  const handlePositionEdit = (tenderId, posIndex, field, value) => {
    setProjectOffers(prev => {
      const updated = { ...prev };
      const positions = [...updated[tenderId].positions];
      positions[posIndex] = {
        ...positions[posIndex],
        [field]: value
      };
      
      // Recalculate totalPrice for position
      if (field === 'quantity' || field === 'unitPrice') {
        const quantity = field === 'quantity' ? parseFloat(value) : parseFloat(positions[posIndex].quantity);
        const unitPrice = field === 'unitPrice' ? parseFloat(value) : parseFloat(positions[posIndex].unitPrice);
        positions[posIndex].totalPrice = quantity * unitPrice;
      }
      
      updated[tenderId].positions = positions;
      
      // Recalculate total amount
      updated[tenderId].amount = positions.reduce((sum, pos) => {
        return sum + (parseFloat(pos.totalPrice) || 0);
      }, 0);
      
      return updated;
    });
  };

  const handleSubmitBundle = async () => {
    if (!window.confirm(`Möchten Sie ein vorläufiges Angebot für alle ${bundle.projects.length} Projekte abgeben?`)) {
      return;
    }

    try {
      setLoading(true);
      
      const handwerkerData = JSON.parse(sessionStorage.getItem('handwerkerData'));
      
      const res = await fetch(apiUrl(`/api/bundles/${bundleId}/submit-offer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: handwerkerData.company_id || handwerkerData.id,
          bundleDiscount: bundleDiscount,
          individualOffers: projectOffers,
          notes: notes
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`✅ Bündelangebot erfolgreich abgegeben!\n\nGesamtsumme: ${formatCurrency(data.totalAmount)}\n${bundle.projects.length} Projekte`);
        navigate('/handwerker/dashboard?tab=angebote');
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Fehler beim Absenden');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Fehler beim Absenden des Angebots: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !bundle) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Lade Bündel-Details...</p>
        </div>
      </div>
    );
  }

  const totalNetto = calculateTotalAmount();
  const totalBrutto = totalNetto * 1.19;
  const savingsFromDiscount = Object.values(projectOffers).reduce((sum, offer) => sum + (offer.amount || 0), 0) * (bundleDiscount / 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/handwerker/dashboard?tab=bundles')}
            className="text-teal-400 hover:text-teal-300 mb-4 flex items-center gap-2"
          >
            ← Zurück zu Projektbündeln
          </button>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  Bündelangebot erstellen
                </h1>
                <p className="text-gray-300 text-lg">{bundle.trade_name} - {bundle.region}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-4 py-2 bg-green-500/20 text-green-300 rounded-full font-semibold text-lg">
                  {bundle.projects.length} Projekte
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Karte */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">📍 Projektstandorte</h2>
          
          <div className="bg-white/5 rounded-lg overflow-hidden" style={{ height: '400px' }}>
            {bundle.map_data && (
              <MapContainer
                center={[bundle.map_data.center.lat, bundle.map_data.center.lng]}
                zoom={bundle.map_data.zoom || 12}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                
                {/* Markers für alle Projekte */}
                {bundle.map_data.markers.map((marker, idx) => (
                  <Marker key={idx} position={[marker.position.lat, marker.position.lng]}>
                    <Popup>
                      <strong>Projekt {idx + 1}</strong><br />
                      {marker.title}<br />
                      {marker.address}
                    </Popup>
                  </Marker>
                ))}
                
                {/* Linien zwischen Projekten */}
                {bundle.map_data.markers.length > 1 && (
                  <Polyline
                    positions={bundle.map_data.markers.map(m => [m.position.lat, m.position.lng])}
                    color="teal"
                    weight={2}
                    opacity={0.6}
                    dashArray="5, 10"
                  />
                )}
              </MapContainer>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-sm">Max. Entfernung</p>
              <p className="text-xl font-bold text-blue-400">{bundle.maxDistance} km</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-sm">Geschätztes Volumen</p>
              <p className="text-xl font-bold text-teal-400">{formatCurrency(bundle.total_volume)}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-sm">Projekte</p>
              <p className="text-xl font-bold text-purple-400">{bundle.projects.length}</p>
            </div>
          </div>
        </div>

        {/* Bündelrabatt */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">💰 Bündelrabatt anbieten (optional)</h2>
          
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
            <p className="text-green-300 text-sm">
              <strong>💡 Empfehlung:</strong> Mit einem Bündelrabatt von 5-15% erhöhen Sie Ihre Chancen deutlich. 
              Bauherren sehen den Mehrwert und bevorzugen koordinierte Angebote.
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <label className="block text-white font-semibold mb-2">Rabatt in %</label>
              <input
                type="number"
                min="0"
                max="30"
                step="0.5"
                value={bundleDiscount}
                onChange={(e) => setBundleDiscount(parseFloat(e.target.value) || 0)}
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white text-lg font-bold"
                placeholder="z.B. 10"
              />
            </div>
            
            {bundleDiscount > 0 && (
              <div className="flex-1 bg-white/5 rounded-lg p-4">
                <p className="text-gray-400 text-sm mb-1">Rabatt-Ersparnis für Bauherren:</p>
                <p className="text-2xl font-bold text-green-400">
                  - {formatCurrency(savingsFromDiscount)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* LVs aller Projekte */}
        <div className="space-y-6 mb-8">
          {bundle.projects.map((project, idx) => {
            const offer = projectOffers[project.tender_id];
            if (!offer) return null;

            return (
              <div key={idx} className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
                {/* Projekt Header */}
                <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-6 border-b border-white/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center text-teal-300 font-bold">
                          {idx + 1}
                        </span>
                        <h3 className="text-2xl font-bold text-white">{project.title}</h3>
                      </div>
                      <p className="text-gray-300">📍 {project.address}</p>
                      <p className="text-gray-400 text-sm mt-1">
                        ⏱️ Gewünschter Termin: {project.timeframe || 'Nach Absprache'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400 mb-1">Projektvolumen</p>
                      <p className="text-2xl font-bold text-teal-400">
                        {formatCurrency(offer.amount)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* LV Positionen */}
                <div className="p-6">
                  <h4 className="text-lg font-semibold text-white mb-4">Leistungsverzeichnis:</h4>
                  
                  <div className="space-y-3">
                    {offer.positions.map((position, posIdx) => (
                      <div 
                        key={posIdx}
                        className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-teal-500/50 transition-all cursor-pointer"
                        onClick={() => setEditingProject(editingProject === `${project.tender_id}-${posIdx}` ? null : `${project.tender_id}-${posIdx}`)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-teal-400 font-bold">{position.pos}</span>
                              <h5 className="text-white font-semibold">{position.title}</h5>
                            </div>
                            
                            {editingProject === `${project.tender_id}-${posIdx}` ? (
                              // Edit Mode
                              <div className="space-y-3 mt-3">
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-gray-400 text-xs mb-1">Menge</label>
                                    <input
                                      type="number"
                                      value={position.quantity}
                                      onChange={(e) => handlePositionEdit(project.tender_id, posIdx, 'quantity', e.target.value)}
                                      className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 text-xs mb-1">Einheit</label>
                                    <input
                                      type="text"
                                      value={position.unit}
                                      onChange={(e) => handlePositionEdit(project.tender_id, posIdx, 'unit', e.target.value)}
                                      className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-gray-400 text-xs mb-1">EP (€)</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={position.unitPrice}
                                      onChange={(e) => handlePositionEdit(project.tender_id, posIdx, 'unitPrice', e.target.value)}
                                      className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // View Mode
                              <div className="flex gap-4 text-sm text-gray-300">
                                <span>{position.quantity} {position.unit}</span>
                                <span>à {formatCurrency(position.unitPrice)}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-xl font-bold text-teal-400">
                              {formatCurrency(position.totalPrice || (position.quantity * position.unitPrice))}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Anmerkungen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-8">
          <label className="block text-white font-semibold mb-2">Anmerkungen zum Bündelangebot (optional)</label>
          <textarea
            className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
            rows="4"
            placeholder="z.B. Koordinierte Ausführung aller Projekte, optimierte Logistik..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Gesamtsumme */}
        <div className="bg-gradient-to-r from-green-600/20 to-teal-600/20 rounded-2xl p-8 border border-white/20 mb-8">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-6 text-center">Gesamtsumme Bündelangebot</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between text-lg">
                <span className="text-gray-300">Summe aller Projekte (Netto):</span>
                <span className="text-white font-bold">
                  {formatCurrency(Object.values(projectOffers).reduce((sum, o) => sum + (o.amount || 0), 0))}
                </span>
              </div>
              
              {bundleDiscount > 0 && (
                <div className="flex justify-between text-lg text-green-400">
                  <span>Bündelrabatt ({bundleDiscount}%):</span>
                  <span className="font-bold">- {formatCurrency(savingsFromDiscount)}</span>
                </div>
              )}
              
              <div className="border-t border-white/20 pt-3 flex justify-between text-xl">
                <span className="text-gray-300">Gesamt Netto:</span>
                <span className="text-teal-400 font-bold">{formatCurrency(totalNetto)}</span>
              </div>
              
              <div className="flex justify-between text-lg">
                <span className="text-gray-400">zzgl. 19% MwSt.:</span>
                <span className="text-gray-300">{formatCurrency(totalNetto * 0.19)}</span>
              </div>
              
              <div className="border-t border-white/20 pt-3 flex justify-between text-2xl">
                <span className="text-white font-bold">Gesamt Brutto:</span>
                <span className="text-teal-400 font-bold">{formatCurrency(totalBrutto)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/handwerker/dashboard?tab=bundles')}
            className="px-8 py-4 bg-white/10 border border-white/30 text-white rounded-lg hover:bg-white/20 transition-all"
          >
            Abbrechen
          </button>
          
          <button
            onClick={handleSubmitBundle}
            disabled={loading}
            className="flex-1 px-8 py-4 bg-gradient-to-r from-teal-500 to-blue-600 text-white text-lg font-bold rounded-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Wird gesendet...' : `✓ Vorläufiges Bündelangebot für alle ${bundle.projects.length} Projekte abgeben`}
          </button>
        </div>
      </div>
    </div>
  );
}
