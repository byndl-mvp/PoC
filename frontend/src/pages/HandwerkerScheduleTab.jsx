// ============================================================================
// TERMINPLAN-TAB FÜR HANDWERKER DASHBOARD
// ============================================================================
// Zeigt alle eigenen Einsatzzeiten sortiert nach Projekten
// Keine Balkenansicht, sondern übersichtliche Listen-Darstellung
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, AlertTriangle, CheckCircle, Info, Building2, ChevronRight } from 'lucide-react';

export default function HandwerkerScheduleTab({ handwerkerId, apiUrl }) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'upcoming', 'in_progress'
  const [expandedProjects, setExpandedProjects] = useState({});

  useEffect(() => {
    loadSchedule();
  }, [handwerkerId]); // eslint-disable-line

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/handwerker/${handwerkerId}/schedule`));
      
      if (res.ok) {
        const data = await res.json();
        setSchedule(data);
        
        // Alle Projekte initial expanded
        const expanded = {};
        data.forEach(project => expanded[project.project_id] = true);
        setExpandedProjects(expanded);
      }
    } catch (err) {
      console.error('Fehler beim Laden:', err);
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

  const isUpcoming = (date) => {
    const today = new Date();
    const entryDate = new Date(date);
    return entryDate > today;
  };

  const isToday = (date) => {
    const today = new Date();
    const entryDate = new Date(date);
    return entryDate.toDateString() === today.toDateString();
  };

  const filteredSchedule = schedule.map(project => ({
    ...project,
    entries: project.entries.filter(entry => {
      if (filterStatus === 'upcoming') {
        return isUpcoming(entry.planned_start) && entry.status !== 'completed';
      }
      if (filterStatus === 'in_progress') {
        return entry.status === 'in_progress';
      }
      return true; // 'all'
    })
  })).filter(project => project.entries.length > 0);

  // Statistiken
  const totalEntries = schedule.reduce((sum, p) => sum + p.entries.length, 0);
  const confirmedEntries = schedule.reduce((sum, p) => 
    sum + p.entries.filter(e => e.confirmed).length, 0
  );
  const upcomingEntries = schedule.reduce((sum, p) => 
    sum + p.entries.filter(e => isUpcoming(e.planned_start) && e.status !== 'completed').length, 0
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
          In Ausführung
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
            />
          ))
        )}
      </div>
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

function ProjectCard({ project, expanded, onToggle, getStatusInfo, isToday }) {
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
                {project.project_description || 'Bauprojekt'}
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

