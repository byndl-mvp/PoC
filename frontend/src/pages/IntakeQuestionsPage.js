import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    async function loadIntakeQuestions() {
      try {
        setLoading(true);
        
        // Lade Projektdetails
        const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
        if (!projectRes.ok) throw new Error('Projekt nicht gefunden');
        const projectData = await projectRes.json();
        setProject(projectData);
        
        // Generiere Intake-Fragen
        const res = await fetch(apiUrl(`/api/projects/${projectId}/intake/questions`), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Fehler beim Generieren der Intake-Fragen');
        }
        
        const data = await res.json();
        setQuestions(data.questions || []);
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadIntakeQuestions();
  }, [projectId]);

  const handleNext = () => {
    if (!questions[current]) return;
    
    // Speichere aktuelle Antwort
    const newAnswers = [...answers];
    newAnswers[current] = {
      questionId: questions[current].id,
      answer: answerText
    };
    setAnswers(newAnswers);
    
    if (current + 1 < questions.length) {
      // Nächste Frage
      setCurrent(current + 1);
      setAnswerText('');
    } else {
      // Alle Fragen beantwortet - speichern und weiter
      saveIntakeAnswers(newAnswers);
    }
  };

  async function saveIntakeAnswers(allAnswers) {
    try {
      setSubmitting(true);
      
      // Finde INT Trade ID
      const intTradeRes = await fetch(apiUrl('/api/trades'));
      const trades = await intTradeRes.json();
      const intTrade = trades.find(t => t.code === 'INT');
      
      if (!intTrade) throw new Error('INT Trade nicht gefunden');
      
      // Speichere Intake-Antworten
      const validAnswers = allAnswers.filter(a => a.answer && a.answer.trim());
      
      const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${intTrade.id}/answers`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: validAnswers })
      });
      
      if (!res.ok) throw new Error('Fehler beim Speichern der Antworten');
      
      // Hole Intake-Summary für Empfehlungen (optional anzeigen)
      const summaryRes = await fetch(apiUrl(`/api/projects/${projectId}/intake/summary`));
      if (summaryRes.ok) {
        const summary = await summaryRes.json();
        console.log('Intake Summary:', summary);
      }
      
      // Weiter zu den Gewerkefragen
      if (project?.trades?.length > 0) {
        // Filtere INT Trade raus
        const tradesToProcess = project.trades.filter(t => t.code !== 'INT');
        if (tradesToProcess.length > 0) {
          navigate(`/project/${projectId}/trade/${tradesToProcess[0].id}/questions`);
        } else {
          navigate(`/project/${projectId}/result`);
        }
      } else {
        navigate(`/project/${projectId}/result`);
      }
      
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="max-w-xl mx-auto mt-8">
      <p>Lade Intake-Fragen...</p>
    </div>
  );

  if (error) return (
    <div className="max-w-xl mx-auto mt-8">
      <p className="text-red-600">Fehler: {error}</p>
    </div>
  );

  if (!questions.length) return (
    <div className="max-w-xl mx-auto mt-8">
      <p>Keine Intake-Fragen verfügbar.</p>
    </div>
  );
  
  const currentQ = questions[current];
  const progress = ((current + 1) / questions.length) * 100;
  
  return (
    <div className="max-w-2xl mx-auto mt-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">
          Allgemeine Projektinformationen
        </h1>
        <p className="text-gray-600">
          Schritt 1: Grundlegende Informationen zu Ihrem Bauvorhaben
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Frage {current + 1} von {questions.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Frage */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">
          {currentQ.text || currentQ.question}
        </h2>
        
        {currentQ.type === 'select' && currentQ.options ? (
          <select
            className="w-full border rounded px-3 py-2"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
          >
            <option value="">Bitte wählen...</option>
            {currentQ.options.map((opt, idx) => (
              <option key={idx} value={opt}>{opt}</option>
            ))}
          </select>
        ) : currentQ.type === 'number' ? (
          <input
            type="number"
            className="w-full border rounded px-3 py-2"
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Ihre Antwort"
          />
        ) : (
          <textarea
            className="w-full border rounded px-3 py-2"
            rows={4}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="Ihre Antwort"
          />
        )}
        
        {currentQ.required && (
          <p className="text-sm text-red-600 mt-2">* Pflichtfeld</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => current > 0 && setCurrent(current - 1)}
          disabled={current === 0}
          className="px-4 py-2 border rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ← Zurück
        </button>
        
        <button
          onClick={handleNext}
          disabled={submitting || (currentQ.required && !answerText.trim())}
          className="bg-indigo-600 text-white px-6 py-2 rounded shadow hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting ? 'Speichern...' : (current + 1 < questions.length ? 'Weiter →' : 'Zu den Gewerkefragen →')}
        </button>
      </div>
    </div>
  );
}
