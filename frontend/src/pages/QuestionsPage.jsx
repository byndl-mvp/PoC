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
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [finalProgress, setFinalProgress] = useState(70);
  
  // Skip-Button Funktion
  const handleSkipTrade = async () => {
    if (window.confirm('Möchten Sie die Fragen für dieses Gewerk überspringen?')) {
      // Navigiere zum nächsten Gewerk oder Ergebnis
      if (currentTradeIndex !== -1 && currentTradeIndex + 1 < projectTrades.length) {
        const nextTrade = projectTrades[currentTradeIndex + 1];
        navigate(`/project/${projectId}/trade/${nextTrade.id}/questions`);
      } else {
        navigate(`/project/${projectId}/result`);
      }
    }
  };
  
  useEffect(() => {
    async function initialize() {
      try {
        setLoading(true);
        setLoadingProgress(10);
        setError('');
        setSubmitting(false);
       
        console.log(`Initializing questions for project ${projectId}, trade ${tradeId}`);
        // Prüfe ob es ein zusätzliches Gewerk ist
        const isAdditionalTrade = new URLSearchParams(window.location.search).get('additional') === 'true';
        // Prüfe ob es ein KI-empfohlenes Gewerk ist
        const aiRecommendedTrades = JSON.parse(sessionStorage.getItem('aiRecommendedTrades') || '[]');
        const isAiRecommendedTrade = aiRecommendedTrades.includes(parseInt(tradeId));
        
        console.log('Is AI recommended trade?:', isAiRecommendedTrade); 
        let projectData = null;  // NEU: Deklariere projectData hier
        // 1. Lade Projektdetails und ERKANNTE Gewerke
          const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
          if (projectRes.ok) {
            projectData = await projectRes.json();  // KEIN 'const' mehr!
            console.log('Project data loaded:', projectData);
            console.log('NUMBER OF TRADES:', projectData.trades?.length);
            console.log('TRADE CODES:', projectData.trades?.map(t => t.code));
            
            // WICHTIG: Nur die tatsächlich erkannten Gewerke (ohne INT)
            let detectedTrades = (projectData.trades || []).filter(t => t.code !== 'INT');

            // Manuell hinzugefügte Trades aus sessionStorage ergänzen
const manuallyAddedTradeIds = JSON.parse(sessionStorage.getItem('manuallyAddedTrades') || '[]')
  .map(id => parseInt(id));
if (manuallyAddedTradeIds.length > 0) {
  // Hole die vollständigen Trade-Informationen vom Backend
  const tradesResponse = await fetch(apiUrl('/api/trades'));
  const allTrades = await tradesResponse.json();
  
  for (const manualId of manuallyAddedTradeIds) {
    if (!detectedTrades.find(t => t.id === parseInt(manualId))) {
      const fullTradeInfo = allTrades.find(t => t.id === parseInt(manualId));
      if (fullTradeInfo) {
        detectedTrades.push(fullTradeInfo);
      }
    }
  }
}

console.log('Detected trades for this project:', detectedTrades);
setProjectTrades(detectedTrades);
            
            // Finde den Index des aktuellen Gewerks
            const currentIdx = detectedTrades.findIndex(t => t.id === parseInt(tradeId));
            setCurrentTradeIndex(currentIdx);
            
            // Prüfe ob das aktuelle Trade-ID überhaupt zu diesem Projekt gehört
            const currentTrade = detectedTrades.find(t => t.id === parseInt(tradeId));
            if (!currentTrade) {
              throw new Error(`Gewerk ${tradeId} gehört nicht zu diesem Projekt`);
            }
            
            setTradeName(currentTrade.name);
            setTradeCode(currentTrade.code);
            setLoadingProgress(40);

            // HIER KOMMT DER NEUE BLOCK REIN (nach Zeile 88):
if (isAdditionalTrade || isAiRecommendedTrade) {
  // Bei zusätzlichen oder KI-empfohlenen Gewerken: Nur Kontextfrage generieren
  let contextQuestion;
  
  if (isAiRecommendedTrade) {
    contextQuestion = {
      id: 'context_reason',
      question: `Sie haben die von der KI empfohlenen ${currentTrade.name} ausgewählt. Was genau soll in diesem Bereich gemacht werden?`,
      type: 'text',
      required: true,
      category: 'Projektkontext',
      explanation: 'Basierend auf Ihrer Antwort erstellen wir spezifische Fragen für dieses Gewerk.'
    };
  } else {
    contextQuestion = {
      id: 'context_reason',
      question: `Sie haben nachträglich ${currentTrade.name} ausgewählt. Was genau soll in diesem Bereich gemacht werden?`,
      type: 'text',
      required: true,
      category: 'Projektkontext',
      explanation: 'Basierend auf Ihrer Antwort erstellen wir spezifische Fragen für dieses Gewerk.'
    };
  }
  
  if (!isAiRecommendedTrade) {
  sessionStorage.setItem('currentTradeIsAdditional', 'true');
}
  setQuestions([contextQuestion]);
  setAnswers([null]);
  setCurrent(0);
  setLoading(false);
  setLoadingProgress(100);
  return;
}
            
// 2. Generiere ADAPTIVE Fragen für dieses spezifische Gewerk
        console.log(`Generating adaptive questions for trade ${tradeId} (${tradeCode})...`);
        // Prüfe ob dieses Gewerk manuell hinzugefügt wurde
        const manuallyAddedTrades = JSON.parse(sessionStorage.getItem('manuallyAddedTrades') || '[]');
        const isManuallyAdded = manuallyAddedTrades.includes(parseInt(tradeId));
        
        console.log('sessionStorage content:', sessionStorage.getItem('manuallyAddedTrades'));
        console.log('Current tradeId:', tradeId);
        console.log('Parsed manual trades:', manuallyAddedTrades);
        console.log('Is manually added?:', isManuallyAdded);        
        
        const generateRes = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/questions`), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            includeIntakeContext: true,
            isManuallyAdded: isManuallyAdded,
            isAiRecommended: isAiRecommendedTrade,
            projectDescription: projectData.description,  // projectData, nicht project
            projectCategory: projectData.category,        
            projectBudget: projectData.budget            
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
        setLoadingProgress(90);
        
        // Trade-Info aus Response
        if (data.tradeName) setTradeName(data.tradeName);
        if (data.tradeCode) setTradeCode(data.tradeCode);
        
        // Initialisiere Antworten-Array
        setAnswers(new Array(validQuestions.length).fill(null));
        setCurrent(0);
        // FEHLERFIX: Eingabefelder zurücksetzen
        setAnswerText('');
        setAssumption('');
            
          } else {
            throw new Error('Projekt konnte nicht geladen werden');
          }
  
      } catch (err) {
        console.error('Error in initialization:', err);
        setError(err.message || 'Unbekannter Fehler beim Laden der Fragen');
      } finally {
        setLoadingProgress(100);
        setLoading(false);
      }
    }
    
    initialize();
      
return () => {
      sessionStorage.removeItem('currentTradeIsAdditional');
      sessionStorage.removeItem('aiRecommendedTrades');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, tradeId]);

// Neuer useEffect für finalen Ladebalken

useEffect(() => {
  if (finalizing) {
    const interval = setInterval(() => {
      setFinalProgress(prev => prev < 95 ? prev + 5 : prev);
    }, 400);
    return () => clearInterval(interval);
  }
}, [finalizing]);

  const handleNext = async () => {
    console.log('handleNext called, submitting=', submitting);
    console.log('current=', current, 'questions.length=', questions.length);
    
    if (!questions[current]) return;
    
    // Speichere aktuelle Antwort
    const newAnswers = [...answers];
    newAnswers[current] = {
      questionId: questions[current].id || questions[current].question_id,
      answer: answerText,
      assumption: assumption
    };
    setAnswers(newAnswers);

// NEUE LOGIK: Prüfe ob es ein zusätzliches Gewerk ist
const isAdditionalTrade = new URLSearchParams(window.location.search).get('additional') === 'true';
    if (current === 0 && isAdditionalTrade && questions[current].id === 'context_reason') {
  try {
    setGeneratingQuestions(true);
    
    // Generiere spezifische Fragen basierend auf Kontextantwort
    const response = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/context-questions`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextAnswer: answerText,
        isAdditional: true
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      
      // Ersetze Kontextfrage mit spezifischen Fragen
      setQuestions(data.questions || data);
      const currentUrl = new URL(window.location);
      currentUrl.searchParams.set('additional', 'true');
      window.history.replaceState({}, '', currentUrl);
      setAnswers(new Array(data.questions?.length || data.length).fill(null));
      setCurrent(0);
      setAnswerText('');
      setAssumption('');
      setGeneratingQuestions(false);
      return; // Verhindere weitere Navigation
    }
  } catch (err) {
    console.error('Failed to generate context-based questions:', err);
    setGeneratingQuestions(false);
    setError('Fehler beim Generieren der Folgefragen');
  }
}    
    
    // NEUE LOGIK: Bei erster Frage eines manuellen Gewerks
const isManualTrade = JSON.parse(sessionStorage.getItem('manuallyAddedTrades') || '[]')
  .includes(parseInt(tradeId));

if (current === 0 && isManualTrade && (questions[current].id === 'context_reason' || questions[current].id?.endsWith('-CONTEXT'))) {
  try {
setGeneratingQuestions(true);
  
    // Generiere adaptive Folgefragen basierend auf Kontext
    const response = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/context-questions`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contextAnswer: answerText })
    });
    
    if (response.ok) {
      const data = await response.json();
      // Ersetze aktuelle Fragen mit Kontextfrage + neue Fragen
      const contextQuestion = questions[0];
      const newQuestions = [contextQuestion, ...data.questions];
      setQuestions(newQuestions);
      setAnswers([newAnswers[0], ...new Array(data.questions.length).fill(null)]);
      setCurrent(1);
      setAnswerText('');
      setAssumption('');
      setGeneratingQuestions(false);
      return; // Verhindere weitere Navigation
      
    }
  } catch (err) {
    console.error('Failed to generate context questions:', err);
    setGeneratingQuestions(false);
  }
}    

    // NEUE LOGIK: Bei KI-empfohlenen Gewerken auch Kontextfragen generieren
const isAiRecommended = JSON.parse(sessionStorage.getItem('aiRecommendedTrades') || '[]')
  .includes(parseInt(tradeId));

if (current === 0 && isAiRecommended && questions[current].id === 'context_reason') {
  try {
    setGeneratingQuestions(true);
    
    // Generiere spezifische Fragen basierend auf Kontextantwort
    const response = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/context-questions`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contextAnswer: answerText,
        isAiRecommended: true
      })
    });
    
    if (response.ok) {
      const data = await response.json();

      // HIER DEN DEBUG-LOG EINFÜGEN:
      console.log('[DEBUG] AI-recommended context response:', data);
      console.log('[DEBUG] Questions count:', data.questions?.length || data.length);
      
      // Ersetze Kontextfrage mit spezifischen Fragen
      setQuestions(data.questions || data);
      setAnswers(new Array(data.questions?.length || data.length).fill(null));
      setCurrent(0);
      setAnswerText('');
      setAssumption('');
      setGeneratingQuestions(false);
      return; // Verhindere weitere Navigation
    }
  } catch (err) {
    console.error('Failed to generate AI-recommended context questions:', err);
    setGeneratingQuestions(false);
    setError('Fehler beim Generieren der Folgefragen');
  }
}    
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

  const handleSkipQuestion = () => {
  // Speichere "übersprungen" als Antwort
  const newAnswers = [...answers];
  newAnswers[current] = {
    questionId: questions[current].id || questions[current].question_id,
    answer: 'Übersprungen',
    assumption: 'Vom Nutzer übersprungen'
  };
  setAnswers(newAnswers);
  
  if (current + 1 < questions.length) {
    // Gehe zur nächsten Frage
    setCurrent(current + 1);
    setAnswerText('');
    setAssumption('');
  } else {
    // Letzte Frage - speichern und weiter
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
    console.log('saveAllAnswersAndContinue called');
    try {
      setSubmitting(true);
      console.log('submitting set to true');
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
    console.log('generateLvAndContinue called');
    try {
      console.log('Generating LV for trade:', tradeId);
      
      const lvRes = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv`), { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

// NEUE PRÜFUNG HIER:
    const isAdditionalTrade = new URLSearchParams(window.location.search).get('additional') === 'true' ||
                          sessionStorage.getItem('currentTradeIsAdditional') === 'true';
const isAiRecommended = JSON.parse(sessionStorage.getItem('aiRecommendedTrades') || '[]')
  .includes(parseInt(tradeId));

// NUR bei zusätzlichen Gewerken (NICHT bei KI-empfohlenen) zu Results springen
if (isAdditionalTrade && !isAiRecommended) {
  setFinalizing(true);
  setTimeout(() => {
    navigate(`/project/${projectId}/result`);
  }, 3000);
  return;
}
      
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
        // Finaler Ladebildschirm
  setFinalizing(true);
  setTimeout(() => {
    navigate(`/project/${projectId}/result`);
  }, 3000);
console.log('All detected trades complete, navigating to results');
}
    } catch (err) {
      console.error('Error generating LV:', err);
      setError(err.message);
      setSubmitting(false);
    }
  }

  // Loading State mit Fortschrittsbalken
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-64 bg-white/20 rounded-full h-2 backdrop-blur mb-4">
            <div className="bg-gradient-to-r from-teal-500 to-blue-600 h-2 rounded-full animate-pulse" 
                 style={{ width: `${loadingProgress}%` }} />  
          </div>
          <p className="mt-4 text-white">
  {tradeName ? `Fragen für ${tradeName} werden vorbereitet...` : 'Gewerkespezifische Fragen werden vorbereitet...'}
</p>
        </div>
      </div>
    );
  }
if (finalizing) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center max-w-lg">
        <h2 className="text-3xl font-bold text-white mb-6">Fast fertig!</h2>
        <p className="text-xl text-gray-300 mb-8">
          Wir stellen Ihre Leistungsverzeichnisse zusammen und erstellen die Gesamtkostenübersicht...
        </p>
        <div className="w-full bg-white/20 rounded-full h-3 backdrop-blur">
          <div className="bg-gradient-to-r from-teal-500 to-blue-600 h-3 rounded-full animate-pulse" 
               style={{ width: `${finalProgress}%` }} />  
        </div>
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
          {/* Kompakter Hinweis */}
          <p className="text-gray-400 text-sm mb-4 italic">
            💡 Tipp: Überspringen Sie Fragen, die nicht auf Ihr Projekt zutreffen.
          </p>
          {currentQ.category && (
            <div className="text-teal-400 text-sm font-medium mb-3">
              {currentQ.category}
            </div>
          )}
          
          <h2 className="text-2xl font-semibold text-white mb-6">
            {currentQ.text || currentQ.question || currentQ.q || 'Frage'}
          </h2>
          
          {/* Explanation anzeigen wenn vorhanden */}
          {currentQ.explanation && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mt-4 mb-4">
              <p className="text-blue-200 text-sm">
                <strong>ℹ️ Hinweis:</strong> {currentQ.explanation}
              </p>
            </div>
          )}
          
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
            <div>
              <input
                type="number"
                className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Ihre Antwort..."
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
        
{/* Ladeindikator für Kontextfragen */}
{generatingQuestions && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-teal-500 border-t-transparent mb-4"></div>
      <p className="text-white text-xl font-semibold">Analysiere Ihre Antwort...</p>
      <p className="text-gray-300 mt-2">Erstelle angepasste Fragen für {tradeName}</p>
    </div>
  </div>
)} 
        
        {/* Navigation mit Skip-Button */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePrevious}
            disabled={current === 0}
            className="px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            ← Zurück
          </button>
          
          <button
            onClick={handleSkipTrade}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Gewerk überspringen →
          </button>

          <button
           onClick={handleSkipQuestion}
           className="text-sm text-gray-400 hover:text-white transition-colors"
           disabled={submitting}
          >
           Frage überspringen →
          </button>
          
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
  (questions.length === 1 && questions[0]?.id === 'context_reason') ? 
    'Weiter →' : 
    (current + 1 < questions.length ? 'Weiter →' : 'Abschließen & LV generieren')
)}
          </button>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            <strong>ℹ️ Adaptive Befragung:</strong> Die Fragen wurden basierend auf Ihren Antworten 
            und dem spezifischen Gewerk angepasst. Nach Abschluss wird automatisch ein VOB-konformes 
            Leistungsverzeichnis erstellt.
          </p>
        </div>
      </div>
    </div>
  );
}
