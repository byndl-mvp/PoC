import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function HandwerkerOfferConfirmPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);
  const [formData, setFormData] = useState({
    amount: 0,
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
        setFormData({
          amount: data.amount,
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

  const handleConfirm = async () => {
    if (!formData.execution_start || !formData.execution_end) {
      alert('Bitte geben Sie die Ausführungstermine an.');
      return;
    }

    if (!window.confirm('Möchten Sie dieses Angebot verbindlich bestätigen?')) return;

    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/offers/${offerId}/confirm-final`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center"><p className="text-white">Lädt...</p></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-4xl mx-auto p-8">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white mb-6">← Zurück</button>
        
        <h1 className="text-4xl font-bold text-white mb-8">Angebot anpassen und bestätigen</h1>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-6">{offer?.trade_name}</h2>
          
          {/* Angebotssumme */}
          <div className="mb-6">
            <label className="block text-white font-semibold mb-2">Angebotssumme (Netto)</label>
            <input
              type="number"
              step="0.01"
              className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white text-2xl font-bold"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
            />
          </div>
          
          {/* Ausführungstermine */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-white font-semibold mb-2">Ausführung von *</label>
              <input
                type="date"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                value={formData.execution_start}
                onChange={(e) => setFormData({...formData, execution_start: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-white font-semibold mb-2">Ausführung bis *</label>
              <input
                type="date"
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                value={formData.execution_end}
                onChange={(e) => setFormData({...formData, execution_end: e.target.value})}
                required
              />
            </div>
          </div>
          
          {/* Anmerkungen */}
          <div className="mb-6">
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
    </div>
  );
}
