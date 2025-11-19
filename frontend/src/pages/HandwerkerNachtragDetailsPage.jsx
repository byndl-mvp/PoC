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

export default function HandwerkerNachtragDetailsPage() {
  const { nachtragId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nachtrag, setNachtrag] = useState(null);

  useEffect(() => {
    const storedData = sessionStorage.getItem('handwerkerData');
    if (!storedData) {
      navigate('/handwerker/login');
      return;
    }
    loadNachtrag();
  }, [nachtragId]); // eslint-disable-line

  const loadNachtrag = async () => {
    try {
      const res = await fetch(apiUrl(`/api/nachtraege/${nachtragId}`));
      if (res.ok) {
        const data = await res.json();
        setNachtrag(data);
      }
    } catch (error) {
      console.error('Error loading nachtrag:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-white">Lade Nachtrag...</p>
        </div>
      </div>
    );
  }

  if (!nachtrag) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <p className="text-white">Nachtrag nicht gefunden</p>
      </div>
    );
  }

  // Parse LV-Daten
  let positions = [];
  if (nachtrag.lv_data) {
    let parsedLV = nachtrag.lv_data;
    if (typeof parsedLV === 'string') {
      parsedLV = JSON.parse(parsedLV);
    }
    if (Array.isArray(parsedLV)) {
      positions = parsedLV;
    } else if (parsedLV.positions) {
      positions = parsedLV.positions;
    }
  }

  const netto = parseFloat(nachtrag.amount) || 0;
  const mwst = netto * 0.19;
  const brutto = netto + mwst;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <span className="px-3 py-1 bg-green-500/30 text-green-300 rounded-full text-sm font-semibold">✓ Beauftragt</span>;
      case 'rejected':
        return <span className="px-3 py-1 bg-red-500/30 text-red-300 rounded-full text-sm font-semibold">✗ Abgelehnt</span>;
      default:
        return <span className="px-3 py-1 bg-yellow-500/30 text-yellow-300 rounded-full text-sm font-semibold">⏳ In Prüfung</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white flex items-center gap-2 mb-6"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Zurück
        </button>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              Nachtrag Nr. {String(nachtrag.nachtrag_number).padStart(2, '0')}
            </h1>
            <p className="text-gray-400">Auftrag #{nachtrag.order_id}</p>
          </div>
          {getStatusBadge(nachtrag.status)}
        </div>

        {/* Grundinformationen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">Informationen</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">Begründung</p>
              <p className="text-white">{nachtrag.reason}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Status</p>
              <p className="text-white">
                {nachtrag.status === 'approved' && '✓ Beauftragt'}
                {nachtrag.status === 'rejected' && '✗ Abgelehnt'}
                {nachtrag.status === 'submitted' && '⏳ In Prüfung beim Bauherr'}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Eingereicht am</p>
              <p className="text-white">{new Date(nachtrag.submitted_at).toLocaleDateString('de-DE')}</p>
            </div>
            {nachtrag.decided_at && (
              <div>
                <p className="text-gray-400 text-sm mb-1">
                  {nachtrag.status === 'approved' ? 'Beauftragt am' : 'Entschieden am'}
                </p>
                <p className="text-white">{new Date(nachtrag.decided_at).toLocaleDateString('de-DE')}</p>
              </div>
            )}
          </div>

          {nachtrag.status === 'rejected' && nachtrag.rejection_reason && (
            <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300 font-semibold mb-2">Ablehnungsgrund:</p>
              <p className="text-red-200">{nachtrag.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* LV-Positionen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-6">Positionen</h2>
          
          {positions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left py-3 px-2 text-gray-400">Pos</th>
                    <th className="text-left py-3 px-2 text-gray-400">Bezeichnung</th>
                    <th className="text-right py-3 px-2 text-gray-400">Menge</th>
                    <th className="text-left py-3 px-2 text-gray-400">Einheit</th>
                    <th className="text-right py-3 px-2 text-gray-400">EP</th>
                    <th className="text-right py-3 px-2 text-gray-400">Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos, index) => (
                    <tr key={index} className="border-b border-white/10">
                      <td className="py-4 px-2 text-teal-400 font-bold">{pos.pos || index + 1}</td>
                      <td className="py-4 px-2">
                        <p className="text-white font-semibold">{pos.title}</p>
                        {pos.description && (
                          <p className="text-gray-400 text-sm mt-1">{pos.description}</p>
                        )}
                      </td>
                      <td className="py-4 px-2 text-right text-white">{pos.quantity}</td>
                      <td className="py-4 px-2 text-white">{pos.unit}</td>
                      <td className="py-4 px-2 text-right text-white">{formatCurrency(pos.unitPrice)}</td>
                      <td className="py-4 px-2 text-right text-teal-400 font-bold">
                        {formatCurrency((parseFloat(pos.quantity) || 0) * (parseFloat(pos.unitPrice) || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">Keine Positionen vorhanden</p>
          )}

          {/* Summen */}
          <div className="border-t border-white/20 mt-6 pt-6">
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Nachtragssumme Netto:</span>
                  <span className="text-white font-bold text-xl">{formatCurrency(netto)}</span>
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
        </div>
      </div>
    </div>
  );
}
