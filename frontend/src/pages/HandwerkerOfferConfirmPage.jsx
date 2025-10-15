import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

function formatCurrency(value) {
  if (!value && value !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

export default function HandwerkerOfferConfirmPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);
  const [lvData, setLvData] = useState({ positions: [] });
  const [formData, setFormData] = useState({
    execution_start: '',
    execution_end: '',
    notes: ''
  });
  
  // Modal States
  const [showPositionModal, setShowPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);

  useEffect(() => {
    loadOffer();
  }, [offerId]); // eslint-disable-line

  const loadOffer = async () => {
    try {
      const res = await fetch(apiUrl(`/api/offers/${offerId}/details-with-contacts`));
      if (res.ok) {
        const data = await res.json();
        setOffer(data);
        
        // Parse LV-Daten
let parsedLV = data.lv_data;

// Falls es ein String ist (sollte nicht sein, aber sicher ist sicher)
if (typeof parsedLV === 'string') {
  parsedLV = JSON.parse(parsedLV);
}

// Normalisiere zu { positions: [...] } Format
if (Array.isArray(parsedLV)) {
  // lv_data ist direkt das Array
  parsedLV = { positions: parsedLV };
} else if (!parsedLV || !Array.isArray(parsedLV.positions)) {
  // Fallback
  parsedLV = { positions: [] };
}

console.log('🟢 Geladenes LV:', parsedLV);
setLvData(parsedLV);
        
        setFormData({
          execution_start: data.execution_start || '',
          execution_end: data.execution_end || '',
          notes: data.notes || ''
        });
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Fehler beim Laden des Angebots');
    } finally {
      setLoading(false);
    }
  };

  // Berechne Gesamtsumme
  const calculateTotal = () => {
    if (!lvData.positions || lvData.positions.length === 0) return 0;
    return lvData.positions.reduce((sum, pos) => {
      const quantity = parseFloat(pos.quantity) || 0;
      const unitPrice = parseFloat(pos.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
  };

  // Position bearbeiten öffnen
  const openEditPosition = (position, index) => {
    setEditingPosition({...position});
    setEditingIndex(index);
    setShowPositionModal(true);
  };

  // Neue Position erstellen
  const openNewPosition = () => {
    setEditingPosition({
      pos: `${(lvData.positions?.length || 0) + 1}`,
      title: '',
      description: '',
      unit: 'Stk',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      notes: '',
      priceBase: ''
    });
    setEditingIndex(null);
    setShowPositionModal(true);
  };

  // Position speichern
  const savePosition = () => {
    if (!editingPosition.title) {
      alert('Bitte geben Sie einen Titel ein');
      return;
    }

    const quantity = parseFloat(editingPosition.quantity) || 0;
    const unitPrice = parseFloat(editingPosition.unitPrice) || 0;
    const updatedPosition = {
      ...editingPosition,
      quantity,
      unitPrice,
      totalPrice: quantity * unitPrice
    };

    let newPositions = [...(lvData.positions || [])];
    
    if (editingIndex !== null) {
      // Bearbeiten
      newPositions[editingIndex] = updatedPosition;
    } else {
      // Neu hinzufügen
      newPositions.push(updatedPosition);
    }

    setLvData({ ...lvData, positions: newPositions });
    setShowPositionModal(false);
    setEditingPosition(null);
    setEditingIndex(null);
  };

  // Position löschen
  const deletePosition = (index) => {
    if (window.confirm('Position wirklich löschen?')) {
      const newPositions = lvData.positions.filter((_, i) => i !== index);
      setLvData({ ...lvData, positions: newPositions });
    }
  };

  const handleConfirm = async () => {
    if (!formData.execution_start || !formData.execution_end) {
      alert('Bitte geben Sie die Ausführungstermine an.');
      return;
    }

    if (lvData.positions.length === 0) {
      alert('Bitte fügen Sie mindestens eine Position hinzu.');
      return;
    }

    if (!window.confirm('Möchten Sie dieses Angebot verbindlich bestätigen?')) return;

    try {
      setLoading(true);
      const totalAmount = calculateTotal();
      
      const res = await fetch(apiUrl(`/api/offers/${offerId}/confirm-final`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          execution_start: formData.execution_start,
          execution_end: formData.execution_end,
          notes: formData.notes,
          lv_data: lvData
        })
      });

      if (res.ok) {
        alert('Angebot wurde verbindlich bestätigt! Der Bauherr wird benachrichtigt.');
        navigate('/handwerker/dashboard');
      } else {
        throw new Error('Fehler beim Bestätigen');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Fehler beim Bestätigen des Angebots');
    } finally {
      setLoading(false);
    }
  };

  // Position Modal Component
const PositionModal = () => {
  if (!showPositionModal || !editingPosition) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-b border-white/20">
          <h3 className="text-2xl font-bold text-white">
            {editingIndex !== null ? 'Position bearbeiten' : 'Neue Position'}
          </h3>
        </div>

        <div className="p-6 space-y-4">
          {/* Positionsnummer */}
          <div>
            <label className="block text-white font-semibold mb-2">Pos.-Nr.</label>
            <input
              type="text"
              className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white"
              value={editingPosition?.pos || ''}
              onChange={(e) => setEditingPosition(prev => ({...prev, pos: e.target.value}))}
            />
          </div>

          {/* Titel */}
          <div>
            <label className="block text-white font-semibold mb-2">Titel *</label>
            <input
              type="text"
              className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white"
              value={editingPosition?.title || ''}
              onChange={(e) => setEditingPosition(prev => ({...prev, title: e.target.value}))}
              placeholder="z.B. Dachziegel verlegen"
              autoFocus
            />
          </div>

          {/* Beschreibung */}
          <div>
            <label className="block text-white font-semibold mb-2">Beschreibung</label>
            <textarea
              className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white"
              rows="3"
              value={editingPosition?.description || ''}
              onChange={(e) => setEditingPosition(prev => ({...prev, description: e.target.value}))}
              placeholder="Detaillierte Beschreibung der Leistung..."
            />
          </div>

          {/* Menge, Einheit, Preis */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-white font-semibold mb-2">Menge</label>
              <input
                type="number"
                step="0.01"
                className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white"
                value={editingPosition?.quantity || ''}
                onChange={(e) => setEditingPosition(prev => ({...prev, quantity: e.target.value}))}
              />
            </div>

            <div>
              <label className="block text-white font-semibold mb-2">Einheit</label>
              <select
                className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white"
                value={editingPosition?.unit || 'Stk'}
                onChange={(e) => setEditingPosition(prev => ({...prev, unit: e.target.value}))}
              >
                <option value="Stk">Stk</option>
                <option value="m">m</option>
                <option value="m²">m²</option>
                <option value="m³">m³</option>
                <option value="kg">kg</option>
                <option value="t">t</option>
                <option value="Std">Std</option>
                <option value="Tag">Tag</option>
                <option value="Psch">Psch</option>
                <option value="l">l</option>
                <option value="Paar">Paar</option>
              </select>
            </div>

            <div>
              <label className="block text-white font-semibold mb-2">EP (€)</label>
              <input
                type="number"
                step="0.01"
                className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white"
                value={editingPosition?.unitPrice || ''}
                onChange={(e) => setEditingPosition(prev => ({...prev, unitPrice: e.target.value}))}
              />
            </div>
          </div>

          {/* Gesamtpreis (berechnet) */}
          <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-teal-300 font-semibold">Gesamtpreis:</span>
              <span className="text-teal-400 text-2xl font-bold">
                {formatCurrency((parseFloat(editingPosition?.quantity) || 0) * (parseFloat(editingPosition?.unitPrice) || 0))}
              </span>
            </div>
          </div>

          {/* Notizen */}
          <div>
            <label className="block text-white font-semibold mb-2">Interne Notizen</label>
            <textarea
              className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white"
              rows="2"
              value={editingPosition?.notes || ''}
              onChange={(e) => setEditingPosition(prev => ({...prev, notes: e.target.value}))}
              placeholder="Interne Anmerkungen (nicht sichtbar für Bauherr)..."
            />
          </div>

          {/* Preisbasis */}
          <div>
            <label className="block text-white font-semibold mb-2">Preisbasis</label>
            <input
              type="text"
              className="w-full bg-white/10 border border-white/30 rounded-lg px-4 py-2 text-white"
              value={editingPosition?.priceBase || ''}
              onChange={(e) => setEditingPosition(prev => ({...prev, priceBase: e.target.value}))}
              placeholder="z.B. Marktpreis 2024/2025"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="sticky bottom-0 bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-t border-white/20 flex gap-3">
          <button
            onClick={() => {
              setShowPositionModal(false);
              setEditingPosition(null);
              setEditingIndex(null);
            }}
            className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={savePosition}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:shadow-xl transition-all font-semibold"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
};

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-white">Lädt Angebot...</p>
      </div>
    </div>
  );

  if (!offer) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <p className="text-white text-xl">Angebot nicht gefunden</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-teal-400 hover:text-teal-300">
          Zurück
        </button>
      </div>
    </div>
  );

  const total = calculateTotal();
  const mwst = total * 0.19;
  const brutto = total + mwst;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button 
            onClick={() => navigate(-1)} 
            className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Zurück zum Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Angebot anpassen und bestätigen</h1>
        <p className="text-gray-400 mb-8">Passen Sie Ihr Angebot nach dem Ortstermin an und bestätigen Sie es verbindlich</p>
        
        {/* Projektinfo */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">{offer.trade_name}</h2>
          <div className="grid md:grid-cols-2 gap-4 text-gray-300 text-sm">
            <div>
              <p><strong className="text-white">Projekt:</strong> {offer.project_category}</p>
              <p><strong className="text-white">Ort:</strong> {offer.project_zip} {offer.project_city}</p>
            </div>
            <div>
              <p><strong className="text-white">Bauherr:</strong> {offer.bauherr_name}</p>
              <p><strong className="text-white">Kontakt:</strong> {offer.bauherr_phone}</p>
            </div>
          </div>
        </div>

        {/* LV-Positionen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-white">Leistungsverzeichnis</h2>
            <button
              onClick={openNewPosition}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg hover:shadow-xl transition-all font-semibold"
            >
              + Position hinzufügen
            </button>
          </div>

          {lvData.positions && lvData.positions.length > 0 ? (
            <div className="space-y-3">
              {lvData.positions.map((position, index) => (
                <div 
                  key={index} 
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-teal-500/50 transition-all cursor-pointer"
                  onClick={() => openEditPosition(position, index)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-teal-400 font-bold">{position.pos}</span>
                        <h3 className="text-white font-semibold">{position.title}</h3>
                      </div>
                      {position.description && (
                        <p className="text-gray-400 text-sm mb-2">{position.description}</p>
                      )}
                      <div className="flex gap-4 text-sm text-gray-300">
                        <span>{position.quantity} {position.unit}</span>
                        <span>à {formatCurrency(position.unitPrice)}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xl font-bold text-teal-400">
                        {formatCurrency((parseFloat(position.quantity) || 0) * (parseFloat(position.unitPrice) || 0))}
                      </p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePosition(index);
                        }}
                        className="mt-2 text-red-400 hover:text-red-300 text-sm"
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="mb-4">Noch keine Positionen hinzugefügt</p>
              <button
                onClick={openNewPosition}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Erste Position hinzufügen
              </button>
            </div>
          )}

          {/* Summen */}
          {lvData.positions && lvData.positions.length > 0 && (
            <div className="mt-6 pt-6 border-t border-white/20">
              <div className="flex justify-end">
                <div className="w-80 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Netto-Summe:</span>
                    <span className="text-white font-bold text-xl">{formatCurrency(total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">zzgl. 19% MwSt.:</span>
                    <span className="text-gray-300">{formatCurrency(mwst)}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-white/20">
                    <span className="text-white font-bold">Gesamt (Brutto):</span>
                    <span className="text-teal-400 font-bold text-2xl">{formatCurrency(brutto)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ausführungstermine */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h3 className="text-xl font-bold text-white mb-4">Ausführungstermine *</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-white font-semibold mb-2">Ausführung von</label>
              <input
                type="date"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
                value={formData.execution_start}
                onChange={(e) => setFormData({...formData, execution_start: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-white font-semibold mb-2">Ausführung bis</label>
              <input
                type="date"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
                value={formData.execution_end}
                onChange={(e) => setFormData({...formData, execution_end: e.target.value})}
                required
              />
            </div>
          </div>
        </div>

        {/* Anmerkungen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <label className="block text-white font-semibold mb-2">Anmerkungen / Änderungen</label>
          <textarea
            className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
            rows="4"
            placeholder="Optionale Anmerkungen zu Ihren Anpassungen nach dem Ortstermin..."
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
          />
        </div>

        {/* Hinweis */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
          <p className="text-yellow-300 text-sm">
            <strong>⚠️ Wichtig:</strong> Nach der Bestätigung ist Ihr Angebot verbindlich und kann nicht mehr zurückgezogen werden. 
            Der Bauherr kann es nun verbindlich beauftragen.
          </p>
        </div>

        {/* Button */}
        <button
          onClick={handleConfirm}
          disabled={loading || !lvData.positions || lvData.positions.length === 0}
          className="w-full px-8 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white text-lg font-bold rounded-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ✓ Angebot verbindlich bestätigen ({formatCurrency(total)})
        </button>
      </div>

      {/* Position Modal */}
      <PositionModal />
    </div>
  );
}
