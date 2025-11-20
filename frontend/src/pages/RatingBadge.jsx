import React, { useState, useEffect } from 'react';
import { Star, TrendingUp } from 'lucide-react';
import { apiUrl } from '../api';

export default function RatingBadge({ handwerkerId, companyName }) {
  const [ratingData, setRatingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const loadRatings = async () => {
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

    if (handwerkerId) {
      loadRatings();
    }
  }, [handwerkerId]);

  if (loading) {
    return (
      <div className="bg-white/5 rounded-lg px-4 py-2 border border-white/10 animate-pulse">
        <div className="h-6 w-20 bg-white/10 rounded"></div>
      </div>
    );
  }

  const totalRatings = parseInt(ratingData?.total_ratings || 0);
  const avgRating = parseFloat(ratingData?.average_rating || 0);
  const hasRatings = totalRatings > 0;

  return (
    <>
      <div className="relative z-10">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30 border border-yellow-500/40 rounded-lg px-4 py-2 transition-all hover:shadow-lg group"
        >
          <div className="flex items-center gap-2">
            {hasRatings ? (
              <>
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="text-xl font-bold text-yellow-400">
                  {avgRating.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400">
                  ({totalRatings} {totalRatings === 1 ? 'Bewertung' : 'Bewertungen'})
                </span>
              </>
            ) : (
              <>
                <Star className="w-5 h-5 text-gray-500" />
                <span className="text-sm text-gray-400">Noch keine Bewertungen</span>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Dropdown mit Details - Außerhalb des relativen Containers */}
      {showDetails && hasRatings && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-[9998]" 
            onClick={() => setShowDetails(false)}
          />
          
          {/* Details Panel - Fixed positioning für garantierten Vordergrund */}
          <div 
            className="fixed bg-slate-800 border border-white/20 rounded-xl shadow-2xl z-[9999] overflow-hidden"
            style={{
              top: '80px',
              right: '20px',
              width: '320px'
            }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-white/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-semibold">Bewertungsübersicht</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetails(false);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(avgRating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-2xl font-bold text-yellow-400">
                  {avgRating.toFixed(1)}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Basierend auf {totalRatings} Bewertung{totalRatings !== 1 ? 'en' : ''}
              </p>
            </div>

            {/* Details */}
            <div className="p-4 space-y-3">
              {/* Kosten */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">💰 Kosten</span>
                  <span className="text-white font-semibold">
                    {parseFloat(ratingData?.avg_cost || 0).toFixed(1)}/5
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
                    style={{ width: `${(parseFloat(ratingData?.avg_cost || 0) / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* Termine */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">📅 Termine</span>
                  <span className="text-white font-semibold">
                    {parseFloat(ratingData?.avg_schedule || 0).toFixed(1)}/5
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                    style={{ width: `${(parseFloat(ratingData?.avg_schedule || 0) / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* Qualität */}
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">✨ Qualität</span>
                  <span className="text-white font-semibold">
                    {parseFloat(ratingData?.avg_quality || 0).toFixed(1)}/5
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all"
                    style={{ width: `${(parseFloat(ratingData?.avg_quality || 0) / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-300 leading-relaxed">
                    Gute Bewertungen helfen Ihnen, mehr Aufträge über byndl zu erhalten!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
