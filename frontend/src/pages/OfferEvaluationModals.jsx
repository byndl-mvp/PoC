import React from 'react';
import { X, AlertCircle, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, FileText, Users } from 'lucide-react';

// ============================================================================
// MODAL: EINZELNE ANGEBOTSBEWERTUNG
// ============================================================================
export function OfferEvaluationModal({ isOpen, onClose, evaluation, companyName }) {
  if (!isOpen || !evaluation) return null;

  const getRatingColor = (rating) => {
    switch (rating) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getRatingIcon = (rating) => {
    switch (rating) {
      case 'green': return <CheckCircle className="w-12 h-12" />;
      case 'yellow': return <AlertTriangle className="w-12 h-12" />;
      case 'red': return <AlertCircle className="w-12 h-12" />;
      default: return null;
    }
  };

  const getRatingText = (rating) => {
    switch (rating) {
      case 'green': return 'Empfehlenswert';
      case 'yellow': return 'Nachverhandlung empfohlen';
      case 'red': return 'Nicht empfehlenswert';
      default: return 'Keine Bewertung';
    }
  };

  const getPriorityBadge = (priority) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    return colors[priority] || colors.low;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">byndl-Angebotsbewertung</h2>
            <p className="text-sm text-gray-600 mt-1">{companyName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          
          {/* Ampel-Status */}
          <div className={`${getRatingColor(evaluation.rating)} rounded-lg p-6 text-white mb-6`}>
            <div className="flex items-center gap-4">
              {getRatingIcon(evaluation.rating)}
              <div className="flex-1">
                <h3 className="text-2xl font-bold">{getRatingText(evaluation.rating)}</h3>
                <p className="mt-2 text-lg opacity-90">{evaluation.summary}</p>
              </div>
            </div>
          </div>

          {/* Preisübersicht */}
<div className="bg-gray-50 rounded-lg p-6">
  <h3 className="text-lg font-semibold mb-4 flex items-center">
    <TrendingUp className="w-5 h-5 mr-2" />
    Preisübersicht
  </h3>
  <div className="grid grid-cols-3 gap-4">
    <div>
      <p className="text-sm text-gray-600">Angebotssumme</p>
      <p className="text-2xl font-bold">
        {evaluation.priceAnalysis?.totalOffer?.toLocaleString('de-DE', {
          style: 'currency',
          currency: 'EUR'
        }) || '—'}
      </p>
    </div>
    <div>
      <p className="text-sm text-gray-600">Referenzpreis (KI)</p>
      <p className="text-2xl font-bold">
        {evaluation.priceAnalysis?.totalReference?.toLocaleString('de-DE', {
          style: 'currency',
          currency: 'EUR'
        }) || '—'}
      </p>
    </div>
    <div>
      <p className="text-sm text-gray-600">Abweichung</p>
      <p className={`text-2xl font-bold ${
        Math.abs(evaluation.priceAnalysis?.deviationPercent || 0) > 15 
          ? 'text-red-600' 
          : 'text-green-600'
      }`}>
        {evaluation.priceAnalysis?.deviationPercent !== undefined 
          ? `${evaluation.priceAnalysis.deviationPercent > 0 ? '+' : ''}${evaluation.priceAnalysis.deviationPercent.toFixed(1)}%`
          : '—'}
      </p>
    </div>
  </div>
</div>

          {/* Vollständigkeit */}
          {evaluation.completeness && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Vollständigkeit
              </h4>
              <div className="space-y-2">
                {evaluation.completeness.allPositionsIncluded ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-5 h-5" />
                    <span>Alle Positionen vollständig</span>
                  </div>
                ) : (
                  <>
                    {evaluation.completeness.missingPositions?.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <p className="text-sm font-semibold text-red-900 mb-2">Fehlende Positionen:</p>
                        <ul className="text-sm text-red-800 list-disc list-inside">
                          {evaluation.completeness.missingPositions.map((pos, idx) => (
                            <li key={idx}>{pos}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {evaluation.completeness.unfilledPositions?.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                        <p className="text-sm font-semibold text-yellow-900 mb-2">Unvollständige Positionen:</p>
                        <ul className="text-sm text-yellow-800 list-disc list-inside">
                          {evaluation.completeness.unfilledPositions.map((pos, idx) => (
                            <li key={idx}>{pos}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Preisanalyse - Auffälligkeiten */}
{(evaluation.priceAnalysis?.outliers || evaluation.priceAnalysis?.significantDeviations)?.length > 0 && (
  <div className="mb-6">
    <h4 className="font-semibold text-gray-900 mb-3">Preisliche Auffälligkeiten</h4>
    <div className="space-y-3">
      {(evaluation.priceAnalysis.outliers || evaluation.priceAnalysis.significantDeviations).map((dev, idx) => (
        <div key={idx} className="border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <p className="font-medium text-gray-900">
                {dev.position}: {dev.title}
              </p>
              {(dev.explanation || dev.assessment) && (
                <p className="text-sm text-gray-600 mt-1">
                  {dev.explanation || dev.assessment}
                </p>
              )}
            </div>
            <span className={`px-2 py-1 rounded text-sm font-medium ml-3 ${
              dev.severity === 'high' || Math.abs(dev.deviationPercent || dev.deviation) > 50 
                ? 'bg-red-100 text-red-800' : 
              dev.severity === 'medium' || Math.abs(dev.deviationPercent || dev.deviation) > 20 
                ? 'bg-yellow-100 text-yellow-800' :
                'bg-blue-100 text-blue-800'
            }`}>
              {(dev.deviationPercent || dev.deviation) > 0 ? '+' : ''}
              {(dev.deviationPercent || dev.deviation)?.toFixed(0)}%
            </span>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-gray-600">
              Angebot: <strong className="text-gray-900">
                {(dev.offerPrice || dev.offered)?.toLocaleString('de-DE', {
                  style: 'currency',
                  currency: 'EUR'
                })}
              </strong>
            </span>
            <span className="text-gray-600">
              Referenz: <strong className="text-gray-900">
                {(dev.referencePrice || dev.reference)?.toLocaleString('de-DE', {
                  style: 'currency',
                  currency: 'EUR'
                })}
              </strong>
            </span>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

          {/* Zusätzliche Positionen */}
          {evaluation.additionalPositions?.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Zusätzliche Positionen</h4>
              <div className="space-y-3">
                {evaluation.additionalPositions.map((pos, idx) => (
                  <div key={idx} className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{pos.position}: {pos.title}</p>
                        <p className="text-sm text-gray-600 mt-1">Begründung: {pos.reasoning}</p>
                      </div>
                      <span className="font-bold text-gray-900">{pos.amount}€</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <p className={`text-sm font-medium ${
                        pos.assessment === 'plausibel' ? 'text-green-700' :
                        pos.assessment === 'optional' ? 'text-yellow-700' : 'text-red-700'
                      }`}>
                        Bewertung: {pos.assessment}
                      </p>
                      <p className="text-sm text-gray-700 mt-1">{pos.recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Handlungsempfehlungen */}
          {evaluation.recommendations?.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Handlungsempfehlungen</h4>
              <div className="space-y-3">
                {evaluation.recommendations.map((rec, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadge(rec.priority)}`}>
                        {rec.priority === 'high' ? 'Hoch' : rec.priority === 'medium' ? 'Mittel' : 'Niedrig'}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{rec.action}</p>
                        {rec.positions?.length > 0 && (
                          <p className="text-sm text-gray-600 mt-1">
                            Betrifft: {rec.positions.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verhandlungstipps */}
          {evaluation.negotiationTips?.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Verhandlungstipps</h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <ul className="space-y-2">
                  {evaluation.negotiationTips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-blue-600 mt-0.5">→</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Fazit */}
<div className="bg-gray-900 text-white rounded-lg p-6">
  <h3 className="text-lg font-semibold mb-3">Fazit</h3>
  <p className="text-gray-300 mb-4">
    {evaluation.summary || evaluation.recommendation?.reasoning || 'Keine Zusammenfassung verfügbar'}
  </p>
  {evaluation.legalDisclaimer && (
    <p className="text-sm text-gray-400 italic mt-4 pt-4 border-t border-gray-700">
      {evaluation.legalDisclaimer || 'Die Bewertung erfolgt ohne Gewähr auf Basis der vorliegenden Informationen. Die finale Vergabeentscheidung liegt beim Auftraggeber.'}
    </p>
  )}
</div>

          {/* Disclaimer */}
          <div className="mt-4 text-xs text-gray-500 text-center">
            Die Bewertung erfolgt ohne Gewähr auf Basis der vorliegenden Informationen.
            Die finale Vergabeentscheidung liegt beim Auftraggeber.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL: VERGABEEMPFEHLUNG (MEHRERE ANGEBOTE)
// ============================================================================
export function OfferComparisonModal({ isOpen, onClose, comparison }) {
  if (!isOpen || !comparison) return null;

  const getConfidenceBadge = (confidence) => {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800'
    };
    const labels = {
      high: 'Hohe Sicherheit',
      medium: 'Mittlere Sicherheit',
      low: 'Geringe Sicherheit'
    };
    return { color: colors[confidence] || colors.medium, label: labels[confidence] || 'Unbekannt' };
  };

  const getRiskBadge = (risk) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800'
    };
    const labels = {
      low: 'Niedriges Risiko',
      medium: 'Mittleres Risiko',
      high: 'Hohes Risiko'
    };
    return { color: colors[risk] || colors.medium, label: labels[risk] || 'Unbekannt' };
  };

  const confidenceBadge = getConfidenceBadge(comparison.confidence);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">byndl-Vergabeempfehlung</h2>
            <p className="text-sm text-gray-600 mt-1">
  Vergleich von {comparison.offerAnalysis?.length || comparison.ranking?.length || 0} Angeboten
</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          
          {/* Hauptempfehlung */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-8 h-8" />
                  <div>
                    <h3 className="text-2xl font-bold">{comparison.recommendedCompany}</h3>
                    <span className={`inline-block mt-2 px-3 py-1 rounded text-sm font-medium ${confidenceBadge.color}`}>
                      {confidenceBadge.label}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-lg opacity-95">{comparison.summary}</p>
              </div>
            </div>
          </div>

          {/* Preisvergleich */}
<div className="mb-8">
  <h3 className="text-lg font-semibold mb-4 flex items-center">
    <TrendingUp className="w-5 h-5 mr-2" />
    Preisvergleich
  </h3>
  <div className="grid grid-cols-4 gap-4">
    <div>
      <p className="text-sm text-gray-600">Günstigstes</p>
      <p className="text-xl font-bold text-green-600">
        {evaluation.priceComparison?.cheapest?.amount?.toLocaleString('de-DE', {
          style: 'currency',
          currency: 'EUR'
        }) || '—'}
      </p>
      <p className="text-sm text-gray-500">
        {evaluation.priceComparison?.cheapest?.company || '—'}
      </p>
    </div>
    <div>
      <p className="text-sm text-gray-600">Teuerstes</p>
      <p className="text-xl font-bold text-red-600">
        {evaluation.priceComparison?.mostExpensive?.amount?.toLocaleString('de-DE', {
          style: 'currency',
          currency: 'EUR'
        }) || '—'}
      </p>
      <p className="text-sm text-gray-500">
        {evaluation.priceComparison?.mostExpensive?.company || '—'}
      </p>
    </div>
    <div>
      <p className="text-sm text-gray-600">Referenz (KI)</p>
      <p className="text-xl font-bold">
        {evaluation.priceComparison?.referencePrice?.toLocaleString('de-DE', {
          style: 'currency',
          currency: 'EUR'
        }) || '—'}
      </p>
    </div>
    <div>
      <p className="text-sm text-gray-600">Preisspanne</p>
      <p className="text-xl font-bold">
        {evaluation.priceComparison?.priceRange?.spreadPercent !== undefined 
          ? `${evaluation.priceComparison.priceRange.spreadPercent.toFixed(1)}%`
          : '—'}
      </p>
    </div>
  </div>
  {evaluation.priceComparison?.assessment && (
    <p className="mt-4 text-sm text-gray-600">
      {evaluation.priceComparison.assessment}
    </p>
  )}
</div>
          )}

          {/* Ranking */}
          {comparison.ranking && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-4">Gesamtbewertung</h4>
              <div className="space-y-3">
                {comparison.ranking.map((item, idx) => {
                  const riskBadge = getRiskBadge(item.riskLevel);
                  const isRecommended = item.offerId === comparison.recommendedOfferId;
                  
                  return (
                    <div 
                      key={idx} 
                      className={`border-2 rounded-lg p-4 ${
                        isRecommended ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                            item.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                            item.rank === 2 ? 'bg-gray-300 text-gray-700' :
                            'bg-orange-300 text-orange-900'
                          }`}>
                            {item.rank}
                          </div>
                          <div>
                            <h5 className="font-bold text-gray-900">{item.company}</h5>
                            <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${riskBadge.color}`}>
                              {riskBadge.label}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">{item.totalScore}</p>
                          <p className="text-xs text-gray-500">Punkte</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-green-700 mb-1">Stärken:</p>
                          <ul className="text-sm text-gray-700 space-y-1">
                            {item.strengths?.map((s, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-green-600">+</span>
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-red-700 mb-1">Schwächen:</p>
                          <ul className="text-sm text-gray-700 space-y-1">
                            {item.weaknesses?.map((w, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-red-600">-</span>
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Red Flags */}
          {comparison.redFlags?.length > 0 && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Wichtige Hinweise
              </h4>
              <div className="space-y-3">
                {comparison.redFlags.map((flag, idx) => (
                  <div key={idx} className={`border-l-4 rounded p-4 ${
                    flag.severity === 'high' ? 'border-red-500 bg-red-50' :
                    flag.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}>
                    <p className="font-medium text-gray-900 mb-1">{flag.company}</p>
                    <p className="text-sm text-gray-700 mb-2">{flag.concern}</p>
                    <p className="text-sm text-gray-600 italic">{flag.recommendation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verhandlungsstrategie */}
          {comparison.negotiationStrategy && (
            <div className="mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Verhandlungsstrategie</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {comparison.negotiationStrategy.withRecommended?.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="font-medium text-green-900 mb-2">Mit empfohlener Firma besprechen:</p>
                    <ul className="space-y-1">
                      {comparison.negotiationStrategy.withRecommended.map((item, idx) => (
                        <li key={idx} className="text-sm text-green-800 flex items-start gap-2">
                          <span className="text-green-600 mt-0.5">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {comparison.negotiationStrategy.withAlternatives?.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="font-medium text-blue-900 mb-2">Alternative Optionen:</p>
                    <ul className="space-y-1">
                      {comparison.negotiationStrategy.withAlternatives.map((item, idx) => (
                        <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                          <span className="text-blue-600 mt-0.5">→</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Finale Empfehlung */}
<div className="bg-gray-900 text-white rounded-lg p-6 mb-4">
  <h4 className="font-semibold mb-3 text-lg">Vergabeempfehlung</h4>
  
  {/* Empfohlenes Angebot */}
  {comparison.recommendation?.recommendedCompany && (
    <div className="mb-4 p-4 bg-gray-800 rounded">
      <p className="text-sm text-gray-400 mb-1">Empfohlenes Angebot:</p>
      <p className="text-xl font-bold text-green-400">
        {comparison.recommendation.recommendedCompany}
      </p>
    </div>
  )}
  
  {/* Begründung */}
  <p className="text-gray-300">
    {comparison.summary || comparison.recommendation?.reasoning || 'Keine Empfehlung verfügbar'}
  </p>
  
  {/* Nächste Schritte */}
  {comparison.nextSteps && comparison.nextSteps.length > 0 && (
    <div className="mt-4 pt-4 border-t border-gray-700">
      <p className="text-sm font-semibold mb-2">Nächste Schritte:</p>
      <ul className="text-sm text-gray-400 space-y-1">
        {comparison.nextSteps.map((step, idx) => (
          <li key={idx}>• {step}</li>
        ))}
      </ul>
    </div>
  )}
</div>

          {/* Rechtlicher Disclaimer */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-900 font-medium mb-2">⚖️ Rechtlicher Hinweis</p>
            <p className="text-sm text-yellow-800 leading-relaxed">
              {comparison.legalDisclaimer}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
}
