import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function HandwerkerOfferPage() {
  const { tenderId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [tender, setTender] = useState(null);
  const [positions, setPositions] = useState([]);
  const [notes, setNotes] = useState('');
  const [totalSum, setTotalSum] = useState(0);
  const [handwerkerData, setHandwerkerData] = useState(null);
  
  useEffect(() => {
  const storedData = sessionStorage.getItem('handwerkerData');
  if (!storedData) {
    navigate('/handwerker/login');
    return;
  }
  setHandwerkerData(JSON.parse(storedData));
  
  // Funktion innerhalb useEffect definieren
  const loadTenderData = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/tenders/${tenderId}/lv`));
      if (!res.ok) throw new Error('Fehler beim Laden der Ausschreibung');
      
      const data = await res.json();
      setTender(data);
      
      const initialPositions = data.lv.positions.map(pos => ({
        ...pos,
        unitPrice: 0,
        totalPrice: 0
      }));
      setPositions(initialPositions);
    } catch (error) {
      console.error('Error:', error);
      alert('Fehler beim Laden der Ausschreibung');
    } finally {
      setLoading(false);
    }
  };
  
  loadTenderData();
}, [tenderId, navigate]);
  
  const updatePosition = (index, field, value) => {
    const updated = [...positions];
    updated[index][field] = value;
    
    if (field === 'unitPrice' || field === 'quantity') {
      updated[index].totalPrice = 
        (parseFloat(updated[index].quantity) || 0) * 
        (parseFloat(updated[index].unitPrice) || 0);
    }
    
    setPositions(updated);
    calculateTotal(updated);
  };
  
  const calculateTotal = (positions) => {
    const sum = positions.reduce((acc, pos) => {
      return acc + (pos.isNEP ? 0 : (parseFloat(pos.totalPrice) || 0));
    }, 0);
    setTotalSum(sum);
  };
  
  const submitOffer = async () => {
    if (totalSum === 0) {
      alert('Bitte geben Sie Preise ein');
      return;
    }
    
    if (!window.confirm('Möchten Sie dieses Angebot verbindlich abgeben?')) {
      return;
    }
    
    try {
      const res = await fetch(apiUrl(`/api/tenders/${tenderId}/submit-offer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handwerkerId: handwerkerData.id,
          positions,
          notes,
          totalSum
        })
      });
      
      if (!res.ok) throw new Error('Fehler beim Abgeben des Angebots');
      
      alert('✅ Angebot erfolgreich abgegeben!');
      navigate('/handwerker/dashboard');
    } catch (error) {
      alert('Fehler: ' + error.message);
    }
  };
  
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Angebot erstellen</h1>
          <p className="text-xl text-gray-300">
            {tender?.tradeName} - {tender?.projectDescription}
          </p>
        </div>
        
        {/* Positions Table */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Leistungspositionen</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white">
              <thead className="bg-white/10">
                <tr>
                  <th className="text-left p-3">Pos.</th>
                  <th className="text-left p-3">Bezeichnung</th>
                  <th className="text-right p-3">Menge</th>
                  <th className="text-left p-3">Einheit</th>
                  <th className="text-right p-3">EP (€)</th>
                  <th className="text-right p-3">GP (€)</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, idx) => (
                  <tr key={idx} className="border-t border-white/10">
                    <td className="p-3">{pos.pos}</td>
                    <td className="p-3">
                      <div>{pos.title}</div>
                      <div className="text-xs text-gray-400">{pos.description}</div>
                    </td>
                    <td className="text-right p-3">{pos.quantity}</td>
                    <td className="p-3">{pos.unit}</td>
                    <td className="text-right p-3">
                      <input
                        type="number"
                        step="0.01"
                        className="bg-white/20 border border-white/30 rounded px-2 py-1 text-white w-24"
                        value={pos.unitPrice}
                        onChange={(e) => updatePosition(idx, 'unitPrice', e.target.value)}
                      />
                    </td>
                    <td className="text-right p-3 font-medium text-teal-400">
                      {pos.totalPrice.toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Total */}
          <div className="border-t border-white/20 mt-4 pt-4">
            <div className="flex justify-between text-xl font-bold text-white">
              <span>Gesamtsumme (Netto):</span>
              <span className="text-teal-400">{totalSum.toFixed(2)} €</span>
            </div>
          </div>
        </div>
        
        {/* Notes */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Anmerkungen & Bedingungen</h3>
          <textarea
            className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400"
            rows="6"
            placeholder="Zahlungsbedingungen, Ausführungszeiten, besondere Hinweise..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        
        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate('/handwerker/dashboard')}
            className="px-8 py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={submitOffer}
            className="px-8 py-4 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
          >
            Angebot verbindlich abgeben
          </button>
        </div>
      </div>
    </div>
  );
}
