import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function LVReviewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  // Projekt & Gewerke States
  const [project, setProject] = useState(null);
  const [selectedTrades, setSelectedTrades] = useState([]);
  const [lvs, setLvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingQuestions, setGeneratingQuestions] = useState({});
  const [questionsStatus, setQuestionsStatus] = useState({});
  const [generatingLVs, setGeneratingLVs] = useState({});
  const [questionGenerationProgress, setQuestionGenerationProgress] = useState({});
  
  // Bearbeitungs-States (wie ResultPage)
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
  
  // Hilfe-States
  const [showHelp, setShowHelp] = useState(false);
  const [showTradeHelp, setShowTradeHelp] = useState({});
  
  // Helper Funktionen (identisch mit ResultPage)
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
  
  // Daten laden
useEffect(() => {
  async function loadData() {
    try {
      setLoading(true);
      
      // ⚡ NEU: Lade generatingLVs aus sessionStorage
      const savedGeneratingLVs = JSON.parse(sessionStorage.getItem('generatingLVs') || '{}');
      console.log('📂 Loaded generatingLVs from sessionStorage:', savedGeneratingLVs);
      setGeneratingLVs(savedGeneratingLVs);
      
      // 1. Projekt laden
      const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
      if (!projectRes.ok) throw new Error('Projekt konnte nicht geladen werden');
      const projectData = await projectRes.json();
      setProject(projectData);
      
      // 2. Gewählte Gewerke laden
      const tradesRes = await fetch(apiUrl(`/api/projects/${projectId}/selected-trades`));
      if (!tradesRes.ok) throw new Error('Gewerke konnten nicht geladen werden');
      const tradesData = await tradesRes.json();
      
      // 3. LVs für fertige Gewerke laden
      let lvsData = { lvs: [] };
      const lvsRes = await fetch(apiUrl(`/api/projects/${projectId}/lv`));
      if (lvsRes.ok) {
        lvsData = await lvsRes.json();
        setLvs(lvsData.lvs || []);
      }
      
      const combinedTrades = tradesData.trades.map(trade => {
        const lv = (lvsData?.lvs || []).find(l => 
          parseInt(l.trade_id) === parseInt(trade.id)
        );
        
        // ⚡ NEU: Wenn LV vorhanden, entferne aus generatingLVs
        if (lv) {
          delete savedGeneratingLVs[trade.id];
        }
        
        return {
          ...trade,
          hasLV: !!lv,
          lv: lv,
          totalCost: lv ? calculateTotal(lv) : 0
        };
      });
      
      // ⚡ NEU: Update sessionStorage falls LVs fertig sind
      sessionStorage.setItem('generatingLVs', JSON.stringify(savedGeneratingLVs));
      setGeneratingLVs(savedGeneratingLVs);
      
      setSelectedTrades(combinedTrades);
      
      // Status für alle Trades laden
      const statusPromises = combinedTrades.map(async (trade) => {
        try {
          const res = await fetch(
            apiUrl(`/api/projects/${projectId}/trades/${trade.id}/questions-status`)
          );
          if (res.ok) {
            const data = await res.json();
            console.log(`Status for trade ${trade.id}:`, data);
            return { tradeId: trade.id, status: data };
          }
        } catch (err) {
          console.error(`Failed to load status for trade ${trade.id}`);
        }
        return null;
      });
      
      const statuses = await Promise.all(statusPromises);
      const statusMap = {};
      statuses.forEach(s => {
        if (s) statusMap[s.tradeId] = s.status;
      });
      
      console.log('All statuses:', statusMap);
      setQuestionsStatus(statusMap);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  
  loadData();
}, [projectId]);

// ERSETZE das Polling useEffect (ca. Zeile 160) mit diesem Code:
useEffect(() => {
  const activeGenerations = Object.entries(generatingLVs)
    .filter(([_, isGenerating]) => isGenerating)
    .map(([tradeId]) => parseInt(tradeId));
  
  if (activeGenerations.length === 0) {
    console.log('⏸️ No active LV generations - polling stopped');
    return;
  }
  
  console.log('▶️ Starting polling for trades:', activeGenerations);
  
  const interval = setInterval(async () => {
    console.log('🔄 Polling LV status...');
    
    for (const tradeId of activeGenerations) {
      try {
        const res = await fetch(apiUrl(`/api/projects/${projectId}/lv`));
        if (res.ok) {
          const data = await res.json();
          const lvExists = data.lvs?.some(lv => parseInt(lv.trade_id) === tradeId);
          
          if (lvExists) {
            console.log(`✅ LV for trade ${tradeId} is ready!`);
            
            // ⚡ NEU: Entferne aus generatingLVs und sessionStorage
            setGeneratingLVs(prev => {
              const updated = { ...prev };
              delete updated[tradeId];
              sessionStorage.setItem('generatingLVs', JSON.stringify(updated));
              console.log('💾 Updated generatingLVs in sessionStorage:', updated);
              return updated;
            });
            
            // Reload Seite um neue LVs anzuzeigen
            setTimeout(() => {
              window.location.reload();
            }, 500);
          } else {
            console.log(`⏳ LV for trade ${tradeId} still generating...`);
          }
        }
      } catch (err) {
        console.error('❌ Polling error:', err);
      }
    }
  }, 5000); // Alle 5 Sekunden prüfen
  
  return () => {
    console.log('🛑 Polling cleanup');
    clearInterval(interval);
  };
}, [generatingLVs, projectId]);

useEffect(() => {
  // Cleanup beim Unmount oder Seitenwechsel
  return () => {
    console.log('🧹 LVReviewPage unmounting - cleaning up');
  };
}, []);
  
  const calculateTotal = (lv) => {
    if (lv.content?.totalSum) {
      return parseFloat(lv.content.totalSum) || 0;
    }
    
    if (!lv.content || !lv.content.positions) return 0;
    return lv.content.positions.reduce((sum, pos) => {
      if (pos.isNEP) return sum;
      if (pos.totalPrice) return sum + parseFloat(pos.totalPrice) || 0;
      if (pos.quantity && pos.unitPrice) {
        return sum + (parseFloat(pos.quantity) * parseFloat(pos.unitPrice)) || 0;
      }
      return sum;
    }, 0);
  };

  // Starte Fragengenerierung im Hintergrund
const handleGenerateQuestions = async (tradeId) => {
  try {
    const trade = selectedTrades.find(t => t.id === parseInt(tradeId));
    
    // FIX: Beide Schreibweisen prüfen
    const isSpecial = trade?.isManual || trade?.is_manual || 
                     trade?.isAiRecommended || trade?.is_ai_recommended || 
                     trade?.isAdditional || trade?.is_additional;
    
    console.log('🔍 Trade check:', trade, 'isSpecial:', isSpecial);
    
    if (isSpecial) {
      console.log('🎯 Special trade - navigating directly to questions');
      handleStartQuestions(tradeId);
      return;
    }
    
    // Normale Trades: Background-Generierung
    setGeneratingQuestions(prev => ({ ...prev, [tradeId]: true }));
    setQuestionGenerationProgress(prev => ({ ...prev, [tradeId]: 0 }));
    
    // Starte Fake-Progress (0 → 90% in 60 Sekunden)
    const progressInterval = setInterval(() => {
      setQuestionGenerationProgress(prev => {
        const currentProgress = prev[tradeId] || 0;
        if (currentProgress >= 90) {
          clearInterval(progressInterval);
          return { ...prev, [tradeId]: 90 };
        }
        return { ...prev, [tradeId]: currentProgress + 1.5 };
      });
    }, 1000);
    
    const res = await fetch(
      apiUrl(`/api/projects/${projectId}/trades/${tradeId}/generate-questions-background`),
      { method: 'POST' }
    );
    
    if (res.ok) {
      pollQuestionStatus(tradeId, progressInterval);
    }
  } catch (err) {
    console.error('Failed to start question generation:', err);
    setGeneratingQuestions(prev => ({ ...prev, [tradeId]: false }));
    setQuestionGenerationProgress(prev => ({ ...prev, [tradeId]: 0 }));
  }
};

// Status-Polling
const pollQuestionStatus = (tradeId, progressInterval) => {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(
        apiUrl(`/api/projects/${projectId}/trades/${tradeId}/questions-status`)
      );
      
      if (res.ok) {
        const data = await res.json();
        setQuestionsStatus(prev => ({ ...prev, [tradeId]: data }));
        
        // NEU: Wenn Special Trade, stoppe Polling
        if (data.requiresContext) {
          console.log('✅ Special trade - stopping poll');
          clearInterval(interval);
          clearInterval(progressInterval);
          setGeneratingQuestions(prev => ({ ...prev, [tradeId]: false }));
          setQuestionGenerationProgress(prev => ({ ...prev, [tradeId]: 0 }));
          return;
        }
        
        if (data.questionCount > 0) {
          console.log('✅ Questions ready for trade', tradeId);
          clearInterval(interval);
          clearInterval(progressInterval);
          
          setQuestionGenerationProgress(prev => ({ ...prev, [tradeId]: 100 }));
          
          setTimeout(() => {
            setGeneratingQuestions(prev => ({ ...prev, [tradeId]: false }));
            setQuestionGenerationProgress(prev => ({ ...prev, [tradeId]: 0 }));
            window.location.reload();
          }, 500);
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, 3000);
};

// Alle Fragen auf einmal starten
const handleGenerateAllQuestions = async () => {
  const pendingTradesWithoutQuestions = selectedTrades.filter(t => !t.hasLV);
  
  for (const trade of pendingTradesWithoutQuestions) {
    await handleGenerateQuestions(trade.id);
  }
};
  
  // Navigation Funktionen
 const handleStartQuestions = (tradeId) => {
  const trade = selectedTrades.find(t => t.id === parseInt(tradeId));
  
  if (!trade) {
    console.error('Trade not found:', tradeId);
    return;
  }
  
  // Baue URL mit korrekten Parametern
  let url = `/project/${projectId}/trade/${tradeId}/questions`;
  
  if (trade.is_additional) {
    url += '?additional=true';
  } else if (trade.is_manual || trade.isManual) {
    url += '?manual=true';
  } else if (trade.is_ai_recommended || trade.isAiRecommended) {
    url += '?airecommended=true';
  }
  
  console.log('🎯 Navigating to:', url, 'Trade flags:', {
    is_manual: trade.is_manual,
    is_ai_recommended: trade.is_ai_recommended,
    is_additional: trade.is_additional
  });
  
  navigate(url);
};
  
  const handleContinueToResult = () => {
    const incompleteTrades = selectedTrades.filter(t => !t.hasLV);
    
    if (incompleteTrades.length > 0) {
      const tradeNames = incompleteTrades.map(t => t.name).join(', ');
      if (!window.confirm(
        `Folgende Gewerke haben noch kein LV: ${tradeNames}.\n\n` +
        `Möchten Sie trotzdem zur Gesamtübersicht?`
      )) {
        return;
      }
    }
    
    navigate(`/project/${projectId}/result`);
  };
  
  const handleAddAdditionalTrade = () => {
    sessionStorage.setItem('returnToReview', 'true');
    navigate(`/project/${projectId}/add-trade?additional=true`);
  };
  
  // eslint-disable-next-line no-unused-vars
  const handleEditPosition = (lvIndex, posIndex, field, value) => {
    const key = `${lvIndex}-${posIndex}-${field}`;
    setEditedValues(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // eslint-disable-next-line no-unused-vars
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
      
      // Update selectedTrades
      const updatedTrades = [...selectedTrades];
      const tradeIndex = updatedTrades.findIndex(t => t.id === lv.trade_id);
      if (tradeIndex !== -1) {
        updatedTrades[tradeIndex].lv = newLvs[lvIndex];
        updatedTrades[tradeIndex].totalCost = totals.totalSum;
        setSelectedTrades(updatedTrades);
      }
      
      if (selectedPosition && modalLvIndex === lvIndex && modalPosIndex === posIndex) {
        setSelectedPosition(updatedPosition);
      }
      
      setEditingPosition(null);
      setEditedValues({});
    }
  };
  
  const handleDeletePosition = async (tradeIndex, posIndex) => {
    if (!window.confirm('Position wirklich löschen?')) return;
    
    const trade = selectedTrades[tradeIndex];
    const lv = trade.lv;
    const position = lv.content.positions[posIndex];
    
    const res = await fetch(
      apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv/position/${position.pos}`),
      { method: 'DELETE' }
    );
    
    if (res.ok) {
      const remainingPositions = [...lv.content.positions];
      remainingPositions.splice(posIndex, 1);
      
      const totals = recalculateTotalsWithNEP(remainingPositions);
      
      // Update backend
      await fetch(apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv/update`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          positions: remainingPositions,
          totalSum: totals.totalSum
        })
      });
      
      // Update selectedTrades
      const updatedTrades = [...selectedTrades];
      updatedTrades[tradeIndex].lv.content.positions = remainingPositions;
      updatedTrades[tradeIndex].lv.content.totalSum = totals.totalSum;
      updatedTrades[tradeIndex].totalCost = totals.totalSum;
      setSelectedTrades(updatedTrades);
      
      // Update lvs array
      const newLvs = [...lvs];
      const lvIndex = newLvs.findIndex(l => l.trade_id === lv.trade_id);
      if (lvIndex !== -1) {
        newLvs[lvIndex].content.positions = remainingPositions;
        newLvs[lvIndex].content.totalSum = totals.totalSum;
        setLvs(newLvs);
      }
    }
  };
  
  const handleAddPosition = async (tradeIndex) => {
    const trade = selectedTrades[tradeIndex];
    const lv = trade.lv;
    
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
        
        // Update selectedTrades
        const updatedTrades = [...selectedTrades];
        updatedTrades.forEach(trade => {
          const updatedLv = lvData.lvs.find(l => l.trade_id === trade.id);
          if (updatedLv) {
            trade.lv = updatedLv;
            trade.totalCost = calculateTotal(updatedLv);
          }
        });
        setSelectedTrades(updatedTrades);
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
  
  // Position Modal (angepasst für LVReviewPage)
  const PositionModal = () => {
    if (!selectedPosition || modalLvIndex === null || modalPosIndex === null) return null;
    
    // In LVReviewPage müssen wir das LV aus selectedTrades holen
    const trade = selectedTrades[modalLvIndex];
    if (!trade || !trade.lv) return null;
    const lv = trade.lv;
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
        // Update selectedTrades direkt
        const newSelectedTrades = [...selectedTrades];
        newSelectedTrades[modalLvIndex].lv.content.positions = updatedPositions;
        newSelectedTrades[modalLvIndex].lv.content.totalSum = totals.totalSum;
        newSelectedTrades[modalLvIndex].lv.content.nepSum = totals.nepSum;
        newSelectedTrades[modalLvIndex].totalCost = totals.totalSum;
        setSelectedTrades(newSelectedTrades);
        
        // Update lvs array auch
        const newLvs = [...lvs];
        const lvIndex = newLvs.findIndex(l => l.trade_id === lv.trade_id);
        if (lvIndex !== -1) {
          newLvs[lvIndex].content.positions = updatedPositions;
          newLvs[lvIndex].content.totalSum = totals.totalSum;
          newLvs[lvIndex].content.nepSum = totals.nepSum;
          setLvs(newLvs);
        }
        
        setSelectedPosition(updatedPosition);
        setEditingPosition(null);
        setEditedValues({});
      }
    };
    
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
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
  
  // Hilfe-Komponente
  const HelpSection = () => (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-lg mb-8">
      <h3 className="text-lg font-bold text-blue-900 mb-3">
        💡 So prüfen Sie Ihre Leistungsverzeichnisse
      </h3>
      <div className="space-y-3 text-sm text-blue-800">
        <div>
          <strong>Was ist ein Leistungsverzeichnis (LV)?</strong>
          <p className="mt-1">Ein LV ist eine detaillierte Auflistung aller Arbeiten, die durchgeführt werden sollen. 
          Jede Position beschreibt eine konkrete Leistung mit Menge, Einheit und Preis.</p>
        </div>
        
        <div>
          <strong>Worauf sollten Sie achten?</strong>
          <ul className="mt-1 ml-4 list-disc">
            <li>Sind alle notwendigen Arbeiten aufgeführt?</li>
            <li>Stimmen die Mengen (m², Stück, etc.) ungefähr?</li>
            <li>Fehlen wichtige Positionen?</li>
            <li>Sind die Beschreibungen verständlich?</li>
          </ul>
        </div>
        
        <div>
          <strong>Was können Sie tun?</strong>
          <ul className="mt-1 ml-4 list-disc">
            <li>Klicken Sie auf eine Position, um Details zu sehen</li>
            <li>Bearbeiten Sie Mengen oder Beschreibungen mit dem ✎ Symbol</li>
            <li>Fügen Sie fehlende Positionen mit "+ Position hinzufügen" hinzu</li>
            <li>Löschen Sie überflüssige Positionen mit 🗑</li>
          </ul>
        </div>
        
        <div className="bg-yellow-50 border border-yellow-300 rounded p-3 mt-3">
          <strong className="text-yellow-800">⚠️ Hinweis:</strong>
          <p className="text-yellow-700 mt-1">
            Die KI hat die LVs basierend auf Ihren Angaben erstellt. Kleinere Anpassungen können 
            Sie hier vornehmen. Größere Änderungen besprechen Sie am besten direkt mit dem jeweiligen Handwerker.
          </p>
        </div>
      </div>
    </div>
  );
  
  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
          <p className="mt-4 text-white">Lade Übersicht...</p>
        </div>
      </div>
    );
  }
  
  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md">
          <p className="text-red-200">Fehler: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }
  
  // Berechne Gesamtsummen
  const completedTrades = selectedTrades.filter(t => t.hasLV);
  const pendingTrades = selectedTrades.filter(t => !t.hasLV);
  const totalNetSum = completedTrades.reduce((sum, t) => sum + t.totalCost, 0);
  
  // Main Render
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Position Modal */}
      <PositionModal />
      
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-40 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-40 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
      </div>
      
      <div className="relative max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Leistungsverzeichnis-Übersicht
          </h1>
          <p className="text-xl text-gray-300">
            {project?.name || 'Ihr Projekt'}
          </p>
          
          {/* Progress Info */}
          <div className="mt-6 flex justify-center gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-teal-400">{completedTrades.length}</div>
              <div className="text-sm text-gray-400">LVs erstellt</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">{pendingTrades.length}</div>
              <div className="text-sm text-gray-400">Ausstehend</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{formatCurrency(totalNetSum)}</div>
              <div className="text-sm text-gray-400">Bisherige Netto-Summe</div>
            </div>
          </div>
        </div>
        
        {/* Help Toggle */}
        <div className="mb-6 text-center">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {showHelp ? 'Hilfe ausblenden' : 'Hilfe anzeigen'}
          </button>
        </div>
        
        {/* Help Section */}
        {showHelp && <HelpSection />}
        
        {/* Trade Overview Cards */}
        <div className="grid gap-6 mb-8">
          {selectedTrades.map((trade, idx) => {
            const lv = trade.lv;
            
            return (
              <div key={trade.id} 
                className={`bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border ${
                  trade.hasLV ? 'border-teal-500/30' : 'border-yellow-500/30'
                }`}>
                
                {/* Trade Header */}
                <div className={`px-6 py-4 flex justify-between items-center ${
                  trade.hasLV 
                    ? 'bg-gradient-to-r from-teal-600/20 to-blue-600/20' 
                    : 'bg-gradient-to-r from-yellow-600/20 to-orange-600/20'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      trade.hasLV ? 'bg-teal-500' : 'bg-yellow-500'
                    }`}>
                      {trade.hasLV ? (
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <span className="text-white font-bold">{idx + 1}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{trade.name}</h3>
                      <p className="text-sm text-gray-300">
                        {trade.hasLV ? `${lv?.content?.positions?.length || 0} Positionen` : 'Noch keine Fragen beantwortet'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    {trade.hasLV && (
                      <span className="text-2xl font-bold text-teal-400 mr-4">
                        {formatCurrency(trade.totalCost)}
                      </span>
                    )}
                    
                   {!trade.hasLV ? (
  <div className="flex gap-2">
    {/* LV wird gerade erstellt */}
    {generatingLVs[trade.id] ? (
      <button
        disabled
        className="px-6 py-2 bg-gray-500 text-white rounded-lg opacity-50 cursor-not-allowed flex items-center gap-2"
      >
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span>LV in Erstellung...</span>
      </button>
    ) : questionsStatus[trade.id]?.questionCount > 0 ? (
      // Fragen sind DA - zeige "Fragen starten"
      <button
        onClick={() => {
          handleStartQuestions(trade.id);
          setGeneratingLVs(prev => ({ ...prev, [trade.id]: true }));
        }}
        className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:shadow-lg transform hover:scale-[1.02] transition-all"
      >
        Fragen starten →
      </button>
    ) : generatingQuestions[trade.id] ? (
  <div className="w-full">
    <button
      disabled
      className="w-full px-6 py-2 bg-gray-500 text-white rounded-lg opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
    >
      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span>Fragen werden erstellt...</span>
    </button>
    
    {/* Fake-Ladebalken */}
    <div className="mt-2 w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
      <div 
        className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all duration-1000 ease-out"
        style={{ width: `${questionGenerationProgress[trade.id] || 0}%` }}
      />
    </div>
    <p className="text-xs text-gray-400 mt-1 text-center">
      {questionGenerationProgress[trade.id] || 0}% abgeschlossen
    </p>
  </div>
) : (
      // Noch keine Fragen - zeige "Generieren"
      <button
        onClick={() => handleGenerateQuestions(trade.id)}
        className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:shadow-lg transform hover:scale-[1.02] transition-all"
      >
        Fragen generieren
      </button>
    )}
  </div>
) : (
  <>
    <button
      onClick={() => setSelectedLv(selectedLv === idx ? null : idx)}
      className="text-sm bg-white/20 text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-all"
    >
      {selectedLv === idx ? 'Schließen' : 'Details anzeigen'}
    </button>
    <button
      onClick={() => setShowTradeHelp({ ...showTradeHelp, [trade.id]: !showTradeHelp[trade.id] })}
      className="text-sm bg-blue-600/50 text-white px-3 py-2 rounded-lg hover:bg-blue-600/70 transition-all"
      title="Hilfe für dieses Gewerk"
    >
      ?
    </button>
  </>
)}
                  </div>
                </div>
                
                {/* Trade-specific Help */}
                {showTradeHelp[trade.id] && trade.hasLV && (
                  <div className="px-6 py-4 bg-blue-900/20 border-t border-blue-500/30">
                    <p className="text-sm text-blue-200">
                      <strong>💡 Tipp für {trade.name}:</strong> Prüfen Sie besonders die Mengenangaben 
                      in diesem Gewerk. Falls etwas fehlt, können Sie unten Positionen hinzufügen. 
                      Die Preise sind Schätzwerte und werden später vom Handwerker konkretisiert.
                    </p>
                  </div>
                )}
                
                {/* LV Details (wenn ausgewählt und vorhanden) */}
                {selectedLv === idx && lv && (
                  <div className="px-6 pb-6">
                    <div className="overflow-x-auto mt-4">
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
                                <div>
                                  <div className="font-medium">{pos.title}</div>
                                  {pos.description && (
                                    <div className="text-xs text-gray-400 mt-1">
                                      {pos.description.substring(0, 100)}
                                      {pos.description.length > 100 && '...'}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="text-right p-3">
                                {pos.quantity ? safeToFixed(pos.quantity) : '-'}
                              </td>
                              <td className="p-3">{pos.unit || '-'}</td>
                              <td className="text-right p-3">
                                {pos.unitPrice ? safeToFixed(pos.unitPrice) : '-'}
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
                                      const updatedTrades = [...selectedTrades];
                                      updatedTrades[idx].lv.content.positions = updatedPositions;
                                      updatedTrades[idx].lv.content.totalSum = totals.totalSum;
                                      updatedTrades[idx].lv.content.nepSum = totals.nepSum;
                                      updatedTrades[idx].totalCost = totals.totalSum;
                                      setSelectedTrades(updatedTrades);
                                      
                                      const newLvs = [...lvs];
                                      const lvIndex = newLvs.findIndex(l => l.trade_id === lv.trade_id);
                                      if (lvIndex !== -1) {
                                        newLvs[lvIndex].content.positions = updatedPositions;
                                        newLvs[lvIndex].content.totalSum = totals.totalSum;
                                        newLvs[lvIndex].content.nepSum = totals.nepSum;
                                        setLvs(newLvs);
                                      }
                                    }
                                  }}
                                  className="w-4 h-4 text-teal-500"
                                  title={pos.isNEP ? "NEP-Position (nicht in Summe)" : "Normale Position"}
                                />
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex gap-2 justify-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPosition(pos);
                                      setModalLvIndex(idx);
                                      setModalPosIndex(pidx);
                                      setEditingPosition(`${idx}-${pidx}`);
                                    }}
                                    className="text-blue-400 hover:text-blue-300"
                                  >
                                    ✎
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePosition(idx, pidx);
                                    }}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    🗑
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Add Position Button */}
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Summary Box */}
        {completedTrades.length > 0 && (
          <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 mb-8">
            <h3 className="text-2xl font-bold text-white mb-4">Zwischensumme</h3>
            <div className="space-y-2">
              {completedTrades.map(trade => (
                <div key={trade.id} className="flex justify-between text-white">
                  <span className="text-gray-300">{trade.name}</span>
                  <span>{formatCurrency(trade.totalCost)}</span>
                </div>
              ))}
              <div className="border-t border-white/20 pt-3 mt-3">
                <div className="flex justify-between text-xl font-bold text-teal-400">
                  <span>Gesamt (Netto)</span>
                  <span>{formatCurrency(totalNetSum)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
<div className="flex flex-wrap gap-4 justify-center mt-12">
  {/* NEU: Alle Fragen generieren */}
  {pendingTrades.length > 0 && (
    <button
      onClick={handleGenerateAllQuestions}
      className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
    >
      <span className="text-xl mr-2">⚡</span>
      Alle Fragen im Hintergrund laden ({pendingTrades.length})
    </button>
  )}
  
  {/* Bestehende Buttons bleiben */}
  {pendingTrades.length > 0 && questionsStatus[pendingTrades[0].id]?.ready && (
    <button
      onClick={() => handleStartQuestions(pendingTrades[0].id)}
      className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
    >
      <span className="text-xl mr-2">▶</span>
      Nächstes Gewerk starten ({pendingTrades[0].name})
    </button>
  )}
          
          <button
            onClick={handleAddAdditionalTrade}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
          >
            <span className="text-xl mr-2">+</span>
            Weiteres Gewerk hinzufügen
          </button>
          
          <button
            onClick={handleContinueToResult}
            className={`px-8 py-4 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all ${
              completedTrades.length === 0 
                ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                : 'bg-gradient-to-r from-teal-500 to-blue-600'
            }`}
            disabled={completedTrades.length === 0}
          >
            Zur Gesamtübersicht →
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
      
        {/* Info Text */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>
            {pendingTrades.length > 0 
              ? `Noch ${pendingTrades.length} Gewerk(e) ohne Leistungsverzeichnis. Starten Sie die Fragen für die ausstehenden Gewerke.`
              : 'Alle Gewerke haben ein Leistungsverzeichnis. Sie können zur Gesamtübersicht wechseln oder weitere Gewerke hinzufügen.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
