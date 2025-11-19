// src/pages/HandwerkerNachtraegeUebersichtPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function HandwerkerNachtraegeUebersichtPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [nachtraege, setNachtraege] = useState([]);
  const [order, setOrder] = useState(null);
  const [totals, setTotals] = useState(null);
  
  useEffect(() => {
    const storedData = sessionStorage.getItem('handwerkerData');
    if (!storedData) {
      navigate('/handwerker/login');
      return;
    }
    
    loadData();
  }, [orderId, navigate]); // eslint-disable-line
  
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Lade Nachträge
      const nachtraegeRes = await fetch(apiUrl(`/api/orders/${orderId}/nachtraege`));
      if (nachtraegeRes.ok) {
        const nachtraegeData = await nachtraegeRes.json();
        setNachtraege(nachtraegeData);
      }
      
      // Lade Auftragsdaten
      const orderRes = await fetch(apiUrl(`/api/orders/${orderId}/lv-details`));
      if (orderRes.ok) {
        const orderData = await orderRes.json();
        setOrder(orderData);
      }
      
      // Lade Summen
      const totalsRes = await fetch(apiUrl(`/api/orders/${orderId}/total-with-nachtraege`));
      if (totalsRes.ok) {
        const totalsData = await totalsRes.json();
        setTotals(totalsData);
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Fehler beim Laden der Daten');
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
  
  const getStatusBadge = (status) => {
    switch(status) {
      case 'submitted':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 text-sm">
            ⏳ In Prüfung
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-green-500/20 text-green-300 border border-green-500/50 text-sm">
            ✓ Beauftragt
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-3 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/50 text-sm">
            ✗ Abgelehnt
          </span>
        );
      default:
        return null;
    }
  };
  
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
    </div>
  );
  
  const approvedNachtraege = nachtraege.filter(n => n.status === 'approved');
  const pendingNachtraege = nachtraege.filter(n => n.status === 'submitted');
  const rejectedNachtraege = nachtraege.filter(n => n.status === 'rejected');
  
  const approvedSum = approvedNachtraege.reduce((sum, n) => sum + (parseFloat(n.amount) || 0), 0);
  const pendingSum = pendingNachtraege.reduce((sum, n) => sum + (parseFloat(n.amount) || 0), 0);
  
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
              <h1 className="text-4xl font-bold text-white mb-2">Eingereichte Nachträge</h1>
              <p className="text-xl text-gray-300">
                {order?.trade_name} - Auftrag #{orderId}
              </p>
            </div>
            <button
              onClick={() => navigate(`/handwerker/auftrag/${orderId}/nachtrag/neu`)}
              className="px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:shadow-xl transition-all font-semibold"
            >
              + Neuer Nachtrag
            </button>
          </div>
        </div>
        
        {/* Summen-Übersicht */}
        {totals && (
          <div className="bg-gradient-to-r from-teal-500/20 to-blue-600/20 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
            <h3 className="text-xl font-bold text-white mb-4">Auftragsübersicht</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-300">Ursprungsauftrag (Netto):</span>
                  <span className="text-white font-semibold">{formatCurrency(totals.originalAmount)}</span>
                </div>
                {totals.bundleDiscount > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-green-400">Bündelrabatt ({totals.bundleDiscount}%):</span>
                      <span className="text-green-400">- {formatCurrency(totals.discountAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/20 pt-2">
                      <span className="text-gray-300">Netto nach Rabatt:</span>
                      <span className="text-white font-semibold">{formatCurrency(totals.nettoAfterDiscount)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t border-white/20 pt-2">
                  <span className="text-teal-400 font-semibold">+ Beauftragte Nachträge:</span>
                  <span className="text-teal-400 font-semibold">{formatCurrency(totals.nachtraegeSum)}</span>
                </div>
                {pendingSum > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-yellow-400">In Prüfung:</span>
                    <span className="text-yellow-400">{formatCurrency(pendingSum)}</span>
                  </div>
                )}
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Gesamt Netto:</span>
                    <span className="text-white font-bold text-lg">{formatCurrency(totals.totalNetto)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">zzgl. 19% MwSt.:</span>
                    <span className="text-gray-300">{formatCurrency(totals.mwst)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/30 pt-2">
                    <span className="text-white font-bold">Gesamt Brutto:</span>
                    <span className="text-teal-400 font-bold text-2xl">{formatCurrency(totals.totalBrutto)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/20">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{nachtraege.length}</p>
                <p className="text-sm text-gray-400">Nachträge gesamt</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-400">{pendingNachtraege.length}</p>
                <p className="text-sm text-gray-400">In Prüfung</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{approvedNachtraege.length}</p>
                <p className="text-sm text-gray-400">Beauftragt</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">{rejectedNachtraege.length}</p>
                <p className="text-sm text-gray-400">Abgelehnt</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Keine Nachträge */}
        {nachtraege.length === 0 && (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-12 border border-white/20 text-center">
            <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Noch keine Nachträge eingereicht</h3>
            <p className="text-gray-400 mb-6">
              Für diesen Auftrag wurden noch keine Nachträge erstellt.
            </p>
            <button
              onClick={() => navigate(`/handwerker/auftrag/${orderId}/nachtrag/neu`)}
              className="px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:shadow-xl transition-all font-semibold"
            >
              Ersten Nachtrag einreichen
            </button>
          </div>
        )}
        
        {/* In Prüfung */}
        {pendingNachtraege.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">In Prüfung ({pendingNachtraege.length})</h2>
            <div className="space-y-4">
              {pendingNachtraege.map((nachtrag) => (
                <div 
                  key={nachtrag.id}
                  className="bg-yellow-500/10 backdrop-blur-lg rounded-xl p-6 border border-yellow-500/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">
                          Nachtrag Nr. {String(nachtrag.nachtrag_number).padStart(2, '0')}
                        </h3>
                        {getStatusBadge(nachtrag.status)}
                      </div>
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{nachtrag.reason}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <span className="text-gray-400">
                          Eingereicht: {new Date(nachtrag.submitted_at).toLocaleDateString('de-DE')}
                        </span>
                        <span className="text-yellow-400 font-semibold">
                          {formatCurrency(nachtrag.amount * 1.19)} Brutto
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-yellow-300">
                          <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-sm">Wird geprüft...</span>
                        </div>
                        <button
                          onClick={() => navigate(`/handwerker/nachtraege/${nachtrag.id}/details`)}
                          className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors text-sm"
                        >
                          Details ansehen
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                ))}
            </div>
          </div>
        )}
        
        {/* Beauftragt */}
        {approvedNachtraege.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              Beauftragt ({approvedNachtraege.length}) - {formatCurrency(approvedSum * 1.19)} Brutto
            </h2>
            <div className="space-y-4">
              {approvedNachtraege.map((nachtrag) => (
                <div 
                  key={nachtrag.id}
                  className="bg-green-500/10 backdrop-blur-lg rounded-xl p-6 border border-green-500/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">
                          Nachtrag Nr. {String(nachtrag.nachtrag_number).padStart(2, '0')}
                        </h3>
                        {getStatusBadge(nachtrag.status)}
                      </div>
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{nachtrag.reason}</p>
                      <div className="flex items-center gap-6 text-sm">
                        <span className="text-gray-400">
                          Eingereicht: {new Date(nachtrag.submitted_at).toLocaleDateString('de-DE')}
                        </span>
                        <span className="text-gray-400">
                          Beauftragt: {new Date(nachtrag.decided_at).toLocaleDateString('de-DE')}
                        </span>
                        <span className="text-green-400 font-semibold">
                          {formatCurrency(nachtrag.amount * 1.19)} Brutto
                        </span>
                      </div>
                    </div>
                     <div className="ml-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-green-300">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm font-semibold">Beauftragt</span>
                        </div>
                        <button
                          onClick={() => navigate(`/handwerker/nachtraege/${nachtrag.id}/details`)}
                          className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors text-sm"
                        >
                          Details ansehen
                        </button>
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Abgelehnt */}
        {rejectedNachtraege.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Abgelehnt ({rejectedNachtraege.length})</h2>
            <div className="space-y-4">
              {rejectedNachtraege.map((nachtrag) => (
                <div 
                  key={nachtrag.id}
                  className="bg-red-500/10 backdrop-blur-lg rounded-xl p-6 border border-red-500/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">
                          Nachtrag Nr. {String(nachtrag.nachtrag_number).padStart(2, '0')}
                        </h3>
                        {getStatusBadge(nachtrag.status)}
                      </div>
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{nachtrag.reason}</p>
                      <div className="flex items-center gap-6 text-sm mb-3">
                        <span className="text-gray-400">
                          Eingereicht: {new Date(nachtrag.submitted_at).toLocaleDateString('de-DE')}
                        </span>
                        <span className="text-gray-400">
                          Abgelehnt: {new Date(nachtrag.decided_at).toLocaleDateString('de-DE')}
                        </span>
                        <span className="text-gray-400 font-semibold">
                          {formatCurrency(nachtrag.amount * 1.19)} Brutto
                        </span>
                      </div>
                      {nachtrag.rejection_reason && (
                        <div className="bg-white/5 rounded p-3">
                          <p className="text-xs text-gray-400 mb-1">Ablehnungsgrund vom Bauherr:</p>
                          <p className="text-sm text-red-300">{nachtrag.rejection_reason}</p>
                        </div>
                      )}
                      {/* ✅ NEU: Details Button auch bei abgelehnten Nachträgen */}
                      <div className="mt-3">
                        <button
                          onClick={() => navigate(`/handwerker/nachtraege/${nachtrag.id}/details`)}
                          className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors text-sm"
                        >
                          Details ansehen
                        </button>
                      </div>
                    </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
