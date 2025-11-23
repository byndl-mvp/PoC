// ============================================================================
// VERBESSERTE KOSTENÜBERSICHT-TAB KOMPONENTE
// ============================================================================
// Diese Komponente ersetzt den bestehenden 'budget' Tab in BauherrenDashboardPage.jsx

import React, { useState, useEffect } from 'react';

// Hilfsfunktion für Währungsformatierung
function formatCurrency(value) {
  if (!value && value !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

// ============================================================================
// HAUPTKOMPONENTE: Erweiterte Kostenübersicht
// ============================================================================
export function EnhancedCostOverview({ projectId, apiUrl }) {
  const [costData, setCostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTrade, setExpandedTrade] = useState(null);

  useEffect(() => {
    loadCostAnalysis();
  }, [projectId]);

  const loadCostAnalysis = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl(`/api/projects/${projectId}/cost-analysis`));
      if (!response.ok) throw new Error('Fehler beim Laden der Kostenanalyse');
      const data = await response.json();
      setCostData(data);
    } catch (err) {
      setError(err.message);
      console.error('Error loading cost analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white text-lg">Lade Kostenanalyse...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6">
        <p className="text-red-300">Fehler: {error}</p>
      </div>
    );
  }

  if (!costData) return null;

  const { project, summary, trades, completedTrades, openTrades } = costData;
  const allTradesAwarded = summary.allTradesAwarded;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-6">Kostenübersicht</h2>

      {/* ====================================================================
          STATUS-BANNER: Zeigt ob alle Gewerke vergeben sind
          ==================================================================== */}
      {!allTradesAwarded && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">ℹ️</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-blue-300 mb-2">
                Teilweise vergebenes Projekt
              </h3>
              <p className="text-blue-200 text-sm mb-3">
                Ausführlicher Gesamt-Soll/Ist-Vergleich erst nach vollständiger Vergabe aller Gewerke verfügbar.
              </p>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-green-400 font-bold">{summary.completedTrades}</span>
                  <span className="text-gray-400">Gewerke vergeben</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-orange-400 font-bold">{summary.openTrades}</span>
                  <span className="text-gray-400">Gewerke offen</span>
                </div>
                <div className="flex-1 bg-white/10 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-teal-500 h-2 rounded-full transition-all"
                    style={{ width: `${summary.completionPercentage}%` }}
                  />
                </div>
                <span className="text-white font-semibold">{summary.completionPercentage}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          VISUALISIERUNG: Hauptkosten-Balken
          ==================================================================== */}
      <CostVisualization 
        initialBudget={project.initialBudget}
        kiEstimate={summary.totalKiEstimate}
        actualCost={summary.totalCurrent}
        allTradesAwarded={allTradesAwarded}
      />

      {/* ====================================================================
          GEWERKE-ANALYSE: Einzelne Gewerke
          ==================================================================== */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white mb-4">
          {allTradesAwarded ? 'Detailanalyse nach Gewerken' : 'Bereits vergebene Gewerke'}
        </h3>

        {completedTrades.length === 0 ? (
          <div className="bg-white/5 rounded-lg p-8 text-center">
            <p className="text-gray-400">Noch keine Gewerke vergeben.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trades
              .filter(t => t.status === 'vergeben')
              .map((trade) => (
                <TradeDetailCard 
                  key={trade.tradeId}
                  trade={trade}
                  expanded={expandedTrade === trade.tradeId}
                  onToggle={() => setExpandedTrade(
                    expandedTrade === trade.tradeId ? null : trade.tradeId
                  )}
                />
              ))}
          </div>
        )}

        {/* Offene Gewerke anzeigen wenn nicht alle vergeben */}
        {!allTradesAwarded && openTrades.length > 0 && (
          <>
            <h3 className="text-xl font-bold text-white mb-4 mt-8">Noch nicht vergebene Gewerke</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {openTrades.map((trade) => (
                <div 
                  key={trade.tradeId}
                  className="bg-white/5 rounded-lg p-4 border border-white/10"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-white font-semibold">{trade.tradeName}</h4>
                    <span className="text-xs px-2 py-1 bg-orange-500/20 text-orange-300 rounded-full">
                      {trade.status === 'ausgeschrieben' ? 'Ausgeschrieben' :
                       trade.status === 'bereit' ? 'Bereit' :
                       trade.status === 'in_bearbeitung' ? 'In Bearbeitung' : 'Offen'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">KI-Schätzung:</p>
                  <p className="text-lg text-blue-400 font-bold">
                    {formatCurrency(trade.kiEstimate)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ====================================================================
          GESAMTÜBERSICHT: Nur wenn alle Gewerke vergeben
          ==================================================================== */}
      {allTradesAwarded && (
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-bold text-white mb-6">Gewerkeübergreifende Gesamtanalyse</h3>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Budget vs KI-Schätzung */}
            <ComparisonCard
              title="Budget vs KI-Schätzung"
              baseline={project.initialBudget}
              actual={summary.totalKiEstimate}
              difference={summary.budgetVsEstimate}
              percentage={summary.budgetVsEstimatePercent}
              type="estimate"
            />

            {/* Budget vs Ist-Kosten */}
            <ComparisonCard
              title="Budget vs Ist-Kosten"
              baseline={project.initialBudget}
              actual={summary.totalCurrent}
              difference={summary.budgetVsActual}
              percentage={summary.budgetVsActualPercent}
              type="actual"
            />

            {/* KI-Schätzung vs Ist-Kosten */}
            <ComparisonCard
              title="KI-Schätzung vs Ist-Kosten"
              baseline={summary.totalKiEstimate}
              actual={summary.totalCurrent}
              difference={summary.estimateVsActual}
              percentage={summary.estimateVsActualPercent}
              type="final"
            />
          </div>

          {/* Gesamtfazit */}
          {summary.budgetVsActual !== 0 && (
            <div className={`mt-6 rounded-lg p-6 border ${
              summary.budgetVsActual > 0 
                ? 'bg-red-500/10 border-red-500/30' 
                : 'bg-green-500/10 border-green-500/30'
            }`}>
              <div className="flex items-start gap-4">
                <span className="text-3xl">
                  {summary.budgetVsActual > 0 ? '⚠️' : '✅'}
                </span>
                <div className="flex-1">
                  <h4 className={`text-xl font-bold mb-2 ${
                    summary.budgetVsActual > 0 ? 'text-red-300' : 'text-green-300'
                  }`}>
                    {summary.budgetVsActual > 0 
                      ? `Kostenüberschreitung: ${Math.abs(summary.budgetVsActualPercent).toFixed(1)}%`
                      : `Gute Einsparung: ${Math.abs(summary.budgetVsActualPercent).toFixed(1)}%`
                    }
                  </h4>
                  <p className={`text-lg ${
                    summary.budgetVsActual > 0 ? 'text-red-200' : 'text-green-200'
                  }`}>
                    {summary.budgetVsActual > 0 
                      ? `Die Gesamtkosten übersteigen Ihr Budget um ${formatCurrency(Math.abs(summary.budgetVsActual))}.`
                      : `Sie sparen ${formatCurrency(Math.abs(summary.budgetVsActual))} gegenüber Ihrem Budget.`
                    }
                  </p>
                  {summary.estimateVsActual !== 0 && (
                    <p className="text-sm text-gray-300 mt-2">
                      Gegenüber der KI-Kostenschätzung: {' '}
                      <span className={summary.estimateVsActual > 0 ? 'text-orange-300' : 'text-green-300'}>
                        {summary.estimateVsActual > 0 ? '+' : ''}
                        {formatCurrency(summary.estimateVsActual)} 
                        ({summary.estimateVsActual > 0 ? '+' : ''}
                        {summary.estimateVsActualPercent.toFixed(1)}%)
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: Kostenvisualisierung mit Balken
// ============================================================================
function CostVisualization({ initialBudget, kiEstimate, actualCost, allTradesAwarded }) {
  const maxValue = Math.max(initialBudget, kiEstimate, actualCost, 1);
  
  const getBarWidth = (value) => {
    if (!value || value <= 0) return '0%';
    return `${Math.min((value / maxValue) * 100, 100)}%`;
  };

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20">
      <h3 className="text-2xl font-bold text-white mb-8">Visuelle Kostenübersicht</h3>
      
      <div className="space-y-8">
        {/* Budget */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span className="text-white font-semibold">Anfangsbudget</span>
            </div>
            <div className="text-xl text-white font-bold">
              {formatCurrency(initialBudget)}
            </div>
          </div>
          <div className="relative h-12 bg-white/10 rounded-lg overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center"
              style={{ width: getBarWidth(initialBudget) }}
            >
              <span className="text-white font-bold text-sm">
                {formatCurrency(initialBudget)}
              </span>
            </div>
          </div>
        </div>

        {/* KI-Schätzung */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-yellow-500"></div>
              <span className="text-white font-semibold">KI-Kostenschätzung (Gesamt)</span>
            </div>
            <div className="text-right">
              <div className="text-xl text-yellow-400 font-bold">
                {formatCurrency(kiEstimate)}
              </div>
              <div className={`text-sm font-medium ${
                kiEstimate > initialBudget ? 'text-orange-400' : 'text-green-400'
              }`}>
                {kiEstimate > initialBudget ? '+' : ''}
                {formatCurrency(kiEstimate - initialBudget)} 
                ({((kiEstimate / initialBudget - 1) * 100).toFixed(1)}%)
              </div>
            </div>
          </div>
          <div className="relative h-12 bg-white/10 rounded-lg overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center"
              style={{ width: getBarWidth(kiEstimate) }}
            >
              <span className="text-white font-bold text-sm">
                {formatCurrency(kiEstimate)}
              </span>
            </div>
            {kiEstimate > initialBudget && (
              <div 
                className="absolute inset-y-0 border-l-2 border-dashed border-blue-400"
                style={{ left: getBarWidth(initialBudget) }}
              >
                <div className="absolute -top-1 -left-2 w-4 h-4 bg-blue-400 rounded-full"></div>
              </div>
            )}
          </div>
        </div>

        {/* Ist-Kosten */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded ${
                actualCost > initialBudget ? 'bg-red-500' : 'bg-green-500'
              }`}></div>
              <span className="text-white font-semibold">
                {allTradesAwarded ? 'Beauftragte Summe (Ist-Kosten)' : 'Bereits vergeben'}
              </span>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${
                actualCost > initialBudget ? 'text-red-400' : 'text-green-400'
              }`}>
                {formatCurrency(actualCost)}
              </div>
              <div className={`text-sm font-medium ${
                actualCost > initialBudget ? 'text-red-400' : 'text-green-400'
              }`}>
                {actualCost > initialBudget ? '+' : ''}
                {formatCurrency(actualCost - initialBudget)} 
                ({((actualCost / initialBudget - 1) * 100).toFixed(1)}%)
              </div>
            </div>
          </div>
          <div className="relative h-12 bg-white/10 rounded-lg overflow-hidden">
            <div 
              className={`absolute inset-y-0 left-0 flex items-center justify-center ${
                actualCost > initialBudget 
                  ? 'bg-gradient-to-r from-red-500 to-red-600' 
                  : 'bg-gradient-to-r from-green-500 to-green-600'
              }`}
              style={{ width: getBarWidth(actualCost) }}
            >
              {actualCost > initialBudget * 0.1 && (
                <span className="text-white font-bold text-sm">
                  {formatCurrency(actualCost)}
                </span>
              )}
            </div>
            <div 
              className="absolute inset-y-0 border-l-2 border-dashed border-blue-400"
              style={{ left: getBarWidth(initialBudget) }}
            >
              <div className="absolute -top-1 -left-2 w-4 h-4 bg-blue-400 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: Einzelnes Gewerk mit Details
// ============================================================================
function TradeDetailCard({ trade, expanded, onToggle }) {
  const hasSavings = trade.savings > 0;
  const hasOverrun = trade.vsEstimate > 0;

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden hover:bg-white/10 transition-colors">
      {/* Header - immer sichtbar */}
      <div 
        className="p-4 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h4 className="text-lg font-semibold text-white mb-1">{trade.tradeName}</h4>
            {trade.contractorName && (
              <p className="text-sm text-gray-400">Vergeben an: {trade.contractorName}</p>
            )}
          </div>
          <button className="text-gray-400 hover:text-white">
            <svg 
              className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-1">KI-Schätzung</p>
            <p className="text-sm text-blue-400 font-semibold">
              {formatCurrency(trade.kiEstimate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Auftragssumme</p>
            <p className="text-sm text-white font-semibold">
              {formatCurrency(trade.orderAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Ergebnis</p>
            <p className={`text-sm font-bold ${
              hasSavings ? 'text-green-400' : hasOverrun ? 'text-red-400' : 'text-gray-400'
            }`}>
              {hasSavings ? '✓ Einsparung' : hasOverrun ? '⚠ Mehrkosten' : 'Im Budget'}
            </p>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-white/10 p-4 bg-white/5">
          <div className="space-y-4">
            {/* Kosten-Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded p-3">
                <p className="text-xs text-gray-400 mb-1">KI-Schätzung (Brutto)</p>
                <p className="text-lg text-blue-400 font-bold">
                  {formatCurrency(trade.kiEstimate)}
                </p>
              </div>
              <div className="bg-white/5 rounded p-3">
                <p className="text-xs text-gray-400 mb-1">Tatsächliche Kosten</p>
                <p className="text-lg text-white font-bold">
                  {formatCurrency(trade.totalCost)}
                </p>
                {trade.supplements > 0 && (
                  <p className="text-xs text-orange-300 mt-1">
                    (inkl. {formatCurrency(trade.supplements)} Nachträge)
                  </p>
                )}
              </div>
            </div>

            {/* Differenz-Anzeige */}
            {trade.vsEstimate !== 0 && (
              <div className={`rounded-lg p-4 ${
                hasSavings 
                  ? 'bg-green-500/20 border border-green-500/30' 
                  : 'bg-red-500/20 border border-red-500/30'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-semibold ${
                      hasSavings ? 'text-green-300' : 'text-red-300'
                    }`}>
                      {hasSavings ? 'Einsparung' : 'Mehrkosten'}
                    </p>
                    <p className={`text-2xl font-bold ${
                      hasSavings ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(Math.abs(trade.vsEstimate))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${
                      hasSavings ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {Math.abs(trade.vsEstimatePercent).toFixed(1)}%
                    </p>
                    <p className={`text-xs ${
                      hasSavings ? 'text-green-300' : 'text-red-300'
                    }`}>
                      {hasSavings ? 'unter' : 'über'} KI-Schätzung
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Zusatzinfos */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {trade.bundleDiscount > 0 && (
                <div className="bg-teal-500/10 rounded p-2">
                  <p className="text-gray-400">Bündelrabatt</p>
                  <p className="text-teal-300 font-semibold">{trade.bundleDiscount}%</p>
                </div>
              )}
              {trade.supplementsCount > 0 && (
                <div className="bg-orange-500/10 rounded p-2">
                  <p className="text-gray-400">Nachträge</p>
                  <p className="text-orange-300 font-semibold">
                    {trade.supplementsCount} 
                    {trade.supplementsPendingCount > 0 && ` (${trade.supplementsPendingCount} offen)`}
                  </p>
                </div>
              )}
              {trade.orderDate && (
                <div className="bg-white/5 rounded p-2">
                  <p className="text-gray-400">Vergabedatum</p>
                  <p className="text-white font-semibold">
                    {new Date(trade.orderDate).toLocaleDateString('de-DE')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-KOMPONENTE: Vergleichs-Karte
// ============================================================================
function ComparisonCard({ title, baseline, actual, difference, percentage, type }) {
  const isOverBudget = difference > 0;
  
  const getColor = () => {
    if (type === 'estimate') return isOverBudget ? 'orange' : 'blue';
    if (type === 'actual') return isOverBudget ? 'red' : 'green';
    return isOverBudget ? 'orange' : 'green';
  };
  
  const color = getColor();

  return (
    <div className={`bg-${color}-500/10 border border-${color}-500/30 rounded-lg p-6`}>
      <h4 className="text-sm text-gray-300 mb-4">{title}</h4>
      
      <div className="space-y-3">
        <div>
          <p className="text-xs text-gray-400">Basis</p>
          <p className="text-lg text-white font-semibold">
            {formatCurrency(baseline)}
          </p>
        </div>
        
        <div>
          <p className="text-xs text-gray-400">Tatsächlich</p>
          <p className={`text-lg font-semibold text-${color}-400`}>
            {formatCurrency(actual)}
          </p>
        </div>
        
        <div className="pt-3 border-t border-white/10">
          <p className={`text-2xl font-bold text-${color}-${isOverBudget ? '400' : '400'}`}>
            {isOverBudget ? '+' : ''}{formatCurrency(difference)}
          </p>
          <p className={`text-sm text-${color}-300 mt-1`}>
            {isOverBudget ? '+' : ''}{percentage.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}
