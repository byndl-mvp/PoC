import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function TradeConfirmationPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [detectedTrades, setDetectedTrades] = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [selectedTrades, setSelectedTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Analysiere Projektdaten...');
  const [error, setError] = useState('');
  const [intakeSummary, setIntakeSummary] = useState(null);
  const [addingTrade, setAddingTrade] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setLoadingMessage('Lade Projektdetails...');
        
        // 1. Lade Projektdetails mit initial erkannten Gewerken
        const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
        if (!projectRes.ok) throw new Error('Projekt nicht gefunden');
        const projectData = await projectRes.json();
        setProject(projectData);
        
        // Initial erkannte Gewerke (ohne INT)
        const initialDetected = (projectData.trades || []).filter(t => t.code !== 'INT');
        
        // 2. Lade Intake-Summary für bessere Gewerke-Empfehlungen
        setLoadingMessage('Analysiere Ihre Antworten...');
        let finalRecommendations = [];
        try {
          const summaryRes = await fetch(apiUrl(`/api/projects/${projectId}/intake/summary`));
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            setIntakeSummary(summaryData.summary);
            
            // Nutze die KI-Empfehlungen basierend auf Intake-Antworten
            if (summaryData.summary?.trades && Array.isArray(summaryData.summary.trades)) {
              finalRecommendations = summaryData.summary.trades;
            }
          }
        } catch (err) {
          console.log('Keine Zusammenfassung verfügbar, nutze initial erkannte Gewerke');
        }
        
        // 3. Lade alle verfügbaren Gewerke
        const tradesRes = await fetch(apiUrl('/api/trades'));
        const allTradesData = await tradesRes.json();
        
        // 4. Kombiniere initial erkannte und KI-empfohlene Gewerke
        const combinedTrades = [...initialDetected];
        
        // Füge KI-empfohlene Gewerke hinzu (wenn nicht schon vorhanden)
        for (const rec of finalRecommendations) {
          const tradeToadd = allTradesData.find(t => t.code === rec.code);
          if (tradeToadd && !combinedTrades.some(t => t.id === tradeToadd.id)) {
            combinedTrades.push({
              ...tradeToadd,
              recommended: true,
              reason: rec.reason
            });
          }
        }
        
        // Markiere initial erkannte vs. KI-empfohlene
        const markedTrades = combinedTrades.map(trade => ({
          ...trade,
          source: trade.recommended ? 'ki-empfohlen' : 'initial-erkannt',
          isManuallyAdded: false
        }));
        
        setDetectedTrades(markedTrades);
        setSelectedTrades(markedTrades.map(t => t.id));
        
        // Verfügbare Trades (ohne INT und bereits erkannte/empfohlene)
        const availableTrades = allTradesData.filter(t => 
          t.code !== 'INT' && !markedTrades.some(d => d.id === t.id)
        );
        setAllTrades(availableTrades);
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [projectId]);

  const toggleTrade = (tradeId) => {
    setSelectedTrades(prev => {
      if (prev.includes(tradeId)) {
        return prev.filter(id => id !== tradeId);
      } else {
        return [...prev, tradeId];
      }
    });
  };

  const addTrade = async (tradeId) => {
    if (!tradeId) return;
    
    const trade = allTrades.find(t => t.id === parseInt(tradeId));
    if (trade) {
      setAddingTrade(true);
      
      // Füge zu erkannten Trades hinzu (als manuell hinzugefügt markiert)
      const manualTrade = { 
        ...trade, 
        source: 'manuell',
        isManuallyAdded: true  // Wichtig für kontextbezogene Fragen
      };
      
      console.log('Adding manual trade:', trade.id, 'with flag:', manualTrade.isManuallyAdded);
      
      setDetectedTrades(prev => [...prev, manualTrade]);
      setSelectedTrades(prev => [...prev, trade.id]);
      // Entferne aus verfügbaren Trades
      setAllTrades(prev => prev.filter(t => t.id !== trade.id));
      
      setAddingTrade(false);
    }
  };

  const handleContinue = async () => {
    if (selectedTrades.length === 0) {
      alert('Bitte wählen Sie mindestens ein Gewerk aus');
      return;
    }
    
    try {
      setLoading(true);
      setLoadingMessage('Speichere Gewerkeauswahl...');
      
      // Speichere die ausgewählten Gewerke
      const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/confirm`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          confirmedTrades: selectedTrades 
        })
      });
      
      if (!res.ok) throw new Error('Fehler beim Speichern der Gewerke');
      
      // Weiter zum ersten Gewerk für spezifische Fragen
      const confirmedTradesData = detectedTrades.filter(t => selectedTrades.includes(t.id));
      if (confirmedTradesData.length > 0) {
        
  // Speichere Info über manuell hinzugefügte Gewerke in sessionStorage
  const manuallyAddedTrades = confirmedTradesData
    .filter(t => t.isManuallyAdded)
    .map(t => t.id);

  console.log('Confirmed trades:', confirmedTradesData);
  console.log('Filtering for manual trades...');
  console.log('Manual trades found:', manuallyAddedTrades);
        
  if (manuallyAddedTrades.length > 0) {
    sessionStorage.setItem('manuallyAddedTrades', JSON.stringify(manuallyAddedTrades));
  }
  
  navigate(`/project/${projectId}/trade/${confirmedTradesData[0].id}/questions`);
} else {
  navigate(`/project/${projectId}/result`);
}
      
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-64 bg-white/20 rounded-full h-2 backdrop-blur mb-4">
          <div className="bg-gradient-to-r from-teal-500 to-blue-600 h-2 rounded-full animate-pulse" 
               style={{ width: '75%' }} />
        </div>
        <p className="mt-4 text-white">{loadingMessage}</p>
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-40 right-20 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-40 left-20 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Gewerke-Auswahl bestätigen
          </h1>
          <p className="text-gray-300">
            Basierend auf Ihren Angaben empfehlen wir folgende Gewerke.
            Sie können die Auswahl anpassen.
          </p>
        </div>

        {/* Project Info */}
        {project && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
            <h3 className="text-white font-semibold mb-2">Ihr Projekt:</h3>
            <p className="text-gray-300">{project.category} {project.sub_category && `- ${project.sub_category}`}</p>
            <p className="text-gray-400 text-sm mt-2">{project.description}</p>
          </div>
        )}

        {/* KI-Empfehlungen Info */}
        {intakeSummary && (intakeSummary.recommendations || intakeSummary.risks) && (
          <div className="bg-yellow-500/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-yellow-500/30">
            <h3 className="text-yellow-300 font-semibold mb-3">
              💡 Zusätzliche Empfehlungen basierend auf Ihren Angaben:
            </h3>
            {intakeSummary.recommendations && intakeSummary.recommendations.length > 0 && (
              <div className="mb-3">
                <p className="text-gray-300 text-sm mb-2">Empfohlene Experten:</p>
                <ul className="list-disc list-inside text-gray-400 text-sm">
                  {intakeSummary.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
            {intakeSummary.risks && intakeSummary.risks.length > 0 && (
              <div>
                <p className="text-gray-300 text-sm mb-2">Zu beachten:</p>
                <ul className="list-disc list-inside text-gray-400 text-sm">
                  {intakeSummary.risks.map((risk, idx) => (
                    <li key={idx}>{risk}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Detected/Recommended Trades */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="text-teal-400 mr-2">✓</span>
            Empfohlene Gewerke
          </h3>
          
          {detectedTrades.length > 0 ? (
            <div className="space-y-3">
              {detectedTrades.map(trade => (
                <label
                  key={trade.id}
                  className={`flex items-start p-4 rounded-lg cursor-pointer transition-all ${
                    selectedTrades.includes(trade.id)
                      ? 'bg-teal-500/20 border border-teal-500/50'
                      : 'bg-white/5 border border-white/20 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedTrades.includes(trade.id)}
                    onChange={() => toggleTrade(trade.id)}
                    className="mt-1 mr-3 w-5 h-5 text-teal-500 bg-white/10 border-white/30 rounded focus:ring-teal-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{trade.name}</span>
                      <span className="text-gray-400 text-sm">({trade.code})</span>
                      {trade.source === 'ki-empfohlen' && (
                        <span className="bg-teal-500/20 text-teal-300 text-xs px-2 py-1 rounded">
                          KI-Empfehlung
                        </span>
                      )}
                      {trade.source === 'manuell' && (
                        <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
                          Manuell hinzugefügt
                        </span>
                      )}
                    </div>
                    {trade.reason && (
                      <p className="text-gray-400 text-sm mt-1">{trade.reason}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">Keine Gewerke erkannt</p>
          )}
        </div>

        {/* Add Additional Trades */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="text-blue-400 mr-2">+</span>
            Weitere Gewerke hinzufügen
          </h3>
          
          {allTrades.length > 0 ? (
            <div className="flex gap-3">
              <select
                onChange={(e) => {
                  addTrade(e.target.value);
                  e.target.value = '';
                }}
                disabled={addingTrade}
                className="flex-1 bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue=""
              >
                <option value="" className="bg-slate-800">Gewerk auswählen...</option>
                {allTrades.map(trade => (
                  <option key={trade.id} value={trade.id} className="bg-slate-800">
                    {trade.name} ({trade.code})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-gray-400">Alle verfügbaren Gewerke wurden bereits hinzugefügt</p>
          )}
          <p className="text-blue-300 text-xs mt-2">
            ℹ️ Bei manuell hinzugefügten Gewerken wird die erste Frage den Arbeitsumfang erfassen.
          </p>
        </div>

        {/* Summary */}
        <div className="bg-gradient-to-r from-teal-500/20 to-blue-600/20 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">Ausgewählte Gewerke:</h3>
              <p className="text-teal-300 text-2xl font-bold mt-1">
                {selectedTrades.length} {selectedTrades.length === 1 ? 'Gewerk' : 'Gewerke'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Geschätzte Bearbeitungszeit:</p>
              <p className="text-white">~{selectedTrades.length * 2} Minuten</p>
              <p className="text-gray-400 text-xs mt-1">
                (Angepasste Fragenanzahl pro Gewerk)
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate(`/project/${projectId}/intake`)}
            className="px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all duration-200"
          >
            ← Zurück zu Projektfragen
          </button>
          
          <button
            onClick={handleContinue}
            disabled={selectedTrades.length === 0 || loading}
            className="px-8 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Speichern...
              </span>
            ) : (
              `Mit ${selectedTrades.length} ${selectedTrades.length === 1 ? 'Gewerk' : 'Gewerken'} fortfahren →`
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            <strong>ℹ️ Hinweis:</strong> Als nächstes werden detaillierte Fragen zu jedem ausgewählten Gewerk gestellt.
            Die Fragen sind auf Laien ausgerichtet und enthalten Erklärungen zu Fachbegriffen.
          </p>
        </div>
      </div>
    </div>
  );
}
