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
  const [allTrades, setAllTrades] = useState([]);
  const [currentTradeIndex, setCurrentTradeIndex] = useState(0);

  useEffect(() => {
    async function fetchOrGenerateQuestions() {
      try {
        setLoading(true);
        
        // Lade Projektdetails für Trade-Übersicht
        const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          const nonIntTrades = (projectData.trades || []).filter(t => t.code !== 'INT');
          setAllTrades(nonIntTrades);
          const currentIdx = nonIntTrades.findIndex(t => String(t.id) === String(tradeId));
          setCurrentTradeIndex(currentIdx);
        }
        
        // Versuche Fragen abzurufen oder zu generieren
        let res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/questions`));
        
        if (res.status === 404 || !res.ok) {
          res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/questions`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Fehler beim Laden der Fragen');
        }
        
        const data = await res.json();
        setQuestions(data.questions || []);
        
        // Setze Trade-Name
        if (data.questions?.[0]?.tradeName) {
          setTradeName(data.questions[0].tradeName);
        } else if (data.questions?.[0]?.trade_name) {
          setTradeName(data.questions[0].trade_name);
        }
        
        setAnswers([]);
        setCurrent(0);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchOrGenerateQuestions();
  }, [projectId, tradeId]);

  const handleNext = () => {
    if (!questions[current]) return;
    
    const newAnswers = [...answers];
    newAnswers[current] = {
      questionId: questions[current].id || questions[current].question_id,
      answer: answerText,
      assumption: assumption
    };
    setAnswers(newAnswers);
    
    setAnswerText('');
    setAssumption('');
    
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
    } else {
      saveAllAnswersAndContinue(newAnswers);
    }
  };

  const handlePrevious = () => {
    if (current > 0) {
      setCurrent(current - 1);
      setAnswerText(answers[current - 1]?.answer || '');
      setAssumption(answers[current - 1]?.assumption || '');
    }
  };

  async function saveAllAnswersAndContinue(allAnswers) {
    try {
      setSubmitting(true);
      
      const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/answers`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: allAnswers })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Speichern der Antworten');
      }
      
      await generateLvAndContinue();
      
    } catch (err) {
      console.error(err);
      setError(err.message);
      setSubmitting(false);
    }
  }

  async function generateLvAndContinue() {
    try {
      const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv`), { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Generieren des LV');
      }
      
      // Navigation zur nächsten Trade oder Ergebnis
      if (currentTradeIndex !== -1 && currentTradeIndex + 1 < allTrades.length) {
        const nextTrade = allTrades[currentTradeIndex + 1];
        navigate(`/project/${projectId}/trade/${nextTrade.id}/questions`);
      } else {
        navigate(`/project/${projectId}/result`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
        <p className="mt-4 text-white">Fragen werden vorbereitet...</p>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md">
        <p className="text-red-200">Fehler: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Seite neu laden
        </button>
      </div>
    </div>
  );
  
  if (!questions.length) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-6">
        <p className="text-yellow-200">Keine Fragen verfügbar</p>
      </div>
    </div>
  );
  
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
        {/* Header mit Trade-Info */}
        <div className="text-center mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
            {tradeName || 'Gewerkespezifische Fragen'}
          </h1>
          {allTrades.length > 0 && (
            <p className="text-gray-300">
              Gewerk {currentTradeIndex + 1} von {allTrades.length}
            </p>
          )}
        </div>

        {/* Trade Progress Indicators */}
        {allTrades.length > 1 && (
          <div className="flex justify-center mb-8 space-x-2">
            {allTrades.map((trade, idx) => (
              <div
                key={trade.id}
                className={`w-3 h-3 rounded-full ${
                  idx < currentTradeIndex
                    ? 'bg-teal-500'
                    : idx === currentTradeIndex
                    ? 'bg-white'
                    : 'bg-white/30'
                }`}
                title={trade.name}
              />
            ))}
          </div>
        )}

        {/* Progress Bar */}
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
          
          {/* Answer Input basierend auf Typ */}
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
              placeholder="Ihre Antwort"
            />
          ) : currentQ.type === 'multiselect' && currentQ.options ? (
            <div className="space-y-2">
              {currentQ.options.map((opt, idx) => (
                <label key={idx} className="flex items-center text-white">
                  <input
                    type="checkbox"
                    className="mr-3 w-5 h-5 text-teal-500 bg-white/20 border-white/30 rounded focus:ring-teal-500"
                    value={opt}
                    onChange={(e) => {
                      const currentValues = answerText ? answerText.split(', ') : [];
                      if (e.target.checked) {
                        currentValues.push(opt);
                      } else {
                        const index = currentValues.indexOf(opt);
                        if (index > -1) currentValues.splice(index, 1);
                      }
                      setAnswerText(currentValues.join(', '));
                    }}
                    checked={answerText.includes(opt)}
                  />
                  {opt}
                </label>
              ))}
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
          
          {/* Annahme-Feld */}
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
              Schritt 2 von 3
            </p>
          </div>
          
          <button
            onClick={handleNext}
            disabled={submitting || !answerText.trim()}
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
              current + 1 < questions.length ? 'Weiter →' : 'Abschließen & LV generieren'
            )}
          </button>
        </div>

        {/* Info Text */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Nach Abschluss wird automatisch ein VOB-konformes Leistungsverzeichnis erstellt
          </p>
        </div>
      </div>
    </div>
  );
}
