import React, { useEffect, useState } from 'react';

export default function AdminDashboardPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [promptFile, setPromptFile] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [message, setMessage] = useState('');

  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch('https://poc-rvrj.onrender.com/api/admin/projects', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Fehler beim Laden der Projekte');
        }
        const data = await res.json();
        setProjects(data.projects || []);
      } catch (err) {
        console.error(err);
        setMessage(err.message);
      }
    }
    if (token) fetchProjects();
  }, [token]);

  async function selectProject(project) {
  try {
    setLoading(true);

    const res = await fetch(
      `https://poc-rvrj.onrender.com/api/admin/projects/${project.id}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Fehler beim Laden des Projekts');
    }

    const data = await res.json();
    setSelectedProject(data);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}


  async function updatePrompt(e) {
    e.preventDefault();
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filename: promptFile, content: promptContent }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Fehler beim Aktualisieren des Prompts');
      }
      setPromptFile('');
      setPromptContent('');
      setMessage('Prompt gespeichert');
    } catch (err) {
      console.error(err);
      setMessage(err.message);
    }
  }

  if (!token) {
    return <p className="text-red-600">Keine Berechtigung. Bitte loggen Sie sich ein.</p>;
  }

  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h2 className="text-xl font-bold mb-4">Projekte</h2>
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id} className="border rounded px-3 py-2 flex justify-between items-center bg-white shadow">
              <span>
                #{p.id} – {p.category} {p.sub_category && `(${p.sub_category})`}
              </span>
              <button
                onClick={() => selectProject(p)}
                className="text-indigo-600 hover:underline"
              >
                Details
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        {selectedProject ? (
          <div>
            <h2 className="text-xl font-bold mb-4">Projekt #{selectedProject.id} Details</h2>
            <p className="mb-2"><strong>Kategorie:</strong> {selectedProject.category}</p>
            {selectedProject.sub_category && (
              <p className="mb-2"><strong>Unterkategorie:</strong> {selectedProject.sub_category}</p>
            )}
            <p className="mb-2"><strong>Beschreibung:</strong> {selectedProject.description}</p>
            <p className="mb-2"><strong>Zeitraum:</strong> {selectedProject.timeframe || 'n/a'}</p>
            <p className="mb-4"><strong>Budget:</strong> {selectedProject.budget || 'n/a'} EUR</p>
            <h3 className="font-bold mb-2">Gewerke</h3>
            {selectedProject.trades.map((t) => (
              <div key={t.id} className="mb-3">
                <p className="font-semibold">{t.name}</p>
                <h4 className="font-medium">Fragen & Antworten:</h4>
                <ul className="list-disc pl-5">
                  {t.questions.map((q) => (
                    <li key={q.id} className="mb-1">
                      <span className="font-medium">{q.text}</span>
                      {q.answers.length > 0 ? (
                        <ul className="list-disc pl-5">
                          {q.answers.map((a) => (
                            <li key={a.id}>
                              <span className="text-sm">Antwort: {a.answer_text}</span>
                              {a.assumption && (
                                <span className="text-sm text-gray-600"> (Annahme: {a.assumption})</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-gray-600"> – keine Antwort</span>
                      )}
                    </li>
                  ))}
                </ul>
                <h4 className="font-medium mt-2">LVs:</h4>
                {t.lvs.map((lv) => (
                  <pre key={lv.id} className="bg-gray-50 p-2 rounded text-sm whitespace-pre-wrap mb-2">
                    {lv.content}
                  </pre>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p>Wählen Sie ein Projekt aus der Liste.</p>
        )}
        <div className="mt-8">
          <h3 className="text-lg font-bold mb-2">Prompt aktualisieren</h3>
          <form onSubmit={updatePrompt} className="space-y-2">
            <input
              type="text"
              value={promptFile}
              onChange={(e) => setPromptFile(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="Dateiname (z.B. master_prompt.txt)"
              required
            />
            <textarea
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={4}
              placeholder="Inhalt des Prompts"
              required
            ></textarea>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700"
            >
              Speichern
            </button>
          </form>
          {message && <p className="mt-2 text-green-600">{message}</p>}
        </div>
      </div>
    </div>
  );
}
