import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function LVPreviewPage() {
  const { projectId, tenderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadLVPreview();
  }, [projectId, tenderId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const loadLVPreview = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/project/${projectId}/tender/${tenderId}/lv-preview`));
      
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else {
        alert('Fehler beim Laden der LV-Vorschau');
        navigate(-1);
      }
    } catch (error) {
      console.error('Error loading LV preview:', error);
      alert('Fehler beim Laden der LV-Vorschau');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-white">Lade LV-Vorschau...</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">LV-Vorschau (ohne Preise)</h1>
              <p className="text-gray-400 text-sm mt-1">{data.tender.trade_name}</p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Zurück
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Info-Box */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <p className="text-blue-300 text-sm">
            <strong>ℹ️ Hinweis:</strong> Diese Ansicht zeigt das ausgeschriebene Leistungsverzeichnis 
            ohne Preise - so wie es die Handwerker sehen. Die Mengen und Beschreibungen entsprechen 
            exakt Ihrer Ausschreibung.
          </p>
        </div>

        {/* Tender Details */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 mb-6">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">Ausgeschrieben am</p>
              <p className="text-white font-semibold">
                {new Date(data.tender.created_at).toLocaleDateString('de-DE', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Projektadresse</p>
              <p className="text-white">
                {data.project.street}<br />
                {data.project.zip} {data.project.city}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Anzahl Positionen</p>
              <p className="text-white font-semibold text-2xl">
                {data.lv.positions?.length || 0}
              </p>
            </div>
          </div>
        </div>

        {/* LV Positionen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600/20 to-teal-600/20 p-4 border-b border-white/10">
            <h2 className="text-xl font-bold text-white">Leistungsverzeichnis</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Pos.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Kurzbeschreibung
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Beschreibung
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Menge
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    Einheit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {data.lv.positions?.map((position, index) => (
                  <tr key={index} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4 text-white font-mono">
                      {String(index + 1).padStart(3, '0')}
                    </td>
                    <td className="px-4 py-4 text-white">
                      {position.shortText || '-'}
                    </td>
                    <td className="px-4 py-4 text-gray-300 text-sm">
                      {position.description || '-'}
                    </td>
                    <td className="px-4 py-4 text-center text-white font-semibold">
                      {position.quantity?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-4 py-4 text-center text-gray-300">
                      {position.unit || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer mit Hinweis */}
          <div className="bg-white/5 p-4 border-t border-white/10">
            <p className="text-gray-400 text-sm text-center">
              Gesamt: {data.lv.positions?.length || 0} Positionen | 
              Preise werden erst nach Angebotsabgabe durch die Handwerker sichtbar
            </p>
          </div>
        </div>

        {/* Aktionsbuttons */}
        <div className="mt-6 flex gap-4 justify-center">
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
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Zurück zu Ausschreibungen
          </button>
        </div>
      </div>
    </div>
  );
}
