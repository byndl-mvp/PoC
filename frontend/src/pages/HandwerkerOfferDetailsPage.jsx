import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

export default function HandwerkerOfferDetailsPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);
  
  useEffect(() => {
    const storedData = sessionStorage.getItem('handwerkerData');
    if (!storedData) {
      navigate('/handwerker/login');
      return;
    }
    
    // Validierung
    try {
      JSON.parse(storedData);
    } catch (error) {
      navigate('/handwerker/login');
      return;
    }
    
    loadOfferDetails();
  }, [offerId, navigate]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const loadOfferDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/offers/${offerId}/details`));
      
      if (!res.ok) throw new Error('Fehler beim Laden');
      
      const data = await res.json();
      setOffer(data);
    } catch (error) {
      console.error('Error loading offer:', error);
      alert('Fehler beim Laden der Angebotsdetails');
      navigate('/handwerker/dashboard');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
    </div>
  );
  
  if (!offer) return null;
  
  const positions = Array.isArray(offer.lv_data) ? offer.lv_data : (offer.lv_data?.positions || []);
  const totalNetto = offer.amount || 0;
  const totalBrutto = totalNetto * 1.19;
  const mwst = totalBrutto - totalNetto;
  
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
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Angebotsdetails</h1>
              <p className="text-xl text-gray-300">
                {offer.trade_name} - {offer.project_category}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3">
              <p className="text-sm text-gray-400">Angebots-ID</p>
              <p className="text-lg font-semibold text-white">#{offer.id}</p>
            </div>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="mb-6">
          {offer.status === 'submitted' && (
            <span className="inline-flex items-center px-4 py-2 rounded-lg bg-green-500/20 text-green-300 border border-green-500/50">
              ✓ Angebot abgegeben
            </span>
          )}
          {offer.status === 'preliminary' && (
            <span className="inline-flex items-center px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-500/50">
              Vorläufig beauftragt
            </span>
          )}
          {offer.status === 'confirmed' && (
            <span className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/50">
              Verbindlich bestätigt
            </span>
          )}
        </div>
        
        {/* Projekt-Informationen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Projektinformationen</h3>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Projekttyp</p>
                <p className="text-white font-medium">{offer.project_category} - {offer.project_sub_category}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Standort</p>
                <p className="text-white font-medium">
                  {offer.project_address}<br />
                  {offer.project_location}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Abgabedatum</p>
                <p className="text-white font-medium">
                  {new Date(offer.created_at).toLocaleDateString('de-DE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Ausführungszeit</p>
                <p className="text-white font-medium">{offer.timeframe || 'Nach Absprache'}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Leistungspositionen */}
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
                      <div className="font-medium">{pos.title}</div>
                      {pos.description && (
                        <div className="text-xs text-gray-400 mt-1">{pos.description}</div>
                      )}
                      {pos.notes && (
                        <div className="text-xs text-yellow-300 mt-1 italic">Hinweis: {pos.notes}</div>
                      )}
                    </td>
                    <td className="text-right p-3">{pos.quantity}</td>
                    <td className="p-3">{pos.unit}</td>
                    <td className="text-right p-3">{formatCurrency(pos.unitPrice)}</td>
                    <td className="text-right p-3 font-medium text-teal-400">
                      {formatCurrency(pos.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Anmerkungen */}
        {offer.notes && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Anmerkungen & Bedingungen</h3>
            <p className="text-gray-300 whitespace-pre-wrap">{offer.notes}</p>
          </div>
        )}
        
        {/* Gesamtsummen */}
        <div className="bg-gradient-to-r from-teal-500/20 to-blue-600/20 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20">
          <div className="space-y-4">
            <div className="flex justify-between items-center text-lg">
              <span className="text-gray-300">Summe Netto:</span>
              <span className="text-white font-semibold">{formatCurrency(totalNetto)}</span>
            </div>
            <div className="flex justify-between items-center text-lg">
              <span className="text-gray-300">MwSt. (19%):</span>
              <span className="text-white font-semibold">{formatCurrency(mwst)}</span>
            </div>
            <div className="border-t border-white/20 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-xl text-white font-bold">Gesamtsumme Brutto:</span>
                <span className="text-3xl text-teal-400 font-bold">{formatCurrency(totalBrutto)}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="mt-8 flex gap-4 justify-center">
          <button
            onClick={() => navigate('/handwerker/dashboard')}
            className="px-8 py-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Zurück zum Dashboard
          </button>
          
          <button
            onClick={() => window.print()}
            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🖨️ Angebot drucken
          </button>
        </div>
      </div>
    </div>
  );
}
