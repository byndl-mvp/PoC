import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiUrl } from '../api';
import { useNavigate } from 'react-router-dom';

export default function ResultPage() {
  const { projectId } = useParams();
  const [lvs, setLvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [exportMode, setExportMode] = useState('with-prices');
  const [selectedLv, setSelectedLv] = useState(null);
  const [editingPosition, setEditingPosition] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [addingPosition, setAddingPosition] = useState(null);
  const [newPosition, setNewPosition] = useState({
    title: '',
    description: '',
    quantity: 1,
    unit: 'Stk',
    unitPrice: 0,
    isNEP: false
  });
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [modalLvIndex, setModalLvIndex] = useState(null);
  const [modalPosIndex, setModalPosIndex] = useState(null);
  
  // NEU: Zusätzliche States
  const [projectComplete, setProjectComplete] = useState(false);
  const [pendingTrades, setPendingTrades] = useState([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState('');
  const [highlightedLv, setHighlightedLv] = useState(null);
  const [tradeOptimizations, setTradeOptimizations] = useState({});
  const [loadingTradeOptimization, setLoadingTradeOptimization] = useState({});
  const [expandedOptimizations, setExpandedOptimizations] = useState({});
  
  // Helper für sichere Zahlenformatierung
  const safeToFixed = (value) => {
    if (value === null || value === undefined) return '0.00';
    const num = typeof value === 'number' ? value : parseFloat(value) || 0;
    return num.toFixed(2);
  };  

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };
  
  // ÄNDERUNG: Erweiterte fetchData mit Status-Check
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // 1. Projekt laden (BLEIBT GLEICH)
        const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          setProject(projectData);
        }
        
        // 2. ÄNDERUNG: LVs laden mit zusätzlichem Status-Check
        const res = await fetch(apiUrl(`/api/projects/${projectId}/lv`));
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Fehler beim Laden der LVs');
        }
        const data = await res.json();
        
        // NEU: Filtere nur abgeschlossene LVs (nicht übersprungene)
        const completedLvs = data.lvs.filter(lv => lv.status !== 'skipped');
        setLvs(completedLvs || []);
        
        // NEU: Check ob alle Gewerke abgeschlossen sind
        const statusRes = await fetch(apiUrl(`/api/projects/${projectId}/status`));
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setProjectComplete(statusData.allTradesComplete);
          setPendingTrades(statusData.pendingTrades || []);
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

  // NEU: Nach Rückkehr von zusätzlichem Gewerk
  useEffect(() => {
    const returnToResults = sessionStorage.getItem('returnToResults');
    if (returnToResults === 'true') {
      sessionStorage.removeItem('returnToResults');
      
      // Zeige Erfolgsmeldung
      setShowSuccessMessage('Zusätzliches Gewerk wurde hinzugefügt. Sie können es in der Übersicht bearbeiten.');
      
      // Optional: Highlight für neues LV
      const newTradeId = sessionStorage.getItem('lastAddedTrade');
      if (newTradeId) {
        setHighlightedLv(newTradeId);
        sessionStorage.removeItem('lastAddedTrade');
      }
    }
  }, []);

  // ÄNDERUNG: Erweiterte handleAddAdditionalTrade Funktion
  const handleAddAdditionalTrade = () => {
    sessionStorage.setItem('addingAdditionalTrade', 'true');
    sessionStorage.setItem('returnToResults', 'true');
    
    // NEU: Speichere aktuellen Zustand für Rückkehr
    sessionStorage.setItem('resultsPageData', JSON.stringify({
      lvs: lvs.map(lv => lv.id),
      totalCalculated: total
    }));
    
    // Navigiere zum Trade-Auswahl
    navigate(`/project/${projectId}/add-trade?additional=true&from=results`);
  };

  const handleDeleteTrade = async (lv, lvIndex) => {
  const tradeName = lv.trade_name || lv.name || lv.code;
  
  const confirmMessage = `Möchten Sie das Gewerk "${tradeName}" wirklich löschen?\n\n` +
    `⚠️ ACHTUNG: Dies wird folgendes entfernen:\n` +
    `• Alle beantworteten Fragen\n` +
    `• Das gesamte Leistungsverzeichnis mit ${lv.content?.positions?.length || 0} Positionen\n` +
    `• Alle Berechnungen (${formatCurrency(calculateTotal(lv))})\n\n` +
    `Diese Aktion kann NICHT rückgängig gemacht werden!`;
  
  if (!window.confirm(confirmMessage)) return;
  if (!window.confirm(`Letzte Bestätigung: "${tradeName}" wirklich unwiderruflich löschen?`)) return;
  
  try {
    const response = await fetch(
      apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/delete`),
      { method: 'DELETE', headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Fehler beim Löschen des Gewerks');
    }
    
    const newLvs = [...lvs];
    newLvs.splice(lvIndex, 1);
    setLvs(newLvs);
    
    alert(`✅ Gewerk "${tradeName}" wurde erfolgreich gelöscht.`);
    
  } catch (error) {
    console.error('Error deleting trade:', error);
    alert(`❌ Fehler beim Löschen: ${error.message}`);
  }
};
  
  const handleEditPosition = (lvIndex, posIndex, field, value) => {
    const key = `${lvIndex}-${posIndex}-${field}`;
    setEditedValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const recalculateTotalsWithNEP = (positions) => {
    let totalSum = 0;
    let nepSum = 0;
    
    positions.forEach(pos => {
      const posTotal = parseFloat(pos.totalPrice) || 0;
      if (pos.isNEP) {
        nepSum += posTotal;
      } else {
        totalSum += posTotal;
      }
    });
    
    return {
      totalSum: Math.round(totalSum * 100) / 100,
      nepSum: Math.round(nepSum * 100) / 100
    };
  };

  const handleSavePosition = async (lvIndex, posIndex) => {
    const lv = lvs[lvIndex];
    const position = lv.content.positions[posIndex];
    const key = `${lvIndex}-${posIndex}`;
    
    const updatedPosition = {
      ...position,
      title: editedValues[`${key}-title`] !== undefined ? editedValues[`${key}-title`] : position.title,
      description: editedValues[`${key}-description`] !== undefined ? editedValues[`${key}-description`] : position.description,
      quantity: editedValues[`${key}-quantity`] !== undefined ? parseFloat(editedValues[`${key}-quantity`]) : position.quantity,
      unit: editedValues[`${key}-unit`] !== undefined ? editedValues[`${key}-unit`] : position.unit,
      unitPrice: editedValues[`${key}-unitPrice`] !== undefined ? parseFloat(editedValues[`${key}-unitPrice`]) : position.unitPrice,
      isNEP: editedValues[`${key}-isNEP`] !== undefined ? editedValues[`${key}-isNEP`] : (position.isNEP || false)
    };
    
    updatedPosition.totalPrice = updatedPosition.quantity * updatedPosition.unitPrice;
    
    const updatedPositions = [...lv.content.positions];
    updatedPositions[posIndex] = updatedPosition;
    
    const totals = recalculateTotalsWithNEP(updatedPositions);
    
    const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv/update`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        positions: updatedPositions,
        totalSum: totals.totalSum
      })
    });
    
    if (res.ok) {
      const newLvs = [...lvs];
      newLvs[lvIndex].content.positions = updatedPositions;
      newLvs[lvIndex].content.totalSum = totals.totalSum;
      newLvs[lvIndex].content.nepSum = totals.nepSum;
      setLvs(newLvs);
      
      if (selectedPosition && modalLvIndex === lvIndex && modalPosIndex === posIndex) {
        setSelectedPosition(updatedPosition);
      }
      
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
      const remainingPositions = [...lv.content.positions];
      remainingPositions.splice(posIndex, 1);
      newLvs[lvIndex].content.positions = remainingPositions;
      newLvs[lvIndex].content.totalSum = remainingPositions.reduce((sum, pos) => 
        sum + (parseFloat(pos.totalPrice) || 0), 0
      );

      // Backend-LV aktualisieren
      await fetch(apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv/update`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          positions: remainingPositions,
          totalSum: remainingPositions.reduce((sum, pos) => sum + (parseFloat(pos.totalPrice) || 0), 0)
        })
      });      
      setLvs(newLvs);
    }
  };

  const handleAddPosition = async (lvIndex) => {
    const lv = lvs[lvIndex];
    
    if (!newPosition.title) {
      alert('Bitte geben Sie eine Bezeichnung ein');
      return;
    }
    
    const positionToAdd = {
      ...newPosition,
      isNEP: newPosition.isNEP || false
    };
    
    const res = await fetch(
      apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv/position`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(positionToAdd)
      }
    );
    
    if (res.ok) {
      // Refresh LVs
      const lvRes = await fetch(apiUrl(`/api/projects/${projectId}/lv`));
      if (lvRes.ok) {
        const lvData = await lvRes.json();
        setLvs(lvData.lvs || []);
      }    
     
      setAddingPosition(null);
      setNewPosition({
        title: '',
        description: '',
        quantity: 1,
        unit: 'Stk',
        unitPrice: 0,
        isNEP: false
      });
    }
  };

  const calculateTotal = (lv) => {
    if (lv.content?.totalSum) {
      return parseFloat(lv.content.totalSum) || 0;
    }
    
    if (!lv.content || !lv.content.positions) return 0;
    return lv.content.positions.reduce((sum, pos) => {
      if (pos.totalPrice) return sum + parseFloat(pos.totalPrice) || 0;
      if (pos.quantity && pos.unitPrice) {
        return sum + (parseFloat(pos.quantity) * parseFloat(pos.unitPrice)) || 0;
      }
      return sum;
    }, 0);
  };

  // Total berechnen für Budget-Vergleich
  const total = lvs.reduce((acc, lv) => acc + calculateTotal(lv), 0);

  // State für Budget-Optimierung
  const [showOptimizations, setShowOptimizations] = useState(false);
  const [optimizations, setOptimizations] = useState(null);
  const [loadingOptimizations, setLoadingOptimizations] = useState(false);

  // Funktion zum Laden der Optimierungen
  const loadOptimizations = async () => {
    setLoadingOptimizations(true);
    try {
      const total = lvs.reduce((acc, lv) => acc + calculateTotal(lv), 0);
      const grandTotal = total * 1.05 * 1.19;
      
      const response = await fetch(apiUrl(`/api/projects/${projectId}/budget-optimization`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTotal: grandTotal,
          targetBudget: project.budget,
          lvBreakdown: lvs.map(lv => ({
            tradeCode: lv.trade_code || lv.code,
            tradeName: lv.trade_name || lv.name,
            total: calculateTotal(lv)
          }))
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setOptimizations(data);
        setShowOptimizations(true);
      }
    } catch (err) {
      console.error('Failed to load optimizations:', err);
    } finally {
      setLoadingOptimizations(false);
    }
  };

  // Neue Funktion für Trade-spezifische Optimierung
const loadTradeOptimization = async (lv, lvIndex) => {
  const tradeId = lv.trade_id;
  setLoadingTradeOptimization(prev => ({ ...prev, [tradeId]: true }));
  
  try {
    const response = await fetch(
      apiUrl(`/api/projects/${projectId}/trades/${tradeId}/optimize`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetSaving: null // Optional: könnte vom User eingegeben werden
        })
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      setTradeOptimizations(prev => ({ ...prev, [tradeId]: data }));
      setExpandedOptimizations(prev => ({ ...prev, [lvIndex]: true }));
    }
  } catch (err) {
    console.error('Failed to load trade optimizations:', err);
    alert('Fehler beim Laden der Optimierungsvorschläge');
  } finally {
    setLoadingTradeOptimization(prev => ({ ...prev, [tradeId]: false }));
  }
};

