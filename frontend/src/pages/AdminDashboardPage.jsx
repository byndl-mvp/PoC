import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [filterStatus] = useState('all');
  const [editingPrompt, setEditingPrompt] = useState(null);
  
  // Data States
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    totalRevenue: 0,
    activeOrders: 0,
    pendingPayments: 0,
    verificationQueue: 0
  });
  
  const [users, setUsers] = useState({ bauherren: [], handwerker: [] });
  const [projects, setProjects] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [lvs, setLvs] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [pendingHandwerker, setPendingHandwerker] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const token = localStorage.getItem('adminToken');

  // Authentication Check
  useEffect(() => {
    if (!token) {
      navigate('/admin');
    }
  }, [token, navigate]);

  // Fetch Functions with useCallback
  const fetchOverviewStats = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Statistiken');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, [token]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Nutzer');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/projects/detailed', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Projekte');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const fetchProjectDetails = useCallback(async (projectId) => {
    setLoading(true);
    try {
      const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/projects/${projectId}/full`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Projektdetails');
      const data = await res.json();
      setProjectDetails(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchPrompts = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/prompts/full', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Prompts');
      const data = await res.json();
      setPrompts(data.prompts || []);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const fetchLVs = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/lvs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der LVs');
      const data = await res.json();
      setLvs(data.lvs || []);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Analytics');
      const data = await res.json();
      setAnalytics(data);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/payments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Zahlungen');
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const fetchPendingHandwerker = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/pending-handwerker', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Verifizierungen');
      const data = await res.json();
      setPendingHandwerker(data);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Aufträge');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const fetchTenders = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/tenders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Ausschreibungen');
      const data = await res.json();
      setTenders(data.tenders || []);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  // Main Data Fetching Effect
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError('');
      
      try {
        switch(activeTab) {
          case 'overview':
            await fetchOverviewStats();
            break;
          case 'users':
            await fetchUsers();
            break;
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
          case 'payments':
            await fetchPayments();
            break;
          case 'handwerker-verify':
            await fetchPendingHandwerker();
            break;
          case 'orders':
            await fetchOrders();
            break;
          case 'tenders':
            await fetchTenders();
            break;
          default:
            break;
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filterStatus, token]);

  // Action Functions
  const verifyHandwerker = async (id, approved) => {
    try {
      const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/verify-handwerker/${id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ approved })
      });
      if (!res.ok) throw new Error('Verifizierung fehlgeschlagen');
      
      setMessage(approved ? '✅ Handwerker verifiziert!' : '❌ Handwerker abgelehnt');
      await fetchPendingHandwerker();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
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
      await fetchPrompts();
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

  // Tab Configuration
  const tabItems = [
    { id: 'overview', label: 'Übersicht', icon: '📊' },
    { id: 'projects', label: 'Projekte', icon: '🗂️' },
    { id: 'users', label: 'Nutzer', icon: '👥' },
    { id: 'prompts', label: 'Prompts', icon: '🔧' },
    { id: 'lvs', label: 'LVs', icon: '📋' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'handwerker-verify', label: 'Verifizierungen', icon: '✅' },
    { id: 'payments', label: 'Zahlungen', icon: '💳' },
    { id: 'orders', label: 'Aufträge', icon: '📦' },
    { id: 'tenders', label: 'Ausschreibungen', icon: '📄' },
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
              
              {/* Desktop Navigation */}
              <nav className="hidden lg:flex space-x-1">
                {tabItems.slice(0, 6).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                      activeTab === tab.id
                        ? 'bg-teal-500 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-4">
              {pendingHandwerker.length > 0 && (
                <button 
                  onClick={() => setActiveTab('handwerker-verify')}
                  className="relative p-2 text-white/70 hover:text-white"
                >
                  <span className="text-xl">🔔</span>
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {pendingHandwerker.length}
                  </span>
                </button>
              )}
              <button
                onClick={logout}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-300 px-4 py-2 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="lg:hidden bg-white/5 border-b border-white/10 overflow-x-auto">
        <div className="flex p-2 gap-2">
          {tabItems.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-teal-500 text-white'
                  : 'text-white/70 bg-white/10'
              }`}
            >
              <span>{tab.icon}</span>
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
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Dashboard Übersicht</h2>
                
                {/* Stats Grid */}
                <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                    <p className="text-xs text-white/70 mt-1">Gesamte Nutzer</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-2xl font-bold text-white">{stats.totalProjects}</p>
                    <p className="text-xs text-white/70 mt-1">Projekte</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-2xl font-bold text-white">€{stats.totalRevenue?.toLocaleString()}</p>
                    <p className="text-xs text-white/70 mt-1">Umsatz</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-2xl font-bold text-white">{stats.activeOrders}</p>
                    <p className="text-xs text-white/70 mt-1">Aktive Aufträge</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-2xl font-bold text-white">{stats.pendingPayments}</p>
                    <p className="text-xs text-white/70 mt-1">Offene Zahlungen</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-2xl font-bold text-white">{pendingHandwerker.length}</p>
                    <p className="text-xs text-white/70 mt-1">Verifizierungen</p>
                  </div>
                </div>
              </div>
            )}

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
                            <h3 className="font-semibold text-white">Projekt #{project.id}</h3>
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
                  {projectDetails ? (
                    <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                      <h3 className="text-xl font-bold text-white mb-4">
                        Projekt #{projectDetails.project?.id} Details
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-white/70 text-sm">Beschreibung</label>
                          <p className="text-white">{projectDetails.project?.description}</p>
                        </div>
                        
                        {/* Q&A Section */}
                        <div>
                          <h4 className="text-white font-semibold mb-2">Fragen & Antworten</h4>
                          
                          {projectDetails.intakeQuestions && projectDetails.intakeQuestions.length > 0 && (
                            <details className="bg-white/5 rounded-lg p-3 mb-2">
                              <summary className="cursor-pointer text-white hover:text-teal-400">
                                Intake-Fragen ({projectDetails.intakeQuestions.length})
                              </summary>
                              <div className="mt-2 pl-4 space-y-2">
                                {projectDetails.intakeQuestions.map((qa, idx) => (
                                  <div key={idx} className="border-l-2 border-teal-400/30 pl-3">
                                    <p className="text-white/90 text-sm font-medium">{qa.question_text}</p>
                                    <p className="text-green-300 text-xs mt-1">✓ {qa.answer_text}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                          
                          {projectDetails.trades?.map((trade) => {
                            const tradeAnswers = projectDetails.tradeAnswers?.filter(
                              answer => answer.trade_code === trade.code
                            ) || [];
                            
                            return (
                              <details key={trade.id} className="bg-white/5 rounded-lg p-3">
                                <summary className="cursor-pointer text-white hover:text-teal-400">
                                  {trade.name} ({tradeAnswers.length} Fragen)
                                </summary>
                                <div className="mt-2 pl-4 space-y-2">
                                  {tradeAnswers.map((answer, idx) => (
                                    <div key={idx} className="border-l-2 border-teal-400/30 pl-3">
                                      <p className="text-white/90 text-sm font-medium">{answer.question_text}</p>
                                      <p className="text-green-300 text-xs mt-1">✓ {answer.answer_text}</p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            );
                          })}
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
                    <details key={`${lv.project_id}-${lv.trade_id}`} className="bg-white/10 backdrop-blur rounded-lg border border-white/20">
                      <summary className="p-4 cursor-pointer hover:bg-white/5 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-white">
                              {lv.trade_name} - Projekt #{lv.project_id}
                            </h3>
                            <p className="text-white/70 text-sm mt-1">{lv.project_description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-teal-400 font-semibold">
                              {lv.total_sum ? `${Number(lv.total_sum).toLocaleString('de-DE', {style: 'currency', currency: 'EUR'})}` : 'Keine Summe'}
                            </p>
                            <p className="text-white/50 text-xs mt-1">
                              {lv.position_count || 0} Positionen
                            </p>
                          </div>
                        </div>
                      </summary>
                      
                      <div className="p-4 border-t border-white/10">
                        <h4 className="text-white font-semibold mb-3">Einzelpositionen:</h4>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {lv.content?.positions?.map((pos, idx) => (
                            <div key={idx} className="bg-white/5 rounded p-3">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-white font-medium">
                                    {pos.positionNumber || idx + 1}. {pos.title || 'Position'}
                                  </p>
                                  <p className="text-white/70 text-sm mt-1">{pos.description}</p>
                                  <div className="flex gap-4 mt-2 text-xs text-white/50">
                                    <span>Menge: {pos.quantity} {pos.unit}</span>
                                    <span>EP: {pos.unitPrice ? `${Number(pos.unitPrice).toFixed(2)} €` : 'N/A'}</span>
                                  </div>
                                </div>
                                <p className="text-teal-400 font-semibold">
                                  {pos.totalPrice ? `${Number(pos.totalPrice).toLocaleString('de-DE', {style: 'currency', currency: 'EUR'})}` : 'N/A'}
                                </p>
                              </div>
                            </div>
                          ))}
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
                
                <div className="grid md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <h3 className="text-white/70 text-sm">Gesamt Projekte</h3>
                    <p className="text-3xl font-bold text-white mt-2">
                      {analytics.projects?.total_projects || 0}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <h3 className="text-white/70 text-sm">Durchschn. Budget</h3>
                    <p className="text-3xl font-bold text-white mt-2">
                      {analytics.projects?.avg_budget ? `${Math.round(analytics.projects.avg_budget).toLocaleString()} €` : 'N/A'}
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

                <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                  <h3 className="text-xl font-bold text-white mb-4">Gewerke Statistiken</h3>
                  <div className="space-y-2">
                    {analytics.trades?.map((trade) => (
                      <div key={trade.code} className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{trade.name}</span>
                          <div className="flex gap-8 text-sm">
                            <div className="text-center">
                              <p className="text-white/50">Projekte</p>
                              <p className="text-white font-semibold">{trade.usage_count || 0}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-white/50">LVs</p>
                              <p className="text-white font-semibold">{trade.lv_count || 0}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Handwerker Verification Tab */}
            {activeTab === 'handwerker-verify' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Handwerker-Verifizierungen</h2>
                
                {pendingHandwerker.length === 0 ? (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-8 border border-white/20 text-center">
                    <p className="text-white/50">Keine ausstehenden Verifizierungen</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {pendingHandwerker.map((hw) => (
                      <div key={hw.id} className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-white text-lg">{hw.company_name}</h3>
                            <div className="mt-2 space-y-1">
                              <p className="text-white/70 text-sm">ID: {hw.company_id}</p>
                              <p className="text-white/70 text-sm">Kontakt: {hw.contact_person}</p>
                              <p className="text-white/70 text-sm">E-Mail: {hw.email}</p>
                              <p className="text-white/70 text-sm">Telefon: {hw.phone}</p>
                              <p className="text-white/70 text-sm">
                                Registriert: {new Date(hw.created_at).toLocaleDateString('de-DE')}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => verifyHandwerker(hw.id, true)}
                              className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                            >
                              ✓ Verifizieren
                            </button>
                            <button
                              onClick={() => verifyHandwerker(hw.id, false)}
                              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                            >
                              ✗ Ablehnen
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-4">Nutzerverwaltung</h2>
                
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Bauherren */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Bauherren</h3>
                    <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/20">
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Email</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Projekte</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.bauherren?.map(user => (
                              <tr key={user.id} className="border-b border-white/10 hover:bg-white/5">
                                <td className="px-4 py-3 text-sm text-white">{user.name}</td>
                                <td className="px-4 py-3 text-sm text-white/70">{user.email}</td>
                                <td className="px-4 py-3 text-sm text-white">{user.project_count || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Handwerker */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Handwerker</h3>
                    <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/20">
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Firma</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.handwerker?.map(user => (
                              <tr key={user.id} className="border-b border-white/10 hover:bg-white/5">
                                <td className="px-4 py-3 text-sm text-white">{user.company_name}</td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    user.verified 
                                      ? 'bg-green-500/20 text-green-300' 
                                      : 'bg-yellow-500/20 text-yellow-300'
                                  }`}>
                                    {user.verified ? 'Verifiziert' : 'Ausstehend'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Zahlungen</h2>
                <div className="bg-white/10 backdrop-blur rounded-lg p-8 border border-white/20">
                  <p className="text-white/50 text-center">
                    {payments.length > 0 ? `${payments.length} Zahlungen vorhanden` : 'Keine Zahlungen vorhanden'}
                  </p>
                </div>
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Aufträge</h2>
                <div className="bg-white/10 backdrop-blur rounded-lg p-8 border border-white/20">
                  <p className="text-white/50 text-center">
                    {orders.length > 0 ? `${orders.length} Aufträge vorhanden` : 'Keine Aufträge vorhanden'}
                  </p>
                </div>
              </div>
            )}

            {/* Tenders Tab */}
            {activeTab === 'tenders' && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Ausschreibungen</h2>
                <div className="bg-white/10 backdrop-blur rounded-lg p-8 border border-white/20">
                  <p className="text-white/50 text-center">
                    {tenders.length > 0 ? `${tenders.length} Ausschreibungen vorhanden` : 'Keine Ausschreibungen vorhanden'}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
