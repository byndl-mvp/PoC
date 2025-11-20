import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Star, TrendingUp, Calendar, Sparkles, MessageSquare } from 'lucide-react';
import { apiUrl } from '../api';

export default function HandwerkerRatingPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Order & Handwerker Daten
  const [orderData, setOrderData] = useState(null);
  const [bauherrData, setBauherrData] = useState(null);
  
  // Bewertungen
  const [costRating, setCostRating] = useState(0);
  const [scheduleRating, setScheduleRating] = useState(0);
  const [qualityRating, setQualityRating] = useState(0);
  const [communicationNotes, setCommunicationNotes] = useState('');
  
  // Hover States für Sterne
  const [costHover, setCostHover] = useState(0);
  const [scheduleHover, setScheduleHover] = useState(0);
  const [qualityHover, setQualityHover] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Bauherr-Daten aus sessionStorage
        const storedData = sessionStorage.getItem('bauherrData');
        if (!storedData) {
          navigate('/bauherr/login');
          return;
        }
        setBauherrData(JSON.parse(storedData));
        
        // Prüfe Bewertungsstatus
        const statusRes = await fetch(apiUrl(`/api/orders/${orderId}/rating-status`));
        if (statusRes.ok) {
          const status = await statusRes.json();
          
          if (status.is_rated) {
            alert('Dieser Auftrag wurde bereits bewertet.');
            navigate('/bauherr/dashboard');
            return;
          }
          
          if (status.order_status !== 'completed') {
            alert('Dieser Auftrag kann noch nicht bewertet werden. Die Leistung muss erst abgenommen werden.');
            navigate('/bauherr/dashboard');
            return;
          }
        }
        
        // Lade Order-Details
        const orderRes = await fetch(apiUrl(`/api/orders/${orderId}/contract-text`));
        if (orderRes.ok) {
          const data = await orderRes.json();
          setOrderData(data);
        } else {
          throw new Error('Auftrag nicht gefunden');
        }
        
      } catch (error) {
        console.error('Fehler beim Laden:', error);
        alert('Fehler beim Laden der Auftragsdaten');
        navigate('/bauherr/dashboard');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [orderId, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (costRating === 0 || scheduleRating === 0 || qualityRating === 0) {
      alert('Bitte bewerten Sie alle drei Kriterien.');
      return;
    }
    
    if (!window.confirm('Möchten Sie diese Bewertung wirklich abgeben? Sie kann später nicht mehr geändert werden.')) {
      return;
    }
    
    try {
      setSubmitting(true);
      
      const res = await fetch(apiUrl(`/api/orders/${orderId}/rating`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_rating: costRating,
          schedule_rating: scheduleRating,
          quality_rating: qualityRating,
          communication_notes: communicationNotes.trim() || null,
          bauherr_id: bauherrData.id
        })
      });
      
      if (res.ok) {
        alert('✅ Vielen Dank für Ihre Bewertung! Sie hilft anderen Bauherren bei der Auswahl qualifizierter Handwerker.');
        navigate('/bauherr/dashboard');
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Fehler beim Speichern der Bewertung');
      }
      
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('❌ ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, onChange, hover, onHover, label, icon: Icon, color }) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">{label}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => onHover(star)}
              onMouseLeave={() => onHover(0)}
              className="transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-yellow-400 rounded"
            >
              <Star
                className={`w-10 h-10 transition-all ${
                  star <= (hover || value)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-600 hover:text-gray-500'
                }`}
              />
            </button>
          ))}
          <span className="ml-4 text-2xl font-bold text-yellow-400">
            {(hover || value) > 0 ? (hover || value) + '/5' : '—'}
          </span>
        </div>
        
        <div className="text-sm text-gray-400 ml-14">
          {(hover || value) === 0 && 'Bitte bewerten'}
          {(hover || value) === 1 && 'Sehr schlecht'}
          {(hover || value) === 2 && 'Schlecht'}
          {(hover || value) === 3 && 'Befriedigend'}
          {(hover || value) === 4 && 'Gut'}
          {(hover || value) === 5 && 'Sehr gut'}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-white">Lade Bewertungsformular...</p>
        </div>
      </div>
    );
  }

  const overallRating = (costRating + scheduleRating + qualityRating) / 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-2xl font-bold text-white hover:text-teal-400 transition-colors">
                byndl
              </Link>
              <span className="text-gray-400">|</span>
              <h1 className="text-xl text-white">Handwerker bewerten</h1>
            </div>
            <button
              onClick={() => navigate('/bauherr/dashboard')}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              ← Zurück zum Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Info Banner */}
        <div className="bg-gradient-to-r from-blue-500/10 to-teal-500/10 border border-blue-500/30 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Ihre Bewertung zählt!
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                Mit Ihrer ehrlichen Bewertung helfen Sie anderen Bauherren bei der Auswahl qualifizierter Handwerker. 
                Gleichzeitig unterstützen Sie gute Handwerker dabei, mehr Aufträge zu erhalten und fördern damit 
                Qualität und Zuverlässigkeit im gesamten byndl-Netzwerk.
              </p>
            </div>
          </div>
        </div>

        {/* Auftragsinformationen */}
        {orderData && (
          <div className="bg-white/5 backdrop-blur rounded-xl p-6 border border-white/10 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Auftragsinformationen</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Handwerksbetrieb:</p>
                <p className="text-white font-semibold">{orderData.company_name}</p>
              </div>
              <div>
                <p className="text-gray-400">Gewerk:</p>
                <p className="text-white font-semibold">{orderData.trade_name}</p>
              </div>
              <div>
                <p className="text-gray-400">Auftragsnummer:</p>
                <p className="text-white font-semibold">#{orderId}</p>
              </div>
            </div>
          </div>
        )}

        {/* Bewertungsformular */}
        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur rounded-xl p-8 border border-white/10">
          <h2 className="text-2xl font-bold text-white mb-8">Bewerten Sie den Handwerksbetrieb</h2>

          <div className="space-y-8">
            {/* Kosten-Bewertung */}
            <StarRating
              value={costRating}
              onChange={setCostRating}
              hover={costHover}
              onHover={setCostHover}
              label="Kosten - Einhaltung des Angebots"
              icon={TrendingUp}
              color="bg-green-600"
            />

            <div className="border-t border-white/10"></div>

            {/* Termin-Bewertung */}
            <StarRating
              value={scheduleRating}
              onChange={setScheduleRating}
              hover={scheduleHover}
              onHover={setScheduleHover}
              label="Termine - Pünktlichkeit & Zuverlässigkeit"
              icon={Calendar}
              color="bg-blue-600"
            />

            <div className="border-t border-white/10"></div>

            {/* Qualitäts-Bewertung */}
            <StarRating
              value={qualityRating}
              onChange={setQualityRating}
              hover={qualityHover}
              onHover={setQualityHover}
              label="Qualität - Ausführung der Arbeiten"
              icon={Sparkles}
              color="bg-purple-600"
            />

            <div className="border-t border-white/10"></div>

            {/* Kommunikation & Anmerkungen */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-600">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <span className="text-white font-semibold text-lg">
                  Kommunikation & Umgang (Optional)
                </span>
              </div>
              
              <textarea
                value={communicationNotes}
                onChange={(e) => setCommunicationNotes(e.target.value)}
                placeholder="Wie war die Kommunikation und der Umgang? Z.B. Freundlichkeit, Erreichbarkeit, Problemlösung..."
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent min-h-[120px] resize-y"
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 text-right">
                {communicationNotes.length} / 1000 Zeichen
              </p>
            </div>
          </div>

          {/* Gesamtbewertung Vorschau */}
          {overallRating > 0 && (
            <div className="mt-8 p-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Gesamtbewertung</p>
                  <div className="flex items-center gap-3">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-6 h-6 ${
                            star <= Math.round(overallRating)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-3xl font-bold text-yellow-400">
                      {overallRating.toFixed(1)}
                    </span>
                    <span className="text-gray-400">/5.0</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-xs text-gray-400 mb-1">Durchschnitt aus</p>
                  <p className="text-sm text-gray-300">
                    Kosten: {costRating}/5 · Termine: {scheduleRating}/5 · Qualität: {qualityRating}/5
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="mt-8 flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/bauherr/dashboard')}
              className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-semibold"
              disabled={submitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={submitting || overallRating === 0}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Wird gespeichert...
                </span>
              ) : (
                'Bewertung abgeben'
              )}
            </button>
          </div>

          {/* Hinweis */}
          <p className="mt-4 text-xs text-gray-500 text-center">
            Die Bewertung ist endgültig und kann nach dem Absenden nicht mehr geändert werden.
          </p>
        </form>
      </div>
    </div>
  );
}
