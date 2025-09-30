import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

// Preismodell
const PRICING = {
  small: { price: 9.90, label: '1-2 Gewerke', min: 1, max: 2 },
  medium: { price: 19.90, label: '3-5 Gewerke', min: 3, max: 5 },
  large: { price: 39.90, label: 'Ab 6 Gewerken', min: 6, max: 999 }
};

export default function TradeConfirmationPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [detectedTrades, setDetectedTrades] = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Analysiere Projektdaten...');
  const [error, setError] = useState('');
  const [intakeSummary, setIntakeSummary] = useState(null);
  const [addingTrade, setAddingTrade] = useState(false);
  const isAdditionalTrade = sessionStorage.getItem('addingAdditionalTrade') === 'true';
  const [requiredTrades, setRequiredTrades] = useState([]);
  const [recommendedTrades, setRecommendedTrades] = useState([]);
  const [selectedRequired, setSelectedRequired] = useState([]);
  const [selectedRecommended, setSelectedRecommended] = useState([]);
  
  // Hilfsfunktion für Gesamtzahl
  const getTotalSelectedCount = () => {
    const manualCount = detectedTrades.filter(t => t.source === 'manuell').length;
    return selectedRequired.length + selectedRecommended.length + manualCount;
  };

  // Berechne Preis basierend auf Anzahl der Gewerke
  const calculatePrice = () => {
    const count = getTotalSelectedCount();
    if (count === 0) return null;
    if (count <= 2) return PRICING.small;
    if (count <= 5) return PRICING.medium;
    return PRICING.large;
  };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setLoadingMessage('Lade Projektdetails...');
        
        const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
        if (!projectRes.ok) throw new Error('Projekt nicht gefunden');
        const projectData = await projectRes.json();
        setProject(projectData);
        
        setLoadingMessage('Analysiere Ihre Antworten...');
        let hasIntakeSummary = false;
        
        try {
          const summaryRes = await fetch(apiUrl(`/api/projects/${projectId}/intake/summary`));
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            setIntakeSummary(summaryData.summary);
            
            if (summaryData.groupedTrades) {
              hasIntakeSummary = true;
              
              const requiredFromSummary = summaryData.groupedTrades.required || [];
              const recommendedFromSummary = summaryData.groupedTrades.recommended || [];
              
              setRequiredTrades(requiredFromSummary);
              setRecommendedTrades(recommendedFromSummary);
              setSelectedRequired(requiredFromSummary.map(t => t.id));
              setSelectedRecommended([]);
              
              setDetectedTrades([...requiredFromSummary, ...recommendedFromSummary]);
              
              const tradesRes = await fetch(apiUrl('/api/trades'));
              const allTradesData = await tradesRes.json();
              
              const assignedIds = new Set([
                ...requiredFromSummary.map(t => t.id),
                ...recommendedFromSummary.map(t => t.id)
              ]);
              
              const availableTrades = allTradesData.filter(t => 
                t.code !== 'INT' && !assignedIds.has(t.id)
              );
              setAllTrades(availableTrades);
              
              setLoading(false);
              return;
            }
          }
        } catch (err) {
          console.log('Keine Intake-Summary verfügbar');
        }
        
        if (!hasIntakeSummary) {
          const initialDetected = (projectData.trades || []).filter(t => t.code !== 'INT');
          
          const tradesRes = await fetch(apiUrl('/api/trades'));
          const allTradesData = await tradesRes.json();
          
          const required = initialDetected.map(trade => ({
            ...trade,
            category: 'required',
            reason: 'Direkt aus Ihrer Projektbeschreibung erkannt'
          }));
          
          setRequiredTrades(required);
          setRecommendedTrades([]);
          setSelectedRequired(required.map(t => t.id));
          setSelectedRecommended([]);
          
          const availableTrades = allTradesData.filter(t => 
            t.code !== 'INT' && !required.some(r => r.id === t.id)
          );
          setAllTrades(availableTrades);
          
          setDetectedTrades(required);
        }
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [projectId]);

  const toggleRequired = (tradeId) => {
    setSelectedRequired(prev => 
      prev.includes(tradeId) 
        ? prev.filter(id => id !== tradeId)
        : [...prev, tradeId]
    );
  };

  const toggleRecommended = (tradeId) => {
    setSelectedRecommended(prev => 
      prev.includes(tradeId) 
        ? prev.filter(id => id !== tradeId)
        : [...prev, tradeId]
    );
  };
  
  const addTrade = async (tradeId) => {
    if (!tradeId) return;
    
    const trade = allTrades.find(t => t.id === parseInt(tradeId));
    if (trade) {
      setAddingTrade(true);
      
      const manualTrade = { 
        ...trade, 
        source: 'manuell',
        category: 'manual',
        reason: 'Manuell hinzugefügt für spezifische Anforderungen',
        isManuallyAdded: true
      };
      
      setDetectedTrades(prev => [...prev, manualTrade]);
      setAllTrades(prev => prev.filter(t => t.id !== trade.id));
      
      setAddingTrade(false);
    }
  };

  const handleContinue = async () => {
    const manualTrades = detectedTrades.filter(t => t.source === 'manuell' || t.isManuallyAdded);
    const manualTradeIds = manualTrades.map(t => t.id);
    
    const allSelectedTrades = [
      ...selectedRequired,
      ...selectedRecommended,
      ...manualTradeIds
    ];
    
    const uniqueSelectedTrades = [...new Set(allSelectedTrades)];
    
    if (uniqueSelectedTrades.length === 0) {
      alert('Bitte wählen Sie mindestens ein Gewerk aus');
      return;
    }
    
    // Direkt zur processPaymentAndContinue
    processPaymentAndContinue();
  };

  const processPaymentAndContinue = async () => {
    const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
    
    if (!userData.id) {
      // Nicht eingeloggt - zur Registrierung
      navigate('/bauherr/register', {
        state: {
          projectId: projectId,
          fromTradeConfirmation: true
        }
      });
      return;
    }
    
    // Eingeloggt - speichere Trades und weiter zu Dashboard
    const manualTrades = detectedTrades.filter(t => t.source === 'manuell' || t.isManuallyAdded);
    const manualTradeIds = manualTrades.map(t => t.id);
    
    const allSelectedTrades = [
      ...selectedRequired,
      ...selectedRecommended,
      ...manualTradeIds
    ];
    
    const uniqueSelectedTrades = [...new Set(allSelectedTrades)];
    
    try {
      setLoading(true);
      setLoadingMessage('Speichere Gewerkeauswahl...');
      
      const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/confirm`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          confirmedTrades: uniqueSelectedTrades,
          manuallyAddedTrades: manualTradeIds,
          aiRecommendedTrades: selectedRecommended,
          isAdditional: isAdditionalTrade
        })
      });
      
      if (!res.ok) throw new Error('Fehler beim Speichern der Gewerke');
      
      sessionStorage.setItem('pendingLvProject', projectId.toString());
      sessionStorage.setItem('pendingPayment', 'true');
      navigate('/bauherr/dashboard');
      
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

  const priceInfo = calculatePrice();

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
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="text-green-400 mr-2">✔</span>
            Erforderliche Gewerke
          </h3>
          <p className="text-gray-300 text-sm mb-4">
            Diese Gewerke wurden direkt aus Ihrer Projektbeschreibung erkannt:
          </p>
          
          {requiredTrades.length > 0 ? (
            <div className="space-y-3">
              {requiredTrades.map(trade => (
                <label
                  key={trade.id}
                  className={`flex items-start p-4 rounded-lg cursor-pointer transition-all ${
                    selectedRequired.includes(trade.id)
                      ? 'bg-green-500/20 border border-green-500/50'
                      : 'bg-white/5 border border-white/20 opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRequired.includes(trade.id)}
                    onChange={() => toggleRequired(trade.id)}
                    className="mt-1 mr-3 w-5 h-5 text-green-500 bg-white/10 border-white/30 rounded focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{trade.name}</span>
                      <span className="text-gray-400 text-sm">({trade.code})</span>
                    </div>
                    <p className="text-gray-400 text-sm mt-1">{trade.reason}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-gray-400">Keine Gewerke direkt erkannt</p>
          )}
        </div>

        {/* Empfohlene Gewerke */}
        {recommendedTrades.length > 0 && (
          <div className="bg-blue-500/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-blue-400/30">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <span className="text-blue-400 mr-2">💡</span>
              Optionale Gewerke
            </h3>
            <p className="text-gray-200 text-sm mb-4">
              Basierend auf Ihren Antworten könnten diese Gewerke relevant sein:
            </p>
            
            <div className="space-y-3">
              {recommendedTrades.map(trade => (
                <label
                  key={trade.id}
                  className={`flex items-start p-4 rounded-lg cursor-pointer transition-all ${
                    selectedRecommended.includes(trade.id)
                      ? 'bg-blue-500/30 border border-blue-400/60 shadow-lg'
                      : 'bg-white/10 border border-white/30 hover:bg-white/15'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedRecommended.includes(trade.id)}
                    onChange={() => toggleRecommended(trade.id)}
                    className="mt-1 mr-3 w-5 h-5 text-blue-500 bg-white/20 border-white/40 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{trade.name}</span>
                      <span className="text-gray-300 text-sm">({trade.code})</span>
                    </div>
                    <p className="text-gray-200 text-sm mt-1">{trade.reason}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Manuell hinzugefügte Gewerke */}
        {detectedTrades.filter(t => t.source === 'manuell').length > 0 && (
          <div className="bg-yellow-500/10 backdrop-blur-lg rounded-xl p-6 mb-6 border border-yellow-500/30">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <span className="text-yellow-400 mr-2">✔</span>
              Manuell hinzugefügte Gewerke
            </h3>
            
            <div className="space-y-3">
              {detectedTrades.filter(t => t.source === 'manuell').map(trade => (
                <div
                  key={trade.id}
                  className="flex items-start p-4 rounded-lg bg-yellow-500/20 border border-yellow-500/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{trade.name}</span>
                      <span className="text-gray-300 text-sm">({trade.code})</span>
                      <span className="bg-yellow-600/30 text-yellow-300 text-xs px-2 py-1 rounded">
                        Manuell
                      </span>
                    </div>
                    <p className="text-gray-200 text-sm mt-1">{trade.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Weitere Gewerke hinzufügen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
            <span className="text-yellow-400 mr-2">+</span>
            Weitere Gewerke manuell hinzufügen
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
        </div>

        {/* Kosten-Summary */}
        <div className="bg-gradient-to-r from-teal-500/20 to-blue-600/20 backdrop-blur-lg rounded-xl p-6 mb-8 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold">Ausgewählte Gewerke:</h3>
              <p className="text-teal-300 text-2xl font-bold mt-1">
                {getTotalSelectedCount()} {getTotalSelectedCount() === 1 ? 'Gewerk' : 'Gewerke'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-sm">Gebühr für KI-Ausschreibung:</p>
              <p className="text-white text-2xl font-bold">
                {priceInfo ? `${priceInfo.price.toFixed(2)} €` : '-'}
              </p>
              <p className="text-gray-400 text-xs mt-1">einmalig</p>
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
            disabled={getTotalSelectedCount() === 0 || loading}
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
              `Weiter zur Registrierung →`
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            <strong>ℹ️ Hinweis:</strong> Nach der Registrierung können Sie die KI-gestützte Erstellung Ihres Leistungsverzeichnisses starten.
          </p>
        </div>
      </div>
    </div>
  );
}
