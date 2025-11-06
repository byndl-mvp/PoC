import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle, Info, ChevronRight, ChevronDown, X } from 'lucide-react';

// ============================================================================
// HAUPT-KOMPONENTE: TERMINPLAN-TAB FÜR BAUHERREN
// ============================================================================

export default function ScheduleTab({ project, apiUrl, onReload }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInitModal, setShowInitModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const editMode = true;
  const [adjustedEntries, setAdjustedEntries] = useState({});
  const [showExplanations, setShowExplanations] = useState(true);
  const [changeRequests, setChangeRequests] = useState([]);
  const [expandedTrades, setExpandedTrades] = useState({});

  useEffect(() => {
    loadSchedule();
  }, [project.id]); // eslint-disable-line

  // NEU: Auto-expand für Multi-Phase Gewerke
useEffect(() => {
  if (schedule?.entries) {
    const grouped = groupEntriesByTrade(schedule.entries);
    const expanded = {};
    grouped.forEach(trade => {
      // Automatisch ausklappen wenn > 1 Einsatz
      expanded[trade.trade_code] = trade.entries.length > 1;
    });
    setExpandedTrades(expanded);
  }
}, [schedule]); // eslint-disable-line

// Polling während Generierung
useEffect(() => {
  if (!generating) return;
  
  console.log('🟡 Starting poll interval...');
  
const pollInterval = setInterval(async () => {
  console.log('📡 Polling...');
  try {
    const res = await fetch(apiUrl(`/api/projects/${project.id}/schedule`));
    
    if (res.ok) {
      const data = await res.json();
      console.log('📊 Status:', data.status);
      
      // Wenn Status sich geändert hat (nicht mehr 'draft'), ist Generierung fertig
      if (data.status !== 'draft') {
        console.log('✅ Generierung fertig!');
        setGenerating(false);
        clearInterval(pollInterval);
        
        // Force reload
        await loadSchedule();
        
        // Kurz warten, dann Approval Modal
        setTimeout(() => {
          setShowApprovalModal(true);
        }, 500);
      }
    }
  } catch (err) {
    console.error('Polling error:', err);
  }
}, 3000);

return () => clearInterval(pollInterval);
}, [generating, project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const loadSchedule = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/projects/${project.id}/schedule`));
      
      if (res.status === 404) {
        // Kein Terminplan vorhanden
        setSchedule(null);
      } else if (res.ok) {
        const data = await res.json();
        setSchedule(data);
        
        // Lade offene Change Requests
        if (data.status === 'locked' || data.status === 'active') {
          loadChangeRequests();
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadChangeRequests = async () => {
    try {
      const res = await fetch(apiUrl(`/api/projects/${project.id}/schedule/change-requests`));
      if (res.ok) {
        const data = await res.json();
        setChangeRequests(data.filter(r => r.status === 'pending'));
      }
    } catch (err) {
      console.error('Fehler beim Laden der Anfragen:', err);
    }
  };

  // Prüfe ob Projekt für Terminplan geeignet ist (mind. 2 Gewerke)
  const isEligibleForSchedule = () => {
    const tradeCount = project.trades?.filter(t => t.code !== 'INT').length || 0;
    return tradeCount >= 2;
  };

  const handleInitiate = async (targetDate, dateType) => {
  try {
    console.log('🚀 Starte Generierung...');
    console.log('📊 Aktueller Schedule State:', schedule);
    console.log('📊 Project ID:', project.id);
    console.log('📊 Target Date:', targetDate, 'Type:', dateType);
    
    setGenerating(true);
    
    // SCHRITT 1: Initiieren (OHNE DELETE)
    console.log('📝 Sende Initiate Request...');
    const initRes = await fetch(apiUrl(`/api/projects/${project.id}/schedule/initiate`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetDate, dateType })
    });
    
    console.log('📥 Initiate Response Status:', initRes.status);
    
    if (!initRes.ok) {
      const error = await initRes.json();
      console.error('❌ Initiate error:', error);
      console.error('📋 Full error object:', JSON.stringify(error, null, 2));
      alert('Fehler beim Erstellen: ' + JSON.stringify(error));
      setGenerating(false);
      setShowInitModal(false);
      return;
    }
    
    console.log('✅ Initiierung erfolgreich, starte Generate...');
    
    // Schritt 2: Generieren STARTEN (warten NICHT auf Response!)
    fetch(apiUrl(`/api/projects/${project.id}/schedule/generate`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch(err => {
      console.error('❌ Generate error:', err);
      alert('Fehler bei der Generierung');
      setGenerating(false);
    });
    
    console.log('⏳ Polling überwacht jetzt die Generierung...');
    
  } catch (err) {
    console.error('❌ Fehler:', err);
    alert('Ein Fehler ist aufgetreten');
    setGenerating(false);
  }
};

  const handleApprove = async (notes) => {
    try {
      setLoading(true);
      
      const adjustments = Object.values(adjustedEntries).filter(e => e.changed);
      
      const res = await fetch(apiUrl(`/api/schedules/${schedule.id}/approve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bauherrId: project.bauherr_id,
          notes,
          adjustedEntries: adjustments
        })
      });
      
      if (res.ok) {
        setShowApprovalModal(false);
        setAdjustedEntries({});
        await loadSchedule();
        alert('✅ Terminplan freigegeben! Die Handwerker wurden benachrichtigt.');
      } else {
        const error = await res.json();
        alert('Fehler: ' + error.error);
      }
    } catch (err) {
      console.error('Fehler:', err);
      alert('Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEntry = async (entryId, newStart, newEnd, cascadeChanges = true) => {
    try {
      const res = await fetch(apiUrl(`/api/schedule-entries/${entryId}/update`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStart,
          newEnd,
          reason: 'Anpassung durch Bauherr',
          bauherrId: project.bauherr_id,
          cascadeChanges
        })
      });
      
      if (res.ok) {
        await loadSchedule();
        alert('✅ Termine aktualisiert');
      } else {
        const error = await res.json();
        alert('Fehler: ' + error.error);
      }
    } catch (err) {
      console.error('Fehler:', err);
      alert('Ein Fehler ist aufgetreten');
    }
  };

  const handleResolveChangeRequest = async (requestId, decision, rejectionReason) => {
    try {
      const res = await fetch(apiUrl(`/api/schedule-change-requests/${requestId}/resolve`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bauherrId: project.bauherr_id,
          decision,
          rejectionReason,
          cascadeChanges: true
        })
      });
      
      if (res.ok) {
        await loadSchedule();
        await loadChangeRequests();
        alert(decision === 'approved' ? '✅ Terminänderung genehmigt' : '❌ Terminänderung abgelehnt');
      } else {
        const error = await res.json();
        alert('Fehler: ' + error.error);
      }
    } catch (err) {
      console.error('Fehler:', err);
      alert('Ein Fehler ist aufgetreten');
    }
  };

  // Gruppiere Entries nach Trade
  const groupEntriesByTrade = (entries) => {
    const grouped = {};
    entries?.forEach(entry => {
      const key = entry.trade_code;
      if (!grouped[key]) {
        grouped[key] = {
          trade_code: entry.trade_code,
          trade_name: entry.trade_name,
          entries: []
        };
      }
      grouped[key].entries.push(entry);
    });
    return Object.values(grouped);
  };

  // Helper: Finde Dependencies zwischen Gewerken
