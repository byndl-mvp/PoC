import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function IntakeQuestionsPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [project, setProject] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [analyzingAnswers, setAnalyzingAnswers] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  
  // Refs für Interval-Cleanup
  const loadingIntervalRef = useRef(null);
  const analyzeIntervalRef = useRef(null);

  // Fake Progress für initiales Laden (45 Sekunden)
  useEffect(() => {
    if (loading && !error) {
      setLoadingProgress(0);
      const totalDuration = 45000; // 45 Sekunden
      const interval = 100; // Update alle 100ms
      const increment = (100 / (totalDuration / interval));
      
      loadingIntervalRef.current = setInterval(() => {
        setLoadingProgress(prev => {
          const next = prev + increment;
          if (next >= 99) {
            clearInterval(loadingIntervalRef.current);
            return 99; // Bleibt bei 99% bis tatsächlich fertig
          }
          return next;
        });
      }, interval);
      
      return () => {
        if (loadingIntervalRef.current) {
          clearInterval(loadingIntervalRef.current);
        }
      };
    }
  }, [loading, error]);

  // Fake Progress für Antworten-Analyse (30 Sekunden)
  useEffect(() => {
    if (analyzingAnswers) {
      setAnalyzeProgress(0);
      const totalDuration = 30000; // 30 Sekunden
      const interval = 100; // Update alle 100ms
      const increment = (100 / (totalDuration / interval));
      
      analyzeIntervalRef.current = setInterval(() => {
        setAnalyzeProgress(prev => {
          const next = prev + increment;
          if (next >= 99) {
            clearInterval(analyzeIntervalRef.current);
            return 99;
          }
          return next;
        });
      }, interval);
      
      return () => {
        if (analyzeIntervalRef.current) {
          clearInterval(analyzeIntervalRef.current);
        }
      };
    }
  }, [analyzingAnswers]);

  useEffect(() => {
    async function loadIntakeQuestions() {
      try {
        setLoading(true);
        
        const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
        if (!projectRes.ok) throw new Error('Projekt nicht gefunden');
        const projectData = await projectRes.json();
        setProject(projectData);
        
        const res = await fetch(apiUrl(`/api/projects/${projectId}/intake/questions`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            detectedTrades: projectData.trades ? projectData.trades.map(t => t.code) : []
          })
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Fehler beim Generieren der allgemeinen Projektfragen');
        }
        
        const data = await res.json();
        setQuestions(data.questions || []);
        
      } catch (err) {
        setError(err.message);
      } finally {
        // Cleanup interval und setze auf 100%
        if (loadingIntervalRef.current) {
          clearInterval(loadingIntervalRef.current);
        }
        setLoadingProgress(100);
        setTimeout(() => {
          setLoading(false);
        }, 200); // Kurze Verzögerung für smooth transition
      }
    }
    loadIntakeQuestions();
    
    // Cleanup on unmount
    return () => {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      if (analyzeIntervalRef.current) clearInterval(analyzeIntervalRef.current);
    };
  }, [projectId]);

  const handleNext = () => {
    if (!questions[current]) return;
    
    const newAnswers = [...answers];
    newAnswers[current] = {
      questionId: questions[current].id,
      answer: answerText
    };
    setAnswers(newAnswers);
    
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
      setAnswerText('');
    } else {
      // Zeige Analyse-Screen vor dem Speichern
      setAnalyzingAnswers(true);
      saveIntakeAnswers(newAnswers);
    }
  };

  const handlePrevious = () => {
    if (current > 0) {
      setCurrent(current - 1);
      setAnswerText(answers[current - 1]?.answer || '');
    }
  };

  const handleSkipQuestion = () => {
    // Speichere "übersprungen" als Antwort
    const newAnswers = [...answers];
    newAnswers[current] = {
      questionId: questions[current].id,
      answer: 'Übersprungen',
      assumption: 'Vom Nutzer übersprungen'
    };
    setAnswers(newAnswers);
    
    if (current + 1 < questions.length) {
      // Gehe zur nächsten Frage
      setCurrent(current + 1);
      setAnswerText('');
    } else {
      // Letzte Frage - Analyse anzeigen und speichern
      setAnalyzingAnswers(true);
      saveIntakeAnswers(newAnswers);
    }
  };
  
  async function saveIntakeAnswers(allAnswers) {
    try {
      setSubmitting(true);
      
      const intTradeRes = await fetch(apiUrl('/api/trades'));
      const allTrades = await intTradeRes.json();
      const intTrade = allTrades.find(t => t.code === 'INT');
      
      if (!intTrade) throw new Error('Allgemeine Projektaufnahme nicht gefunden');
      
      const validAnswers = allAnswers.filter(a => a.answer && a.answer.trim());
      
      const res = await fetch(apiUrl(`/api/projects/${projectId}/intake/answers`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: validAnswers })
      });
      
      if (!res.ok) throw new Error('Fehler beim Speichern der Antworten');
      
      const summaryRes = await fetch(apiUrl(`/api/projects/${projectId}/intake/summary`));
      if (summaryRes.ok) {
        const summary = await summaryRes.json();
        console.log('Projekt-Zusammenfassung:', summary);
      }
      
      const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
      if (!projectRes.ok) throw new Error('Projekt konnte nicht geladen werden');
      
      // Cleanup Analyze interval
      if (analyzeIntervalRef.current) {
        clearInterval(analyzeIntervalRef.current);
      }
      setAnalyzeProgress(100);
      
      // Kurz warten dann navigieren
      setTimeout(() => {
        navigate(`/project/${projectId}/trades`);
      }, 200);
      
    } catch (err) {
      console.error(err);
      setError(err.message);
      setAnalyzingAnswers(false);
      // Cleanup on error
      if (analyzeIntervalRef.current) {
        clearInterval(analyzeIntervalRef.current);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Loading State mit Fortschrittsbalken
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
  <h2 className="text-2xl font-bold text-white mb-6">
    Allgemeine Projektfragen werden vorbereitet...
  </h2>
  <div className="w-64 mx-auto bg-white/20 rounded-full h-3 backdrop-blur mb-4">
            <div className="bg-gradient-to-r from-teal-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out" 
                 style={{ width: `${loadingProgress}%` }} />
          </div>
          <p className="mt-4 text-gray-300">
            {loadingProgress < 30 ? 'Lade Projektdaten...' :
             loadingProgress < 60 ? 'Analysiere Projektkategorie...' :
             loadingProgress < 90 ? 'Generiere angepasste Fragen...' :
             'Fast fertig...'}
          </p>
        </div>
      </div>
    );
  }

  // Analyzing Answers Screen
  if (analyzingAnswers) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-lg mx-auto px-4">
          <h2 className="text-3xl font-bold text-white mb-6">
            Analysiere Ihre Antworten
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Wir identifizieren die relevanten Gewerke für Ihr Projekt...
          </p>
          <div className="w-full bg-white/20 rounded-full h-3 backdrop-blur mb-4">
            <div className="bg-gradient-to-r from-teal-500 to-blue-600 h-3 rounded-full transition-all duration-300 ease-out" 
                 style={{ width: `${analyzeProgress}%` }} />
          </div>
          <p className="mt-4 text-gray-300">
            {analyzeProgress < 25 ? 'Speichere Projektinformationen...' :
             analyzeProgress < 50 ? 'Analysiere Anforderungen...' :
             analyzeProgress < 75 ? 'Identifiziere notwendige Gewerke...' :
             analyzeProgress < 95 ? 'Erstelle Projektzusammenfassung...' :
             'Abgeschlossen!'}
          </p>
        </div>
      </div>
    );
  }

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md">
        <p className="text-red-200">Fehler: {error}</p>
      </div>
    </div>
  );

  if (!questions.length) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <p className="text-white">Keine allgemeinen Projektfragen verfügbar.</p>
    </div>
  );
  
  const currentQ = questions[current];
  const progress = ((current + 1) / questions.length) * 100;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-40 right-20 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-40 left-20 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
            Allgemeine Projektinformationen
          </h1>
          <p className="text-gray-300">
            {project?.category} {project?.sub_category && `- ${project.sub_category}`}
          </p>
        </div>

        {/* Progress */}
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
            {currentQ.text || currentQ.question}
          </h2>

          {/* Explanation wenn vorhanden */}
          {currentQ.explanation && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
              <p className="text-blue-200 text-sm">
                <strong>ℹ️ Hinweis:</strong> {currentQ.explanation}
              </p>
            </div>
          )}
          
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
            <div>
              <input
                type="number"
                className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Ihre Antwort"
              />
              {currentQ.options?.includes('unsicher') && (
                <button
                  onClick={() => setAnswerText('unsicher')}
                  className="mt-2 text-sm text-teal-400 hover:text-teal-300"
                >
                  Ich bin unsicher / weiß nicht
                </button>
              )}
            </div>
          ) : (
            <textarea
              className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              rows={4}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Ihre Antwort"
            />
          )}
          
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
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleSkipQuestion}
              className="text-sm text-gray-400 hover:text-white transition-colors"
              disabled={submitting}
            >
              Frage überspringen →
            </button>
            
            <div className="text-center">
              <p className="text-gray-400 text-sm">
                Schritt 1 von 3
              </p>
            </div>
          </div>
          
          <button
            onClick={handleNext}
            disabled={submitting || (currentQ.required && !answerText.trim())}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Speichern...
              </span>
            ) : (
              current + 1 < questions.length ? 'Weiter →' : 'Zu den Gewerkefragen →'
            )}
          </button>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Diese Informationen helfen uns, die richtigen Gewerke für Ihr Projekt zu identifizieren
          </p>
        </div>
      </div>
    </div>
  );
}
