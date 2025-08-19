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

  useEffect(() => {
    async function fetchOrGenerateQuestions() {
      try {
        setLoading(true);
        
        // Erst versuchen Fragen abzurufen
        let res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/questions`));
        
        // Wenn keine Fragen existieren, generiere sie
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
        setAnswers([]); // Reset answers array
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
    
    // Speichere aktuelle Antwort im Array
    const newAnswers = [...answers];
    newAnswers[current] = {
      questionId: questions[current].id,
      answer: answerText,
      assumption: assumption
    };
    setAnswers(newAnswers);
    
    // Reset input fields
    setAnswerText('');
    setAssumption('');
    
    if (current + 1 < questions.length) {
      // Nächste Frage
      setCurrent(current + 1);
    } else {
      // Alle Fragen beantwortet - speichere alle Antworten
      saveAllAnswersAndContinue(newAnswers);
    }
  };

  async function saveAllAnswersAndContinue(allAnswers) {
    try {
      setSubmitting(true);
      
      // Speichere alle Antworten auf einmal
      const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/answers`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: allAnswers })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Speichern der Antworten');
      }
      
      // Generiere LV
      await generateLvAndContinue();
      
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function generateLvAndContinue() {
    try {
      // Generate LV for current trade
      const res = await fetch(apiUrl(`/api/projects/${projectId}/trades/${tradeId}/lv`), { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Generieren des LV');
      }
      
      // Get project details to find next trade
      const projectRes = await fetch(apiUrl(`/api/projects/${projectId}`));
      if (!projectRes.ok) {
        const data = await projectRes.json();
        throw new Error(data.error || 'Fehler beim Abrufen der Projektdaten');
      }
      
      const projectData = await projectRes.json();
      const trades = projectData.trades || [];
      
      // Find index of current trade
      const idx = trades.findIndex((t) => String(t.id) === String(tradeId));
      
      // Navigate to next trade if exists
      if (idx !== -1 && idx + 1 < trades.length) {
        const nextTrade = trades[idx + 1];
        navigate(`/project/${projectId}/trade/${nextTrade.id}/questions`);
      } else {
        // Navigate to result page
        navigate(`/project/${projectId}/result`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  }

  if (loading) return <p>Lade Fragen...</p>;
  if (error) return <p className="text-red-600">Fehler: {error}</p>;
  if (!questions.length) return <p>Keine Fragen verfügbar.</p>;
  
  const currentQ = questions[current];
  
  return (
    <div className="max-w-xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">
        Frage {current + 1} von {questions.length}
      </h2>
      <div className="mb-4">
        <p className="font-medium mb-2">{currentQ.text || currentQ.question}</p>
        <textarea
          className="w-full border rounded px-3 py-2"
          rows={3}
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          placeholder="Ihre Antwort"
        />
      </div>
      <div className="mb-4">
        <label className="block font-medium mb-1">Annahme (optional)</label>
        <input
          type="text"
          value={assumption}
          onChange={(e) => setAssumption(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="Kennzeichnen Sie Annahmen"
        />
      </div>
      <button
        onClick={handleNext}
        disabled={submitting || !answerText.trim()}
        className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 disabled:opacity-50"
      >
        {submitting ? 'Speichern...' : (current + 1 < questions.length ? 'Weiter' : 'Abschließen')}
      </button>
    </div>
  );
}
