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
  const [project, setProject] = useState(null); // NEU: Project State hinzufügen
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
    unitPrice: 0
  });
  
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
  
  useEffect(() => {
  async function fetchData() {
    try {
      setLoading(true);
      
      // 1. Projekt laden
      const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
      if (projectRes.ok) {
        const projectData = await projectRes.json();
        setProject(projectData);
      }
      
      // 2. LVs laden
      const res = await fetch(apiUrl(`/api/projects/${projectId}/lv`));
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
    
    const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv/update`), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    positions: updatedPositions,
    totalSum: updatedPositions.reduce((sum, pos) => 
      sum + (parseFloat(pos.totalPrice) || 0), 0
    )
  })
});
    
    if (res.ok) {
      const newLvs = [...lvs];
      newLvs[lvIndex].content.positions = updatedPositions;
      newLvs[lvIndex].content.totalSum = recalculateTotals(updatedPositions);
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
    
    const res = await fetch(
      apiUrl(`/api/projects/${projectId}/trades/${lv.trade_id}/lv/position`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPosition)
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
       unitPrice: 0
     });
   }
 };

 // Automatische Neuberechnung der Gesamtsumme
 const recalculateTotals = (positions) => {
   return positions.reduce((sum, pos) => sum + (pos.totalPrice || 0), 0);
 };
 
 const calculateTotal = (lv) => {
   // Zuerst prüfen ob totalSum vorhanden ist
   if (lv.content?.totalSum) {
     return parseFloat(lv.content.totalSum) || 0;
   }
   
   // Fallback: Positionen summieren
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
  // eslint-disable-next-line no-unused-vars
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
    const grandTotal = total * 1.05 * 1.19; // Mit allen Zuschlägen
    
    const response = await fetch(apiUrl(`/api/projects/${projectId}/budget-optimization`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentTotal: grandTotal,
        targetBudget: project.budget, // Jetzt haben wir project.budget!
        lvBreakdown: lvs.map(lv => ({
          tradeCode: lv.trade_code,
          tradeName: lv.trade_name,
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

  const OptimizationsList = ({ optimizations }) => (
    <div className="mt-6 bg-white rounded-lg p-6">
      <h4 className="text-lg font-bold text-gray-800 mb-4">
        Einsparmöglichkeiten (Potenzial: {formatCurrency(optimizations.totalPossibleSaving)})
      </h4>
      
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

      
  const handleExportPDF = async (tradeId, withPrices = true) => {
    try {
      const url = apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv.pdf?withPrices=${withPrices}`);
      
      // Öffne PDF in neuem Tab
      window.open(url, '_blank');
      
    } catch (err) {
      alert('PDF-Export fehlgeschlagen: ' + err.message);
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
                                  unitPrice: 0
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
    {/* Einzelne Gewerke */}
    {lvs.map((lv, idx) => (
      <div key={idx} className="flex justify-between text-white">
        <span className="text-gray-300">{lv.trade_name || lv.name || lv.trade_code}</span>
        <span className="font-medium">
          {formatCurrency(calculateTotal(lv))}
        </span>
      </div>
    ))}
    
    {/* Berechnungen */}
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
  <button
    onClick={() => {
      sessionStorage.setItem('addingAdditionalTrade', 'true');
      navigate(`/project/${projectId}/add-trade?additional=true`);
    }}
    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
  >
    <span className="text-xl mr-2">+</span> Weiteres Gewerk hinzufügen
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
