import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import KIAuswertungenTab from './KIAuswertungenTab';

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
  const [offers, setOffers] = useState([]);
  const [nachtraege, setNachtraege] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedTender, setSelectedTender] = useState(null);
  const [selectedNachtrag, setSelectedNachtrag] = useState(null);
  const [pendingHandwerker, setPendingHandwerker] = useState([]);
  
  // Datumsfilter States
  const [dateFilterFrom, setDateFilterFrom] = useState('');
  const [dateFilterTo, setDateFilterTo] = useState('');
  
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
  const [handwerkerDocuments, setHandwerkerDocuments] = useState({});
  
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

  const fetchProjects = useCallback(async (fromDate = null, toDate = null) => {
    try {
      let url = 'https://poc-rvrj.onrender.com/api/admin/projects/detailed?limit=10';
      if (fromDate) url += `&from=${fromDate}`;
      if (toDate) url += `&to=${toDate}`;
      
      const res = await fetch(url, {
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

const fetchHandwerkerDocuments = async (handwerkerId) => {
  try {
    const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/handwerker/${handwerkerId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Fehler beim Laden der Dokumente');
    const data = await res.json();
    
    setHandwerkerDocuments(prev => ({
      ...prev,
      [handwerkerId]: data.documents || []
    }));
  } catch (err) {
    console.error('Fehler beim Laden der Dokumente:', err);
  }
};

const downloadDocument = async (handwerkerId, docId, fileName) => {
  try {
    const res = await fetch(
      `https://poc-rvrj.onrender.com/api/handwerker/${handwerkerId}/documents/${docId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    if (!res.ok) throw new Error('Download fehlgeschlagen');
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    setError('Download fehlgeschlagen: ' + err.message);
  }
};
  
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

  const fetchOffers = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/offers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Angebote');
      const data = await res.json();
      setOffers(data.offers || []);
    } catch (err) {
      setError(err.message);
    }
  }, [token]);

  const fetchNachtraege = useCallback(async () => {
    try {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/nachtraege', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Nachträge');
      const data = await res.json();
      setNachtraege(data.nachtraege || []);
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
          case 'offers':
            await fetchOffers();
            break;
          case 'nachtraege':
            await fetchNachtraege();
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

// NEU: Dokumente laden wenn pendingHandwerker sich ändern
useEffect(() => {
  const loadDocumentsForPending = async () => {
    if (activeTab === 'handwerker-verify' && pendingHandwerker.length > 0) {
      console.log('Lade Dokumente für', pendingHandwerker.length, 'Handwerker');
      for (const hw of pendingHandwerker) {
        await fetchHandwerkerDocuments(hw.id);
      }
    }
  };
  
  loadDocumentsForPending();
}, [pendingHandwerker, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  
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

// Export User Data (DSGVO)
const exportBauherrData = async (bauherrId) => {
  try {
    setLoading(true);
    const res = await fetch(`https://poc-rvrj.onrender.com/api/bauherr/${bauherrId}/export`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Export fehlgeschlagen');
    
    const data = await res.json();
    
    // Konvertiere JSON zu strukturiertem Excel-Format
    // Für jetzt: Download als JSON (Excel-Export kann später implementiert werden)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bauherr-${bauherrId}-daten-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    setMessage('✅ Daten erfolgreich exportiert');
    setTimeout(() => setMessage(''), 3000);
  } catch (err) {
    setError('Fehler beim Datenexport');
  } finally {
    setLoading(false);
  }
};

const exportHandwerkerData = async (handwerkerId) => {
  try {
    setLoading(true);
    const res = await fetch(`https://poc-rvrj.onrender.com/api/handwerker/${handwerkerId}/export`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Export fehlgeschlagen');
    
    const data = await res.json();
    
    // Download als JSON
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `handwerker-${handwerkerId}-daten-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    setMessage('✅ Daten erfolgreich exportiert');
    setTimeout(() => setMessage(''), 3000);
  } catch (err) {
    setError('Fehler beim Datenexport');
  } finally {
    setLoading(false);
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
    { id: 'payments', label: 'Zahlungen', icon: '💳' },
    { id: 'orders', label: 'Aufträge', icon: '📦' },
    { id: 'offers', label: 'Angebote', icon: '💰' },
    { id: 'nachtraege', label: 'Nachträge', icon: '📝' },
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
  <div className="space-y-6">
    {/* Header mit Datumsfilter */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h2 className="text-2xl font-bold text-white">Projekte ({projects.length})</h2>
        <p className="text-white/50 text-sm">Zeigt die letzten 10 Projekte. Nutze den Datumsfilter für ältere.</p>
      </div>
      
      {/* Datumsfilter */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dateFilterFrom}
          onChange={(e) => setDateFilterFrom(e.target.value)}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
        />
        <span className="text-white/50">bis</span>
        <input
          type="date"
          value={dateFilterTo}
          onChange={(e) => setDateFilterTo(e.target.value)}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
        />
        <button
          onClick={() => fetchProjects(dateFilterFrom || null, dateFilterTo || null)}
          className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium"
        >
          🔍 Suchen
        </button>
        {(dateFilterFrom || dateFilterTo) && (
          <button
            onClick={() => { 
              setDateFilterFrom(''); 
              setDateFilterTo(''); 
              fetchProjects(null, null);
            }}
            className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm"
          >
            ✕ Reset
          </button>
        )}
      </div>
    </div>

    <div className="grid lg:grid-cols-2 gap-6">
      <div>
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
          {projects.length === 0 && (
            <p className="text-white/50 text-center py-8">Keine Projekte vorhanden</p>
          )}
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
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-2xl font-bold text-white">Leistungsverzeichnisse ({lvs.length})</h2>
                  
                  {/* Datumsfilter */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={dateFilterFrom}
                      onChange={(e) => setDateFilterFrom(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                    <span className="text-white/50">bis</span>
                    <input
                      type="date"
                      value={dateFilterTo}
                      onChange={(e) => setDateFilterTo(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                    {(dateFilterFrom || dateFilterTo) && (
                      <button
                        onClick={() => { setDateFilterFrom(''); setDateFilterTo(''); }}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm"
                      >
                        ✕ Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4">
                  {lvs
                    .filter(lv => {
                      if (!dateFilterFrom && !dateFilterTo) return true;
                      const lvDate = new Date(lv.created_at);
                      if (dateFilterFrom && lvDate < new Date(dateFilterFrom)) return false;
                      if (dateFilterTo && lvDate > new Date(dateFilterTo + 'T23:59:59')) return false;
                      return true;
                    })
                    .map((lv) => (
                    <details key={`${lv.project_id}-${lv.trade_id}`} className="bg-white/10 backdrop-blur rounded-lg border border-white/20">
                      <summary className="p-4 cursor-pointer hover:bg-white/5 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-white">
                              {lv.trade_name} - Projekt #{lv.project_id}
                            </h3>
                            <p className="text-white/70 text-sm mt-1">{lv.project_description}</p>
                            <p className="text-white/50 text-xs mt-1">
                              Erstellt: {lv.created_at ? new Date(lv.created_at).toLocaleDateString('de-DE') : '-'}
                            </p>
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
                  {lvs.length === 0 && (
                    <p className="text-white/50 text-center py-8">Keine LVs vorhanden</p>
                  )}
                </div>
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && analytics && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white mb-4">Analytics & KI-Genauigkeit</h2>

                {/* Gesamt-Übersicht */}
                <div className="grid md:grid-cols-5 gap-4">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-xs text-white/70">Vergleiche</p>
                    <p className="text-2xl font-bold text-white">{analytics.kiAccuracy?.overall?.total_comparisons || 0}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-purple-500/30">
                    <p className="text-xs text-white/70">Ø Abweichung KI</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {analytics.kiAccuracy?.overall?.overall_avg_abweichung 
                        ? `${parseFloat(analytics.kiAccuracy.overall.overall_avg_abweichung).toFixed(1)}%` 
                        : '-'}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-blue-500/30">
                    <p className="text-xs text-white/70">KI-Schätzungen Summe</p>
                    <p className="text-xl font-bold text-blue-400">
                      {formatCurrency(analytics.kiAccuracy?.overall?.total_ki_schaetzung || 0)}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-teal-500/30">
                    <p className="text-xs text-white/70">Angebote Summe</p>
                    <p className="text-xl font-bold text-teal-400">
                      {formatCurrency(analytics.kiAccuracy?.overall?.total_angebote || 0)}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-green-500/30">
                    <p className="text-xs text-white/70">Auftragsvolumen</p>
                    <p className="text-xl font-bold text-green-400">
                      {formatCurrency(analytics.orderStats?.total_volume || 0)}
                    </p>
                  </div>
                </div>

                {/* KI-Genauigkeit nach Gewerk */}
                {analytics.kiAccuracy?.byTrade?.length > 0 && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-4">KI-Genauigkeit nach Gewerk</h3>
                    <div className="space-y-3">
                      {analytics.kiAccuracy.byTrade.map((trade) => (
                        <div key={trade.trade_code} className="bg-white/5 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-white font-medium">{trade.trade_name}</span>
                              <span className="text-white/50 text-sm ml-2">({trade.offer_count} Angebote)</span>
                            </div>
                            <div className="flex gap-8 text-sm">
                              <div className="text-center">
                                <p className="text-white/50">Ø KI-Schätzung</p>
                                <p className="text-purple-400 font-semibold">{formatCurrency(trade.avg_ki_schaetzung)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-white/50">Ø Angebot</p>
                                <p className="text-teal-400 font-semibold">{formatCurrency(trade.avg_angebot)}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-white/50">Ø Abweichung</p>
                                <p className={`font-semibold ${
                                  parseFloat(trade.avg_abweichung_prozent) > 10 ? 'text-red-400' :
                                  parseFloat(trade.avg_abweichung_prozent) < -10 ? 'text-green-400' :
                                  'text-yellow-400'
                                }`}>
                                  {trade.avg_abweichung_prozent 
                                    ? `${parseFloat(trade.avg_abweichung_prozent) >= 0 ? '+' : ''}${parseFloat(trade.avg_abweichung_prozent).toFixed(1)}%`
                                    : '-'}
                                </p>
                              </div>
                            </div>
                          </div>
                          {/* Progress Bar für Genauigkeit */}
                          <div className="mt-3">
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${
                                  Math.abs(parseFloat(trade.avg_abweichung_prozent || 0)) < 5 ? 'bg-green-500' :
                                  Math.abs(parseFloat(trade.avg_abweichung_prozent || 0)) < 15 ? 'bg-yellow-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${Math.max(10, 100 - Math.abs(parseFloat(trade.avg_abweichung_prozent || 0)))}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversion Funnel */}
                {analytics.conversion && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-4">Conversion Funnel</h3>
                    <div className="flex items-center justify-between">
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-white">{analytics.conversion?.total_tenders || 0}</p>
                        <p className="text-white/50 text-sm">Ausschreibungen</p>
                      </div>
                      <div className="text-2xl text-white/30">→</div>
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-blue-400">{analytics.conversion?.tenders_with_offers || 0}</p>
                        <p className="text-white/50 text-sm">mit Angeboten</p>
                        <p className="text-xs text-blue-400">
                          ({analytics.conversion?.total_tenders > 0 
                            ? ((analytics.conversion?.tenders_with_offers / analytics.conversion?.total_tenders) * 100).toFixed(0) 
                            : 0}% der Ausschreibungen)
                        </p>
                      </div>
                      <div className="text-2xl text-white/30">→</div>
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-purple-400">{analytics.conversion?.total_offers || 0}</p>
                        <p className="text-white/50 text-sm">Angebote gesamt</p>
                        <p className="text-xs text-purple-400">
                          (Ø {analytics.conversion?.tenders_with_offers > 0 
                            ? (analytics.conversion?.total_offers / analytics.conversion?.tenders_with_offers).toFixed(1) 
                            : 0} pro Ausschreibung)
                        </p>
                      </div>
                      <div className="text-2xl text-white/30">→</div>
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-green-400">{analytics.conversion?.accepted_offers || 0}</p>
                        <p className="text-white/50 text-sm">Angenommen</p>
                        <p className="text-xs text-green-400">
                          ({analytics.conversion?.total_offers > 0 
                            ? ((analytics.conversion?.accepted_offers / analytics.conversion?.total_offers) * 100).toFixed(0) 
                            : 0}% Annahmequote)
                        </p>
                      </div>
                      <div className="text-2xl text-white/30">→</div>
                      <div className="text-center flex-1">
                        <p className="text-3xl font-bold text-teal-400">{analytics.conversion?.total_orders || 0}</p>
                        <p className="text-white/50 text-sm">Aufträge</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Nachtrags-Quote und Top Handwerker */}
                <div className="grid md:grid-cols-2 gap-6">
                  {analytics.nachtraegeStats && (
                    <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                      <h3 className="text-xl font-bold text-white mb-4">Nachtrags-Statistik</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                          <span className="text-white/70">Aufträge mit Nachträgen</span>
                          <span className="text-white font-semibold">
                            {analytics.nachtraegeStats?.orders_with_nachtraege || 0} / {analytics.nachtraegeStats?.total_orders || 0}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">Nachtrags-Quote</span>
                          <span className="text-teal-400 font-semibold">
                            {analytics.nachtraegeStats?.total_orders > 0 
                              ? ((analytics.nachtraegeStats?.orders_with_nachtraege / analytics.nachtraegeStats?.total_orders) * 100).toFixed(1) 
                              : 0}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">Nachtrags-Volumen</span>
                          <span className="text-teal-400 font-semibold">
                            {formatCurrency(analytics.nachtraegeStats?.nachtraege_volume || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/70">Anteil am Auftragsvolumen</span>
                          <span className="text-white font-semibold">
                            {analytics.nachtraegeStats?.order_volume > 0 
                              ? ((analytics.nachtraegeStats?.nachtraege_volume / analytics.nachtraegeStats?.order_volume) * 100).toFixed(1) 
                              : 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top Handwerker */}
                  {analytics.topHandwerker?.length > 0 && (
                    <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                      <h3 className="text-xl font-bold text-white mb-4">Top 10 Handwerker (Volumen)</h3>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {analytics.topHandwerker.map((hw, idx) => (
                          <div key={hw.id} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                idx === 0 ? 'bg-yellow-500 text-black' :
                                idx === 1 ? 'bg-gray-300 text-black' :
                                idx === 2 ? 'bg-orange-600 text-white' :
                                'bg-white/20 text-white'
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="text-white">{hw.company_name}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-teal-400 font-semibold">{formatCurrency(hw.total_volume)}</p>
                              <p className="text-white/50 text-xs">{hw.order_count} Aufträge</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Alte Gewerke Stats als Fallback */}
                {!analytics.kiAccuracy && analytics.trades?.length > 0 && (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                    <h3 className="text-xl font-bold text-white mb-4">Gewerke Statistiken</h3>
                    <div className="space-y-2">
                      {analytics.trades.map((trade) => (
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
                )}
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
        {pendingHandwerker.map((hw) => {
          const docs = handwerkerDocuments[hw.id] || [];
          const hasGewerbeschein = docs.some(d => d.document_type === 'gewerbeschein');
          const hasHandwerkskarte = docs.some(d => d.document_type === 'handwerkskarte');
          const missingDocs = !hasGewerbeschein || !hasHandwerkskarte;
          
          return (
            <div key={hw.id} className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
              {/* Kopfbereich */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-white text-lg">{hw.company_name}</h3>
                  <div className="mt-2 space-y-1">
                    <p className="text-white/70 text-sm">ID: {hw.company_id || 'PENDING'}</p>
                    <p className="text-white/70 text-sm">Kontakt: {hw.contact_person}</p>
                    <p className="text-white/70 text-sm">E-Mail: {hw.email}</p>
                    <p className="text-white/70 text-sm">Telefon: {hw.phone}</p>
                    <p className="text-white/70 text-sm">
                      Adresse: {hw.street} {hw.house_number}, {hw.zip_code} {hw.city}
                    </p>
                    <p className="text-white/70 text-sm">
                      Gewerke: {hw.trade_names?.join(', ') || 'Keine'}
                    </p>
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
                    disabled={missingDocs}
                    className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                    title={missingDocs ? 'Pflichtdokumente fehlen!' : 'Handwerker genehmigen'}
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

              {/* NEU: Dokumente-Bereich */}
              <div className="mt-4 pt-4 border-t border-white/20">
                <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                  📄 Hochgeladene Dokumente
                  {missingDocs && (
                    <span className="text-red-400 text-xs bg-red-500/20 px-2 py-1 rounded">
                      ⚠️ Pflichtdokumente fehlen
                    </span>
                  )}
                </h4>
                
                {docs.length === 0 ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-300 text-sm">
                      ⚠️ Keine Dokumente hochgeladen
                    </p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {/* Gewerbeschein */}
                    <div className={`bg-white/5 rounded-lg p-4 border-l-4 ${
                      hasGewerbeschein ? 'border-green-500' : 'border-red-500'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">
                            {hasGewerbeschein ? '✓' : '✗'} Gewerbeschein
                          </p>
                          {docs.filter(d => d.document_type === 'gewerbeschein').map(doc => (
                            <div key={doc.id} className="mt-2">
                              <p className="text-white/60 text-xs">{doc.file_name}</p>
                              <p className="text-white/40 text-xs">
                                {new Date(doc.uploaded_at).toLocaleDateString('de-DE')}
                              </p>
                            </div>
                          ))}
                          {!hasGewerbeschein && (
                            <p className="text-red-300 text-xs mt-1">Pflichtdokument fehlt</p>
                          )}
                        </div>
                        {hasGewerbeschein && (
                          <button
                            onClick={() => {
                              const doc = docs.find(d => d.document_type === 'gewerbeschein');
                              downloadDocument(hw.id, doc.id, doc.file_name);
                            }}
                            className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded text-xs transition-colors"
                          >
                            📥 Download
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Handwerkskarte */}
                    <div className={`bg-white/5 rounded-lg p-4 border-l-4 ${
                      hasHandwerkskarte ? 'border-green-500' : 'border-red-500'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">
                            {hasHandwerkskarte ? '✓' : '✗'} Handwerkskarte
                          </p>
                          {docs.filter(d => d.document_type === 'handwerkskarte').map(doc => (
                            <div key={doc.id} className="mt-2">
                              <p className="text-white/60 text-xs">{doc.file_name}</p>
                              <p className="text-white/40 text-xs">
                                {new Date(doc.uploaded_at).toLocaleDateString('de-DE')}
                              </p>
                            </div>
                          ))}
                          {!hasHandwerkskarte && (
                            <p className="text-red-300 text-xs mt-1">Pflichtdokument fehlt</p>
                          )}
                        </div>
                        {hasHandwerkskarte && (
                          <button
                            onClick={() => {
                              const doc = docs.find(d => d.document_type === 'handwerkskarte');
                              downloadDocument(hw.id, doc.id, doc.file_name);
                            }}
                            className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded text-xs transition-colors"
                          >
                            📥 Download
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Weitere Dokumente */}
                    {docs.filter(d => !['gewerbeschein', 'handwerkskarte'].includes(d.document_type)).map(doc => (
                      <div key={doc.id} className="bg-white/5 rounded-lg p-4 border-l-4 border-blue-500">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-white font-medium text-sm">
                              📎 {doc.document_type}
                            </p>
                            <p className="text-white/60 text-xs mt-1">{doc.file_name}</p>
                            <p className="text-white/40 text-xs">
                              {new Date(doc.uploaded_at).toLocaleDateString('de-DE')}
                            </p>
                          </div>
                          <button
                            onClick={() => downloadDocument(hw.id, doc.id, doc.file_name)}
                            className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded text-xs transition-colors"
                          >
                            📥 Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Dialoge bleiben gleich */}
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
          );
        })}
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
                onClick={() => exportHandwerkerData(selectedHandwerker.handwerker.id)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                📊 Daten exportieren
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
                onClick={() => exportBauherrData(selectedBauherr.bauherr.id)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
              >
                📊 Daten exportieren
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
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-2xl font-bold text-white">Aufträge ({orders.length})</h2>
                  
                  {/* Datumsfilter */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={dateFilterFrom}
                      onChange={(e) => setDateFilterFrom(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                    <span className="text-white/50">bis</span>
                    <input
                      type="date"
                      value={dateFilterTo}
                      onChange={(e) => setDateFilterTo(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                    {(dateFilterFrom || dateFilterTo) && (
                      <button
                        onClick={() => { setDateFilterFrom(''); setDateFilterTo(''); }}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm"
                      >
                        ✕ Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Statistik-Karten */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-xs text-white/70">Gesamt Aufträge</p>
                    <p className="text-2xl font-bold text-white">{orders.length}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-green-500/30">
                    <p className="text-xs text-white/70">Aktive Aufträge</p>
                    <p className="text-2xl font-bold text-green-400">
                      {orders.filter(o => o.status === 'active').length}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-blue-500/30">
                    <p className="text-xs text-white/70">Abgeschlossen</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {orders.filter(o => o.status === 'completed').length}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-teal-500/30">
                    <p className="text-xs text-white/70">Gesamtvolumen</p>
                    <p className="text-2xl font-bold text-teal-400">
                      {formatCurrency(orders.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0))}
                    </p>
                  </div>
                </div>

                {/* Orders Tabelle */}
                <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                  <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-slate-800/95">
                        <tr className="border-b border-white/20">
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Gewerk</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Bauherr</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Handwerker</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Betrag</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Nachträge</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Erstellt</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders
                          .filter(order => {
                            if (!dateFilterFrom && !dateFilterTo) return true;
                            const orderDate = new Date(order.created_at);
                            if (dateFilterFrom && orderDate < new Date(dateFilterFrom)) return false;
                            if (dateFilterTo && orderDate > new Date(dateFilterTo + 'T23:59:59')) return false;
                            return true;
                          })
                          .map(order => (
                          <tr key={order.id} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-3 text-sm text-white">#{order.id}</td>
                            <td className="px-4 py-3 text-sm text-white">{order.trade_name}</td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-white">{order.bauherr_name}</p>
                                <p className="text-xs text-white/50">{order.bauherr_email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-white">{order.handwerker_name}</p>
                                <p className="text-xs text-white/50">{order.handwerker_email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-teal-400 font-semibold">{formatCurrency(order.amount)}</p>
                                {order.bundle_discount > 0 && (
                                  <p className="text-xs text-green-400">-{order.bundle_discount}% Rabatt</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {order.nachtraege_count > 0 ? (
                                <div>
                                  <p className="text-sm text-white">{order.nachtraege_approved || 0}/{order.nachtraege_count}</p>
                                  <p className="text-xs text-teal-400">+{formatCurrency(order.nachtraege_sum || 0)}</p>
                                </div>
                              ) : (
                                <span className="text-white/50 text-sm">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                order.status === 'active' ? 'bg-green-500/20 text-green-300' :
                                order.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                                'bg-gray-500/20 text-gray-300'
                              }`}>
                                {order.status === 'active' ? 'Aktiv' : 
                                 order.status === 'completed' ? 'Abgeschlossen' : order.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-white/70">
                              {new Date(order.created_at).toLocaleDateString('de-DE')}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => window.open(`https://poc-rvrj.onrender.com/api/orders/${order.id}/contract-pdf`, '_blank')}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                                  title="Werkvertrag PDF"
                                >
                                  📄 PDF
                                </button>
                                <button
                                  onClick={() => setSelectedOrder(order)}
                                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                                >
                                  Details
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {orders.length === 0 && (
                    <p className="text-white/50 text-center py-8">Keine Aufträge vorhanden</p>
                  )}
                </div>

                {/* Order Detail Modal */}
                {selectedOrder && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="sticky top-0 bg-slate-800 border-b border-white/20 p-6 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">
                          Auftrag #{selectedOrder.id} - {selectedOrder.trade_name}
                        </h2>
                        <button
                          onClick={() => setSelectedOrder(null)}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                        >
                          Schließen
                        </button>
                      </div>
                      
                      <div className="p-6 space-y-6">
                        {/* Projekt */}
                        <div className="bg-white/5 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-white mb-3">Projekt</h3>
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-white/50">Beschreibung</p>
                              <p className="text-white">{selectedOrder.project_description}</p>
                            </div>
                            <div>
                              <p className="text-white/50">Adresse</p>
                              <p className="text-white">
                                {selectedOrder.project_street} {selectedOrder.project_house_number}, {selectedOrder.project_zip} {selectedOrder.project_city}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Parteien */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-white/5 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-white mb-3">Bauherr</h3>
                            <p className="text-white">{selectedOrder.bauherr_name}</p>
                            <p className="text-white/70 text-sm">{selectedOrder.bauherr_email}</p>
                            <p className="text-white/70 text-sm">{selectedOrder.bauherr_phone}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-white mb-3">Handwerker</h3>
                            <p className="text-white">{selectedOrder.handwerker_name}</p>
                            <p className="text-white/70 text-sm">{selectedOrder.handwerker_email}</p>
                            <p className="text-white/70 text-sm">{selectedOrder.handwerker_phone}</p>
                          </div>
                        </div>

                        {/* Finanzen */}
                        <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-white mb-3">Finanzen</h3>
                          <div className="grid md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-white/50 text-sm">Auftragssumme</p>
                              <p className="text-xl font-bold text-white">{formatCurrency(selectedOrder.amount)}</p>
                            </div>
                            {selectedOrder.bundle_discount > 0 && (
                              <div>
                                <p className="text-white/50 text-sm">Bündelrabatt</p>
                                <p className="text-xl font-bold text-green-400">-{selectedOrder.bundle_discount}%</p>
                              </div>
                            )}
                            <div>
                              <p className="text-white/50 text-sm">Nachträge</p>
                              <p className="text-xl font-bold text-teal-400">+{formatCurrency(selectedOrder.nachtraege_sum || 0)}</p>
                            </div>
                            <div>
                              <p className="text-white/50 text-sm">Gesamt Netto</p>
                              <p className="text-xl font-bold text-white">
                                {formatCurrency((parseFloat(selectedOrder.amount) || 0) + (parseFloat(selectedOrder.nachtraege_sum) || 0))}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Zeitraum */}
                        <div className="bg-white/5 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-white mb-3">Zeitraum</h3>
                          <div className="grid md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-white/50">Erstellt</p>
                              <p className="text-white">{new Date(selectedOrder.created_at).toLocaleDateString('de-DE')}</p>
                            </div>
                            <div>
                              <p className="text-white/50">Ausführung Start</p>
                              <p className="text-white">
                                {selectedOrder.execution_start ? new Date(selectedOrder.execution_start).toLocaleDateString('de-DE') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/50">Ausführung Ende</p>
                              <p className="text-white">
                                {selectedOrder.execution_end ? new Date(selectedOrder.execution_end).toLocaleDateString('de-DE') : '-'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* LV-Details */}
                        {selectedOrder.lv_data && (
                          <div className="bg-white/5 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-white mb-3">📋 Leistungsverzeichnis</h3>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {(() => {
                                const lvData = typeof selectedOrder.lv_data === 'string' ? JSON.parse(selectedOrder.lv_data) : selectedOrder.lv_data;
                                const positions = lvData?.positions || [];
                                return positions.length > 0 ? positions.map((pos, idx) => (
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
                                        {pos.totalPrice ? formatCurrency(pos.totalPrice) : 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                )) : (
                                  <p className="text-white/50">Keine LV-Positionen vorhanden</p>
                                );
                              })()}
                            </div>
                            {(() => {
                              const lvData = typeof selectedOrder.lv_data === 'string' ? JSON.parse(selectedOrder.lv_data) : selectedOrder.lv_data;
                              return lvData?.totalSum && (
                                <div className="mt-4 pt-4 border-t border-white/20 flex justify-between">
                                  <span className="text-white font-semibold">Gesamtsumme (Netto)</span>
                                  <span className="text-teal-400 font-bold text-lg">{formatCurrency(lvData.totalSum)}</span>
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Offers Tab */}
            {activeTab === 'offers' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-2xl font-bold text-white">Angebote ({offers.length})</h2>
                  
                  {/* Datumsfilter */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={dateFilterFrom}
                      onChange={(e) => setDateFilterFrom(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                    <span className="text-white/50">bis</span>
                    <input
                      type="date"
                      value={dateFilterTo}
                      onChange={(e) => setDateFilterTo(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                    {(dateFilterFrom || dateFilterTo) && (
                      <button
                        onClick={() => { setDateFilterFrom(''); setDateFilterTo(''); }}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm"
                      >
                        ✕ Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* KI-Genauigkeit Übersicht */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-xs text-white/70">Gesamt Angebote</p>
                    <p className="text-2xl font-bold text-white">{offers.length}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-green-500/30">
                    <p className="text-xs text-white/70">Angenommen</p>
                    <p className="text-2xl font-bold text-green-400">
                      {offers.filter(o => o.status === 'accepted').length}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-teal-500/30">
                    <p className="text-xs text-white/70">Gesamtvolumen</p>
                    <p className="text-2xl font-bold text-teal-400">
                      {formatCurrency(offers.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0))}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-purple-500/30">
                    <p className="text-xs text-white/70">Ø Abweichung KI</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {(() => {
                        const withDeviation = offers.filter(o => o.abweichung_prozent !== null);
                        if (withDeviation.length === 0) return '-';
                        const avg = withDeviation.reduce((sum, o) => sum + parseFloat(o.abweichung_prozent), 0) / withDeviation.length;
                        return `${avg >= 0 ? '+' : ''}${avg.toFixed(1)}%`;
                      })()}
                    </p>
                  </div>
                </div>

                {/* Offers Tabelle */}
                <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                  <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-slate-800/95">
                        <tr className="border-b border-white/20">
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Gewerk</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Projekt</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Handwerker</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Bauherr</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">KI-Schätzung</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Angebot</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Abweichung</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Datum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offers
                          .filter(offer => {
                            if (!dateFilterFrom && !dateFilterTo) return true;
                            const offerDate = new Date(offer.created_at);
                            if (dateFilterFrom && offerDate < new Date(dateFilterFrom)) return false;
                            if (dateFilterTo && offerDate > new Date(dateFilterTo + 'T23:59:59')) return false;
                            return true;
                          })
                          .map(offer => (
                          <tr key={offer.id} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-3 text-sm text-white">#{offer.id}</td>
                            <td className="px-4 py-3 text-sm text-white">{offer.trade_name}</td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-white truncate max-w-[150px]">{offer.project_description}</p>
                                <p className="text-xs text-white/50">{offer.project_zip} {offer.project_city}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-white">{offer.handwerker_name}</p>
                                <p className="text-xs text-white/50">{offer.handwerker_email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-white">{offer.bauherr_name}</p>
                                <p className="text-xs text-white/50">{offer.bauherr_email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-purple-400">
                              {offer.ki_schaetzung ? formatCurrency(offer.ki_schaetzung) : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm text-teal-400 font-semibold">
                              {formatCurrency(offer.amount)}
                            </td>
                            <td className="px-4 py-3">
                              {offer.abweichung_prozent !== null ? (
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  parseFloat(offer.abweichung_prozent) > 10 ? 'bg-red-500/20 text-red-300' :
                                  parseFloat(offer.abweichung_prozent) < -10 ? 'bg-green-500/20 text-green-300' :
                                  'bg-yellow-500/20 text-yellow-300'
                                }`}>
                                  {parseFloat(offer.abweichung_prozent) >= 0 ? '+' : ''}{parseFloat(offer.abweichung_prozent).toFixed(1)}%
                                </span>
                              ) : (
                                <span className="text-white/50 text-sm">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                offer.status === 'accepted' ? 'bg-green-500/20 text-green-300' :
                                offer.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                                offer.status === 'submitted' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-gray-500/20 text-gray-300'
                              }`}>
                                {offer.status === 'accepted' ? 'Angenommen' :
                                 offer.status === 'rejected' ? 'Abgelehnt' :
                                 offer.status === 'submitted' ? 'Eingereicht' : offer.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-white/70">
                              {new Date(offer.created_at).toLocaleDateString('de-DE')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {offers.length === 0 && (
                    <p className="text-white/50 text-center py-8">Keine Angebote vorhanden</p>
                  )}
                </div>
              </div>
            )}

            {/* Nachtraege Tab */}
            {activeTab === 'nachtraege' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-2xl font-bold text-white">Nachträge ({nachtraege.length})</h2>
                  
                  {/* Datumsfilter */}
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={dateFilterFrom}
                      onChange={(e) => setDateFilterFrom(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                    <span className="text-white/50">bis</span>
                    <input
                      type="date"
                      value={dateFilterTo}
                      onChange={(e) => setDateFilterTo(e.target.value)}
                      className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                    />
                    {(dateFilterFrom || dateFilterTo) && (
                      <button
                        onClick={() => { setDateFilterFrom(''); setDateFilterTo(''); }}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm"
                      >
                        ✕ Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Statistiken */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <p className="text-xs text-white/70">Gesamt</p>
                    <p className="text-2xl font-bold text-white">{nachtraege.length}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-yellow-500/30">
                    <p className="text-xs text-white/70">In Prüfung</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {nachtraege.filter(n => n.status === 'submitted').length}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-green-500/30">
                    <p className="text-xs text-white/70">Beauftragt</p>
                    <p className="text-2xl font-bold text-green-400">
                      {nachtraege.filter(n => n.status === 'approved').length}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-teal-500/30">
                    <p className="text-xs text-white/70">Volumen (beauftragt)</p>
                    <p className="text-2xl font-bold text-teal-400">
                      {formatCurrency(nachtraege.filter(n => n.status === 'approved').reduce((sum, n) => sum + (parseFloat(n.amount) || 0), 0))}
                    </p>
                  </div>
                </div>

                {/* Nachträge Tabelle */}
                <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                  <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-slate-800/95">
                        <tr className="border-b border-white/20">
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Nr.</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Order</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Gewerk</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Grund</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Handwerker</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Bauherr</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Betrag</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Eingereicht</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nachtraege
                          .filter(nt => {
                            if (!dateFilterFrom && !dateFilterTo) return true;
                            const ntDate = new Date(nt.created_at);
                            if (dateFilterFrom && ntDate < new Date(dateFilterFrom)) return false;
                            if (dateFilterTo && ntDate > new Date(dateFilterTo + 'T23:59:59')) return false;
                            return true;
                          })
                          .map(nt => (
                          <tr key={nt.id} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-3 text-sm text-white">
                              NT-{String(nt.nachtrag_number).padStart(2, '0')}
                            </td>
                            <td className="px-4 py-3 text-sm text-white">#{nt.order_id}</td>
                            <td className="px-4 py-3 text-sm text-white">{nt.trade_name}</td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-white truncate max-w-[200px]" title={nt.reason}>
                                {nt.reason}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-white">{nt.handwerker_name}</p>
                                <p className="text-xs text-white/50">{nt.handwerker_email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm text-white">{nt.bauherr_name}</p>
                                <p className="text-xs text-white/50">{nt.bauherr_email}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-teal-400 font-semibold">
                              {formatCurrency(nt.amount)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                nt.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                                nt.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                                nt.status === 'submitted' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-gray-500/20 text-gray-300'
                              }`}>
                                {nt.status === 'approved' ? 'Beauftragt' :
                                 nt.status === 'rejected' ? 'Abgelehnt' :
                                 nt.status === 'submitted' ? 'In Prüfung' : nt.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-white/70">
                              {nt.submitted_at ? new Date(nt.submitted_at).toLocaleDateString('de-DE') : '-'}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setSelectedNachtrag(nt)}
                                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {nachtraege.length === 0 && (
                    <p className="text-white/50 text-center py-8">Keine Nachträge vorhanden</p>
                  )}
                </div>

                {/* Nachtrag Detail Modal */}
                {selectedNachtrag && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                      <div className="sticky top-0 bg-slate-800 border-b border-white/20 p-6 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">
                          Nachtrag NT-{String(selectedNachtrag.nachtrag_number).padStart(2, '0')} - {selectedNachtrag.trade_name}
                        </h2>
                        <button
                          onClick={() => setSelectedNachtrag(null)}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                        >
                          Schließen
                        </button>
                      </div>
                      
                      <div className="p-6 space-y-6">
                        {/* Status & Betrag */}
                        <div className="flex justify-between items-center">
                          <span className={`px-3 py-1 text-sm rounded-full ${
                            selectedNachtrag.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                            selectedNachtrag.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                            selectedNachtrag.status === 'submitted' ? 'bg-yellow-500/20 text-yellow-300' :
                            'bg-gray-500/20 text-gray-300'
                          }`}>
                            {selectedNachtrag.status === 'approved' ? 'Beauftragt' :
                             selectedNachtrag.status === 'rejected' ? 'Abgelehnt' :
                             selectedNachtrag.status === 'submitted' ? 'In Prüfung' : selectedNachtrag.status}
                          </span>
                          <p className="text-2xl font-bold text-teal-400">{formatCurrency(selectedNachtrag.amount)}</p>
                        </div>

                        {/* Begründung */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-white mb-2">📝 Begründung</h3>
                          <p className="text-white/90 whitespace-pre-wrap">{selectedNachtrag.reason}</p>
                        </div>

                        {/* Parteien */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="bg-white/5 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-white mb-3">Handwerker</h3>
                            <p className="text-white">{selectedNachtrag.handwerker_name}</p>
                            <p className="text-white/70 text-sm">{selectedNachtrag.handwerker_email}</p>
                          </div>
                          <div className="bg-white/5 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-white mb-3">Bauherr</h3>
                            <p className="text-white">{selectedNachtrag.bauherr_name}</p>
                            <p className="text-white/70 text-sm">{selectedNachtrag.bauherr_email}</p>
                          </div>
                        </div>

                        {/* Projekt-Info */}
                        <div className="bg-white/5 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-white mb-3">Projekt</h3>
                          <p className="text-white">{selectedNachtrag.project_description}</p>
                          <p className="text-white/70 text-sm">{selectedNachtrag.project_zip} {selectedNachtrag.project_city}</p>
                          <p className="text-white/50 text-sm mt-2">Order #{selectedNachtrag.order_id} | Auftragswert: {formatCurrency(selectedNachtrag.order_amount)}</p>
                        </div>

                        {/* LV-Details */}
                        {selectedNachtrag.lv_data && (
                          <div className="bg-white/5 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-white mb-3">📋 Nachtrags-Leistungsverzeichnis</h3>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {(() => {
                                const lvData = typeof selectedNachtrag.lv_data === 'string' ? JSON.parse(selectedNachtrag.lv_data) : selectedNachtrag.lv_data;
                                const positions = lvData?.positions || [];
                                return positions.length > 0 ? positions.map((pos, idx) => (
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
                                        {pos.totalPrice ? formatCurrency(pos.totalPrice) : 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                )) : (
                                  <p className="text-white/50">Keine LV-Positionen vorhanden</p>
                                );
                              })()}
                            </div>
                            {(() => {
                              const lvData = typeof selectedNachtrag.lv_data === 'string' ? JSON.parse(selectedNachtrag.lv_data) : selectedNachtrag.lv_data;
                              return lvData?.totalSum && (
                                <div className="mt-4 pt-4 border-t border-white/20 flex justify-between">
                                  <span className="text-white font-semibold">Gesamtsumme (Netto)</span>
                                  <span className="text-teal-400 font-bold text-lg">{formatCurrency(lvData.totalSum)}</span>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Zeitstempel */}
                        <div className="bg-white/5 rounded-lg p-4">
                          <h3 className="text-lg font-semibold text-white mb-3">Zeitstempel</h3>
                          <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-white/50">Eingereicht</p>
                              <p className="text-white">
                                {selectedNachtrag.submitted_at ? new Date(selectedNachtrag.submitted_at).toLocaleString('de-DE') : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/50">Erstellt</p>
                              <p className="text-white">
                                {new Date(selectedNachtrag.created_at).toLocaleString('de-DE')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tenders Tab - ERWEITERT mit LV-Anzeige */}
{activeTab === 'tenders' && (
  <div className="space-y-6">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <h2 className="text-2xl font-bold text-white">Ausschreibungen ({tenders.length})</h2>
      
      {/* Datumsfilter */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={dateFilterFrom}
          onChange={(e) => setDateFilterFrom(e.target.value)}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
        />
        <span className="text-white/50">bis</span>
        <input
          type="date"
          value={dateFilterTo}
          onChange={(e) => setDateFilterTo(e.target.value)}
          className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
        />
        {(dateFilterFrom || dateFilterTo) && (
          <button
            onClick={() => { setDateFilterFrom(''); setDateFilterTo(''); }}
            className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm"
          >
            ✕ Reset
          </button>
        )}
      </div>
    </div>
    
    <div className="space-y-4">
      {tenders
        .filter(tender => {
          if (!dateFilterFrom && !dateFilterTo) return true;
          const tenderDate = new Date(tender.created_at);
          if (dateFilterFrom && tenderDate < new Date(dateFilterFrom)) return false;
          if (dateFilterTo && tenderDate > new Date(dateFilterTo + 'T23:59:59')) return false;
          return true;
        })
        .map(tender => (
        <div key={tender.id} className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
          <div 
            className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setSelectedTender(selectedTender?.id === tender.id ? null : tender)}
          >
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold text-white flex items-center gap-2">
                  {tender.project_description} - {tender.trade_name}
                  <span className="text-white/50 text-sm">
                    {selectedTender?.id === tender.id ? '▼' : '▶'}
                  </span>
                </h3>
                <p className="text-gray-400 text-sm mt-1">
                  Projekt #{tender.project_id} | Bauherr: {tender.bauherr_name} | Erstellt: {new Date(tender.created_at).toLocaleDateString('de-DE')}
                </p>
                <p className="text-gray-400 text-sm">
                  Frist: {tender.deadline ? new Date(tender.deadline).toLocaleDateString('de-DE') : '-'} | Eingeladen: {tender.invited_handwerker || 0} Handwerker
                </p>
              </div>
              <div className="text-right">
                <p className="text-teal-400 font-semibold">
                  {formatCurrency(tender.estimated_value)}
                </p>
                <p className="text-sm text-gray-400">
                  {tender.offer_count || 0} Angebote
                </p>
                {tender.min_offer && (
                  <p className="text-xs text-white/50">
                    Range: {formatCurrency(tender.min_offer)} - {formatCurrency(tender.max_offer)}
                  </p>
                )}
                <span className={`text-xs px-2 py-1 rounded mt-2 inline-block ${
                  tender.status === 'open' ? 'bg-green-600 text-green-200' :
                  tender.status === 'closed' ? 'bg-gray-600 text-gray-300' :
                  tender.status === 'withdrawn' ? 'bg-red-600 text-red-200' :
                  'bg-yellow-600 text-yellow-200'
                }`}>
                  {tender.status === 'open' ? 'Offen' :
                   tender.status === 'closed' ? 'Geschlossen' :
                   tender.status === 'withdrawn' ? 'Zurückgezogen' : tender.status}
                </span>
              </div>
            </div>
          </div>
          
          {/* LV-Details anzeigen wenn ausgewählt */}
          {selectedTender?.id === tender.id && tender.lv_data && (
            <div className="border-t border-white/20 p-4 bg-white/5">
              <h4 className="text-white font-semibold mb-3">📋 Leistungsverzeichnis</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(() => {
                  const lvData = typeof tender.lv_data === 'string' ? JSON.parse(tender.lv_data) : tender.lv_data;
                  const positions = lvData?.positions || [];
                  return positions.length > 0 ? positions.map((pos, idx) => (
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
                          {pos.totalPrice ? formatCurrency(pos.totalPrice) : 'N/A'}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-white/50">Keine LV-Positionen vorhanden</p>
                  );
                })()}
              </div>
              {(() => {
                const lvData = typeof tender.lv_data === 'string' ? JSON.parse(tender.lv_data) : tender.lv_data;
                return lvData?.totalSum && (
                  <div className="mt-4 pt-4 border-t border-white/20 flex justify-between">
                    <span className="text-white font-semibold">Gesamtsumme (Netto)</span>
                    <span className="text-teal-400 font-bold text-lg">{formatCurrency(lvData.totalSum)}</span>
                  </div>
                );
              })()}
            </div>
          )}
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
