import React, { useState, useEffect } from 'react';
import { Brain, Calendar, FileText, Scale, Clock, ChevronDown, ChevronRight, X, AlertTriangle, CheckCircle, Info, TrendingUp } from 'lucide-react';

export default function KIAuswertungenTab({ apiUrl }) {
  const [evaluations, setEvaluations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedEvaluation, setSelectedEvaluation] = useState(null);

  useEffect(() => {
    loadEvaluations();
  }, [selectedType, dateFrom, dateTo]);

  const loadEvaluations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        type: selectedType,
        from: dateFrom,
        to: dateTo
      });
      
      const res = await fetch(apiUrl(`/api/admin/ai-evaluations?${params}`));
      if (res.ok) {
        const data = await res.json();
        setEvaluations(data.results);
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'offer_evaluation': return <FileText className="w-5 h-5" />;
      case 'comparison': return <Scale className="w-5 h-5" />;
      case 'nachtrag': return <AlertTriangle className="w-5 h-5" />;
      case 'schedule': return <Clock className="w-5 h-5" />;
      default: return <Brain className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'offer_evaluation': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'comparison': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'nachtrag': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'schedule': return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getRatingBadge = (rating) => {
    if (!rating) return null;
    
    const config = {
      green: { label: 'Grün', color: 'bg-green-500/20 text-green-300', icon: '🟢' },
      yellow: { label: 'Gelb', color: 'bg-yellow-500/20 text-yellow-300', icon: '🟡' },
      red: { label: 'Rot', color: 'bg-red-500/20 text-red-300', icon: '🔴' }
    };
    
    const c = config[rating] || config.green;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c.color}`}>
        {c.icon} {c.label}
      </span>
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Brain className="w-7 h-7 text-purple-400" />
            KI-Auswertungen
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Übersicht aller KI-generierten Analysen und Empfehlungen
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white/5 rounded-xl p-4 border border-white/10">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Typ-Filter */}
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">Typ</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Alle Typen</option>
              <option value="offer">Angebotsauswertungen</option>
              <option value="comparison">Vergabeempfehlungen</option>
              <option value="nachtrag">Nachtragsprüfungen</option>
              <option value="schedule">Terminpläne</option>
            </select>
          </div>

          {/* Datum Von */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Von</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Datum Bis */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Bis</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Statistiken */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <p className="text-gray-400 text-xs">Gesamt</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-3 border border-blue-500/20">
            <p className="text-blue-300 text-xs">Angebote</p>
            <p className="text-2xl font-bold text-blue-400">{stats.offer_evaluations}</p>
          </div>
          <div className="bg-purple-500/10 rounded-lg p-3 border border-purple-500/20">
            <p className="text-purple-300 text-xs">Vergaben</p>
            <p className="text-2xl font-bold text-purple-400">{stats.comparisons}</p>
          </div>
          <div className="bg-orange-500/10 rounded-lg p-3 border border-orange-500/20">
            <p className="text-orange-300 text-xs">Nachträge</p>
            <p className="text-2xl font-bold text-orange-400">{stats.nachtraege}</p>
          </div>
          <div className="bg-teal-500/10 rounded-lg p-3 border border-teal-500/20">
            <p className="text-teal-300 text-xs">Terminpläne</p>
            <p className="text-2xl font-bold text-teal-400">{stats.schedules}</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 border border-green-500/20">
            <p className="text-green-300 text-xs">🟢 Grün</p>
            <p className="text-2xl font-bold text-green-400">{stats.ratings.green}</p>
          </div>
          <div className="bg-red-500/10 rounded-lg p-3 border border-red-500/20">
            <p className="text-red-300 text-xs">🔴 Rot</p>
            <p className="text-2xl font-bold text-red-400">{stats.ratings.red}</p>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : evaluations.length === 0 ? (
        <div className="bg-white/5 rounded-xl p-8 text-center border border-white/10">
          <Brain className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">Keine KI-Auswertungen im gewählten Zeitraum gefunden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map((evaluation) => (
            <div
              key={evaluation.id}
              onClick={() => setSelectedEvaluation(evaluation)}
              className="bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${getTypeColor(evaluation.type)}`}>
                    {getTypeIcon(evaluation.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getTypeColor(evaluation.type)}`}>
                        {evaluation.type_label}
                      </span>
                      {getRatingBadge(evaluation.rating)}
                      {evaluation.complexity_level && (
                        <span className="px-2 py-0.5 bg-gray-500/20 text-gray-300 rounded text-xs">
                          {evaluation.complexity_level}
                        </span>
                      )}
                    </div>

                    <h4 className="text-white font-semibold">
                      {evaluation.project_name || `Projekt #${evaluation.project_id}`}
                      {evaluation.trade_name && (
                        <span className="text-gray-400 font-normal"> · {evaluation.trade_name}</span>
                      )}
                    </h4>

                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                      {evaluation.summary || 'Keine Zusammenfassung verfügbar'}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>{formatDate(evaluation.created_at)}</span>
                      {evaluation.bauherr_name && (
                        <span>Bauherr: {evaluation.bauherr_name}</span>
                      )}
                      {evaluation.company_name && (
                        <span>Firma: {evaluation.company_name}</span>
                      )}
                      {evaluation.offer_count && (
                        <span>{evaluation.offer_count} Angebote verglichen</span>
                      )}
                      {evaluation.trade_count && (
                        <span>{evaluation.trade_count} Gewerke · {evaluation.total_duration_days} Tage</span>
                      )}
                      {evaluation.nachtrag_amount && (
                        <span>Nachtrag: {formatCurrency(evaluation.nachtrag_amount)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail-Modal */}
      {selectedEvaluation && (
        <EvaluationDetailModal
          evaluation={selectedEvaluation}
          onClose={() => setSelectedEvaluation(null)}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          getRatingBadge={getRatingBadge}
        />
      )}
    </div>
  );
}

// ============================================================================
// DETAIL-MODAL
// ============================================================================

function EvaluationDetailModal({ evaluation, onClose, formatCurrency, formatDate, getRatingBadge }) {
  const data = evaluation.evaluation_data || {};

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="bg-white/5 p-6 border-b border-white/10">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-sm font-medium">
                  {evaluation.type_label}
                </span>
                {getRatingBadge(evaluation.rating)}
              </div>
              <h3 className="text-xl font-bold text-white">
                {evaluation.project_name || `Projekt #${evaluation.project_id}`}
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                {evaluation.trade_name && `${evaluation.trade_name} · `}
                {formatDate(evaluation.created_at)}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Zusammenfassung */}
          {evaluation.summary && (
            <div className="bg-white/5 rounded-lg p-4 mb-6 border border-white/10">
              <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-400" />
                Zusammenfassung
              </h4>
              <p className="text-gray-300">{evaluation.summary}</p>
            </div>
          )}

          {/* Typ-spezifische Inhalte */}
          {evaluation.type === 'offer_evaluation' && (
            <OfferEvaluationDetails data={data} formatCurrency={formatCurrency} />
          )}

          {evaluation.type === 'comparison' && (
            <ComparisonDetails data={data} formatCurrency={formatCurrency} />
          )}

          {evaluation.type === 'nachtrag' && (
            <NachtragDetails data={data} evaluation={evaluation} formatCurrency={formatCurrency} />
          )}

          {evaluation.type === 'schedule' && (
            <ScheduleDetails data={data} evaluation={evaluation} />
          )}

          {/* Rohdaten (Debug) */}
          <details className="mt-6">
            <summary className="text-gray-500 text-sm cursor-pointer hover:text-gray-300">
              Rohdaten anzeigen (Debug)
            </summary>
            <pre className="mt-2 p-4 bg-black/30 rounded-lg text-xs text-gray-400 overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TYP-SPEZIFISCHE DETAIL-KOMPONENTEN
// ============================================================================

function OfferEvaluationDetails({ data, formatCurrency }) {
  return (
    <div className="space-y-4">
      {/* Scores */}
      {data.completeness && (
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <h4 className="text-white font-semibold mb-3">Vollständigkeit</h4>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-teal-500 rounded-full"
                style={{ width: `${data.completeness.score || 0}%` }}
              />
            </div>
            <span className="text-white font-bold">{data.completeness.score}%</span>
          </div>
          {data.completeness.assessment && (
            <p className="text-gray-400 text-sm mt-2">{data.completeness.assessment}</p>
          )}
        </div>
      )}

      {/* Preisanalyse */}
      {data.priceAnalysis && (
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <h4 className="text-white font-semibold mb-3">Preisanalyse</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Angebotssumme</p>
              <p className="text-white font-bold">{formatCurrency(data.priceAnalysis.totalOffer)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Referenzpreis</p>
              <p className="text-white font-bold">{formatCurrency(data.priceAnalysis.totalReference)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Abweichung</p>
              <p className={`font-bold ${data.priceAnalysis.deviationPercent > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {data.priceAnalysis.deviationPercent > 0 ? '+' : ''}{data.priceAnalysis.deviationPercent?.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empfehlung */}
      {data.recommendation && (
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <h4 className="text-white font-semibold mb-3">Empfehlung</h4>
          <p className="text-gray-300">{data.recommendation.reasoning}</p>
          {data.recommendation.nextSteps && (
            <ul className="mt-3 space-y-1">
              {data.recommendation.nextSteps.map((step, i) => (
                <li key={i} className="text-gray-400 text-sm flex items-start gap-2">
                  <span className="text-teal-400">→</span>
                  {step}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonDetails({ data, formatCurrency }) {
  return (
    <div className="space-y-4">
      {/* Empfohlenes Angebot */}
      {data.recommendation && (
        <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/30">
          <h4 className="text-green-300 font-semibold mb-2 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Empfehlung: {data.recommendation.recommendedCompany}
          </h4>
          <p className="text-gray-300">{data.recommendation.reasoning}</p>
        </div>
      )}

      {/* Preisvergleich */}
      {data.priceComparison && (
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <h4 className="text-white font-semibold mb-3">Preisvergleich</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-400 text-sm">Günstigstes</p>
              <p className="text-green-400 font-bold">{formatCurrency(data.priceComparison.cheapest?.amount)}</p>
              <p className="text-gray-500 text-xs">{data.priceComparison.cheapest?.company}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Teuerstes</p>
              <p className="text-red-400 font-bold">{formatCurrency(data.priceComparison.mostExpensive?.amount)}</p>
              <p className="text-gray-500 text-xs">{data.priceComparison.mostExpensive?.company}</p>
            </div>
          </div>
        </div>
      )}

      {/* Angebotsanalyse */}
      {data.offerAnalysis && (
        <div className="space-y-3">
          <h4 className="text-white font-semibold">Angebotsvergleich</h4>
          {data.offerAnalysis.map((offer, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="text-white font-semibold">{offer.company}</span>
                  <span className="text-gray-400 ml-2">#{offer.rank}</span>
                </div>
                <span className="text-teal-400 font-bold">{formatCurrency(offer.amount)}</span>
              </div>
              {offer.strengths && offer.strengths.length > 0 && (
                <div className="mt-2">
                  <p className="text-green-400 text-xs font-semibold">Stärken:</p>
                  <p className="text-gray-400 text-sm">{offer.strengths.join(', ')}</p>
                </div>
              )}
              {offer.weaknesses && offer.weaknesses.length > 0 && (
                <div className="mt-1">
                  <p className="text-red-400 text-xs font-semibold">Schwächen:</p>
                  <p className="text-gray-400 text-sm">{offer.weaknesses.join(', ')}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NachtragDetails({ data, evaluation, formatCurrency }) {
  return (
    <div className="space-y-4">
      {/* Nachtrag-Info */}
      <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/30">
        <h4 className="text-orange-300 font-semibold mb-2">Nachtrag #{evaluation.nachtrag_number}</h4>
        <p className="text-white font-bold text-xl">{formatCurrency(evaluation.nachtrag_amount)}</p>
        <p className="text-gray-400 text-sm mt-2">{evaluation.nachtrag_reason}</p>
      </div>

      {/* Technische Notwendigkeit */}
      {data.technicalNecessity && (
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <h4 className="text-white font-semibold mb-2">Technische Notwendigkeit</h4>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-teal-500 rounded-full"
                style={{ width: `${data.technicalNecessity.score || 0}%` }}
              />
            </div>
            <span className="text-white font-bold">{data.technicalNecessity.score}%</span>
          </div>
          <p className="text-gray-400 text-sm">{data.technicalNecessity.reasoning}</p>
        </div>
      )}

      {/* Preisanalyse */}
      {data.priceAnalysis && (
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <h4 className="text-white font-semibold mb-2">Preisanalyse</h4>
          <p className="text-gray-400 text-sm">{data.priceAnalysis.marketComparison}</p>
        </div>
      )}

      {/* Empfehlung */}
      {data.recommendation && (
        <div className={`rounded-lg p-4 border ${
          data.recommendation.action === 'approve' ? 'bg-green-500/10 border-green-500/30' :
          data.recommendation.action === 'negotiate' ? 'bg-yellow-500/10 border-yellow-500/30' :
          'bg-red-500/10 border-red-500/30'
        }`}>
          <h4 className="text-white font-semibold mb-2">
            Empfehlung: {
              data.recommendation.action === 'approve' ? 'Genehmigen' :
              data.recommendation.action === 'negotiate' ? 'Verhandeln' :
              'Ablehnen'
            }
          </h4>
          <p className="text-gray-300">{data.recommendation.reasoning}</p>
          {data.recommendation.suggestedAmount && (
            <p className="text-teal-400 font-bold mt-2">
              Empfohlener Betrag: {formatCurrency(data.recommendation.suggestedAmount)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ScheduleDetails({ data, evaluation }) {
  return (
    <div className="space-y-4">
      {/* Übersicht */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <p className="text-gray-400 text-xs">Komplexität</p>
          <p className="text-white font-bold">{evaluation.complexity_level}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <p className="text-gray-400 text-xs">Dauer</p>
          <p className="text-white font-bold">{evaluation.total_duration_days} Tage</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <p className="text-gray-400 text-xs">Gewerke</p>
          <p className="text-white font-bold">{evaluation.trade_count}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-3 border border-white/10">
          <p className="text-gray-400 text-xs">Phasen</p>
          <p className="text-white font-bold">{evaluation.entry_count}</p>
        </div>
      </div>

      {/* Kritischer Pfad */}
      {evaluation.critical_path && (
        <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30">
          <h4 className="text-red-300 font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Kritischer Pfad
          </h4>
          <p className="text-white">
            {Array.isArray(evaluation.critical_path) 
              ? evaluation.critical_path.join(' → ') 
              : evaluation.critical_path}
          </p>
          {data.critical_path_explanation && (
            <p className="text-gray-400 text-sm mt-2">{data.critical_path_explanation}</p>
          )}
        </div>
      )}

      {/* Warnungen */}
      {evaluation.warnings && evaluation.warnings.length > 0 && (
        <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/30">
          <h4 className="text-yellow-300 font-semibold mb-2">Warnungen</h4>
          <ul className="space-y-1">
            {evaluation.warnings.map((w, i) => (
              <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                <span className="text-yellow-400">⚠️</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empfehlungen */}
      {evaluation.recommendations && evaluation.recommendations.length > 0 && (
        <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/30">
          <h4 className="text-blue-300 font-semibold mb-2">Empfehlungen</h4>
          <ul className="space-y-1">
            {evaluation.recommendations.map((r, i) => (
              <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                <span className="text-blue-400">💡</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