const findDependencies = (entries) => {
  const deps = [];
  
  if (!entries || entries.length === 0) return deps;
  
  entries.forEach(targetEntry => {
    if (!targetEntry.dependencies || targetEntry.dependencies.length === 0) return;
    
    targetEntry.dependencies.forEach(depTradeCode => {
      // Finde alle Entries des abhängigen Trades
      const sourceEntries = entries.filter(e => e.trade_code === depTradeCode);
      
      if (sourceEntries.length > 0) {
        // Nimm die LETZTE Phase (höchste phase_number)
        const lastPhase = sourceEntries.reduce((latest, current) => {
          return (current.phase_number > latest.phase_number) ? current : latest;
        });
        
        deps.push({
          from: lastPhase,
          to: targetEntry
        });
      }
    });
  });
  
  return deps;
};
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Terminplan wird geladen...</p>
        </div>
      </div>
    );
  }

  // Kein Terminplan vorhanden
  if (!schedule) {
    return (
      <div className="space-y-6">
        {/* Info-Box */}
        <div className="bg-gradient-to-r from-blue-600/20 to-teal-600/20 backdrop-blur-md rounded-xl p-6 border border-blue-500/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-6 h-6 text-blue-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white mb-2">KI-gestützte Terminplanung</h3>
              <p className="text-gray-300 text-sm mb-4">
                Lassen Sie einen professionellen Bauablaufplan von unserer KI erstellen. 
                Der Terminplan berücksichtigt automatisch alle Gewerke-Abhängigkeiten und optimiert 
                die Koordination zwischen den Handwerkern.
              </p>
              
              {isEligibleForSchedule() ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>{project.trades?.filter(t => t.code !== 'INT').length} Gewerke erkannt</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Schnittstellen-Analyse automatisch</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>Puffer nach Komplexität</span>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-3">
                  <p className="text-yellow-300 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Mindestens 2 Gewerke erforderlich für Terminplanung</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CTA Button */}
{isEligibleForSchedule() && (
  <div className="text-center">
    <button
      onClick={() => setShowInitModal(true)}
      disabled={!project.lvStatus?.allCompleted}
      className={`px-8 py-4 text-lg font-bold rounded-lg transition-all flex items-center gap-3 mx-auto ${
        project.lvStatus?.allCompleted
          ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white hover:shadow-2xl transform hover:scale-105 cursor-pointer'
          : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
      }`}
    >
      <Calendar className="w-6 h-6" />
      {project.lvStatus?.allCompleted ? 'Zur KI-Terminplanung' : 'LVs müssen erst fertiggestellt werden'}
    </button>
    {project.lvStatus?.allCompleted && (
      <p className="text-gray-400 text-sm mt-3">Dauert je nach Komplexität Ihres Projekts 3-5 Minuten</p>
    )}
  </div>
)}

{/* Generierungs-Modal */}
{(() => {
  console.log('🔍 MODAL CHECK:', {
    condition: schedule?.status === 'draft',
    schedule: schedule,
    status: schedule?.status
  });
  
  if (schedule?.status === 'draft') {
    console.log('✅ MODAL WIRD GERENDERT!');
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full mx-4 border border-white/20">
          <div className="text-center">
            <div className="w-20 h-20 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h3 className="text-2xl font-bold text-white mb-4">Terminplan wird generiert...</h3>
            <p className="text-gray-300 mb-6">
              Die KI erstellt gerade Ihren individuellen Bauablaufplan. Dies kann einige Minuten dauern.
            </p>
            <p className="text-sm text-gray-400">
              Bitte warten Sie - die Generierung läuft im Hintergrund.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
})()}

{/* Initiierungs-Modal */}
{!schedule && showInitModal && (
  <InitiateScheduleModal
    onClose={() => setShowInitModal(false)}
    onSubmit={handleInitiate}
  />
)}
    </div>
    );
  }
  
  // Terminplan vorhanden - verschiedene Ansichten je nach Status
  const aiData = schedule.ai_response || {};
  const groupedTrades = groupEntriesByTrade(schedule.entries);

  return (
    <div className="space-y-6">
      {/* Header mit Status */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Terminplan</h2>
            <div className="flex items-center gap-3">
              <StatusBadge status={schedule.status} />
              {schedule.complexity_level && (
                <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-sm">
                  Komplexität: {schedule.complexity_level}
                </span>
              )}
              {schedule.total_duration_days && (
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {schedule.total_duration_days} Arbeitstage
                </span>
              )}
            </div>
          </div>
          
          {schedule.status === 'pending_approval' && (
            <button
              onClick={() => setShowApprovalModal(true)}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white font-bold rounded-lg hover:shadow-xl transition-all"
            >
              Terminplan freigeben
            </button>
          )}
        </div>

        {/* KI-Erklärung (nur bei pending_approval prominent) */}
        {schedule.status === 'pending_approval' && aiData.general_explanation && (
          <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-purple-300 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-purple-200 font-semibold mb-1">KI-Analyse:</p>
                <p className="text-gray-300 text-sm">{aiData.general_explanation}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Offene Terminänderungs-Anfragen */}
      {changeRequests.length > 0 && (
        <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 backdrop-blur-md rounded-xl p-6 border border-orange-500/30">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-orange-300" />
            <h3 className="text-lg font-bold text-white">
              {changeRequests.length} offene Terminänderungs-Anfrage{changeRequests.length > 1 ? 'n' : ''}
            </h3>
          </div>
          
          <div className="space-y-3">
            {changeRequests.map(request => (
              <ChangeRequestCard
                key={request.id}
                request={request}
                onResolve={handleResolveChangeRequest}
              />
            ))}
          </div>
        </div>
      )}

      {/* Warnungen & Empfehlungen (ausklappbar) */}
      {(aiData.warnings?.length > 0 || aiData.recommendations?.length > 0) && (
        <div className="bg-white/5 rounded-lg border border-white/20">
          <button
            onClick={() => setShowExplanations(!showExplanations)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <span className="text-white font-semibold">KI-Hinweise & Empfehlungen</span>
            {showExplanations ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
          </button>
          
          {showExplanations && (
            <div className="px-4 pb-4 space-y-3">
              {aiData.warnings?.map((warning, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span className="text-yellow-200">{warning}</span>
                </div>
              ))}
              
              {aiData.recommendations?.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-blue-200">{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gantt-Chart Balkenplan */}
      <GanttChart
        entries={schedule.entries}
        groupedTrades={groupedTrades}
        editMode={editMode && schedule.status !== 'pending_approval'}
        onUpdateEntry={handleUpdateEntry}
        expandedTrades={expandedTrades}
        onToggleTrade={(code) => setExpandedTrades(prev => ({ ...prev, [code]: !prev[code] }))}
        findDependencies={findDependencies}
      />

      {/* Approval Modal */}
      {showApprovalModal && (
        <ApprovalModal
          schedule={schedule}
          aiData={aiData}
          groupedTrades={groupedTrades}
          onClose={() => setShowApprovalModal(false)}
          onApprove={handleApprove}
          adjustedEntries={adjustedEntries}
          setAdjustedEntries={setAdjustedEntries}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: INITIIERUNGS-MODAL
// ============================================================================

function InitiateScheduleModal({ onClose, onSubmit, generating }) {
  const [dateType, setDateType] = useState('start'); // 'start' oder 'end'
  const [selectedDate, setSelectedDate] = useState('');

  const handleSubmit = () => {
    if (!selectedDate) {
      alert('Bitte wählen Sie ein Datum');
      return;
    }
    onSubmit(selectedDate, dateType === 'start' ? 'start_date' : 'end_date');
  };

  // Mindestdatum: heute + 7 Tage
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-lg w-full p-8 border border-white/20 my-auto">
        <h3 className="text-2xl font-bold text-white mb-6">Terminplanung starten</h3>
        
        {!generating ? (
          <>
            <p className="text-gray-300 mb-6">
              Wählen Sie, ob Sie einen gewünschten <strong>Starttermin</strong> oder 
              einen gewünschten <strong>Fertigstellungstermin</strong> vorgeben möchten.
            </p>

            {/* Auswahl: Start oder Ende */}
            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/20 cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="radio"
                  name="dateType"
                  value="start"
                  checked={dateType === 'start'}
                  onChange={(e) => setDateType(e.target.value)}
                  className="w-5 h-5"
                />
                <div>
                  <p className="text-white font-semibold">Gewünschter Starttermin</p>
                  <p className="text-gray-400 text-sm">Die KI plant vorwärts vom Startdatum</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 bg-white/5 rounded-lg border border-white/20 cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="radio"
                  name="dateType"
                  value="end"
                  checked={dateType === 'end'}
                  onChange={(e) => setDateType(e.target.value)}
                  className="w-5 h-5"
                />
                <div>
                  <p className="text-white font-semibold">Gewünschter Fertigstellungstermin</p>
                  <p className="text-gray-400 text-sm">Die KI plant rückwärts zur Fertigstellung</p>
                </div>
              </label>
            </div>

            {/* Datumsauswahl */}
            <div className="mb-6">
              <label className="block text-white font-semibold mb-2">
                {dateType === 'start' ? 'Startdatum wählen' : 'Fertigstellungsdatum wählen'}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={minDateStr}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-gray-400 text-xs mt-2">
                Mindestens 7 Tage in der Zukunft
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white font-bold rounded-lg hover:shadow-xl transition-all"
              >
                KI-Terminplan erstellen
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-20 h-20 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h4 className="text-xl font-bold text-white mb-3">Terminplan wird generiert...</h4>
            <p className="text-gray-300 mb-2">Die KI analysiert:</p>
            <ul className="text-gray-400 text-sm space-y-2">
              <li>✓ Gewerke-Abhängigkeiten</li>
              <li>✓ Kritische Schnittstellen</li>
              <li>✓ Optimale Reihenfolge</li>
              <li>✓ Puffer-Berechnung</li>
            </ul>
            <p className="text-gray-500 text-xs mt-4">Dies kann je nach Komplexität 3-5 Minuten dauern</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: APPROVAL MODAL (Freigabe-Ansicht)
// ============================================================================

function ApprovalModal({ schedule, aiData, groupedTrades, onClose, onApprove, adjustedEntries, setAdjustedEntries }) {
  const [notes, setNotes] = useState('');
  const [showDetails, setShowDetails] = useState({});

  const handleAdjustEntry = (entryId, field, value) => {
    setAdjustedEntries(prev => ({
      ...prev,
      [entryId]: {
        ...prev[entryId],
        id: entryId,
        [field]: value,
        changed: true
      }
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-5xl w-full my-8 border border-white/20">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 p-6 border-b border-white/10 backdrop-blur">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Terminplan freigeben</h3>
              <p className="text-gray-300 text-sm">
                Prüfen Sie den KI-generierten Terminplan und passen Sie bei Bedarf einzelne Termine an
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* KI-Erklärung */}
          {aiData.general_explanation && (
            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border border-purple-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-purple-300 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-purple-200 font-semibold mb-1">KI-Analyse:</p>
                  <p className="text-gray-300 text-sm">{aiData.general_explanation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Gewerke-Liste */}
          <div className="space-y-4">
            <h4 className="text-lg font-bold text-white">Geplante Gewerke ({groupedTrades.length})</h4>
            
            {groupedTrades.map(trade => (
              <div key={trade.trade_code} className="bg-white/5 rounded-lg border border-white/10">
                <button
                  onClick={() => setShowDetails(prev => ({ ...prev, [trade.trade_code]: !prev[trade.trade_code] }))}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                      {trade.trade_code.substring(0, 2)}
                    </div>
                    <div className="text-left">
                      <p className="text-white font-semibold">{trade.trade_name}</p>
                      <p className="text-gray-400 text-sm">
                        {trade.entries.length} {trade.entries.length === 1 ? 'Einsatz' : 'Einsätze'}
                      </p>
                    </div>
                  </div>
                  {showDetails[trade.trade_code] ? 
                    <ChevronDown className="w-5 h-5 text-gray-400" /> : 
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  }
                </button>

                {showDetails[trade.trade_code] && (
                  <div className="px-4 pb-4 space-y-3">
                    {trade.entries.map(entry => (
                      <div key={entry.id} className="bg-white/10 rounded-lg p-4 border border-white/10">
                        {/* Phase Name */}
                        {entry.phase_name && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">
                              Phase {entry.phase_number}
                            </span>
                            <span className="text-white font-medium">{entry.phase_name}</span>
                          </div>
                        )}

                        {/* Termine */}
                        <div className="grid md:grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-gray-400 text-xs mb-1">Start</label>
                            <input
                              type="date"
                              defaultValue={entry.planned_start}
                              onChange={(e) => handleAdjustEntry(entry.id, 'planned_start', e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 text-xs mb-1">Ende</label>
                            <input
                              type="date"
                              defaultValue={entry.planned_end}
                              onChange={(e) => handleAdjustEntry(entry.id, 'planned_end', e.target.value)}
                              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm"
                            />
                          </div>
                        </div>

                        {/* KI-Erklärungen */}
                        <div className="space-y-2 text-sm">
                          {entry.scheduling_reason && (
                            <div className="flex items-start gap-2">
                              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-300">{entry.scheduling_reason}</span>
                            </div>
                          )}
                          
                          {entry.buffer_days > 0 && entry.buffer_reason && (
                            <div className="flex items-start gap-2">
                              <Clock className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                              <span className="text-gray-300">
                                {entry.buffer_days} Tag{entry.buffer_days > 1 ? 'e' : ''} Puffer: {entry.buffer_reason}
                              </span>
                            </div>
                          )}
                          
                          {entry.risks && (
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                              <span className="text-yellow-200">{entry.risks}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Warnungen */}
          {aiData.warnings?.length > 0 && (
            <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <h5 className="text-yellow-300 font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Wichtige Hinweise
              </h5>
              <ul className="space-y-2">
                {aiData.warnings.map((warning, idx) => (
                  <li key={idx} className="text-yellow-200 text-sm flex items-start gap-2">
                    <span>•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Empfehlungen */}
          {aiData.recommendations?.length > 0 && (
            <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <h5 className="text-blue-300 font-semibold mb-2 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Empfehlungen
              </h5>
              <ul className="space-y-2">
                {aiData.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-blue-200 text-sm flex items-start gap-2">
                    <span>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Anmerkungen */}
          <div className="mt-6">
            <label className="block text-white font-semibold mb-2">
              Ihre Anmerkungen (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows="3"
              placeholder="Zusätzliche Hinweise oder Anforderungen..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur p-6 border-t border-white/10">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={() => onApprove(notes)}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white font-bold rounded-lg hover:shadow-xl transition-all"
            >
              ✓ Terminplan freigeben
            </button>
          </div>
          {Object.keys(adjustedEntries).length > 0 && (
            <p className="text-center text-yellow-300 text-sm mt-3">
              ⚠️ Sie haben {Object.keys(adjustedEntries).length} Termin{Object.keys(adjustedEntries).length > 1 ? 'e' : ''} angepasst
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: GANTT-CHART BALKENPLAN - KORRIGIERT
// ============================================================================

function GanttChart({ entries, groupedTrades, editMode, onUpdateEntry, expandedTrades, onToggleTrade, findDependencies }) {
  // ✅ ZENTRALISIERTER MODAL-STATE (nur EINE Instanz für alle Balken)
  const [editingEntry, setEditingEntry] = useState(null);
  
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-8 text-center">
        <p className="text-gray-400">Keine Termine vorhanden</p>
      </div>
    );
  }
  
  // Finde frühestes Start- und spätestes Enddatum
  const allDates = entries.map(e => [new Date(e.planned_start), new Date(e.planned_end)]).flat();
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  
  // Berechne Gesamtspanne in Tagen
  const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
  
  // Erstelle Tages-Grid
  const dateMarkers = [];
  let currentMarker = new Date(minDate);
  while (currentMarker <= maxDate) {
    dateMarkers.push(new Date(currentMarker));
    currentMarker.setDate(currentMarker.getDate() + 10);
  }

  // Gewerke-Farben
  const tradeColors = [
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600',
    'from-purple-500 to-purple-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600',
    'from-teal-500 to-teal-600',
    'from-indigo-500 to-indigo-600',
    'from-red-500 to-red-600',
    'from-yellow-500 to-yellow-600',
    'from-cyan-500 to-cyan-600'
  ];

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">Bauablauf-Zeitplan</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-300">
            <strong className="text-white">{new Date(minDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}</strong> bis <strong className="text-white">{new Date(maxDate).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-teal-300 font-semibold">{totalDays} Tage</span>
        </div>
      </div>

      {/* Timeline Header */}
      <div className="mb-2 pb-4 border-b border-white/10">
        <div className="flex min-w-max">
          <div className="w-64 flex-shrink-0"></div>
          <div className="flex-1 relative" style={{ height: '50px' }}>
            {dateMarkers.map((date, idx) => {
              const position = ((date - minDate) / (1000 * 60 * 60 * 24) / totalDays) * 100;
              return (
                <div 
                  key={idx} 
                  className="absolute"
                  style={{ left: `${position}%`, transform: 'translateX(-50%)', minWidth: '60px' }}
                >
                  <div className="text-center">
                    <div className="text-sm font-bold text-white whitespace-nowrap">
                      KW {getWeekNumber(date)}
                    </div>
                    <div className="text-xs text-gray-300 whitespace-nowrap">
                      {date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <div className="w-px h-4 bg-white/20 mx-auto mt-1"></div>
                </div>
              );
            })}
          </div>
          <div className="w-32 flex-shrink-0"></div>
        </div>
      </div>
      
      {/* Balken */}
      <div className="space-y-3 overflow-x-auto">
        {/* Wrapper mit position: relative für SVG */}
        <div className="relative min-w-max" style={{ minHeight: `${groupedTrades.length * 100}px` }}>

          {/* Balken-Liste */}
          {groupedTrades.map((trade, tradeIdx) => (
            <div key={trade.trade_code} className="min-w-max relative mb-4" style={{ 
              minHeight: expandedTrades[trade.trade_code] ? `${trade.entries.length * 90}px` : '90px'
            }}>
              {/* Trade Header */}
              <button
                onClick={() => onToggleTrade(trade.trade_code)}
                className="w-full flex items-center gap-3 py-3 px-4 hover:bg-white/5 rounded-lg transition-colors"
              >
                <div className={`w-10 h-10 bg-gradient-to-br ${tradeColors[tradeIdx % tradeColors.length]} rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-lg`}>
                  {trade.trade_code.substring(0, 2)}
                </div>
                <span className="text-white font-bold text-lg">{trade.trade_name}</span>
                <span className="text-gray-400 text-sm ml-2">({trade.entries.length} {trade.entries.length === 1 ? 'Einsatz' : 'Einsätze'})</span>
                {expandedTrades[trade.trade_code] ? 
                  <ChevronDown className="w-5 h-5 text-gray-400 ml-auto" /> : 
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
                }
              </button>

              {/* Phasen */}
             {expandedTrades[trade.trade_code] && trade.entries.map(entry => (
                <GanttBar
                  key={entry.id}
                  entry={entry}
                  minDate={minDate}
                  totalDays={totalDays}
                  editMode={editMode}
                  onEdit={() => setEditingEntry(entry)}
                  color={tradeColors[tradeIdx % tradeColors.length]}
                />
              ))}
              
              {/* Gesamtbalken (collapsed) */}
             {!expandedTrades[trade.trade_code] && (
                <GanttBar
                  entry={trade.entries[0]}
                  minDate={minDate}
                  totalDays={totalDays}
                  editMode={false}
                  onEdit={() => {}}
                  isSummary={true}
                  allEntries={trade.entries}
                  color={tradeColors[tradeIdx % tradeColors.length]}
                />
              )}
            </div>
          ))}
          
        </div>
      </div>
      
      {/* Legende */}
      <div className="mt-6 bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-white font-semibold">Legende</h4>
          <p className="text-teal-300 text-sm flex items-center gap-2">
            <Info className="w-4 h-4" />
            Klicken Sie auf Balken zum Bearbeiten
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          {/* Normale Arbeit */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded shadow"></div>
            <span className="text-gray-300">Reguläre Bauleistung</span>
          </div>
          
          {/* Puffer */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-6 flex">
              <div className="w-8 h-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-l shadow"></div>
              <div className="w-4 h-6 bg-blue-500/30 rounded-r" style={{
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255, 255, 255, 0.1) 2px, rgba(255, 255, 255, 0.1) 4px)`
              }}></div>
            </div>
            <span className="text-gray-300">+ Puffer-Tage</span>
          </div>
        </div>
      </div>

      {/* ZENTRALISIERTES MODAL - nur EINES für alle Balken */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={(newStart, newEnd, cascade) => {
            onUpdateEntry(editingEntry.id, newStart, newEnd, cascade);
            setEditingEntry(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: EINZELNER GANTT-BALKEN 
// ============================================================================

function GanttBar({ entry, minDate, totalDays, editMode, onEdit, isSummary, allEntries, color }) {

  const isMinorWork = entry.is_minor_work === true;
  
  const calculatePosition = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startOffset = Math.ceil((startDate - minDate) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    
    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`
    };
  };

  const position = isSummary && allEntries 
    ? calculatePosition(
        Math.min(...allEntries.map(e => new Date(e.planned_start))),
        Math.max(...allEntries.map(e => new Date(e.planned_end)))
      )
    : calculatePosition(entry.planned_start, entry.planned_end);

  const workdays = calculateWorkdays(entry.planned_start, entry.planned_end);
  const bufferDays = entry.buffer_days || 0;
  
  return (
    <>
      <div className="flex items-start py-3 relative group pointer-events-auto">
        {/* Linke Spalte */}
        <div className="w-64 flex-shrink-0 pl-14">
          {entry.phase_name && (
            <div className="pt-2">
              <span className="text-white text-sm font-semibold block">
                {entry.phase_name}
              </span>
              <span className="text-gray-400 text-xs">
                {workdays} {workdays === 1 ? 'Tag' : 'Tage'}
                {bufferDays > 0 && ` + ${bufferDays} ${bufferDays === 1 ? 'Tag' : 'Tage'} Puffer`}
              </span>
            </div>
          )}
        </div>
        
        {/* Balken-Bereich - IMMER normaler Balken */}
        <div className="flex-1 relative">
          <div
            data-entry-id={entry.id} 
            onClick={() => {
              if (editMode && onEdit) {
                onEdit();
              }
            }}
            className={`absolute rounded-lg shadow-lg ${
              editMode ? 'cursor-pointer hover:shadow-2xl hover:scale-105' : 'cursor-default'
            } transition-all`}
            title={isMinorWork ? 'Kleine Arbeit - läuft parallel' : (editMode ? 'Klicken zum Bearbeiten' : '')}
            style={{ 
              ...position, 
              height: '40px',
              top: '0',
              opacity: isMinorWork ? 0.75 : 1
            }}
          >
          <div className={`h-full rounded-lg relative overflow-hidden bg-gradient-to-r ${color}`} style={{ pointerEvents: 'all' }}>
              {/* Status-Indicator */}
              {entry.confirmed && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-green-400 rounded-full border-2 border-white" style={{ pointerEvents: 'none' }}></div>
              )}
              
              {/* Puffer */}
              {bufferDays > 0 && (
                <div 
                  className="absolute right-0 top-0 bottom-0 flex items-center justify-center rounded-r-lg"
                  style={{
                    width: `${(bufferDays / (workdays + bufferDays)) * 100}%`,
                    background: 'rgba(255, 255, 255, 0.2)',
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 8px)',
                    borderLeft: '2px dashed rgba(255, 255, 255, 0.3)',
                    pointerEvents: 'none'
                  }}
                >
                  <span className="text-white text-[10px] font-bold opacity-80">
                    +{bufferDays}d
                  </span>
                </div>
              )}
              
              {/* Minor Work Badge */}
              {isMinorWork && (
                <div className="absolute top-1 left-2" style={{ pointerEvents: 'none' }}>
                  <span className="text-xs bg-white/20 backdrop-blur px-1.5 py-0.5 rounded text-white font-medium">
                    parallel
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Datum */}
          <div className="absolute text-center text-white text-xs font-semibold whitespace-nowrap" style={{ ...position, top: '45px' }}>
            {new Date(entry.planned_start).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} - {new Date(entry.planned_end).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
          </div>
        </div>

        {/* Status Badge */}
        <div className="w-32 flex-shrink-0 flex justify-end pt-2">
          {entry.confirmed ? (
            <span className="px-3 py-1 bg-green-500/20 text-green-300 rounded-full text-xs font-semibold flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Bestätigt
            </span>
          ) : entry.status === 'change_requested' ? (
            <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-xs font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Änderung
            </span>
          ) : (
            <span className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded-full text-xs">
              Ausstehend
            </span>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// SUB-KOMPONENTE: TERMIN BEARBEITEN MODAL
// ============================================================================

function EditEntryModal({ entry, onClose, onSave }) {
  const [newStart, setNewStart] = useState(entry.planned_start);
  const [newEnd, setNewEnd] = useState(entry.planned_end);
  const [cascade, setCascade] = useState(true);

  // VALIDIERUNG: Endtermin automatisch anpassen wenn Start > Ende
  const handleStartChange = (value) => {
    setNewStart(value);
    // Wenn neuer Start nach aktuellem Ende liegt, Ende auch anpassen
    if (value > newEnd) {
      setNewEnd(value);
    }
  };

  const handleEndChange = (value) => {
    // Wenn neues Ende vor Start liegt, auf Start setzen
    if (value < newStart) {
      setNewEnd(newStart);
    } else {
      setNewEnd(value);
    }
  };

  // VALIDIERUNG: Speichern nur wenn Start <= Ende
  const isValid = newStart <= newEnd;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl max-w-md w-full p-6 border border-white/20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xl font-bold text-white">Termin anpassen</h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Schließen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-white font-semibold mb-2">Neuer Start</label>
            <input
              type="date"
              value={newStart}
              onChange={(e) => handleStartChange(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>
          
          <div>
            <label className="block text-white font-semibold mb-2">Neues Ende</label>
            <input
              type="date"
              value={newEnd}
              onChange={(e) => handleEndChange(e.target.value)}
              min={newStart}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>

          {/* VALIDIERUNGS-HINWEIS */}
          {!isValid && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Endtermin muss nach dem Starttermin liegen
              </p>
            </div>
          )}
          
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={cascade}
              onChange={(e) => setCascade(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-gray-300">Folgetermine automatisch verschieben</span>
          </label>
        </div>

{entry.is_minor_work && (
  <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
    <h5 className="text-blue-300 font-semibold mb-2 flex items-center gap-2">
      <Info className="w-4 h-4" />
      Parallelarbeit
    </h5>
    <p className="text-blue-200 text-sm">
      Diese kleine Arbeit kann parallel zu anderen Gewerken ausgeführt werden, 
      da sie räumlich getrennt ist oder nur wenig Koordination erfordert.
    </p>
  </div>
)}
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Abbrechen
          </button>
         <button
            onClick={() => onSave(newStart, newEnd, cascade)}
            disabled={!isValid}
            className={`flex-1 px-4 py-2 rounded-lg ${
              isValid 
                ? 'bg-teal-600 text-white hover:bg-teal-700 cursor-pointer' 
                : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
            }`}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: CHANGE REQUEST CARD
// ============================================================================

function ChangeRequestCard({ request, onResolve }) {
  const [showDetails, setShowDetails] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Bitte geben Sie einen Ablehnungsgrund an');
      return;
    }
    onResolve(request.id, 'rejected', rejectionReason);
    setShowRejectInput(false);
  };

  const urgencyColors = {
    low: 'text-gray-400',
    normal: 'text-blue-400',
    high: 'text-orange-400',
    critical: 'text-red-400'
  };

  const urgencyLabels = {
    low: 'Niedrig',
    normal: 'Normal',
    high: 'Hoch',
    critical: 'Dringend'
  };

  return (
    <div className="bg-white/5 rounded-lg border border-orange-500/30 p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-white font-semibold">{request.trade_name}</h4>
            {request.phase_name && (
              <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                {request.phase_name}
              </span>
            )}
            <span className={`px-2 py-1 rounded text-xs font-semibold ${urgencyColors[request.urgency]}`}>
              {urgencyLabels[request.urgency]}
            </span>
          </div>
          
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>Von: {request.company_name}</span>
            <span>•</span>
            <span>{new Date(request.created_at).toLocaleDateString('de-DE')}</span>
          </div>
        </div>

        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-gray-400 hover:text-white"
        >
          {showDetails ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>
      </div>

      {/* Kompakte Info immer sichtbar */}
      <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
        <div>
          <span className="text-gray-400">Alt:</span>
          <span className="text-white ml-2">
            {new Date(request.current_start).toLocaleDateString('de-DE')} - 
            {new Date(request.current_end).toLocaleDateString('de-DE')}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Neu:</span>
          <span className="text-white ml-2">
            {new Date(request.requested_start).toLocaleDateString('de-DE')} - 
            {new Date(request.requested_end).toLocaleDateString('de-DE')}
          </span>
        </div>
      </div>

      {/* Details (ausklappbar) */}
      {showDetails && (
        <div className="space-y-3 pt-3 border-t border-white/10">
          {/* Begründung */}
          <div>
            <p className="text-gray-400 text-xs mb-1">Begründung:</p>
            <p className="text-white text-sm bg-white/5 rounded p-2">{request.reason}</p>
          </div>

          {/* Auswirkungen */}
          {request.affects_following_trades && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
              <p className="text-yellow-300 text-sm font-semibold mb-1">
                ⚠️ Betrifft Folgetermine
              </p>
              <p className="text-yellow-200 text-xs">
                Verzögerung: ca. {request.estimated_delay_days} Tag{request.estimated_delay_days > 1 ? 'e' : ''}
              </p>
              {request.affected_trade_names && (
                <p className="text-yellow-200 text-xs mt-1">
                  Betroffene Gewerke: {request.affected_trade_names.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* Ablehnen Input */}
          {showRejectInput && (
            <div>
              <label className="block text-white text-sm font-semibold mb-2">
                Ablehnungsgrund:
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white text-sm"
                rows="3"
                placeholder="Bitte erläutern Sie warum die Terminänderung nicht möglich ist..."
              />
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            {!showRejectInput ? (
              <>
                <button
                  onClick={() => onResolve(request.id, 'approved')}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Genehmigen
                </button>
                <button
                  onClick={() => setShowRejectInput(true)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Ablehnen
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowRejectInput(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Ablehnung bestätigen
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: STATUS BADGE
// ============================================================================

function StatusBadge({ status }) {
  const statusConfig = {
    draft: {
      label: (
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
          <div>
            <div className="font-bold">Terminplan wird generiert...</div>
            <div className="text-xs text-gray-300 mt-0.5">KI erstellt Ihren Bauablaufplan</div>
          </div>
        </div>
      ),
      color: 'bg-gradient-to-r from-teal-500/20 to-blue-500/20 text-white border-teal-500/30',
      icon: '⏳'
    },
    pending_approval: {
      label: 'Wartet auf Freigabe',
      color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      icon: '⏱️'
    },
    locked: {
      label: 'Freigegeben',
      color: 'bg-green-500/20 text-green-300 border-green-500/30',
      icon: '✅'
    },
    active: {
      label: 'Aktiv',
      color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      icon: '🚀'
    },
    completed: {
      label: 'Abgeschlossen',
      color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      icon: '✓'
    }
  };
  
  const config = statusConfig[status] || statusConfig.draft;
  
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${config.color} ${status === 'draft' ? 'animate-pulse' : ''}`}>
      <span className="text-lg">{config.icon}</span>
      {typeof config.label === 'string' ? (
        <span className="font-semibold">{config.label}</span>
      ) : (
        config.label
      )}
    </div>
  );
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function calculateWorkdays(startDate, endDate) {
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

// ============================================================================
// EXPORT
// ============================================================================

export { 
  StatusBadge, 
  ChangeRequestCard, 
  getWeekNumber, 
  calculateWorkdays 
};
