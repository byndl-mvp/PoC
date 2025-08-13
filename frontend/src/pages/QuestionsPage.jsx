import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function QuestionsPage() {
  const { projectId, tradeId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [assumption, setAssumption] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchQuestions() {
      try {
        setLoading(true);
        const res = await fetch(`https://poc-rvrj.onrender.com/api/questions/${tradeId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Fehler beim Laden der Fragen');
        }
        const data = await res.json();
        setQuestions(data.questions || []);
        setCurrent(0);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, [tradeId]);

  const handleSubmit = async () => {
    if (!questions[current]) return;
    setSubmitting(true);
    try {
      const q = questions[current];
      const res = await fetch(`https://poc-rvrj.onrender.com/api/questions/${tradeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: q.id, answer: answerText, assumption }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Fehler beim Speichern der Antwort');
      }
      // Reset input fields
      setAnswerText('');
      setAssumption('');
      if (current + 1 < questions.length) {
        setCurrent(current + 1);
      } else {
        // All questions answered – generate LV
        await generateLvAndContinue();
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  async function generateLvAndContinue() {
    try {
      // Generate LV for current trade
      const res = await fetch('https://poc-rvrj.onrender.com/api/lv/${tradeId}`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Fehler beim Generieren des LV');
      }
      // Check for next trade
      const tradesRes = await fetch('https://poc-rvrj.onrender.com/api/trades/${projectId}`);
      if (!tradesRes.ok) {
        const data = await tradesRes.json();
        throw new Error(data.message || 'Fehler beim Abrufen der Gewerke');
      }
      const tradeData = await tradesRes.json();
      const trades = tradeData.trades || [];
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

  if (loading) return <p>Lade Fragen …</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (!questions.length) return <p>Keine Fragen verfügbar.</p>;
  const currentQ = questions[current];
  return (
    <div className="max-w-xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Frage {current + 1} von {questions.length}</h2>
      <div className="mb-4">
        <p className="font-medium mb-2">{currentQ.text}</p>
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
        onClick={handleSubmit}
        disabled={submitting || !answerText.trim()}
        className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 disabled:opacity-50"
      >
        {current + 1 < questions.length ? 'Weiter' : 'Abschließen'}
      </button>
    </div>
  );
}
