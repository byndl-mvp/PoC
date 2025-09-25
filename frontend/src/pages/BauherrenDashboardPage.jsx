import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function BauherrenDashboardPage() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [offers, setOffers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [supplements, setSupplements] = useState([]); // Nachträge
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);

  useEffect(() => {
    const storedUserData = sessionStorage.getItem('userData');
    if (!storedUserData) {
      navigate('/bauherr/login');
      return;
    }
    
    const user = JSON.parse(storedUserData);
    setUserData(user);
    loadUserProjects(user.email);
  }, [navigate]);

  const loadUserProjects = async (email) => {
    try {
      setLoading(true);
      
      const res = await fetch(apiUrl(`/api/projects/user/${encodeURIComponent(email)}`));
      
      if (res.ok) {
        const projectsData = await res.json();
        
        const projectsWithDetails = await Promise.all(
          projectsData.map(async (project) => {
            const lvRes = await fetch(apiUrl(`/api/projects/${project.id}/lv`));
            const lvData = lvRes.ok ? await lvRes.json() : null;
            
            const tradesRes = await fetch(apiUrl(`/api/projects/${project.id}/trades`));
            const tradesData = tradesRes.ok ? await tradesRes.json() : [];
            
            return {
              ...project,
              lv: lvData,
              trades: tradesData,
              totalCost: lvData?.totalCost || 0,
              status: determineProjectStatus(project, lvData)
            };
          })
        );
        
        setProjects(projectsWithDetails);
        if (projectsWithDetails.length > 0) {
          setSelectedProject(projectsWithDetails[0]);
          loadProjectDetails(projectsWithDetails[0].id);
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden der Projekte:', err);
    } finally {
      setLoading(false);
    }
  };

  const determineProjectStatus = (project, lvData) => {
    if (!lvData) return 'In Vorbereitung';
    if (project.tendersSent) return 'Ausschreibung läuft';
    if (project.ordersPlaced) return 'In Ausführung';
    if (project.completed) return 'Abgeschlossen';
    return 'LV erstellt';
  };

  const loadProjectDetails = async (projectId) => {
    try {
      const tendersRes = await fetch(apiUrl(`/api/projects/${projectId}/tenders`));
      if (tendersRes.ok) {
        const tendersData = await tendersRes.json();
        setTenders(tendersData);
      }

      const offersRes = await fetch(apiUrl(`/api/projects/${projectId}/offers`));
      if (offersRes.ok) {
        const offersData = await offersRes.json();
        setOffers(offersData);
      }

      const ordersRes = await fetch(apiUrl(`/api/projects/${projectId}/orders`));
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }

      const supplementsRes = await fetch(apiUrl(`/api/projects/${projectId}/supplements`));
      if (supplementsRes.ok) {
        const supplementsData = await supplementsRes.json();
        setSupplements(supplementsData);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Projektdetails:', err);
    }
  };

  const handleStartTender = async () => {
    if (!selectedProject) return;
    
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/projects/${selectedProject.id}/tender/start`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trades: selectedProject.trades.map(t => t.id)
        })
      });

      if (res.ok) {
        alert('Ausschreibung wurde gestartet! Wir suchen nun passende Handwerksbetriebe in Ihrer Region.');
        loadUserProjects(userData.email);
      }
    } catch (err) {
      console.error('Fehler beim Starten der Ausschreibung:', err);
    } finally {
      setLoading(false);
    }
  };

  // NEUE FUNKTION: Vorläufige Beauftragung (Stufe 1)
  const handlePreliminaryOrder = async (offer) => {
    setSelectedOffer(offer);
    setShowContractModal(true);
  };

  // NEUE FUNKTION: Vorläufige Beauftragung bestätigen
  const confirmPreliminaryOrder = async () => {
    if (!selectedOffer) return;

    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/offers/${selectedOffer.id}/preliminary-order`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          offerId: selectedOffer.id,
          timestamp: new Date().toISOString()
        })
      });

      if (res.ok) {
        alert('Vorläufige Beauftragung erfolgreich! Die Kontaktdaten wurden freigegeben. Sie haben nun Zeit für eine Kennenlernphase.');
        setShowContractModal(false);
        loadProjectDetails(selectedProject.id);
      }
    } catch (err) {
      console.error('Fehler bei vorläufiger Beauftragung:', err);
    } finally {
      setLoading(false);
    }
  };

  // NEUE FUNKTION: Verbindliche Beauftragung (Stufe 2)
  const handleFinalOrder = async (offer) => {
    if (!confirm('Möchten Sie diesen Handwerker verbindlich beauftragen? Es entsteht ein rechtsgültiger Werkvertrag.')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/offers/${offer.id}/final-order`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProject.id,
          offerId: offer.id,
          timestamp: new Date().toISOString()
        })
      });

      if (res.ok) {
        alert('Verbindliche Beauftragung erfolgreich! Der Werkvertrag ist zustande gekommen.');
        loadProjectDetails(selectedProject.id);
      }
    } catch (err) {
      console.error('Fehler bei verbindlicher Beauftragung:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateBudgetOverview = () => {
    if (!selectedProject) return null;
    
    const initialBudget = selectedProject.budget || 0;
    const estimatedCost = selectedProject.totalCost || 0;
    const orderedAmount = orders.reduce((sum, order) => sum + (order.amount || 0), 0);
    const supplementsRequested = supplements.reduce((sum, s) => sum + (s.amount || 0), 0);
    const supplementsApproved = supplements.filter(s => s.approved).reduce((sum, s) => sum + (s.amount || 0), 0);
    
    return {
      initialBudget,
      estimatedCost,
      orderedAmount,
      supplementsRequested,
      supplementsApproved,
      totalCurrent: orderedAmount + supplementsApproved,
      variance: initialBudget ? ((orderedAmount + supplementsApproved - initialBudget) / initialBudget * 100) : 0
    };
  };

  const handleLogout = () => {
    sessionStorage.removeItem('userData');
    navigate('/');
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-white">Lade Dashboard...</p>
      </div>
    </div>
  );

  const budgetOverview = calculateBudgetOverview();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-2xl font-bold text-white hover:text-teal-400 transition-colors">
                byndl
              </Link>
              <span className="text-gray-400">|</span>
              <h1 className="text-xl text-white">Bauherren-Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-300">
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
                {userData?.name || userData?.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Projekt-Auswahl */}
        {projects.length > 0 && (
          <div className="mb-8">
            <label className="text-white text-sm font-medium mb-2 block">Projekt auswählen:</label>
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const project = projects.find(p => p.id === parseInt(e.target.value));
                setSelectedProject(project);
                if (project) loadProjectDetails(project.id);
              }}
              className="bg-white/10 backdrop-blur border border-white/30 rounded-lg px-4 py-2 text-white"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id} className="bg-slate-800">
                  {project.category} - {project.sub_category} ({project.status})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-white/20 overflow-x-auto">
          {['overview', 'tenders', 'offers', 'contracts', 'orders', 'budget', 'schedule'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'text-teal-400 border-b-2 border-teal-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'overview' && 'Übersicht'}
              {tab === 'tenders' && 'Ausschreibungen'}
              {tab === 'offers' && 'Angebote'}
              {tab === 'contracts' && 'Vertragsanbahnung'}
              {tab === 'orders' && 'Aufträge'}
              {tab === 'budget' && 'Kostenübersicht'}
              {tab === 'schedule' && 'Terminplan'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          {/* Übersicht Tab */}
          {activeTab === 'overview' && selectedProject && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Projektübersicht</h2>
              
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-gray-400 text-sm mb-2">Projektstatus</h3>
                  <p className="text-xl font-semibold text-teal-400">{selectedProject.status}</p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-gray-400 text-sm mb-2">Geschätzte Kosten</h3>
                  <p className="text-xl font-semibold text-white">
                    {selectedProject.totalCost?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) || '-'}
                  </p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-gray-400 text-sm mb-2">Anzahl Gewerke</h3>
                  <p className="text-xl font-semibold text-white">{selectedProject.trades?.length || 0}</p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-gray-400 text-sm mb-2">Offene Angebote</h3>
                  <p className="text-xl font-semibold text-yellow-400">
                    {offers.filter(o => o.status === 'offen').length}
                  </p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-gray-400 text-sm mb-2">In Vertragsanbahnung</h3>
                  <p className="text-xl font-semibold text-blue-400">
                    {offers.filter(o => o.status === 'vertragsanbahnung').length}
                  </p>
                </div>
                
                <div className="bg-white/10 rounded-lg p-4">
                  <h3 className="text-gray-400 text-sm mb-2">Erteilte Aufträge</h3>
                  <p className="text-xl font-semibold text-green-400">{orders.length}</p>
                </div>
              </div>

              {selectedProject.status === 'LV erstellt' && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleStartTender}
                    className="px-8 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
                  >
                    Jetzt ausschreiben →
                  </button>
                  <p className="text-gray-400 text-sm mt-2">
                    Wir suchen geeignete Handwerksbetriebe in Ihrer Region
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Angebote Tab - MIT ZWEISTUFIGER VERGABE */}
          {activeTab === 'offers' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Eingegangene Angebote</h2>
              
              <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                  <strong>ℹ️ Zweistufige Vergabe:</strong> Wählen Sie zunächst "Vorläufig beauftragen" für eine Kennenlernphase. 
                  Nach erfolgreicher Prüfung können Sie verbindlich beauftragen.
                </p>
              </div>
              
              {offers.length === 0 ? (
                <p className="text-gray-400">Noch keine Angebote eingegangen.</p>
              ) : (
                <div className="space-y-4">
                  {offers.map((offer, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{offer.tradeName}</h3>
                          <p className="text-gray-300">{offer.companyName}</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Eingegangen: {new Date(offer.date).toLocaleDateString('de-DE')}
                          </p>
                          {offer.bundleDiscount && (
                            <span className="inline-block mt-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
                              Bündelrabatt: {offer.bundleDiscount}% bei Komplettbeauftragung
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-teal-400">
                            {offer.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </p>
                          
                          {/* Status-basierte Aktionen */}
                          {offer.status === 'offen' && (
                            <button 
                              onClick={() => handlePreliminaryOrder(offer)}
                              className="mt-2 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm"
                            >
                              Vorläufig beauftragen
                            </button>
                          )}
                          
                          {offer.status === 'vertragsanbahnung' && (
                            <div className="mt-2 space-y-2">
                              <span className="block text-xs bg-blue-600 text-blue-200 px-2 py-1 rounded">
                                In Vertragsanbahnung
                              </span>
                              <button 
                                onClick={() => handleFinalOrder(offer)}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                              >
                                Verbindlich beauftragen
                              </button>
                            </div>
                          )}
                          
                          {offer.status === 'beauftragt' && (
                            <span className="block mt-2 text-xs bg-green-600 text-green-200 px-2 py-1 rounded">
                              Beauftragt
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NEU: Vertragsanbahnung Tab */}
          {activeTab === 'contracts' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Vertragsanbahnungen</h2>
              
              <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-300 text-sm">
                  <strong>⚠️ Exklusivitätsvereinbarung:</strong> In der Vertragsanbahnung haben Sie exklusiven Kontakt zum Handwerker. 
                  Die Nachwirkfrist von 24 Monaten ist bereits aktiv.
                </p>
              </div>
              
              {offers.filter(o => o.status === 'vertragsanbahnung').length === 0 ? (
                <p className="text-gray-400">Keine laufenden Vertragsanbahnungen.</p>
              ) : (
                <div className="space-y-4">
                  {offers.filter(o => o.status === 'vertragsanbahnung').map((offer, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white">{offer.tradeName}</h3>
                          <p className="text-gray-300">{offer.companyName}</p>
                          <div className="mt-3 space-y-2">
                            <p className="text-sm text-gray-400">
                              <strong>Kontaktdaten:</strong><br />
                              Tel: {offer.phone}<br />
                              E-Mail: {offer.email}
                            </p>
                            <p className="text-sm text-gray-400">
                              Vertragsanbahnung seit: {new Date(offer.preliminaryDate).toLocaleDateString('de-DE')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-teal-400 mb-3">
                            {offer.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </p>
                          <div className="space-y-2">
                            <button 
                              onClick={() => handleFinalOrder(offer)}
                              className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                            >
                              Verbindlich beauftragen
                            </button>
                            <button 
                              className="w-full px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Auftrag zurücknehmen
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Aufträge Tab */}
          {activeTab === 'orders' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Erteilte Aufträge</h2>
              
              {orders.length === 0 ? (
                <p className="text-gray-400">Noch keine Aufträge erteilt.</p>
              ) : (
                <div className="space-y-4">
                  {orders.map((order, idx) => (
                    <div key={idx} className="bg-white/5 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-white">{order.tradeName}</h3>
                          <p className="text-gray-300">{order.companyName}</p>
                          <p className="text-sm text-gray-400 mt-1">Beauftragt: {new Date(order.date).toLocaleDateString('de-DE')}</p>
                          {order.isBundle && (
                            <span className="inline-block mt-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
                              Teil eines Projektbündels
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-400">
                            {order.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded mt-2 inline-block ${
                            order.status === 'in Arbeit' ? 'bg-blue-600 text-blue-200' :
                            order.status === 'abgeschlossen' ? 'bg-green-600 text-green-200' :
                            'bg-gray-600 text-gray-300'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Andere Tabs bleiben unverändert... */}
          {/* Kostenübersicht Tab */}
          {activeTab === 'budget' && budgetOverview && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Kostenübersicht</h2>
              
              <div className="space-y-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Anfangsbudget</span>
                    <span className="text-xl text-white">
                      {budgetOverview.initialBudget.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">KI-Kostenschätzung</span>
                    <span className="text-xl text-blue-400">
                      {budgetOverview.estimatedCost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Beauftragte Summe</span>
                    <span className="text-xl text-green-400">
                      {budgetOverview.orderedAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                </div>
                
                {supplements.length > 0 && (
                  <>
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Eingegangene Nachträge</span>
                        <span className="text-xl text-orange-400">
                          {budgetOverview.supplementsRequested.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="bg-white/5 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400">Genehmigte Nachträge</span>
                        <span className="text-xl text-orange-600">
                          {budgetOverview.supplementsApproved.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                        </span>
                      </div>
                    </div>
                  </>
                )}
                
                <div className="border-t border-white/20 pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-semibold">Gesamtkosten aktuell</span>
                    <span className={`text-2xl font-bold ${
                      budgetOverview.totalCurrent > budgetOverview.initialBudget ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {budgetOverview.totalCurrent.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  </div>
                  {budgetOverview.variance !== 0 && (
                    <p className={`text-sm mt-2 text-right ${
                      budgetOverview.variance > 0 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {budgetOverview.variance > 0 ? '+' : ''}{budgetOverview.variance.toFixed(1)}% vom Budget
                    </p>
                  )}
                </div>
              </div>

              {supplements.filter(s => !s.approved).length > 0 && (
                <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-300 text-sm">
                    <strong>⚠️ KI-Hinweis:</strong> Sie haben {supplements.filter(s => !s.approved).length} ungeprüfte Nachträge. 
                    Die KI-Analyse kann Ihnen bei der Bewertung helfen.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Terminplan Tab */}
          {activeTab === 'schedule' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">KI-Terminplanung</h2>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                <p className="text-blue-300 text-sm">
                  <strong>ℹ️ Info:</strong> Die KI erstellt basierend auf Ihren Gewerken und deren Abhängigkeiten einen optimalen Terminplan.
                </p>
              </div>
              
              <div className="space-y-4">
                {selectedProject?.trades?.map((trade, idx) => (
                  <div key={idx} className="bg-white/5 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-white font-semibold">{trade.name}</h3>
                        <p className="text-gray-400 text-sm mt-1">
                          Geschätzte Dauer: {trade.estimatedDuration || '5-7'} Tage
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-300 text-sm">Geplanter Start:</p>
                        <p className="text-white">KW {15 + idx * 2} / 2024</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Neues Projekt Button */}
        <div className="mt-8 text-center">
          <Link
            to="/start"
            className="inline-block px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
          >
            + Neues Projekt anlegen
          </Link>
        </div>
      </div>

      {/* Modal für Vertragsanbahnung */}
      {showContractModal && selectedOffer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-4">Vorläufige Beauftragung</h2>
            
            <div className="bg-white/10 rounded-lg p-4 mb-6">
              <p className="text-gray-300 mb-3">
                Sie beauftragen vorläufig:
              </p>
              <p className="text-white font-semibold">{selectedOffer.companyName}</p>
              <p className="text-gray-400">{selectedOffer.tradeName}</p>
              <p className="text-teal-400 font-bold mt-2">
                {selectedOffer.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <p className="text-yellow-300 text-sm">
                <strong>⚠️ Wichtige Hinweise:</strong>
              </p>
              <ul className="text-yellow-200 text-sm mt-2 space-y-1 list-disc list-inside">
                <li>Kontaktdaten werden freigegeben</li>
                <li>Kennenlernphase beginnt (Ortstermin möglich)</li>
                <li>Nachwirkfrist von 24 Monaten wird aktiviert</li>
                <li>Faire Ausstiegsmöglichkeiten bestehen weiterhin</li>
              </ul>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowContractModal(false)}
                className="flex-1 px-4 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
              >
                Abbrechen
              </button>
              <button
                onClick={confirmPreliminaryOrder}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
              >
                Vorläufig beauftragen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
