import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function ResultPage() {
  const { projectId } = useParams();
  const [lvs, setLvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [costSummary, setCostSummary] = useState(null);
  const [exportMode, setExportMode] = useState('with-prices');
  const [selectedLv, setSelectedLv] = useState(null);
  const [editingPosition, setEditingPosition] = useState(null);
  const [editedValues, setEditedValues] = useState({});

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        const res = await fetch(apiUrl(`/api/projects/${projectId}/lv`));
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Fehler beim Laden der LVs');
        }
        const data = await res.json();
        setLvs(data.lvs || []);
        
        const summaryRes = await fetch(apiUrl(`/api/projects/${projectId}/cost-summary`));
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setCostSummary(summaryData.summary);
        }
        
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId]);

  const handleEditPosition = (lvIndex, posIndex, field, value) => {
    const key = `${lvIndex}-${posIndex}-${field}`;
    setEditedValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSavePosition = async (lvIndex, posIndex) => {
    const lv = lvs[lvIndex];
    const position = lv.content.positions[posIndex];
    const key = `${lvIndex}-${posIndex}`;
    
    const updatedPosition = {
      ...position,
      title: editedValues[`${key}-title`] || position.title,
      quantity: parseFloat(editedValues[`${key}-quantity`]) || position.quantity,
      unitPrice: parseFloat(editedValues[`${key}-unitPrice`]) || position.unitPrice,
      description: editedValues[`${key}-description`] || position.description
    };
    
    updatedPosition.totalPrice = updatedPosition.quantity * updatedPosition.unitPrice;
    
    // Update im Backend
    const updatedPositions = [...lv.content.positions];
    updatedPositions[posIndex] = updatedPosition;
    
    const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions: updatedPositions })
    });
    
    if (res.ok) {
      const newLvs = [...lvs];
      newLvs[lvIndex].content.positions = updatedPositions;
      setLvs(newLvs);
      setEditingPosition(null);
      setEditedValues({});
    }
  };

  const handleDeletePosition = async (lvIndex, posIndex) => {
    if (!window.confirm('Position wirklich löschen?')) return;
    
    const lv = lvs[lvIndex];
    const position = lv.content.positions[posIndex];
    
    const res = await fetch(
      apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv/position/${position.pos}`),
      { method: 'DELETE' }
    );
    
    if (res.ok) {
      const newLvs = [...lvs];
      newLvs[lvIndex].content.positions.splice(posIndex, 1);
      setLvs(newLvs);
    }
  };

  const calculateTotal = (lv) => {
    if (!lv.content || !lv.content.positions) return 0;
    return lv.content.positions.reduce((sum, pos) => {
      if (pos.totalPrice) return sum + pos.totalPrice;
      if (pos.quantity && pos.unitPrice) {
        return sum + (pos.quantity * pos.unitPrice);
      }
      return sum;
    }, 0);
  };

  const handleExportPDF = async (tradeId, withPrices = true) => {
    try {
      const url = apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv.pdf?withPrices=${withPrices}`);
      
      // Öffne PDF in neuem Tab
      window.open(url, '_blank');
      
    } catch (err) {
      alert('PDF-Export fehlgeschlagen: ' + err.message);
    }
  };

  const handleExportJSON = async (tradeId, withPrices = true) => {
    try {
      const url = apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv/export?withPrices=${withPrices}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export fehlgeschlagen');
      
      const data = await res.json();
      
      const blob = new Blob([JSON.stringify(data.lv, null, 2)], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `LV_${data.tradeCode}_${withPrices ? 'mit' : 'ohne'}_Preise.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
    } catch (err) {
      alert('JSON-Export fehlgeschlagen: ' + err.message);
    }
  };

  const handleExportCompletePDF = async () => {
    try {
      const withPrices = exportMode === 'with-prices';
      const url = apiUrl(`/api/projects/${projectId}/lv-complete.pdf?withPrices=${withPrices}`);
      
      // Öffne PDF in neuem Tab
      window.open(url, '_blank');
      
    } catch (err) {
      alert('Gesamt-PDF-Export fehlgeschlagen: ' + err.message);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
        <p className="mt-4 text-white">Leistungsverzeichnis wird geladen...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md">
        <p className="text-red-200">Fehler: {error}</p>
      </div>
    </div>
  );

  const total = lvs.reduce((acc, lv) => acc + calculateTotal(lv), 0);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 right-10 w-96 h-96 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Ihr Leistungsverzeichnis
          </h1>
          <p className="text-xl text-gray-300">
            VOB-konform erstellt und bereit zum Export
          </p>
        </div>

        {/* Export Options */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Export-Optionen</h3>
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex gap-6">
              <label className="flex items-center text-white cursor-pointer">
                <input
                  type="radio"
                  name="exportMode"
                  value="with-prices"
                  checked={exportMode === 'with-prices'}
                  onChange={(e) => setExportMode(e.target.value)}
                  className="mr-2 w-4 h-4 text-teal-500"
                />
                <span>Mit Preisen <span className="text-gray-400 text-sm">(interne Kalkulation)</span></span>
              </label>
              <label className="flex items-center text-white cursor-pointer">
                <input
                  type="radio"
                  name="exportMode"
                  value="without-prices"
                  checked={exportMode === 'without-prices'}
                  onChange={(e) => setExportMode(e.target.value)}
                  className="mr-2 w-4 h-4 text-teal-500"
                />
                <span>Ohne Preise <span className="text-gray-400 text-sm">(für Angebotsanfrage)</span></span>
              </label>
            </div>
            <button
              onClick={handleExportCompletePDF}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
            >
              📄 Alle LVs als PDF exportieren
            </button>
          </div>
        </div>

        {/* LV Cards */}
        {lvs.length === 0 ? (
          <div className="text-center text-white">
            <p>Es konnten keine LVs generiert werden.</p>
          </div>
        ) : (
          <div className="grid gap-6 mb-8">
            {lvs.map((lv, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                <div className="bg-gradient-to-r from-blue-600/20 to-teal-600/20 px-6 py-4 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">
                    {lv.name || lv.trade_name || lv.code}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedLv(selectedLv === idx ? null : idx)}
                      className="text-sm bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-all"
                    >
                      {selectedLv === idx ? 'Schließen' : 'Details anzeigen'}
                    </button>
                    <button
                      onClick={() => handleExportPDF(lv.trade_id, exportMode === 'with-prices')}
                      className="text-sm bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-all flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      PDF
                    </button>
                    <button
                      onClick={() => handleExportJSON(lv.trade_id, exportMode === 'with-prices')}
                      className="text-sm bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-all flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
                      </svg>
                      JSON
                    </button>
                  </div>
                </div>
                
                {/* Zusammenfassung immer sichtbar */}
                <div className="px-6 py-4">
                  <div className="flex justify-between items-center text-white">
                    <span className="text-gray-300">
                      {lv.content?.positions?.length || 0} Positionen
                    </span>
                    <span className="text-2xl font-bold text-teal-400">
                      {calculateTotal(lv).toFixed(2)} €
                    </span>
                  </div>
                </div>
                
                {/* Details nur wenn ausgewählt */}
                {selectedLv === idx && lv.content?.positions && (
                  <div className="px-6 pb-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-white">
                        <thead className="bg-white/10">
                          <tr>
                            <th className="text-left p-3 font-medium">Pos.</th>
                            <th className="text-left p-3 font-medium">Bezeichnung</th>
                            <th className="text-right p-3 font-medium">Menge</th>
                            <th className="text-left p-3 font-medium">Einheit</th>
                            <th className="text-right p-3 font-medium">EP (€)</th>
                            <th className="text-right p-3 font-medium">GP (€)</th>
                            <th className="text-center p-3 font-medium">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lv.content.positions.map((pos, pidx) => (
                            <tr key={pidx} className="border-t border-white/10 hover:bg-white/5">
                              <td className="p-3">{pos.pos || `${idx+1}.${pidx+1}`}</td>
                              <td className="p-3">
                                {editingPosition === `${idx}-${pidx}` ? (
                                  <input
                                    type="text"
                                    className="bg-white/20 border border-white/30 rounded px-2 py-1 text-white w-full"
                                    defaultValue={pos.title}
                                    onChange={(e) => handleEditPosition(idx, pidx, 'title', e.target.value)}
                                  />
                                ) : (
                                  <div>
                                    <div className="font-medium">{pos.title}</div>
                                    {pos.description && (
                                      <div className="text-xs text-gray-400 mt-1">
                                        {pos.description.substring(0, 100)}
                                        {pos.description.length > 100 && '...'}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="text-right p-3">
                                {editingPosition === `${idx}-${pidx}` ? (
                                  <input
                                    type="number"
                                    className="bg-white/20 border border-white/30 rounded px-2 py-1 text-white w-20"
                                    defaultValue={pos.quantity}
                                    onChange={(e) => handleEditPosition(idx, pidx, 'quantity', e.target.value)}
                                  />
                                ) : (
                                  pos.quantity?.toFixed(2) || '-'
                                )}
                              </td>
                              <td className="p-3">{pos.unit || '-'}</td>
                              <td className="text-right p-3">
                                {editingPosition === `${idx}-${pidx}` ? (
                                  <input
                                    type="number"
                                    className="bg-white/20 border border-white/30 rounded px-2 py-1 text-white w-20"
                                    defaultValue={pos.unitPrice}
                                    onChange={(e) => handleEditPosition(idx, pidx, 'unitPrice', e.target.value)}
                                  />
                                ) : (
                                  pos.unitPrice ? pos.unitPrice.toFixed(2) : '-'
                                )}
                              </td>
                              <td className="text-right p-3 font-medium text-teal-400">
                                {pos.totalPrice ? pos.totalPrice.toFixed(2) : '-'}
                              </td>
                              <td className="p-3 text-center">
                                {editingPosition === `${idx}-${pidx}` ? (
                                  <div className="flex gap-2 justify-center">
                                    <button
                                      onClick={() => handleSavePosition(idx, pidx)}
                                      className="text-green-400 hover:text-green-300"
                                    >
                                      ✓
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingPosition(null);
                                        setEditedValues({});
                                      }}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      ✗
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex gap-2 justify-center">
                                    <button
                                      onClick={() => setEditingPosition(`${idx}-${pidx}`)}
                                      className="text-blue-400 hover:text-blue-300"
                                    >
                                      ✎
                                    </button>
                                    <button
                                      onClick={() => handleDeletePosition(idx, pidx)}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      🗑
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {lv.content.notes && (
                      <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                        <strong className="text-yellow-300">Hinweise:</strong>
                        <p className="text-yellow-100 mt-1">{lv.content.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Cost Summary */}
        <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <h3 className="text-2xl font-bold text-white mb-6">Kostenzusammenfassung</h3>
          
          <div className="space-y-3">
            {costSummary?.trades?.map((trade, idx) => (
              <div key={idx} className="flex justify-between text-white">
                <span className="text-gray-300">{trade.name}</span>
                <span className={trade.hasPrice ? 'font-medium' : 'text-gray-500'}>
                  {trade.cost.toFixed(2)} €
                </span>
              </div>
            ))}
            
            <div className="border-t border-white/20 pt-4 mt-4 space-y-2">
              <div className="flex justify-between text-xl font-semibold text-white">
                <span>Netto-Summe:</span>
                <span>{total.toFixed(2)} €</span>
              </div>
              
              {costSummary?.additionalCosts && (
                <>
                  <div className="flex justify-between text-gray-300">
                    <span>Planungskosten (10%):</span>
                    <span>{costSummary.additionalCosts.planningCosts?.toFixed(2) || '0.00'} €</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Unvorhergesehenes (5%):</span>
                    <span>{costSummary.additionalCosts.contingency?.toFixed(2) || '0.00'} €</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>MwSt. (19%):</span>
                    <span>{costSummary.additionalCosts.vat?.toFixed(2) || '0.00'} €</span>
                  </div>
                  
                  <div className="flex justify-between text-2xl font-bold text-teal-400 border-t border-white/20 pt-4 mt-4">
                    <span>Gesamtsumme:</span>
                    <span>{costSummary.grandTotal?.toFixed(2) || total.toFixed(2)} €</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mt-12">
          <button
            onClick={() => window.print()}
            className="px-8 py-4 bg-white/10 backdrop-blur border border-white/30 text-white rounded-lg hover:bg-white/20 transition-all"
          >
            🖨 Drucken
          </button>
          <button
            onClick={() => {
              const url = apiUrl(`/api/projects/${projectId}/lv-complete.pdf?withPrices=${exportMode === 'with-prices'}`);
              window.open(url, '_blank');
            }}
            className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
          >
            💾 Als PDF speichern
          </button>
          <button
            onClick={() => {
              const mailtoLink = `mailto:?subject=Leistungsverzeichnis&body=Bitte finden Sie anbei das Leistungsverzeichnis`;
              window.location.href = mailtoLink;
            }}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
          >
            ✉️ Per E-Mail versenden
          </button>
        </div>

        {/* Footer Navigation */}
        <div className="mt-16 text-center">
          <Link to="/" className="text-teal-400 hover:text-teal-300 text-lg mx-4 transition-colors">
            ← Zur Startseite
          </Link>
          <span className="text-white/30">|</span>
          <Link to="/start" className="text-teal-400 hover:text-teal-300 text-lg mx-4 transition-colors">
            Neues Projekt starten →
          </Link>
        </div>
      </div>
    </div>
  );
}
