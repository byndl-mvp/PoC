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
      console.log('Projektdetails:', data); // Debug um zu sehen was ankommt
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
      
      // Update successful
      setMessage('Prompt erfolgreich aktualisiert');
      setEditingPrompt(null);
      
      // Force reload of prompts
      await fetchPrompts();
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 5000);
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

                        {/* Gewerke & Q&A */}
<div>
  <h4 className="text-white font-semibold mb-2">Fragen & Antworten</h4>
  
  {/* Intake-Fragen */}
  {selectedProject.intakeQuestions && selectedProject.intakeQuestions.length > 0 && (
    <details className="bg-white/5 rounded-lg p-3 mb-2">
      <summary className="cursor-pointer text-white hover:text-teal-400">
        Intake-Fragen ({selectedProject.intakeQuestions.length} Fragen)
      </summary>
      <div className="mt-2 pl-4 space-y-2">
        {selectedProject.intakeQuestions.map((qa, idx) => (
          <div key={idx} className="border-l-2 border-teal-400/30 pl-3">
            <p className="text-white/90 text-sm font-medium">
              {qa.question_text}
            </p>
            <p className="text-green-300 text-xs mt-1">
              ✓ {qa.answer_text}
            </p>
          </div>
        ))}
      </div>
    </details>
  )}
  
  {/* Gewerke-Fragen */}
  <div className="space-y-2 max-h-[300px] overflow-y-auto">
    {selectedProject.trades?.map((trade) => {
      // Filter Antworten für dieses Gewerk
      const tradeAnswers = selectedProject.tradeAnswers?.filter(
        answer => answer.trade_code === trade.code
      ) || [];
      
      return (
        <details key={trade.id} className="bg-white/5 rounded-lg p-3">
          <summary className="cursor-pointer text-white hover:text-teal-400">
            {trade.name} ({tradeAnswers.length} Fragen)
          </summary>
          <div className="mt-2 pl-4 space-y-2">
            {tradeAnswers.length > 0 ? (
              tradeAnswers.map((answer, idx) => (
                <div key={idx} className="border-l-2 border-teal-400/30 pl-3">
                  <p className="text-white/90 text-sm font-medium">
                    {answer.question_text}
                  </p>
                  <p className="text-green-300 text-xs mt-1">
                    ✓ {answer.answer_text}
                  </p>
                  {answer.assumption && (
                    <p className="text-blue-300 text-xs mt-1">
                      ℹ Annahme: {answer.assumption}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-white/50 text-sm">Keine Fragen vorhanden</p>
            )}
          </div>
        </details>
      );
    })}
  </div>
  
  {/* Gesamt-Statistik */}
  <div className="mt-3 pt-3 border-t border-white/20">
    <p className="text-white/70 text-sm">
      Gesamt: {selectedProject.totalQuestions || 0} Fragen erfasst
    </p>
  </div>
</div>

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
                    <details key={`${lv.project_id}-${lv.trade_id}`} className="bg-white/10 backdrop-blur rounded-lg border border-white/20">
                      <summary className="p-4 cursor-pointer hover:bg-white/5 transition-colors">
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
                              {lv.total_sum && !isNaN(lv.total_sum) 
                                ? `${Number(lv.total_sum).toLocaleString('de-DE', {style: 'currency', currency: 'EUR'})}` 
                                : 'Keine Summe'}
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
                      </summary>
                      
                      {/* LV Details - Einzelpositionen */}
                      <div className="p-4 border-t border-white/10">
                        <h4 className="text-white font-semibold mb-3">Einzelpositionen:</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {lv.content?.positions && Array.isArray(lv.content.positions) ? (
                            lv.content.positions.map((pos, idx) => (
                              <div key={idx} className="bg-white/5 rounded p-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <p className="text-white font-medium">
                                      {pos.positionNumber || idx + 1}. {pos.title || pos.description?.substring(0, 50) || 'Position'}
                                    </p>
                                    <p className="text-white/70 text-sm mt-1">
                                      {pos.description}
                                    </p>
                                    <div className="flex gap-4 mt-2 text-xs text-white/50">
                                      <span>Menge: {pos.quantity} {pos.unit}</span>
                                      <span>EP: {pos.unitPrice ? `${Number(pos.unitPrice).toFixed(2)} €` : 'N/A'}</span>
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <p className="text-teal-400 font-semibold">
                                      {pos.totalPrice ? `${Number(pos.totalPrice).toLocaleString('de-DE', {style: 'currency', currency: 'EUR'})}` : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-white/50">Keine Positionen vorhanden oder Datenformat fehlerhaft</p>
                          )}
                        </div>
                        
                        {/* Summen */}
                        <div className="mt-4 pt-4 border-t border-white/20">
                          <div className="flex justify-between text-white">
                            <span className="font-semibold">Gesamtsumme (Netto):</span>
                            <span className="text-xl font-bold text-teal-400">
                              {lv.content?.totalSum && !isNaN(lv.content.totalSum)
                                ? Number(lv.content.totalSum).toLocaleString('de-DE', {style: 'currency', currency: 'EUR'})
                                : 'Berechnung ausstehend'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </details>
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

                {/* Trade Stats - Expandable */}
                <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-4">Gewerke Statistiken</h3>
                  <div className="space-y-2">
                    {analytics.trades?.map((trade) => {
                      const completion = analytics.completion?.find(c => c.trade_name === trade.name);
                      const tradePrompts = analytics.prompts?.filter(p => p.trade_name === trade.name);
                      
                      return (
                        <details key={trade.code} className="bg-white/5 rounded-lg">
                          <summary className="p-4 cursor-pointer hover:bg-white/10 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <span className="text-white font-medium">{trade.name}</span>
                              </div>
                              <div className="flex gap-8 text-sm">
                                <div className="text-center">
                                  <p className="text-white/50">Projekte</p>
                                  <p className="text-white font-semibold">{trade.usage_count || 0}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-white/50">LVs</p>
                                  <p className="text-white font-semibold">{trade.lv_count || 0}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-white/50">Ø LV-Wert</p>
                                  <p className="text-white font-semibold">
                                    {trade.avg_lv_value 
                                      ? `${Math.round(trade.avg_lv_value).toLocaleString()} €`
                                      : '-'}
                                  </p>
                                </div>
                                <div className="text-center">
                                  <p className="text-white/50">Completion</p>
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    completion?.completion_rate > 80 ? 'bg-green-500/20 text-green-300' :
                                    completion?.completion_rate > 50 ? 'bg-yellow-500/20 text-yellow-300' :
                                    'bg-red-500/20 text-red-300'
                                  }`}>
                                    {completion?.completion_rate || 0}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </summary>
                          
                          {/* Detaillierte Gewerk-Statistik */}
                          <div className="p-4 border-t border-white/10 space-y-4">
                            {/* Performance Metriken */}
                            <div className="grid md:grid-cols-3 gap-4">
                              <div className="bg-white/5 rounded p-3">
                                <h4 className="text-white/70 text-xs uppercase mb-1">Fragen-Status</h4>
                                <p className="text-white text-2xl font-bold">
                                  {completion?.answered_questions || 0} / {completion?.total_questions || 0}
                                </p>
                                <div className="w-full bg-white/20 rounded-full h-2 mt-2">
                                  <div 
                                    className="bg-teal-400 h-2 rounded-full"
                                    style={{width: `${completion?.completion_rate || 0}%`}}
                                  />
                                </div>
                              </div>
                              
                              <div className="bg-white/5 rounded p-3">
                                <h4 className="text-white/70 text-xs uppercase mb-1">LV-Qualität</h4>
                                <p className="text-white text-2xl font-bold">
                                  {trade.lv_count > 0 ? 'Gut' : 'N/A'}
                                </p>
                                <p className="text-white/50 text-xs mt-1">
                                  Ø {trade.avg_position_count || 0} Positionen/LV
                                </p>
                              </div>
                              
                              <div className="bg-white/5 rounded p-3">
                                <h4 className="text-white/70 text-xs uppercase mb-1">Umsatzvolumen</h4>
                                <p className="text-white text-2xl font-bold">
                                  {trade.lv_count && trade.avg_lv_value 
                                    ? `${Math.round(trade.lv_count * trade.avg_lv_value).toLocaleString()} €`
                                    : 'N/A'}
                                </p>
                                <p className="text-white/50 text-xs mt-1">Gesamt aus allen LVs</p>
                              </div>
                            </div>
                            
                            {/* Prompt Performance */}
                            {tradePrompts && tradePrompts.length > 0 && (
                              <div>
                                <h4 className="text-white font-semibold mb-2">Prompt-Effektivität</h4>
                                <div className="space-y-1">
                                  {tradePrompts.map(prompt => (
                                    <div key={prompt.id} className="flex justify-between text-sm">
                                      <span className="text-white/70">{prompt.name}</span>
                                      <div className="flex gap-4">
                                        <span className="text-white/50">
                                          {prompt.usage_count} Nutzungen
                                        </span>
                                        <span className="text-teal-400">
                                          Ø {prompt.avg_position_count ? Math.round(prompt.avg_position_count) : 0} Pos.
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Trend Indikator */}
                            <div className="flex justify-between items-center pt-2 border-t border-white/10">
                              <span className="text-white/50 text-sm">Performance-Trend</span>
                              <div className="flex items-center gap-2">
                                {completion?.completion_rate > 70 ? (
                                  <>
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                    <span className="text-green-400 text-sm">Steigend</span>
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                    </svg>
                                    <span className="text-yellow-400 text-sm">Verbesserung nötig</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </details>
                      );
                    })}
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
