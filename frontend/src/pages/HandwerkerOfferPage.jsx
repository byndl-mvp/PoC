// src/pages/HandwerkerOfferPage.jsx - Erweitert mit PositionModal
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

// PositionModal Komponente (analog zur ResultPage)
const PositionModal = ({ position, isOpen, onClose, onUpdate, index }) => {
  const [editedPosition, setEditedPosition] = useState(null);
  
  // Position bei Änderungen aktualisieren
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
          <h2 className="text-2xl font-bold text-white">Position bearbeiten</h2>
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
                <p className="text-lg font-semibold text-white">{editedPosition.pos}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-400">Titel</p>
                <p className="text-lg font-semibold text-white">{editedPosition.title}</p>
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
              placeholder="Detaillierte Beschreibung der Leistung..."
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
              <input
                type="text"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
                value={editedPosition.unit}
                onChange={(e) => setEditedPosition({...editedPosition, unit: e.target.value})}
              />
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
            Änderungen speichern
          </button>
        </div>
      </div>
    </div>
  );
};

// Hauptkomponente
export default function HandwerkerOfferPage() {
  const { tenderId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [tender, setTender] = useState(null);
  const [positions, setPositions] = useState([]);
  const [notes, setNotes] = useState('');
  const [totalSum, setTotalSum] = useState(0);
  const [handwerkerData, setHandwerkerData] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [vorbemerkungen, setVorbemerkungen] = useState([]);
  
  useEffect(() => {
  const storedData = sessionStorage.getItem('handwerkerData');
  if (!storedData) {
    navigate('/handwerker/login');
    return;
  }
  const data = JSON.parse(storedData);
  setHandwerkerData(data);
  
  // Funktionen INNERHALB des useEffect definieren
  const markAsInProgress = async (handwerkerId) => {
    try {
      await fetch(apiUrl(`/api/tenders/${tenderId}/start-offer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handwerkerId })
      });
    } catch (error) {
      console.error('Error marking as in progress:', error);
    }
  };
  
  const loadTenderData = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/tenders/${tenderId}/lv`));
      if (!res.ok) throw new Error('Fehler beim Laden der Ausschreibung');
      
      const tenderData = await res.json();
      setTender(tenderData);

      // NEU: Extrahiere Vorbemerkungen aus dem LV
if (tenderData.lv && tenderData.lv.vorbemerkungen) {
  setVorbemerkungen(tenderData.lv.vorbemerkungen);
}
      
     const initialPositions = tenderData.lv.positions.map(pos => ({
  ...pos,
  unitPrice: 0,
  totalPrice: 0,
  isNEP: pos.isNEP || false,        
  isOptional: pos.isOptional || false  
}));
      setPositions(initialPositions);
    } catch (error) {
      console.error('Error:', error);
      alert('Fehler beim Laden der Ausschreibung');
    } finally {
      setLoading(false);
    }
  };
  
  // Funktionen aufrufen
  markAsInProgress(data.id);
  loadTenderData();
}, [tenderId, navigate]);
  
  const updatePosition = (index, field, value) => {
    const updated = [...positions];
    if (typeof field === 'object') {
      // Wenn komplettes Objekt übergeben wird (vom Modal)
      updated[index] = field;
    } else {
      // Einzelnes Feld update
      updated[index][field] = value;
      
      if (field === 'unitPrice' || field === 'quantity') {
        updated[index].totalPrice = 
          (parseFloat(updated[index].quantity) || 0) * 
          (parseFloat(updated[index].unitPrice) || 0);
      }
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
  
  const openPositionModal = (position, index) => {
    setSelectedPosition({ position, index });
    setModalOpen(true);
  };

  const isPreliminary = true;  
  const submitOffer = async () => {
    if (totalSum === 0) {
      alert('Bitte geben Sie Preise ein');
      return;
    }
    
   const confirmMessage = 'Möchten Sie dieses vorläufige Angebot abgeben? Sie können es nach einem Ortstermin noch anpassen.';
    
if (!window.confirm(confirmMessage)) {
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
      totalSum,
      isPreliminary: isPreliminary 
    })
  });
  
  if (!res.ok) throw new Error('Fehler beim Abgeben des Angebots');
  
  alert('✅ Vorläufiges Angebot erfolgreich abgegeben!');
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
          <button
            onClick={() => navigate('/handwerker/dashboard')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Zurück zum Dashboard
          </button>
          
          <h1 className="text-4xl font-bold text-white mb-2">Angebot erstellen</h1>
          <p className="text-xl text-gray-300">
            {tender?.tradeName} - {tender?.projectDescription}
          </p>
        </div>

        {/* NEU: Vorbemerkungen Sektion */}
{vorbemerkungen && vorbemerkungen.length > 0 && (
  <div className="bg-blue-500/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-blue-500/30 mb-8">
    <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Projektinformationen & Vorbemerkungen
    </h3>
    <div className="space-y-2">
      {vorbemerkungen.map((bemerkung, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="text-blue-400 mt-1">•</span>
          <p className="text-gray-300 text-sm">{bemerkung}</p>
        </div>
      ))}
    </div>
    <div className="mt-4 pt-4 border-t border-white/10">
      <p className="text-xs text-gray-400">
        Diese Informationen stammen aus der Projekterfassung und gelten für alle Leistungen.
      </p>
    </div>
  </div>
)}
        
       {/* Zweistufige Vergabe Info-Box */}
        <div className="bg-white/5 backdrop-blur-lg rounded-lg shadow-lg p-4 border border-teal-500/20 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-white mb-1">Zweistufige Vergabe</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Sie geben zunächst ein <span className="text-teal-400 font-medium">vorläufiges Angebot</span> ab. 
                Nach einem Ortstermin können Sie Ihr Angebot anpassen, bevor es verbindlich wird. 
                So vermeiden Sie Fehlkalkulationen und können das Projekt vorher realistisch prüfen.
              </p>
            </div>
          </div>
        </div>
        
        {/* Positions Table */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Leistungspositionen</h3>

          {/* NEU: Hinweis zu Vorbemerkungen */}
{vorbemerkungen && vorbemerkungen.length > 0 && (
  <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
    <p className="text-yellow-300 text-xs">
      ℹ️ Bitte berücksichtigen Sie die oben genannten Vorbemerkungen bei Ihrer Kalkulation.
    </p>
  </div>
)}
          
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
                  <th className="text-center p-3">Details</th>
                </tr>
              </thead>
              <tbody>
               {positions.map((pos, idx) => (
  <tr key={idx} className={`border-t border-white/10 hover:bg-white/5 ${
    pos.isNEP ? 'bg-orange-500/10' : pos.isOptional ? 'bg-blue-500/10' : ''
  }`}>
    <td className="p-3">{pos.pos}</td>
    <td className="p-3">
      <div className="flex items-center gap-2">
        <span>{pos.title}</span>
        {pos.isNEP && (
          <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded border border-orange-500/30">
            NEP
          </span>
        )}
        {pos.isOptional && (
          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
            Optional
          </span>
        )}
      </div>
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
                    <td className="text-center p-3">
                      <button
                        onClick={() => openPositionModal(pos, idx)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
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
  disabled={totalSum === 0 || loading}
  className={`w-full py-4 rounded-lg font-semibold text-lg transition-all ${
    totalSum > 0 && !loading
      ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white hover:from-teal-600 hover:to-blue-600 shadow-lg'
      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
  }`}
>
  {loading ? 'Wird gesendet...' : 'Vorläufiges Angebot abgeben'}
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

