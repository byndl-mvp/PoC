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

  // Gruppiere Positionen nach Überschriften
  const groupPositionsByHeadings = (positions) => {
    if (!positions || positions.length === 0) return [];
    
    const groups = [];
    let currentGroup = {
      heading: null,
      positions: []
    };
    
    positions.forEach((position, index) => {
      // Prüfe ob es eine Überschrift ist (keine Menge/Einheit oder Kennzeichnung)
      if (position.isHeading || (!position.quantity && !position.unit && position.shortText)) {
        // Speichere vorherige Gruppe falls vorhanden
        if (currentGroup.heading !== null || currentGroup.positions.length > 0) {
          groups.push(currentGroup);
        }
        // Starte neue Gruppe
        currentGroup = {
          heading: position.shortText || position.description,
          positions: []
        };
      } else {
        // Füge Position zur aktuellen Gruppe hinzu
        currentGroup.positions.push({ ...position, originalIndex: index });
      }
    });
    
    // Füge letzte Gruppe hinzu
    if (currentGroup.heading !== null || currentGroup.positions.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups.length > 0 ? groups : [{ heading: null, positions: positions.map((p, i) => ({ ...p, originalIndex: i })) }];
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

  const positionGroups = groupPositionsByHeadings(data.lv.positions);

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

        {/* LV Positionen mit Gruppierung */}
        {positionGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-6">
            {/* Überschrift der Gruppe */}
            {group.heading && (
              <div className="bg-gradient-to-r from-blue-600/30 to-teal-600/30 backdrop-blur-lg rounded-lg p-4 mb-3 border border-white/20">
                <h3 className="text-lg font-bold text-white">{group.heading}</h3>
              </div>
            )}
            
            {/* Positionen der Gruppe */}
            {group.positions.length > 0 && (
              <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Pos.
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Leistungsbeschreibung
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Menge
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Einheit
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                          Aktion
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {group.positions.map((position, index) => (
                        <tr key={index} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-4 text-white font-mono align-top">
                            {String(position.originalIndex + 1).padStart(3, '0')}
                          </td>
                          <td className="px-4 py-4 text-white">
                            <div className="space-y-2">
                              {position.shortText && (
                                <div className="font-semibold text-teal-400">
                                  {position.shortText}
                                </div>
                              )}
                              {position.description && (
                                <div className="text-gray-300 text-sm whitespace-pre-wrap">
                                  {position.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center text-white font-semibold align-top">
                            {position.quantity?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-4 py-4 text-center text-gray-300 align-top">
                            {position.unit || '-'}
                          </td>
                          <td className="px-4 py-4 text-center align-top">
                            <button
                              onClick={() => handleOpenModal(position, position.originalIndex)}
                              className="px-3 py-1 bg-blue-600/30 text-blue-300 rounded hover:bg-blue-600/50 transition-colors text-sm"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Footer Zusammenfassung */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 mt-6">
          <p className="text-gray-400 text-sm text-center">
            Gesamt: {data.lv.positions?.length || 0} Positionen | 
            Preise werden erst nach Angebotsabgabe durch die Handwerker sichtbar
          </p>
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

      {/* Detail Modal */}
      {selectedPosition && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
        >
          <div 
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600/20 to-teal-600/20 p-6 border-b border-white/10 sticky top-0 z-10">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Position {String(modalPosIndex + 1).padStart(3, '0')}
                  </h3>
                  {selectedPosition.shortText && (
                    <p className="text-teal-400 text-lg font-semibold mb-1">
                      {selectedPosition.shortText}
                    </p>
                  )}
                  <p className="text-gray-400 text-sm">Detailansicht (nur Lesemodus)</p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Langbeschreibung */}
              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">
                  Ausführliche Beschreibung
                </label>
                <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                  <p className="text-white whitespace-pre-wrap">
                    {selectedPosition.description || '-'}
                  </p>
                </div>
              </div>

              {/* Mengenangaben */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Menge
                  </label>
                  <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                    <p className="text-white text-xl font-bold">
                      {selectedPosition.quantity?.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-400 mb-2">
                    Einheit
                  </label>
                  <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                    <p className="text-white text-xl font-bold">
                      {selectedPosition.unit || '-'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Hinweis */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-300 text-sm">
                  <strong>💡 Hinweis:</strong> In der Vorschau-Ansicht sind keine Preise sichtbar. 
                  Diese werden erst nach Angebotsabgabe durch die Handwerker angezeigt.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-white/5 p-4 border-t border-white/10 flex justify-end sticky bottom-0">
              <button
                onClick={handleCloseModal}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
