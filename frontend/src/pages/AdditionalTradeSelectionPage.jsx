import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function AdditionalTradeSelectionPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [availableTrades, setAvailableTrades] = useState([]);
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
  loadAvailableTrades();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [projectId]);

  async function loadAvailableTrades() {
    try {
      // Lade alle Gewerke
      const tradesRes = await fetch(apiUrl('/api/trades'));
      const allTrades = await tradesRes.json();
      
      // Lade bereits verwendete Gewerke
      const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
      const projectData = await projectRes.json();
      
      // Filtere nur noch nicht verwendete Gewerke
      const usedTradeIds = projectData.trades.map(t => t.id);
      const unused = allTrades.filter(t => 
        !usedTradeIds.includes(t.id) && 
        t.code !== 'INT' // Intake ausschließen
      );
      
      setAvailableTrades(unused);
      setLoading(false);
    } catch (err) {
      console.error('Error loading trades:', err);
      setError('Fehler beim Laden der verfügbaren Gewerke');
      setLoading(false);
    }
  }

  async function handleAddTrade() {
    if (!selectedTrade) {
      setError('Bitte wählen Sie ein Gewerk aus');
      return;
    }

    try {
      setLoading(true);
      
      // Füge das Gewerk zum Projekt hinzu
      const response = await fetch(apiUrl(`/api/projects/${projectId}/trades/add-single`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: selectedTrade.id,
          isAdditional: true
        })
      });

      if (!response.ok) {
        throw new Error('Fehler beim Hinzufügen des Gewerks');
      }

      // Navigiere direkt zur Fragenseite mit Flag für zusätzliches Gewerk
      navigate(`/project/${projectId}/trade/${selectedTrade.id}/questions?additional=true`);
      
    } catch (err) {
      console.error('Error adding trade:', err);
      setError(err.message);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-white">Lade verfügbare Gewerke...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Zusätzliches Gewerk hinzufügen
          </h1>
          <p className="text-gray-300 mb-8">
            Wählen Sie ein weiteres Gewerk aus, das Sie ausschreiben möchten
          </p>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-white p-4 rounded-lg mb-6">
              {error}
            </div>
          )}

          {availableTrades.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-300 mb-4">
                Alle verfügbaren Gewerke wurden bereits ausgeschrieben.
              </p>
              <button
                onClick={() => navigate(`/project/${projectId}/result`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg"
              >
                Zurück zur Übersicht
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {availableTrades.map(trade => (
                  <div
                    key={trade.id}
                    onClick={() => setSelectedTrade(trade)}
                    className={`
                      p-4 rounded-lg cursor-pointer transition-all
                      ${selectedTrade?.id === trade.id
                        ? 'bg-blue-600 text-white shadow-xl scale-105'
                        : 'bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white'
                      }
                    `}
                  >
                    <h3 className="font-semibold text-lg">{trade.name}</h3>
                    <p className="text-sm opacity-75">Code: {trade.code}</p>
                    {trade.complexity && (
                      <p className="text-xs mt-2">
                        Komplexität: {trade.complexity.complexity}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => navigate(`/project/${projectId}/result`)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleAddTrade}
                  disabled={!selectedTrade}
                  className={`
                    px-6 py-3 rounded-lg font-semibold
                    ${selectedTrade
                      ? 'bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  Gewerk hinzufügen und Fragen starten
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
