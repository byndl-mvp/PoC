import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function ProjectFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    category: '',
    subCategory: '',
    description: '',
    timeframe: '',
    budget: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/projects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: form.category,
          subCategory: form.subCategory,
          description: form.description,
          timeframe: form.timeframe,
          budget: form.budget ? Number(form.budget) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Fehler beim Anlegen des Projekts');
      }
      const data = await res.json();
      const { project } = data;
      const projectId = project.id;
      
      // WICHTIG: Navigiere IMMER zuerst zu Intake-Fragen!
      navigate(`/project/${projectId}/intake`);
      
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Projekt anlegen</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 font-medium">Hauptkategorie *</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            required
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Bitte wählen</option>
            <option value="Umbau">Umbau</option>
            <option value="Neubau">Neubau</option>
            <option value="Sanierung">Sanierung</option>
            <option value="Modernisierung">Modernisierung</option>
            <option value="Anbau">Anbau</option>
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Unterkategorie</label>
          <input
            type="text"
            name="subCategory"
            value={form.subCategory}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
            placeholder="z.B. Badrenovierung, Dachsanierung, Küche"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Freitextbeschreibung *</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            className="w-full border rounded px-3 py-2"
            rows={4}
            placeholder="Beschreiben Sie Ihr Vorhaben möglichst detailliert..."
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Gewünschter Ausführungszeitraum</label>
          <select
            name="timeframe"
            value={form.timeframe}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Keine Angabe</option>
            <option value="asap">So bald wie möglich</option>
            <option value="1mon">Innerhalb 1 Monat</option>
            <option value="3mon">In 3 Monaten</option>
            <option value="6mon">In 6 Monaten</option>
            <option value="year">Innerhalb eines Jahres</option>
            <option value="planning">Noch in Planung</option>
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Budget (optional)</label>
          <input
            type="number"
            name="budget"
            value={form.budget}
            onChange={handleChange}
            className="w-full border rounded px-3 py-2"
            placeholder="Ihr geplantes Budget in EUR"
            min="0"
            step="100"
          />
        </div>
        {error && <p className="text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700 disabled:opacity-50 w-full"
        >
          {loading ? 'Projekt wird angelegt...' : 'Projekt anlegen und weiter →'}
        </button>
      </form>
    </div>
  );
}
