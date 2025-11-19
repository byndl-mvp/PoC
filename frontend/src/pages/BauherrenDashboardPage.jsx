import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';
import NotificationCenter from '../pages/NotificationCenter';
import MessageCenter from '../pages/MessageCenter';
import { OfferEvaluationModal, OfferComparisonModal } from '../pages/OfferEvaluationModals';
import ScheduleTab from './ScheduleTab';

function formatCurrency(value) {
  if (!value && value !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);
}

// Helper function to truncate text to max words
const truncateWords = (text, maxWords = 10) => {
  if (!text) return '';
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
};

// ============================================================================
// NEUE KOMPONENTE: Ausführungstermine mit Änderungs-Management
// ============================================================================
function ExecutionTimesDisplay({ offerId, projectId, tradeName, apiUrl, onScheduleChange, reloadTrigger }) {
  const [offerData, setOfferData] = useState(null);
  const [scheduleChanges, setScheduleChanges] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Lade Offer-Daten
      const offerRes = await fetch(apiUrl(`/api/offers/${offerId}/details`));
      const offer = await offerRes.json();
      setOfferData(offer);
      
      // Lade Schedule-Änderungen
      const changesRes = await fetch(apiUrl(`/api/offers/${offerId}/schedule-changes`));
      if (changesRes.ok) {
        const changes = await changesRes.json();
        setScheduleChanges(changes);
      }
    } catch (err) {
      console.error('Fehler:', err);
    } finally {
      setLoading(false);
    }
  }, [offerId, apiUrl]);

  useEffect(() => {
    loadData();
  }, [loadData, reloadTrigger]);

  if (loading) return <div className="bg-white/10 rounded-lg p-4 mb-4">Lade...</div>;

  const hasChanges = scheduleChanges.length > 0;

  return (
    <div className={`rounded-lg p-4 mb-4 ${hasChanges ? 'bg-orange-500/10 border border-orange-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
      <h4 className="text-white font-semibold mb-2">📅 Ausführungstermine</h4>
      
      {hasChanges && (
  <div className="mb-3 p-3 bg-orange-500/20 rounded">
    <p className="text-orange-300 text-sm font-semibold mb-2">
      ⚠️ Handwerker hat Terminänderungen vorgeschlagen
    </p>
    <div className="space-y-2">
      {scheduleChanges.map(change => {
        // ✅ FIX: Prüfe ob Start oder Ende sich geändert hat
        const startChanged = change.old_start !== change.new_start;
        const endChanged = change.old_end !== change.new_end;
        
        return (
          <div key={change.id} className="bg-white/5 rounded p-2">
            <div className="text-sm font-semibold text-orange-200 mb-1">
              • {change.phase_name}
            </div>
            <div className="text-xs text-orange-200 ml-4 space-y-0.5">
              {startChanged && (
                <div>
                  Start: {' '}
                  <span className="line-through text-orange-300/60">
                    {new Date(change.old_start).toLocaleDateString('de-DE')}
                  </span>
                  {' → '}
                  <span className="font-semibold">
                    {new Date(change.new_start).toLocaleDateString('de-DE')}
                  </span>
                </div>
              )}
              {endChanged && (
                <div>
                  Ende: {' '}
                  <span className="line-through text-orange-300/60">
                    {new Date(change.old_end).toLocaleDateString('de-DE')}
                  </span>
                  {' → '}
                  <span className="font-semibold">
                    {new Date(change.new_end).toLocaleDateString('de-DE')}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    <p className="text-orange-200 text-xs mt-2">
      Mit der verbindlichen Beauftragung akzeptieren Sie diese Terminänderungen automatisch.
    </p>
  </div>
)}
      
      <p className="text-green-200 text-sm">
  {offerData.status === 'preliminary' ? (
    <span className="text-gray-400 italic">
      Ausführungstermine werden nach Absprache und technischer Klärung im verbindlichen Angebot konkretisiert.
    </span>
  ) : (
    <>
      {new Date(offerData.execution_start).toLocaleDateString('de-DE')} bis {new Date(offerData.execution_end).toLocaleDateString('de-DE')}
    </>
  )}
</p>
    </div>
  );
}

export default function BauherrenDashboardPage() {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const messageCenterRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [scheduleBadgeCount, setScheduleBadgeCount] = useState(0);
  const [schedule, setSchedule] = useState(null);
  const [tenders, setTenders] = useState([]); // eslint-disable-line no-unused-vars
  const [offers, setOffers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [supplements, setSupplements] = useState([]); // Nachträge
  const [showContractModal, setShowContractModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [pendingLvProjectId, setPendingLvProjectId] = useState(null);
  const [unreadOffers, setUnreadOffers] = useState(0);
  const [hasMarkedAsRead, setHasMarkedAsRead] = useState(false);
  const [showContractView, setShowContractView] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingOffer, setRejectingOffer] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [selectedTenderForExtension, setSelectedTenderForExtension] = useState(null);
  const [extensionDays, setExtensionDays] = useState(7);
  const [customDeadline, setCustomDeadline] = useState('');
  const [extensionType, setExtensionType] = useState('days'); // 'days' oder 'custom'
  const [bundleModalOpen, setBundleModalOpen] = useState(false);
  const [selectedBundleOffer, setSelectedBundleOffer] = useState(null);
  const [scheduleReloadTrigger, setScheduleReloadTrigger] = useState(0);
  const [evaluationModal, setEvaluationModal] = useState({
  isOpen: false,
  type: null,
  data: null,
  companyName: null
});
  const [lastViewedTabs, setLastViewedTabs] = useState({
  tenders: null,
  offers: null,
  contracts: null,
  orders: null
});

const [orderTotals, setOrderTotals] = useState({}); // NEU: Speichert Summen inkl. Nachträge pro Auftrag
const [pendingNachtraege, setPendingNachtraege] = useState({}); // NEU: Anzahl offener Nachträge pro Auftrag
  
  // ✅ Background-Generierung States
const [generatingEvaluations, setGeneratingEvaluations] = useState(() => {
  const saved = sessionStorage.getItem('generatingEvaluations');
  return saved ? JSON.parse(saved) : {};
});

const [evaluationProgress, setEvaluationProgress] = useState(() => {
  const saved = sessionStorage.getItem('evaluationProgress');
  return saved ? JSON.parse(saved) : {};
});

const [generatingComparisons, setGeneratingComparisons] = useState(() => {
  const saved = sessionStorage.getItem('generatingComparisons');
  return saved ? JSON.parse(saved) : {};
});

const [comparisonProgress, setComparisonProgress] = useState(() => {
  const saved = sessionStorage.getItem('comparisonProgress');
  return saved ? JSON.parse(saved) : {};
});

// ✅ NEU: Fertige Ergebnisse speichern (NICHT automatisch Modal öffnen!)
const [evaluationResults, setEvaluationResults] = useState(() => {
  const saved = sessionStorage.getItem('evaluationResults');
  return saved ? JSON.parse(saved) : {};
});

const [comparisonResults, setComparisonResults] = useState(() => {
  const saved = sessionStorage.getItem('comparisonResults');
  return saved ? JSON.parse(saved) : {};
});

// Cleanup Helper für Evaluationen
const cleanupEvaluationState = (evalKey) => {
  const savedGen = JSON.parse(sessionStorage.getItem('generatingEvaluations') || '{}');
  delete savedGen[evalKey];
  sessionStorage.setItem('generatingEvaluations', JSON.stringify(savedGen));
  
  const savedProg = JSON.parse(sessionStorage.getItem('evaluationProgress') || '{}');
  delete savedProg[evalKey];
  sessionStorage.setItem('evaluationProgress', JSON.stringify(savedProg));
  
  setGeneratingEvaluations(prev => ({ ...prev, [evalKey]: false }));
  setEvaluationProgress(prev => ({ ...prev, [evalKey]: 0 }));
};

// Cleanup Helper für Comparisons
const cleanupComparisonState = (compKey) => {
  const savedGen = JSON.parse(sessionStorage.getItem('generatingComparisons') || '{}');
  delete savedGen[compKey];
  sessionStorage.setItem('generatingComparisons', JSON.stringify(savedGen));
  
  const savedProg = JSON.parse(sessionStorage.getItem('comparisonProgress') || '{}');
  delete savedProg[compKey];
  sessionStorage.setItem('comparisonProgress', JSON.stringify(savedProg));
  
  setGeneratingComparisons(prev => ({ ...prev, [compKey]: false }));
  setComparisonProgress(prev => ({ ...prev, [compKey]: 0 }));
};
  
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
    
    // Projekte laden
    loadUserProjects(user.email);
    
    // Check für pending LV-Projekt ODER neu erstelltes Projekt
const pendingProjectId = sessionStorage.getItem('pendingLvProject') || 
                        sessionStorage.getItem('currentProjectId');
                        
if (pendingProjectId && user.id) {
  // Verknüpfe Projekt mit Bauherr falls noch nicht geschehen
  fetch(apiUrl('/api/projects/claim'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: pendingProjectId,
      bauherrId: user.id
    })
  }).then(() => {
    setPendingLvProjectId(pendingProjectId);
    sessionStorage.removeItem('currentProjectId');
    sessionStorage.removeItem('pendingLvProject');
    // Projekte laden
    loadUserProjects(user.email);
  });
}
  } catch (error) {
    console.error('Failed to parse userData:', error);
    navigate('/bauherr/login');
  }
}, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Neuer useEffect für Navigation-Events
useEffect(() => {
  // Reload projects wenn von einer anderen Seite zurückgekehrt wird
  const handleFocus = () => {
    if (userData?.email) {
      loadUserProjects(userData.email);
    }
  };
  
  window.addEventListener('focus', handleFocus);
  
  // Cleanup
  return () => {
    window.removeEventListener('focus', handleFocus);
  };
}, [userData]); // eslint-disable-line react-hooks/exhaustive-deps

// Lade gespeicherte lastViewedTabs beim Projekt-Wechsel
useEffect(() => {
  if (selectedProject?.id) {
    const tabs = ['tenders', 'offers', 'contracts', 'orders'];
    const stored = {};
    tabs.forEach(tab => {
      const value = sessionStorage.getItem(`lastViewed_${selectedProject.id}_${tab}`);
      if (value) stored[tab] = value;
    });
    
    // SPECIAL FIX FÜR ORDERS: Wenn kein lastViewed existiert, setze auf neuesten Order
    // Damit beim ersten Laden nicht alle Orders als "neu" gezählt werden
    if (!stored.orders && orders.length > 0) {
      const newestOrderDate = orders.reduce((latest, order) => {
        const orderDate = new Date(order.updated_at || order.created_at);
        return orderDate > new Date(latest) ? orderDate.toISOString() : latest;
      }, orders[0].updated_at || orders[0].created_at);
      
      stored.orders = newestOrderDate;
      sessionStorage.setItem(`lastViewed_${selectedProject.id}_orders`, newestOrderDate);
    }
    
    if (Object.keys(stored).length > 0) {
      setLastViewedTabs(prev => ({ ...prev, ...stored }));
    }
  }
}, [selectedProject?.id, orders]); // orders als Dependency
  
  // AKTUALISIERTE loadUserProjects Funktion
  const loadUserProjects = async (email) => {
    try {
      setLoading(true);
      
      const res = await fetch(apiUrl(`/api/projects/user/${encodeURIComponent(email)}`));
      
      if (res.ok) {
        const projectsData = await res.json();
        
        const projectsWithDetails = await Promise.all(
          projectsData.map(async (project) => {
            // Nach dem Laden der Trades
const tradesRes = await fetch(apiUrl(`/api/projects/${project.id}/trades`));
const tradesData = tradesRes.ok ? await tradesRes.json() : [];

console.log('Alle Trades:', tradesData); // DEBUG

// Filtere INT-Trade raus
const relevantTrades = tradesData.filter(t => t.code !== 'INT');

console.log('Gefilterte Trades:', relevantTrades); // DEBUG

// Lade LVs
const lvRes = await fetch(apiUrl(`/api/projects/${project.id}/lv`));
const rawLvData = lvRes.ok ? await lvRes.json() : { lvs: [] };
const lvData = rawLvData.ok ? rawLvData : { lvs: rawLvData.lvs || [] };

// HIER DIE DEBUG-AUSGABEN EINFÜGEN:
console.log('LV Details für Projekt:', project.id, lvData.lvs);

// Zähle nur fertige LVs (ohne INT-Trade)
const completedLvs = (lvData.lvs || []).filter(lv => {
  // WICHTIG: trade_id in Number konvertieren!
  const trade = relevantTrades.find(t => t.id === parseInt(lv.trade_id));
  const hasContent = lv.content && lv.content.positions && lv.content.positions.length > 0;
  console.log('LV Trade:', lv.trade_id, 'Gefunden:', !!trade, 'Hat Inhalt:', hasContent);
  return trade && hasContent;
}).length;

console.log('Fertige LVs gezählt:', completedLvs);
            
            // Berechne Gesamtkosten
            // Berechne Netto-Summe
const nettoSum = (lvData.lvs || []).reduce((sum, lv) => {
  const trade = relevantTrades.find(t => t.id === parseInt(lv.trade_id));
  if (!trade) return sum;
  const lvSum = lv.content?.totalSum || 0;
  return sum + parseFloat(lvSum);
}, 0);

// Berechne Brutto-Summe (wie in ResultPage)
const contingency = nettoSum * 0.05;  // 5% Unvorhergesehenes
const subtotal = nettoSum + contingency;
const vat = subtotal * 0.19;  // 19% MwSt.
const totalCost = subtotal + vat;  // Brutto-Gesamtsumme

            console.log('🔴 TOTAL COST CALCULATED:', totalCost); // DEBUG
            console.log('🔴 Project ID:', project.id); // DEBUG
            
            // Lade Ausschreibungsstatus
            const tendersRes = await fetch(apiUrl(`/api/projects/${project.id}/tenders`));
            const tendersData = tendersRes.ok ? await tendersRes.json() : [];
            
            // Lade ungelesene Angebote
            const unreadRes = await fetch(apiUrl(`/api/projects/${project.id}/offers/unread-count`));
            const unreadData = unreadRes.ok ? await unreadRes.json() : { count: 0 };
            
            // Erstelle Trade-Details mit LV-Status
            const tradesWithLv = relevantTrades.map(trade => {
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
              totalTrades: relevantTrades.length, // Ohne INT-Trade
              totalCost: totalCost,
              tenders: tendersData,
              unreadOffers: unreadData.count,
              status: determineProjectStatus(
                project, 
                relevantTrades, 
                completedLvs,
                tendersData
              ),
            // NEU: lvStatus direkt hier berechnen
  lvStatus: {
    total: relevantTrades.length,
    completed: completedLvs,
    allCompleted: relevantTrades.length > 0 && relevantTrades.length === completedLvs
  }
};
          })
        );
        
        setProjects(projectsWithDetails);
        
        if (projectsWithDetails.length > 0 && pendingLvProjectId) {
          const pendingProject = projectsWithDetails.find(p => p.id === parseInt(pendingLvProjectId));
          if (pendingProject) {
            setSelectedProject(pendingProject);
            loadProjectDetails(pendingProject.id);
          }
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden der Projekte:', err);
    } finally {
      setLoading(false);
    }
  };

  // AKTUALISIERTE determineProjectStatus Funktion
  const determineProjectStatus = (project, tradesData, completedLvs, tendersData) => {
    const totalTrades = tradesData?.length || 0;
    
    if (totalTrades === 0) return 'Gewerke wählen';
    if (completedLvs === 0) return `0 von ${totalTrades} LVs erstellt`;
    if (completedLvs < totalTrades) return `${completedLvs} von ${totalTrades} LVs erstellt`;
    if (tendersData?.length > 0) return 'Ausschreibung läuft';
    if (project.ordersPlaced) return 'In Ausführung';
    return 'Bereit zur Ausschreibung';
  };

  const loadProjectDetails = async (projectId) => {
  try {
    const timestamp = new Date().getTime();
    setLoading(true);
    
    const tendersRes = await fetch(apiUrl(`/api/projects/${projectId}/tenders?t=${timestamp}`));
    if (tendersRes.ok) {
      const tendersData = await tendersRes.json();
      setTenders(tendersData || []);
    } else {
      setTenders([]);
    }
    
    const offersRes = await fetch(apiUrl(`/api/projects/${projectId}/offers/detailed?t=${timestamp}`));
    if (offersRes.ok) {
      const offersData = await offersRes.json();
      console.log('🔍 LOADED OFFERS:', offersData);
      setOffers(offersData || []);
    } else {
      setOffers([]);
    }
    
    // ═══ KRITISCHER FIX FÜR NaN ═══
    const ordersRes = await fetch(apiUrl(`/api/projects/${projectId}/orders?t=${timestamp}`));
if (ordersRes.ok) {
  const ordersData = await ordersRes.json();
  // Validiere und konvertiere amounts zu Numbers
  const validatedOrders = (ordersData || []).map(order => ({
    ...order,
    amount: parseFloat(order.amount) || 0
  }));
  setOrders(validatedOrders);
  console.log('✅ Validierte Orders geladen:', validatedOrders);
  
  // ✅ NEU: Lade Nachtrags-Daten für alle Aufträge
  if (validatedOrders.length > 0) {
    const orderIds = validatedOrders.map(o => o.id);
    await loadOrderTotalsAndNachtraege(orderIds);
  }
} else {
  setOrders([]);
}
    
    const supplementsRes = await fetch(apiUrl(`/api/projects/${projectId}/supplements?t=${timestamp}`));
    if (supplementsRes.ok) {
      const supplementsData = await supplementsRes.json();
      // Validiere auch Supplement amounts
      const validatedSupplements = (supplementsData || []).map(supp => ({
        ...supp,
        amount: parseFloat(supp.amount) || 0
      }));
      setSupplements(validatedSupplements);
    } else {
      setSupplements([]);
    }

    // Check ob Schedule existiert
const schedRes = await fetch(apiUrl(`/api/projects/${projectId}/schedule?t=${timestamp}`));
if (schedRes.ok) {
  const schedData = await schedRes.json();
  setSchedule(schedData);
} else {
  setSchedule(null);
}
    
    // Lade ungelesene Angebote
    const unreadRes = await fetch(apiUrl(`/api/projects/${projectId}/offers/unread-count?t=${timestamp}`));
    if (unreadRes.ok) {
      const unreadData = await unreadRes.json();
      setUnreadOffers(unreadData.count || 0);
    }
  } catch (err) {
    console.error('Fehler beim Laden der Projektdetails:', err);
    // Bei Fehler setze leere Arrays um NaN zu vermeiden
    setOrders([]);
    setSupplements([]);
    setOffers([]);
    setTenders([]);

    await loadScheduleBadgeCount(projectId);
    
  } finally {
    setLoading(false);
  }
};

const loadOrderTotalsAndNachtraege = async (orderIds) => {
  const totals = {};
  const pending = {};
  
  for (const orderId of orderIds) {
    try {
      // Lade Summen inkl. Nachträge
      const totalsRes = await fetch(apiUrl(`/api/orders/${orderId}/total-with-nachtraege`));
      if (totalsRes.ok) {
        const data = await totalsRes.json();
        totals[orderId] = data;
        pending[orderId] = data.pendingCount || 0;
      }
    } catch (error) {
      console.error(`Error loading data for order ${orderId}:`, error);
    }
  }
  
  setOrderTotals(totals);
  setPendingNachtraege(pending);
};
  
// Badge-Count für Terminplan laden
  const loadScheduleBadgeCount = async (projectId) => {
  try {
    const timestamp = Date.now();
    const res = await fetch(apiUrl(`/api/projects/${projectId}/schedule?t=${timestamp}`));
    if (res.ok) {
      const data = await res.json();
      setSchedule(data);
      
      const badgeRes = await fetch(apiUrl(`/api/projects/${projectId}/schedule/badge-count?t=${timestamp}`));
      if (badgeRes.ok) {
        const badgeData = await badgeRes.json();
        setScheduleBadgeCount(badgeData.total);
      }
    } else {
      setSchedule(null);
      setScheduleBadgeCount(0);
    }
  } catch (err) {
    console.error('Fehler:', err);
  }
};
  
// Lade letzte View-Timestamps aus SessionStorage
useEffect(() => {
  if (selectedProject) {
    const tabs = ['tenders', 'offers', 'contracts', 'orders'];
    const viewedTabs = {};
    
    tabs.forEach(tab => {
      const lastViewed = sessionStorage.getItem(`lastViewed_${selectedProject.id}_${tab}`);
      if (lastViewed) {
        viewedTabs[tab] = lastViewed;
      }
    });
    
    setLastViewedTabs(viewedTabs);
  }
}, [selectedProject]);

  useEffect(() => {
  if (!selectedProject) return;
  
  const activeEvaluations = Object.entries(generatingEvaluations)
    .filter(([_, isGenerating]) => isGenerating);
  
  const activeComparisons = Object.entries(generatingComparisons)
    .filter(([_, isGenerating]) => isGenerating);
  
  if (activeEvaluations.length === 0 && activeComparisons.length === 0) {
    console.log('⏸️ No active evaluations or comparisons');
    return;
  }
  
  console.log('▶️ Starting intervals for evaluations/comparisons');
  
  const evalIntervals = {};
  const evalPollIntervals = {};
  const compIntervals = {};
  const compPollIntervals = {};
  
  // ============================================================================
  // EVALUATIONEN
  // ============================================================================
  activeEvaluations.forEach(([evalKey, _]) => {
    const [tradeId, offerId] = evalKey.split('-').map(n => parseInt(n));
    
    const savedProgress = JSON.parse(
      sessionStorage.getItem('evaluationProgress') || '{}'
    );
    const startProgress = savedProgress[evalKey] || 0;
    
    console.log(`📊 Starting evaluation ${evalKey} from ${startProgress}%`);
    
    setEvaluationProgress(prev => ({ 
      ...prev, 
      [evalKey]: startProgress 
    }));
    
    // Progress Interval
    evalIntervals[evalKey] = setInterval(() => {
      setEvaluationProgress(prev => {
        const current = prev[evalKey] || 0;
        const next = current + (99/90);
        
        let newProgress;
        if (next >= 99) {
          clearInterval(evalIntervals[evalKey]);
          newProgress = { ...prev, [evalKey]: 99 };
        } else {
          newProgress = { ...prev, [evalKey]: next };
        }
        
        sessionStorage.setItem('evaluationProgress', JSON.stringify(newProgress));
        return newProgress;
      });
    }, 1000);
    
    // Polling Interval
    evalPollIntervals[evalKey] = setInterval(async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/projects/${selectedProject.id}/trades/${tradeId}/offers/${offerId}/evaluate`)
        );
        
        if (res.ok) {
          const data = await res.json();
          
          if (data && data.rating) {
            console.log(`✅ Evaluation ready for ${evalKey}`);
            
            clearInterval(evalIntervals[evalKey]);
            clearInterval(evalPollIntervals[evalKey]);
            
            setEvaluationProgress(prev => ({ ...prev, [evalKey]: 100 }));
            
            setTimeout(() => {
              // ✅ Speichere Ergebnis (öffne Modal NICHT automatisch!)
              const tender = selectedProject.tenders?.find(t => t.trade_id === tradeId);
              const offer = tender?.offers?.find(o => o.id === offerId);
              
              const result = {
                data: data,
                companyName: offer?.company_name
              };
              
              setEvaluationResults(prev => {
                const newResults = { ...prev, [evalKey]: result };
                sessionStorage.setItem('evaluationResults', JSON.stringify(newResults));
                return newResults;
              });
              
              cleanupEvaluationState(evalKey);
            }, 500);
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 5000);
  });
  
  // ============================================================================
  // COMPARISONS
  // ============================================================================
  activeComparisons.forEach(([compKey, _]) => {
    const tradeId = parseInt(compKey.replace('compare-', ''));
    
    const savedProgress = JSON.parse(
      sessionStorage.getItem('comparisonProgress') || '{}'
    );
    const startProgress = savedProgress[compKey] || 0;
    
    console.log(`📊 Starting comparison ${compKey} from ${startProgress}%`);
    
    setComparisonProgress(prev => ({ 
      ...prev, 
      [compKey]: startProgress 
    }));
    
    // Progress Interval
    compIntervals[compKey] = setInterval(() => {
      setComparisonProgress(prev => {
        const current = prev[compKey] || 0;
        const next = current + (99/90);
        
        let newProgress;
        if (next >= 99) {
          clearInterval(compIntervals[compKey]);
          newProgress = { ...prev, [compKey]: 99 };
        } else {
          newProgress = { ...prev, [compKey]: next };
        }
        
        sessionStorage.setItem('comparisonProgress', JSON.stringify(newProgress));
        return newProgress;
      });
    }, 1000);
    
    // Polling Interval
    compPollIntervals[compKey] = setInterval(async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/projects/${selectedProject.id}/trades/${tradeId}/offers/compare`)
        );
        
        if (res.ok) {
          const data = await res.json();
          
          if (data && data.summary) {
            console.log(`✅ Comparison ready for ${compKey}`);
            
            clearInterval(compIntervals[compKey]);
            clearInterval(compPollIntervals[compKey]);
            
            setComparisonProgress(prev => ({ ...prev, [compKey]: 100 }));
            
            setTimeout(() => {
              // ✅ Speichere Ergebnis
              const result = {
                data: data,
                companyName: null
              };
              
              setComparisonResults(prev => {
                const newResults = { ...prev, [compKey]: result };
                sessionStorage.setItem('comparisonResults', JSON.stringify(newResults));
                return newResults;
              });
              
              cleanupComparisonState(compKey);
            }, 500);
          }
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 5000);
  });
  
  // Cleanup beim Unmount
  return () => {
    console.log('🧹 Cleaning up evaluation/comparison intervals');
    Object.values(evalIntervals).forEach(interval => clearInterval(interval));
    Object.values(evalPollIntervals).forEach(interval => clearInterval(interval));
    Object.values(compIntervals).forEach(interval => clearInterval(interval));
    Object.values(compPollIntervals).forEach(interval => clearInterval(interval));
  };
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedProject?.id, generatingEvaluations, generatingComparisons]);
  
  // markAllAsRead VOR dem useEffect definieren mit useCallback
const markAllAsRead = useCallback(async () => {
  if (!selectedProject) return;
  await fetch(apiUrl(`/api/projects/${selectedProject.id}/offers/mark-all-read`), {
    method: 'POST'
  });
  setUnreadOffers(0);
  setHasMarkedAsRead(true);
}, [selectedProject]); // selectedProject als Dependency

// useEffect NACH der Funktionsdefinition
useEffect(() => {
  if (activeTab === 'offers' && unreadOffers > 0 && !hasMarkedAsRead) {
    markAllAsRead();
  }
}, [activeTab, unreadOffers, hasMarkedAsRead, markAllAsRead]); // markAllAsRead in Dependencies

  const deleteProject = async (projectId) => {
  const confirmText = prompt('Bitte geben Sie "LÖSCHEN" ein, um das Projekt unwiderruflich zu löschen:');
  if (confirmText !== 'LÖSCHEN') {
    alert('Löschvorgang abgebrochen');
    return;
  }
  
  try {
    setLoading(true);
    const res = await fetch(apiUrl(`/api/projects/${projectId}`), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      alert('Projekt erfolgreich gelöscht');
      setSelectedProject(null);
      loadUserProjects(userData.email);
    } else {
      throw new Error('Löschung fehlgeschlagen');
    }
  } catch (err) {
    console.error('Fehler beim Löschen:', err);
    alert('Fehler beim Löschen des Projekts');
  } finally {
    setLoading(false);
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

/// Erweiterte Modal-Komponente
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
            <li>✔ Kontaktdaten werden beiderseitig freigegeben</li>
            <li>✔ Sie können einen Ortstermin vereinbaren</li>
            <li>✔ Der Handwerker kann sein Angebot nach Besichtigung anpassen</li>
            <li>✔ Die 24-monatige Nachwirkfrist beginnt</li>
            <li>✔ Sie behalten faire Ausstiegsmöglichkeiten</li>
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

// ═══ NEU HINZUFÜGEN ═══
const handleRejectClick = (offer) => {
  setRejectingOffer(offer);
  setRejectModalOpen(true);
};

const handleRejectConfirm = async () => {
  try {
    await fetch(apiUrl(`/api/offers/${rejectingOffer.id}/reject`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: rejectReason,
        notes: rejectNotes,
        projectId: selectedProject.id
      })
    });
    
    // Angebote neu laden
    await loadUserProjects();
    
    // Modal schließen
    setRejectModalOpen(false);
    setRejectReason('');
    setRejectNotes('');
    setRejectingOffer(null);
    
    alert('Angebot wurde abgelehnt');
  } catch (error) {
    console.error('Fehler:', error);
    alert('Fehler beim Ablehnen');
  }
};

const handleEvaluateSingleOffer = async (offer, tradeName) => {
  const tender = selectedProject.tenders?.find(t => t.trade_name === tradeName || t.name === tradeName);
  if (!tender) {
    alert('Gewerk nicht gefunden');
    return;
  }
  
  const tradeId = tender.trade_id;
  const evalKey = `${tradeId}-${offer.id}`;
  
  try {
    setGeneratingEvaluations(prev => {
      const newState = { ...prev, [evalKey]: true };
      sessionStorage.setItem('generatingEvaluations', JSON.stringify(newState));
      return newState;
    });
    
    setEvaluationProgress(prev => ({ ...prev, [evalKey]: 0 }));
    
    const response = await fetch(
      apiUrl(`/api/projects/${selectedProject.id}/trades/${tender.trade_id}/offers/${offer.id}/evaluate`),
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!response.ok) {
      cleanupEvaluationState(evalKey);
      alert('❌ Fehler bei der Angebotsbewertung');
    }
  } catch (err) {
    console.error('Evaluation error:', err);
    cleanupEvaluationState(evalKey);
    alert('❌ Fehler: ' + err.message);
  }
};

const handleCompareOffers = async (tradeName) => {
  const tender = selectedProject.tenders?.find(t => t.trade_name === tradeName || t.name === tradeName);
  if (!tender) {
    alert('Gewerk nicht gefunden');
    return;
  }
  
  const tradeId = tender.trade_id;
  const compKey = `compare-${tradeId}`;
  
  try {
    setGeneratingComparisons(prev => {
      const newState = { ...prev, [compKey]: true };
      sessionStorage.setItem('generatingComparisons', JSON.stringify(newState));
      return newState;
    });
    
    setComparisonProgress(prev => ({ ...prev, [compKey]: 0 }));
    
    const response = await fetch(
      apiUrl(`/api/projects/${selectedProject.id}/trades/${tender.trade_id}/offers/compare`),
      { method: 'POST', headers: { 'Content-Type': 'application/json' } }
    );
    
    if (!response.ok) {
      cleanupComparisonState(compKey);
      alert('❌ Fehler beim Angebotsvergleich');
    }
  } catch (err) {
    console.error('Comparison error:', err);
    cleanupComparisonState(compKey);
    alert('❌ Fehler: ' + err.message);
  }
};
  
  // NEUE FUNKTION: Vorläufige Beauftragung bestätigen
  const confirmPreliminaryOrder = async () => {
  if (!selectedOffer) return;

  // ✅ DEBUG: Was wird gesendet?
  console.log('🔍 DEBUG preliminary-accept:', {
    offerId: selectedOffer.id,
    projectId: selectedProject?.id,
    selectedProject: selectedProject,
    selectedOffer: selectedOffer
  });
    
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
      // Modal schließen SOFORT
      setShowContractModal(false);
      setSelectedOffer(null);
      
      alert('Vorläufige Beauftragung erfolgreich! Die Kontaktdaten wurden freigegeben. Sie haben nun Zeit für eine Kennenlernphase.');
      
      // Daten neu laden
      await loadProjectDetails(selectedProject.id);
      await loadUserProjects(userData.email);
    } else {
      alert('Fehler bei der Beauftragung');
    }
  } catch (err) {
    console.error('Fehler bei vorläufiger Beauftragung:', err);
    alert('Fehler: ' + err.message);
  } finally {
    setLoading(false);
  }
};

  const ContractViewModal = ({ orderId, onClose }) => {
  const [contractData, setContractData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadContract = async () => {
      try {
        const res = await fetch(apiUrl(`/api/orders/${orderId}/contract-text`));
        if (res.ok) {
          const data = await res.json();
          setContractData(data);
        }
      } catch (err) {
        console.error('Error loading contract:', err);
      } finally {
        setLoading(false);
      }
    };
    loadContract();
  }, [orderId]);
  
  if (loading) return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-white">Lade Vertrag...</div>
    </div>
  );
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header - fixed height */}
        <div className="bg-gradient-to-r from-blue-600 to-teal-600 text-white p-6 flex justify-between items-center rounded-t-2xl">
          <h2 className="text-2xl font-bold">Werkvertrag</h2>
          <button 
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2"
          >
            ✕
          </button>
        </div>
        
        {/* Content - scrollable */}
        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
            {contractData?.contract_text}
          </pre>
        </div>
        
        {/* Footer - fixed height */}
        <div className="p-6 border-t flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
          <button
            onClick={() => window.open(apiUrl(`/api/orders/${orderId}/contract-pdf`), '_blank')}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Als PDF herunterladen
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
  
  // Verbindliche Beauftragung (Stufe 2) - MIT Werkvertrag
const handleFinalOrder = async (offer) => {
  console.log('🔴 handleFinalOrder CALLED with offer:', offer);
  
  // KRITISCH: Prüfe Ortstermin-Status
  try {
    const statusRes = await fetch(apiUrl(`/api/offers/${offer.id}/appointment-status`));
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      
      // BEDINGUNG: Handwerker MUSS entweder Termin bestätigt haben ODER explizit verzichtet haben
      const canProceed = statusData.appointment_confirmed || statusData.appointment_skipped;
      
      if (!canProceed) {
        // BLOCKIEREN: Keine Beauftragung möglich
        alert('❌ Beauftragung noch nicht möglich\n\nDer Handwerker hat sein Angebot noch nicht final bestätigt.\n\nBitte warten Sie auf:\n- Die Bestätigung nach dem Ortstermin, ODER\n- Die finale Angebotsabgabe ohne Ortstermin\n\nSie können den Handwerker auch direkt kontaktieren.');
        return;
      }
      
      // Falls es einen vorgeschlagenen aber NICHT bestätigten Termin gibt
      if (statusData.has_proposed && !statusData.appointment_confirmed) {
        alert('ℹ️ Hinweis: Es gibt einen vorgeschlagenen Ortstermin der noch nicht bestätigt wurde. Der Handwerker hat aber auf einen Ortstermin verzichtet, daher kann fortgefahren werden.');
      }
    }
  } catch (err) {
    console.error('Error checking appointment status:', err);
    alert('Fehler beim Prüfen des Ortstermin-Status. Bitte versuchen Sie es erneut.');
    return;
  }
  
  // Standard-Bestätigung
  if (!window.confirm('Möchten Sie diesen Handwerker verbindlich beauftragen? Es entsteht ein rechtsgültiger Werkvertrag nach VOB/B.')) {
    console.log('🔴 User cancelled');
    return;
  }

  try {
    setLoading(true);
    
    console.log('🔴 Fetching create-contract for offer ID:', offer.id);
    
    const res = await fetch(apiUrl(`/api/offers/${offer.id}/create-contract`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('🔴 Response received:', res.status, res.ok);

    if (res.ok) {
  const data = await res.json();
  console.log('🔴 Success data:', data);
  
  alert(`Verbindliche Beauftragung erfolgreich! Werkvertrag wurde erstellt (Auftrag #${data.orderId}).`);
  await loadProjectDetails(selectedProject.id);
  setActiveTab('orders');
    } else {
      const errorData = await res.json();
      console.error('🔴 Error response:', errorData);
      alert('Fehler: ' + errorData.error);
    }
  } catch (err) {
    console.error('🔴 Exception:', err);
    alert('Fehler beim Erstellen des Werkvertrags: ' + err.message);
  } finally {
    setLoading(false);
  }
};

 const calculateBudgetOverview = () => {
  if (!selectedProject) return null;
  
  const initialBudget = parseFloat(selectedProject.budget) || 0;
  const estimatedCost = parseFloat(selectedProject.totalCost) || 0;
  
  // ═══ FIX: Robuste Berechnung mit Array-Validierung ═══
  // Netto-Beträge
  const orderedAmountNetto = Array.isArray(orders) 
    ? orders.reduce((sum, order) => {
        const amount = parseFloat(order.amount) || 0;
        return sum + amount;
      }, 0)
    : 0;
  
  // ✅ NEU: Nachträge berechnen
  const nachtraegeNetto = Array.isArray(orders)
    ? orders.reduce((sum, o) => {
        const totals = orderTotals[o.id];
        return sum + (totals?.nachtraegeSum || 0);
      }, 0)
    : 0;
  
  const supplementsRequestedNetto = Array.isArray(supplements)
    ? supplements.reduce((sum, s) => {
        const amount = parseFloat(s.amount) || 0;
        return sum + amount;
      }, 0)
    : 0;
  
  const supplementsApprovedNetto = Array.isArray(supplements)
    ? supplements.filter(s => s.approved).reduce((sum, s) => {
        const amount = parseFloat(s.amount) || 0;
        return sum + amount;
      }, 0)
    : 0;
  
  // Brutto-Beträge (mit 19% MwSt) für Vergleich mit Budget und Kostenschätzung
  const orderedAmount = orderedAmountNetto * 1.19;
  const nachtraegeBrutto = nachtraegeNetto * 1.19;  // ✅ NEU
  const supplementsRequested = supplementsRequestedNetto * 1.19;
  const supplementsApproved = supplementsApprovedNetto * 1.19;
  
  const totalCurrent = orderedAmount + nachtraegeBrutto + supplementsApproved;  // ✅ + nachtraegeBrutto
  const variance = initialBudget > 0 
    ? ((totalCurrent - initialBudget) / initialBudget * 100) 
    : 0;
  
  console.log('📊 Budget Overview:', {
    initialBudget,
    estimatedCost,
    orderedAmount,
    orderedAmountNetto,
    nachtraegeNetto,        // ✅ NEU
    nachtraegeBrutto,       // ✅ NEU
    supplementsRequested,
    supplementsApproved,
    totalCurrent,
    variance
  });
  
  return {
    initialBudget,
    estimatedCost,
    orderedAmount,
    orderedAmountNetto,
    nachtraegeNetto,        // ✅ NEU
    nachtraegeBrutto,       // ✅ NEU
    supplementsRequested,
    supplementsApproved,
    totalCurrent,
    variance
  };
};
 
const BudgetVisualization = ({ budget }) => {
  if (!budget) return null;
  
  // Finde den maximalen Wert für die Skalierung
  const maxValue = Math.max(
    budget.initialBudget,
    budget.estimatedCost,
    budget.orderedAmount,
    1 // Mindestens 1 um Division durch 0 zu vermeiden
  );
  
  // Berechne die tatsächliche Breite basierend auf dem maximalen Wert
  const getBarWidth = (value) => {
    if (!value || value <= 0) return '0%';
    const percentage = (value / maxValue) * 100;
    return `${Math.min(percentage, 100)}%`;
  };
  
  // Berechne Prozent vom Budget
  const getPercentOfBudget = (value) => {
    if (!budget.initialBudget || budget.initialBudget <= 0) return 0;
    return Math.round((value / budget.initialBudget) * 100);
  };
  
  // Berechne Differenzen
  const estimatedDiff = budget.estimatedCost - budget.initialBudget;
  const orderedDiff = budget.orderedAmount - budget.initialBudget;
  
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 mb-6">
      <h3 className="text-2xl font-bold text-white mb-8">Visuelle Kostenübersicht</h3>
      
      <div className="space-y-8">
        {/* Anfangsbudget */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span className="text-white font-semibold">Anfangsbudget</span>
            </div>
            <div className="text-right">
              <div className="text-xl text-white font-bold">
                {formatCurrency(budget.initialBudget)}
              </div>
              <div className="text-sm text-gray-400">100% Basis</div>
            </div>
          </div>
          <div className="relative h-12 bg-white/10 rounded-lg overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center transition-all duration-700 ease-out"
              style={{ width: getBarWidth(budget.initialBudget) }}
            >
              <span className="text-white font-bold text-sm">
                {formatCurrency(budget.initialBudget)}
              </span>
            </div>
          </div>
        </div>
        
        {/* KI-Kostenschätzung */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-yellow-500"></div>
              <span className="text-white font-semibold">KI-Kostenschätzung</span>
            </div>
            <div className="text-right">
              <div className="text-xl text-yellow-400 font-bold">
                {formatCurrency(budget.estimatedCost)}
              </div>
              <div className={`text-sm font-medium ${
                estimatedDiff > 0 ? 'text-orange-400' : 'text-green-400'
              }`}>
                {estimatedDiff > 0 ? '+' : ''}{formatCurrency(estimatedDiff)} 
                ({getPercentOfBudget(budget.estimatedCost)}%)
              </div>
            </div>
          </div>
          <div className="relative h-12 bg-white/10 rounded-lg overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-500 to-orange-500 flex items-center justify-center transition-all duration-700 ease-out"
              style={{ width: getBarWidth(budget.estimatedCost) }}
            >
              <span className="text-white font-bold text-sm">
                {formatCurrency(budget.estimatedCost)}
              </span>
            </div>
            {/* Markierung für Budget-Grenze falls überschritten */}
            {budget.estimatedCost > budget.initialBudget && (
              <div 
                className="absolute inset-y-0 border-l-2 border-dashed border-blue-400"
                style={{ left: getBarWidth(budget.initialBudget) }}
                title="Budget-Grenze"
              >
                <div className="absolute -top-1 -left-2 w-4 h-4 bg-blue-400 rounded-full"></div>
              </div>
            )}
          </div>
        </div>
        
        {/* Beauftragte Summe + Nachträge (Ist-Kosten) */}
<div>
  {(() => {
    // ✅ GEÄNDERT: Verwende budget statt orders zu berechnen
    const nachtraegeBrutto = budget.nachtraegeBrutto || 0;
    const gesamtBrutto = budget.orderedAmount + nachtraegeBrutto;
    const gesamtDiff = gesamtBrutto - budget.initialBudget;
    
    return (
      <>
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded ${
              gesamtBrutto > budget.initialBudget ? 'bg-red-500' : 'bg-green-500'
            }`}></div>
            <span className="text-white font-semibold">Beauftragte Summe (Ist-Kosten)</span>
          </div>
          <div className="text-right">
            <div className={`text-xl font-bold ${
              gesamtBrutto > budget.initialBudget ? 'text-red-400' : 'text-green-400'
            }`}>
              {formatCurrency(gesamtBrutto)}
            </div>
            <div className={`text-sm font-medium ${
              gesamtDiff > 0 ? 'text-red-400' : 'text-green-400'
            }`}>
              {gesamtDiff > 0 ? '+' : ''}{formatCurrency(gesamtDiff)} 
              ({getPercentOfBudget(gesamtBrutto)}%)
            </div>
          </div>
        </div>
        
        {/* Gestapelter Balken */}
        <div className="relative h-12 bg-white/10 rounded-lg overflow-hidden mb-3">
          {/* Grüner Balken - Ursprungsaufträge */}
          <div 
            className="absolute inset-y-0 left-0 flex items-center justify-center transition-all duration-700 ease-out bg-gradient-to-r from-green-500 to-green-600"
            style={{ width: getBarWidth(budget.orderedAmount) }}
          >
            {budget.orderedAmount > budget.initialBudget * 0.1 && (
              <span className="text-white font-bold text-sm">
                {formatCurrency(budget.orderedAmount)}
              </span>
            )}
          </div>
          
          {/* Türkiser Balken - Nachträge */}
          {nachtraegeBrutto > 0 && (
            <div 
              className="absolute inset-y-0 flex items-center justify-center transition-all duration-700 ease-out bg-gradient-to-r from-teal-500 to-cyan-600"
              style={{ 
                left: getBarWidth(budget.orderedAmount),
                width: getBarWidth(nachtraegeBrutto)
              }}
            >
              {nachtraegeBrutto > budget.initialBudget * 0.05 && (
                <span className="text-white font-bold text-sm">
                  {formatCurrency(nachtraegeBrutto)}
                </span>
              )}
            </div>
          )}
          
          {/* Markierung für Budget-Grenze */}
          <div 
            className="absolute inset-y-0 border-l-2 border-dashed border-blue-400"
            style={{ left: getBarWidth(budget.initialBudget) }}
            title="Budget-Grenze"
          >
            <div className="absolute -top-1 -left-2 w-4 h-4 bg-blue-400 rounded-full"></div>
            <div className="absolute top-14 -left-16 text-xs text-blue-400 whitespace-nowrap">
              Budget-Grenze
            </div>
          </div>
        </div>
        
        {/* Legende unter dem Balken */}
        <div className="flex gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-gray-400">Aufträge: {formatCurrency(budget.orderedAmount)}</span>
          </div>
          {nachtraegeBrutto > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-teal-500"></div>
              <span className="text-gray-400">Nachträge: {formatCurrency(nachtraegeBrutto)}</span>
            </div>
          )}
        </div>
      </>
    );
  })()}
</div>
      
      {/* Vergleichs-Übersicht */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        {/* Vergleich: KI-Schätzung vs Budget */}
        {budget.estimatedCost !== budget.initialBudget && (
          <div className={`p-4 rounded-lg border ${
            budget.estimatedCost > budget.initialBudget
              ? 'bg-orange-500/10 border-orange-500/30'
              : 'bg-blue-500/10 border-blue-500/30'
          }`}>
            <div className="text-sm text-gray-300 mb-1">KI-Schätzung vs Budget</div>
            <div className={`text-lg font-bold ${
              budget.estimatedCost > budget.initialBudget ? 'text-orange-400' : 'text-blue-400'
            }`}>
              {estimatedDiff > 0 ? '+' : ''}{formatCurrency(estimatedDiff)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {budget.estimatedCost > budget.initialBudget 
                ? `${Math.round((estimatedDiff / budget.initialBudget) * 100)}% über Budget`
                : `${Math.round(Math.abs(estimatedDiff / budget.initialBudget) * 100)}% unter Budget`
              }
            </div>
          </div>
        )}
        
        {/* Vergleich: Ist-Kosten vs Budget */}
        {budget.orderedAmount > 0 && (
          <div className={`p-4 rounded-lg border ${
            budget.orderedAmount > budget.initialBudget
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-green-500/10 border-green-500/30'
          }`}>
            <div className="text-sm text-gray-300 mb-1">Ist-Kosten vs Budget</div>
            <div className={`text-lg font-bold ${
              budget.orderedAmount > budget.initialBudget ? 'text-red-400' : 'text-green-400'
            }`}>
              {orderedDiff > 0 ? '+' : ''}{formatCurrency(orderedDiff)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {budget.orderedAmount > budget.initialBudget 
                ? `${Math.round((orderedDiff / budget.initialBudget) * 100)}% Überschreitung`
                : `${Math.round(Math.abs(orderedDiff / budget.initialBudget) * 100)}% Ersparnis`
              }
            </div>
          </div>
        )}
      </div>
      
      {/* Status-Warnungen */}
      <div className="mt-6 space-y-3">
        {budget.orderedAmount > budget.initialBudget && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-red-400 text-2xl">⚠️</span>
              <div className="flex-1">
                <h4 className="text-red-300 font-semibold mb-1">Budget überschritten!</h4>
                <p className="text-red-200 text-sm">
                  Die beauftragten Arbeiten übersteigen Ihr Budget um{' '}
                  <strong>{formatCurrency(orderedDiff)}</strong>{' '}
                  ({Math.round((orderedDiff / budget.initialBudget) * 100)}%).
                  Bitte überprüfen Sie Ihre Finanzierung.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {budget.orderedAmount > 0 && budget.orderedAmount < budget.estimatedCost * 0.95 && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-2xl">✅</span>
              <div className="flex-1">
                <h4 className="text-green-300 font-semibold mb-1">Gute Einsparung!</h4>
                <p className="text-green-200 text-sm">
                  Sie sparen <strong>{formatCurrency(budget.estimatedCost - budget.orderedAmount)}</strong>{' '}
                  gegenüber der KI-Kostenschätzung.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {budget.orderedAmount === 0 && budget.estimatedCost > budget.initialBudget && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-yellow-400 text-2xl">💡</span>
              <div className="flex-1">
                <h4 className="text-yellow-300 font-semibold mb-1">Hinweis zur Budgetplanung</h4>
                <p className="text-yellow-200 text-sm">
                  Die KI-Schätzung liegt <strong>{formatCurrency(estimatedDiff)}</strong>{' '}
                  über Ihrem Budget. Planen Sie eine entsprechende Finanzierungsreserve ein.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// NEUE LV-Edit Button Komponente
function LVEditButton = ({ project }) => {
  const allLVsComplete = project.completedLvs === project.totalTrades && project.totalTrades > 0;
  
  if (allLVsComplete) {
    return (
      <button
        className="bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl p-6 opacity-75 cursor-not-allowed"
        disabled
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold mb-2">✔ Alle LVs fertiggestellt</h3>
            <p className="text-sm opacity-90">
              Bearbeitung nur noch über Kostenübersicht möglich
            </p>
          </div>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </button>
    );
  }
      
    return (
      <button
        onClick={() => navigate(`/project/${project.id}/lv-review`)}
        className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl p-6 hover:shadow-xl transform hover:scale-[1.02] transition-all"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold mb-2">📝 LVs bearbeiten</h3>
            <p className="text-sm opacity-90">
              {project.completedLvs === 0 
                ? 'Jetzt mit der LV-Erstellung beginnen'
                : `${project.totalTrades - project.completedLvs} LVs noch offen`
              }
            </p>
          </div>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    );
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
            {step.done ? '✔' : step.step}
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
      <div className="mt-6 bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4">
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
        {/* ═══ HIER DAS NOTIFICATION CENTER EINFÜGEN ═══ */}
        <NotificationCenter 
  userType="bauherr"
  userId={userData?.id}
  apiUrl={apiUrl}
  onTabChange={(tab) => {
    setActiveTab(tab);
    if (selectedProject) {
      loadProjectDetails(selectedProject.id);
    }
  }}
  onScheduleReload={() => {
    setScheduleReloadTrigger(prev => prev + 1);
  }}
  onMessageCenterOpen={() => {  
    messageCenterRef.current?.setIsOpen(true);
  }}
/>
<MessageCenter
  ref={messageCenterRef}
  userType="bauherr"
  userId={userData?.id}
  userName={userData?.name}
  apiUrl={apiUrl}
/>     
        <Link 
          to="/bauherr/settings"
          className="text-gray-300 hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
          </svg>
          {userData?.name || userData?.email}
        </Link>
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
          const progress = ((project.completedLvs || 0) / (project.totalTrades || 1)) * 100;
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
              
              {/* Unread Offers Badge */}
              {project.unreadOffers > 0 && (
                <div className="absolute -top-2 -left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {project.unreadOffers}
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
  {truncateWords(project.description || project.sub_category, 10)}
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
                    <span>{project.completedLvs || 0} / {project.totalTrades || 0}</span>
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
                      {project.totalTrades || 0}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
  <p className="text-xs text-gray-400 mb-1">Geschätzt</p>
  <p className="text-lg font-semibold text-teal-400">
    {formatCurrency(project.totalCost)}
  </p>
  <p className="text-xs text-gray-300">inkl. MwSt</p>
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
            setHasMarkedAsRead(false);
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
        {selectedProject.category}
      </h1>
      <p className="text-lg text-gray-300 mb-3">
        {truncateWords(selectedProject.description || selectedProject.sub_category, 10)}
      </p>
      <p className="text-gray-400">
        Status: {selectedProject.status} | 
        Erstellt: {new Date(selectedProject.created_at).toLocaleDateString('de-DE')}
      </p>
    </div>
    <div className="text-right">
  <p className="text-sm text-gray-400">Geschätzte Kosten</p>
  <p className="text-2xl font-bold text-teal-400">{formatCurrency(selectedProject.totalCost)}</p>
  <p className="text-sm text-gray-300">inkl. MwSt</p>
</div>
  </div>
</div>

      {/* Terminplan-Empfehlung */}
{selectedProject.trades?.filter(t => t.code !== 'INT').length >= 2 && 
 activeTab !== 'schedule' && 
 !schedule && 
 selectedProject.lvStatus?.allCompleted && (
   <div className="mb-6 bg-gradient-to-r from-teal-600/20 to-blue-600/20 backdrop-blur-md rounded-xl p-6 border border-teal-500/30">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-teal-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
            📅
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-1">
              Ihr Projekt besteht aus mehreren Gewerken
            </h3>
            <p className="text-gray-300 text-sm">
              Wir empfehlen einen professionellen Terminplan durch unsere KI erstellen zu lassen
            </p>
          </div>
        </div>
        <button
          onClick={() => {
    setActiveTab('schedule');
    if (selectedProject) {
      loadProjectDetails(selectedProject.id);  
    }
  }}
          className="px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white font-bold rounded-lg hover:shadow-xl transform hover:scale-105 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          📅 Zur KI-Terminplanung
        </button>
      </div>
    </div>
)}
      
      {/* Project Wizard */}
      <ProjectWizard project={selectedProject} />
      
        {/* Tabs */}
<div className="flex gap-2 mb-8 border-b border-white/20 overflow-x-auto relative pt-2">
  {['overview', 'tenders', 'offers', 'contracts', 'orders', 'budget', 'schedule'].map((tab) => {
    // Berechne neue Items pro Tab
    let newCount = 0;
    
    if (tab === 'tenders' && selectedProject?.tenders) {
  const lastViewed = lastViewedTabs.tenders;
  newCount = selectedProject.tenders.filter(t => 
    (t.status === 'active' || t.status === 'pending') &&
    (!lastViewed || new Date(t.created_at) > new Date(lastViewed))
  ).length;
}
    
    if (tab === 'offers') {
      newCount = unreadOffers; // Bereits vorhanden
    }
    
    if (tab === 'contracts') {
  const lastViewed = lastViewedTabs.contracts;
  newCount = offers.filter(o => 
    (o.status === 'preliminary' || o.status === 'confirmed') && 
    (!lastViewed || new Date(o.updated_at || o.preliminary_accepted_at || o.created_at) > new Date(lastViewed))
  ).length;
}
    
    if (tab === 'orders') {
  const lastViewed = lastViewedTabs.orders;
  newCount = orders.filter(order => 
    (order.status === 'active' || order.status === 'accepted') &&
    (!lastViewed || new Date(order.updated_at || order.created_at) > new Date(lastViewed))
  ).length;
}

    if (tab === 'schedule') {
      newCount = scheduleBadgeCount;
    }
  
    return (
      <button
        key={tab}
        onClick={() => {
          setActiveTab(tab);
           if (selectedProject) {
            loadProjectDetails(selectedProject.id);
          }
          
          // Markiere als gelesen
          if (['tenders', 'offers', 'contracts', 'orders'].includes(tab)) {
            const now = new Date().toISOString();
            
            // SPECIAL FIX FÜR ORDERS: Beim ersten Mal setze auf neuesten Order, nicht auf jetzt
            if (tab === 'orders' && !lastViewedTabs.orders && orders.length > 0) {
              // Finde neuesten Order
              const newestOrderDate = orders.reduce((latest, order) => {
                const orderDate = new Date(order.updated_at || order.created_at);
                return orderDate > new Date(latest) ? orderDate.toISOString() : latest;
              }, orders[0].updated_at || orders[0].created_at);
              
              setLastViewedTabs(prev => ({
                ...prev,
                [tab]: newestOrderDate
              }));
              sessionStorage.setItem(`lastViewed_${selectedProject?.id}_${tab}`, newestOrderDate);
            } else {
              // Normales Verhalten für andere Tabs
              setLastViewedTabs(prev => ({
                ...prev,
                [tab]: now
              }));
              sessionStorage.setItem(`lastViewed_${selectedProject?.id}_${tab}`, now);
            }
          }
        }}
        className={`px-4 py-2 pt-3 text-sm font-medium transition-colors whitespace-nowrap relative ${
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
        
        {/* Badge nur wenn neue Items vorhanden */}
        {newCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold z-50">
            {newCount}
          </span>
        )}
      </button>
    );
  })}
</div>

        {/* Content */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          {/* Übersicht Tab - AKTUALISIERT mit LVEditButton */}
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
          <span>{selectedProject.completedLvs || 0} von {selectedProject.totalTrades || 0} LVs erstellt</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-teal-500 to-blue-600 h-3 rounded-full transition-all"
            style={{ 
              width: `${((selectedProject.completedLvs || 0) / (selectedProject.totalTrades || 1)) * 100}%` 
            }}
          />
        </div>
      </div>
      
      {/* Status Steps */}
      <div className="grid grid-cols-4 gap-2 mt-6">
        <div className={`text-center p-3 rounded-lg ${
          selectedProject.trades?.length > 0 ? 'bg-green-500/20 border-green-500' : 'bg-white/10'
        } border`}>
          <div className="text-2xl mb-1">✔</div>
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
          <div className="text-2xl mb-1">{orders.length > 0 ? '✔' : '○'}</div>
          <div className="text-xs text-gray-300">Aufträge</div>
        </div>
      </div>
    </div>
    
    {/* Action Buttons - MIT AKTUALISIERTEM LVEditButton */}
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      {/* LV-Bearbeitung Button - ERSETZT */}
      <LVEditButton project={selectedProject} />
      
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
            <h3 className="text-lg font-bold mb-2">💰 Kostenübersicht und Ausschreibung</h3>
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
          {selectedProject.totalTrades || 0}
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
    {selectedProject.completedLvs === selectedProject.totalTrades && 
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
  onClick={async () => {
    if (!window.confirm('Möchten Sie alle Gewerke an passende Handwerker ausschreiben?')) return;
    
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/projects/${selectedProject.id}/tender/create`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeIds: 'all',
          timeframe: selectedProject.timeframe || 'Nach Absprache'
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`✅ Erfolgreich! ${data.message}\n\nDie Handwerker wurden benachrichtigt und können nun Angebote abgeben.`);
        
        // Reload Projects to update status
        await loadUserProjects(userData.email);
        await loadProjectDetails(selectedProject.id);
      } else {
        throw new Error('Fehler beim Erstellen der Ausschreibung');
      }
    } catch (error) {
      alert('Fehler: ' + error.message);
    } finally {
      setLoading(false);
    }
  }}
  className="px-8 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
>
  🚀 Alle Gewerke jetzt an geeignete Handwerker ausschreiben
</button>
      </div>
    )}
  </div>
)}

         {/* VERBESSERTER Ausschreibungen Tab - ERSETZE Zeilen 1398-1479 */}
{activeTab === 'tenders' && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Laufende Ausschreibungen</h2>
    
    {selectedProject?.tenders?.filter(t => 
  t.status !== 'awarded' && 
  t.status !== 'cancelled' &&
  !t.has_accepted_offer
).length === 0 ? (
      <div className="bg-white/10 backdrop-blur rounded-lg p-8 border border-white/20 text-center">
        <p className="text-gray-400 mb-4">Noch keine Ausschreibungen gestartet.</p>
        {selectedProject.completedLvs > 0 && (
          <button
            onClick={() => handleStartTender('all')}
            className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            Jetzt ausschreiben
          </button>
        )}
      </div>
    ) : (
      <div className="space-y-6">
        {selectedProject?.tenders?.filter(tender => 
  tender.status !== 'awarded' && 
  tender.status !== 'cancelled' &&
  !tender.has_accepted_offer
).map((tender) => {
          // Verwende Deadline aus DB (falls vorhanden), sonst berechne
const deadlineDate = tender.deadline 
  ? new Date(tender.deadline)
  : (() => {
      const createdDate = new Date(tender.created_at);
      const calculated = new Date(createdDate);
      let workdaysAdded = 0;
      
      while (workdaysAdded < 10) {
        calculated.setDate(calculated.getDate() + 1);
        const dayOfWeek = calculated.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) workdaysAdded++;
      }
      return calculated;
    })();
          
          const isExpired = new Date() > deadlineDate;
          const daysRemaining = Math.ceil((deadlineDate - new Date()) / (1000 * 60 * 60 * 24));
          
          return (
            <div key={tender.id} className="bg-white/5 rounded-lg p-6 border border-white/10">
              {/* Header mit Status */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-white">{tender.trade_name}</h3>
                    {isExpired ? (
                      <span className="px-3 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">
                        Frist abgelaufen
                      </span>
                    ) : daysRemaining <= 3 ? (
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-xs rounded-full animate-pulse">
                        Läuft bald ab
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                        Aktiv
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    Ausgeschrieben am {new Date(tender.created_at).toLocaleDateString('de-DE', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="text-sm text-gray-400 mb-1">Geschätzte Kosten</p>
                  <p className="text-2xl font-bold text-teal-400">
                    {formatCurrency(tender.estimated_value)}
                  </p>
                </div>
              </div>
              
              {/* Projektdetails */}
              <div className="grid md:grid-cols-3 gap-4 mb-4 p-4 bg-white/5 rounded-lg">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Angebotsfrist</p>
                  <p className="text-white font-semibold">
                    {deadlineDate.toLocaleDateString('de-DE', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric' 
                    })}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isExpired ? 'Abgelaufen' : `Noch ${daysRemaining} Tag${daysRemaining !== 1 ? 'e' : ''}`}
                  </p>
                </div>
                
                <div>
                  <p className="text-xs text-gray-400 mb-1">Projektadresse</p>
                  <p className="text-white text-sm">
                    {selectedProject.street || 'N/A'}
                  </p>
                  <p className="text-white text-sm">
                    {selectedProject.zip} {selectedProject.city}
                  </p>
                </div>
                
                <div>
                  <p className="text-xs text-gray-400 mb-1">Eingereichte Angebote</p>
                  <p className="text-white font-semibold text-2xl">
                    {tender.handwerkers?.filter(hw => hw.offer_id).length || 0}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    von {tender.handwerkers?.length || 0} angeschrieben
                  </p>
                </div>
              </div>
              
              {/* Aktionsbuttons */}
              <div className="flex flex-wrap gap-3 mb-4">
                <button
                  onClick={() => navigate(`/project/${selectedProject.id}/tender/${tender.id}/lv-preview`)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  LV-Details ansehen
                </button>
                
                <button
                  onClick={() => {
                    setActiveTab('offers');
if (selectedProject) {
  loadProjectDetails(selectedProject.id);
}
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Angebote prüfen
                </button>

                <button
                  onClick={() => {
                    setSelectedTenderForExtension(tender);
                    setShowExtensionModal(true);
                  }}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Frist verlängern
                </button>
                
                <button
                  onClick={async () => {
                    if (!window.confirm(`Möchten Sie diese Ausschreibung wirklich zurückziehen?\n\nGewerk: ${tender.trade_name}\n\nDie Ausschreibung wird für alle ${tender.handwerkers?.length || 0} Handwerker beendet und kann nicht wiederhergestellt werden.`)) {
                      return;
                    }
                    
                    try {
                      setLoading(true);
                      const res = await fetch(apiUrl(`/api/tenders/${tender.id}/cancel`), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          projectId: selectedProject.id,
                          reason: 'Vom Bauherrn zurückgezogen'
                        })
                      });
                      
                      if (res.ok) {
                        alert('✅ Ausschreibung wurde erfolgreich zurückgezogen.');
                        loadProjectDetails(selectedProject.id);
                        loadUserProjects(userData.email);
                      } else {
                        const error = await res.json();
                        alert('❌ Fehler: ' + (error.error || 'Unbekannter Fehler'));
                      }
                    } catch (err) {
                      console.error('Error cancelling tender:', err);
                      alert('❌ Fehler beim Zurückziehen der Ausschreibung');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors text-sm flex items-center gap-2"
                  disabled={loading}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  {loading ? 'Wird zurückgezogen...' : 'Ausschreibung zurückziehen'}
                </button>
              </div>
              
              {/* Handwerker-Liste */}
              <div className="border-t border-white/10 pt-4">
                <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Angeschriebene Handwerker ({tender.handwerkers?.length || 0})
                </h4>
                
                <div className="space-y-2">
                  {tender.handwerkers?.map((hw, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                          {hw.company_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <span className="text-white font-medium block">{hw.company_name}</span>
                          <span className="text-xs text-gray-400">{hw.email}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {hw.offer_id && (
                          <span className="text-xs bg-green-600 text-green-200 px-3 py-1 rounded-full font-semibold">
                            ✔ Angebot abgegeben
                          </span>
                        )}
                        {!hw.offer_id && hw.status === 'in_progress' && (
                          <span className="text-xs bg-yellow-600 text-yellow-200 px-3 py-1 rounded-full">
                            In Bearbeitung
                          </span>
                        )}
                        {!hw.offer_id && hw.status === 'viewed' && (
                          <span className="text-xs bg-blue-600 text-blue-200 px-3 py-1 rounded-full">
                            Angesehen
                          </span>
                        )}
                        {!hw.offer_id && hw.status === 'sent' && (
                          <span className="text-xs bg-gray-600 text-gray-200 px-3 py-1 rounded-full">
                            Versendet
                          </span>
                        )}
                        
                        {hw.viewed_at && (
                          <span className="text-xs text-gray-400 ml-2">
                            📅 {new Date(hw.viewed_at).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Hinweis bei abgelaufener Frist */}
              {isExpired && (
                <div className="mt-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <p className="text-orange-300 text-sm">
                    <strong>⚠️ Hinweis:</strong> Die Angebotsfrist ist abgelaufen. Sie können die Ausschreibung verlängern oder mit den vorliegenden Angeboten fortfahren.
                  </p>
                </div>
              )}
            </div>
          );
        })}
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
      {offers.filter(o => 
        o.status === 'submitted' && 
        o.status !== 'preliminary' && 
        o.status !== 'confirmed' && 
        o.status !== 'accepted' &&
        o.status !== 'rejected'
      ).length}
    </p>
  </div>
  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
    <p className="text-gray-400 text-sm">In Prüfung</p>
    <p className="text-2xl font-bold text-yellow-400">
      {offers.filter(o => 
        o.status === 'submitted' && 
        o.viewed &&
        o.status !== 'preliminary' && 
        o.status !== 'confirmed' && 
        o.status !== 'accepted' &&
        o.status !== 'rejected' &&
        o.status !== 'not_selected'
      ).length}
    </p>
  </div>
  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
    <p className="text-gray-400 text-sm">Vertragsanbahnung</p>
    <p className="text-2xl font-bold text-blue-400">
      {offers.filter(o => 
        o.status === 'preliminary' || o.status === 'confirmed'
      ).length}
    </p>
  </div>
  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
    <p className="text-gray-400 text-sm">Beauftragt</p>
    <p className="text-2xl font-bold text-green-400">
      {offers.filter(o => o.status === 'accepted').length}
    </p>
  </div>
</div>
    
{/* Filtere vorläufig beauftragte Angebote raus */}
{(() => {
  const filteredOffers = offers.filter(o => 
  o.status !== 'preliminary' && 
  o.status !== 'confirmed' && 
  o.status !== 'accepted' &&
  o.status !== 'rejected'  
);
  
  return (
    <>
      <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-300 text-sm">
          <strong>ℹ️ Zweistufige Vergabe:</strong> Wählen Sie zunächst "Vorläufig beauftragen" für eine Kennenlernphase. 
          Nach erfolgreicher Prüfung und Angebotsbestätigung durch den Bieter können Sie verbindlich beauftragen.
        </p>
      </div>
      
      {filteredOffers.length === 0 ? (
        <div className="bg-white/10 backdrop-blur rounded-lg p-8 border border-white/20 text-center">
          <p className="text-gray-400 mb-4">Noch keine Angebote eingegangen.</p>
          <button
            onClick={() => {
  setActiveTab('overview');
  if (selectedProject) {
    loadProjectDetails(selectedProject.id);
  }
}}
            className="px-6 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          >
            Zur Übersicht
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Gruppierung nach Gewerk */}
          {Object.entries(
            filteredOffers.reduce((grouped, offer) => {
              const key = offer.tradeName || offer.trade_name || 'Unbekannt';
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(offer);
              return grouped;
            }, {})
          ).map(([tradeName, tradeOffers]) => (
            <div key={tradeName} className="bg-white/5 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                  <span>{tradeName}</span>
                  <span className="text-sm text-gray-400">{tradeOffers.length} Angebot(e)</span>
                </h3>
                
                 {/* ✅ Button HIER, im flex container! */}
    {(() => {
      const tender = selectedProject.tenders?.find(t => t.trade_name === tradeName);
      const tradeId = tender?.trade_id;
      const isSingle = tradeOffers.length === 1;
      
      const evalKey = isSingle ? `${tradeId}-${tradeOffers[0].id}` : null;
      const compKey = !isSingle ? `compare-${tradeId}` : null;
      
      const isGenerating = isSingle 
        ? generatingEvaluations[evalKey]
        : generatingComparisons[compKey];
      const progress = isSingle
        ? evaluationProgress[evalKey]
        : comparisonProgress[compKey];
      const hasResult = isSingle
        ? evaluationResults[evalKey]
        : comparisonResults[compKey];
      
      return (
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => {
              if (hasResult) {
                setEvaluationModal({
                  isOpen: true,
                  type: isSingle ? 'single' : 'comparison',
                  data: hasResult.data,
                  companyName: hasResult.companyName
                });
              } else {
                if (isSingle) {
                  handleEvaluateSingleOffer(tradeOffers[0], tradeName);
                } else {
                  handleCompareOffers(tradeName);
                }
              }
            }}
            disabled={isGenerating}
            className={`px-4 py-2 rounded-lg transition-all ${
              isGenerating
                ? 'bg-gray-600 cursor-not-allowed'
                : hasResult
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white font-medium text-sm`}
          >
            {isGenerating ? (
              <div className="flex items-center gap-2">
                <span>⏳ Analysiere...</span>
                {progress !== undefined && (
                  <span className="font-semibold">{Math.round(progress)}%</span>
                )}
              </div>
            ) : hasResult ? (
              <span>✅ Ergebnis anzeigen</span>
            ) : (
              <span>{isSingle ? '🔍 byndl-Angebotsbewertung' : '⚖️ byndl-Vergabeempfehlung'}</span>
            )}
          </button>
          
          {/* Progress Bar */}
          {isGenerating && progress !== undefined && (
            <div className="w-48 bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      );
    })()}
  </div>
              
              <div className="space-y-3">
                {tradeOffers.map((offer, idx) => (
                  <React.Fragment key={idx}>
                    <div className="bg-white/10 rounded-lg p-4 border border-white/20">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-white">
                              {offer.companyName || offer.company_name}
                            </h4>
                            {!offer.viewed && (
                              <span className="bg-teal-500 text-white text-xs px-2 py-1 rounded">NEU</span>
                            )}
                            {offer.is_bundle_offer && offer.bundle_discount > 0 && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      setSelectedBundleOffer(offer);
      setBundleModalOpen(true);
    }}
    className="bg-gradient-to-r from-green-500 to-teal-500 text-white text-xs px-3 py-1 rounded-full font-semibold shadow-lg hover:from-green-600 hover:to-teal-600 transition-all flex items-center gap-1"
  >
    📦 Bündelangebot: {offer.bundle_discount}% Rabatt - Was heißt das?
  </button>
)}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                            <div>
                              <p>📅 Eingegangen: {new Date(offer.created_at || offer.date).toLocaleDateString('de-DE')}</p>
                              <p>⏱️ Ausführung: {
                                offer.execution_start && offer.execution_end 
                                  ? `${new Date(offer.execution_start).toLocaleDateString('de-DE')} - ${new Date(offer.execution_end).toLocaleDateString('de-DE')}`
                                  : offer.executionTime || 'Nach Absprache'
                              }</p>
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
  {(() => {
    // Berechne Rabatt innerhalb einer IIFE
    const bundleDiscount = offer.bundle_discount || 0;
    const discountAmount = bundleDiscount > 0 ? (offer.amount * bundleDiscount / 100) : 0;
    const nettoAfterDiscount = offer.amount - discountAmount;
    const bruttoAmount = nettoAfterDiscount * 1.19;
    
    return (
      <div className="space-y-2">
        <div>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(offer.amount)}
          </p>
          <p className="text-xs text-gray-400">Netto</p>
        </div>
        
        {bundleDiscount > 0 && (
          <div className="text-sm">
            <p className="text-green-400 font-semibold">
              📦 -{bundleDiscount}% Rabatt
            </p>
            <p className="text-green-300">
              {formatCurrency(nettoAfterDiscount)}
            </p>
            <p className="text-xs text-gray-400">Netto nach Rabatt</p>
          </div>
        )}
        
        <div className="pt-2 border-t border-white/20">
          <p className="text-lg font-bold text-teal-400">
            {formatCurrency(bruttoAmount)}
          </p>
          <p className="text-xs text-gray-400">Brutto</p>
        </div>
      </div>
    );
  })()}
                          
                          {/* Status-basierte Aktionen */}
                          {offer.status === 'submitted' && (
                            <div className="space-y-2">
                              <button
                                onClick={async () => {
                                  await fetch(apiUrl(`/api/offers/${offer.id}/mark-viewed`), {
                                    method: 'POST'
                                  });
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
                                onClick={() => handleRejectClick(offer)}
                                className="w-full px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                              >
                                Ablehnen
                              </button>
                            </div>
                          )}
                          
                          {(offer.status === 'preliminary' || offer.status === 'confirmed') && 
                           (offer.appointment_confirmed || offer.appointment_skipped) && 
                           offer.offer_confirmed_at && (
                            <div className="space-y-2">
                              <span className="block text-xs bg-blue-600 text-blue-200 px-2 py-1 rounded">
                                In Vertragsanbahnung
                              </span>
                              <button 
                                onClick={() => handleFinalOrder(offer)}
                                className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                              >
                                Jetzt verbindlich beauftragen
                              </button>
                            </div>
                          )}

                          {(offer.status === 'preliminary' || offer.status === 'confirmed') && 
                           !(offer.appointment_confirmed || offer.appointment_skipped) && (
                            <div className="space-y-2">
                              <span className="block text-xs bg-yellow-600 text-yellow-200 px-2 py-1 rounded">
                                ⏳ Warte auf Ortstermin-Bestätigung oder Verzicht durch Handwerker
                              </span>
                            </div>
                          )}

                          {(offer.status === 'preliminary' || offer.status === 'confirmed') && 
                           (offer.appointment_confirmed || offer.appointment_skipped) && 
                           !offer.offer_confirmed_at && (
                            <div className="space-y-2">
                              <span className="block text-xs bg-yellow-600 text-yellow-200 px-2 py-1 rounded">
                                ⏳ Warte auf finale Angebotsbestätigung durch Handwerker
                              </span>
                            </div>
                          )}
                          
                          {offer.status === 'accepted' && (
                            <span className="block text-xs bg-green-600 text-green-200 px-2 py-1 rounded">
                              ✔ Beauftragt
                            </span>
                          )}
                          
                          {offer.status === 'rejected' && (
                            <span className="block text-xs bg-red-600 text-red-200 px-2 py-1 rounded">
                              Abgelehnt
                            </span>
                          )}
                        </div>
                      </div>         
                    </div>   
                    
                     {/* Vergleichszeile */}
{idx < tradeOffers.length - 1 && (
  <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
    <span className="text-sm text-gray-300">
      Preisunterschied zum nächsten Angebot:
    </span>
    <span className="text-sm font-semibold text-yellow-400">
      {formatCurrency(Math.abs(
        (offer.amount - (offer.amount * (offer.bundle_discount || 0) / 100)) - 
        (tradeOffers[idx + 1].amount - (tradeOffers[idx + 1].amount * (tradeOffers[idx + 1].bundle_discount || 0) / 100))
      ))}
    </span>
  </div>
)}             
                  </React.Fragment>
                ))}
                
                {/* Zusammenfassung pro Gewerk */}
                {tradeOffers.length > 1 && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-600/10 to-teal-600/10 rounded-lg border border-white/20">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-400">Preisrahmen für {tradeName}:</p>
                        <p className="text-white">
                          {formatCurrency(Math.min(...tradeOffers.map(o => {
  const netto = parseFloat(o.amount) || 0;
  const discount = (o.bundle_discount || 0) / 100;
  return netto - (netto * discount);
})))} - 
{formatCurrency(Math.max(...tradeOffers.map(o => {
  const netto = parseFloat(o.amount) || 0;
  const discount = (o.bundle_discount || 0) / 100;
  return netto - (netto * discount);
})))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Durchschnittspreis:</p>
                        <p className="text-xl font-bold text-teal-400">
                          {(() => {
                            const amounts = tradeOffers.map(o => parseFloat(o.amount) || 0);
                            const avg = amounts.reduce((sum, val) => sum + val, 0) / amounts.length;
                            return formatCurrency(avg);
                          })()}
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
    </>
  );
})()}
  </div>
)}

{rejectModalOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 border border-white/20">
      <h3 className="text-xl font-bold text-white mb-4">Angebot ablehnen</h3>
      
      <div className="mb-4">
        <label className="block text-sm text-gray-400 mb-2">Ablehnungsgrund</label>
        <select
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
        >
          <option value="">Bitte wählen...</option>
          <option value="too_expensive">Angebot zu hoch</option>
          <option value="timeline">Ausführungszeitraum passt nicht</option>
          <option value="quality_concerns">Bedenken bezüglich Qualität</option>
          <option value="better_offer">Besseres Angebot erhalten</option>
          <option value="project_cancelled">Projekt verschoben/abgesagt</option>
          <option value="other">Sonstiges</option>
        </select>
      </div>
      
      {rejectReason === 'other' && (
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Anmerkungen</label>
          <textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
            placeholder="Bitte erläutern Sie kurz den Grund..."
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          />
        </div>
      )}
      
      <p className="text-sm text-gray-400 mb-4">
        Der Handwerker wird über die Ablehnung informiert.
      </p>
      
      <div className="flex gap-3">
        <button
          onClick={() => {
            setRejectModalOpen(false);
            setRejectReason('');
            setRejectNotes('');
          }}
          className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Abbrechen
        </button>
        <button
          onClick={handleRejectConfirm}
          disabled={!rejectReason}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Angebot ablehnen
        </button>
      </div>
    </div>
  </div>
)}
          
          {/* Vertragsanbahnung Tab */}
{activeTab === 'contracts' && (
  <div>
    {console.log('🔵 DEBUG - Alle Offers:', offers)}
    {console.log('🔵 DEBUG - Offers Status:', offers.map(o => ({id: o.id, status: o.status})))}
    {console.log('🔵 DEBUG - Gefiltert:', offers.filter(o => (o.status === 'preliminary' || o.status === 'confirmed') && o.status !== 'accepted'))}
        
    <h2 className="text-2xl font-bold text-white mb-6">Vertragsanbahnungen</h2>
    
    <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
      <p className="text-yellow-300 text-sm">
        <strong>⚠️ Exklusivitätsvereinbarung:</strong> In der Vertragsanbahnung haben Sie exklusiven Kontakt zum ausgewählten Handwerksbetrieb. Während dieser Verhandlungsphase sind weitere Angebote auf diese Ausschreibung in byndl gesperrt.         
        Nutzen Sie die Zeit für Ortstermine und finale Abstimmungen. Einen Auftrag können Sie in byndl erst nach verbindlicher Angebotsbestätigung durch den Handwerksbetrieb erteilen. Falls Sie sich doch für ein anderes Angebot entscheiden möchten, 
        beenden Sie bitte zunächst diese Vertragsanbahnung. Wir verweisen hierzu auf die Regelungen zur zweistufigen Vergabe in unseren AGB.
      </p>
    </div>
    
    {offers.filter(o => (o.status === 'preliminary' || o.status === 'confirmed') && o.status !== 'accepted').length === 0 ? (
      <p className="text-gray-400">Keine laufenden Vertragsanbahnungen.</p>
    ) : (
      <div className="space-y-6">
       {offers.filter(o => (o.status === 'preliminary' || o.status === 'confirmed') && o.status !== 'accepted').map((offer, idx) => (
          <div key={idx} className="bg-white/5 rounded-lg p-6 border border-white/10">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-2">
                  {offer.tradeName || offer.trade_name || offer.trade}
                </h3>
                <p className="text-gray-300">{offer.companyName || offer.company_name}</p>
                
                {/* Status Badge */}
                <div className="mt-2">
                  {offer.status === 'preliminary' && !offer.offer_confirmed_at && (
                    <span className="inline-block px-3 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded-full">
                      ⏳ Warte auf Angebotsbestätigung nach Ortstermin
                    </span>
                  )}
                  {offer.status === 'confirmed' && (
                    <span className="inline-block px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">
                      ✓ Angebot verbindlich bestätigt 
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-right ml-6">
  <p className="text-sm text-gray-400 mb-1">
    {offer.bundle_discount > 0 ? (
  <>
    Netto: {formatCurrency(offer.amount)}
    Rabatt: -{offer.bundle_discount}%
    Nach Rabatt: {formatCurrency(offer.amount - (offer.amount * offer.bundle_discount / 100))}
    Brutto: {formatCurrency((offer.amount - (offer.amount * offer.bundle_discount / 100)) * 1.19)}
  </>
) : (
  <>
    Netto: {formatCurrency(offer.amount)}
    Brutto: {formatCurrency((offer.amount || 0) * 1.19)}
  </>
)}
  </p>
  <p className="text-xs text-gray-400 mb-3">
    Brutto (inkl. 19% MwSt.)
  </p>
                <p className="text-xs text-gray-400">
                  Vertragsanbahnung seit:<br />
                  {new Date(offer.preliminary_accepted_at || offer.created_at).toLocaleDateString('de-DE')}
                </p>
              </div>
            </div>
            
            {/* Kontaktdaten */}
            <div className="bg-white/10 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-semibold text-white mb-3">📞 Kontaktdaten Handwerker</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-gray-300">
                  <p><strong className="text-white">Firma:</strong> {offer.companyName || offer.company_name}</p>
                  <p className="mt-1"><strong className="text-white">Telefon:</strong> {offer.phone || offer.handwerker_phone || 'Nicht verfügbar'}</p>
                </div>
                <div className="text-gray-300">
                  <p><strong className="text-white">E-Mail:</strong> {offer.email || offer.handwerker_email || 'Nicht verfügbar'}</p>
                  <p className="mt-1"><strong className="text-white">Adresse:</strong> {offer.address || 'Auf Anfrage'}</p>
                </div>
              </div>
            </div>
            
            {/* Ortstermin-Sektion */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <h4 className="text-white font-semibold mb-2">📅 Ortstermin vereinbaren</h4>
                  <p className="text-blue-200 text-sm">
                    Vereinbaren Sie einen Ortstermin mit dem Handwerker zur Angebotsfinalisierung
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/ortstermin/${offer.id}`)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold whitespace-nowrap ml-4"
                >
                  Zur Terminvereinbarung →
                </button>
              </div>
              
              {/* Zeige bestätigte Termine an */}
              {offer.appointment_confirmed && offer.appointment_date && (
                <div className="mt-4 pt-4 border-t border-blue-500/30">
                  <div className="bg-green-500/20 border border-green-500/50 rounded p-3">
                    <p className="text-green-300 font-semibold">✓ Bestätigter Termin</p>
                    <p className="text-green-200 text-sm mt-1">
                      {new Date(offer.appointment_date).toLocaleDateString('de-DE', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })} Uhr
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ✅ NEU: Ausführungstermine - MIT TERMINÄNDERUNGEN */}
            <ExecutionTimesDisplay 
              offerId={offer.id}
              projectId={selectedProject.id}
              tradeName={offer.tradeName || offer.trade_name}
              apiUrl={apiUrl}
              reloadTrigger={scheduleReloadTrigger} 
              onScheduleChange={() => {
                loadProjectDetails(selectedProject.id);
                setScheduleReloadTrigger(prev => prev + 1);
              }}
            />
            
            {/* Aktionsbuttons */}
<div className="flex flex-wrap gap-3">
  {/* Angebot ansehen */}
  <button
    onClick={() => navigate(`/project/${selectedProject.id}/offer/${offer.id}`)}
    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
  >
    📋 Angebot im Detail ansehen
  </button>
  
  {/* PHASE 2: Verbindlich beauftragen - nur wenn bestätigt */}
  {offer.status === 'confirmed' && (
    <>
      <button 
        onClick={() => handleFinalOrder(offer)}
        className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg font-semibold hover:shadow-xl transform hover:scale-[1.02] transition-all"
      >
        ✓ Jetzt verbindlich beauftragen
      </button>
      
      <button
        onClick={async () => {
          if (!window.confirm('Möchten Sie dieses verbindliche Angebot ablehnen? Der Handwerker und sein Angebot werden komplett aus Ihrem Dashboard entfernt.')) return;
          
          try {
            setLoading(true);
            const res = await fetch(apiUrl(`/api/offers/${offer.id}/reject-confirmed`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: selectedProject.id,
                reason: 'Verbindliches Angebot entspricht nicht den Erwartungen'
              })
            });
            
            if (res.ok) {
              alert('Verbindliches Angebot wurde abgelehnt und aus dem Dashboard entfernt.');
              loadProjectDetails(selectedProject.id);
            } else {
              throw new Error('Fehler beim Ablehnen');
            }
          } catch (err) {
            console.error('Error:', err);
            alert('Fehler beim Ablehnen des Angebots');
          } finally {
            setLoading(false);
          }
        }}
        className="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
      >
        ❌ Verbindliches Angebot ablehnen
      </button>
    </>
  )}
  
  {/* PHASE 1: Vertragsanbahnung beenden - nur wenn noch nicht bestätigt */}
  {offer.status === 'preliminary' && (
    <button
      onClick={async () => {
        if (!window.confirm('Möchten Sie diese Vertragsanbahnung beenden? Das Angebot wird zurück zu "Angebote" verschoben.')) return;
        
        try {
          setLoading(true);
          const res = await fetch(apiUrl(`/api/offers/${offer.id}/end-negotiation`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (res.ok) {
            alert('Vertragsanbahnung beendet. Das Angebot ist wieder unter "Angebote" verfügbar.');
            loadProjectDetails(selectedProject.id);
          } else {
            throw new Error('Fehler beim Beenden');
          }
        } catch (err) {
          console.error('Error:', err);
          alert('Fehler beim Beenden der Vertragsanbahnung');
        } finally {
          setLoading(false);
        }
      }}
      className="px-4 py-2 bg-orange-500/20 text-orange-300 border border-orange-500/50 rounded-lg hover:bg-orange-500/30 transition-colors text-sm"
    >
      🔄 Vertragsanbahnung beenden
    </button>
  )}
</div>
          </div>
        ))}
      </div>
    )}
  </div>
)}

          {/* Aufträge Tab - MIT WERKVERTRAG & GRUPPIERUNG */}
{activeTab === 'orders' && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Erteilte Aufträge / Werkverträge</h2>

    {orders.length > 0 && (
  <div className="mb-8 p-6 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-lg">
    <div className="flex justify-between items-center">
      <div>
        <h3 className="text-white font-semibold text-lg mb-1">Gesamtsumme aller Aufträge</h3>
        <p className="text-gray-400 text-sm">{orders.length} Auftrag{orders.length !== 1 ? 'e' : ''} insgesamt</p>
      </div>
      <div className="text-right">
        {/* ✅ NEU: Berechne mit Nachträgen */}
        {(() => {
          const totalNetto = orders.reduce((sum, o) => {
            const orderId = o.id;
            const totalsData = orderTotals[orderId];
            return sum + (totalsData ? totalsData.totalNetto : (parseFloat(o.amount) || 0));
          }, 0);
          const totalBrutto = totalNetto * 1.19;
          
          return (
            <>
              <p className="text-sm text-gray-400 mb-1">Netto (inkl. Nachträge): {formatCurrency(totalNetto)}</p>
              <p className="text-3xl font-bold text-purple-300">
                {formatCurrency(totalBrutto)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Brutto (inkl. 19% MwSt. & Nachträge)</p>
            </>
          );
        })()}
      </div>
    </div>
  </div>
)}   
    {orders.length === 0 ? (
      <p className="text-gray-400">Noch keine Aufträge erteilt.</p>
    ) : (
      <div className="space-y-8">
        {/* AKTIVE AUFTRÄGE */}
        {orders.filter(o => o.status === 'active').length > 0 && (
          <div>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span>
              Aktive Aufträge
            </h3>
            {/* Gesamtsumme aktiver Aufträge */}
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
  <div className="flex justify-between items-center">
    <span className="text-blue-200 font-semibold">Gesamtsumme aller aktiven Aufträge:</span>
    <div className="text-right">
      {/* ✅ NEU: Mit Nachträgen */}
      {(() => {
        const activeOrders = orders.filter(o => o.status === 'active');
        const totalNetto = activeOrders.reduce((sum, o) => {
          const totalsData = orderTotals[o.id];
          return sum + (totalsData ? totalsData.totalNetto : (parseFloat(o.amount) || 0));
        }, 0);
        const totalBrutto = totalNetto * 1.19;
        
        return (
          <>
            <p className="text-sm text-gray-400">Netto (inkl. NT): {formatCurrency(totalNetto)}</p>
            <p className="text-2xl font-bold text-blue-300">
              Brutto: {formatCurrency(totalBrutto)}
            </p>
          </>
        );
      })()}
    </div>
  </div>
</div>         
            <div className="space-y-6">
              {orders.filter(o => o.status === 'active').map((order, idx) => {
  // ✅ NEU: Verwende Totals inkl. Nachträge falls vorhanden
  const totalsData = orderTotals[order.id];
  const pendingCount = pendingNachtraege[order.id] || 0;
  
  const netto = totalsData ? totalsData.totalNetto : (parseFloat(order.amount) || 0);
  const bundleDiscount = order.bundle_discount || 0;
  const discountAmount = totalsData ? totalsData.discountAmount : (bundleDiscount > 0 ? (netto * bundleDiscount / 100) : 0);
  const nettoAfterDiscount = totalsData ? totalsData.nettoAfterDiscount : (netto - discountAmount);
  const brutto = totalsData ? totalsData.totalBrutto : (nettoAfterDiscount * 1.19);
  
  // ✅ NEU: Nachtrags-Info
  const nachtraegeSum = totalsData ? totalsData.nachtraegeSum : 0;
  const approvedNachtraege = totalsData ? totalsData.approvedCount : 0;
  
  return (
    <div key={idx} className="bg-white/5 rounded-lg p-6 border border-white/10">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold text-white">{order.trade_name}</h3>
            <span className="px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">
              Werkvertrag nach VOB/B
            </span>
            {/* ✅ NEU: Nachtrag-Badge falls vorhanden */}
            {pendingCount > 0 && (
              <span className="px-3 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded-full animate-pulse">
                {pendingCount} Nachtrag{pendingCount > 1 ? 'e' : ''} zu prüfen
              </span>
            )}
            {approvedNachtraege > 0 && (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full">
                {approvedNachtraege} NT beauftragt
              </span>
            )}
          </div>
          <p className="text-gray-300 mb-2">{order.company_name}</p>
          <p className="text-sm text-gray-400">
            Beauftragt: {new Date(order.created_at).toLocaleDateString('de-DE')} | 
            Auftrags-Nr: #{order.id}
          </p>
          
          {/* Ausführungstermine */}
          <div className="mt-3 p-3 bg-blue-500/10 rounded">
            <p className="text-blue-300 text-sm">
              <strong>📅 Ausführungszeitraum:</strong><br />
              {new Date(order.execution_start).toLocaleDateString('de-DE')} bis {new Date(order.execution_end).toLocaleDateString('de-DE')}
            </p>
          </div>
        </div>
        
        {/* ✅ ANGEPASST: Preisanzeige mit Nachträgen */}
        <div className="text-right ml-6 min-w-[200px]">
          {/* Original-Auftrag */}
          <div className="mb-3 p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Ursprungsauftrag Netto</p>
            <p className="text-lg font-semibold text-gray-300">
              {formatCurrency(parseFloat(order.amount) || 0)}
            </p>
          </div>
          
          {/* ✅ NEU: Nachträge falls vorhanden */}
          {nachtraegeSum > 0 && (
            <div className="mb-3 p-3 bg-teal-500/10 border border-teal-500/30 rounded-lg">
              <p className="text-xs text-teal-400 mb-1">+ Nachträge</p>
              <p className="text-lg font-semibold text-teal-400">
                {formatCurrency(nachtraegeSum)}
              </p>
            </div>
          )}
          
          {bundleDiscount > 0 && (
            <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-xs text-green-400 mb-1">📦 Bündelrabatt ({bundleDiscount}%)</p>
              <p className="text-sm font-semibold text-green-400">
                - {formatCurrency(discountAmount)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Netto nach Rabatt</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(nettoAfterDiscount)}
              </p>
            </div>
          )}
          
          {/* Gesamtsumme */}
          <div className="mb-3 p-3 bg-white/5 rounded-lg border-2 border-purple-500/30">
            <p className="text-xs text-gray-400 mb-1">Gesamt Netto{nachtraegeSum > 0 ? ' (inkl. NT)' : ''}</p>
            <p className="text-xl font-bold text-white">
              {formatCurrency(netto)}
            </p>
          </div>
          
          {/* Brutto */}
          <div className="mb-3 p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-gray-400 mb-1">Brutto (inkl. 19% MwSt.)</p>
            <p className="text-2xl font-bold text-green-300">
              {formatCurrency(brutto)}
            </p>
          </div>
          
          <span className="text-xs px-3 py-1 rounded inline-block bg-blue-600 text-blue-200">
            In Ausführung
          </span>
        </div>
      </div>
      
      {/* ✅ NEU: Nachtrag-Hinweis falls vorhanden */}
      {pendingCount > 0 && (
        <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
          <p className="text-yellow-300 text-sm font-semibold">
            ⚠️ {pendingCount} Nachtrag{pendingCount > 1 ? 'e' : ''} zur Prüfung eingereicht
          </p>
        </div>
      )}
      
      {/* Werkvertrag-Aktionen - ✅ MIT NACHTRAGS-BUTTONS */}
      <div className="border-t border-white/10 pt-4 mt-4">
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => window.open(apiUrl(`/api/orders/${order.id}/contract-pdf`), '_blank')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Werkvertrag als PDF
          </button>
          
          <button
            onClick={() => navigate(`/bauherr/order/${order.id}/lv-details`)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            LV-Details ansehen
          </button>
          
          <button
            onClick={() => {
              setSelectedOrderId(order.id);
              setShowContractView(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Vertrag ansehen
          </button>
          
          {/* ✅ NEU: Nachträge einsehen Button (nur wenn Nachträge existieren) */}
          {(approvedNachtraege > 0 || pendingCount > 0) && (
            <button
              onClick={() => navigate(`/bauherr/auftrag/${order.id}/nachtraege`)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Nachträge einsehen ({approvedNachtraege + pendingCount})
            </button>
          )}
          
          {order.status === 'active' && (
            <button
              onClick={async () => {
                if (!window.confirm('Möchten Sie die Leistung abnehmen? Dies bestätigt die ordnungsgemäße Ausführung und startet die Gewährleistungsfrist.')) return;
                
                try {
                  setLoading(true);
                  const res = await fetch(apiUrl(`/api/orders/${order.id}/accept-completion`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  });
                  
                  if (res.ok) {
                    const data = await res.json();
                    alert('✅ ' + data.message);
                    loadProjectDetails(selectedProject.id);
                  } else {
                    const error = await res.json();
                    alert('❌ Fehler: ' + error.error);
                  }
                } catch (err) {
                  console.error('Error:', err);
                  alert('❌ Fehler beim Abnehmen der Leistung');
                } finally {
                  setLoading(false);
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-2"
              disabled={loading}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {loading ? 'Wird abgenommen...' : 'Leistung abnehmen'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
})}
            </div>
          </div>
        )}
              
        {/* ABGESCHLOSSENE AUFTRÄGE */}
        {orders.filter(o => o.status === 'completed').length > 0 && (
          <div>
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Abgeschlossene Aufträge (Leistung abgenommen)
            </h3>
            <div className="space-y-6">
              {orders.filter(o => o.status === 'completed').map((order, idx) => {
  // Berechne mit Rabatt
  const netto = parseFloat(order.amount) || 0;
  const bundleDiscount = order.bundle_discount || 0;
  const discountAmount = bundleDiscount > 0 ? (netto * bundleDiscount / 100) : 0;
  const nettoAfterDiscount = netto - discountAmount;
  const brutto = nettoAfterDiscount * 1.19;
  
  return (
                <div key={idx} className="bg-white/5 rounded-lg p-6 border border-green-500/30">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-white">{order.trade_name}</h3>
                        <span className="px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">
                          Werkvertrag nach VOB/B
                        </span>
                      </div>
                      <p className="text-gray-300 mb-2">{order.company_name}</p>
                      <p className="text-sm text-gray-400">
                        Beauftragt: {new Date(order.created_at).toLocaleDateString('de-DE')} | 
                        Auftrags-Nr: #{order.id}
                      </p>
                      {order.accepted_at && (
                        <p className="text-sm text-green-400 mt-1">
                          ✓ Abgenommen: {new Date(order.accepted_at).toLocaleDateString('de-DE')}
                        </p>
                      )}
                      
                      {/* Ausführungstermine */}
                      <div className="mt-3 p-3 bg-blue-500/10 rounded">
                        <p className="text-blue-300 text-sm">
                          <strong>📅 Ausführungszeitraum:</strong><br />
                          {new Date(order.execution_start).toLocaleDateString('de-DE')} bis {new Date(order.execution_end).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right ml-6 min-w-[200px]">
  {/* Netto */}
  <div className="mb-3 p-3 bg-white/5 rounded-lg">
    <p className="text-xs text-gray-400 mb-1">Netto</p>
    <p className="text-2xl font-bold text-white">
      {formatCurrency(netto)}
    </p>
  </div>
  
  {bundleDiscount > 0 && (
    <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
      <p className="text-xs text-green-400 mb-1">📦 Bündelrabatt ({bundleDiscount}%)</p>
      <p className="text-sm font-semibold text-green-400">
        - {formatCurrency(discountAmount)}
      </p>
      <p className="text-xs text-gray-400 mt-1">Netto nach Rabatt</p>
      <p className="text-lg font-bold text-white">
        {formatCurrency(nettoAfterDiscount)}
      </p>
    </div>
  )}
  
  {/* Brutto */}
  <div className="mb-3 p-3 bg-white/5 rounded-lg">
    <p className="text-xs text-gray-400 mb-1">Brutto (inkl. 19% MwSt.)</p>
    <p className="text-lg font-semibold text-green-300">
      {formatCurrency(brutto)}
    </p>
  </div>
  
  <span className="text-xs px-3 py-1 rounded inline-block bg-green-600 text-green-200">
  Abgeschlossen
</span>
</div>
                  </div>
                  
                  {/* Gewährleistungshinweis */}
                  <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-300 text-sm flex items-start gap-2">
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>
                        <strong>Gewährleistung:</strong> {order.warranty_period || 5} Jahre ab Abnahme
                        {order.accepted_at && (
                          <span className="block mt-1">
                            Gültig bis: {new Date(new Date(order.accepted_at).setFullYear(new Date(order.accepted_at).getFullYear() + (order.warranty_period || 5))).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </span>
                    </p>
                  </div>
                  
                  {/* Werkvertrag-Aktionen */}
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => window.open(apiUrl(`/api/orders/${order.id}/contract-pdf`), '_blank')}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Werkvertrag als PDF
                      </button>
                      
                      <button
                        onClick={() => navigate(`/bauherr/order/${order.id}/lv-details`)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        LV-Details ansehen
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedOrderId(order.id);
                          setShowContractView(true);
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Vertrag ansehen
                      </button>
                    </div>
                  </div>
                </div>
                 );
              })}
            </div>
          </div>
        )}
      </div>
    )}
  </div>
)}

          {/* Kostenübersicht Tab - VERBESSERT */}
{activeTab === 'budget' && budgetOverview && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Kostenübersicht</h2>
    
    {/* Neue Visualisierung */}
    <BudgetVisualization budget={budgetOverview} />
    
    {/* Detaillierte Aufschlüsselung */}
    <div className="mt-6 space-y-4">
      <div className="bg-white/5 rounded-lg p-4">
        <h4 className="text-white font-semibold mb-3">Detailaufschlüsselung</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Anfangsbudget</span>
            <span className="text-xl text-white">
              {formatCurrency(budgetOverview.initialBudget)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">KI-Kostenschätzung</span>
            <span className="text-xl text-blue-400">
              {formatCurrency(budgetOverview.estimatedCost)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Beauftragte Summe (Brutto)</span>
            <div className="text-right">
              <span className="text-xl text-green-400 block">
                {formatCurrency(budgetOverview.orderedAmount)}
              </span>
              <span className="text-xs text-gray-500">
                Netto: {formatCurrency(budgetOverview.orderedAmountNetto)}
              </span>
            </div>
          </div>
          
          {supplements.length > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Eingegangene Nachträge</span>
                <span className="text-xl text-orange-400">
                  {formatCurrency(budgetOverview.supplementsRequested)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Genehmigte Nachträge</span>
                <span className="text-xl text-orange-600">
                  {formatCurrency(budgetOverview.supplementsApproved)}
                </span>
              </div>
            </>
          )}
          
          <div className="border-t border-white/20 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-white font-semibold">Gesamtkosten aktuell</span>
              <span className={`text-2xl font-bold ${
                budgetOverview.totalCurrent > budgetOverview.initialBudget ? 'text-red-400' : 'text-green-400'
              }`}>
                {formatCurrency(budgetOverview.totalCurrent)}
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
      </div>

      {supplements.filter(s => !s.approved).length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-300 text-sm">
            <strong>⚠️ KI-Hinweis:</strong> Sie haben {supplements.filter(s => !s.approved).length} ungeprüfte Nachträge. 
            Die KI-Analyse kann Ihnen bei der Bewertung helfen.
          </p>
        </div>
      )}
    </div>
  </div>
)}

         {/* Terminplan Tab */}
        {activeTab === 'schedule' && selectedProject && (
  <ScheduleTab
    project={selectedProject}
    apiUrl={apiUrl}
    reloadTrigger={scheduleReloadTrigger}
    onReload={() => {
      loadProjectDetails(selectedProject.id);
      loadScheduleBadgeCount(selectedProject.id);
    }}
  />
)}
        
        {/* Projekt löschen Button - nur im Overview Tab */}
        {activeTab === 'overview' && selectedProject && (
          <div className="mt-8 text-center">
            <button
              onClick={() => deleteProject(selectedProject.id)}
              className="inline-block px-6 py-3 bg-red-500/10 hover:bg-red-500/20 backdrop-blur border border-red-500/30 rounded-lg text-red-300 hover:text-red-200 transition-all"
            >
              🗑️ Projekt löschen
            </button>
          </div>
        )}
      </div>
    </>
  )}
  
   {/* Modal für Vertragsanbahnung */}
  {showContractModal && <ContractNegotiationModal />}
  
  {/* Modal für Vertragsansicht */}
  {showContractView && (
    <ContractViewModal 
      orderId={selectedOrderId}
      onClose={() => {
        setShowContractView(false);
        setSelectedOrderId(null);
      }}
    />
  )}
    </div>
    {/* Fristverlängerungs-Modal */}
{showExtensionModal && selectedTenderForExtension && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-white/20">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white">Frist verlängern</h3>
        <button
          onClick={() => {
            setShowExtensionModal(false);
            setSelectedTenderForExtension(null);
            setExtensionType('days');
            setExtensionDays(7);
            setCustomDeadline('');
          }}
          className="text-gray-400 hover:text-white text-2xl"
        >
          ×
        </button>
      </div>

      <div className="mb-6">
        <p className="text-gray-300 text-sm mb-2">
          Gewerk: <span className="font-semibold text-white">{selectedTenderForExtension.trade_name}</span>
        </p>
        <p className="text-gray-400 text-xs">
          Aktuelle Frist: {selectedTenderForExtension.deadline 
  ? new Date(selectedTenderForExtension.deadline).toLocaleDateString('de-DE')
  : 'Nicht gesetzt'}
        </p>
      </div>

      {/* Auswahl: Tage oder Datum */}
      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setExtensionType('days')}
            className={`flex-1 py-2 px-4 rounded-lg transition-all ${
              extensionType === 'days'
                ? 'bg-teal-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            Tage hinzufügen
          </button>
          <button
            onClick={() => setExtensionType('custom')}
            className={`flex-1 py-2 px-4 rounded-lg transition-all ${
              extensionType === 'custom'
                ? 'bg-teal-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            Datum wählen
          </button>
        </div>

        {extensionType === 'days' ? (
          <div className="space-y-3">
            <label className="block text-sm text-gray-400 mb-2">Verlängerung um:</label>
            <div className="grid grid-cols-3 gap-2">
              {[7, 14, 21].map((days) => (
                <button
                  key={days}
                  onClick={() => setExtensionDays(days)}
                  className={`py-3 px-4 rounded-lg transition-all ${
                    extensionDays === days
                      ? 'bg-teal-500/20 border-2 border-teal-500 text-teal-300'
                      : 'bg-white/5 border border-white/20 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  <div className="font-semibold">{days}</div>
                  <div className="text-xs">Tage</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-sm text-gray-400 mb-2">Neues Fristende:</label>
            <input
              type="date"
              value={customDeadline}
              onChange={(e) => setCustomDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white"
            />
          </div>
        )}
      </div>

      {/* Aktionsbuttons */}
      <div className="flex gap-3">
        <button
          onClick={() => {
            setShowExtensionModal(false);
            setSelectedTenderForExtension(null);
            setExtensionType('days');
            setExtensionDays(7);
            setCustomDeadline('');
          }}
          className="flex-1 px-4 py-2 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 transition-colors"
        >
          Abbrechen
        </button>
        <button
          onClick={async () => {
            try {
              setLoading(true);
              
              let newDeadline;
if (extensionType === 'days') {
  const currentDeadline = selectedTenderForExtension.deadline 
    ? new Date(selectedTenderForExtension.deadline)
    : new Date();
  
  currentDeadline.setDate(currentDeadline.getDate() + extensionDays);
  newDeadline = currentDeadline.toISOString().split('T')[0]; // Nur Datum
} else {
  if (!customDeadline) {
    alert('❌ Bitte wählen Sie ein Datum');
    setLoading(false);
    return;
  }
  newDeadline = customDeadline; // Schon im richtigen Format
}

              const res = await fetch(apiUrl(`/api/tenders/${selectedTenderForExtension.id}/extend-deadline`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  newDeadline: newDeadline,
                  projectId: selectedProject.id
                })
              });

              if (res.ok) {
                alert('✅ Frist wurde erfolgreich verlängert');
                setShowExtensionModal(false);
                setSelectedTenderForExtension(null);
                setExtensionType('days');
                setExtensionDays(7);
                setCustomDeadline('');
                loadProjectDetails(selectedProject.id);
                loadUserProjects(userData.email);
              } else {
                const error = await res.json();
                alert('❌ Fehler: ' + (error.error || 'Unbekannter Fehler'));
              }
            } catch (err) {
              console.error('Error extending deadline:', err);
              alert('❌ Fehler beim Verlängern der Frist');
            } finally {
              setLoading(false);
            }
          }}
          className="flex-1 px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          disabled={loading}
        >
          {loading ? 'Wird verlängert...' : 'Frist verlängern'}
        </button>
      </div>
    </div>
  </div>
)}  
{evaluationModal.type === 'single' && (
  <OfferEvaluationModal
    isOpen={evaluationModal.isOpen}
    onClose={() => setEvaluationModal({ isOpen: false, type: null, data: null, companyName: null })}
    evaluation={evaluationModal.data}
    companyName={evaluationModal.companyName}
  />
)}

{evaluationModal.type === 'comparison' && (
  <OfferComparisonModal
    isOpen={evaluationModal.isOpen}
    onClose={() => setEvaluationModal({ isOpen: false, type: null, data: null, companyName: null })}
    comparison={evaluationModal.data}
  />
)}
{/* Bundle-Info Modal */}
{bundleModalOpen && selectedBundleOffer && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
      <div className="sticky top-0 bg-gradient-to-r from-green-600/20 to-teal-600/20 p-6 border-b border-white/10 backdrop-blur">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center shadow-lg">
              <span className="text-3xl">📦</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">Vorteile der Projektbündelung</h3>
              {selectedBundleOffer.bundle_discount > 0 && (
                <span className="inline-block px-3 py-1 bg-green-500/30 text-green-300 rounded-full text-sm font-semibold">
                  {selectedBundleOffer.bundle_discount}% Bündelrabatt
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              setBundleModalOpen(false);
              setSelectedBundleOffer(null);
            }}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>
      </div>
      
      <div className="p-6">
        <div className="space-y-4 text-gray-200 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-green-400 font-bold text-xl">✓</span>
            <div>
              <p className="font-semibold text-white mb-1">Attraktive Konditionen</p>
              <p className="text-sm">
                {selectedBundleOffer.bundle_discount > 0 ? (
                  <>Der Handwerker bietet {selectedBundleOffer.bundle_discount}% Bündelrabatt, 
                  da er durch die Kombination mehrerer Projekte in Ihrer Region Zeit und Kosten spart.</>
                ) : (
                  <>Der Handwerker kann durch die Kombination mehrerer Projekte in Ihrer Region Zeit und Kosten sparen 
                  und möglicherweise bessere Konditionen anbieten.</>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <span className="text-green-400 font-bold text-xl">✓</span>
            <div>
              <p className="font-semibold text-white mb-1">Optimierte Abwicklung</p>
              <p className="text-sm">
                Durch koordinierte Ausführung mehrerer Projekte profitieren Sie von kürzeren Wartezeiten 
                und effizienteren Arbeitsabläufen.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <span className="text-green-400 font-bold text-xl">✓</span>
            <div>
              <p className="font-semibold text-white mb-1">Lokale Synergie</p>
              <p className="text-sm">
                byndl nutzt Netzwerkeffekte im regionalen Handwerkermarkt – 
                Sie erhalten qualitativ hochwertige Leistungen zu besseren Preisen.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <span className="text-green-400 font-bold text-xl">✓</span>
            <div>
              <p className="font-semibold text-white mb-1">Materialrabatte</p>
              <p className="text-sm">
                Bei gebündelten Projekten können Handwerker Materialien in größeren Mengen einkaufen 
                und die Einsparungen an Sie weitergeben.
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-6">
  <div className="flex items-start gap-2">
    <span className="text-2xl">⚠️</span>
    <div className="flex-1">
      <p className="text-yellow-200 text-sm">
        <strong>Wichtig:</strong> 
        {selectedBundleOffer.bundle_discount > 0 ? (
          <> Der angebotene Bündelrabatt von {selectedBundleOffer.bundle_discount}% gilt vorbehaltlich, 
          dass <strong>alle Bauherren der Projekte im Bündel</strong> den Auftrag an {selectedBundleOffer.company_name || selectedBundleOffer.companyName} erteilen. 
          Sofern nur Teile des Bündels beauftragt werden, kann der Auftragnehmer den angebotenen Rabatt 
          im Rahmen der Vertragsanbahnung anpassen.</>
        ) : (
          <> Dieses Angebot ist Teil eines Projektbündels.</>
        )}
      </p>
    </div>
  </div>
</div>

<div className="flex items-center justify-center gap-6 text-sm text-gray-400 pb-2">
  <div className="flex items-center gap-2">
    <span className="text-lg">🚗</span>
    <span>Geringere Fahrtkosten</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-lg">⚡</span>
    <span>Schnellere Umsetzung</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-lg">💰</span>
    <span>Kosteneinsparung</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-lg">🔄</span>
    <span>Koordinierte Abwicklung</span>
  </div>
</div>
      </div>
    </div>
  </div>
)}      
  </div>
  );
}
