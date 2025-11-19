// src/pages/HandwerkerNachtragPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

// Position Modal (gleich wie bei HandwerkerOfferPage)
const PositionModal = ({ position, isOpen, onClose, onUpdate, index }) => {
  const [editedPosition, setEditedPosition] = useState(null);
  
  useEffect(() => {
    if (position) {
      setEditedPosition(position);
    }
  }, [position]);
  
  if (!isOpen || !editedPosition) return null;
  
  const handleSave = () => {
    onUpdate(index, editedPosition);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-8 border border-white/20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Position hinzufügen</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Position Header */}
          <div className="bg-white/10 rounded-lg p-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-400">Position</p>
                <input
                  type="text"
                  className="w-full bg-white/20 border border-white/30 rounded px-2 py-1 text-white"
                  value={editedPosition.pos}
                  onChange={(e) => setEditedPosition({...editedPosition, pos: e.target.value})}
                />
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-400">Titel *</p>
                <input
                  type="text"
                  className="w-full bg-white/20 border border-white/30 rounded px-2 py-1 text-white"
                  value={editedPosition.title}
                  onChange={(e) => setEditedPosition({...editedPosition, title: e.target.value})}
                  placeholder="z.B. Zusätzliche Dämmung Nordwand"
                />
              </div>
            </div>
          </div>
          
          {/* Beschreibung */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Beschreibung</label>
            <textarea
              className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400"
              rows="4"
              value={editedPosition.description}
              onChange={(e) => setEditedPosition({...editedPosition, description: e.target.value})}
              placeholder="Detaillierte Beschreibung der Nachtragsleistung..."
            />
          </div>
          
          {/* Menge und Einheit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Menge</label>
              <input
                type="number"
                step="0.01"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
                value={editedPosition.quantity}
                onChange={(e) => {
                  const newQuantity = parseFloat(e.target.value) || 0;
                  setEditedPosition({
                    ...editedPosition, 
                    quantity: newQuantity,
                    totalPrice: newQuantity * (editedPosition.unitPrice || 0)
                  });
                }}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Einheit</label>
              <select
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
                value={editedPosition.unit}
                onChange={(e) => setEditedPosition({...editedPosition, unit: e.target.value})}
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
          </div>
          
          {/* Preise */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Einheitspreis (€)</label>
              <input
                type="number"
                step="0.01"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
                value={editedPosition.unitPrice}
                onChange={(e) => {
                  const newPrice = parseFloat(e.target.value) || 0;
                  setEditedPosition({
                    ...editedPosition, 
                    unitPrice: newPrice,
                    totalPrice: (editedPosition.quantity || 0) * newPrice
                  });
                }}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Gesamtpreis (€)</label>
              <div className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-teal-400 font-semibold">
                {(editedPosition.totalPrice || 0).toFixed(2)} €
              </div>
            </div>
          </div>
          
          {/* Zusatzoptionen */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={editedPosition.isOptional || false}
                onChange={(e) => setEditedPosition({...editedPosition, isOptional: e.target.checked})}
              />
              <span className="text-white">Als optionale Position markieren</span>
            </label>
            
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={editedPosition.isNEP || false}
                onChange={(e) => setEditedPosition({...editedPosition, isNEP: e.target.checked})}
              />
              <span className="text-white">Nach Einheitspreis (NEP) abrechnen</span>
            </label>
          </div>
          
          {/* Anmerkungen */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Anmerkungen</label>
            <textarea
              className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400"
              rows="3"
              value={editedPosition.notes || ''}
              onChange={(e) => setEditedPosition({...editedPosition, notes: e.target.value})}
              placeholder="Zusätzliche Hinweise oder Bedingungen..."
            />
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-4 justify-end mt-8">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
          >
            Position hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
};

// Hauptkomponente
export default function HandwerkerNachtragPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [positions, setPositions] = useState([]);
  const [reason, setReason] = useState('');
  const [totalSum, setTotalSum] = useState(0);
  const [handwerkerData, setHandwerkerData] = useState(null);
  
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  useEffect(() => {
    const storedData = sessionStorage.getItem('handwerkerData');
    if (!storedData) {
      navigate('/handwerker/login');
      return;
    }
    const data = JSON.parse(storedData);
    setHandwerkerData(data);
    
    loadOrderData();
  }, [orderId, navigate]); // eslint-disable-line
  
  const loadOrderData = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/orders/${orderId}/lv-details`));
      if (!res.ok) throw new Error('Fehler beim Laden');
      
      const orderData = await res.json();
      setOrder(orderData);
    } catch (error) {
      console.error('Error:', error);
      alert('Fehler beim Laden des Auftrags');
    } finally {
      setLoading(false);
    }
  };
  
  const updatePosition = (index, updatedPosition) => {
    const updated = [...positions];
    updated[index] = updatedPosition;
    setPositions(updated);
    calculateTotal(updated);
  };
  
  const addNewPosition = () => {
    const newPos = {
      pos: `N${positions.length + 1}`,
      title: '',
      description: '',
      quantity: 1,
      unit: 'Stk',
      unitPrice: 0,
      totalPrice: 0,
      isNEP: false,
      isOptional: false,
      notes: ''
    };
    
    setSelectedPosition({ position: newPos, index: positions.length });
    setModalOpen(true);
  };
  
  const openPositionModal = (position, index) => {
    setSelectedPosition({ position, index });
    setModalOpen(true);
  };
  
  const deletePosition = (index) => {
    if (window.confirm('Position wirklich löschen?')) {
      const updated = positions.filter((_, i) => i !== index);
      setPositions(updated);
      calculateTotal(updated);
    }
  };
  
  const calculateTotal = (positions) => {
    const sum = positions.reduce((acc, pos) => {
      return acc + (pos.isNEP ? 0 : (parseFloat(pos.totalPrice) || 0));
    }, 0);
    setTotalSum(sum);
  };
  
  const submitNachtrag = async () => {
    if (!reason.trim()) {
      alert('Bitte geben Sie eine Begründung ein');
      return;
    }
    
    if (positions.length === 0) {
      alert('Bitte fügen Sie mindestens eine Position hinzu');
      return;
    }
    
    if (!window.confirm('Nachtrag jetzt einreichen?')) {
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/orders/${orderId}/nachtraege/submit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handwerkerId: handwerkerData.id,
          reason,
          positions
        })
      });
      
      if (!res.ok) throw new Error('Fehler beim Einreichen');
      
      const data = await res.json();
      alert(`✅ Nachtrag Nr. ${String(data.nachtragNumber).padStart(2, '0')} erfolgreich eingereicht!`);
      navigate('/handwerker/dashboard');
    } catch (error) {
      alert('Fehler: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
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
          <button
            onClick={() => navigate('/handwerker/dashboard')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Zurück zum Dashboard
          </button>
          
          <h1 className="text-4xl font-bold text-white mb-2">Nachtrag einreichen</h1>
          <p className="text-xl text-gray-300">
            {order?.trade_name} - Auftrag #{orderId}
          </p>
        </div>
        
        {/* Info-Box */}
        <div className="bg-blue-500/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-blue-500/30 mb-8">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Hinweis zur Nachtragseinreichung</h3>
              <p className="text-gray-300 text-sm">
                Reichen Sie hier zusätzliche Leistungen ein, die nicht im ursprünglichen Auftrag enthalten waren.
                Der Bauherr wird benachrichtigt und kann den Nachtrag prüfen und entscheiden.
              </p>
            </div>
          </div>
        </div>
        
        {/* Begründung */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Begründung des Nachtrags *</h3>
          <textarea
            className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400"
            rows="6"
            placeholder="Beschreiben Sie ausführlich, warum die zusätzlichen Leistungen erforderlich sind..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-sm text-gray-400 mt-2">
            ℹ️ Eine detaillierte Begründung erleichtert die Prüfung und Genehmigung des Nachtrags.
          </p>
        </div>
        
        {/* Positionen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-white">Nachtragspositionen</h3>
            <button
              onClick={addNewPosition}
              className="px-4 py-2 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:shadow-xl transition-all"
            >
              + Position hinzufügen
            </button>
          </div>
          
          {positions.length > 0 ? (
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
                    <th className="text-center p-3">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, idx) => (
                    <tr key={idx} className={`border-t border-white/10 ${
                      pos.isNEP ? 'bg-orange-500/10' : pos.isOptional ? 'bg-blue-500/10' : ''
                    }`}>
                      <td className="p-3">{pos.pos}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{pos.title}</span>
                          {pos.isNEP && (
                            <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded border border-orange-500/30 font-semibold">
                              NEP
                            </span>
                          )}
                          {pos.isOptional && (
                            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                              Optional
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{pos.description}</div>
                      </td>
                      <td className="text-right p-3">{pos.quantity}</td>
                      <td className="p-3">{pos.unit}</td>
                      <td className="text-right p-3">{formatCurrency(pos.unitPrice)}</td>
                      <td className="text-right p-3 font-medium text-teal-400">
                        {pos.isNEP ? '-' : formatCurrency(pos.totalPrice)}
                      </td>
                      <td className="text-center p-3">
                        <button
                          onClick={() => openPositionModal(pos, idx)}
                          className="text-blue-400 hover:text-blue-300 mr-2"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => deletePosition(idx)}
                          className="text-red-400 hover:text-red-300"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p className="mb-4">Noch keine Positionen hinzugefügt</p>
              <button
                onClick={addNewPosition}
                className="px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              >
                Erste Position hinzufügen
              </button>
            </div>
          )}
          
          {/* Summe */}
          {positions.length > 0 && (
            <div className="border-t border-white/20 mt-4 pt-4">
              <div className="flex justify-between text-xl font-bold text-white">
                <span>Nachtragssumme (Netto):</span>
                <span className="text-teal-400">{formatCurrency(totalSum)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400 mt-2">
                <span>MwSt. (19%):</span>
                <span>{formatCurrency(totalSum * 0.19)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-white mt-2 pt-2 border-t border-white/10">
                <span>Gesamt (Brutto):</span>
                <span className="text-teal-400">{formatCurrency(totalSum * 1.19)}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Submit Button */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate('/handwerker/dashboard')}
            className="px-8 py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Abbrechen
          </button>
          <button
            onClick={submitNachtrag}
            disabled={loading || positions.length === 0 || !reason.trim()}
            className={`px-8 py-4 rounded-lg font-semibold text-lg transition-all ${
              positions.length > 0 && reason.trim() && !loading
                ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:shadow-xl'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Wird eingereicht...' : 'Nachtrag einreichen'}
          </button>
        </div>
      </div>
      
      {/* Position Modal */}
      {selectedPosition && (
        <PositionModal
          position={selectedPosition.position}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onUpdate={updatePosition}
          index={selectedPosition.index}
        />
      )}
    </div>
  );
}
