import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle, Edit2, RefreshCw, Users, Info, ChevronRight, ChevronDown, X, Save } from 'lucide-react';

// ============================================================================
// HAUPT-KOMPONENTE: TERMINPLAN-TAB FÜR BAUHERREN
// ============================================================================

export default function ScheduleTab({ project, apiUrl, onReload }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInitModal, setShowInitModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [adjustedEntries, setAdjustedEntries] = useState({});
  const [showExplanations, setShowExplanations] = useState(true);
  const [changeRequests, setChangeRequests] = useState([]);
  const [expandedTrades, setExpandedTrades] = useState({});

  useEffect(() => {
    loadSchedule();
  }, [project.id]); // eslint-disable-line

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
      setGenerating(true);
      
      // Schritt 1: Initiieren
      const initRes = await fetch(apiUrl(`/api/projects/${project.id}/schedule/initiate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate, dateType })
      });
      
      if (!initRes.ok) {
        const error = await initRes.json();
        alert('Fehler: ' + error.error);
        setGenerating(false);
        return;
      }
      
      const initData = await initRes.json();
      
      // Schritt 2: Generieren (kann 10-30 Sekunden dauern)
      const genRes = await fetch(apiUrl(`/api/projects/${project.id}/schedule/generate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!genRes.ok) {
        const error = await genRes.json();
        alert('Fehler bei der Generierung: ' + error.error);
        setGenerating(false);
        return;
      }
      
      const genData = await genRes.json();
      
      setShowInitModal(false);
      setGenerating(false);
      
      // Reload und zeige Approval-Modal
      await loadSchedule();
      setShowApprovalModal(true);
      
    } catch (err) {
      console.error('Fehler:', err);
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
              className="px-8 py-4 bg-gradient-to-r from-teal-500 to-blue-600 text-white text-lg font-bold rounded-lg hover:shadow-2xl transform hover:scale-105 transition-all flex items-center gap-3 mx-auto"
            >
              <Calendar className="w-6 h-6" />
              Zur KI-Terminplanung
            </button>
            <p className="text-gray-400 text-sm mt-3">Dauert ca. 30-60 Sekunden</p>
          </div>
        )}

        {/* Initiierungs-Modal */}
        {showInitModal && (
          <InitiateScheduleModal
            onClose={() => setShowInitModal(false)}
            onSubmit={handleInitiate}
            generating={generating}
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
          
          {(schedule.status === 'active' || schedule.status === 'locked') && (
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              {editMode ? 'Ansichtsmodus' : 'Bearbeitungsmodus'}
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-lg w-full p-8 border border-white/20">
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
                  <p className="text-gray-400 text-sm">Die KI plant rückwärts vom Startdatum</p>
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
                  <p className="text-gray-400 text-sm">Die KI plant vorwärts zur Fertigstellung</p>
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
            <p className="text-gray-500 text-xs mt-4">Dies kann 30-60 Sekunden dauern</p>
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
// SUB-KOMPONENTE: GANTT-CHART BALKENPLAN
// ============================================================================

function GanttChart({ entries, groupedTrades, editMode, onUpdateEntry, expandedTrades, onToggleTrade }) {
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
  
  // Erstelle Wochen-Header
  const weeks = [];
  let currentWeek = new Date(minDate);
  while (currentWeek <= maxDate) {
    weeks.push(new Date(currentWeek));
    currentWeek.setDate(currentWeek.getDate() + 7);
  }

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Bauablauf</h3>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{new Date(minDate).toLocaleDateString('de-DE')} - {new Date(maxDate).toLocaleDateString('de-DE')}</span>
          <span>•</span>
          <span>{totalDays} Tage</span>
        </div>
      </div>

      {/* Wochen-Header */}
      <div className="mb-4 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <div className="w-48 flex-shrink-0"></div>
          {weeks.map((week, idx) => (
            <div key={idx} className="flex-1 min-w-[80px] text-center">
              <div className="text-xs text-gray-400">
                KW {getWeekNumber(week)}
              </div>
              <div className="text-xs text-gray-500">
                {week.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Balken */}
      <div className="space-y-2 overflow-x-auto">
        {groupedTrades.map(trade => (
          <div key={trade.trade_code} className="min-w-max">
            {/* Trade Header */}
            <button
              onClick={() => onToggleTrade(trade.trade_code)}
              className="w-full flex items-center gap-2 py-2 hover:bg-white/5 transition-colors"
            >
              <div className="w-48 flex-shrink-0 flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                  {trade.trade_code.substring(0, 2)}
                </div>
                <span className="text-white font-semibold text-sm">{trade.trade_name}</span>
              </div>
              {expandedTrades[trade.trade_code] ? 
                <ChevronDown className="w-4 h-4 text-gray-400" /> : 
                <ChevronRight className="w-4 h-4 text-gray-400" />
              }
            </button>

            {/* Phasen (wenn expanded) */}
            {expandedTrades[trade.trade_code] && trade.entries.map(entry => (
              <GanttBar
                key={entry.id}
                entry={entry}
                minDate={minDate}
                totalDays={totalDays}
                editMode={editMode}
                onUpdate={onUpdateEntry}
              />
            ))}

            {/* Gesamtbalken (wenn collapsed) */}
            {!expandedTrades[trade.trade_code] && (
              <GanttBar
                entry={trade.entries[0]}
                minDate={minDate}
                totalDays={totalDays}
                editMode={false}
                isSummary={true}
                allEntries={trade.entries}
              />
            )}
          </div>
        ))}
      </div>

      {editMode && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-blue-300 text-sm flex items-center gap-2">
            <Info className="w-4 h-4" />
            Klicken Sie auf einen Balken, um die Termine anzupassen
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: EINZELNER GANTT-BALKEN
// ============================================================================

function GanttBar({ entry, minDate, totalDays, editMode, onUpdate, isSummary, allEntries }) {
  const [showEditModal, setShowEditModal] = useState(false);

  // Berechne Position und Breite des Balkens
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

  const getStatusColor = () => {
    if (entry.status === 'completed') return 'from-green-500 to-emerald-600';
    if (entry.status === 'in_progress') return 'from-blue-500 to-cyan-600';
    if (entry.status === 'change_requested') return 'from-orange-500 to-red-600';
    if (entry.confirmed) return 'from-teal-500 to-blue-600';
    return 'from-gray-500 to-gray-600';
  };

  return (
    <>
      <div className="flex items-center py-2 relative">
        <div className="w-48 flex-shrink-0">
          {entry.phase_name && (
            <span className="text-gray-400 text-xs ml-11">{entry.phase_name}</span>
          )}
        </div>
        
        <div className="flex-1 relative h-8">
          <button
            onClick={() => editMode && setShowEditModal(true)}
            className={`absolute h-full rounded ${editMode ? 'cursor-pointer hover:shadow-lg' : 'cursor-default'} transition-all`}
            style={position}
            disabled={!editMode}
          >
            <div className={`h-full rounded bg-gradient-to-r ${getStatusColor()} flex items-center justify-center px-2`}>
              <span className="text-white text-xs font-semibold truncate">
                {entry.duration_days}d
                {entry.buffer_days > 0 && ` +${entry.buffer_days}d`}
              </span>
            </div>
          </button>
        </div>

        {/* Status-Badge */}
        <div className="w-32 flex-shrink-0 flex justify-end">
          {entry.confirmed ? (
            <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Bestätigt
            </span>
          ) : entry.status === 'change_requested' ? (
            <span className="px-2 py-1 bg-orange-500/20 text-orange-300 rounded text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Änderung
            </span>
          ) : (
            <span className="px-2 py-1 bg-gray-500/20 text-gray-400 rounded text-xs">
              Ausstehend
            </span>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditEntryModal
          entry={entry}
          onClose={() => setShowEditModal(false)}
          onSave={(newStart, newEnd) => {
            onUpdate(entry.id, newStart, newEnd);
            setShowEditModal(false);
          }}
        />
      )}
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl max-w-md w-full p-6 border border-white/20">
        <h4 className="text-xl font-bold text-white mb-4">Termin anpassen</h4>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-white font-semibold mb-2">Neuer Start</label>
            <input
              type="date"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>
          
          <div>
            <label className="block text-white font-semibold mb-2">Neues Ende</label>
            <input
              type="date"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
            />
          </div>

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

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Abbrechen
          </button>
          <button
            onClick={() => onSave(newStart, newEnd, cascade)}
            className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
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
      label: 'Entwurf',
      color: 'bg-gray-500/20 text-gray-300',
      icon: '📝'
    },
    pending_approval: {
      label: 'Wartet auf Freigabe',
      color: 'bg-yellow-500/20 text-yellow-300',
      icon: '⏳'
    },
    active: {
      label: 'Aktiv - Handwerker bestätigen',
      color: 'bg-blue-500/20 text-blue-300',
      icon: '🔄'
    },
    locked: {
      label: 'Gesperrt - Alle Gewerke vergeben',
      color: 'bg-green-500/20 text-green-300',
      icon: '🔒'
    },
    completed: {
      label: 'Abgeschlossen',
      color: 'bg-teal-500/20 text-teal-300',
      icon: '✅'
    }
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${config.color} flex items-center gap-2 inline-flex`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
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
