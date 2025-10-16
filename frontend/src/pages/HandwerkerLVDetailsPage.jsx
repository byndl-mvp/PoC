import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

function formatCurrency(value) {
  if (!value && value !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

export default function HandwerkerLVDetailsPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState(null);
  const [lvData, setLvData] = useState({ positions: [] });

  const loadLVDetails = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/orders/${orderId}/lv-details`));
      if (res.ok) {
        const data = await res.json();
        setOrderData(data);
        
        // Parse LV-Daten
        let parsedLV = data.lv_data;
        if (typeof parsedLV === 'string') {
          parsedLV = JSON.parse(parsedLV);
        }
        if (Array.isArray(parsedLV)) {
          parsedLV = { positions: parsedLV };
        } else if (!parsedLV || !Array.isArray(parsedLV.positions)) {
          parsedLV = { positions: [] };
        }
        setLvData(parsedLV);
      }
    } catch (err) {
      console.error('Error loading LV details:', err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadLVDetails();
  }, [loadLVDetails]);

  const calculateTotal = () => {
    if (!lvData.positions || lvData.positions.length === 0) return 0;
    return lvData.positions.reduce((sum, pos) => {
      const quantity = parseFloat(pos.quantity) || 0;
      const unitPrice = parseFloat(pos.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-white">Lade LV-Details...</p>
      </div>
    </div>
  );

  if (!orderData) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <p className="text-white">LV-Details nicht gefunden</p>
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
            onClick={() => navigate('/handwerker/dashboard')} 
            className="text-gray-400 hover:text-white flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Zurück zum Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-8">
        <h1 className="text-4xl font-bold text-white mb-2">Leistungsverzeichnis</h1>
        <p className="text-gray-400 mb-8">Auftrag #{orderId}</p>

        {/* Projektinfo */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">{orderData.trade_name}</h2>
          <div className="grid md:grid-cols-2 gap-4 text-gray-300">
            <div>
              <p><strong className="text-white">Projekt:</strong> {orderData.project_description}</p>
              <p><strong className="text-white">Ort:</strong> {orderData.street} {orderData.house_number}, {orderData.zip_code} {orderData.city}</p>
            </div>
            <div>
              <p><strong className="text-white">Bauherr:</strong> {orderData.bauherr_name}</p>
              <p><strong className="text-white">Auftragsdatum:</strong> {new Date(orderData.created_at).toLocaleDateString('de-DE')}</p>
            </div>
          </div>
        </div>

        {/* LV-Positionen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6">Positionen</h2>
          
          {lvData.positions && lvData.positions.length > 0 ? (
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
                  {lvData.positions.map((pos, index) => (
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
          <div className="mt-8 pt-6 border-t border-white/20">
            <div className="flex justify-end">
              <div className="w-96 space-y-2">
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
        </div>

        {/* Actions */}
        <div className="flex gap-4 mt-6">
          <button
            onClick={() => window.print()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Drucken
          </button>
          <button
            onClick={() => window.open(apiUrl(`/api/orders/${orderId}/lv-pdf`), '_blank')}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            LV als PDF herunterladen
          </button>
        </div>
      </div>
    </div>
  );
}
