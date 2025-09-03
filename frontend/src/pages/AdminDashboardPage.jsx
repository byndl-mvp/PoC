import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [lvs, setLvs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const token = localStorage.getItem('adminToken');

  // Check authentication
  useEffect(() => {
    if (!token) {
      navigate('/admin');
    }
  }, [token, navigate]);

  // Fetch initial data based on active tab
  useEffect(() => {
    const fetchData = async () => {
      if (token) {
        switch(activeTab) {
          case 'projects':
            await fetchProjects();
            break;
          case 'prompts':
            await fetchPrompts();
            break;
          case 'lvs':
            await fetchLVs();
            break;
          case 'analytics':
            await fetchAnalytics();
            break;
          default:
            break;
        }
      }
    };
    
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeTab]);

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/projects/detailed', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Projekte');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectDetails = async (projectId) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/projects/${projectId}/full`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Projektdetails');
      const data = await res.json();
      setSelectedProject(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrompts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/prompts/full', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Prompts');
      const data = await res.json();
      setPrompts(data.prompts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchLVs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/lvs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Fehler beim Laden der LVs');
      const data = await res.json();
      setLvs(data.lvs || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updatePrompt = async (promptId, content, name) => {
    try {
      const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/prompts/${promptId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content, name }),
      });
      if (!res.ok) throw new Error('Fehler beim Aktualisieren des Prompts');
      setMessage('Prompt erfolgreich aktualisiert');
      setEditingPrompt(null);
      fetchPrompts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePrompt = async (promptId) => {
    if (!window.confirm('Prompt wirklich löschen?')) return;
    
    try {
      const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/prompts/${promptId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Fehler beim Löschen des Prompts');
      setMessage('Prompt erfolgreich gelöscht');
      fetchPrompts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin');
  };

  const tabItems = [
    { id: 'projects', label: 'Projekte', icon: '📋' },
    { id: 'prompts', label: 'Prompts', icon: '📝' },
    { id: 'lvs', label: 'LVs', icon: '📊' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-2xl font-bold text-white">
                byndl <span className="text-teal-400 text-sm">Admin</span>
              </Link>
              
              {/* Tab Navigation */}
              <nav className="hidden md:flex space-x-1">
                {tabItems.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-teal-500 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="mr-2">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <button
              onClick={logout}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Navigation */}
      <div className="md:hidden bg-white/5 border-b border-white/10">
        <div className="flex overflow-x-auto p-2">
          {tabItems.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap mr-2 ${
                activeTab === tab.id
                  ? 'bg-teal-500 text-white'
                  : 'text-white/70 bg-white/10'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {message && (
          <div className="mb-4 bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-3">
            <p className="text-green-300">{message}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
          </div>
        ) : (
          <>
            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div className="grid lg:grid-cols-2 gap-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Projekte</h2>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20 hover:bg-white/15 transition-colors cursor-pointer"
                        onClick={() => fetchProjectDetails(project.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-white">
                              Projekt #{project.id}
                            </h3>
                            <p className="text-white/70 text-sm mt-1">
                              {project.category} {project.sub_category && `- ${project.sub_category}`}
                            </p>
                            <p className="text-white/50 text-xs mt-2">
                              {project.trade_names || 'Keine Gewerke'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-teal-400 text-sm">
                              {project.budget ? `${project.budget.toLocaleString()} €` : 'Kein Budget'}
                            </span>
                            <div className="flex gap-2 mt-2 text-xs">
                              <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                                {project.trade_count || 0} Gewerke
                              </span>
                              <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded">
                                {project.lv_count || 0} LVs
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  {selectedProject ? (
                    <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                      <h3 className="text-xl font-bold text-white mb-4">
                        Projekt #{selectedProject.project?.id} Details
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-white/70 text-sm">Beschreibung</label>
                          <p className="text-white">{selectedProject.project?.description}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-white/70 text-sm">Zeitrahmen</label>
                            <p className="text-white">{selectedProject.project?.timeframe || 'Nicht angegeben'}</p>
                          </div>
                          <div>
                            <label className="text-white/70 text-sm">Budget</label>
                            <p className="text-white">
                              {selectedProject.project?.budget 
                                ? `${selectedProject.project.budget.toLocaleString()} €` 
                                : 'Nicht angegeben'}
                            </p>
                          </div>
                        </div>

                        {/* Trades */}
                        <div>
                          <h4 className="text-white font-semibold mb-2">Gewerke & Q&A</h4>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {selectedProject.trades?.map((trade) => (
                              <details key={trade.id} className="bg-white/5 rounded-lg p-3">
                                <summary className="cursor-pointer text-white hover:text-teal-400">
                                  {trade.name}
                                </summary>
                                <div className="mt-2 pl-4 text-white/70 text-sm">
                                  <p>Q&A Details würden hier angezeigt...</p>
                                </div>
                              </details>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20 flex items-center justify-center h-[400px]">
                      <p className="text-white/50">Wählen Sie ein Projekt aus der Liste</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prompts Tab */}
            {activeTab === 'prompts' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Prompt Verwaltung</h2>
                <div className="grid gap-4">
                  {prompts.map((prompt) => (
                    <div key={prompt.id} className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">
                            {prompt.name || `Prompt #${prompt.id}`}
                          </h3>
                          <div className="flex gap-2 mt-2">
                            <span className="bg-teal-500/20 text-teal-300 px-2 py-1 rounded text-xs">
                              {prompt.type}
                            </span>
                            {prompt.trade_name && (
                              <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs">
                                {prompt.trade_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingPrompt(prompt)}
                            className="text-teal-400 hover:text-teal-300"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={() => deletePrompt(prompt.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                      
                      {editingPrompt?.id === prompt.id && (
                        <div className="mt-4 space-y-3">
                          <input
                            type="text"
                            value={editingPrompt.name || ''}
                            onChange={(e) => setEditingPrompt({...editingPrompt, name: e.target.value})}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                            placeholder="Prompt Name"
                          />
                          <textarea
                            value={editingPrompt.content}
                            onChange={(e) => setEditingPrompt({...editingPrompt, content: e.target.value})}
                            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                            rows="10"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => updatePrompt(prompt.id, editingPrompt.content, editingPrompt.name)}
                              className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg"
                            >
                              Speichern
                            </button>
                            <button
                              onClick={() => setEditingPrompt(null)}
                              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LVs Tab */}
            {activeTab === 'lvs' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Leistungsverzeichnisse</h2>
                <div className="grid gap-4">
                  {lvs.map((lv) => (
                    <div key={`${lv.project_id}-${lv.trade_id}`} className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-white">
                            {lv.trade_name} - Projekt #{lv.project_id}
                          </h3>
                          <p className="text-white/70 text-sm mt-1">
                            {lv.project_description}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-teal-400 font-semibold">
                            {lv.total_sum ? `${Number(lv.total_sum).toLocaleString()} €` : 'N/A'}
                          </p>
                          <p className="text-white/50 text-xs mt-1">
                            {lv.position_count || 0} Positionen
                          </p>
                          <div className={`mt-2 px-2 py-1 rounded text-xs inline-block ${
                            lv.qualityScore > 80 ? 'bg-green-500/20 text-green-300' :
                            lv.qualityScore > 50 ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-red-500/20 text-red-300'
                          }`}>
                            Qualität: {lv.qualityScore}%
                          </div>
                        </div>
                      </div>
                      {lv.issues?.length > 0 && (
                        <div className="mt-2 text-yellow-300 text-sm">
                          Issues: {lv.issues.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && analytics && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Analytics Dashboard</h2>
                
                {/* Stats Cards */}
                <div className="grid md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <h3 className="text-white/70 text-sm">Gesamt Projekte</h3>
                    <p className="text-3xl font-bold text-white mt-2">
                      {analytics.projects?.total_projects || 0}
                    </p>
                    <p className="text-teal-400 text-sm mt-1">
                      +{analytics.projects?.last_week || 0} diese Woche
                    </p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <h3 className="text-white/70 text-sm">Durchschn. Budget</h3>
                    <p className="text-3xl font-bold text-white mt-2">
                      {analytics.projects?.avg_budget 
                        ? `${Math.round(analytics.projects.avg_budget).toLocaleString()} €`
                        : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <h3 className="text-white/70 text-sm">Aktive Gewerke</h3>
                    <p className="text-3xl font-bold text-white mt-2">
                      {analytics.trades?.length || 0}
                    </p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <h3 className="text-white/70 text-sm">Prompts</h3>
                    <p className="text-3xl font-bold text-white mt-2">
                      {analytics.prompts?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Trade Stats */}
                <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-4">Gewerke Statistiken</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-white">
                      <thead>
                        <tr className="border-b border-white/20">
                          <th className="text-left py-2">Gewerk</th>
                          <th className="text-right py-2">Projekte</th>
                          <th className="text-right py-2">LVs</th>
                          <th className="text-right py-2">Ø LV-Wert</th>
                          <th className="text-right py-2">Completion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.trades?.map((trade) => {
                          const completion = analytics.completion?.find(c => c.trade_name === trade.name);
                          return (
                            <tr key={trade.code} className="border-b border-white/10">
                              <td className="py-2">{trade.name}</td>
                              <td className="text-right">{trade.usage_count || 0}</td>
                              <td className="text-right">{trade.lv_count || 0}</td>
                              <td className="text-right">
                                {trade.avg_lv_value 
                                  ? `${Math.round(trade.avg_lv_value).toLocaleString()} €`
                                  : '-'}
                              </td>
                              <td className="text-right">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  completion?.completion_rate > 80 ? 'bg-green-500/20 text-green-300' :
                                  completion?.completion_rate > 50 ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-red-500/20 text-red-300'
                                }`}>
                                  {completion?.completion_rate || 0}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
