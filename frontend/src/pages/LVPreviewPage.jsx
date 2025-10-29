import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function LVPreviewPage() {
  const { projectId, tenderId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [modalPosIndex, setModalPosIndex] = useState(null);

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

  const handleOpenModal = (position, index) => {
    setSelectedPosition(position);
    setModalPosIndex(index);
  };

  const handleCloseModal = () => {
    setSelectedPosition(null);
    setModalPosIndex(null);
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
              <h1 className="text-2xl font-bold text-white">Leistungsverzeichnis {data.tender.trade_name}</h1>
              <p className="text-gray-400 text-sm mt-1">Vorschau ohne Preise</p>
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

        {/* LV Positionen - EXAKT wie ResultPage */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/20 mb-6">
          <div className="bg-gradient-to-r from-blue-600/20 to-teal-600/20 px-6 py-4">
            <h3 className="text-xl font-bold text-white">Leistungsverzeichnis</h3>
          </div>

          <div className="px-6 py-4">
            <div className="flex justify-between items-center text-white mb-4">
              <span className="text-gray-300">
                {data.lv.positions?.length || 0} Positionen
              </span>
            </div>
          </div>

          {/* Tabelle - EXAKT wie ResultPage */}
          <div className="px-6 pb-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-white">
                <thead className="bg-white/10">
                  <tr>
                    <th className="text-left p-3 font-medium">Pos.</th>
                    <th className="text-left p-3 font-medium">Bezeichnung</th>
                    <th className="text-right p-3 font-medium">Menge</th>
                    <th className="text-left p-3 font-medium">Einheit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lv.positions?.map((pos, pidx) => (
                    <tr 
                      key={pidx} 
                      className="border-t border-white/10 hover:bg-white/5 cursor-pointer"
                      onClick={() => handleOpenModal(pos, pidx)}
                    >
                      <td className="p-3">
                        {pos.pos || `${pidx+1}`}
                      </td>
                      <td className="p-3">
                        <div>
                          <div className="font-medium">{pos.title || pos.shortText}</div>
                          {pos.description && (
                            <div className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">
                              {pos.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="text-right p-3">
                        {pos.quantity?.toFixed(2) || '0.00'}
                      </td>
                      <td className="text-left p-3">
                        {pos.unit || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      {/* Position Modal - EXAKT wie ResultPage, nur ohne Preis-Felder */}
      {selectedPosition && modalPosIndex !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header - EXAKT wie ResultPage */}
            <div className="bg-gradient-to-r from-blue-600 to-teal-600 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold">Position {selectedPosition.pos || (modalPosIndex + 1)}</h3>
                  <p className="text-blue-100 mt-1">{data.tender.trade_name}</p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Modal Content - NUR LESEMODUS */}
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
                  <div className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50">
                    {selectedPosition.title || selectedPosition.shortText}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                  <div className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 min-h-[100px] whitespace-pre-wrap">
                    {selectedPosition.description || '-'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Menge</label>
                    <div className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50">
                      {selectedPosition.quantity?.toFixed(2) || '0.00'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
                    <div className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50">
                      {selectedPosition.unit || '-'}
                    </div>
                  </div>
                </div>

                {/* Hinweis */}
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-4">
                  <div className="flex items-start">
                    <svg className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-blue-700">
                      <strong>Hinweis:</strong> In dieser Vorschau-Ansicht sind keine Preise sichtbar. 
                      Diese werden erst nach Angebotsabgabe durch die Handwerker angezeigt.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleCloseModal}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
