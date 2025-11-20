import React, { useState, useEffect } from 'react';
import { Star, X } from 'lucide-react';
import { apiUrl } from '../api';

// Kompakte Anzeige für Listen
export default function HandwerkerRatingDisplay({ handwerkerId, companyName }) {
  const [ratingData, setRatingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const loadRatings = async () => {
      if (!handwerkerId) return;
      
      try {
        const res = await fetch(apiUrl(`/api/handwerker/${handwerkerId}/ratings-summary`));
        if (res.ok) {
          const data = await res.json();
          setRatingData(data);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Bewertungen:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRatings();
  }, [handwerkerId]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
        Lädt...
      </div>
    );
  }

  const totalRatings = parseInt(ratingData?.total_ratings || 0);
  const avgRating = parseFloat(ratingData?.average_rating || 0);
  const hasRatings = totalRatings > 0;

  if (!hasRatings) {
    return (
      <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/10 rounded text-xs text-gray-400">
        <Star className="w-3 h-3" />
        Noch keine Bewertungen
      </div>
    );
  }

  return (
    <>
      {/* Kompakte Badge-Anzeige */}
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30 border border-yellow-500/40 rounded-lg transition-all hover:shadow-lg text-sm group"
      >
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span className="font-bold text-yellow-400">{avgRating.toFixed(1)}</span>
        <span className="text-xs text-gray-400">({totalRatings})</span>
        <span className="text-xs text-gray-400 group-hover:text-gray-300 ml-1">Details →</span>
      </button>

      {/* Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-white/20 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-white/10 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-white">Bewertungsübersicht</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {companyName && (
                <p className="text-gray-300 text-sm mb-3">{companyName}</p>
              )}
              
              <div className="flex items-center gap-3">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-6 h-6 ${
                        star <= Math.round(avgRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <div>
                  <span className="text-3xl font-bold text-yellow-400">
                    {avgRating.toFixed(1)}
                  </span>
                  <span className="text-gray-400 ml-1">/5.0</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Basierend auf {totalRatings} Bewertung{totalRatings !== 1 ? 'en' : ''}
              </p>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              {/* Kosten */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">💰</span>
                    <span className="text-white font-medium">Kosten</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= Math.round(parseFloat(ratingData?.avg_cost || 0))
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-white font-semibold text-base">
                      {parseFloat(ratingData?.avg_cost || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
                    style={{ width: `${(parseFloat(ratingData?.avg_cost || 0) / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Einhaltung der angebotenen Kosten</p>
              </div>

              {/* Termine */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">📅</span>
                    <span className="text-white font-medium">Termine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= Math.round(parseFloat(ratingData?.avg_schedule || 0))
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-white font-semibold text-base">
                      {parseFloat(ratingData?.avg_schedule || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                    style={{ width: `${(parseFloat(ratingData?.avg_schedule || 0) / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Pünktlichkeit & Zuverlässigkeit</p>
              </div>

              {/* Qualität */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">✨</span>
                    <span className="text-white font-medium">Qualität</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= Math.round(parseFloat(ratingData?.avg_quality || 0))
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-white font-semibold text-base">
                      {parseFloat(ratingData?.avg_quality || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all"
                    style={{ width: `${(parseFloat(ratingData?.avg_quality || 0) / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Ausführungsqualität der Arbeiten</p>
              </div>

              {/* Info */}
              <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-300 leading-relaxed">
                  💡 Diese Bewertungen stammen von verifizierten Bauherren und helfen Ihnen bei der Auswahl des richtigen Handwerkers.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-white/5">
              <button
                onClick={() => setShowModal(false)}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
