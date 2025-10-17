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

  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [expandedExplanations, setExpandedExplanations] = useState({});
  const [cachedExplanations, setCachedExplanations] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [processingUploads, setProcessingUploads] = useState({});
  
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

  // Fake Progress für Antworten-Analyse (45 Sekunden)
  useEffect(() => {
    if (analyzingAnswers) {
      setAnalyzeProgress(0);
      const totalDuration = 45000; // 45 Sekunden
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

  // NEUE FUNKTION einfügen nach den useEffect Hooks (ca. Zeile 150):
const toggleDetailedExplanation = async () => {
  const questionId = currentQ.id || `q-${current}`;
  
  // Wenn bereits expanded, einfach zuklappen
  if (expandedExplanations[questionId]) {
    setExpandedExplanations(prev => ({
      ...prev,
      [questionId]: false
    }));
    return;
  }
  
  // Wenn bereits im Cache, einfach aufklappen
  if (cachedExplanations[questionId]) {
    setExpandedExplanations(prev => ({
      ...prev,
      [questionId]: true
    }));
    return;
  }
  
  // Sonst: Lade die Details
  try {
    setLoadingExplanation(true);
    
    // Hole INT trade für Intake
    const tradesRes = await fetch(apiUrl('/api/trades'));
    const trades = await tradesRes.json();
    const intTrade = trades.find(t => t.code === 'INT');
    
    const response = await fetch(
      apiUrl(`/api/projects/${projectId}/trades/${intTrade.id}/question-explanation`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: currentQ.question || currentQ.text,
          questionId: questionId,
          shortExplanation: currentQ.explanation || '',
          questionCategory: currentQ.category
        })
      }
    );
    
    if (response.ok) {
      const details = await response.json();
      setCachedExplanations(prev => ({
        ...prev,
        [questionId]: details
      }));
      setExpandedExplanations(prev => ({
        ...prev,
        [questionId]: true
      }));
    }
  } catch (error) {
    console.error('Error loading explanation:', error);
  } finally {
    setLoadingExplanation(false);
  }
};

const handleFileUpload = async (questionId, file) => {
  if (!file) return;
  
  if (file.size > 10 * 1024 * 1024) {
    alert('Datei zu groß (max. 10MB)');
    return;
  }
  
  setProcessingUploads(prev => ({ ...prev, [questionId]: true }));
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('questionId', String(questionId || ''));
  formData.append('questionText', String(questions.find(q => q.id === questionId)?.question || ''));
  formData.append('tradeCode', 'INTAKE');
  formData.append('projectId', String(projectId || ''));
  formData.append('tradeId', '0');
  
  try {
    // ✅ WICHTIG: apiUrl() verwenden statt relativer Pfad
    const response = await fetch(apiUrl('/api/analyze-file'), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.extractedAnswer) {
      // Antwort automatisch setzen
      setAnswers(prev => ({
        ...prev,
        [questionId]: result.extractedAnswer
      }));
      
      // Upload-Info speichern
      setUploadedFiles(prev => ({
        ...prev,
        [questionId]: {
          name: file.name,
          analysis: result.analysis,
          confidence: result.confidence
        }
      }));
    } else {
      alert('Keine Antwort aus der Datei extrahiert');
    }
  } catch (error) {
    console.error('Upload failed:', error);
    alert(`Fehler bei der Dateianalyse: ${error.message}`);
  } finally {
    setProcessingUploads(prev => ({ ...prev, [questionId]: false }));
  }
};
  
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

  const handleAskQuestion = async () => {
  if (!userQuestion.trim()) return;
  
  try {
    setLoadingResponse(true);
    
    // Für Intake: Hole INT trade ID
    const tradesRes = await fetch(apiUrl('/api/trades'));
    const trades = await tradesRes.json();
    const intTrade = trades.find(t => t.code === 'INT');
    
    const response = await fetch(
      apiUrl(`/api/projects/${projectId}/trades/${intTrade.id}/question-clarification`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: currentQ.question || currentQ.text,
          questionContext: currentQ.explanation || '',
          userQuery: userQuestion
        })
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      setAiResponse(data.response);
    } else {
      setAiResponse('Entschuldigung, ich konnte die Antwort nicht laden. Bitte versuchen Sie es erneut.');
    }
  } catch (error) {
    console.error('Error getting clarification:', error);
    setAiResponse('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
  } finally {
    setLoadingResponse(false);
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

          {/* Kurze Erklärung - IMMER sichtbar */}
{currentQ.explanation && (
  <div className="bg-gradient-to-r from-blue-500/10 to-teal-500/10 border border-blue-500/30 rounded-xl p-5 mt-4 mb-6 backdrop-blur-sm">
    <div className="flex items-start space-x-3">
      <div className="flex-shrink-0">
        <svg className="w-6 h-6 text-blue-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="text-blue-300 font-semibold mb-2 text-base">
          Hinweis zur Frage
        </h3>
        <p className="text-blue-200 text-sm leading-relaxed">
          {currentQ.explanation}
        </p>
      </div>
    </div>
  </div>
)}

{/* Button für ausführliche Erklärung - IMMER SICHTBAR */}
<button
  onClick={toggleDetailedExplanation}
  disabled={loadingExplanation}
  className="mb-4 text-sm bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-300 px-4 py-2 rounded-lg transition-all flex items-center space-x-2"
>
  {loadingExplanation ? (
    <>
      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      <span>Lädt ausführliche Hinweise...</span>
    </>
  ) : (
    <>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>
        {expandedExplanations[currentQ.id || `q-${current}`] ? 'Ausführliche Hinweise ausblenden' : 'Ausführliche Hinweise anzeigen'}
      </span>
    </>
  )}
</button>

{/* Ausführliche Details - wenn geladen (MIT ALLEN FARBIGEN BOXEN) */}
{expandedExplanations[currentQ.id || `q-${current}`] && cachedExplanations[currentQ.id || `q-${current}`] && (
  <div className="space-y-3 animate-fadeIn">
    {/* Haupterklärung */}
    {cachedExplanations[currentQ.id || `q-${current}`].fullExplanation && (
      <div className="bg-gradient-to-r from-blue-500/10 to-teal-500/10 border border-blue-500/30 rounded-xl p-5 backdrop-blur-sm">
        <h4 className="text-blue-300 font-semibold mb-2">Detaillierte Erklärung</h4>
        <p className="text-blue-200 text-sm leading-relaxed whitespace-pre-line">
          {cachedExplanations[currentQ.id || `q-${current}`].fullExplanation}
        </p>
      </div>
    )}
    
    {/* Messanleitung - BLAU */}
    {cachedExplanations[currentQ.id || `q-${current}`].measurementGuide && (
      <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-4">
        <h4 className="text-teal-300 font-medium text-sm mb-2 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          So messen Sie richtig:
        </h4>
        <p className="text-gray-300 text-sm">
          {cachedExplanations[currentQ.id || `q-${current}`].measurementGuide}
        </p>
      </div>
    )}
    
    {/* Produktbeispiele - TEAL */}
    {cachedExplanations[currentQ.id || `q-${current}`].productExamples && (
      <div className="bg-teal-600/10 border border-teal-500/20 rounded-lg p-4">
        <h4 className="text-teal-300 font-medium text-sm mb-2 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Produktbeispiele:
        </h4>
        <p className="text-gray-300 text-sm whitespace-pre-line">
          {cachedExplanations[currentQ.id || `q-${current}`].productExamples}
        </p>
      </div>
    )}
    
    {/* Visuelle Hinweise - PURPLE */}
    {cachedExplanations[currentQ.id || `q-${current}`].visualHint && (
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <h4 className="text-purple-300 font-medium text-sm mb-2 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Visuelle Hinweise:
        </h4>
        <p className="text-purple-200 text-sm">
          {cachedExplanations[currentQ.id || `q-${current}`].visualHint}
        </p>
      </div>
    )}
    
    {/* Häufige Fehler - ORANGE */}
    {cachedExplanations[currentQ.id || `q-${current}`].commonMistakes && (
      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
        <h4 className="text-orange-300 font-medium text-sm mb-2 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Häufige Fehler vermeiden:
        </h4>
        <p className="text-orange-200 text-sm">
          {cachedExplanations[currentQ.id || `q-${current}`].commonMistakes}
        </p>
      </div>
    )}
    
    {/* Empfehlung - GRÜN */}
    {cachedExplanations[currentQ.id || `q-${current}`].defaultRecommendation && (
      <div className="bg-green-600/10 border border-green-500/20 rounded-lg p-4">
        <h4 className="text-green-300 font-medium text-sm mb-1 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Unsere Empfehlung:
        </h4>
        <p className="text-gray-300 text-sm">
          {cachedExplanations[currentQ.id || `q-${current}`].defaultRecommendation}
        </p>
      </div>
    )}
  </div>
)}

{/* Upload-Bereich - OPTIMIERTE POSITION */}
{currentQ.uploadHelpful && (
  <div className="mt-6 mb-6">
    {/* Upload-Hint */}
    {currentQ.uploadHint && (
      <div className="flex items-start bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 backdrop-blur-sm mb-4">
        <svg className="w-5 h-5 mr-3 mt-0.5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"/>
        </svg>
        <span className="text-sm text-blue-200 leading-relaxed">{currentQ.uploadHint}</span>
      </div>
    )}
    
    {/* Upload-Button zentriert */}
    <div className="flex justify-center">
      <input
        type="file"
        accept=".pdf,.xlsx,.xls,.csv,.jpg,.jpeg,.png"
        onChange={(e) => handleFileUpload(currentQ.id, e.target.files[0])}
        id={`upload-${currentQ.id}`}
        className="hidden"
        disabled={processingUploads[currentQ.id]}
      />
      
      <label 
        htmlFor={`upload-${currentQ.id}`}
        className={`inline-flex items-center px-5 py-3 border rounded-lg text-sm font-medium transition-all cursor-pointer
          ${processingUploads[currentQ.id] 
            ? 'bg-white/10 border-white/20 text-gray-400 cursor-not-allowed' 
            : 'bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-white/40 hover:scale-105 backdrop-blur-sm shadow-lg'}`}
      >
        {processingUploads[currentQ.id] ? (
          <>
            <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span>Analysiere Datei...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/>
            </svg>
            <span>Datei hochladen & analysieren</span>
          </>
        )}
      </label>
    </div>
    
    {/* Upload-Status */}
    {uploadedFiles[currentQ.id] && (
      <div className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg backdrop-blur-sm">
        <div className="flex items-start">
          <svg className="w-5 h-5 mr-3 text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/>
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-green-300 mb-1">
              {uploadedFiles[currentQ.id].name}
            </p>
            {uploadedFiles[currentQ.id].analysis && (
              <p className="text-xs text-green-200 leading-relaxed">
                {uploadedFiles[currentQ.id].analysis}
                {uploadedFiles[currentQ.id].confidence && (
                  <span className="ml-2 inline-block px-2 py-0.5 bg-green-500/20 rounded text-green-300">
                    {Math.round(uploadedFiles[currentQ.id].confidence * 100)}% Konfidenz
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>
    )}
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
        
{/* Button für Rückfragen */}
<button
  onClick={() => setShowQuestionDialog(true)}
  className="text-sm text-gray-400 hover:text-white mt-2 flex items-center space-x-1 transition-colors"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
  <span>Rückfrage zu dieser Frage stellen</span>
</button>
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
        {/* Rückfragen-Dialog Modal */}
{showQuestionDialog && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-slate-800 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto border border-slate-700">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-white font-semibold text-lg">
          Rückfrage zur aktuellen Frage
        </h3>
        <button
          onClick={() => {
            setShowQuestionDialog(false);
            setUserQuestion('');
            setAiResponse('');
          }}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="bg-slate-700/50 rounded-lg p-3 mb-4 border border-slate-600">
        <p className="text-gray-300 text-sm">
          <strong>Aktuelle Frage:</strong> {currentQ.question || currentQ.text}
        </p>
      </div>
      
      <textarea
        className="w-full bg-white/10 border border-white/30 rounded-lg p-3 text-white mb-4 focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400"
        rows={3}
        placeholder="Was möchten Sie zu dieser Frage wissen? Z.B. 'Wie messe ich das genau?' oder 'Was bedeutet das?'"
        value={userQuestion}
        onChange={(e) => setUserQuestion(e.target.value)}
        disabled={loadingResponse}
      />
      
      {loadingResponse && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-500 border-t-transparent"></div>
        </div>
      )}
      
      {aiResponse && !loadingResponse && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-start space-x-2">
            <span className="text-2xl">🤖</span>
            <p className="text-blue-200 text-sm flex-1 leading-relaxed">
              {aiResponse}
            </p>
          </div>
        </div>
      )}
      
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => {
            setUserQuestion('');
            setAiResponse('');
          }}
          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          disabled={loadingResponse}
        >
          Neue Frage
        </button>
        <button
          onClick={handleAskQuestion}
          disabled={!userQuestion.trim() || loadingResponse}
          className="px-4 py-2 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loadingResponse ? 'Lädt...' : 'Frage senden'}
        </button>
      </div>
      
      {aiResponse && (
        <p className="text-gray-500 text-xs mt-4 text-center">
          Sie können weitere Rückfragen stellen oder das Fenster schließen
        </p>
      )}
    </div>
  </div>
)}        
      </div>
    </div>
  );
}
