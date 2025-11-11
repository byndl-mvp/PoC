// ============================================================================
// ERWEITERTE AUSFÜHRUNGSTERMINE-SEKTION FÜR HandwerkerOfferConfirmPage
// ============================================================================
// Zeigt Termine aus Terminplan an, ermöglicht Bestätigung/Anpassung
// Verbesserte UI/UX mit klaren Erklärungen und visuellen Hinweisen
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Info, AlertTriangle, CheckCircle, Edit2, Save, X, ChevronDown, ChevronRight } from 'lucide-react';

// ============================================================================
// HAUPT-KOMPONENTE: AUSFÜHRUNGSTERMINE
// ============================================================================

export default function ExecutionTimesSection({ 
  offerId, 
  formData, 
  setFormData, 
  apiUrl,
  offerStatus,
  onPhasesChange  
}) {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [localPhases, setLocalPhases] = useState([]);
  const [changeReason, setChangeReason] = useState('');
  const [showExplanation, setShowExplanation] = useState(true);

  useEffect(() => {
    loadScheduleDates();
  }, [offerId]); // eslint-disable-line

  const loadScheduleDates = async () => {
  try {
    setLoading(true);
    const res = await fetch(apiUrl(`/api/offers/${offerId}/schedule-dates`));
    
    if (res.ok) {
      const data = await res.json();
      
      if (data.hasSchedule) {
        setScheduleData(data.schedule);
        
        const phases = data.schedule.phases.map(phase => ({
          id: phase.id,
          phase_name: phase.phase_name,
          planned_start: phase.planned_start,
          planned_end: phase.planned_end,
          original_start: phase.planned_start,
          original_end: phase.planned_end,
          start: phase.planned_start,
          end: phase.planned_end,
          scheduling_reason: phase.scheduling_reason,
          buffer_days: phase.buffer_days,
          buffer_reason: phase.buffer_reason,
          risks: phase.risks,
          execution_order: phase.execution_order,
          changed: false
        }));
        
        setLocalPhases(phases);
        
        if (onPhasesChange) {
          onPhasesChange(phases, '', false);
        }
        
        if (phases.length > 0) {
          setFormData({
            ...formData,
            execution_start: phases[0].start,
            execution_end: phases[phases.length - 1].end
          });
        }
      } else {
        setScheduleData(null);
        if (onPhasesChange) {
          onPhasesChange([], '', false);
        }
      }
    }
  } catch (err) {
    console.error('Fehler beim Laden der Termine:', err);
  } finally {
    setLoading(false);
  }
};

  const handlePhaseChange = (phaseId, field, value) => {
  const updatedPhases = localPhases.map(phase => 
    phase.id === phaseId 
      ? { ...phase, [field]: value, changed: true }
      : phase
  );
  setLocalPhases(updatedPhases);
  
  // HINZUFÜGEN: Sofort nach oben kommunizieren
  const hasChanges = updatedPhases.some(p => p.changed);
  if (onPhasesChange) {
    onPhasesChange(updatedPhases, changeReason, hasChanges);
  }
};

  const calculateWorkdays = (start, end) => {
    let count = 0;
    const current = new Date(start);
    const endDate = new Date(end);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const hasChanges = localPhases.some(p => p.changed);
  const totalDuration = localPhases.reduce((sum, p) => {
    return sum + calculateWorkdays(p.start, p.end);
  }, 0);

  // Fallback: Kein Terminplan vorhanden
  if (!loading && !scheduleData) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-6 h-6" />
          Ausführungstermine *
        </h3>
        
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
          <p className="text-blue-300 text-sm flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>
              Kein Terminplan verfügbar. Bitte geben Sie Ihre gewünschten Ausführungstermine ein.
            </span>
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-white font-semibold mb-2">Ausführung von</label>
            <input
  type="date"
  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
  value={formData.execution_start}
  onChange={(e) => {
    const newStartDate = e.target.value;
    const oldStart = new Date(formData.execution_start);
    const oldEnd = new Date(formData.execution_end);
    const durationInDays = Math.ceil((oldEnd - oldStart) / (1000 * 60 * 60 * 24));
    
    const newStart = new Date(newStartDate);
    const newEnd = new Date(newStart);
    newEnd.setDate(newEnd.getDate() + durationInDays);
    
    setFormData({
      ...formData,
      execution_start: newStartDate,
      execution_end: newEnd.toISOString().split('T')[0]
    });
  }}
  required
/>
          </div>
          <div>
            <label className="block text-white font-semibold mb-2">Ausführung bis</label>
            <input
  type="date"
  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white"
  value={formData.execution_end}
  min={formData.execution_start}
  onChange={(e) => setFormData({...formData, execution_end: e.target.value})}
  required
/>
          </div>
        </div>
      </div>
    );
  }

  // Loading State
  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
        <div className="text-center py-8">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-300">Lade Terminplan...</p>
        </div>
      </div>
    );
  }

  // Hauptansicht: Terminplan vorhanden
  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-lg rounded-2xl border border-white/20 mb-6 overflow-hidden">
      {/* Header mit Status */}
      <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 p-6 border-b border-white/10">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-teal-300" />
              </div>
              Geplante Ausführungstermine
            </h3>
            <p className="text-gray-300 text-sm">
              Der Bauherr hat einen Terminplan erstellt. Bitte prüfen und bestätigen Sie Ihre Einsatzzeiten.
            </p>
          </div>
          
          {scheduleData.status === 'active' && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Wartet auf Bestätigung
              </span>
            </div>
          )}
        </div>

        {/* Gesamtdauer Anzeige */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            <span className="text-gray-400">Gesamtdauer:</span>
            <span className="text-white font-semibold">{totalDuration} Arbeitstage</span>
          </div>
          
          {localPhases.length > 1 && (
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              <span className="text-gray-400">Einsätze:</span>
              <span className="text-white font-semibold">{localPhases.length}x</span>
            </div>
          )}
        </div>
      </div>

      {/* Erklärung (ausklappbar) */}
      {scheduleData.approved_at && (
        <div className="border-b border-white/10">
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
          >
            <span className="text-white font-semibold flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              Warum diese Termine?
            </span>
            {showExplanation ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
          </button>
          
          {showExplanation && (
            <div className="px-6 pb-4 space-y-3">
              <p className="text-gray-300 text-sm">
                Der Terminplan wurde vom Bauherrn freigegeben und berücksichtigt die Abhängigkeiten 
                zwischen allen Gewerken. Ihre Einsatzzeiten wurden so geplant, dass eine optimale 
                Koordination mit den anderen Handwerkern möglich ist.
              </p>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-200 text-sm">
                  <strong>Freigegeben am:</strong> {new Date(scheduleData.approved_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phasen-Liste */}
      <div className="p-6">
        {localPhases.length === 1 ? (
          // EINZEL-EINSATZ
          <SinglePhaseView
            phase={localPhases[0]}
            editMode={editMode}
            onChange={handlePhaseChange}
          />
        ) : (
          // MEHRFACH-EINSÄTZE
          <MultiPhaseView
            phases={localPhases}
            editMode={editMode}
            onChange={handlePhaseChange}
          />
        )}

        {/* Änderungs-Begründung (nur im Edit-Mode) */}
        {editMode && hasChanges && (
          <div className="mt-6 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <label className="block text-white font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              Begründung für Terminänderung (Pflichtfeld)
            </label>
            <textarea
  value={changeReason}
  onChange={(e) => {
    setChangeReason(e.target.value);
    if (onPhasesChange) {
      onPhasesChange(localPhases, e.target.value, hasChanges);
    }
  }}
  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
  rows="3"
  placeholder="Bitte erläutern Sie, warum eine Anpassung der Termine notwendig ist (z.B. Personalengpässe, Materiallieferung, andere Projekte)..."
  required
/>
            <p className="text-gray-400 text-xs mt-2">
              Der Bauherr muss Ihre Änderung genehmigen, bevor Sie das Angebot verbindlich bestätigen können.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex gap-3">
          {!editMode ? (
            <>
              <button
  onClick={() => {
    if (onPhasesChange) {
      onPhasesChange(localPhases, '', false);
    }
  }}
  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white font-bold rounded-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
>
  <CheckCircle className="w-5 h-5" />
  Termine bestätigen
</button>
              
              <button
                onClick={() => setEditMode(true)}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Edit2 className="w-5 h-5" />
                Termine anpassen
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditMode(false);
                  setChangeReason('');
                  // Änderungen verwerfen
                  loadScheduleDates();
                }}
                className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <X className="w-5 h-5" />
                Abbrechen
              </button>
              
              <button
  onClick={() => {
    if (hasChanges && !changeReason.trim()) {
      alert('Bitte geben Sie eine Begründung für die Terminänderung an');
      return;
    }
    setEditMode(false);
    if (onPhasesChange) {
      onPhasesChange(localPhases, changeReason, hasChanges);
    }
  }}
  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold rounded-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
>
  <Save className="w-5 h-5" />
  Änderungen übernehmen
</button>
            </>
          )}
        </div>

        {/* Hinweis zu Änderungen */}
        {hasChanges && !editMode && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-yellow-300 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Sie haben Termine angepasst. Der Bauherr muss diese Änderung vor der verbindlichen 
                Beauftragung genehmigen.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: EINZEL-EINSATZ ANSICHT
// ============================================================================

function SinglePhaseView({ phase, editMode, onChange }) {
  const workdays = calculateWorkdays(phase.start, phase.end);
  
  return (
    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Start-Datum */}
        <div>
          <label className="block text-white font-semibold mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            Beginn der Ausführung
          </label>
          
          {editMode ? (
            <input
              type="date"
              value={phase.start}
              onChange={(e) => onChange(phase.id, 'start', e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          ) : (
            <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg">
              <p className="text-white text-lg font-semibold">
                {new Date(phase.start).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          )}
        </div>

        {/* End-Datum */}
        <div>
          <label className="block text-white font-semibold mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            Ende der Ausführung
          </label>
          
          {editMode ? (
            <input
              type="date"
              value={phase.end}
              onChange={(e) => onChange(phase.id, 'end', e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-lg">
              <p className="text-white text-lg font-semibold">
                {new Date(phase.end).toLocaleDateString('de-DE', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dauer-Anzeige */}
      <div className="mt-4 flex items-center justify-center gap-2 text-sm">
        <Clock className="w-4 h-4 text-gray-400" />
        <span className="text-gray-400">Dauer:</span>
        <span className="text-white font-semibold">{workdays} Arbeitstage</span>
      </div>

      {/* KI-Erklärungen */}
      {phase.scheduling_reason && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-blue-200 text-sm flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span><strong>Planung:</strong> {phase.scheduling_reason}</span>
          </p>
        </div>
      )}

      {phase.buffer_days > 0 && phase.buffer_reason && (
        <div className="mt-2 p-3 bg-teal-500/10 border border-teal-500/30 rounded-lg">
          <p className="text-teal-200 text-sm flex items-start gap-2">
            <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Puffer:</strong> {phase.buffer_days} Tag{phase.buffer_days > 1 ? 'e' : ''} - {phase.buffer_reason}
            </span>
          </p>
        </div>
      )}

      {phase.risks && (
        <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <p className="text-yellow-200 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span><strong>Hinweis:</strong> {phase.risks}</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: MEHRFACH-EINSÄTZE ANSICHT
// ============================================================================

function MultiPhaseView({ phases, editMode, onChange }) {
  const [expandedPhases, setExpandedPhases] = useState({});

  // Initial alle Phasen expanded
  useEffect(() => {
    const expanded = {};
    phases.forEach(p => expanded[p.id] = true);
    setExpandedPhases(expanded);
  }, [phases]);

  return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
        <p className="text-blue-300 text-sm flex items-start gap-2">
          <Info className="w-5 h-5 flex-shrink-0" />
          <span>
            Ihr Gewerk erfordert <strong>{phases.length} getrennte Einsätze</strong>. 
            Dies ist bei der Koordination mit anderen Gewerken notwendig 
            (z.B. Rohinstallation vor Verputzen, Feininstallation nach Malerarbeiten).
          </span>
        </p>
      </div>

      {phases.map((phase, index) => {
        const workdays = calculateWorkdays(phase.start, phase.end);
        const isExpanded = expandedPhases[phase.id];
        
        return (
          <div key={phase.id} className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
            {/* Phase Header */}
            <button
              onClick={() => setExpandedPhases(prev => ({ ...prev, [phase.id]: !prev[phase.id] }))}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                  {index + 1}
                </div>
                <div className="text-left">
                  <h4 className="text-white font-bold text-lg">{phase.phase_name}</h4>
                  <p className="text-gray-400 text-sm">
                    {new Date(phase.start).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })} - 
                    {new Date(phase.end).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })} 
                    <span className="mx-2">•</span>
                    {workdays} Arbeitstage
                  </p>
                </div>
              </div>
              {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
            </button>

            {/* Phase Content */}
            {isExpanded && (
              <div className="px-6 pb-6 pt-2">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Start */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Beginn</label>
                    {editMode ? (
                      <input
                        type="date"
                        value={phase.start}
                        onChange={(e) => onChange(phase.id, 'start', e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    ) : (
                      <div className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg">
                        <p className="text-white font-semibold">
                          {new Date(phase.start).toLocaleDateString('de-DE', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'long'
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Ende */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Ende</label>
                    {editMode ? (
                      <input
                        type="date"
                        value={phase.end}
                        onChange={(e) => onChange(phase.id, 'end', e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg">
                        <p className="text-white font-semibold">
                          {new Date(phase.end).toLocaleDateString('de-DE', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'long'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Erklärungen */}
                <div className="mt-4 space-y-2">
                  {phase.scheduling_reason && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-blue-200 text-sm flex items-start gap-2">
                        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{phase.scheduling_reason}</span>
                      </p>
                    </div>
                  )}

                  {phase.buffer_days > 0 && (
                    <div className="p-2 bg-teal-500/10 border border-teal-500/30 rounded text-xs">
                      <p className="text-teal-200 flex items-center gap-2">
                        <Clock className="w-3 h-3" />
                        Puffer: {phase.buffer_days} Tag{phase.buffer_days > 1 ? 'e' : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// HILFSFUNKTIONEN
// ============================================================================

function calculateWorkdays(start, end) {
  let count = 0;
  const current = new Date(start);
  const endDate = new Date(end);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// ============================================================================
// EXPORT
// ============================================================================

export { ExecutionTimesSection, calculateWorkdays };
