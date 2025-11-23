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
  
  // Berechne Nachträge-Summen
  const totalNachtraege = trades.reduce((sum, t) => sum + (t.nachtraege || 0), 0);
  const totalSupplements = trades.reduce((sum, t) => sum + (t.supplements || 0), 0);
  const totalChanges = totalNachtraege + totalSupplements;
  
  const nachtraegeCount = trades.reduce((sum, t) => sum + (t.nachtraegeCount || 0), 0);
  const supplementsCount = trades.reduce((sum, t) => sum + (t.supplementsCount || 0), 0);
  const pendingCount = trades.reduce((sum, t) => sum + (t.supplementsPendingCount || 0), 0);

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
            📊 Übersicht
          </button>
          <button
            onClick={() => setActiveView('details')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeView === 'details'
                ? 'bg-teal-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            📋 Details
          </button>
          {(nachtraegeCount > 0 || supplementsCount > 0) && (
            <button
              onClick={() => setActiveView('nachtraege')}
              className={`px-4 py-2 rounded-lg transition-colors relative ${
                activeView === 'nachtraege'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              ⚠️ Nachträge
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
          totalChanges={totalChanges}
          nachtraegeCount={nachtraegeCount}
          supplementsCount={supplementsCount}
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
          totalNachtraege={totalNachtraege}
          totalSupplements={totalSupplements}
          nachtraegeCount={nachtraegeCount}
          supplementsCount={supplementsCount}
          pendingCount={pendingCount}
        />
      )}
    </div>
  );
}

// ============================================================================
// VIEW: Übersicht (Dashboard mit KPIs und Charts)
// ============================================================================
function OverviewView({ project, summary, trades, allTradesAwarded, totalChanges, nachtraegeCount, supplementsCount }) {
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
          icon="💰"
          label="Budget"
          value={formatCurrency(project.initialBudget)}
          subtitle="Geplant"
          color="blue"
        />
        <KPICard
          icon="🤖"
          label="KI-Prognose"
          value={formatCurrency(summary.totalKiEstimate)}
          subtitle={`${summary.budgetVsEstimatePercent > 0 ? '+' : ''}${summary.budgetVsEstimatePercent.toFixed(1)}% vs Budget`}
          color={summary.budgetVsEstimatePercent > 0 ? 'orange' : 'blue'}
        />
        <KPICard
          icon="✅"
          label="Vergeben"
          value={formatCurrency(summary.totalCurrent)}
          subtitle={`${summary.budgetVsActualPercent > 0 ? '+' : ''}${summary.budgetVsActualPercent.toFixed(1)}% vs Budget`}
          color={summary.budgetVsActualPercent > 0 ? 'red' : 'green'}
        />
        <KPICard
          icon="📊"
          label="Status"
          value={`${summary.completedTrades}/${summary.totalTrades}`}
          subtitle={`${summary.completionPercentage}% vergeben`}
          color="teal"
        />
      </div>

      {/* Nachträge-Warnung wenn vorhanden */}
      {(nachtraegeCount > 0 || supplementsCount > 0) && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-orange-300 font-semibold">Nachträge & Änderungen</p>
                <p className="text-orange-200 text-sm">
                  {nachtraegeCount} Nachträge + {supplementsCount} Supplements = {formatCurrency(totalChanges)}
                </p>
              </div>
            </div>
            <button
              onClick={() => {}}
              className="px-4 py-2 bg-orange-500/20 text-orange-300 rounded-lg hover:bg-orange-500/30 transition-colors"
            >
              Details ansehen
            </button>
          </div>
        </div>
      )}

      {/* Zwei-Spalten-Layout: Charts + Top Listen */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Linke Spalte: Kuchendiagramm */}
        <CostPieChart trades={trades.filter(t => t.status === 'vergeben')} />

        {/* Rechte Spalte: Top Einsparungen/Mehrkosten */}
        <div className="space-y-4">
          {topSavings.length > 0 && (
            <TopList
              title="🏆 Top Einsparungen"
              items={topSavings}
              type="savings"
            />
          )}
          {topOverruns.length > 0 && (
            <TopList
              title="⚠️ Top Mehrkosten"
              items={topOverruns}
              type="overruns"
            />
          )}
        </div>
      </div>

      {/* Wasserfalldiagramm - nur wenn alle vergeben */}
      {allTradesAwarded && (
        <WaterfallChart
          budget={project.initialBudget}
          kiEstimate={summary.totalKiEstimate}
          ordered={summary.totalOrdered}
          changes={totalChanges}
          total={summary.totalCurrent}
        />
      )}

      {/* Prognose-Indikator */}
      {!allTradesAwarded && summary.completedTrades > 0 && (
        <ProjectionIndicator
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
function NachtraegeView({ trades, totalNachtraege, totalSupplements, nachtraegeCount, supplementsCount, pendingCount }) {
  const tradesWithChanges = trades.filter(t =>
    (t.nachtraegeCount > 0 || t.supplementsCount > 0) && t.status === 'vergeben'
  );

  return (
    <div className="space-y-6">
      {/* Nachträge-Übersicht */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
          <p className="text-sm text-orange-300 mb-2">Nachträge</p>
          <p className="text-3xl font-bold text-orange-400">{nachtraegeCount}</p>
          <p className="text-lg text-orange-300 mt-2">{formatCurrency(totalNachtraege)}</p>
        </div>
        
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6">
          <p className="text-sm text-purple-300 mb-2">Supplements</p>
          <p className="text-3xl font-bold text-purple-400">{supplementsCount}</p>
          <p className="text-lg text-purple-300 mt-2">{formatCurrency(totalSupplements)}</p>
        </div>
        
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
          <p className="text-sm text-red-300 mb-2">Offen zur Prüfung</p>
          <p className="text-3xl font-bold text-red-400">{pendingCount}</p>
          <p className="text-xs text-red-300 mt-2">Supplements</p>
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
// KOMPONENTE: Kuchendiagramm (Simple CSS Version)
// ============================================================================
function CostPieChart({ trades }) {
  if (trades.length === 0) return null;

  const total = trades.reduce((sum, t) => sum + t.totalCost, 0);
  
  // Sortiere nach Kosten und nehme Top 5 + "Sonstige"
  const sortedTrades = [...trades].sort((a, b) => b.totalCost - a.totalCost);
  const topTrades = sortedTrades.slice(0, 5);
  const otherTrades = sortedTrades.slice(5);
  const otherTotal = otherTrades.reduce((sum, t) => sum + t.totalCost, 0);
  
  const chartData = topTrades.map(t => ({
    name: t.tradeName,
    value: t.totalCost,
    percentage: (t.totalCost / total * 100).toFixed(1)
  }));
  
  if (otherTotal > 0) {
    chartData.push({
      name: 'Sonstige',
      value: otherTotal,
      percentage: (otherTotal / total * 100).toFixed(1)
    });
  }

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

  return (
    <div className="bg-white/5 rounded-lg p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">Kostenverteilung nach Gewerken</h3>
      
      {/* Legende */}
      <div className="space-y-2">
        {chartData.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: colors[idx % colors.length] }}
              />
              <span className="text-sm text-gray-300 truncate">{item.name}</span>
            </div>
            <div className="text-right ml-4">
              <p className="text-sm text-white font-semibold">{item.percentage}%</p>
              <p className="text-xs text-gray-400">{formatCurrency(item.value)}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Simple Balken-Visualisierung */}
      <div className="mt-4 flex h-8 rounded-lg overflow-hidden">
        {chartData.map((item, idx) => (
          <div
            key={idx}
            style={{
              width: `${item.percentage}%`,
              backgroundColor: colors[idx % colors.length]
            }}
            className="transition-all hover:opacity-80"
            title={`${item.name}: ${item.percentage}%`}
          />
        ))}
      </div>
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
          <div key={trade.tradeId} className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <span className={`text-2xl font-bold ${
                isSavings ? 'text-green-400' : 'text-red-400'
              }`}>
                #{idx + 1}
              </span>
              <span className="text-sm text-gray-300 truncate">{trade.tradeName}</span>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${
                isSavings ? 'text-green-400' : 'text-red-400'
              }`}>
                {isSavings ? '-' : '+'}{formatCurrency(Math.abs(isSavings ? trade.savings : trade.vsEstimate))}
              </p>
              <p className="text-xs text-gray-400">
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
function ProjectionIndicator({ summary, completedTrades }) {
  if (completedTrades.length === 0) return null;
  
  // Berechne durchschnittliche Abweichung der bereits vergebenen Gewerke
  const avgDeviation = completedTrades.reduce((sum, t) => sum + t.vsEstimatePercent, 0) / completedTrades.length;
  
  // Projiziere auf alle Gewerke
  const projectedTotal = summary.totalKiEstimate * (1 + avgDeviation / 100);
  const projectedVsBudget = ((projectedTotal - summary.initialBudget) / summary.initialBudget * 100);
  
  const isGood = projectedVsBudget < 0;

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
              <p className="text-xs text-gray-400">Prognostizierte Gesamtkosten</p>
              <p className={`text-xl font-bold ${isGood ? 'text-green-400' : 'text-orange-400'}`}>
                {formatCurrency(projectedTotal)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">vs. Budget</p>
              <p className={`text-xl font-bold ${isGood ? 'text-green-400' : 'text-orange-400'}`}>
                {projectedVsBudget > 0 ? '+' : ''}{projectedVsBudget.toFixed(1)}%
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
                {(trade.nachtraege > 0 || trade.supplements > 0) && (
                  <p className="text-xs text-orange-300 mt-1">
                    (inkl. {[
                      trade.nachtraege > 0 && `${formatCurrency(trade.nachtraege)} NT`,
                      trade.supplements > 0 && `${formatCurrency(trade.supplements)} Suppl.`
                    ].filter(Boolean).join(' + ')})
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

            <div className="grid grid-cols-2 gap-3 text-xs">
              {trade.bundleDiscount > 0 && (
                <div className="bg-teal-500/10 rounded p-2">
                  <p className="text-gray-400">Bündelrabatt</p>
                  <p className="text-teal-300 font-semibold">{trade.bundleDiscount}%</p>
                </div>
              )}
              {trade.nachtraegeCount > 0 && (
                <div className="bg-orange-500/10 rounded p-2">
                  <p className="text-gray-400">Nachträge</p>
                  <p className="text-orange-300 font-semibold">{trade.nachtraegeCount}</p>
                </div>
              )}
              {trade.supplementsCount > 0 && (
                <div className="bg-purple-500/10 rounded p-2">
                  <p className="text-gray-400">Supplements</p>
                  <p className="text-purple-300 font-semibold">
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
          <p className="text-sm text-gray-400">Gesamtänderungen</p>
          <p className="text-xl font-bold text-orange-400">
            +{formatCurrency((trade.nachtraege || 0) + (trade.supplements || 0))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {trade.nachtraegeCount > 0 && (
          <div className="bg-orange-500/10 rounded p-3">
            <p className="text-xs text-orange-300 mb-1">Nachträge</p>
            <p className="text-lg font-bold text-orange-400">
              {trade.nachtraegeCount}
            </p>
            <p className="text-sm text-orange-300 mt-1">
              {formatCurrency(trade.nachtraege)}
            </p>
          </div>
        )}
        
        {trade.supplementsCount > 0 && (
          <div className="bg-purple-500/10 rounded p-3">
            <p className="text-xs text-purple-300 mb-1">Supplements</p>
            <p className="text-lg font-bold text-purple-400">
              {trade.supplementsCount}
              {trade.supplementsPendingCount > 0 && (
                <span className="text-xs text-red-400 ml-2">
                  ({trade.supplementsPendingCount} offen)
                </span>
              )}
            </p>
            <p className="text-sm text-purple-300 mt-1">
              {formatCurrency(trade.supplements)}
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
          <p className="text-gray-400">Inkl. Änderungen</p>
          <p className="text-white font-bold">{formatCurrency(trade.totalCost)}</p>
        </div>
      </div>
    </div>
  );
}
