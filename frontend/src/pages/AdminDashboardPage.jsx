import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

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
  const [rejectDialogs, setRejectDialogs] = useState({});
  const [deleteDialogs, setDeleteDialogs] = useState({});
  const [rejectReasons, setRejectReasons] = useState({});
  const [deleteReasons, setDeleteReasons] = useState({});
  const [selectedHandwerker, setSelectedHandwerker] = useState(null);
  const [selectedBauherr, setSelectedBauherr] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({});
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

const fetchHandwerkerDetails = async (id) => {
  setLoading(true);
  try {
    const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/handwerker/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Fehler beim Laden');
    const data = await res.json();
    setSelectedHandwerker(data);
    setEditedData(data.handwerker);
    setEditMode(false);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

const fetchBauherrDetails = async (id) => {
  setLoading(true);
  try {
    const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/bauherren/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Fehler beim Laden');
    const data = await res.json();
    setSelectedBauherr(data);
    setEditedData(data.bauherr);
    setEditMode(false);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

const updateHandwerker = async () => {
  try {
    const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/handwerker/${selectedHandwerker.handwerker.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(editedData)
    });
    
    if (!res.ok) throw new Error('Update fehlgeschlagen');
    
    setMessage('✅ Handwerker erfolgreich aktualisiert');
    setEditMode(false);
    await fetchHandwerkerDetails(selectedHandwerker.handwerker.id);
    await fetchUsers();
    setTimeout(() => setMessage(''), 3000);
  } catch (err) {
    setError(err.message);
  }
};

const updateBauherr = async () => {
  try {
    const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/bauherren/${selectedBauherr.bauherr.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(editedData)
    });
    
    if (!res.ok) throw new Error('Update fehlgeschlagen');
    
    setMessage('✅ Bauherr erfolgreich aktualisiert');
    setEditMode(false);
    await fetchBauherrDetails(selectedBauherr.bauherr.id);
    await fetchUsers();
    setTimeout(() => setMessage(''), 3000);
  } catch (err) {
    setError(err.message);
  }
};

const deleteHandwerker = async (id, companyName) => {
  if (!window.confirm(`Wirklich löschen?\n\nFirma: ${companyName}\n\nAlle Daten werden unwiderruflich gelöscht!`)) {
    return;
  }
  
  try {
    const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/handwerker/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Löschen fehlgeschlagen');
    
    setMessage('✅ Handwerker erfolgreich gelöscht');
    setSelectedHandwerker(null);
    await fetchUsers();
    setTimeout(() => setMessage(''), 3000);
  } catch (err) {
    setError(err.message);
  }
};

const deleteBauherr = async (id, name) => {
  if (!window.confirm(`Wirklich löschen?\n\n${name}\n\nAlle Projekte und Daten werden unwiderruflich gelöscht!`)) {
    return;
  }
  
  try {
    const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/bauherren/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Löschen fehlgeschlagen');
    
    setMessage('✅ Bauherr erfolgreich gelöscht');
    setSelectedBauherr(null);
    await fetchUsers();
    setTimeout(() => setMessage(''), 3000);
  } catch (err) {
    setError(err.message);
  }
};

  const deleteProject = async (id, description) => {
  if (!window.confirm(`Wirklich löschen?\n\nProjekt #${id}\n${description}\n\nAlle zugehörigen Daten werden unwiderruflich gelöscht!`)) {
    return;
  }
  
  try {
    const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/projects/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Löschen fehlgeschlagen');
    
    setMessage('✅ Projekt erfolgreich gelöscht');
    setProjectDetails(null);
    await fetchProjects();
    setTimeout(() => setMessage(''), 3000);
  } catch (err) {
    setError(err.message);
  }
};
  
  // Action Functions
  // Ersetze die alte verifyHandwerker Funktion komplett mit:
const verifyHandwerker = async (id, action, reason = '') => {
  try {
    const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/verify-handwerker/${id}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ action, reason })
    });
    
    if (!res.ok) throw new Error('Aktion fehlgeschlagen');
    
    const messages = {
      approve: '✅ Handwerker erfolgreich verifiziert!',
      reject: '⚠️ Handwerker zur Nachbesserung aufgefordert',
      delete: '🗑️ Handwerker vollständig entfernt'
    };
    
    setMessage(messages[action]);
    
    // Dialoge zurücksetzen
    setRejectDialogs({});
    setDeleteDialogs({});
    setRejectReasons({});
    setDeleteReasons({});
    
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
    { id: 'payments', label: 'Zahlungsverwaltung', icon: '💳' },
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
        
        {/* Desktop Navigation - Zwei Zeilen */}
        <nav className="hidden lg:block">
          {/* Erste Zeile */}
          <div className="flex space-x-1 mb-2">
            {tabItems.slice(0, 5).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-teal-500 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span className="text-sm">{tab.label}</span>
              </button>
            ))}
          </div>
          {/* Zweite Zeile */}
          <div className="flex space-x-1">
            {tabItems.slice(5).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-teal-500 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <span className="text-sm">{tab.icon}</span>
                <span className="text-sm">{tab.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Tablet Navigation - Drei Zeilen für mittlere Bildschirme */}
        <nav className="hidden md:block lg:hidden">
          <div className="flex flex-wrap gap-1">
            {tabItems.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 text-xs ${
                  activeTab === tab.id
                    ? 'bg-teal-500 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
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

{/* Mobile Navigation - Scrollbar mit allen Tabs */}
<div className="md:hidden bg-white/5 border-b border-white/10">
  <div className="overflow-x-auto">
    <div className="flex p-2 gap-2 min-w-max">
      {tabItems.map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-3 py-2 rounded-lg font-medium whitespace-nowrap flex items-center gap-2 text-sm ${
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
            className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20 hover:bg-white/15 transition-colors"
          >
            <div 
              className="flex justify-between items-start cursor-pointer"
              onClick={() => fetchProjectDetails(project.id)}
            >
              <div className="flex-1">
                <h3 className="font-semibold text-white">Projekt #{project.id}</h3>
                <p className="text-white/70 text-sm mt-1">
                  {project.category} {project.sub_category && `- ${project.sub_category}`}
                </p>
                <p className="text-white/50 text-xs mt-2">
                  {project.trade_names || 'Keine Gewerke'}
                </p>
                {/* Zeitstempel hinzufügen */}
                <p className="text-white/40 text-xs mt-1">
                  Erstellt: {new Date(project.created_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
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
            {/* Lösch-Button */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteProject(project.id, project.description || 'Kein Beschreibung');
                }}
                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-sm transition-colors"
              >
                🗑️ Projekt löschen
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div>
      {projectDetails ? (
        <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-bold text-white">
                Projekt #{projectDetails.project?.id} Details
              </h3>
              {/* Zeitstempel in Details */}
              {projectDetails.project?.created_at && (
                <p className="text-white/50 text-sm mt-1">
                  Erstellt: {new Date(projectDetails.project.created_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>
            <button
              onClick={() => deleteProject(
                projectDetails.project?.id, 
                projectDetails.project?.description || 'Keine Beschreibung'
              )}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"
            >
              🗑️ Löschen
            </button>
          </div>
          
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
                  <p className="text-white/70 text-sm">ID: {hw.company_id || 'PENDING'}</p>
                  <p className="text-white/70 text-sm">Kontakt: {hw.contact_person}</p>
                  <p className="text-white/70 text-sm">E-Mail: {hw.email}</p>
                  <p className="text-white/70 text-sm">Telefon: {hw.phone}</p>
                  <p className="text-white/70 text-sm">
                    Registriert: {new Date(hw.created_at).toLocaleDateString('de-DE')}
                  </p>
                  {hw.rejection_reason && (
                    <div className="mt-2 p-2 bg-red-500/20 rounded">
                      <p className="text-red-300 text-sm">
                        <span className="font-semibold">Vorheriger Grund:</span> {hw.rejection_reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => verifyHandwerker(hw.id, 'approve')}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                >
                  ✓ Genehmigen
                </button>
                
                <button
                  onClick={() => setRejectDialogs({...rejectDialogs, [hw.id]: true})}
                  className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg"
                >
                  ⚠ Nachbesserung
                </button>
                
                <button
                  onClick={() => setDeleteDialogs({...deleteDialogs, [hw.id]: true})}
                  className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                >
                  ✗ Löschen
                </button>
              </div>
            </div>
            
            {/* Ablehnungs-Dialog */}
            {rejectDialogs[hw.id] && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
                  <h3 className="text-xl font-bold text-white mb-4">Nachbesserung erforderlich</h3>
                  <textarea
                    value={rejectReasons[hw.id] || ''}
                    onChange={(e) => setRejectReasons({...rejectReasons, [hw.id]: e.target.value})}
                    placeholder="z.B. Gewerbeschein fehlt..."
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    rows="4"
                  />
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => verifyHandwerker(hw.id, 'reject', rejectReasons[hw.id])}
                      disabled={!rejectReasons[hw.id]?.trim()}
                      className="flex-1 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-lg"
                    >
                      Ablehnen
                    </button>
                    <button
                      onClick={() => setRejectDialogs({...rejectDialogs, [hw.id]: false})}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Lösch-Dialog */}
            {deleteDialogs[hw.id] && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
                  <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Handwerker löschen?</h3>
                  <p className="text-white mb-4">{hw.company_name} wird vollständig entfernt.</p>
                  <textarea
                    value={deleteReasons[hw.id] || ''}
                    onChange={(e) => setDeleteReasons({...deleteReasons, [hw.id]: e.target.value})}
                    placeholder="Optional: Grund..."
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    rows="3"
                  />
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => verifyHandwerker(hw.id, 'delete', deleteReasons[hw.id])}
                      className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
                    >
                      Löschen
                    </button>
                    <button
                      onClick={() => setDeleteDialogs({...deleteDialogs, [hw.id]: false})}
                      className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              </div>
            )}
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
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-800/90">
                <tr className="border-b border-white/20">
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Projekte</th>
                </tr>
              </thead>
              <tbody>
                {users.bauherren?.map(user => (
                  <tr 
                    key={user.id} 
                    className="border-b border-white/10 hover:bg-white/5 cursor-pointer"
                    onClick={() => fetchBauherrDetails(user.id)}
                  >
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
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-800/90">
                <tr className="border-b border-white/20">
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Firma</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/70">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.handwerker?.map(user => (
                  <tr 
                    key={user.id} 
                    className="border-b border-white/10 hover:bg-white/5 cursor-pointer"
                    onClick={() => fetchHandwerkerDetails(user.id)}
                  >
                    <td className="px-4 py-3 text-sm text-white">{user.company_name}</td>
                    <td className="px-4 py-3 text-sm text-white/70">{user.company_id}</td>
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
    
    {/* Handwerker Details Modal */}
{selectedHandwerker && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-slate-800 border-b border-white/20 p-6 flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">
          {selectedHandwerker.handwerker.company_name}
        </h2>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg"
              >
                Bearbeiten
              </button>
              <button
                onClick={() => deleteHandwerker(
                  selectedHandwerker.handwerker.id,
                  selectedHandwerker.handwerker.company_name
                )}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
              >
                🗑️ Löschen
              </button>
            </>
          ) : (
                <>
                  <button
                    onClick={updateHandwerker}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setEditedData(selectedHandwerker.handwerker);
                    }}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
                  >
                    Abbrechen
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedHandwerker(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
              >
                Schließen
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Basis Informationen */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Basis Informationen</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/70 text-sm">Firmenname</label>
                  <input
                    type="text"
                    value={editedData.company_name || ''}
                    onChange={(e) => setEditedData({...editedData, company_name: e.target.value})}
                    disabled={!editMode}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm">Firma ID</label>
                  <input
                    type="text"
                    value={editedData.company_id || ''}
                    onChange={(e) => setEditedData({...editedData, company_id: e.target.value})}
                    disabled={!editMode}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm">Kontaktperson</label>
                  <input
                    type="text"
                    value={editedData.contact_person || ''}
                    onChange={(e) => setEditedData({...editedData, contact_person: e.target.value})}
                    disabled={!editMode}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm">E-Mail</label>
                  <input
                    type="email"
                    value={editedData.email || ''}
                    onChange={(e) => setEditedData({...editedData, email: e.target.value})}
                    disabled={!editMode}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm">Telefon</label>
                  <input
                    type="tel"
                    value={editedData.phone || ''}
                    onChange={(e) => setEditedData({...editedData, phone: e.target.value})}
                    disabled={!editMode}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm">Status</label>
                  <select
                    value={editedData.verified ? 'verified' : 'pending'}
                    onChange={(e) => setEditedData({...editedData, verified: e.target.value === 'verified'})}
                    disabled={!editMode}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  >
                    <option value="verified">Verifiziert</option>
                    <option value="pending">Ausstehend</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Adresse */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Adresse</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-white/70 text-sm">Straße</label>
                  <input
                    type="text"
                    value={editedData.street || ''}
                    onChange={(e) => setEditedData({...editedData, street: e.target.value})}
                    disabled={!editMode}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm">Hausnummer</label>
                  <input
                    type="text"
                    value={editedData.house_number || ''}
                    onChange={(e) => setEditedData({...editedData, house_number: e.target.value})}
                    disabled={!editMode}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm">PLZ</label>
                  <input
                    type="text"
                    value={editedData.zip_code || ''}
                    onChange={(e) => setEditedData({...editedData, zip_code: e.target.value})}
                    disabled={!editMode}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm">Stadt</label>
                  <input
                    type="text"
                    value={editedData.city || ''}
                    onChange={(e) => setEditedData({...editedData, city: e.target.value})}
                    disabled={!editMode}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
            
            {/* Gewerke */}
            {selectedHandwerker.trades?.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Gewerke</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedHandwerker.trades.map((trade, idx) => (
                    <span key={idx} className="px-3 py-1 bg-teal-500/20 text-teal-300 rounded-lg">
                      {trade.trade_name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    
    {/* Bauherr Details Modal */}
{selectedBauherr && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-slate-800 border-b border-white/20 p-6 flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">
          {selectedBauherr.bauherr.name}
        </h2>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg"
              >
                Bearbeiten
              </button>
              <button
                onClick={() => deleteBauherr(
                  selectedBauherr.bauherr.id,
                  selectedBauherr.bauherr.name
                )}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
              >
                🗑️ Löschen
              </button>
            </>
          ) : (
            <>
              <button
                onClick={updateBauherr}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg"
              >
                Speichern
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  setEditedData(selectedBauherr.bauherr);
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg"
              >
                Abbrechen
              </button>
            </>
          )}
          <button
            onClick={() => setSelectedBauherr(null)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
          >
            Schließen
          </button>
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        {/* Basis Informationen */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Kontaktdaten</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-white/70 text-sm">Name</label>
              <input
                type="text"
                value={editedData.name || ''}
                onChange={(e) => setEditedData({...editedData, name: e.target.value})}
                disabled={!editMode}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm">E-Mail</label>
              <input
                type="email"
                value={editedData.email || ''}
                onChange={(e) => setEditedData({...editedData, email: e.target.value})}
                disabled={!editMode}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-white/70 text-sm">Telefon</label>
              <input
                type="tel"
                value={editedData.phone || ''}
                onChange={(e) => setEditedData({...editedData, phone: e.target.value})}
                disabled={!editMode}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white disabled:opacity-50"
              />
            </div>
          </div>
        </div>
        
        {/* Projekte */}
        {selectedBauherr.projects?.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Projekte ({selectedBauherr.projects.length})
            </h3>
            <div className="space-y-2">
              {selectedBauherr.projects.map(project => (
                <div key={project.id} className="bg-white/10 rounded-lg p-4">
                  <p className="text-white font-medium">{project.category} - {project.sub_category}</p>
                  <p className="text-white/70 text-sm">{project.description}</p>
                  <p className="text-teal-400 text-sm">Budget: {formatCurrency(project.budget)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  )}
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

            {/* Tenders Tab - ERWEITERT */}
{activeTab === 'tenders' && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-4">Ausschreibungen</h2>
    
    <div className="space-y-4">
      {tenders.map(tender => (
        <div key={tender.id} className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-white">
                {tender.project_description} - {tender.trade_name}
              </h3>
              <p className="text-gray-400 text-sm mt-1">
                Projekt #{tender.project_id} | Erstellt: {new Date(tender.created_at).toLocaleDateString('de-DE')}
              </p>
              <p className="text-gray-400 text-sm">
                Frist: {new Date(tender.deadline).toLocaleDateString('de-DE')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-teal-400 font-semibold">
                {formatCurrency(tender.estimated_value)}
              </p>
              <p className="text-sm text-gray-400">
                {tender.offer_count || 0} Angebote
              </p>
              <span className={`text-xs px-2 py-1 rounded mt-2 inline-block ${
                tender.status === 'open' ? 'bg-green-600 text-green-200' :
                tender.status === 'closed' ? 'bg-gray-600 text-gray-300' :
                'bg-yellow-600 text-yellow-200'
              }`}>
                {tender.status}
              </span>
            </div>
          </div>
        </div>
      ))}
      
      {tenders.length === 0 && (
        <p className="text-white/50 text-center">Keine Ausschreibungen vorhanden</p>
      )}
    </div>
  </div>
)}
          </> 
          )}
      </main>
    </div>
  );
}
