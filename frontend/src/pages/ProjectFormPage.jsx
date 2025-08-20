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
      
      navigate(`/project/${projectId}/intake`);
      
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Background Effects */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>

      <div className="relative max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
            Projekt anlegen
          </h1>
          <p className="text-xl text-gray-300">
            Beschreiben Sie Ihr Bauvorhaben in wenigen Schritten
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Kategorie */}
            <div>
              <label className="block text-white font-medium mb-2">
                Hauptkategorie *
              </label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="" className="bg-slate-800">Bitte wählen</option>
                <option value="Umbau" className="bg-slate-800">Umbau</option>
                <option value="Neubau" className="bg-slate-800">Neubau</option>
                <option value="Sanierung" className="bg-slate-800">Sanierung</option>
                <option value="Modernisierung" className="bg-slate-800">Modernisierung</option>
                <option value="Anbau" className="bg-slate-800">Anbau</option>
              </select>
            </div>

            {/* Unterkategorie */}
            <div>
              <label className="block text-white font-medium mb-2">
                Unterkategorie
                <span className="text-gray-400 font-normal ml-2">(optional)</span>
              </label>
              <input
                type="text"
                name="subCategory"
                value={form.subCategory}
                onChange={handleChange}
                className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="z.B. Badrenovierung, Dachsanierung, Küche"
              />
            </div>

            {/* Beschreibung */}
            <div>
              <label className="block text-white font-medium mb-2">
                Projektbeschreibung *
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                required
                className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                rows={5}
                placeholder="Beschreiben Sie Ihr Vorhaben möglichst detailliert..."
              />
            </div>

            {/* Zeitrahmen */}
            <div>
              <label className="block text-white font-medium mb-2">
                Gewünschter Ausführungszeitraum
              </label>
              <select
                name="timeframe"
                value={form.timeframe}
                onChange={handleChange}
                className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="" className="bg-slate-800">Keine Angabe</option>
                <option value="asap" className="bg-slate-800">So bald wie möglich</option>
                <option value="1mon" className="bg-slate-800">Innerhalb 1 Monat</option>
                <option value="3mon" className="bg-slate-800">In 3 Monaten</option>
                <option value="6mon" className="bg-slate-800">In 6 Monaten</option>
                <option value="year" className="bg-slate-800">Innerhalb eines Jahres</option>
                <option value="planning" className="bg-slate-800">Noch in Planung</option>
              </select>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-white font-medium mb-2">
                Geplantes Budget
                <span className="text-gray-400 font-normal ml-2">(optional)</span>
              </label>
              <input
                type="number"
                name="budget"
                value={form.budget}
                onChange={handleChange}
                className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Budget in EUR"
                min="0"
                step="100"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
                <p className="text-red-200">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-blue-600 text-white font-semibold py-4 rounded-lg shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Projekt wird angelegt...
                </span>
              ) : (
                'Weiter zu den Projektfragen →'
              )}
            </button>
          </form>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-gray-400">
            Nach der Projekterstellung werden Ihnen intelligente Fragen gestellt,
            um Ihr Leistungsverzeichnis optimal zu erstellen.
          </p>
        </div>
      </div>
    </div>
  );
}
