import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Calendar, Clock, MapPin, AlertTriangle, CheckCircle, Info, Building2, ChevronRight } from 'lucide-react';

export default function HandwerkerScheduleTab({ handwerkerId, apiUrl }) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'upcoming', 'in_progress'
  const [expandedProjects, setExpandedProjects] = useState({});
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    loadSchedule();
  }, [handwerkerId]); // eslint-disable-line

 const loadSchedule = async () => {
    try {
      setLoading(true);
      
      console.log('[SCHEDULE_TAB] 📋 Loading schedule for handwerker:', handwerkerId);
      
      // ✅ FIX: Verwende die NEUE Route die manuelle Termine inkludiert
      const res = await fetch(apiUrl(`/api/handwerker/${handwerkerId}/schedule-entries`));
      
      if (res.ok) {
        const data = await res.json();
        
        console.log('[SCHEDULE_TAB] ✅ Received data:', data);
        
        // ✅ FIX: Neue Route hat andere Response-Struktur!
        if (data.success && data.projects) {
          setSchedule(data.projects);
          
          // Alle Projekte initial zugeklappt
          const expanded = {};
          data.projects.forEach(project => expanded[project.project_id] = false);
          setExpandedProjects(expanded);
          
          // Log für manuell eingetragene Schedules
          data.projects.forEach(project => {
            if (project.is_manual_schedule) {
              console.log('[SCHEDULE_TAB] 📝 Manual schedule detected:', project.project_title);
            }
          });
        } else {
          console.log('[SCHEDULE_TAB] ⚠️ No projects in response');
          setSchedule([]);
        }
      } else {
        console.error('[SCHEDULE_TAB] ❌ Response not ok:', res.status);
        setSchedule([]);
      }
    } catch (err) {
      console.error('[SCHEDULE_TAB] ❌ Error loading schedule:', err);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRequestChange = (entry) => {
    setSelectedEntry(entry);
    setShowChangeModal(true);
  };

  const handleSubmitChange = async (requestData) => {
    try {
      setLoading(true);
      
      const res = await fetch(apiUrl(`/api/schedule-entries/${selectedEntry.id}/request-change`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handwerkerId,
          requestedStart: requestData.newStart,
          requestedEnd: requestData.newEnd,
          reason: requestData.reason,
          urgency: requestData.urgency
        })
      });

      if (res.ok) {
        const data = await res.json();
        setShowChangeModal(false);
        setSelectedEntry(null);
        await loadSchedule();
        
        alert(`✅ ${data.message}\n\n` + 
          (data.affectsFollowing 
            ? `⚠️ Ihre Änderung betrifft ${data.estimatedDelay} Tag${data.estimatedDelay !== 1 ? 'e' : ''} Verzögerung für Folgetermine.`
            : '✓ Keine Auswirkungen auf andere Gewerke.'
          ));
      } else {
        const error = await res.json();
        alert('❌ Fehler: ' + error.error);
      }
    } catch (err) {
      console.error('Fehler beim Senden:', err);
      alert('Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (entry) => {
    if (entry.status === 'completed') {
      return {
        label: 'Abgeschlossen',
        color: 'text-green-300 bg-green-500/20 border-green-500/30',
        icon: '✓'
      };
    }
    if (entry.status === 'in_progress') {
      return {
        label: 'In Ausführung',
        color: 'text-blue-300 bg-blue-500/20 border-blue-500/30',
        icon: '⚡'
      };
    }
    if (entry.status === 'change_requested') {
      return {
        label: 'Änderung angefragt',
        color: 'text-orange-300 bg-orange-500/20 border-orange-500/30',
        icon: '⏳'
      };
    }
    if (entry.confirmed) {
      return {
        label: 'Bestätigt',
        color: 'text-teal-300 bg-teal-500/20 border-teal-500/30',
        icon: '✓'
      };
    }
    return {
      label: 'Ausstehend',
      color: 'text-gray-400 bg-gray-500/20 border-gray-500/30',
      icon: '○'
    };
  };

  // Hilfsfunktionen für Datumsvergleiche
  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const today = normalizeDate(new Date());

  // Prüft ob Termin in der Zukunft liegt (Start nach heute)
  const isUpcoming = (entry) => {
    const startDate = normalizeDate(entry.planned_start);
    return startDate > today && entry.status !== 'completed';
  };

  // Prüft ob Termin heute stattfindet
  const isToday = (date) => {
    const entryDate = normalizeDate(date);
    return entryDate.getTime() === today.getTime();
  };

  // Prüft ob Termin gerade in Ausführung ist (heute zwischen Start und Ende)
  const isInProgress = (entry) => {
    if (entry.status === 'completed') return false;
    const startDate = normalizeDate(entry.planned_start);
    const endDate = normalizeDate(entry.planned_end);
    return startDate <= today && endDate >= today;
  };

  // Prüft ob Termin abgelaufen/vergangen ist (Ende vor heute)
  const isPast = (entry) => {
    const endDate = normalizeDate(entry.planned_end);
    return endDate < today || entry.status === 'completed';
  };

  const filteredSchedule = schedule.map(project => ({
    ...project,
    entries: project.entries.filter(entry => {
      if (filterStatus === 'upcoming') {
        // Anstehend: Start in der Zukunft, nicht abgeschlossen
        return isUpcoming(entry);
      }
      if (filterStatus === 'in_progress') {
        // In Ausführung: Heute zwischen Start und Ende, oder Status ist in_progress
        return isInProgress(entry) || entry.status === 'in_progress';
      }
      // 'all' - zeigt alle NICHT abgeschlossenen und NICHT vergangenen Termine
      // Falls du wirklich ALLE anzeigen willst (inkl. vergangene), entferne die isPast-Prüfung
      return !isPast(entry);
    })
  })).filter(project => project.entries.length > 0);

  // Statistiken
  const totalEntries = schedule.reduce((sum, p) => sum + p.entries.filter(e => !isPast(e)).length, 0);
  const confirmedEntries = schedule.reduce((sum, p) => 
    sum + p.entries.filter(e => e.confirmed && !isPast(e)).length, 0
  );
  const upcomingEntries = schedule.reduce((sum, p) => 
    sum + p.entries.filter(e => isUpcoming(e)).length, 0
  );
  const inProgressEntries = schedule.reduce((sum, p) => 
    sum + p.entries.filter(e => isInProgress(e) || e.status === 'in_progress').length, 0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Terminübersicht wird geladen...</p>
        </div>
      </div>
    );
  }

  if (schedule.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600/20 to-teal-600/20 backdrop-blur-md rounded-xl p-8 border border-blue-500/30 text-center">
          <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-10 h-10 text-blue-300" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Noch keine Termine geplant</h3>
          <p className="text-gray-300">
            Sobald ein Bauherr einen Terminplan erstellt und Sie beauftragt hat, 
            erscheinen hier Ihre Einsatzzeiten.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header mit Statistiken */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard
          icon={<Calendar className="w-6 h-6" />}
          label="Gesamt Einsätze"
          value={totalEntries}
          color="from-blue-500 to-cyan-600"
        />
        <StatCard
          icon={<CheckCircle className="w-6 h-6" />}
          label="Bestätigt"
          value={confirmedEntries}
          color="from-green-500 to-teal-600"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Anstehend"
          value={upcomingEntries}
          color="from-orange-500 to-red-600"
        />
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filterStatus === 'all'
              ? 'bg-teal-500 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          Alle Termine
        </button>
        <button
          onClick={() => setFilterStatus('upcoming')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filterStatus === 'upcoming'
              ? 'bg-teal-500 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          Anstehend ({upcomingEntries})
        </button>
        <button
          onClick={() => setFilterStatus('in_progress')}
          className={`px-4 py-2 rounded-lg transition-colors ${
            filterStatus === 'in_progress'
              ? 'bg-teal-500 text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          In Ausführung ({inProgressEntries})
        </button>
      </div>

      {/* Info-Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-300 text-sm flex items-start gap-2">
          <Info className="w-5 h-5 flex-shrink-0" />
          <span>
            Diese Termine wurden vom Bauherrn in Koordination mit allen Gewerken geplant. 
            Bei Änderungsbedarf kontaktieren Sie bitte den Bauherr über das Nachrichten-System.
          </span>
        </p>
      </div>

      {/* Projekte-Liste */}
      <div className="space-y-4">
        {filteredSchedule.length === 0 ? (
          <div className="bg-white/5 rounded-lg p-8 text-center">
            <p className="text-gray-400">
              Keine Termine für den gewählten Filter
            </p>
          </div>
        ) : (
          filteredSchedule.map(project => (
            <ProjectCard
              key={project.project_id}
              project={project}
              expanded={expandedProjects[project.project_id]}
              onToggle={() => setExpandedProjects(prev => ({
                ...prev,
                [project.project_id]: !prev[project.project_id]
              }))}
              getStatusInfo={getStatusInfo}
              isToday={isToday}
              onRequestChange={handleRequestChange}
            />
          ))
        )}
      </div>

      {/* Change Request Modal */}
      {showChangeModal && selectedEntry && (
        <RequestChangeModal
          entry={selectedEntry}
          onClose={() => {
            setShowChangeModal(false);
            setSelectedEntry(null);
          }}
          onSubmit={handleSubmitChange}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: STATISTIK-KARTE
// ============================================================================

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
        </div>
        <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: PROJEKT-KARTE
// ============================================================================

function ProjectCard({ project, expanded, onToggle, getStatusInfo, isToday, onRequestChange }) {
  const allConfirmed = project.entries.every(e => e.confirmed);
  const hasContract = project.entries.some(e => e.is_contracted);

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl border border-white/20 overflow-hidden">
      {/* Project Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          
          <div className="text-left flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-bold text-white">
  {project.project_title || 'Bauprojekt'} - {project.project_address}
</h3>
              
              {hasContract && (
                <span className="px-2 py-1 bg-green-500/20 text-green-300 rounded text-xs font-semibold">
                  Beauftragt
                </span>
              )}
              
              {allConfirmed && !hasContract && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">
                  Termine bestätigt
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <MapPin className="w-4 h-4" />
              <span>{project.address}</span>
              <span className="mx-2">•</span>
              <span>{project.entries.length} Einsatz{project.entries.length > 1 ? 'e' : ''}</span>
            </div>
          </div>
        </div>
        
        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Entries (expanded) */}
      {expanded && (
        <div className="px-6 pb-4 space-y-3">
          {project.entries.map((entry, idx) => {
            const statusInfo = getStatusInfo(entry);
            const workdays = calculateWorkdays(entry.planned_start, entry.planned_end);
            const isTodayEntry = isToday(entry.planned_start);
            
            return (
              <div
                key={idx}
                className={`bg-white/5 rounded-lg p-4 border ${
                  isTodayEntry ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-white/10'
                }`}
              >
                {/* Phase Info */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {entry.phase_name ? (
                        <>
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs font-semibold">
                            Phase {entry.phase_number}
                          </span>
                          <span className="text-white font-semibold">{entry.phase_name}</span>
                        </>
                      ) : (
                        <span className="text-white font-semibold">{entry.trade_name}</span>
                      )}
                      
                      {isTodayEntry && (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded text-xs font-bold animate-pulse">
                          🔔 Heute
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.color}`}>
                    {statusInfo.icon} {statusInfo.label}
                  </span>
                </div>

                {/* Termine */}
                <div className="grid md:grid-cols-2 gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Start</p>
                      <p className="text-white font-semibold">
                        {new Date(entry.planned_start).toLocaleDateString('de-DE', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs">Ende</p>
                      <p className="text-white font-semibold">
                        {new Date(entry.planned_end).toLocaleDateString('de-DE', {
                          weekday: 'short',
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dauer */}
                <div className="flex items-center justify-center gap-2 text-sm py-2 bg-white/5 rounded">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-400">Dauer:</span>
                  <span className="text-white font-semibold">{workdays} Arbeitstage</span>
                </div>

                {/* Warnung bei change_requested */}
                {entry.status === 'change_requested' && (
                  <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded">
                    <p className="text-orange-300 text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>
                        Ihre Terminänderung wartet auf Genehmigung durch den Bauherrn
                      </span>
                    </p>
                  </div>
                )}

                {/* Button: Termin ändern (nur bei confirmed und order_id vorhanden) */}
                {entry.confirmed && entry.order_id && entry.status !== 'change_requested' && (
                  <div className="mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestChange(entry);
                      }}
                      className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-semibold"
                    >
                      <Clock className="w-4 h-4" />
                      Terminänderung beantragen
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
// SUB-KOMPONENTE: TERMINÄNDERUNGS-MODAL
// ============================================================================

function RequestChangeModal({ entry, onClose, onSubmit }) {
  const [newStart, setNewStart] = useState(entry.planned_start);
  const [newEnd, setNewEnd] = useState(entry.planned_end);
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [submitting, setSubmitting] = useState(false);

  const originalDuration = calculateWorkdays(entry.planned_start, entry.planned_end);
  const newDuration = calculateWorkdays(newStart, newEnd);
  const isValid = reason.trim().length >= 10 && newStart && newEnd && newEnd >= newStart;

  const handleSubmit = async () => {
    if (!isValid) return;
    
    setSubmitting(true);
    await onSubmit({
      newStart,
      newEnd,
      reason,
      urgency
    });
    setSubmitting(false);
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[999999] p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-2xl w-full border border-white/20 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <h3 className="text-2xl font-bold text-white mb-2">Terminänderung beantragen</h3>
          <p className="text-gray-400 text-sm">
            {entry.phase_name ? `${entry.trade_name} - Phase ${entry.phase_number}: ${entry.phase_name}` : entry.trade_name}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Aktuelle Termine */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              Aktuelle Termine
            </h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-400 text-xs mb-1">Start</p>
                <p className="text-white font-semibold">
                  {new Date(entry.planned_start).toLocaleDateString('de-DE', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-xs mb-1">Ende</p>
                <p className="text-white font-semibold">
                  {new Date(entry.planned_end).toLocaleDateString('de-DE', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              Dauer: {originalDuration} Arbeitstage
            </p>
          </div>

          {/* Neue Termine */}
          <div>
            <h4 className="text-white font-semibold mb-3">Neue gewünschte Termine</h4>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Neuer Start</label>
                <input
                  type="date"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Neues Ende</label>
                <input
                  type="date"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  min={newStart}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
            <p className="text-gray-400 text-sm mt-2">
              Neue Dauer: {newDuration} Arbeitstage 
              {newDuration !== originalDuration && (
                <span className={newDuration > originalDuration ? 'text-orange-400' : 'text-green-400'}>
                  {' '}({newDuration > originalDuration ? '+' : ''}{newDuration - originalDuration} Tage)
                </span>
              )}
            </p>
          </div>

          {/* Begründung */}
          <div>
            <label className="block text-white font-semibold mb-2">
              Begründung <span className="text-red-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              rows="4"
              placeholder="Bitte beschreiben Sie ausführlich, warum eine Terminänderung notwendig ist (min. 10 Zeichen)..."
            />
            <p className="text-gray-400 text-xs mt-1">
              {reason.length}/10 Zeichen {reason.length >= 10 ? '✓' : '(noch ' + (10 - reason.length) + ')'}
            </p>
          </div>

          {/* Dringlichkeit */}
          <div>
            <label className="block text-white font-semibold mb-2">Dringlichkeit</label>
            <div className="flex gap-3">
              <button
                onClick={() => setUrgency('normal')}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  urgency === 'normal'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : 'bg-white/5 border-white/20 text-gray-400 hover:bg-white/10'
                }`}
              >
                Normal
              </button>
              <button
                onClick={() => setUrgency('urgent')}
                className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                  urgency === 'urgent'
                    ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                    : 'bg-white/5 border-white/20 text-gray-400 hover:bg-white/10'
                }`}
              >
                Dringend
              </button>
            </div>
          </div>

          {/* Warnung */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-yellow-300 text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>
                Ihre Anfrage wird dem Bauherrn zur Genehmigung vorgelegt. 
                Bis zur Genehmigung bleiben die ursprünglichen Termine bestehen.
                {newDuration !== originalDuration && ' Beachten Sie, dass sich dadurch auch Folgetermine verschieben können.'}
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Wird gesendet...' : 'Änderung beantragen'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
