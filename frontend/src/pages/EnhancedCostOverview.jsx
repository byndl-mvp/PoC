// ============================================================================
// PREMIUM KOSTENÜBERSICHT V2.0 - Vollständig überarbeitete Version
// ============================================================================
import React, { useState, useEffect, useCallback } from 'react';

// Hilfsfunktion für Währungsformatierung
function formatCurrency(value) {
  if (!value && value !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

// ============================================================================
// HAUPTKOMPONENTE: Premium Kostenübersicht
// ============================================================================
export function EnhancedCostOverview({ projectId, apiUrl }) {
  const [costData, setCostData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedTrade, setExpandedTrade] = useState(null);
  const [activeView, setActiveView] = useState('overview'); // 'overview', 'details', 'nachtraege'

  const loadCostAnalysis = useCallback(async () => {
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
  }, [projectId, apiUrl]);

  useEffect(() => {
    loadCostAnalysis();
  }, [loadCostAnalysis]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white text-lg">Lade Premium-Kostenanalyse...</div>
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

  const { project, summary, trades } = costData;
  const allTradesAwarded = summary.allTradesAwarded;
  
  // Hole Nachträge-Summen direkt aus summary (Backend berechnet diese bereits!)
  const approvedNachtraege = summary.totalApprovedNachtraege || 0;
  const rejectedNachtraege = summary.totalRejectedNachtraege || 0;
  const pendingNachtraege = summary.totalPendingNachtraege || 0;
  
  const approvedCount = summary.totalApprovedCount || 0;
  const rejectedCount = summary.totalRejectedCount || 0;
  const pendingCount = summary.totalPendingCount || 0;

  return (
    <div className="space-y-6">
      {/* Header mit View-Tabs */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Kostenübersicht</h2>
        
        <div className="flex gap-2">
          <button
            onClick={() => setActiveView('overview')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeView === 'overview'
                ? 'bg-teal-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            Übersicht
          </button>
          <button
            onClick={() => setActiveView('details')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeView === 'details'
                ? 'bg-teal-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            Details
          </button>
          {(approvedCount > 0 || rejectedCount > 0 || pendingCount > 0) && (
            <button
              onClick={() => setActiveView('nachtraege')}
              className={`px-4 py-2 rounded-lg transition-colors relative ${
                activeView === 'nachtraege'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              Nachträge
              {pendingCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Status-Banner bei unvollständigen Projekten */}
      {!allTradesAwarded && (
        <StatusBanner summary={summary} />
      )}

      {/* View-basierter Content */}
      {activeView === 'overview' && (
        <OverviewView
          project={project}
          summary={summary}
          trades={trades}
          allTradesAwarded={allTradesAwarded}
          approvedNachtraege={approvedNachtraege}
          approvedCount={approvedCount}
          rejectedCount={rejectedCount}
          pendingCount={pendingCount}
          setActiveView={setActiveView}
        />
      )}

      {activeView === 'details' && (
        <DetailsView
          trades={trades}
          expandedTrade={expandedTrade}
          setExpandedTrade={setExpandedTrade}
          allTradesAwarded={allTradesAwarded}
        />
      )}

      {activeView === 'nachtraege' && (
        <NachtraegeView
          trades={trades}
          approvedNachtraege={approvedNachtraege}
          rejectedNachtraege={rejectedNachtraege}
          pendingNachtraege={pendingNachtraege}
          approvedCount={approvedCount}
          rejectedCount={rejectedCount}
          pendingCount={pendingCount}
        />
      )}
    </div>
  );
}

// ============================================================================
// VIEW: Übersicht (Dashboard mit KPIs und Charts)
// ============================================================================
function OverviewView({ project, summary, trades, allTradesAwarded, approvedNachtraege, approvedCount, rejectedCount, pendingCount, setActiveView }) {
  // Berechne Top Einsparungen/Mehrkosten
  const completedTrades = trades.filter(t => t.status === 'vergeben' && t.vsEstimate !== undefined);
  const topSavings = completedTrades
    .filter(t => t.savings > 0)
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 3);
  const topOverruns = completedTrades
    .filter(t => t.vsEstimate > 0)
    .sort((a, b) => b.vsEstimate - a.vsEstimate)
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Budget"
          value={formatCurrency(project.initialBudget)}
          subtitle="Geplant"
          color="blue"
        />
        <KPICard
          label="KI-Prognose"
          value={formatCurrency(summary.totalKiEstimate)}
          subtitle={`${summary.budgetVsEstimatePercent > 0 ? '+' : ''}${summary.budgetVsEstimatePercent.toFixed(1)}% vs Budget`}
          color={summary.budgetVsEstimatePercent > 0 ? 'orange' : 'blue'}
        />
        <KPICard
          label="Vergeben"
          value={formatCurrency(summary.totalCurrent)}
          subtitle={`${summary.budgetVsActualPercent > 0 ? '+' : ''}${summary.budgetVsActualPercent.toFixed(1)}% vs Budget`}
          color={summary.budgetVsActualPercent > 0 ? 'red' : 'green'}
        />
        <KPICard
          label="Status"
          value={`${summary.completedTrades}/${summary.totalTrades}`}
          subtitle={`${summary.completionPercentage}% vergeben`}
          color="teal"
        />
      </div>

      {/* NEUE SEKTION: Vergleichsbalken wie in alter Version */}
      <CostComparisonBars
        budget={project.initialBudget}
        kiEstimate={summary.totalKiEstimate}
        actualCost={summary.totalCurrent}
        allTradesAwarded={allTradesAwarded}
      />

      {/* Nachträge-Warnung wenn vorhanden */}
      {(approvedCount > 0 || rejectedCount > 0 || pendingCount > 0) && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-orange-300 font-semibold">Nachträge vorhanden</p>
                <p className="text-orange-200 text-sm">
                  {approvedCount} beauftragt, {rejectedCount} abgelehnt, {pendingCount} offen = {formatCurrency(approvedNachtraege)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveView('nachtraege')}
              className="px-4 py-2 bg-orange-500/20 text-orange-300 rounded-lg hover:bg-orange-500/30 transition-colors"
            >
              Details ansehen
            </button>
          </div>
        </div>
      )}

      {/* Zwei-Spalten-Layout: Charts + Top Listen */}
      <div className="grid md:grid-cols-[2fr,1fr] lg:grid-cols-[3fr,2fr] gap-6">
        {/* Linke Spalte: Kuchendiagramm */}
        <CostPieChart trades={trades.filter(t => t.status === 'vergeben')} />

        {/* Rechte Spalte: Top Einsparungen/Mehrkosten */}
        <div className="space-y-4 md:ml-auto md:w-full lg:max-w-md">
          {topSavings.length > 0 && (
            <TopList
              title="Top Einsparungen"
              items={topSavings}
              type="savings"
            />
          )}
          {topOverruns.length > 0 && (
            <TopList
              title="Top Mehrkosten"
              items={topOverruns}
              type="overruns"
            />
          )}
        </div>
      </div>

      {/* Wasserfalldiagramm + Gesamtanalyse - nur wenn alle vergeben */}
      {allTradesAwarded && (
        <>
          <WaterfallChart
            budget={project.initialBudget}
            kiEstimate={summary.totalKiEstimate}
            ordered={summary.totalOrdered}
            changes={approvedNachtraege}
            total={summary.totalCurrent}
          />
          
          {/* Detaillierte Gesamtanalyse */}
          <div className="bg-gradient-to-br from-white/10 to-white/5 rounded-lg p-6 border border-white/20">
            <h3 className="text-xl font-semibold text-white mb-4">Gesamtanalyse</h3>
            
            <div className="grid md:grid-cols-3 gap-4">
              {/* Budget vs KI-Schätzung */}
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Budget vs. KI-Schätzung</p>
                <p className={`text-2xl font-bold ${
                  summary.budgetVsEstimate < 0 ? 'text-green-400' : 'text-orange-400'
                }`}>
                  {summary.budgetVsEstimate > 0 ? '+' : ''}{formatCurrency(summary.budgetVsEstimate)}
                </p>
                <p className={`text-sm font-semibold ${
                  summary.budgetVsEstimate < 0 ? 'text-green-300' : 'text-orange-300'
                }`}>
                  {summary.budgetVsEstimate > 0 ? '+' : ''}{summary.budgetVsEstimatePercent.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {summary.budgetVsEstimate < 0 ? 'Budget war höher als erwartet' : 'KI-Schätzung über Budget'}
                </p>
              </div>

              {/* Budget vs Ist-Kosten */}
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Budget vs. Ist-Kosten</p>
                <p className={`text-2xl font-bold ${
                  summary.budgetVsActual < 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {summary.budgetVsActual > 0 ? '+' : ''}{formatCurrency(summary.budgetVsActual)}
                </p>
                <p className={`text-sm font-semibold ${
                  summary.budgetVsActual < 0 ? 'text-green-300' : 'text-red-300'
                }`}>
                  {summary.budgetVsActual > 0 ? '+' : ''}{summary.budgetVsActualPercent.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {summary.budgetVsActual < 0 ? '✅ Unter Budget' : '⚠️ Über Budget'}
                </p>
              </div>

              {/* KI-Schätzung vs Ist-Kosten */}
              <div className="bg-white/5 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">KI-Schätzung vs. Ist-Kosten</p>
                <p className={`text-2xl font-bold ${
                  summary.estimateVsActual < 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {summary.estimateVsActual > 0 ? '+' : ''}{formatCurrency(summary.estimateVsActual)}
                </p>
                <p className={`text-sm font-semibold ${
                  summary.estimateVsActual < 0 ? 'text-green-300' : 'text-red-300'
                }`}>
                  {summary.estimateVsActual > 0 ? '+' : ''}{summary.estimateVsActualPercent.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  {summary.estimateVsActual < 0 ? '✅ Gute Verhandlung' : 'Mehrkosten entstanden'}
                </p>
              </div>
            </div>

            {/* Nachträge-Info */}
            {approvedNachtraege > 0 && (
              <div className="mt-4 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-orange-300 text-sm">
                  <span className="font-semibold">Hinweis:</span> Die Ist-Kosten enthalten {formatCurrency(approvedNachtraege)} an beauftragten Nachträgen 
                  ({approvedCount} Nachträge).
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Prognose-Indikator */}
      {!allTradesAwarded && summary.completedTrades > 0 && (
        <ProjectionIndicator
          project={project}
          summary={summary}
          completedTrades={completedTrades}
        />
      )}
    </div>
  );
}

// ============================================================================
// VIEW: Details (Gewerke-Liste)
// ============================================================================
function DetailsView({ trades, expandedTrade, setExpandedTrade, allTradesAwarded }) {
  const completedTrades = trades.filter(t => t.status === 'vergeben');
  const openTrades = trades.filter(t => t.status !== 'vergeben');

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-white">
        {allTradesAwarded ? 'Alle Gewerke' : 'Bereits vergebene Gewerke'}
      </h3>

      {completedTrades.length === 0 ? (
        <div className="bg-white/5 rounded-lg p-8 text-center">
          <p className="text-gray-400">Noch keine Gewerke vergeben.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {completedTrades.map((trade) => (
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

      {!allTradesAwarded && openTrades.length > 0 && (
        <>
          <h3 className="text-xl font-bold text-white mt-8">Noch nicht vergebene Gewerke</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {openTrades.map((trade) => (
              <OpenTradeCard key={trade.tradeId} trade={trade} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// VIEW: Nachträge (Detaillierte Nachtrags-Übersicht)
// ============================================================================
function NachtraegeView({ trades, approvedNachtraege, rejectedNachtraege, pendingNachtraege, approvedCount, rejectedCount, pendingCount }) {
  const tradesWithChanges = trades.filter(t =>
    (t.approvedCount > 0 || t.rejectedCount > 0 || t.pendingCount > 0) && t.status === 'vergeben'
  );

  return (
    <div className="space-y-6">
      {/* Nachträge-Übersicht nach Status */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Beauftragte Nachträge */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
          <p className="text-sm text-green-300 mb-2">Beauftragte Nachträge</p>
          <p className="text-3xl font-bold text-green-400">{approvedCount}</p>
          <p className="text-lg text-green-300 mt-2">{formatCurrency(approvedNachtraege)}</p>
        </div>
        
        {/* Abgelehnte Nachträge */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
          <p className="text-sm text-red-300 mb-2">Abgelehnte Nachträge</p>
          <p className="text-3xl font-bold text-red-400">{rejectedCount}</p>
          <p className="text-lg text-red-300 mt-2">{formatCurrency(rejectedNachtraege)}</p>
        </div>
        
        {/* Offene Nachträge zur Prüfung */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
          <p className="text-sm text-orange-300 mb-2">Offen zur Prüfung</p>
          <p className="text-3xl font-bold text-orange-400">{pendingCount}</p>
          <p className="text-lg text-orange-300 mt-2">{formatCurrency(pendingNachtraege)}</p>
        </div>
      </div>

      {/* Gewerke mit Nachträgen */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Nachträge nach Gewerk</h3>
        {tradesWithChanges.length === 0 ? (
          <div className="bg-white/5 rounded-lg p-8 text-center">
            <p className="text-gray-400">Keine Nachträge vorhanden.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tradesWithChanges.map(trade => (
              <NachtrageCard key={trade.tradeId} trade={trade} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONENTE: Status-Banner
// ============================================================================
function StatusBanner({ summary }) {
  return (
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
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-bold text-lg">{summary.completedTrades}</span>
              <span className="text-gray-400 text-sm">vergeben</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-orange-400 font-bold text-lg">{summary.openTrades}</span>
              <span className="text-gray-400 text-sm">offen</span>
            </div>
            <div className="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-500 to-teal-500 h-3 transition-all duration-700"
                style={{ width: `${summary.completionPercentage}%` }}
              />
            </div>
            <span className="text-white font-semibold text-lg">{summary.completionPercentage}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONENTE: Vergleichsbalken (Budget vs KI vs Ist)
// ============================================================================
function CostComparisonBars({ budget, kiEstimate, actualCost, allTradesAwarded }) {
  const maxValue = Math.max(budget, kiEstimate, actualCost) * 1.1;
  
  const budgetWidth = (budget / maxValue) * 100;
  const kiEstimateWidth = (kiEstimate / maxValue) * 100;
  const actualCostWidth = (actualCost / maxValue) * 100;

  return (
    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
      <h3 className="text-xl font-semibold text-white mb-6">Visuelle Kostenübersicht</h3>
      
      <div className="space-y-6">
        {/* Budget */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-blue-300">💰 Budget (geplant)</span>
            <span className="text-lg font-bold text-blue-400">{formatCurrency(budget)}</span>
          </div>
          <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden">
            <div
              className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg transition-all duration-700"
              style={{ width: `${budgetWidth}%` }}
            />
            {/* Budget-Marker für andere Balken - GESTRICHELT */}
            <div
              className="absolute top-0 h-full pointer-events-none"
              style={{ 
                left: `${budgetWidth}%`,
                width: '2px',
                backgroundImage: 'repeating-linear-gradient(0deg, #60a5fa, #60a5fa 6px, transparent 6px, transparent 12px)',
                opacity: 0.7
              }}
            />
          </div>
        </div>

        {/* KI-Schätzung */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-orange-300">🤖 KI-Kostenschätzung (Gesamt)</span>
            <div className="text-right">
              <span className="text-lg font-bold text-orange-400">{formatCurrency(kiEstimate)}</span>
              {kiEstimate !== budget && (
                <span className={`ml-2 text-sm ${kiEstimate > budget ? 'text-red-400' : 'text-green-400'}`}>
                  {kiEstimate > budget ? '+' : ''}{formatCurrency(kiEstimate - budget)} 
                  ({((kiEstimate - budget) / budget * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
          <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden">
            <div
              className={`absolute h-full rounded-lg transition-all duration-700 ${
                kiEstimate > budget
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                  : 'bg-gradient-to-r from-teal-500 to-teal-600'
              }`}
              style={{ width: `${kiEstimateWidth}%` }}
            >
              <div className="h-full flex items-center justify-end pr-3">
                <span className="text-white text-sm font-semibold">
                  {kiEstimate > budget ? '+' : ''}{((kiEstimate - budget) / budget * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            {/* Budget-Linie - GESTRICHELT */}
            <div
              className="absolute top-0 h-full pointer-events-none z-10"
              style={{ 
                left: `${budgetWidth}%`,
                width: '2px',
                backgroundImage: 'repeating-linear-gradient(0deg, #60a5fa, #60a5fa 6px, transparent 6px, transparent 12px)',
                opacity: 0.8
              }}
            />
          </div>
        </div>

        {/* Ist-Kosten (bereits vergeben) */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-green-300">
              ✅ {allTradesAwarded ? 'Ist-Kosten (komplett)' : 'Bereits vergeben'}
            </span>
            <div className="text-right">
              <span className={`text-lg font-bold ${
                actualCost > budget ? 'text-red-400' : 'text-green-400'
              }`}>
                {formatCurrency(actualCost)}
              </span>
              {actualCost !== budget && (
                <span className={`ml-2 text-sm ${actualCost > budget ? 'text-red-400' : 'text-green-400'}`}>
                  {actualCost > budget ? '+' : ''}{formatCurrency(actualCost - budget)}
                  ({((actualCost - budget) / budget * 100).toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
          <div className="relative h-12 bg-white/5 rounded-lg overflow-hidden">
            <div
              className={`absolute h-full rounded-lg transition-all duration-700 ${
                actualCost > budget
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : 'bg-gradient-to-r from-green-500 to-green-600'
              }`}
              style={{ width: `${actualCostWidth}%` }}
            >
              <div className="h-full flex items-center justify-end pr-3">
                <span className="text-white text-sm font-semibold">
                  {actualCost > budget ? '+' : ''}{((actualCost - budget) / budget * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            {/* Budget-Linie - GESTRICHELT */}
            <div
              className="absolute top-0 h-full pointer-events-none z-10"
              style={{ 
                left: `${budgetWidth}%`,
                width: '2px',
                backgroundImage: 'repeating-linear-gradient(0deg, #60a5fa, #60a5fa 6px, transparent 6px, transparent 12px)',
                opacity: 0.8
              }}
            />
          </div>
        </div>

        {allTradesAwarded && (
          <div className={`mt-6 p-4 rounded-lg border ${actualCost <= budget ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{actualCost <= budget ? '✅' : '⚠️'}</span>
              <div>
                <p className={`text-lg font-bold ${actualCost <= budget ? 'text-green-300' : 'text-red-300'}`}>
                  {actualCost <= budget ? '🎉 Gute Einsparung!' : '⚠️ Kostenüberschreitung'}
                </p>
                <p className={`text-sm ${actualCost <= budget ? 'text-green-200' : 'text-red-200'}`}>
                  {actualCost <= budget
                    ? `Sie haben ${formatCurrency(budget - actualCost)} (${(((budget - actualCost) / budget) * 100).toFixed(1)}%) vom Budget eingespart.`
                    : `Das Budget wurde um ${formatCurrency(actualCost - budget)} (${(((actualCost - budget) / budget) * 100).toFixed(1)}%) überschritten.`
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONENTE: KPI-Karte
// ============================================================================
function KPICard({ icon, label, value, subtitle, color }) {
  const colorClasses = {
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    red: 'from-red-500/20 to-red-600/20 border-red-500/30',
    orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
    teal: 'from-teal-500/20 to-teal-600/20 border-teal-500/30'
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-lg p-4`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-gray-400">{subtitle}</p>
    </div>
  );
}

// ============================================================================
// KOMPONENTE: Echtes Kuchendiagramm (SVG, rund, klickbar)
// ============================================================================
function CostPieChart({ trades }) {
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  
  if (trades.length === 0) return null;

  const total = trades.reduce((sum, t) => sum + t.totalCost, 0);
  
  // Zeige ALLE Gewerke einzeln, sortiert nach Kosten
  const chartData = [...trades]
    .sort((a, b) => b.totalCost - a.totalCost)
    .map(t => ({
      tradeId: t.tradeId,
      name: t.tradeName,
      value: t.totalCost,
      percentage: (t.totalCost / total * 100).toFixed(1),
      kiEstimate: t.kiEstimate,
      savings: t.savings || 0,
      vsEstimate: t.vsEstimate || 0
    }));

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#a855f7', '#6b7280'];

  // SVG Pie Chart Berechnung
  const createPieSlice = (percentage, startAngle, color, index) => {
    const angle = (percentage / 100) * 360;
    const endAngle = startAngle + angle;
    
    // Konvertiere zu Radians
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    
    const radius = hoveredIndex === index ? 102 : 100; // Hover-Effekt
    const cx = 120;
    const cy = 120;
    
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M ${cx} ${cy}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');
    
    return { pathData, endAngle, midAngle: startAngle + angle / 2 };
  };

  let currentAngle = 0;
  const slices = chartData.map((item, index) => {
    const slice = createPieSlice(parseFloat(item.percentage), currentAngle, colors[index % colors.length], index);
    currentAngle = slice.endAngle;
    return { ...slice, ...item, color: colors[index % colors.length], index };
  });

  return (
    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">
          Kostenverteilung nach Gewerken
        </h3>
        <div className="text-right">
          <p className="text-xs text-gray-400">Gesamtkosten</p>
          <p className="text-xl font-bold text-white">{formatCurrency(total)}</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-[300px,1fr] lg:grid-cols-[320px,1fr] gap-6">
        {/* SVG Kuchendiagramm */}
        <div className="flex items-center justify-center flex-shrink-0">
          <svg width="240" height="240" viewBox="0 0 240 240" className="drop-shadow-lg">
            {/* 3D-Effekt: Schatten */}
            <defs>
              <filter id="shadow">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3"/>
                <feOffset dx="2" dy="4" result="offsetblur"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.3"/>
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              
              {/* 3D-Effekt: Glanz */}
              <radialGradient id="gloss">
                <stop offset="0%" stopColor="white" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="white" stopOpacity="0"/>
              </radialGradient>
            </defs>
            
            {/* Kuchenstücke */}
            <g filter="url(#shadow)">
              {slices.map((slice, idx) => (
                <path
                  key={idx}
                  d={slice.pathData}
                  fill={slice.color}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="2"
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    filter: selectedTrade?.tradeId === slice.tradeId ? 'brightness(1.3)' : 'brightness(1)',
                    transformOrigin: '120px 120px'
                  }}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => setSelectedTrade(selectedTrade?.tradeId === slice.tradeId ? null : slice)}
                />
              ))}
            </g>
            
            {/* Glanz-Overlay für 3D-Effekt */}
            <circle cx="120" cy="120" r="100" fill="url(#gloss)" pointerEvents="none"/>
          </svg>
        </div>

        {/* Legende */}
        <div className="space-y-2 max-h-[480px] overflow-y-auto pr-2">
          {chartData.map((item, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedTrade(selectedTrade?.tradeId === item.tradeId ? null : item)}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`p-3 rounded cursor-pointer transition-all ${
                selectedTrade?.tradeId === item.tradeId
                  ? 'bg-white/20 scale-105'
                  : hoveredIndex === idx
                  ? 'bg-white/15'
                  : 'hover:bg-white/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-4 h-4 rounded flex-shrink-0 shadow-lg mt-0.5"
                  style={{ backgroundColor: colors[idx % colors.length] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 font-medium">{item.name}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-white font-semibold">{item.percentage}%</span>
                    <span className="text-xs text-gray-400">{formatCurrency(item.value)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail-Panel wenn Gewerk ausgewählt */}
      {selectedTrade && (
        <div className="mt-6 p-4 bg-gradient-to-br from-white/10 to-white/5 rounded-lg border border-white/20">
          <div className="flex justify-between items-start mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded shadow-lg"
                style={{ backgroundColor: selectedTrade.color }}
              />
              <h4 className="text-lg font-semibold text-white">{selectedTrade.name}</h4>
            </div>
            <button
              onClick={() => setSelectedTrade(null)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded p-3">
              <p className="text-xs text-gray-400">Ist-Kosten</p>
              <p className="text-xl font-bold text-white">{formatCurrency(selectedTrade.value)}</p>
              <p className="text-xs text-gray-400 mt-1">{selectedTrade.percentage}% der Gesamtkosten</p>
            </div>
            <div className="bg-white/5 rounded p-3">
              <p className="text-xs text-gray-400">KI-Schätzung</p>
              <p className="text-xl font-bold text-blue-400">{formatCurrency(selectedTrade.kiEstimate)}</p>
              <p className={`text-xs mt-1 font-semibold ${
                selectedTrade.savings > 0 ? 'text-green-400' : 
                selectedTrade.vsEstimate > 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {selectedTrade.savings > 0 && `✓ ${formatCurrency(selectedTrade.savings)} gespart`}
                {selectedTrade.vsEstimate > 0 && `⚠ ${formatCurrency(selectedTrade.vsEstimate)} Mehrkosten`}
                {selectedTrade.savings === 0 && selectedTrade.vsEstimate === 0 && 'Im Budget'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// KOMPONENTE: Top-Liste (Einsparungen/Mehrkosten)
// ============================================================================
function TopList({ title, items, type }) {
  const isSavings = type === 'savings';
  
  return (
    <div className={`bg-white/5 rounded-lg p-6 border ${
      isSavings ? 'border-green-500/30' : 'border-red-500/30'
    }`}>
      <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
      <div className="space-y-3">
        {items.map((trade, idx) => (
          <div key={trade.tradeId} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className={`text-2xl font-bold flex-shrink-0 ${
                isSavings ? 'text-green-400' : 'text-red-400'
              }`}>
                #{idx + 1}
              </span>
              <span className="text-sm text-gray-300 truncate">{trade.tradeName}</span>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-lg font-bold whitespace-nowrap ${
                isSavings ? 'text-green-400' : 'text-red-400'
              }`}>
                {isSavings ? '-' : '+'}{formatCurrency(Math.abs(isSavings ? trade.savings : trade.vsEstimate))}
              </p>
              <p className="text-xs text-gray-400 whitespace-nowrap">
                {Math.abs(isSavings ? trade.savingsPercent : trade.vsEstimatePercent).toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONENTE: Wasserfalldiagramm
// ============================================================================
function WaterfallChart({ budget, kiEstimate, ordered, changes, total }) {
  const maxValue = Math.max(budget, kiEstimate, total);
  
  const steps = [
    { label: 'Budget', value: budget, color: 'blue' },
    { label: 'KI-Aufschlag', value: kiEstimate - budget, color: kiEstimate > budget ? 'orange' : 'green', cumulative: kiEstimate },
    { label: 'Verhandlung', value: ordered - kiEstimate, color: ordered < kiEstimate ? 'green' : 'red', cumulative: ordered },
    { label: 'Nachträge', value: changes, color: 'orange', cumulative: total },
    { label: 'Ist-Kosten', value: total, color: total > budget ? 'red' : 'green', isFinal: true }
  ];

  return (
    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-6">Kostenverlauf</h3>
      
      <div className="space-y-4">
        {steps.map((step, idx) => (
          <WaterfallStep key={idx} step={step} maxValue={maxValue} isFirst={idx === 0} />
        ))}
      </div>
    </div>
  );
}

function WaterfallStep({ step, maxValue, isFirst }) {
  const width = Math.abs(step.value) / maxValue * 100;
  const isPositive = step.value >= 0;
  
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    orange: 'bg-orange-500'
  };

  return (
    <div className="flex items-center gap-4">
      <div className="w-32 text-sm text-gray-400 text-right">{step.label}</div>
      <div className="flex-1 flex items-center gap-2">
        {!isFirst && (
          <span className={`text-sm ${isPositive ? 'text-red-400' : 'text-green-400'}`}>
            {isPositive ? '+' : ''}{formatCurrency(step.value)}
          </span>
        )}
        <div className="flex-1 bg-white/10 rounded h-8 overflow-hidden flex items-center">
          <div
            className={`${colorClasses[step.color]} h-full transition-all duration-700 flex items-center justify-center`}
            style={{ width: `${width}%` }}
          >
            {width > 15 && (
              <span className="text-white text-xs font-bold px-2">
                {formatCurrency(step.cumulative || step.value)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONENTE: Prognose-Indikator
// ============================================================================
function ProjectionIndicator({ project, summary, completedTrades }) {
  if (completedTrades.length === 0) return null;
  
  // Berechne durchschnittliche Abweichung der bereits vergebenen Gewerke
  const avgDeviation = completedTrades.reduce((sum, t) => sum + t.vsEstimatePercent, 0) / completedTrades.length;
  
  // Projiziere auf alle Gewerke
  const projectedTotal = summary.totalKiEstimate * (1 + avgDeviation / 100);
  
  // Budget aus project holen!
  const budget = project.initialBudget || 0;
  
  const projectedVsBudget = budget > 0 
    ? ((projectedTotal - budget) / budget * 100)
    : 0;
  
  // WICHTIG: Zeige auch aktuelle Ist-Kosten vs Budget
  const currentVsBudget = budget > 0
    ? ((summary.totalCurrent - budget) / budget * 100)
    : 0;
  
  const isGood = projectedVsBudget < 0;
  const isCurrentGood = currentVsBudget < 0;

  return (
    <div className={`rounded-lg p-6 border ${
      isGood
        ? 'bg-green-500/10 border-green-500/30'
        : 'bg-orange-500/10 border-orange-500/30'
    }`}>
      <div className="flex items-start gap-4">
        <span className="text-3xl">{isGood ? '📉' : '📈'}</span>
        <div className="flex-1">
          <h3 className={`text-lg font-semibold mb-2 ${
            isGood ? 'text-green-300' : 'text-orange-300'
          }`}>
            Prognose basierend auf bisherigen Vergaben
          </h3>
          <p className={`text-sm ${isGood ? 'text-green-200' : 'text-orange-200'}`}>
            Basierend auf {completedTrades.length} vergebenen Gewerken (durchschnittlich{' '}
            {avgDeviation > 0 ? '+' : ''}{avgDeviation.toFixed(1)}% vs. KI-Schätzung) wird das Projekt
            voraussichtlich {isGood ? 'unter' : 'über'} Budget abschließen:
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div>
              <p className="text-xs text-gray-400">Aktuell vergeben</p>
              <p className="text-xl font-bold text-white">{formatCurrency(summary.totalCurrent)}</p>
              <p className={`text-sm font-semibold ${isCurrentGood ? 'text-green-400' : 'text-red-400'}`}>
                {isCurrentGood ? '' : '+'}{currentVsBudget.toFixed(1)}% vs. Budget
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Prognostizierte Gesamtkosten</p>
              <p className={`text-xl font-bold ${isGood ? 'text-green-400' : 'text-orange-400'}`}>
                {formatCurrency(projectedTotal)}
              </p>
              <p className={`text-sm font-semibold ${isGood ? 'text-green-400' : 'text-orange-400'}`}>
                {isGood ? '' : '+'}{projectedVsBudget.toFixed(1)}% vs. Budget
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            ⚠️ Dies ist eine Schätzung basierend auf bisherigen Daten. Tatsächliche Kosten können abweichen.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// KOMPONENTE: Gewerke-Detail-Karte (wie vorher)
// ============================================================================
function TradeDetailCard({ trade, expanded, onToggle }) {
  const hasSavings = trade.savings > 0;
  const hasOverrun = trade.vsEstimate > 0;

  return (
    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden hover:bg-white/10 transition-colors">
      <div className="p-4 cursor-pointer" onClick={onToggle}>
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

      {expanded && (
        <div className="border-t border-white/10 p-4 bg-white/5">
          <div className="space-y-4">
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
                {trade.approvedNachtraege > 0 && (
                  <p className="text-xs text-orange-300 mt-1">
                    (inkl. {formatCurrency(trade.approvedNachtraege)} Nachträge)
                  </p>
                )}
              </div>
            </div>

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

            {/* Nachträge-Details (wenn vorhanden) */}
            {(trade.approvedCount > 0 || trade.rejectedCount > 0 || trade.pendingCount > 0) && (
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                <h4 className="text-sm font-semibold text-white mb-3">Nachträge im Detail</h4>
                <div className="grid grid-cols-3 gap-3">
                  {trade.approvedCount > 0 && (
                    <div className="bg-green-500/10 rounded p-3 border border-green-500/30">
                      <p className="text-xs text-green-300 mb-1">Beauftragt</p>
                      <p className="text-lg font-bold text-green-400">{trade.approvedCount}</p>
                      <p className="text-sm text-green-300 mt-1">{formatCurrency(trade.approvedNachtraege)}</p>
                    </div>
                  )}
                  {trade.rejectedCount > 0 && (
                    <div className="bg-red-500/10 rounded p-3 border border-red-500/30">
                      <p className="text-xs text-red-300 mb-1">Abgelehnt</p>
                      <p className="text-lg font-bold text-red-400">{trade.rejectedCount}</p>
                      <p className="text-sm text-red-300 mt-1">{formatCurrency(trade.rejectedNachtraege)}</p>
                    </div>
                  )}
                  {trade.pendingCount > 0 && (
                    <div className="bg-orange-500/10 rounded p-3 border border-orange-500/30">
                      <p className="text-xs text-orange-300 mb-1">Offen zur Prüfung</p>
                      <p className="text-lg font-bold text-orange-400">{trade.pendingCount}</p>
                      <p className="text-sm text-orange-300 mt-1">{formatCurrency(trade.pendingNachtraege)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              {trade.bundleDiscount > 0 && (
                <div className="bg-teal-500/10 rounded p-2">
                  <p className="text-gray-400">Bündelrabatt</p>
                  <p className="text-teal-300 font-semibold">{trade.bundleDiscount}%</p>
                </div>
              )}
              {(trade.approvedCount > 0 || trade.rejectedCount > 0 || trade.pendingCount > 0) && (
                <div className="bg-orange-500/10 rounded p-2">
                  <p className="text-gray-400">Nachträge</p>
                  <p className="text-orange-300 font-semibold">
                    {(trade.approvedCount || 0) + (trade.rejectedCount || 0) + (trade.pendingCount || 0)}
                    {trade.pendingCount > 0 && ` (${trade.pendingCount} offen)`}
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
// KOMPONENTE: Offenes Gewerk
// ============================================================================
function OpenTradeCard({ trade }) {
  return (
    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
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
  );
}

// ============================================================================
// KOMPONENTE: Nachtrags-Karte
// ============================================================================
function NachtrageCard({ trade }) {
  return (
    <div className="bg-white/5 rounded-lg p-4 border border-white/10">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-lg font-semibold text-white mb-1">{trade.tradeName}</h4>
          <p className="text-sm text-gray-400">Vergeben an: {trade.contractorName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Beauftragte Nachträge</p>
          <p className="text-xl font-bold text-green-400">
            +{formatCurrency(trade.approvedNachtraege || 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {trade.approvedCount > 0 && (
          <div className="bg-green-500/10 rounded p-3">
            <p className="text-xs text-green-300 mb-1">Beauftragt</p>
            <p className="text-lg font-bold text-green-400">
              {trade.approvedCount}
            </p>
            <p className="text-sm text-green-300 mt-1">
              {formatCurrency(trade.approvedNachtraege || 0)}
            </p>
          </div>
        )}
        
        {trade.rejectedCount > 0 && (
          <div className="bg-red-500/10 rounded p-3">
            <p className="text-xs text-red-300 mb-1">Abgelehnt</p>
            <p className="text-lg font-bold text-red-400">
              {trade.rejectedCount}
            </p>
            <p className="text-sm text-red-300 mt-1">
              {formatCurrency(trade.rejectedNachtraege || 0)}
            </p>
          </div>
        )}
        
        {trade.pendingCount > 0 && (
          <div className="bg-orange-500/10 rounded p-3">
            <p className="text-xs text-orange-300 mb-1">Offen</p>
            <p className="text-lg font-bold text-orange-400">
              {trade.pendingCount}
            </p>
            <p className="text-sm text-orange-300 mt-1">
              {formatCurrency(trade.pendingNachtraege || 0)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 flex justify-between text-sm">
        <div>
          <p className="text-gray-400">Original-Auftrag</p>
          <p className="text-white font-semibold">{formatCurrency(trade.orderAmount)}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-400">Inkl. beauftragter Nachträge</p>
          <p className="text-white font-bold">{formatCurrency(trade.totalCost)}</p>
        </div>
      </div>
    </div>
  );
}
