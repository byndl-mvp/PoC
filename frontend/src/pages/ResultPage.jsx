import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function ResultPage() {
  const { projectId } = useParams();
  const [lvs, setLvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [costSummary, setCostSummary] = useState(null);
  const [exportMode, setExportMode] = useState('with-prices'); // 'with-prices' or 'without-prices'

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Lade LVs
        const res = await fetch(apiUrl(`/api/projects/${projectId}/lv`));
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Fehler beim Laden der LVs');
        }
        const data = await res.json();
        setLvs(data.lvs || []);
        
        // Lade Kostenzusammenfassung
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

  // Berechne Gesamtsumme aus JSON-LV Positionen
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

  const handleExport = async (tradeId, withPrices = true) => {
    try {
      const url = apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv/export?withPrices=${withPrices}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Export fehlgeschlagen');
      
      const data = await res.json();
      
      // Erstelle Download-Link für JSON (später PDF)
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
      alert('Export fehlgeschlagen: ' + err.message);
    }
  };

  const handleExportAll = async () => {
    try {
      const withPrices = exportMode === 'with-prices';
      
      for (const lv of lvs) {
        await handleExport(lv.trade_id, withPrices);
      }
      
    } catch (err) {
      alert('Export fehlgeschlagen: ' + err.message);
    }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-200 rounded mb-4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
        <strong>Fehler:</strong> {error}
      </div>
    </div>
  );

  const total = lvs.reduce((acc, lv) => acc + calculateTotal(lv), 0);
  
  return (
    <div className="max-w-6xl mx-auto mt-8 px-4">
      <h2 className="text-3xl font-bold mb-6">Leistungsverzeichnis</h2>
      
      {/* Export-Optionen */}
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold mb-3">Export-Optionen</h3>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="exportMode"
                value="with-prices"
                checked={exportMode === 'with-prices'}
                onChange={(e) => setExportMode(e.target.value)}
                className="mr-2"
              />
              <span>Mit Preisen (für interne Kalkulation)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="exportMode"
                value="without-prices"
                checked={exportMode === 'without-prices'}
                onChange={(e) => setExportMode(e.target.value)}
                className="mr-2"
              />
              <span>Ohne Preise (für Angebotsanfrage)</span>
            </label>
          </div>
          <button
            onClick={handleExportAll}
            className="bg-green-600 text-white px-4 py-2 rounded shadow hover:bg-green-700"
          >
            Alle LVs exportieren
          </button>
        </div>
      </div>

      {lvs.length === 0 ? (
        <p>Es konnten keine LVs generiert werden.</p>
      ) : (
        <div className="space-y-6">
          {lvs.map((lv, idx) => (
            <div key={idx} className="border rounded-lg bg-white shadow-md overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex justify-between items-center">
                <h3 className="font-bold text-lg">
                  {lv.name || lv.trade_name || lv.code}
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport(lv.trade_id, true)}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Export mit Preisen
                  </button>
                  <button
                    onClick={() => handleExport(lv.trade_id, false)}
                    className="text-sm bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
                  >
                    Export ohne Preise
                  </button>
                </div>
              </div>
              
              <div className="p-4">
                {lv.content && lv.content.positions ? (
                  <div className="space-y-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2 font-medium">Pos.</th>
                            <th className="text-left p-2 font-medium">Bezeichnung</th>
                            <th className="text-right p-2 font-medium">Menge</th>
                            <th className="text-left p-2 font-medium">Einheit</th>
                            <th className="text-right p-2 font-medium">EP (€)</th>
                            <th className="text-right p-2 font-medium">GP (€)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lv.content.positions.map((pos, pidx) => (
                            <tr key={pidx} className="border-t hover:bg-gray-50">
                              <td className="p-2">{pos.pos || `${idx+1}.${pidx+1}`}</td>
                              <td className="p-2">
                                <div className="font-medium">{pos.title}</div>
                                {pos.description && (
                                  <div className="text-xs text-gray-600 mt-1">
                                    {pos.description.substring(0, 100)}
                                    {pos.description.length > 100 && '...'}
                                  </div>
                                )}
                              </td>
                              <td className="text-right p-2">{pos.quantity?.toFixed(2) || '-'}</td>
                              <td className="p-2">{pos.unit || '-'}</td>
                              <td className="text-right p-2">
                                {pos.unitPrice ? `${pos.unitPrice.toFixed(2)}` : '-'}
                              </td>
                              <td className="text-right p-2 font-medium">
                                {pos.totalPrice ? `${pos.totalPrice.toFixed(2)}` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {lv.content.notes && (
                      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <strong>Hinweise:</strong> {lv.content.notes}
                      </div>
                    )}
                    
                    <div className="text-right font-bold pt-3 border-t text-lg">
                      Zwischensumme: {calculateTotal(lv).toFixed(2)} €
                    </div>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">
                    {typeof lv.content === 'string' ? lv.content : JSON.stringify(lv.content, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
          
          {/* Kostenzusammenfassung */}
          <div className="bg-gray-100 rounded-lg p-6">
            <h3 className="text-xl font-bold mb-4">Kostenzusammenfassung</h3>
            
            {costSummary ? (
              <div className="space-y-2">
                {costSummary.trades?.map((trade, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{trade.name}</span>
                    <span className={trade.hasPrice ? '' : 'text-gray-400'}>
                      {trade.cost.toFixed(2)} €
                    </span>
                  </div>
                ))}
                
                <div className="border-t pt-2 mt-4">
                  <div className="flex justify-between font-semibold">
                    <span>Netto-Summe:</span>
                    <span>{total.toFixed(2)} €</span>
                  </div>
                  
                  {costSummary.additionalCosts && (
                    <>
                      <div className="flex justify-between text-sm mt-2">
                        <span>Planungskosten (10%):</span>
                        <span>{costSummary.additionalCosts.planningCosts?.toFixed(2) || '0.00'} €</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Unvorhergesehenes (5%):</span>
                        <span>{costSummary.additionalCosts.contingency?.toFixed(2) || '0.00'} €</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>MwSt. (19%):</span>
                        <span>{costSummary.additionalCosts.vat?.toFixed(2) || '0.00'} €</span>
                      </div>
                      
                      <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                        <span>Gesamtsumme:</span>
                        <span>{costSummary.grandTotal?.toFixed(2) || total.toFixed(2)} €</span>
                      </div>
                    </>
                  )}
                </div>
                
                {!costSummary.pricesComplete && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                    <strong>Hinweis:</strong> Einige Positionen haben noch keine Preise. 
                    Exportieren Sie die LVs ohne Preise für Angebotsanfragen an Handwerker.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between font-bold text-xl">
                  <span>Gesamtsumme (netto):</span>
                  <span>{total.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>MwSt. (19%):</span>
                  <span>{(total * 0.19).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between font-bold text-xl border-t pt-2">
                  <span>Gesamtsumme (brutto):</span>
                  <span>{(total * 1.19).toFixed(2)} €</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Aktionsbuttons */}
          <div className="flex flex-wrap gap-4 justify-center mt-8">
            <button
              onClick={() => window.print()}
              className="bg-gray-600 text-white px-6 py-3 rounded shadow hover:bg-gray-700"
            >
              📄 Drucken
            </button>
            <button
              onClick={() => alert('PDF-Export wird vorbereitet...\nBitte nutzen Sie vorerst die JSON-Export-Funktion.')}
              className="bg-indigo-600 text-white px-6 py-3 rounded shadow hover:bg-indigo-700"
            >
              📥 Als PDF speichern
            </button>
            <button
              onClick={() => {
                const mailtoLink = `mailto:?subject=Leistungsverzeichnis&body=Bitte finden Sie anbei das Leistungsverzeichnis für Projekt ${projectId}`;
                window.location.href = mailtoLink;
              }}
              className="bg-blue-600 text-white px-6 py-3 rounded shadow hover:bg-blue-700"
            >
              ✉️ Per E-Mail versenden
            </button>
          </div>
        </div>
      )}
      
      <div className="mt-12 text-center">
        <Link to="/" className="text-indigo-600 hover:underline text-lg">
          ← Zurück zur Startseite
        </Link>
        <span className="mx-4">|</span>
        <Link to="/start" className="text-indigo-600 hover:underline text-lg">
          Neues Projekt starten →
        </Link>
      </div>
    </div>
  );
}
