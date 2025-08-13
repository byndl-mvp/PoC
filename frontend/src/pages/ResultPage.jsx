import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

export default function ResultPage() {
  const { projectId } = useParams();
  const [lvs, setLvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchLvs() {
      try {
        setLoading(true);
        const res = await fetch(`https://poc-rvrj.onrender.com/api/project/${projectId}/lv`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Fehler beim Laden der LVs');
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

  // Parse total price from LV content (placeholder logic)
  const parseTotal = (content) => {
    const priceRegex = /Preis:\s*([\d,\.]+)\s*EUR/gi;
    let sum = 0;
    let match;
    while ((match = priceRegex.exec(content)) !== null) {
      const value = parseFloat(match[1].replace(',', '.'));
      if (!isNaN(value)) sum += value;
    }
    return sum;
  };

  const total = lvs.reduce((acc, lv) => acc + parseTotal(lv.content), 0);

  if (loading) return <p>Lade Ergebnisse …</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Ergebnis</h2>
      {lvs.length === 0 ? (
        <p>Es konnten keine LVs generiert werden.</p>
      ) : (
        <div className="space-y-6">
          {lvs.map((lv, idx) => (
            <div key={idx} className="border rounded p-4 bg-white shadow">
              <h3 className="font-bold mb-2">Gewerk: {lv.trade_name}</h3>
              <pre className="whitespace-pre-wrap text-sm">{lv.content}</pre>
            </div>
          ))}
          <div className="text-lg font-semibold">
            Gesamtpreis: {total.toFixed(2)} EUR
          </div>
          {/* Placeholder for PDF download; backend should implement /api/export/:projectId */}
          <button
            onClick={() => window.alert('PDF-Export ist noch nicht implementiert.')}
            className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700"
          >
            PDF herunterladen
          </button>
        </div>
      )}
      <div className="mt-8">
        <Link to="/" className="text-indigo-600 hover:underline">Zurück zur Startseite</Link>
      </div>
    </div>
  );
}
