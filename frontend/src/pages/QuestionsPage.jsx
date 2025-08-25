import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function QuestionsPage() {
  const { projectId, tradeId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [assumption, setAssumption] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [tradeName, setTradeName] = useState('');
  const [tradeCode, setTradeCode] = useState('');
  const [projectTrades, setProjectTrades] = useState([]); // NUR die erkannten Gewerke
  const [currentTradeIndex, setCurrentTradeIndex] = useState(0);

  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        setError('');
        
        console.log(`Initializing questions for project ${projectId}, trade ${tradeId}`);
        
        // 1. Lade Projektdetails und ERKANNTE Gewerke
        try {
          const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
          if (projectRes.ok) {
            const projectData = await projectRes.json();
            console.log('Project data loaded:', projectData);
            console.log('NUMBER OF TRADES:', projectData.trades?.length);
            console.log('TRADE CODES:', projectData.trades?.map(t => t.code));
            
            // WICHTIG: Nur die tatsächlich erkannten Gewerke (ohne INT)
            const detectedTrades = (projectData.trades || []).filter(t => t.code !== 'INT');
            console.log('Detected trades for this project:', detectedTrades);
            
            setProjectTrades(detectedTrades);
            
            // Finde den Index des aktuellen Gewerks
            const currentIdx = detectedTrades.findIndex(t => String(t.id) === String(tradeId));
            setCurrentTradeIndex(currentIdx);
            
            // Prüfe ob das aktuelle Trade-ID überhaupt zu diesem Projekt gehört
            const currentTrade = detectedTrades.find(t => String(t.id) === String(tradeId));
            if (!currentTrade) {
              throw new Error(`Gewerk ${tradeId} gehört nicht zu diesem Projekt`);
            }
            
            setTradeName(currentTrade.name);
            setTradeCode(currentTrade.code);
          } else {
            throw new Error('Projekt konnte nicht geladen werden');
          }
        } catch (err) {
          console.error('Error loading project details:', err);
          throw err;
        }
        
        // 2. Generiere ADAPTIVE Fragen für dieses spezifische Gewerk
        console.log(`Generating adaptive questions for trade ${tradeId} (${tradeCode})...`);
        
        const generateRes = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/questions`), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            // Sende zusätzlichen Kontext mit
            includeIntakeContext: true
          })
        });
        
        console.log('Generate response status:', generateRes.status);
        
        if (!generateRes.ok) {
          const errorData = await generateRes.json().catch(() => ({}));
          throw new Error(errorData.error || `Fehler beim Generieren der Fragen (Status: ${generateRes.status})`);
        }
        
        const data = await generateRes.json();
        console.log('Adaptive questions generated:', data);
        
        if (!data.questions || data.questions.length === 0) {
          throw new Error('Keine Fragen wurden generiert');
        }
        
        // Filtere und validiere die Fragen
        const validQuestions = data.questions.filter(q => 
          q.question || q.text || q.q
        );
        
        if (validQuestions.length === 0) {
          throw new Error('Keine gültigen Fragen erhalten');
        }
        
        setQuestions(validQuestions);
        
        // Trade-Info aus Response
        if (data.tradeName) setTradeName(data.tradeName);
        if (data.tradeCode) setTradeCode(data.tradeCode);
        
        // Initialisiere Antworten-Array
        setAnswers(new Array(validQuestions.length).fill(null));
        setCurrent(0);
        
      } catch (err) {
        console.error('Error in initialization:', err);
        setError(err.message || 'Unbekannter Fehler beim Laden der Fragen');
      } finally {
        setLoading(false);
      }
    }
    
    initialize();
  }, [projectId, tradeId]); // tradeId sorgt für Reload bei URL-Änderung

  const handleNext = () => {
    if (!questions[current]) return;
    
    // Speichere aktuelle Antwort
    const newAnswers = [...answers];
    newAnswers[current] = {
      questionId: questions[current].id || questions[current].question_id,
      answer: answerText,
      assumption: assumption
    };
    setAnswers(newAnswers);
    
    if (current + 1 < questions.length) {
      // Gehe zur nächsten Frage
      setCurrent(current + 1);
      // Lade vorherige Antwort falls vorhanden
      if (newAnswers[current + 1]) {
        setAnswerText(newAnswers[current + 1].answer || '');
        setAssumption(newAnswers[current + 1].assumption || '');
      } else {
        setAnswerText('');
        setAssumption('');
      }
    } else {
      // Alle Fragen beantwortet - speichern und LV generieren
      saveAllAnswersAndContinue(newAnswers);
    }
  };

  const handlePrevious = () => {
    if (current > 0) {
      // Speichere aktuelle Antwort bevor zurück
      const newAnswers = [...answers];
      newAnswers[current] = {
        questionId: questions[current].id || questions[current].question_id,
        answer: answerText,
        assumption: assumption
      };
      setAnswers(newAnswers);
      
      // Gehe zur vorherigen Frage
      setCurrent(current - 1);
      setAnswerText(newAnswers[current - 1]?.answer || '');
      setAssumption(newAnswers[current - 1]?.assumption || '');
    }
  };

  async function saveAllAnswersAndContinue(allAnswers) {
    try {
      setSubmitting(true);
      setError('');
      
      // Filtere null-Werte und stelle sicher dass alle Antworten valide sind
      const validAnswers = allAnswers.filter(a => a && a.answer);
      
      console.log('Saving answers:', validAnswers);
      
      // Speichere Antworten
      const saveRes = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/answers`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: validAnswers })
      });
      
      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Speichern der Antworten');
      }
      
      console.log('Answers saved successfully');
      
      // Generiere LV
      await generateLvAndContinue();
      
    } catch (err) {
      console.error('Error saving answers:', err);
      setError(err.message);
      setSubmitting(false);
    }
  }

  async function generateLvAndContinue() {
    try {
      console.log('Generating LV for trade:', tradeId);
      
      const lvRes = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv`), { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!lvRes.ok) {
        const data = await lvRes.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Generieren des Leistungsverzeichnisses');
      }
      
      console.log('LV generated successfully');
      
      // Navigation zur nächsten Trade NUR aus den erkannten Trades
      if (currentTradeIndex !== -1 && currentTradeIndex + 1 < projectTrades.length) {
        const nextTrade = projectTrades[currentTradeIndex + 1];
        console.log('Navigating to next detected trade:', nextTrade);
        navigate(`/project/${projectId}/trade/${nextTrade.id}/questions`);
      } else {
        console.log('All detected trades complete, navigating to results');
        navigate(`/project/${projectId}/result`);
      }
    } catch (err) {
      console.error('Error generating LV:', err);
      setError(err.message);
      setSubmitting(false);
    }
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
          <p className="mt-4 text-white">Adaptive Fragen werden vorbereitet...</p>
        </div>
      </div>
    );
  }
  
  // Error State
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md text-center">
          <h3 className="text-xl font-semibold text-red-300 mb-2">Fehler aufgetreten</h3>
          <p className="text-red-200 mb-4">{error}</p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => window.location.reload()} 
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Seite neu laden
            </button>
            <button 
              onClick={() => navigate(`/project/${projectId}/intake`)} 
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
            >
              Zurück zum Projekt
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // No Questions State
  if (!questions || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-6 text-center">
          <h3 className="text-xl font-semibold text-yellow-300 mb-2">Keine Fragen verfügbar</h3>
          <p className="text-yellow-200 mb-4">
            Für das Gewerk {tradeName || `(ID: ${tradeId})`} konnten keine Fragen generiert werden.
          </p>
          <button 
            onClick={() => navigate(`/project/${projectId}/result`)} 
            className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
          >
            Zum Ergebnis
          </button>
        </div>
      </div>
    );
  }
  
  const currentQ = questions[current];
  const progress = ((current + 1) / questions.length) * 100;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-40 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-40 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
            {tradeName || 'Gewerkespezifische Fragen'}
          </h1>
          {tradeCode && (
            <p className="text-gray-400 text-sm">Gewerk-Code: {tradeCode}</p>
          )}
          {projectTrades.length > 0 && (
            <p className="text-gray-300 mt-2">
              Erkanntes Gewerk {currentTradeIndex + 1} von {projectTrades.length}
            </p>
          )}
        </div>

        {/* Trade Progress - nur erkannte Gewerke */}
        {projectTrades.length > 1 && (
          <div className="flex justify-center mb-8 space-x-2">
            {projectTrades.map((trade, idx) => (
              <div
                key={trade.id}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx < currentTradeIndex
                    ? 'bg-teal-500'
                    : idx === currentTradeIndex
                    ? 'bg-white ring-2 ring-teal-400'
                    : 'bg-white/30'
                }`}
                title={`${trade.code} - ${trade.name}`}
              />
            ))}
          </div>
        )}

        {/* Progress Bar für aktuelle Fragen */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>Frage {current + 1} von {questions.length}</span>
            <span>{Math.round(progress)}% abgeschlossen</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2 backdrop-blur">
            <div 
              className="bg-gradient-to-r from-teal-500 to-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 mb-6">
          {currentQ.category && (
            <div className="text-teal-400 text-sm font-medium mb-3">
              {currentQ.category}
            </div>
          )}
          
          <h2 className="text-2xl font-semibold text-white mb-6">
            {currentQ.text || currentQ.question || currentQ.q || 'Frage'}
          </h2>
          
          {/* Answer Input */}
          {currentQ.type === 'select' && currentQ.options ? (
            <select
              className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
            >
              <option value="" className="bg-slate-800">Bitte wählen...</option>
              {currentQ.options.map((opt, idx) => (
                <option key={idx} value={opt} className="bg-slate-800">{opt}</option>
              ))}
            </select>
          ) : currentQ.type === 'number' ? (
            <input
              type="number"
              className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Ihre Antwort..."
            />
          ) : (
            <textarea
              className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={4}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Ihre Antwort..."
            />
          )}
          
          {/* Assumption Field */}
          <div className="mt-6">
            <label className="block text-gray-300 text-sm mb-2">
              Annahme (optional)
            </label>
            <input
              type="text"
              value={assumption}
              onChange={(e) => setAssumption(e.target.value)}
              className="w-full bg-white/10 backdrop-blur border border-white/30 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Falls Sie eine Annahme treffen müssen..."
            />
          </div>
          
          {currentQ.required && (
            <p className="text-red-400 text-sm mt-3">* Diese Frage ist erforderlich</p>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={current === 0}
            className="px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            ← Zurück
          </button>
          
          <div className="text-center">
            <p className="text-gray-400 text-sm">
              Schritt 2 von 3 • Adaptive Befragung
            </p>
          </div>
          
          <button
            onClick={handleNext}
            disabled={submitting || (!answerText.trim() && currentQ.required !== false)}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Wird gespeichert...
              </span>
            ) : (
              current + 1 < questions.length ? 'Weiter →' : 'Abschließen & LV generieren'
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            <strong>ℹ️ Adaptive Befragung:</strong> Die Fragen wurden basierend auf Ihren Intake-Antworten 
            und dem spezifischen Gewerk angepasst. Nach Abschluss wird automatisch ein VOB-konformes 
            Leistungsverzeichnis erstellt.
          </p>
        </div>
      </div>
    </div>
  );
}