// Erweiterte Komponente für Trade-Optimierungen mit Auswahl-Funktionalität
const TradeOptimizationDisplay = ({ 
  lv, 
  optimizations, 
  formatCurrency, 
  lvIndex,
  setExpandedOptimizations,
  setTradeOptimizations,
  projectId 
}) => {
  // NEU: States für Auswahl-Funktionalität
  const [selectedOptimizations, setSelectedOptimizations] = useState([]);
  const [isApplying, setIsApplying] = useState(false);
  
  if (!optimizations) return null;
  
  const handleToggleOptimization = (optIndex) => {
    setSelectedOptimizations(prev => {
      if (prev.includes(optIndex)) {
        return prev.filter(i => i !== optIndex);
      } else {
        return [...prev, optIndex];
      }
    });
  };
  
  const handleApplyOptimizations = async () => {
    if (selectedOptimizations.length === 0) {
      alert('Bitte wählen Sie mindestens eine Optimierung aus');
      return;
    }
    
    if (!window.confirm(`Möchten Sie ${selectedOptimizations.length} Optimierung(en) übernehmen? Das LV wird angepasst.`)) {
      return;
    }
    
    setIsApplying(true);
    
    try {
      const selectedOpts = selectedOptimizations.map(idx => optimizations.optimizations[idx]);
      
      const response = await fetch(
        apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/apply-optimizations`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            optimizations: selectedOpts
          })
        }
      );
      
      if (response.ok) {
        alert('Optimierungen wurden erfolgreich übernommen. LV wird aktualisiert...');
        window.location.reload();
      } else {
        throw new Error('Fehler beim Anwenden der Optimierungen');
      }
    } catch (err) {
      console.error('Failed to apply optimizations:', err);
      alert('Fehler beim Übernehmen der Optimierungen');
    } finally {
      setIsApplying(false);
    }
  };
  
  const handleBackToDetails = () => {
    setExpandedOptimizations(prev => ({ ...prev, [lvIndex]: false }));
    setTradeOptimizations(prev => {
      const newState = { ...prev };
      delete newState[lv.trade_id];
      return newState;
    });
  };
  
  return (
    <div className="mt-4 bg-white/10 rounded-lg p-6 border border-white/20">
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-bold text-white">
          Einsparpotenzial für {lv.trade_name}: {formatCurrency(optimizations.summary?.totalPossibleSaving || 0)}
        </h4>
        <button
          onClick={handleBackToDetails}
          className="px-4 py-2 bg-gray-500/20 border border-gray-500/50 text-gray-300 rounded-lg hover:bg-gray-500/30 transition-all text-sm"
        >
          ← Zurück zur Detailansicht
        </button>
      </div>
      
      <div className="grid gap-3">
        {optimizations.optimizations?.map((opt, idx) => (
          <div key={idx} className="bg-white/5 rounded-lg p-4 border border-white/10">
            <div className="flex gap-3">
              {/* NEU: Checkbox */}
              <div className="pt-1">
                <input
                  type="checkbox"
                  id={`opt-${idx}`}
                  checked={selectedOptimizations.includes(idx)}
                  onChange={() => handleToggleOptimization(idx)}
                  className="w-5 h-5 text-teal-500 rounded border-gray-300 focus:ring-teal-500"
                />
              </div>
              
              {/* Optimierungsdetails mit label für Checkbox */}
              <div className="flex-1">
                <label htmlFor={`opt-${idx}`} className="cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-gray-400">{opt.positionRef}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          opt.category === 'material' ? 'bg-blue-500/20 text-blue-300' :
                          opt.category === 'eigenleistung' ? 'bg-green-500/20 text-green-300' :
                          opt.category === 'verzicht' ? 'bg-red-500/20 text-red-300' :
                          'bg-yellow-500/20 text-yellow-300'
                        }`}>
                          {opt.category}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          opt.recommendation === 'empfohlen' ? 'bg-green-500/20 text-green-300' :
                          opt.recommendation === 'bedingt' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {opt.recommendation === 'empfohlen' ? '✓ Empfohlen' :
                           opt.recommendation === 'bedingt' ? '⚠ Bedingt' : '⚠ Notfall'}
                        </span>
                      </div>
                      
                      <p className="text-white font-medium">{opt.originalPosition}</p>
                      <p className="text-gray-300 text-sm mt-1">
                        Aktuell: {formatCurrency(opt.originalCost)}
                      </p>
                      
                      <div className="mt-2 p-3 bg-teal-500/10 rounded border border-teal-500/30">
                        <p className="text-teal-300 font-medium">{opt.measure}</p>
                        <p className="text-teal-200 text-sm mt-1">{opt.alternativeDescription}</p>
                      </div>
                      
                      {opt.risks && (
                        <div className="mt-2 p-2 bg-orange-500/10 rounded">
                          <p className="text-orange-300 text-xs">
                            <strong>Hinweis:</strong> {opt.risks}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right ml-4">
                      <p className="text-2xl font-bold text-green-400">
                        -{formatCurrency(opt.savingAmount)}
                      </p>
                      <p className="text-sm text-gray-400">
                        {opt.savingPercent}% Ersparnis
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Qualität: {
                          opt.qualityImpact === 'keine' ? '✓ Keine Einbuße' :
                          opt.qualityImpact === 'gering' ? '↓ Gering' :
                          opt.qualityImpact === 'mittel' ? '↓↓ Mittel' :
                          '↓↓↓ Hoch'
                        }
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* NEU: Zusammenfassung und Aktions-Buttons */}
      <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-white font-medium">
              {selectedOptimizations.length} von {optimizations.optimizations?.length || 0} Optimierungen ausgewählt
            </p>
            {selectedOptimizations.length > 0 && (
              <p className="text-teal-300 text-sm mt-1">
                Gesamtersparnis: {formatCurrency(
                  selectedOptimizations.reduce((sum, idx) => 
                    sum + (optimizations.optimizations[idx]?.savingAmount || 0), 0
                  )
                )}
              </p>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedOptimizations(
                optimizations.optimizations?.map((_, idx) => idx) || []
              )}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Alle auswählen
            </button>
            <button
              onClick={() => setSelectedOptimizations([])}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Keine auswählen
            </button>
          </div>
        </div>
        
        <button
          onClick={handleApplyOptimizations}
          disabled={selectedOptimizations.length === 0 || isApplying}
          className={`w-full px-6 py-3 rounded-lg font-medium transition-all ${
            selectedOptimizations.length > 0 
              ? 'bg-teal-600 text-white hover:bg-teal-700' 
              : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isApplying ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Übernehme Optimierungen...
            </span>
          ) : (
            `Optimierungen übernehmen & LV anpassen`
          )}
        </button>
      </div>
      
      {/* Original Zusammenfassung bleibt erhalten */}
      <div className="mt-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-gray-400 text-sm">Gesamt möglich</p>
            <p className="text-xl font-bold text-white">
              {formatCurrency(optimizations.summary?.totalPossibleSaving || 0)}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Empfohlen</p>
            <p className="text-xl font-bold text-green-400">
              {formatCurrency(optimizations.summary?.recommendedSaving || 0)}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Ohne Qualitätsverlust</p>
            <p className="text-xl font-bold text-teal-400">
              {formatCurrency(optimizations.summary?.qualityPreservedSaving || 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
  
  // Budget-Komponenten
  const BudgetSuccess = ({ totalSum, budget }) => (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-green-800">Budget eingehalten!</h3>
          <p className="text-green-700">
            Die Gesamtkosten von {formatCurrency(totalSum)} liegen innerhalb Ihres Budgets von {formatCurrency(budget)}
          </p>
          <p className="text-sm text-green-600 mt-1">
            Verbleibender Spielraum: {formatCurrency(parseFloat(budget) - totalSum)}
          </p>
        </div>
      </div>
    </div>
  );

  const BudgetExceeded = ({ 
    totalSum, 
    budget, 
    onLoadOptimizations, 
    loadingOptimizations, 
    showOptimizations, 
    optimizations 
  }) => (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-400 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-red-800">Budget überschritten</h3>
          <p className="text-red-700">
            Die Gesamtkosten von {formatCurrency(totalSum)} überschreiten Ihr Budget von {formatCurrency(budget)}
          </p>
          <p className="text-sm text-red-600 mt-1">
            Überschreitung: {formatCurrency(totalSum - parseFloat(budget))} 
            ({((totalSum - parseFloat(budget)) / parseFloat(budget) * 100).toFixed(1)}%)
          </p>
          
          {!showOptimizations && (
            <button
              onClick={onLoadOptimizations}
              disabled={loadingOptimizations}
              className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              {loadingOptimizations ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Analysiere Einsparmöglichkeiten...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Einsparmöglichkeiten anzeigen
                </>
              )}
            </button>
          )}
        </div>
      </div>
      
      {showOptimizations && optimizations && (
        <OptimizationsList optimizations={optimizations} />
      )}
    </div>
  );

  const OptimizationsList = ({ optimizations }) => {
  // Prüfe welche Datenstruktur vorliegt
  const isNewStructure = optimizations?.tradesPotential !== undefined;
  
  if (isNewStructure) {
    // Neue Struktur von der Übersichts-Route
    return (
      <div className="mt-6 bg-white rounded-lg p-6">
        <h4 className="text-lg font-bold text-gray-800 mb-4">
          Einsparpotenzial-Übersicht (Geschätzt: {formatCurrency(optimizations.totalEstimatedPotential || 0)})
        </h4>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
          <p className="text-sm text-blue-700">
            <strong>{optimizations.summary?.message || 'Budget-Status'}</strong>
          </p>
          <p className="text-sm text-gray-600 mt-2">{optimizations.recommendation}</p>
        </div>
        
        <div className="space-y-3">
          {optimizations.tradesPotential?.map((trade, idx) => (
            <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-800">{trade.tradeName}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                      ~{trade.potentialPercent}% Einsparpotenzial
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm">{trade.hint}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Aktuell: {formatCurrency(trade.currentCost)}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="font-bold text-green-600">
                    bis zu {formatCurrency(trade.estimatedPotential)}
                  </p>
                  <p className="text-xs text-gray-500">möglich</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 rounded">
          <p className="text-sm text-yellow-800">
            💡 <strong>Tipp:</strong> Klicken Sie bei einzelnen Gewerken auf "Einsparpotenzial prüfen" 
            für detaillierte Vorschläge zu konkreten LV-Positionen.
          </p>
        </div>
      </div>
    );
  }
  
  // Alte Struktur (falls noch verwendet) - Fallback
  if (!optimizations?.optimizations) {
    return (
      <div className="mt-6 bg-white rounded-lg p-6">
        <p className="text-gray-600">Keine Optimierungsdaten verfügbar</p>
      </div>
    );
  }
  
  // Alte detaillierte Struktur
  return (
    <div className="mt-6 bg-white rounded-lg p-6">
      <h4 className="text-lg font-bold text-gray-800 mb-4">
        Einsparmöglichkeiten (Potenzial: {formatCurrency(optimizations.totalPossibleSaving || 0)})
      </h4>
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
        <p className="text-sm text-blue-700">
          <strong>Hinweis:</strong> Diese Vorschläge sind Richtwerte zur Kostensenkung. 
          Die konkreten Einsparungen können im Rahmen der Auftragsvergabe mit den jeweiligen 
          Fachbetrieben individuell abgestimmt werden. Alternativ können Sie die entsprechenden 
          Positionen direkt in den Leistungsverzeichnissen über die Bearbeitungsfunktion anpassen.
        </p>
      </div>
      
      <div className="space-y-3">
        {optimizations.optimizations.map((opt, idx) => (
          <div key={idx} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-800">{opt.tradeName || opt.trade || 'Allgemein'}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    opt.type === 'eigenleistung' ? 'bg-blue-100 text-blue-700' :
                    opt.type === 'material' ? 'bg-yellow-100 text-yellow-700' :
                    opt.type === 'verschiebung' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {opt.type === 'eigenleistung' ? 'Eigenleistung' :
                     opt.type === 'material' ? 'Material' :
                     opt.type === 'verschiebung' ? 'Verschiebung' : 'Reduzierung'}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    opt.difficulty === 'einfach' ? 'bg-green-100 text-green-700' :
                    opt.difficulty === 'mittel' ? 'bg-orange-100 text-orange-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {opt.difficulty}
                  </span>
                </div>
                <p className="text-gray-700">{opt.measure}</p>
                {opt.impact && (
                  <p className="text-sm text-gray-500 mt-1">⚠️ {opt.impact}</p>
                )}
              </div>
              <div className="text-right ml-4">
                <p className="font-bold text-green-600">- {formatCurrency(opt.savingAmount)}</p>
                <p className="text-sm text-gray-500">({opt.savingPercent}%)</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
  
  const handleExportPDF = async (tradeId, withPrices = true) => {
    try {
      const url = apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv.pdf?withPrices=${withPrices}`);
      window.open(url, '_blank');
    } catch (err) {
      alert('PDF-Export fehlgeschlagen: ' + err.message);
    }
  };

  const handleExportCompletePDF = async () => {
    try {
      const withPrices = exportMode === 'with-prices';
      const url = apiUrl(`/api/projects/${projectId}/lv-complete.pdf?withPrices=${withPrices}`);
      window.open(url, '_blank');
    } catch (err) {
      alert('Gesamt-PDF-Export fehlgeschlagen: ' + err.message);
    }
  };

  const PositionModal = () => {
    if (!selectedPosition || modalLvIndex === null || modalPosIndex === null) return null;
    
    const lv = lvs[modalLvIndex];
    const isEditing = editingPosition === `${modalLvIndex}-${modalPosIndex}`;
    
    const handleSave = async () => {
      const form = document.getElementById('position-edit-form');
      const formData = new FormData(form);
      
      const updatedPosition = {
        ...selectedPosition,
        pos: selectedPosition.pos,
        title: formData.get('title'),
        description: formData.get('description'),
        quantity: parseFloat(formData.get('quantity')) || 0,
        unit: formData.get('unit'),
        unitPrice: parseFloat(formData.get('unitPrice')) || 0,
        isNEP: formData.get('isNEP') === 'on'
      };
      updatedPosition.totalPrice = updatedPosition.quantity * updatedPosition.unitPrice;
      
      const updatedPositions = [...lv.content.positions];
      updatedPositions[modalPosIndex] = updatedPosition;
      
      const totals = recalculateTotalsWithNEP(updatedPositions);
      
      const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv/update`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          positions: updatedPositions,
          totalSum: totals.totalSum
        })
      });
      
      if (res.ok) {
        const newLvs = [...lvs];
        newLvs[modalLvIndex].content.positions = updatedPositions;
        newLvs[modalLvIndex].content.totalSum = totals.totalSum;
        newLvs[modalLvIndex].content.nepSum = totals.nepSum;
        setLvs(newLvs);
        setSelectedPosition(updatedPosition);
        setEditingPosition(null);
        setEditedValues({});
      }
    };
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-teal-600 text-white p-6 rounded-t-2xl">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold">Position {selectedPosition.pos}</h3>
                <p className="text-blue-100 mt-1">{lv.trade_name || lv.name}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedPosition(null);
                  setModalLvIndex(null);
                  setModalPosIndex(null);
                  setEditingPosition(null);
                  setEditedValues({});
                }}
                className="text-white/80 hover:text-white transition-colors"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="p-6">
            {isEditing ? (
              <form id="position-edit-form" className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bezeichnung</label>
                  <input
                    type="text"
                    name="title"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    defaultValue={selectedPosition.title}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
                  <textarea
                    name="description"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2"
                    rows={6}
                    defaultValue={selectedPosition.description}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Menge</label>
                    <input
                      type="number"
                      name="quantity"
                      step="0.10"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      defaultValue={selectedPosition.quantity}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Einheit</label>
                    <input
                      type="text"
                      name="unit"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      defaultValue={selectedPosition.unit}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Einzelpreis (€)</label>
                    <input
                      type="number"
                      name="unitPrice"
                      step="0.10"
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      defaultValue={selectedPosition.unitPrice}
                    />
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="isNEP"
                      className="mr-2 w-4 h-4 text-teal-500"
                      defaultChecked={selectedPosition.isNEP || false}
                    />
                    <span className="font-medium text-gray-700">NEP (Nur-Einheits-Preis)</span>
                    <span className="ml-2 text-sm text-gray-500">Position wird nicht zur Gesamtsumme addiert</span>
                  </label>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 text-xl mb-2">{selectedPosition.title}</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {selectedPosition.description || 'Keine Beschreibung vorhanden'}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 bg-blue-50 rounded-lg p-4">
                  <div>
                    <p className="text-sm text-gray-600">Menge</p>
                    <p className="text-lg font-semibold">
                      {safeToFixed(selectedPosition.quantity)} {selectedPosition.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Einzelpreis</p>
                    <p className="text-lg font-semibold">{formatCurrency(selectedPosition.unitPrice)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Gesamtpreis</p>
                    <p className="text-lg font-semibold text-teal-600">
                      {formatCurrency(selectedPosition.totalPrice)}
                    </p>
                  </div>
                </div>
                
                {selectedPosition.isNEP && (
                  <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <p className="text-sm font-medium text-yellow-800">
                      ⚠️ NEP-Position (Eventualposition)
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Diese Position wird nur mit Einheitspreis ausgewiesen, aber nicht zur Gesamtsumme addiert.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="border-t bg-gray-50 px-6 py-4 rounded-b-2xl">
            <div className="flex justify-between">
              <button
                onClick={() => {
                  if (window.confirm('Diese Position wirklich löschen?')) {
                    handleDeletePosition(modalLvIndex, modalPosIndex);
                    setSelectedPosition(null);
                    setModalLvIndex(null);
                    setModalPosIndex(null);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                🗑 Löschen
              </button>
              
              <div className="flex gap-3">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      ✔ Speichern
                    </button>
                    <button
                      onClick={() => {
                        setEditingPosition(null);
                        setEditedValues({});
                      }}
                      className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      ✗ Abbrechen
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditingPosition(`${modalLvIndex}-${modalPosIndex}`)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ✎ Bearbeiten
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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

  // HAUPT-RETURN
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <PositionModal />
      
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 right-10 w-96 h-96 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>
     
      <div className="relative max-w-7xl mx-auto px-4 py-12">
        {/* ÄNDERUNG: Header mit Vollständigkeits-Indikator */}
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            {projectComplete 
              ? 'Vollständiges Leistungsverzeichnis' 
              : 'Leistungsverzeichnis (In Bearbeitung)'}
          </h1>
          <p className="text-xl text-gray-300">
            VOB-konform erstellt und bereit zum Export
          </p>
          
          {/* NEU: Status-Badge */}
          {!projectComplete && pendingTrades.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-full">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-yellow-300">
                {pendingTrades.length} Gewerk(e) noch nicht bearbeitet
              </span>
            </div>
          )}
        </div>

        {/* NEU: Erfolgs-Nachricht */}
        {showSuccessMessage && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-6">
            <p className="text-green-300">{showSuccessMessage}</p>
          </div>
        )}

        {/* NEU: Info-Box für unvollständige Projekte */}
        {!projectComplete && pendingTrades.length > 0 && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-yellow-300 mb-2">
                  Hinweis: Projekt noch unvollständig
                </h3>
                <p className="text-yellow-200 mb-3">
                  Folgende Gewerke haben noch kein Leistungsverzeichnis:
                </p>
                <ul className="list-disc list-inside text-yellow-100 mb-4">
                  {pendingTrades.map(trade => (
                    <li key={trade.id}>{trade.name}</li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate(`/project/${projectId}/lv-review`)}
                  className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Zur Übersicht zurück →
                </button>
              </div>
            </div>
          </div>
        )}

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
              <div 
                key={idx} 
                className={`bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border ${
                  highlightedLv === lv.trade_id ? 'border-green-400' : 'border-white/20'
                }`}
              >
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
                    {/* Dezenter Lösch-Button - nur Icon */}
<button
  onClick={(e) => {
    e.stopPropagation();
    handleDeleteTrade(lv, idx);
  }}
  className="text-sm p-2 rounded-lg transition-all text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
  title="Gewerk komplett löschen"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
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
                      {safeToFixed(calculateTotal(lv))} €
                    </span>
                    
                    {/* NEU: Optimierungs-Button pro Gewerk */}
              {!tradeOptimizations[lv.trade_id] && (
                <button
                  onClick={() => loadTradeOptimization(lv, idx)}
                  disabled={loadingTradeOptimization[lv.trade_id]}
                  className="px-4 py-2 bg-orange-500/20 border border-orange-500/50 text-orange-300 rounded-lg hover:bg-orange-500/30 transition-all text-sm"
                >
                  {loadingTradeOptimization[lv.trade_id] ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin h-3 w-3 border-2 border-orange-300 border-t-transparent rounded-full"></div>
                      Analysiere...
                    </div>
                  ) : (
                    '💡 Einsparpotenzial prüfen'
                  )}
                </button>
              )}
            </div>
          </div>
          
          {/* NEU: Zeige Optimierungen wenn geladen */}
          {expandedOptimizations[idx] && tradeOptimizations[lv.trade_id] && (
  <TradeOptimizationDisplay 
    lv={lv} 
    optimizations={tradeOptimizations[lv.trade_id]}
    formatCurrency={formatCurrency}
    lvIndex={idx}
    setExpandedOptimizations={setExpandedOptimizations}
    setTradeOptimizations={setTradeOptimizations}
    projectId={projectId}
  />
)}                
                
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
                            <th className="text-center p-3 font-medium">NEP</th>
                            <th className="text-center p-3 font-medium">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lv.content.positions.map((pos, pidx) => (
                            <tr 
                              key={pidx} 
                              className={`border-t border-white/10 hover:bg-white/5 cursor-pointer ${
                                pos.isNEP ? 'opacity-75 bg-yellow-500/5' : ''
                              }`}
                              onClick={() => {
                                setSelectedPosition(pos);
                                setModalLvIndex(idx);
                                setModalPosIndex(pidx);
                              }}
                            >
                              <td className="p-3">
                                {pos.pos || `${idx+1}.${pidx+1}`}
                                {pos.isNEP && <span className="ml-1 text-xs text-yellow-400">(NEP)</span>}
                              </td>
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
                                  pos.quantity ? safeToFixed(pos.quantity) : '-'
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
                                  pos.unitPrice ? safeToFixed(pos.unitPrice) : '-'
                                )}
                              </td>
                              <td className="text-right p-3 font-medium text-teal-400">
                                {pos.totalPrice ? safeToFixed(pos.totalPrice) : '-'}
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={pos.isNEP || false}
                                  onChange={async (e) => {
                                    e.stopPropagation();
                                    
                                    const updatedPositions = [...lv.content.positions];
                                    updatedPositions[pidx] = { ...pos, isNEP: e.target.checked };
                                    
                                    const totals = recalculateTotalsWithNEP(updatedPositions);
                                    
                                    const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv/update`), {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ 
                                        positions: updatedPositions,
                                        totalSum: totals.totalSum
                                      })
                                    });
                                    
                                    if (res.ok) {
                                      const newLvs = [...lvs];
                                      newLvs[idx].content.positions = updatedPositions;
                                      newLvs[idx].content.totalSum = totals.totalSum;
                                      newLvs[idx].content.nepSum = totals.nepSum;
                                      setLvs(newLvs);
                                    }
                                  }}
                                  className="w-4 h-4 text-teal-500"
                                  title={pos.isNEP ? "NEP-Position (nicht in Summe)" : "Normale Position"}
                                />
                              </td>                              
                              <td className="p-3 text-center">
                                {editingPosition === `${idx}-${pidx}` ? (
                                  <div className="flex gap-2 justify-center">
                                    <button
                                      onClick={() => handleSavePosition(idx, pidx)}
                                      className="text-green-400 hover:text-green-300"
                                    >
                                      ✔
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
                    
                    {/* Button zum Hinzufügen einer Position */}
                    <div className="mt-4">
                      {addingPosition !== idx ? (
                        <button
                          onClick={() => setAddingPosition(idx)}
                          className="w-full py-2 bg-green-600/20 border border-green-500/50 text-green-400 rounded-lg hover:bg-green-600/30 transition-all"
                        >
                          + Position hinzufügen
                        </button>
                      ) : (
                        <div className="bg-white/10 rounded-lg p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              placeholder="Bezeichnung *"
                              className="bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-gray-400"
                              value={newPosition.title}
                              onChange={(e) => setNewPosition({...newPosition, title: e.target.value})}
                            />
                            <input
                              type="text"
                              placeholder="Einheit"
                              className="bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-gray-400"
                              value={newPosition.unit}
                              onChange={(e) => setNewPosition({...newPosition, unit: e.target.value})}
                            />
                            <input
                              type="number"
                              placeholder="Menge"
                              className="bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-gray-400"
                              value={newPosition.quantity}
                              onChange={(e) => setNewPosition({...newPosition, quantity: parseFloat(e.target.value) || 1})}
                            />
                            <input
                              type="number"
                              placeholder="Einzelpreis (€)"
                              className="bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-gray-400"
                              value={newPosition.unitPrice}
                              onChange={(e) => setNewPosition({...newPosition, unitPrice: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                          <textarea
                            placeholder="Beschreibung (optional)"
                            className="w-full bg-white/20 border border-white/30 rounded px-3 py-2 text-white placeholder-gray-400"
                            rows="2"
                            value={newPosition.description}
                            onChange={(e) => setNewPosition({...newPosition, description: e.target.value})}
                          />
                          <label className="flex items-center text-white cursor-pointer">
                            <input
                              type="checkbox"
                              checked={newPosition.isNEP}
                              onChange={(e) => setNewPosition({...newPosition, isNEP: e.target.checked})}
                              className="mr-2 w-4 h-4 text-teal-500"
                            />
                            <span>NEP (Nur-Einheits-Preis) - Position wird nicht zur Gesamtsumme addiert</span>
                            <span className="ml-2 text-xs text-gray-400">(Eventualposition)</span>
                          </label>                          
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleAddPosition(idx)}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                            >
                              Speichern
                            </button>
                            <button
                              onClick={() => {
                                setAddingPosition(null);
                                setNewPosition({
                                  title: '',
                                  description: '',
                                  quantity: 1,
                                  unit: 'Stk',
                                  unitPrice: 0,
                                  isNEP: false  
                                });
                              }}
                              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      )}
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
            {lvs.map((lv, idx) => (
              <div key={idx} className="flex justify-between text-white">
                <span className="text-gray-300">
                  {lv.trade_name || lv.name || lv.trade_code}
                  {lv.content?.nepSum > 0 && (
                    <span className="text-xs text-yellow-400 ml-2">
                      (enthält NEP-Positionen)
                    </span>
                  )}
                </span>
                <span className="font-medium">
                  {formatCurrency(calculateTotal(lv))}
                  {lv.content?.nepSum > 0 && (
                    <span className="text-xs text-gray-400 ml-2">
                      + NEP: {formatCurrency(lv.content.nepSum)}
                    </span>
                  )}
                </span>
              </div>
            ))}
            
            <div className="border-t border-white/20 pt-4 mt-4 space-y-2">
              {(() => {
                const nettoSum = lvs.reduce((acc, lv) => acc + calculateTotal(lv), 0);
                const contingency = nettoSum * 0.05;
                const subtotal = nettoSum + contingency;
                const vat = subtotal * 0.19;
                const grandTotal = subtotal + vat;
                
                return (
                  <>
                    <div className="flex justify-between text-xl font-semibold text-white">
                      <span>Netto-Summe:</span>
                      <span>{formatCurrency(nettoSum)}</span>
                    </div>
                    
                    <div className="flex justify-between text-gray-300">
                      <span>Unvorhergesehenes (5%):</span>
                      <span>{formatCurrency(contingency)}</span>
                    </div>
                    
                    <div className="flex justify-between text-gray-300">
                      <span>MwSt. (19%):</span>
                      <span>{formatCurrency(vat)}</span>
                    </div>
                    
                    <div className="flex justify-between text-2xl font-bold text-teal-400 border-t border-white/20 pt-4 mt-4">
                      <span>Gesamtsumme:</span>
                      <span>{formatCurrency(grandTotal)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* NEUE SEKTION: Ausschreibungs-Buttons */}
<div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 mt-8">
  <h3 className="text-2xl font-bold text-white mb-6">Ausschreibung starten</h3>
  
  <div className="mb-6 bg-blue-50/10 border border-blue-400/30 rounded-lg p-4">
    <p className="text-blue-200 text-sm">
      <strong>ℹ️ So funktioniert's:</strong> Wir senden Ihre Leistungsverzeichnisse automatisch an passende, 
      verifizierte Handwerker in Ihrer Region. Diese können dann direkt Angebote abgeben, 
      die Sie in Ihrem Dashboard vergleichen können.
    </p>
  </div>
  
  {/* Gesamt-Ausschreibung Button */}
  <div className="mb-6">
    <button
      onClick={async () => {
        if (!window.confirm('Möchten Sie alle Gewerke an passende Handwerker ausschreiben?')) return;
        
        try {
          const res = await fetch(apiUrl(`/api/projects/${projectId}/tender/create`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tradeIds: 'all',
              timeframe: project?.timeframe || 'Nach Absprache'
            })
          });
          
          if (res.ok) {
            const data = await res.json();
            alert(`✅ Erfolgreich! ${data.message}\n\nDie Handwerker wurden benachrichtigt und können nun Angebote abgeben.`);
            
            // Weiterleitung zum Dashboard
            setTimeout(() => {
              navigate('/bauherr/dashboard');
            }, 2000);
          } else {
            throw new Error('Fehler beim Erstellen der Ausschreibung');
          }
        } catch (error) {
          alert('Fehler: ' + error.message);
        }
      }}
      className="w-full px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-lg font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
    >
      🚀 Alle Gewerke jetzt an geeignete Handwerker ausschreiben
    </button>
  </div>
  
  {/* Einzelne Gewerke */}
  <div className="border-t border-white/20 pt-6">
    <h4 className="text-lg font-semibold text-white mb-4">Oder einzelne Gewerke ausschreiben:</h4>
    <div className="space-y-3">
      {lvs.map((lv, idx) => (
        <div key={idx} className="flex justify-between items-center bg-white/5 rounded-lg p-4">
          <div>
            <span className="text-white font-medium">{lv.trade_name || lv.name}</span>
            <span className="text-gray-400 ml-3">
              (~{formatCurrency(calculateTotal(lv))})
            </span>
          </div>
          <button
            onClick={async () => {
              if (!window.confirm(`Möchten Sie ${lv.trade_name || lv.name} ausschreiben?`)) return;
              
              try {
                const res = await fetch(apiUrl(`/api/projects/${projectId}/tender/create`), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    tradeIds: [lv.trade_id],
                    timeframe: project?.timeframe || 'Nach Absprache'
                  })
                });
                
                if (res.ok) {
                  const data = await res.json();
                  const matchedCount = data.tenders[0]?.matchedHandwerker || 0;
                  
                  if (matchedCount === 0) {
                    alert(`⚠️ Aktuell keine passenden Handwerker für ${lv.trade_name} verfügbar.\n\nSobald neue Handwerker registriert sind, werden diese automatisch benachrichtigt.`);
                  } else if (matchedCount === 1) {
                    alert(`✅ 1 Handwerker für ${lv.trade_name} gefunden und benachrichtigt.\n\nHinweis: Aktuell nur ein Anbieter verfügbar. Weitere werden benachrichtigt, sobald verfügbar.`);
                  } else {
                    alert(`✅ ${matchedCount} Handwerker für ${lv.trade_name} gefunden und benachrichtigt!`);
                  }
                } else {
                  throw new Error('Fehler beim Erstellen der Ausschreibung');
                }
              } catch (error) {
                alert('Fehler: ' + error.message);
              }
            }}
            className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            Ausschreiben →
          </button>
        </div>
      ))}
    </div>
  </div>
</div>
        
        {/* Budget-Vergleich nur wenn Budget vorhanden */}
        {project && project.budget && project.budget > 0 && (
          <div className="mt-8">
            {(() => {
              const nettoSum = lvs.reduce((acc, lv) => acc + calculateTotal(lv), 0);
              const contingency = nettoSum * 0.05;
              const subtotal = nettoSum + contingency;
              const vat = subtotal * 0.19;
              const grandTotal = subtotal + vat;
              
              if (grandTotal <= parseFloat(project.budget)) {
                return (
                  <BudgetSuccess 
                    totalSum={grandTotal}
                    budget={parseFloat(project.budget)}
                  />
                );
              } else {
                return (
                  <BudgetExceeded
                    totalSum={grandTotal}
                    budget={parseFloat(project.budget)}
                    onLoadOptimizations={loadOptimizations}
                    loadingOptimizations={loadingOptimizations}
                    showOptimizations={showOptimizations}
                    optimizations={optimizations}
                  />
                );
              }
            })()}
          </div>
        )}
        
        {/* ÄNDERUNG: Erweiterte Action Buttons */}
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
          
          {/* NEU: Zurück zur Übersicht Button */}
          {!projectComplete && (
            <button
              onClick={() => navigate(`/project/${projectId}/lv-review`)}
              className="px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
            >
              ← Zurück zur Bearbeitung
            </button>
          )}
        
          {/* ERWEITERT: Weiteres Gewerk Button mit besserem Context */}
          <button
            onClick={() => {
              if (!projectComplete) {
                if (window.confirm('Es sind noch nicht alle Gewerke bearbeitet. Möchten Sie trotzdem ein zusätzliches Gewerk hinzufügen?')) {
                  handleAddAdditionalTrade();
                }
              } else {
                handleAddAdditionalTrade();
              }
            }}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
          >
            <span className="text-xl mr-2">+</span> 
            {projectComplete ? 'Weiteres Gewerk hinzufügen' : 'Zusätzliches Gewerk hinzufügen'}
          </button>

          {/* NEU: Zurück zum Dashboard Button */}
  <button
    onClick={() => {
      const userData = sessionStorage.getItem('userData');
      if (userData) {
        navigate('/bauherr/dashboard');
      } else {
        navigate('/bauherr/login');
      }
    }}
    className="px-8 py-4 bg-gradient-to-r from-gray-600 to-slate-700 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
  >
    <span className="text-xl mr-2">🏠</span>
    Zurück zum Dashboard
  </button>
</div>
        
        {/* ÄNDERUNG: Footer mit mehr Optionen */}
        <div className="mt-16 text-center">
          <Link to="/" className="text-teal-400 hover:text-teal-300 text-lg mx-4 transition-colors">
            ← Zur Startseite
          </Link>
          <span className="text-white/30">|</span>
          
          {/* NEU: Link zur Review-Page */}
          {!projectComplete && (
            <>
              <Link 
                to={`/project/${projectId}/lv-review`} 
                className="text-teal-400 hover:text-teal-300 text-lg mx-4 transition-colors"
              >
                Zur Übersicht
              </Link>
              <span className="text-white/30">|</span>
            </>
          )}
          
          <Link to="/start" className="text-teal-400 hover:text-teal-300 text-lg mx-4 transition-colors">
            Neues Projekt starten →
          </Link>
        </div>
      </div>
    </div>
  );
}
