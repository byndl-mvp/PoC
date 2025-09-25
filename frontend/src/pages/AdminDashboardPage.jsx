import React, { useEffect, useState } from 'react';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState('');
  
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
  const [payments, setPayments] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [orders, setOrders] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [supplements, setSupplements] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const token = localStorage.getItem('adminToken');

  useEffect(() => {
    if (!token) {
      // Redirect to login
      window.location.href = '/admin';
    }
  }, [token]);

  useEffect(() => {
    const fetchOverviewStats = async () => {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Statistiken');
      const data = await res.json();
      setStats(data);
    };

    const fetchUsers = async () => {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Nutzer');
      const data = await res.json();
      setUsers(data);
    };

    const fetchProjects = async () => {
      const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/projects?status=${filterStatus}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Projekte');
      const data = await res.json();
      setProjects(data.projects || []);
    };

    const fetchPayments = async () => {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/payments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Zahlungen');
      const data = await res.json();
      setPayments(data.payments || []);
    };

    const fetchVerifications = async () => {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/verifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Verifizierungen');
      const data = await res.json();
      setVerifications(data.verifications || []);
    };

    const fetchOrders = async () => {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Aufträge');
      const data = await res.json();
      setOrders(data.orders || []);
    };

    const fetchTenders = async () => {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/tenders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Ausschreibungen');
      const data = await res.json();
      setTenders(data.tenders || []);
    };

    const fetchSupplements = async () => {
      const res = await fetch('https://poc-rvrj.onrender.com/api/admin/supplements', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Fehler beim Laden der Nachträge');
      const data = await res.json();
      setSupplements(data.supplements || []);
    };

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
          case 'payments':
            await fetchPayments();
            break;
          case 'verifications':
            await fetchVerifications();
            break;
          case 'orders':
            await fetchOrders();
            break;
          case 'tenders':
            await fetchTenders();
            break;
          case 'supplements':
            await fetchSupplements();
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
    
    fetchDashboardData();
  }, [activeTab, filterStatus, token]);

  const handleVerification = async (verificationId, approved) => {
    try {
      const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/verifications/${verificationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ approved })
      });
      
      if (!res.ok) throw new Error('Fehler bei der Verifizierung');
      
      setMessage(`${approved ? 'Genehmigt' : 'Abgelehnt'} erfolgreich`);
      
      // Reload verifications
      const reloadRes = await fetch('https://poc-rvrj.onrender.com/api/admin/verifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (reloadRes.ok) {
        const data = await reloadRes.json();
        setVerifications(data.verifications || []);
      }
      
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePaymentUpdate = async (paymentId, status) => {
    try {
      const res = await fetch(`https://poc-rvrj.onrender.com/api/admin/payments/${paymentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      
      if (!res.ok) throw new Error('Fehler beim Update der Zahlung');
      
      setMessage('Zahlung aktualisiert');
      
      // Reload payments
      const reloadRes = await fetch('https://poc-rvrj.onrender.com/api/admin/payments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (reloadRes.ok) {
        const data = await reloadRes.json();
        setPayments(data.payments || []);
      }
      
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportData = () => {
    // Export functionality
    console.log('Exporting data...');
  };

  const logout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin';
  };

  const tabItems = [
    { id: 'overview', label: 'Übersicht', icon: '📊' },
    { id: 'users', label: 'Nutzer', icon: '👥' },
    { id: 'projects', label: 'Projekte', icon: '🏗️' },
    { id: 'payments', label: 'Zahlungen', icon: '💳' },
    { id: 'verifications', label: 'Verifizierungen', icon: '🛡️' },
    { id: 'orders', label: 'Aufträge', icon: '📦' },
    { id: 'tenders', label: 'Ausschreibungen', icon: '📄' },
    { id: 'supplements', label: 'Nachträge', icon: '➕' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'settings', label: 'Einstellungen', icon: '⚙️' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-8">
              <a href="/" className="text-2xl font-bold text-white">
                byndl <span className="text-teal-400 text-sm">Admin</span>
              </a>
              
              {/* Tab Navigation */}
              <nav className="hidden lg:flex space-x-1">
                {tabItems.slice(0, 7).map(tab => (
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
              <button className="relative p-2 text-white/70 hover:text-white">
                <span className="text-xl">🔔</span>
                {stats.verificationQueue > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {stats.verificationQueue}
                  </span>
                )}
              </button>
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

      {/* Search and Filter Bar */}
      {activeTab !== 'overview' && activeTab !== 'analytics' && activeTab !== 'settings' && (
        <div className="bg-white/5 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50">🔍</span>
                  <input
                    type="text"
                    placeholder="Suchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50"
                  />
                </div>
              </div>
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              >
                <option value="all">Alle Status</option>
                <option value="active">Aktiv</option>
                <option value="pending">Ausstehend</option>
                <option value="completed">Abgeschlossen</option>
              </select>
              
              <button
                onClick={exportData}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white flex items-center gap-2"
              >
                <span>📥</span> Export
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-lg flex items-center gap-2"
              >
                <span>🔄</span> Aktualisieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Messages */}
        {message && (
          <div className="mb-4 bg-green-500/20 border border-green-500/50 rounded-lg px-4 py-3 flex items-center gap-2">
            <span>✅</span>
            <p className="text-green-300">{message}</p>
          </div>
        )}
        
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-3 flex items-center gap-2">
            <span>⚠️</span>
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
                {/* Stats Grid */}
                <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">👥</span>
                      <span className="text-xs text-green-400">+12%</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                    <p className="text-xs text-white/70 mt-1">Gesamte Nutzer</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">🏗️</span>
                      <span className="text-xs text-green-400">+8%</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.totalProjects}</p>
                    <p className="text-xs text-white/70 mt-1">Projekte</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">💰</span>
                      <span className="text-xs text-green-400">+25%</span>
                    </div>
                    <p className="text-2xl font-bold text-white">
                      €{stats.totalRevenue?.toLocaleString()}
                    </p>
                    <p className="text-xs text-white/70 mt-1">Umsatz</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">📦</span>
                      <span className="text-sm">⏰</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.activeOrders}</p>
                    <p className="text-xs text-white/70 mt-1">Aktive Aufträge</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">💳</span>
                      <span className="text-sm">⚠️</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.pendingPayments}</p>
                    <p className="text-xs text-white/70 mt-1">Offene Zahlungen</p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">🛡️</span>
                      <span className="text-sm">🔔</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.verificationQueue}</p>
                    <p className="text-xs text-white/70 mt-1">Verifizierungen</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Recent Activities */}
                  <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>📊</span> Letzte Aktivitäten
                    </h3>
                    <div className="space-y-3">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <div className="w-2 h-2 bg-teal-400 rounded-full animate-pulse"></div>
                          <div className="flex-1">
                            <p className="text-white">Neue Registrierung: Handwerker #{i}23</p>
                            <p className="text-white/50 text-xs">vor {i * 5} Minuten</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pending Actions */}
                  <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>⚠️</span> Ausstehende Aktionen
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg">
                        <span className="text-white text-sm">5 Verifizierungen ausstehend</span>
                        <button 
                          onClick={() => setActiveTab('verifications')}
                          className="text-yellow-400 hover:text-yellow-300 text-sm"
                        >
                          Ansehen →
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-orange-500/10 rounded-lg">
                        <span className="text-white text-sm">3 Zahlungen überfällig</span>
                        <button 
                          onClick={() => setActiveTab('payments')}
                          className="text-orange-400 hover:text-orange-300 text-sm"
                        >
                          Prüfen →
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg">
                        <span className="text-white text-sm">12 neue Nachrichten</span>
                        <button className="text-blue-400 hover:text-blue-300 text-sm">
                          Lesen →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Bauherren */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Bauherren</h3>
                    <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/20">
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">ID</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Name</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Email</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Projekte</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Aktionen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.bauherren?.map(user => (
                              <tr key={user.id} className="border-b border-white/10 hover:bg-white/5">
                                <td className="px-4 py-3 text-sm text-white">#{user.id}</td>
                                <td className="px-4 py-3 text-sm text-white">{user.name}</td>
                                <td className="px-4 py-3 text-sm text-white/70">{user.email}</td>
                                <td className="px-4 py-3 text-sm text-white">{user.project_count || 0}</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-300">
                                    Aktiv
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => {setSelectedItem(user); setModalType('user')}}
                                      className="text-teal-400 hover:text-teal-300"
                                    >
                                      👁️
                                    </button>
                                    <button className="text-blue-400 hover:text-blue-300">
                                      ✏️
                                    </button>
                                  </div>
                                </td>
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
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">ID</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Firma</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Gewerke</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Bewertung</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Aktionen</th>
                            </tr>
                          </thead>
                          <tbody>
                            {users.handwerker?.map(user => (
                              <tr key={user.id} className="border-b border-white/10 hover:bg-white/5">
                                <td className="px-4 py-3 text-sm text-white">#{user.id}</td>
                                <td className="px-4 py-3 text-sm text-white">{user.company_name}</td>
                                <td className="px-4 py-3 text-sm text-white/70">{user.trades?.join(', ')}</td>
                                <td className="px-4 py-3 text-sm text-white">
                                  ⭐ {user.rating || 'N/A'}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    user.verified 
                                      ? 'bg-green-500/20 text-green-300' 
                                      : 'bg-yellow-500/20 text-yellow-300'
                                  }`}>
                                    {user.verified ? 'Verifiziert' : 'Ausstehend'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => {setSelectedItem(user); setModalType('user')}}
                                      className="text-teal-400 hover:text-teal-300"
                                    >
                                      👁️
                                    </button>
                                    <button className="text-blue-400 hover:text-blue-300">
                                      ✏️
                                    </button>
                                    {!user.verified && (
                                      <button 
                                        onClick={() => handleVerification(user.id, true)}
                                        className="text-green-400 hover:text-green-300"
                                      >
                                        ✅
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Details Modal */}
                {selectedItem && modalType === 'user' && (
                  <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50">
                    <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                      <h3 className="text-xl font-bold text-white mb-4">Nutzer Details</h3>
                      
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-white/70 text-sm">Name</label>
                            <p className="text-white">{selectedItem.name || selectedItem.company_name}</p>
                          </div>
                          <div>
                            <label className="text-white/70 text-sm">Email</label>
                            <p className="text-white">{selectedItem.email}</p>
                          </div>
                          <div>
                            <label className="text-white/70 text-sm">Telefon</label>
                            <p className="text-white">{selectedItem.phone || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-white/70 text-sm">Registriert</label>
                            <p className="text-white">{new Date(selectedItem.created_at || Date.now()).toLocaleDateString()}</p>
                          </div>
                        </div>

                        {/* Address */}
                        <div>
                          <label className="text-white/70 text-sm flex items-center gap-2">
                            📍 Adresse
                          </label>
                          <p className="text-white">
                            {selectedItem.street} {selectedItem.house_number}<br />
                            {selectedItem.zip} {selectedItem.city}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-4 border-t border-white/20">
                          <button className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-lg">
                            Bearbeiten
                          </button>
                          <button className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg">
                            Sperren
                          </button>
                          <button 
                            onClick={() => {setSelectedItem(null); setModalType('')}}
                            className="ml-auto px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                          >
                            Schließen
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              <div>
                <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/20">
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Projekt ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Bauherr</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Adresse</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Kategorie</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Budget</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Start</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projects.map(project => (
                          <tr key={project.id} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-3 text-sm text-white">#{project.id}</td>
                            <td className="px-4 py-3 text-sm text-white">{project.bauherr_name}</td>
                            <td className="px-4 py-3 text-sm text-white/70">
                              <div className="flex items-center gap-1">
                                <span>📍</span>
                                {project.street} {project.house_number}, {project.zip} {project.city}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-white">{project.category}</td>
                            <td className="px-4 py-3 text-sm text-teal-400">
                              €{project.budget?.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-white">
                              <div className="flex items-center gap-1">
                                <span>📅</span>
                                {new Date(project.start_date || Date.now()).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                project.status === 'active' ? 'bg-green-500/20 text-green-300' :
                                project.status === 'completed' ? 'bg-blue-500/20 text-blue-300' :
                                'bg-yellow-500/20 text-yellow-300'
                              }`}>
                                {project.status || 'Ausstehend'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => {setSelectedItem(project); setModalType('project')}}
                                  className="text-teal-400 hover:text-teal-300"
                                >
                                  👁️
                                </button>
                                <button className="text-blue-400 hover:text-blue-300">
                                  ✏️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
              <div>
                <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/20">
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Datum</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Von</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">An</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Betrag</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Typ</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map(payment => (
                          <tr key={payment.id} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-3 text-sm text-white">#{payment.id}</td>
                            <td className="px-4 py-3 text-sm text-white">
                              {new Date(payment.date || Date.now()).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-white">{payment.from_name}</td>
                            <td className="px-4 py-3 text-sm text-white">{payment.to_name}</td>
                            <td className="px-4 py-3 text-sm text-teal-400 font-semibold">
                              €{payment.amount?.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-sm text-white">{payment.type}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                payment.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                                payment.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-red-500/20 text-red-300'
                              }`}>
                                {payment.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                {payment.status === 'pending' && (
                                  <>
                                    <button 
                                      onClick={() => handlePaymentUpdate(payment.id, 'completed')}
                                      className="text-green-400 hover:text-green-300"
                                      title="Genehmigen"
                                    >
                                      ✅
                                    </button>
                                    <button 
                                      onClick={() => handlePaymentUpdate(payment.id, 'failed')}
                                      className="text-red-400 hover:text-red-300"
                                      title="Ablehnen"
                                    >
                                      ❌
                                    </button>
                                  </>
                                )}
                                <button className="text-teal-400 hover:text-teal-300" title="Ansehen">
                                  👁️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Verifications Tab */}
            {activeTab === 'verifications' && (
              <div className="grid gap-4">
                {verifications.length > 0 ? verifications.map(verification => (
                  <div key={verification.id} className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold text-white">
                            {verification.company_name}
                          </h3>
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300">
                            Ausstehend
                          </span>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-white/70 text-sm">Kontakt</p>
                            <p className="text-white flex items-center gap-2">
                              <span>✉️</span> {verification.email}
                            </p>
                            <p className="text-white flex items-center gap-2 mt-1">
                              <span>📞</span> {verification.phone}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/70 text-sm">Adresse</p>
                            <p className="text-white flex items-start gap-2">
                              <span>🏠</span>
                              <span>
                                {verification.street} {verification.house_number}<br />
                                {verification.zip} {verification.city}
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Documents */}
                        <div className="space-y-2">
                          <p className="text-white/70 text-sm">Nachweise</p>
                          <div className="flex flex-wrap gap-2">
                            {verification.documents?.map((doc, idx) => (
                              <button
                                key={idx}
                                className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-sm text-white flex items-center gap-2"
                              >
                                <span>📄</span>
                                {doc.type}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerification(verification.id, true)}
                          className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg flex items-center gap-2"
                        >
                          <span>✅</span> Genehmigen
                        </button>
                        <button
                          onClick={() => handleVerification(verification.id, false)}
                          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg flex items-center gap-2"
                        >
                          <span>❌</span> Ablehnen
                        </button>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="bg-white/10 backdrop-blur rounded-lg p-8 border border-white/20 text-center">
                    <p className="text-white/50">Keine ausstehenden Verifizierungen</p>
                  </div>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Auftrag ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Projekt</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Handwerker</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Gewerk</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Summe</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length > 0 ? orders.map(order => (
                        <tr key={order.id} className="border-b border-white/10 hover:bg-white/5">
                          <td className="px-4 py-3 text-sm text-white">#{order.id}</td>
                          <td className="px-4 py-3 text-sm text-white">Projekt #{order.project_id}</td>
                          <td className="px-4 py-3 text-sm text-white">{order.handwerker_name}</td>
                          <td className="px-4 py-3 text-sm text-white/70">{order.trade_name}</td>
                          <td className="px-4 py-3 text-sm text-teal-400 font-semibold">
                            €{order.total?.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              order.status === 'completed' ? 'bg-green-500/20 text-green-300' :
                              order.status === 'in_progress' ? 'bg-blue-500/20 text-blue-300' :
                              'bg-yellow-500/20 text-yellow-300'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-teal-400 hover:text-teal-300">
                              👁️
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-white/50">
                            Keine Aufträge vorhanden
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tenders Tab */}
            {activeTab === 'tenders' && (
              <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Ausschreibung ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Projekt</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Gewerk</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Angebote</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Deadline</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenders.length > 0 ? tenders.map(tender => (
                        <tr key={tender.id} className="border-b border-white/10 hover:bg-white/5">
                          <td className="px-4 py-3 text-sm text-white">#{tender.id}</td>
                          <td className="px-4 py-3 text-sm text-white">Projekt #{tender.project_id}</td>
                          <td className="px-4 py-3 text-sm text-white">{tender.trade_name}</td>
                          <td className="px-4 py-3 text-sm text-white">
                            <span className="text-teal-400">{tender.offer_count || 0}</span> / {tender.max_offers || 5}
                          </td>
                          <td className="px-4 py-3 text-sm text-white">
                            {new Date(tender.deadline || Date.now()).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              tender.status === 'closed' ? 'bg-gray-500/20 text-gray-300' :
                              tender.status === 'awarded' ? 'bg-green-500/20 text-green-300' :
                              'bg-blue-500/20 text-blue-300'
                            }`}>
                              {tender.status || 'Offen'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-teal-400 hover:text-teal-300">
                              👁️
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="7" className="px-4 py-8 text-center text-white/50">
                            Keine Ausschreibungen vorhanden
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Supplements Tab */}
            {activeTab === 'supplements' && (
              <div className="bg-white/10 backdrop-blur rounded-lg border border-white/20 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Nachtrag ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Auftrag</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Grund</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Betrag</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-white/70">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplements.length > 0 ? supplements.map(supplement => (
                        <tr key={supplement.id} className="border-b border-white/10 hover:bg-white/5">
                          <td className="px-4 py-3 text-sm text-white">#{supplement.id}</td>
                          <td className="px-4 py-3 text-sm text-white">Auftrag #{supplement.order_id}</td>
                          <td className="px-4 py-3 text-sm text-white/70">{supplement.reason}</td>
                          <td className="px-4 py-3 text-sm text-teal-400 font-semibold">
                            €{supplement.amount?.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              supplement.status === 'approved' ? 'bg-green-500/20 text-green-300' :
                              supplement.status === 'rejected' ? 'bg-red-500/20 text-red-300' :
                              'bg-yellow-500/20 text-yellow-300'
                            }`}>
                              {supplement.status || 'Ausstehend'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button className="text-teal-400 hover:text-teal-300">
                              👁️
                            </button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="6" className="px-4 py-8 text-center text-white/50">
                            Keine Nachträge vorhanden
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                  <h3 className="text-lg font-semibold text-white mb-4">Platform Einstellungen</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-white/70 text-sm">Provision (%)</label>
                      <input 
                        type="number" 
                        defaultValue="15" 
                        className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="text-white/70 text-sm">Max. Angebote pro Ausschreibung</label>
                      <input 
                        type="number" 
                        defaultValue="5" 
                        className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="text-white/70 text-sm">Zahlungsfrist (Tage)</label>
                      <input 
                        type="number" 
                        defaultValue="30" 
                        className="w-full mt-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                      />
                    </div>
                    <button className="w-full px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-lg">
                      Einstellungen speichern
                    </button>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20">
                  <h3 className="text-lg font-semibold text-white mb-4">System Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">API Server</span>
                      <span className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Online
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Database</span>
                      <span className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Connected
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Payment Gateway</span>
                      <span className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Active
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/70">Email Service</span>
                      <span className="flex items-center gap-2 text-green-400">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Operational
                      </span>
                    </div>
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
