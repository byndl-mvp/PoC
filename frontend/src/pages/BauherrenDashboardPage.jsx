import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

function formatCurrency(value) {
  if (!value && value !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

export default function BauherrenDashboardPage() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [tenders, setTenders] = useState([]); // eslint-disable-line no-unused-vars
  const [offers, setOffers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [supplements, setSupplements] = useState([]); // Nachträge
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [pendingLvProjectId, setPendingLvProjectId] = useState(null);
  
  useEffect(() => {
  // Prüfe beide mögliche Keys
  const storedUserData = sessionStorage.getItem('userData') || 
                        sessionStorage.getItem('bauherrData');
  const token = sessionStorage.getItem('bauherrToken');
  
  console.log('Dashboard checking userData:', storedUserData);
  console.log('Dashboard checking token:', token);
  
  if (!storedUserData || !token) {
    console.log('No userData or token, redirecting to login');
    navigate('/bauherr/login');
    return;
  }
  
  try {
    const user = JSON.parse(storedUserData);
    console.log('Parsed user:', user);
    setUserData(user);
    loadUserProjects(user.email);
  } catch (error) {
    console.error('Failed to parse userData:', error);
    navigate('/bauherr/login');
  }

    // NEU: Check für pending LV-Projekt
  const pendingProjectId = sessionStorage.getItem('pendingLvProject');
  if (pendingProjectId) {
    setPendingLvProjectId(pendingProjectId);
    // Optional: sessionStorage.removeItem('pendingLvProject');
  }
}, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUserProjects = async (email) => {
  try {
    setLoading(true);
    
    const res = await fetch(apiUrl(`/api/projects/user/${encodeURIComponent(email)}`));
    
    if (res.ok) {
      const projectsData = await res.json();
      
      const projectsWithDetails = await Promise.all(
        projectsData.map(async (project) => {
          // Lade Gewerke
          const tradesRes = await fetch(apiUrl(`/api/projects/${project.id}/trades`));
          const tradesData = tradesRes.ok ? await tradesRes.json() : [];
          
          // Lade LVs
          const lvRes = await fetch(apiUrl(`/api/projects/${project.id}/lv`));
          const lvData = lvRes.ok ? await lvRes.json() : { lvs: [] };
          
          // Zähle fertige LVs
          const completedLvs = (lvData.lvs || []).filter(lv => 
            lv.content?.positions?.length > 0
          ).length;
          
          // Berechne Gesamtkosten
          const totalCost = (lvData.lvs || []).reduce((sum, lv) => {
            const lvSum = lv.content?.totalSum || 0;
            return sum + parseFloat(lvSum);
          }, 0);
          
          // Erstelle Trade-Details mit LV-Status
          const tradesWithLv = tradesData.map(trade => {
            const lv = lvData.lvs?.find(l => l.trade_id === trade.id);
            return {
              ...trade,
              hasLV: !!lv && lv.content?.positions?.length > 0,
              lv: lv,
              totalCost: lv?.content?.totalSum || 0
            };
          });
          
          return {
            ...project,
            trades: tradesWithLv,
            completedLvs: completedLvs,
            totalCost: totalCost,
            status: determineProjectStatus(
              project, 
              tradesData, 
              completedLvs
            )
          };
        })
      );
      
      setProjects(projectsWithDetails);
      if (projectsWithDetails.length > 0) {
        // Nicht automatisch ein Projekt auswählen - bei Projektübersicht bleiben
        // Nur wenn ein pendingLvProjectId vorhanden ist, dieses Projekt öffnen
        if (pendingLvProjectId) {
          const pendingProject = projectsWithDetails.find(p => p.id === parseInt(pendingLvProjectId));
          if (pendingProject) {
            setSelectedProject(pendingProject);
            loadProjectDetails(pendingProject.id);
          }
        }
        // Ansonsten bleibt selectedProject null und die Projektübersicht wird angezeigt
      }
    }
  } catch (err) {
    console.error('Fehler beim Laden der Projekte:', err);
  } finally {
    setLoading(false);
  }
};

  const determineProjectStatus = (project, tradesData, completedLvs) => {
  const totalTrades = tradesData?.length || 0;
  const lvCount = completedLvs?.length || 0;
  
  if (totalTrades === 0) return 'Gewerke wählen';
  if (lvCount === 0) return `0 von ${totalTrades} LVs erstellt`;
  if (lvCount < totalTrades) return `${lvCount} von ${totalTrades} LVs erstellt`;
  if (project.tendersSent) return 'Ausschreibung läuft';
  if (project.ordersPlaced) return 'In Ausführung';
  return 'Bereit zur Ausschreibung';
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

  const handleStartTender = async (tradeIds = 'all') => {
  if (!selectedProject) return;
  
  try {
    setLoading(true);
    const res = await fetch(apiUrl(`/api/projects/${selectedProject.id}/tender/create`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeIds: tradeIds,
        timeframe: selectedProject.timeframe || 'Nach Absprache'
      })
    });

    if (res.ok) {
      const data = await res.json();
      
      // Zeige spezifische Infos über gematchte Handwerker
      const totalMatched = data.tenders.reduce((sum, t) => sum + t.matchedHandwerker, 0);
      
      if (totalMatched === 0) {
        alert('⚠️ Aktuell keine passenden Handwerker verfügbar. Wir benachrichtigen Sie, sobald sich passende Betriebe registrieren.');
      } else {
        alert(`✅ ${totalMatched} Handwerker wurden benachrichtigt und können nun Angebote abgeben!`);
      }
      
      loadUserProjects(userData.email);
    }
  } catch (err) {
    console.error('Fehler:', err);
    alert('Fehler beim Starten der Ausschreibung');
  } finally {
    setLoading(false);
  }
};

  // Erweiterte Funktion für vorläufige Beauftragung
const handlePreliminaryOrder = async (offer) => {
  setSelectedOffer(offer);
  setShowContractModal(true);
};

/// Erweiterte Modal-Komponente (ca. Zeile 156)
const ContractNegotiationModal = () => {
  if (!selectedOffer) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-white/20">
        <h2 className="text-2xl font-bold text-white mb-6">
          Vorläufige Beauftragung - Stufe 1
        </h2>
        
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <h3 className="text-blue-300 font-semibold mb-2">
            Was passiert bei der vorläufigen Beauftragung?
          </h3>
          <ul className="text-blue-200 text-sm space-y-2">
            <li>✓ Kontaktdaten werden beiderseitig freigegeben</li>
            <li>✓ Sie können einen Ortstermin vereinbaren</li>
            <li>✓ Der Handwerker kann sein Angebot nach Besichtigung anpassen</li>
            <li>✓ Die 24-monatige Nachwirkfrist beginnt</li>
            <li>✓ Sie behalten faire Ausstiegsmöglichkeiten</li>
          </ul>
        </div>
        
        <div className="bg-white/10 rounded-lg p-4 mb-6">
          <h4 className="text-white font-semibold mb-2">Angebot von:</h4>
          <p className="text-gray-300">{selectedOffer.companyName || selectedOffer.company_name}</p>
          <p className="text-gray-400">{selectedOffer.tradeName || selectedOffer.trade_name}</p>
          <p className="text-teal-400 font-bold mt-2">
            {formatCurrency(selectedOffer.amount)}
          </p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => setShowContractModal(false)}
            className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Abbrechen
          </button>
          <button
            onClick={confirmPreliminaryOrder}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg"
          >
            Vorläufig beauftragen (Stufe 1)
          </button>
        </div>
      </div>
    </div>
  );
};

  // NEUE FUNKTION: Vorläufige Beauftragung bestätigen
  const confirmPreliminaryOrder = async () => {
    if (!selectedOffer) return;

    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/offers/${selectedOffer.id}/preliminary-accept`), {
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
    if (!window.confirm('Möchten Sie diesen Handwerker verbindlich beauftragen? Es entsteht ein rechtsgültiger Werkvertrag.')) {
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

  const ProjectWizard = ({ project }) => (
  <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl p-6 mb-8">
    <h3 className="text-lg font-semibold text-white mb-4">Ihr Projekt-Fortschritt</h3>
    
    <div className="flex items-center justify-between">
      {[
        { step: 1, label: 'Gewerke wählen', done: project.trades?.length > 0 },
        { step: 2, label: 'LVs erstellen', done: project.completedLvs > 0, current: true },
        { step: 3, label: 'Ausschreiben', done: project.hasTenders },
        { step: 4, label: 'Angebote prüfen', done: project.offers?.length > 0 },
        { step: 5, label: 'Beauftragen', done: project.orders?.length > 0 }
      ].map((step, idx) => (
        <div key={idx} className="flex flex-col items-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
            step.done ? 'bg-green-500 text-white' :
            step.current ? 'bg-yellow-500 text-white animate-pulse' :
            'bg-gray-600 text-gray-400'
          }`}>
            {step.done ? '✓' : step.step}
          </div>
          <span className={`text-xs mt-2 ${
            step.done ? 'text-green-400' :
            step.current ? 'text-yellow-400' :
            'text-gray-500'
          }`}>
            {step.label}
          </span>
        </div>
      ))}
    </div>
    
    {project.completedLvs === 0 && (
      <div className="mt-6 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
        <p className="text-yellow-300">
          <strong>Nächster Schritt:</strong> Erstellen Sie die Leistungsverzeichnisse für Ihre gewählten Gewerke
        </p>
      </div>
    )}
  </div>
);

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
  {/* Projekt-Karten Grid - Hauptübersicht */}
  {!selectedProject ? (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Meine Projekte</h2>
        <p className="text-gray-400">Wählen Sie ein Projekt zur Bearbeitung</p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => {
          const progress = ((project.completedLvs || 0) / (project.trades?.length || 1)) * 100;
          const isPending = pendingLvProjectId && project.id === parseInt(pendingLvProjectId);
          const statusColor = project.status === 'Bereit zur Ausschreibung' ? 'green' :
                             project.status === 'Ausschreibung läuft' ? 'blue' :
                             project.status?.includes('LVs erstellt') ? 'yellow' : 'gray';
          
          return (
            <div
              key={project.id}
              className={`bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl border ${
                isPending ? 'border-yellow-500/50 ring-2 ring-yellow-500/30' : 'border-white/20'
              } hover:border-teal-500/50 transition-all hover:shadow-2xl hover:scale-[1.02] cursor-pointer relative`}
              onClick={() => {
                setSelectedProject(project);
                loadProjectDetails(project.id);
                if (isPending) sessionStorage.removeItem('pendingLvProject');
              }}
            >
              {/* Pending Badge */}
              {isPending && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full animate-pulse">
                  NEU
                </div>
              )}
              
              {/* Status Badge */}
              <div className="px-6 pt-6 pb-3">
                <div className="flex justify-between items-start mb-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                    ${statusColor === 'green' ? 'bg-green-500/20 text-green-300' :
                      statusColor === 'blue' ? 'bg-blue-500/20 text-blue-300' :
                      statusColor === 'yellow' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-gray-500/20 text-gray-300'}`}>
                    {project.status}
                  </span>
                  <span className="text-gray-400 text-xs">
                    ID: {project.id}
                  </span>
                </div>
                
                {/* Projekt Name */}
                <h3 className="text-xl font-bold text-white mb-2">
                  {project.category}
                </h3>
                <p className="text-gray-400 text-sm mb-4">
                  {project.sub_category}
                </p>
                
                {/* Pending Hinweis */}
                {isPending && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                    <p className="text-yellow-300 text-xs font-semibold">
                      📋 LVs warten auf Bearbeitung
                    </p>
                  </div>
                )}
                
                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>LV-Fortschritt</span>
                    <span>{project.completedLvs || 0} / {project.trades?.length || 0}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-teal-500 to-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Gewerke</p>
                    <p className="text-lg font-semibold text-white">
                      {project.trades?.length || 0}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400 mb-1">Geschätzt</p>
                    <p className="text-lg font-semibold text-teal-400">
                      {formatCurrency(project.totalCost)}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Action Button */}
              <div className="px-6 pb-6">
                <button
                  className={`w-full px-4 py-3 ${
                    isPending 
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500' 
                      : 'bg-gradient-to-r from-teal-500 to-blue-600'
                  } text-white rounded-lg font-semibold hover:shadow-lg transition-all`}
                >
                  {isPending ? 'LVs bearbeiten →' : 'Projekt öffnen →'}
                </button>
              </div>
            </div>
          );
        })}
        
        {/* Neue Projekt Karte */}
        <div
          className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 backdrop-blur-lg rounded-2xl border-2 border-dashed border-purple-500/50 hover:border-purple-400 transition-all hover:shadow-2xl cursor-pointer flex items-center justify-center min-h-[400px]"
          onClick={() => navigate('/start')}
        >
          <div className="text-center p-6">
            <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Neues Projekt</h3>
            <p className="text-gray-400 text-sm mb-4">Starten Sie ein neues Bauprojekt</p>
            <button className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
              Projekt erstellen
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : (
    /* Ausgewähltes Projekt - Detailansicht */
    <>
      {/* Zurück-Navigation */}
      <div className="mb-6">
        <button
          onClick={() => {
            setSelectedProject(null);
            setActiveTab('overview');
          }}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Zurück zur Projektübersicht
        </button>
      </div>
      
      {/* Pending Hinweis in Projektansicht */}
      {pendingLvProjectId && selectedProject.id === parseInt(pendingLvProjectId) && (
        <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
          <h3 className="text-yellow-300 font-semibold text-lg mb-2">
            📋 Unvollständiges Projekt
          </h3>
          <p className="text-gray-300 mb-4">
            Die KI-generierten Leistungsverzeichnisse warten auf Ihre Bearbeitung.
          </p>
          <button
            onClick={() => {
              navigate(`/project/${selectedProject.id}/lv-review`);
              sessionStorage.removeItem('pendingLvProject');
            }}
            className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
          >
            Jetzt LVs bearbeiten →
          </button>
        </div>
      )}
      
      {/* Projekt-Header */}
      <div className="bg-gradient-to-r from-blue-600/20 to-teal-600/20 rounded-xl p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {selectedProject.category} - {selectedProject.sub_category}
            </h1>
            <p className="text-gray-400">
              Status: {selectedProject.status} | 
              Erstellt: {new Date(selectedProject.created_at).toLocaleDateString('de-DE')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Geschätzte Kosten</p>
            <p className="text-2xl font-bold text-teal-400">{formatCurrency(selectedProject.totalCost)}</p>
          </div>
        </div>
      </div>

      {/* Project Wizard */}
      <ProjectWizard project={selectedProject} />
      
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
    
    {/* Projekt-Status Card */}
    <div className="bg-gradient-to-r from-blue-600/20 to-teal-600/20 rounded-xl p-6 mb-6">
      <h3 className="text-lg font-semibold text-white mb-4">Projektstatus</h3>
      
      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-300 mb-2">
          <span>Fortschritt</span>
          <span>{selectedProject.completedLvs || 0} von {selectedProject.trades?.length || 0} LVs erstellt</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-teal-500 to-blue-600 h-3 rounded-full transition-all"
            style={{ 
              width: `${((selectedProject.completedLvs || 0) / (selectedProject.trades?.length || 1)) * 100}%` 
            }}
          />
        </div>
      </div>
      
      {/* Status Steps */}
      <div className="grid grid-cols-4 gap-2 mt-6">
        <div className={`text-center p-3 rounded-lg ${
          selectedProject.trades?.length > 0 ? 'bg-green-500/20 border-green-500' : 'bg-white/10'
        } border`}>
          <div className="text-2xl mb-1">✓</div>
          <div className="text-xs text-gray-300">Gewerke gewählt</div>
        </div>
        <div className={`text-center p-3 rounded-lg ${
          selectedProject.completedLvs > 0 ? 'bg-yellow-500/20 border-yellow-500' : 'bg-white/10'
        } border`}>
          <div className="text-2xl mb-1">{selectedProject.completedLvs > 0 ? '⚡' : '○'}</div>
          <div className="text-xs text-gray-300">LVs in Bearbeitung</div>
        </div>
        <div className={`text-center p-3 rounded-lg ${
          selectedProject.status === 'Ausschreibung läuft' ? 'bg-blue-500/20 border-blue-500' : 'bg-white/10'
        } border`}>
          <div className="text-2xl mb-1">{selectedProject.tendersSent ? '📤' : '○'}</div>
          <div className="text-xs text-gray-300">Ausschreibung</div>
        </div>
        <div className={`text-center p-3 rounded-lg ${
          orders.length > 0 ? 'bg-green-500/20 border-green-500' : 'bg-white/10'
        } border`}>
          <div className="text-2xl mb-1">{orders.length > 0 ? '✓' : '○'}</div>
          <div className="text-xs text-gray-300">Aufträge</div>
        </div>
      </div>
    </div>
    
    {/* Action Buttons */}
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      {/* LV-Bearbeitung Button */}
      <button
        onClick={() => navigate(`/project/${selectedProject.id}/lv-review`)}
        className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl p-6 hover:shadow-xl transform hover:scale-[1.02] transition-all"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold mb-2">📝 LVs bearbeiten</h3>
            <p className="text-sm opacity-90">
              {selectedProject.completedLvs === 0 
                ? 'Jetzt mit der LV-Erstellung beginnen'
                : `${selectedProject.trades?.length - selectedProject.completedLvs} LVs noch offen`
              }
            </p>
          </div>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
      
      {/* Kostenübersicht Button */}
      <button
        onClick={() => {
          if (selectedProject.completedLvs === 0) {
            alert('Bitte erstellen Sie zuerst mindestens ein LV.');
            return;
          }
          navigate(`/project/${selectedProject.id}/result`);
        }}
        className={`rounded-xl p-6 transition-all ${
          selectedProject.completedLvs > 0
            ? 'bg-gradient-to-r from-teal-500 to-blue-600 text-white hover:shadow-xl transform hover:scale-[1.02]'
            : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
        }`}
        disabled={selectedProject.completedLvs === 0}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold mb-2">💰 Kostenübersicht</h3>
            <p className="text-sm opacity-90">
              {selectedProject.completedLvs > 0 
                ? `Aktuelle Kalkulation: ${formatCurrency(selectedProject.totalCost)}`
                : 'Noch keine LVs erstellt'
              }
            </p>
          </div>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </div>
    
    {/* Meine LVs Section */}
    {selectedProject.completedLvs > 0 && (
      <div className="bg-white/10 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Meine erstellten LVs</h3>
        <div className="space-y-3">
          {selectedProject.trades?.filter(t => t.hasLV).map((trade, idx) => (
            <div key={idx} className="bg-white/5 rounded-lg p-4 flex justify-between items-center">
              <div>
                <h4 className="text-white font-medium">{trade.name}</h4>
                <p className="text-sm text-gray-400">
                  {trade.lv?.content?.positions?.length || 0} Positionen | 
                  {formatCurrency(trade.totalCost)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/project/${selectedProject.id}/lv-review`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Bearbeiten
                </button>
                <button
                  onClick={() => handleStartTender([trade.id])}
                  
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  Ausschreiben →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
    
    {/* Quick Actions */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white/10 rounded-lg p-4">
        <h3 className="text-gray-400 text-sm mb-2">Geschätzte Kosten</h3>
        <p className="text-xl font-semibold text-white">
          {formatCurrency(selectedProject.totalCost)}
        </p>
      </div>
      
      <div className="bg-white/10 rounded-lg p-4">
        <h3 className="text-gray-400 text-sm mb-2">Anzahl Gewerke</h3>
        <p className="text-xl font-semibold text-white">
          {selectedProject.trades?.length || 0}
        </p>
      </div>
      
      <div className="bg-white/10 rounded-lg p-4">
        <h3 className="text-gray-400 text-sm mb-2">Offene Angebote</h3>
        <p className="text-xl font-semibold text-yellow-400">
          {offers.filter(o => o.status === 'offen').length}
        </p>
      </div>
      
      <div className="bg-white/10 rounded-lg p-4">
        <h3 className="text-gray-400 text-sm mb-2">Erteilte Aufträge</h3>
        <p className="text-xl font-semibold text-green-400">
          {orders.length}
        </p>
      </div>
    </div>
    
    {/* Call to Action */}
    {selectedProject.completedLvs === selectedProject.trades?.length && 
     selectedProject.completedLvs > 0 && 
     !selectedProject.tendersSent && (
      <div className="mt-8 bg-gradient-to-r from-green-600/20 to-teal-600/20 rounded-xl p-6 text-center">
        <h3 className="text-xl font-bold text-white mb-3">
          🎉 Alle LVs sind fertig!
        </h3>
        <p className="text-gray-300 mb-4">
          Ihre Leistungsverzeichnisse sind vollständig. Sie können jetzt die Ausschreibung starten.
        </p>
        <button
          onClick={handleStartTender}
          
          className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
        >
          🚀 Jetzt alle Gewerke ausschreiben
        </button>
      </div>
    )}
  </div>
)}

          {/* Angebote Tab - ERWEITERT */}
{activeTab === 'offers' && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Eingegangene Angebote</h2>
    
    {/* Status-Übersicht */}
    <div className="grid md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
        <p className="text-gray-400 text-sm">Neue Angebote</p>
        <p className="text-2xl font-bold text-teal-400">
          {offers.filter(o => !o.viewed).length}
        </p>
      </div>
      <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
        <p className="text-gray-400 text-sm">In Prüfung</p>
        <p className="text-2xl font-bold text-yellow-400">
          {offers.filter(o => o.status === 'reviewing').length}
        </p>
      </div>
      <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
        <p className="text-gray-400 text-sm">Vertragsanbahnung</p>
        <p className="text-2xl font-bold text-blue-400">
          {offers.filter(o => o.status === 'preliminary').length}
        </p>
      </div>
      <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
        <p className="text-gray-400 text-sm">Beauftragt</p>
        <p className="text-2xl font-bold text-green-400">
          {offers.filter(o => o.status === 'accepted').length}
        </p>
      </div>
    </div>
    
    <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
      <p className="text-blue-300 text-sm">
        <strong>ℹ️ Zweistufige Vergabe:</strong> Wählen Sie zunächst "Vorläufig beauftragen" für eine Kennenlernphase. 
        Nach erfolgreicher Prüfung können Sie verbindlich beauftragen.
      </p>
    </div>
    
    {offers.length === 0 ? (
      <div className="bg-white/10 backdrop-blur rounded-lg p-8 border border-white/20 text-center">
        <p className="text-gray-400 mb-4">Noch keine Angebote eingegangen.</p>
        <button
          onClick={() => setActiveTab('overview')}
          className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
        >
          Zur Übersicht
        </button>
      </div>
    ) : (
      <div className="space-y-4">
        {/* Gruppierung nach Gewerk */}
        {Object.entries(
          offers.reduce((grouped, offer) => {
            const key = offer.tradeName || offer.trade_name || 'Unbekannt';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(offer);
            return grouped;
          }, {})
        ).map(([tradeName, tradeOffers]) => (
          <div key={tradeName} className="bg-white/5 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
              <span>{tradeName}</span>
              <span className="text-sm text-gray-400">
                {tradeOffers.length} Angebot(e)
              </span>
            </h3>
            
            <div className="space-y-3">
              {tradeOffers.map((offer, idx) => (
                <div key={idx} className="bg-white/10 rounded-lg p-4 border border-white/20">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-semibold text-white">
                          {offer.companyName || offer.company_name}
                        </h4>
                        {!offer.viewed && (
                          <span className="bg-teal-500 text-white text-xs px-2 py-1 rounded">NEU</span>
                        )}
                        {offer.bundleDiscount > 0 && (
                          <span className="bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
                            Bündelrabatt: {offer.bundleDiscount}%
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                        <div>
                          <p>📅 Eingegangen: {new Date(offer.created_at || offer.date).toLocaleDateString('de-DE')}</p>
                          <p>⏱️ Ausführung: {offer.executionTime || 'Nach Absprache'}</p>
                        </div>
                        <div>
                          <p>📞 Tel: {offer.phone || 'Wird nach Beauftragung mitgeteilt'}</p>
                          <p>✉️ Email: {offer.email || 'Wird nach Beauftragung mitgeteilt'}</p>
                        </div>
                      </div>
                      
                      {offer.notes && (
                        <div className="mt-3 p-3 bg-white/5 rounded">
                          <p className="text-xs text-gray-500 mb-1">Anmerkungen:</p>
                          <p className="text-sm text-gray-300">{offer.notes}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right ml-4">
                      <p className="text-2xl font-bold text-teal-400">
                        {formatCurrency(offer.amount)}
                      </p>
                      <p className="text-xs text-gray-400 mb-3">Netto</p>
                      
                      {/* Status-basierte Aktionen */}
                      {offer.status === 'submitted' && (
                        <div className="space-y-2">
                          <button
                            onClick={async () => {
                              // Markiere als gelesen
                              await fetch(apiUrl(`/api/offers/${offer.id}/mark-viewed`), {
                                method: 'POST'
                              });
                              
                              // Öffne Detail-Ansicht
                              navigate(`/project/${selectedProject.id}/offer/${offer.id}`);
                            }}
                            className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                          >
                            LV-Details ansehen
                          </button>
                          <button 
                            onClick={() => handlePreliminaryOrder(offer)}
                            className="w-full px-3 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors text-sm"
                          >
                            Vorläufig beauftragen
                          </button>
                          <button
                            className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                          >
                            Ablehnen
                          </button>
                        </div>
                      )}
                      
                      {offer.status === 'preliminary' && (
                        <div className="space-y-2">
                          <span className="block text-xs bg-blue-600 text-blue-200 px-2 py-1 rounded">
                            In Vertragsanbahnung
                          </span>
                          <button 
                            onClick={() => handleFinalOrder(offer)}
                            className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                          >
                            Verbindlich beauftragen
                          </button>
                        </div>
                      )}
                      
                      {offer.status === 'accepted' && (
                        <span className="block text-xs bg-green-600 text-green-200 px-2 py-1 rounded">
                          ✓ Beauftragt
                        </span>
                      )}
                      
                      {offer.status === 'rejected' && (
                        <span className="block text-xs bg-red-600 text-red-200 px-2 py-1 rounded">
                          Abgelehnt
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Vergleichszeile */}
                  {idx < tradeOffers.length - 1 && (
                    <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        Preisunterschied zum nächsten Angebot:
                      </span>
                      <span className="text-sm font-semibold text-yellow-400">
                        {formatCurrency(Math.abs(offer.amount - tradeOffers[idx + 1].amount))}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Zusammenfassung pro Gewerk */}
              {tradeOffers.length > 1 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-600/10 to-teal-600/10 rounded-lg border border-white/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-400">Preisrahmen für {tradeName}:</p>
                      <p className="text-white">
                        {formatCurrency(Math.min(...tradeOffers.map(o => o.amount)))} - 
                        {formatCurrency(Math.max(...tradeOffers.map(o => o.amount)))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Durchschnittspreis:</p>
                      <p className="text-xl font-bold text-teal-400">
                        {formatCurrency(tradeOffers.reduce((sum, o) => sum + o.amount, 0) / tradeOffers.length)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
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
        </> 
        )} 
      </div>

      {/* Modal für Vertragsanbahnung */}
      {showContractModal && <ContractNegotiationModal />}
    </div>
  );
}
