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
        if (typeof parsedLV === 'string') {
          parsedLV = JSON.parse(parsedLV);
        }
        
        setLvData(parsedLV || { positions: [] });
        
        setFormData({
          execution_start: data.execution_start || '',
          execution_end: data.execution_end || '',
          notes: data.notes || ''
        });
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Berechne Gesamtsumme aus LV
  const calculateTotal = () => {
    return lvData.positions.reduce((sum, pos) => {
      const quantity = parseFloat(pos.quantity) || 0;
      const unitPrice = parseFloat(pos.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
  };

  // Position aktualisieren
  const updatePosition = (index, field, value) => {
    const newPositions = [...lvData.positions];
    newPositions[index] = {
      ...newPositions[index],
      [field]: value
    };
    
    // Berechne totalPrice neu
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = parseFloat(newPositions[index].quantity) || 0;
      const unitPrice = parseFloat(newPositions[index].unitPrice) || 0;
      newPositions[index].totalPrice = quantity * unitPrice;
    }
    
    setLvData({ ...lvData, positions: newPositions });
  };

  // Position hinzufügen
  const addPosition = () => {
    setLvData({
      ...lvData,
      positions: [...lvData.positions, {
        pos: `${lvData.positions.length + 1}`,
        title: '',
        description: '',
        unit: 'Stk',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0
      }]
    });
  };

  // Position löschen
  const deletePosition = (index) => {
    const newPositions = lvData.positions.filter((_, i) => i !== index);
    setLvData({ ...lvData, positions: newPositions });
  };

  const handleConfirm = async () => {
    if (!formData.execution_start || !formData.execution_end) {
      alert('Bitte geben Sie die Ausführungstermine an.');
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
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Fehler beim Bestätigen');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <p className="text-white">Lädt...</p>
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
            className="text-gray-400 hover:text-white flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Zurück
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-4xl font-bold text-white mb-2">Angebot anpassen und bestätigen</h1>
        <p className="text-gray-400 mb-8">Passen Sie Ihr Angebot nach dem Ortstermin an</p>
        
        {/* Projektinfo */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">{offer?.trade_name}</h2>
          <div className="grid md:grid-cols-2 gap-4 text-gray-300">
            <div>
              <p><strong>Projekt:</strong> {offer?.project_description}</p>
              <p><strong>Ort:</strong> {offer?.project_street} {offer?.project_house_number}, {offer?.project_zip} {offer?.project_city}</p>
            </div>
            <div>
              <p><strong>Bauherr:</strong> {offer?.bauherr_name}</p>
              <p><strong>Kontakt:</strong> {offer?.bauherr_phone}</p>
            </div>
          </div>
        </div>

        {/* LV-Positionen BEARBEITBAR */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Leistungsverzeichnis</h2>
            <button
              onClick={addPosition}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              + Position hinzufügen
            </button>
          </div>

          <div className="space-y-4 max-h-[600px] overflow-y-auto">
            {lvData.positions.map((position, index) => (
              <div key={index} className="bg-white/5 rounded-lg p-4 border border-white/10">
                <div className="flex justify-between items-start mb-3">
                  <input
                    type="text"
                    className="flex-1 bg-white/10 border border-white/20 rounded px-3 py-2 text-white font-semibold"
                    value={position.title}
                    onChange={(e) => updatePosition(index, 'title', e.target.value)}
                    placeholder="Positionstitel"
                  />
                  <button
                    onClick={() => deletePosition(index)}
                    className="ml-3 px-3 py-2 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30"
                  >
                    🗑️
                  </button>
                </div>

                <textarea
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-gray-300 text-sm mb-3"
                  rows="2"
                  value={position.description || ''}
                  onChange={(e) => updatePosition(index, 'description', e.target.value)}
                  placeholder="Beschreibung (optional)"
                />

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Menge</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                      value={position.quantity}
                      onChange={(e) => updatePosition(index, 'quantity', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Einheit</label>
                    <select
                      className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                      value={position.unit}
                      onChange={(e) => updatePosition(index, 'unit', e.target.value)}
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
                    </select>
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Einzelpreis (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white"
                      value={position.unitPrice}
                      onChange={(e) => updatePosition(index, 'unitPrice', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Gesamtpreis (€)</label>
                    <input
                      type="text"
                      className="w-full bg-white/10 border border-white/30 rounded px-3 py-2 text-teal-400 font-bold"
                      value={formatCurrency((parseFloat(position.quantity) || 0) * (parseFloat(position.unitPrice) || 0))}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summen */}
          <div className="mt-6 pt-6 border-t border-white/20">
            <div className="flex justify-end">
              <div className="w-80">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Netto-Summe:</span>
                  <span className="text-white font-bold text-xl">{formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between mb-2">
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
        </div>

        {/* Ausführungstermine */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h3 className="text-xl font-bold text-white mb-4">Ausführungstermine *</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-white font-semibold mb-2">Ausführung von</label>
              <input
                type="date"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                value={formData.execution_start}
                onChange={(e) => setFormData({...formData, execution_start: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-white font-semibold mb-2">Ausführung bis</label>
              <input
                type="date"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
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
            className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
            rows="4"
            placeholder="Optionale Anmerkungen zu Ihren Anpassungen..."
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
          disabled={loading}
          className="w-full px-8 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white text-lg font-bold rounded-lg hover:shadow-xl transform hover:scale-[1.02] transition-all disabled:opacity-50"
        >
          ✓ Angebot verbindlich bestätigen
        </button>
      </div>
    </div>
  );
}
