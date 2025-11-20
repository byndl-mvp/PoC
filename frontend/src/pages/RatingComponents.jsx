import React, { useState, useEffect } from 'react';
import { Star, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

// Modal das nach Abnahme erscheint
export function RatingModal({ orderId, companyName, tradeName, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl max-w-lg w-full border border-white/20 overflow-hidden my-8">
        {/* Header mit Gradient */}
        <div className="bg-gradient-to-r from-green-500 to-teal-600 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/20 rounded-lg">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Leistung abgenommen</h2>
              <p className="text-white/90 text-sm">Auftrag erfolgreich abgeschlossen</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Erfolgs-Information */}
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-white text-base leading-relaxed">
              Sie haben die Leistungen von <span className="font-bold text-green-400">{companyName}</span> für 
              das Gewerk <span className="font-bold">{tradeName}</span> erfolgreich abgenommen.
            </p>
            <p className="text-gray-300 text-sm mt-2">
              ✓ Der Auftrag ist damit abgeschlossen<br/>
              ✓ Die Gewährleistungsfrist beginnt ab heute<br/>
              ✓ Alle Vertragsunterlagen bleiben verfügbar
            </p>
          </div>

          {/* Bewertungs-Aufforderung */}
          <div className="mb-6">
            <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              Jetzt bewerten
            </h3>
            <p className="text-gray-300 text-sm mb-4 leading-relaxed">
              Helfen Sie anderen Bauherren bei der Auswahl und unterstützen Sie gute Handwerker dabei, 
              mehr Aufträge zu erhalten.
            </p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-300 text-sm font-semibold mb-1">
                  Warum ist Ihre Bewertung wichtig?
                </p>
                <p className="text-blue-200 text-xs leading-relaxed">
                  Ihre ehrliche Bewertung fördert Qualität und Transparenz im gesamten byndl-Netzwerk. 
                  Sie dauert nur 2 Minuten und hilft der gesamten Community.
                </p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors font-medium border border-white/10"
            >
              Später bewerten
            </button>
            <button
              onClick={() => {
                window.location.href = `/bauherr/auftrag/${orderId}/bewerten`;
              }}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              <Star className="w-4 h-4" />
              Jetzt bewerten
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            Sie können den Handwerker auch später über Ihre abgeschlossenen Aufträge bewerten
          </p>
        </div>
      </div>
    </div>
  );
}

// Pulsierender Button für bereits abgeschlossene Aufträge
export function RatingButton({ orderId, className = '' }) {
  const navigate = useNavigate();
  const [isRated, setIsRated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRatingStatus = async () => {
      try {
        const res = await fetch(apiUrl(`/api/orders/${orderId}/rating-status`));
        if (res.ok) {
          const data = await res.json();
          setIsRated(data.is_rated);
        }
      } catch (error) {
        console.error('Error checking rating status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkRatingStatus();
  }, [orderId]);

  if (loading) {
    return null;
  }

  if (isRated) {
    return (
      <div className={`flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg ${className}`}>
        <Star className="w-4 h-4 fill-green-400 text-green-400" />
        <span className="text-sm text-green-300">Bewertet</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate(`/bauherr/auftrag/${orderId}/bewerten`)}
      className={`relative px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl flex items-center gap-2 ${className}`}
    >
      {/* Pulsierender Ring */}
      <span className="absolute inset-0 rounded-lg animate-ping bg-yellow-400 opacity-20"></span>
      
      {/* Icon & Text */}
      <Star className="w-4 h-4 relative z-10" />
      <span className="relative z-10">Handwerker bewerten</span>
    </button>
  );
}

// Kompakte Badge-Version für Listen
export function RatingBadge({ orderId }) {
  const [isRated, setIsRated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRatingStatus = async () => {
      try {
        const res = await fetch(apiUrl(`/api/orders/${orderId}/rating-status`));
        if (res.ok) {
          const data = await res.json();
          setIsRated(data.is_rated);
        }
      } catch (error) {
        console.error('Error checking rating status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkRatingStatus();
  }, [orderId]);

  if (loading) return null;

  if (isRated) {
    return (
      <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full flex items-center gap-1">
        <Star className="w-3 h-3 fill-green-400 text-green-400" />
        Bewertet
      </span>
    );
  }

  return (
    <span className="px-2 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full flex items-center gap-1 animate-pulse">
      <Star className="w-3 h-3" />
      Zu bewerten
    </span>
  );
}
