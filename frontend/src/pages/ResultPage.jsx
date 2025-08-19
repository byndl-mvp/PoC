import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function ResultPage() {
  const { projectId } = useParams();
  const [lvs, setLvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchLvs() {
      try {
        setLoading(true);
        const res = await fetch(apiUrl(`/api/projects/${projectId}/lvs`));
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Fehler beim Laden der LVs');
        }
        const data = await res.json();
        setLvs(data.lvs || []);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchLvs();
  }, [projectId]);

  // Berechne Gesamtsumme aus JSON-LV Positionen
  const calculateTotal = (lv) => {
    if (!lv.content || !lv.content.positions) return 0;
    return lv.content.positions.reduce((sum, pos) => {
      // Wenn totalPrice vorhanden, nutze das
      if (pos.totalPrice) return sum + pos.totalPrice;
      // Sonst berechne quantity * unitPrice
      if (pos.quantity && pos.unitPrice) {
        return sum + (pos.quantity * pos.unitPrice);
      }
      return sum;
    }, 0);
  };

  const total = lvs.reduce((acc, lv) => acc + calculateTotal(lv), 0);

  if (loading) return <p>Lade Ergebnisse...</p>;
  if (error) return <p className="text-red-600">Fehler: {error}</p>;
  
  return (
    <div className="max-w-4xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Leistungsverzeichnis</h2>
      {lvs.length === 0 ? (
        <p>Es konnten keine LVs generiert werden.</p>
      ) : (
        <div className="space-y-6">
          {lvs.map((lv, idx) => (
            <div key={idx} className="border rounded p-4 bg-white shadow">
              <h3 className="font-bold text-lg mb-3">
                {lv.trade_name || lv.trade_code}
              </h3>
              
              {lv.content && lv.content.positions ? (
                <div className="space-y-2">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2">Pos.</th>
                        <th className="text-left p-2">Bezeichnung</th>
                        <th className="text-right p-2">Menge</th>
                        <th className="text-left p-2">Einheit</th>
                        <th className="text-right p-2">EP (€)</th>
                        <th className="text-right p-2">GP (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lv.content.positions.map((pos, pidx) => (
                        <tr key={pidx} className="border-t">
                          <td className="p-2">{pos.pos || `${idx+1}.${pidx+1}`}</td>
                          <td className="p-2">
                            <div className="font-medium">{pos.title}</div>
                            {pos.description && (
                              <div className="text-xs text-gray-600 mt-1">
                                {pos.description}
                              </div>
                            )}
                          </td>
                          <td className="text-right p-2">{pos.quantity || '-'}</td>
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
                  
                  {lv.content.notes && (
                    <div className="mt-3 p-2 bg-gray-50 text-sm">
                      <strong>Hinweise:</strong> {lv.content.notes}
                    </div>
                  )}
                  
                  <div className="text-right font-bold pt-2 border-t">
                    Zwischensumme: {calculateTotal(lv).toFixed(2)} €
                  </div>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap text-sm">
                  {typeof lv.content === 'string' ? lv.content : JSON.stringify(lv.content, null, 2)}
                </pre>
              )}
            </div>
          ))}
          
          <div className="text-xl font-bold text-right bg-gray-100 p-4 rounded">
            Gesamtsumme (netto): {total.toFixed(2)} €
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => window.alert('PDF-Export ist noch nicht implementiert.')}
              className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700"
            >
              PDF herunterladen
            </button>
            <button
              onClick={() => window.print()}
              className="bg-gray-600 text-white px-4 py-2 rounded shadow hover:bg-gray-700"
            >
              Drucken
            </button>
          </div>
        </div>
      )}
      <div className="mt-8">
        <Link to="/" className="text-indigo-600 hover:underline">
          Zurück zur Startseite
        </Link>
      </div>
    </div>
  );
}
