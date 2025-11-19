// src/pages/BauherrenNachtragsPruefungPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function BauherrenNachtragsPruefungPage() {
  const { nachtragId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [nachtrag, setNachtrag] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [bauherrData, setBauherrData] = useState(null);

  // ✅ NEU: Background-Generierung States
  const [generatingEvaluation, setGeneratingEvaluation] = useState(() => {
  const saved = sessionStorage.getItem(`generatingNachtragEval_${nachtragId}`);
  return saved ? JSON.parse(saved) : false;
});

  const [evaluationProgress, setEvaluationProgress] = useState(() => {
  const saved = sessionStorage.getItem(`nachtragEvalProgress_${nachtragId}`);
  return saved ? parseFloat(saved) : 0;
});

  const [evaluationResult, setEvaluationResult] = useState(() => {
  const saved = sessionStorage.getItem(`nachtragEvalResult_${nachtragId}`);
  return saved ? JSON.parse(saved) : null;
});

  const cleanupEvaluationState = () => {
  sessionStorage.removeItem(`generatingNachtragEval_${nachtragId}`);
  sessionStorage.removeItem(`nachtragEvalProgress_${nachtragId}`);
  
  setGeneratingEvaluation(false);
  setEvaluationProgress(0);
};
  
  useEffect(() => {
    const userData = sessionStorage.getItem('userData') || sessionStorage.getItem('bauherrData');
    if (!userData) {
      navigate('/bauherr/login');
      return;
    }
    
    try {
      const data = JSON.parse(userData);
      setBauherrData(data);
    } catch (error) {
      navigate('/bauherr/login');
      return;
    }
    
    loadNachtrag();
  }, [nachtragId, navigate]); // eslint-disable-line

  // ✅ NEU: Auto-Resume für Nachtragsprüfung
useEffect(() => {
  if (!generatingEvaluation) {
    console.log('⏸️ No active evaluation');
    return;
  }
  
  console.log('▶️ Starting evaluation progress');
  
  // Progress Interval
  const progressInterval = setInterval(() => {
    setEvaluationProgress(prev => {
      const next = prev + (99/90);
      
      let newProgress;
      if (next >= 99) {
        clearInterval(progressInterval);
        newProgress = 99;
      } else {
        newProgress = next;
      }
      
      sessionStorage.setItem(`nachtragEvalProgress_${nachtragId}`, newProgress.toString());
      return newProgress;
    });
  }, 1000);
  
  // Polling Interval
  const pollInterval = setInterval(async () => {
    try {
      const res = await fetch(apiUrl(`/api/nachtraege/${nachtragId}`));
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.evaluation_data) {
          console.log('✅ Evaluation ready');
          
          clearInterval(progressInterval);
          clearInterval(pollInterval);
          
          setEvaluationProgress(100);
          
          setTimeout(() => {
            setEvaluationResult(data.evaluation_data);
            sessionStorage.setItem(`nachtragEvalResult_${nachtragId}`, JSON.stringify(data.evaluation_data));
            
            cleanupEvaluationState();
          }, 500);
        }
      }
    } catch (err) {
      console.error('Poll error:', err);
    }
  }, 5000);
  
  // Cleanup
  return () => {
    console.log('🧹 Cleaning up evaluation intervals');
    clearInterval(progressInterval);
    clearInterval(pollInterval);
  };
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [nachtragId, generatingEvaluation]);
  
  const loadNachtrag = async () => {
  try {
    setLoading(true);
    const res = await fetch(apiUrl(`/api/nachtraege/${nachtragId}`));
    
    if (!res.ok) throw new Error('Fehler beim Laden');
    
    const data = await res.json();
    setNachtrag(data);
    
    // ✅ Falls bereits evaluiert, setze evaluationResult
    if (data.evaluation_data) {
      setEvaluation(data.evaluation_data);
      setEvaluationResult(data.evaluation_data);  // ← NEU!
      sessionStorage.setItem(`nachtragEvalResult_${nachtragId}`, JSON.stringify(data.evaluation_data));  // ← NEU!
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Fehler beim Laden des Nachtrags');
  } finally {
    setLoading(false);
  }
};
  
  const startEvaluation = async () => {
  if (!window.confirm('Möchten Sie eine KI-gestützte Nachtragsprüfung durchführen?')) {
    return;
  }
  
  try {
    // Markiere als generierend
    setGeneratingEvaluation(true);
    sessionStorage.setItem(`generatingNachtragEval_${nachtragId}`, 'true');
    
    setEvaluationProgress(0);
    sessionStorage.setItem(`nachtragEvalProgress_${nachtragId}`, '0');
    
    // Starte POST (läuft im Hintergrund)
    const res = await fetch(apiUrl(`/api/nachtraege/${nachtragId}/evaluate`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!res.ok) {
      cleanupEvaluationState();
      alert('Fehler beim Starten der Bewertung');
    }
  } catch (error) {
    console.error('Error:', error);
    cleanupEvaluationState();
    alert('Fehler: ' + error.message);
  }
};
  
  const handleApprove = async () => {
    if (!window.confirm(`Möchten Sie diesen Nachtrag wirklich beauftragen?\n\nNachtragssumme: ${formatCurrency(nachtrag.amount * 1.19)} (Brutto)`)) {
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/nachtraege/${nachtragId}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bauherrId: bauherrData.id })
      });
      
      if (!res.ok) throw new Error('Fehler beim Beauftragen');
      
      alert('✅ Nachtrag wurde beauftragt!');
      navigate('/bauherr/dashboard');
    } catch (error) {
      alert('Fehler: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Bitte geben Sie einen Ablehnungsgrund ein');
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/nachtraege/${nachtragId}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          bauherrId: bauherrData.id,
          reason: rejectionReason 
        })
      });
      
      if (!res.ok) throw new Error('Fehler beim Ablehnen');
      
      alert('Nachtrag wurde abgelehnt');
      navigate('/bauherr/dashboard');
    } catch (error) {
      alert('Fehler: ' + error.message);
    } finally {
      setLoading(false);
      setShowRejectionModal(false);
    }
  };
  
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };
  
  const getRatingColor = (rating) => {
    switch(rating) {
      case 'green': return 'text-green-400 bg-green-500/20 border-green-500/50';
      case 'yellow': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/50';
      case 'red': return 'text-red-400 bg-red-500/20 border-red-500/50';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/50';
    }
  };
  
  const getRatingIcon = (rating) => {
    switch(rating) {
      case 'green': return '✓';
      case 'yellow': return '⚠';
      case 'red': return '✗';
      default: return '?';
    }
  };
  
  const getRatingText = (rating) => {
    switch(rating) {
      case 'green': return 'Nachtrag plausibel und angemessen';
      case 'yellow': return 'Nachtrag mit Auffälligkeiten';
      case 'red': return 'Nachtrag kritisch';
      default: return 'Nicht bewertet';
    }
  };
  
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
    </div>
  );
  
  if (!nachtrag) return null;
  
  // Parse LV-Daten
  let positions = [];
  if (nachtrag.lv_data) {
    let parsedLV = nachtrag.lv_data;
    if (typeof parsedLV === 'string') {
      parsedLV = JSON.parse(parsedLV);
    }
    if (Array.isArray(parsedLV)) {
      positions = parsedLV;
    } else if (parsedLV.positions) {
      positions = parsedLV.positions;
    }
  }
  
  const netto = parseFloat(nachtrag.amount) || 0;  
  const mwst = netto * 0.19;
  const brutto = netto + mwst;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/bauherr/dashboard')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Zurück zum Dashboard
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Nachtrag Nr. {String(nachtrag.nachtrag_number).padStart(2, '0')}
              </h1>
              <p className="text-xl text-gray-300">
                {nachtrag.trade_name} - {nachtrag.company_name}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg px-6 py-3">
              <p className="text-sm text-gray-400">Eingereicht am</p>
              <p className="text-lg font-semibold text-white">
                {new Date(nachtrag.submitted_at).toLocaleDateString('de-DE')}
              </p>
            </div>
          </div>
        </div>
        
        {/* Status Badge */}
        <div className="mb-6">
          {nachtrag.status === 'submitted' && (
            <span className="inline-flex items-center px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-500/50">
              ⏳ Zur Prüfung eingereicht
            </span>
          )}
          {nachtrag.status === 'approved' && (
            <span className="inline-flex items-center px-4 py-2 rounded-lg bg-green-500/20 text-green-300 border border-green-500/50">
              ✓ Beauftragt
            </span>
          )}
          {nachtrag.status === 'rejected' && (
            <span className="inline-flex items-center px-4 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/50">
              ✗ Abgelehnt
            </span>
          )}
        </div>
        
        {/* Begründung */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Begründung des Handwerkers</h3>
          <div className="bg-white/5 rounded-lg p-4">
            <p className="text-gray-300 whitespace-pre-wrap">{nachtrag.reason}</p>
          </div>
        </div>
        
        {/* Positionen */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 border border-white/20 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Nachtragspositionen</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-white">
              <thead className="bg-white/10">
                <tr>
                  <th className="text-left p-3">Pos.</th>
                  <th className="text-left p-3">Bezeichnung</th>
                  <th className="text-right p-3">Menge</th>
                  <th className="text-left p-3">Einheit</th>
                  <th className="text-right p-3">EP (€)</th>
                  <th className="text-right p-3">GP (€)</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, idx) => (
                  <tr key={idx} className={`border-t border-white/10 ${
                    pos.isNEP ? 'bg-orange-500/10' : pos.isOptional ? 'bg-blue-500/10' : ''
                  }`}>
                    <td className="p-3">{pos.pos}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pos.title}</span>
                        {pos.isNEP && (
                          <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-300 rounded border border-orange-500/30 font-semibold">
                            NEP
                          </span>
                        )}
                        {pos.isOptional && (
                          <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                            Optional
                          </span>
                        )}
                      </div>
                      {pos.description && (
                        <div className="text-xs text-gray-400 mt-1">{pos.description}</div>
                      )}
                      {pos.notes && (
                        <div className="text-xs text-yellow-300 mt-1 italic">Hinweis: {pos.notes}</div>
                      )}
                    </td>
                    <td className="text-right p-3">{pos.quantity}</td>
                    <td className="p-3">{pos.unit}</td>
                    <td className="text-right p-3">{formatCurrency(pos.unitPrice)}</td>
                    <td className="text-right p-3 font-medium text-teal-400">
                      {pos.isNEP ? '-' : formatCurrency(pos.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Summen */}
          <div className="border-t border-white/20 mt-6 pt-6">
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Nachtragssumme Netto:</span>
                  <span className="text-white font-bold text-xl">{formatCurrency(netto)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">zzgl. 19% MwSt.:</span>
                  <span className="text-gray-300">{formatCurrency(mwst)}</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-white/20">
                  <span className="text-white font-bold">Gesamt (Brutto):</span>
                  <span className="text-teal-400 font-bold text-2xl">{formatCurrency(brutto)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* KI-Prüfung Button */}
        {nachtrag.status === 'submitted' && (
          <div className="bg-gradient-to-r from-purple-600/10 to-blue-600/10 backdrop-blur-md rounded-xl p-6 border border-purple-500/30 mb-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">KI-gestützte Nachtragsprüfung</h3>
                <p className="text-gray-300 text-sm mb-4">
                  Lassen Sie den Nachtrag automatisch auf technische Notwendigkeit, vertragliche Berechtigung 
                  und preisliche Angemessenheit prüfen.
                </p>
                <button
  onClick={() => {
    if (evaluationResult) {
      // Zeige gespeichertes Ergebnis
      setEvaluation(evaluationResult);
      setShowEvaluation(true);
    } else {
      // Starte neue Prüfung
      startEvaluation();
    }
  }}
  disabled={generatingEvaluation}
  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
    generatingEvaluation
      ? 'bg-gray-600 cursor-not-allowed'
      : evaluationResult
      ? 'bg-green-600 hover:bg-green-700'
      : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:shadow-xl'
  } text-white`}
>
  {generatingEvaluation ? (
    <div className="flex items-center gap-2">
      <span>⏳ Prüfung läuft...</span>
      {evaluationProgress > 0 && (
        <span className="font-semibold">{Math.round(evaluationProgress)}%</span>
      )}
    </div>
  ) : evaluationResult ? (
    <span>✅ Ergebnis anzeigen</span>
  ) : (
    <span>🤖 byndl-Nachtragsprüfung starten</span>
  )}
</button>

{/* Progress Bar */}
{generatingEvaluation && evaluationProgress > 0 && (
  <div className="mt-3 bg-gray-700 rounded-full h-2 overflow-hidden">
    <div
      className="bg-purple-500 h-full transition-all duration-300"
      style={{ width: `${evaluationProgress}%` }}
    />
  </div>
)}
              </div>
            </div>
          </div>
        )}
        
        {/* Evaluation Modal */}
        {evaluation && showEvaluation && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-b border-white/20">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Nachtragsprüfung - Ergebnis</h2>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${getRatingColor(evaluation.rating)}`}>
                      <span className="text-2xl">{getRatingIcon(evaluation.rating)}</span>
                      <span className="font-semibold">{getRatingText(evaluation.rating)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEvaluation(false)}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Summary */}
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Zusammenfassung</h3>
                  <p className="text-gray-300">{evaluation.summary}</p>
                </div>
                
                {/* Score Grid */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-lg p-4">
                    <h4 className="text-sm text-gray-400 mb-1">Technische Notwendigkeit</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/10 rounded-full h-2">
                        <div 
                          className="bg-teal-400 rounded-full h-2 transition-all"
                          style={{width: `${evaluation.technicalNecessity?.score || 0}%`}}
                        ></div>
                      </div>
                      <span className="text-white font-bold">{evaluation.technicalNecessity?.score || 0}%</span>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-4">
                    <h4 className="text-sm text-gray-400 mb-1">Vertragliche Berechtigung</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/10 rounded-full h-2">
                        <div 
                          className="bg-teal-400 rounded-full h-2 transition-all"
                          style={{width: `${evaluation.contractualJustification?.score || 0}%`}}
                        ></div>
                      </div>
                      <span className="text-white font-bold">{evaluation.contractualJustification?.score || 0}%</span>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-4">
                    <h4 className="text-sm text-gray-400 mb-1">Preisliche Angemessenheit</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/10 rounded-full h-2">
                        <div 
                          className="bg-teal-400 rounded-full h-2 transition-all"
                          style={{width: `${evaluation.priceAnalysis?.score || 0}%`}}
                        ></div>
                      </div>
                      <span className="text-white font-bold">{evaluation.priceAnalysis?.score || 0}%</span>
                    </div>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-4">
                    <h4 className="text-sm text-gray-400 mb-1">Vollständigkeit</h4>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/10 rounded-full h-2">
                        <div 
                          className="bg-teal-400 rounded-full h-2 transition-all"
                          style={{width: `${evaluation.completeness?.score || 0}%`}}
                        ></div>
                      </div>
                      <span className="text-white font-bold">{evaluation.completeness?.score || 0}%</span>
                    </div>
                  </div>
                </div>
                
                {/* Technical Necessity */}
                {evaluation.technicalNecessity && (
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      🔧 Technische Notwendigkeit
                      {evaluation.technicalNecessity.isNecessary ? (
                        <span className="text-sm text-green-400">✓ Notwendig</span>
                      ) : (
                        <span className="text-sm text-red-400">✗ Fragwürdig</span>
                      )}
                    </h3>
                    <p className="text-gray-300 mb-2">{evaluation.technicalNecessity.reasoning}</p>
                    {evaluation.technicalNecessity.wasInOriginal && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mt-2">
                        <p className="text-red-300 text-sm">
                          ⚠️ Leistung war möglicherweise bereits im Ursprungsauftrag enthalten
                        </p>
                      </div>
                    )}
                    {evaluation.technicalNecessity.concerns && evaluation.technicalNecessity.concerns.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-400 mb-1">Bedenken:</p>
                        <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                          {evaluation.technicalNecessity.concerns.map((concern, idx) => (
                            <li key={idx}>{concern}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Contractual Justification */}
                {evaluation.contractualJustification && (
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      📋 Vertragliche Berechtigung
                      {evaluation.contractualJustification.isJustified ? (
                        <span className="text-sm text-green-400">✓ Berechtigt</span>
                      ) : (
                        <span className="text-sm text-red-400">✗ Nicht berechtigt</span>
                      )}
                    </h3>
                    {evaluation.contractualJustification.legalBasis && (
                      <p className="text-sm text-gray-400 mb-2">
                        Rechtsgrundlage: {evaluation.contractualJustification.legalBasis}
                      </p>
                    )}
                    <p className="text-gray-300">{evaluation.contractualJustification.assessment}</p>
                    {evaluation.contractualJustification.risks && evaluation.contractualJustification.risks.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-400 mb-1">Rechtliche Risiken:</p>
                        <ul className="list-disc list-inside text-orange-300 text-sm space-y-1">
                          {evaluation.contractualJustification.risks.map((risk, idx) => (
                            <li key={idx}>{risk}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Price Analysis */}
                {evaluation.priceAnalysis && (
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">💰 Preisanalyse</h3>
                    <p className="text-gray-300 mb-3">{evaluation.priceAnalysis.assessment}</p>
                    
                    {evaluation.priceAnalysis.comparisonToOriginal && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 mb-3">
                        <p className="text-blue-300 text-sm font-semibold mb-2">Vergleich mit Ursprungsauftrag:</p>
                        <p className="text-gray-300 text-sm">{evaluation.priceAnalysis.comparisonToOriginal.consistency}</p>
                      </div>
                    )}
                    
                    {evaluation.priceAnalysis.marketComparison && (
                      <p className="text-gray-300 text-sm">{evaluation.priceAnalysis.marketComparison}</p>
                    )}
                  </div>
                )}
                
                {/* Position Analysis */}
                {evaluation.positionAnalysis && evaluation.positionAnalysis.length > 0 && (
                  <div className="bg-white/5 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-white mb-3">📊 Positionsbewertung</h3>
                    <div className="space-y-3">
                      {evaluation.positionAnalysis.map((pos, idx) => (
                        <div key={idx} className={`p-3 rounded border ${
                          pos.recommendation === 'accept' ? 'bg-green-500/10 border-green-500/30' :
                          pos.recommendation === 'negotiate' ? 'bg-yellow-500/10 border-yellow-500/30' :
                          'bg-red-500/10 border-red-500/30'
                        }`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-white font-semibold">Position {pos.position}: {pos.title}</p>
                              <p className="text-sm text-gray-400">{formatCurrency(pos.amount)}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${
                              pos.recommendation === 'accept' ? 'bg-green-500/20 text-green-300' :
                              pos.recommendation === 'negotiate' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-red-500/20 text-red-300'
                            }`}>
                              {pos.recommendation === 'accept' ? 'Akzeptieren' :
                               pos.recommendation === 'negotiate' ? 'Verhandeln' : 'Ablehnen'}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm">{pos.assessment}</p>
                          {pos.suggestedPrice && (
                            <p className="text-teal-400 text-sm mt-2">
                              💡 Empfohlener Preis: {formatCurrency(pos.suggestedPrice)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Negotiation Points */}
                {evaluation.negotiationPoints && evaluation.negotiationPoints.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-yellow-300 mb-3">💬 Verhandlungspunkte</h3>
                    <div className="space-y-3">
                      {evaluation.negotiationPoints.map((point, idx) => (
                        <div key={idx} className="bg-white/5 p-3 rounded">
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-white font-medium">{point.issue}</p>
                            <span className={`text-xs px-2 py-1 rounded ${
                              point.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                              point.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                              'bg-blue-500/20 text-blue-300'
                            }`}>
                              {point.priority === 'high' ? 'Hoch' :
                               point.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                            </span>
                          </div>
                          <p className="text-gray-300 text-sm mb-2">{point.reasoning}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-400">
                              Aktuell: <span className="text-white">{formatCurrency(point.currentAmount)}</span>
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-teal-400 font-semibold">
                              Fair: {formatCurrency(point.fairAmount)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Risks */}
                {evaluation.risks && evaluation.risks.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-red-300 mb-3">⚠️ Risiken</h3>
                    <ul className="list-disc list-inside text-gray-300 space-y-2">
                      {evaluation.risks.map((risk, idx) => (
                        <li key={idx}>{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Recommendation */}
                {evaluation.recommendation && (
                  <div className={`rounded-lg p-4 border ${
                    evaluation.recommendation.action === 'approve' ? 'bg-green-500/10 border-green-500/30' :
                    evaluation.recommendation.action === 'negotiate' ? 'bg-yellow-500/10 border-yellow-500/30' :
                    'bg-red-500/10 border-red-500/30'
                  }`}>
                    <h3 className="text-lg font-semibold text-white mb-3">
                      {evaluation.recommendation.action === 'approve' ? '✓ Empfehlung: Beauftragung' :
                       evaluation.recommendation.action === 'negotiate' ? '💬 Empfehlung: Nachverhandlung' :
                       '✗ Empfehlung: Ablehnung'}
                    </h3>
                    <p className="text-gray-300 mb-3">{evaluation.recommendation.reasoning}</p>
                    
                    {evaluation.recommendation.suggestedAmount && (
                      <div className="bg-white/10 rounded p-3 mb-3">
                        <p className="text-sm text-gray-400">Empfohlene Nachtragssumme:</p>
                        <p className="text-2xl font-bold text-teal-400">
                          {formatCurrency(evaluation.recommendation.suggestedAmount)}
                        </p>
                      </div>
                    )}
                    
                    {evaluation.recommendation.nextSteps && evaluation.recommendation.nextSteps.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-white mb-2">Nächste Schritte:</p>
                        <ol className="list-decimal list-inside text-gray-300 text-sm space-y-1">
                          {evaluation.recommendation.nextSteps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Footer */}
              <div className="sticky bottom-0 bg-gradient-to-r from-slate-800 to-slate-900 p-6 border-t border-white/20">
                <button
                  onClick={() => setShowEvaluation(false)}
                  className="w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Ablehnung Modal */}
        {showRejectionModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-white/20">
              <h3 className="text-2xl font-bold text-white mb-4">Nachtrag ablehnen</h3>
              <p className="text-gray-300 mb-6">
                Bitte geben Sie eine ausführliche Begründung für die Ablehnung an. 
                Diese wird dem Handwerker mitgeteilt.
              </p>
              <textarea
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                rows="6"
                placeholder="Begründung der Ablehnung..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <div className="flex gap-4 mt-6">
                <button
                  onClick={() => {
                    setShowRejectionModal(false);
                    setRejectionReason('');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Nachtrag ablehnen
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        {nachtrag.status === 'submitted' && (
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setShowRejectionModal(true)}
              className="px-8 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              Nachtrag ablehnen
            </button>
            <button
              onClick={handleApprove}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg hover:shadow-xl transition-all font-semibold"
            >
              Nachtrag beauftragen ({formatCurrency(brutto)})
            </button>
          </div>
        )}
        
        {/* Bereits entschieden */}
        {nachtrag.status === 'approved' && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-6 text-center">
            <p className="text-green-300 text-lg font-semibold">
              ✓ Dieser Nachtrag wurde am {new Date(nachtrag.decided_at).toLocaleDateString('de-DE')} beauftragt
            </p>
          </div>
        )}
        
        {nachtrag.status === 'rejected' && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6">
            <p className="text-red-300 text-lg font-semibold mb-3">
              ✗ Dieser Nachtrag wurde am {new Date(nachtrag.decided_at).toLocaleDateString('de-DE')} abgelehnt
            </p>
            <div className="bg-white/10 rounded p-4">
              <p className="text-sm text-gray-400 mb-1">Ablehnungsgrund:</p>
              <p className="text-gray-300">{nachtrag.rejection_reason}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
