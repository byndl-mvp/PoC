import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';
import NotificationCenter from '../pages/NotificationCenter';
import MessageCenter from '../pages/MessageCenter';
import HandwerkerScheduleTab from './HandwerkerScheduleTab';
import RatingBadge from './RatingBadge'; 

function formatCurrency(amount) {
  if (!amount && amount !== 0) return '0 €';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

export default function HandwerkerDashboardPage() {
  const navigate = useNavigate();
  const [handwerkerData, setHandwerkerData] = useState(null);
  const [activeTab, setActiveTab] = useState('ausschreibungen');
  const messageCenterRef = useRef(null);
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [tenders, setTenders] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [offers, setOffers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [schedule, setSchedule] = useState([]); // eslint-disable-line no-unused-vars
  const [showContractView, setShowContractView] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orderTotals, setOrderTotals] = useState({}); 
  const [notifications, setNotifications] = useState([]);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [lastViewedTabs, setLastViewedTabs] = useState({
  ausschreibungen: null,
  bundles: null,
  angebote: null,
  vertragsanbahnung: null,
  auftraege: null
});
  
  useEffect(() => {
    const storedData = sessionStorage.getItem('handwerkerData');
    if (!storedData) {
      navigate('/handwerker/login');
      return;
    }
    
    const data = JSON.parse(storedData);
    setHandwerkerData(data);
    loadDashboardData(data);
  }, [navigate]); // eslint-disable-line react-hooks/exhaustive-deps 
  
  // useEffect für Notifications mit der Funktion direkt darin definiert
  useEffect(() => {
    if (!handwerkerData?.id) return;
    
    const loadNotifications = async () => {
      try {
        const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/notifications`));
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (error) {
        console.error('Fehler beim Laden der Benachrichtigungen:', error);
      }
    };
    
    // Initial laden
    loadNotifications();
    
    // Optional: Notifications alle 30 Sekunden aktualisieren
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [handwerkerData?.id]);

 // 1. DIESER useEffect wird ERSETZT (Tab-Wechsel tracken + speichern)
useEffect(() => {
  if (activeTab && ['ausschreibungen', 'bundles', 'angebote', 'vertragsanbahnung', 'auftraege'].includes(activeTab)) {
    const timestamp = new Date().toISOString();
    setLastViewedTabs(prev => ({
      ...prev,
      [activeTab]: timestamp
    }));
    sessionStorage.setItem(`handwerker_lastViewed_${activeTab}`, timestamp);
  }
}, [activeTab]);

// 2. DIESER useEffect wird NEU HINZUGEFÜGT (beim Start laden)
useEffect(() => {
  const tabs = ['ausschreibungen', 'bundles', 'angebote', 'vertragsanbahnung', 'auftraege'];
  const stored = {};
  tabs.forEach(tab => {
    const value = sessionStorage.getItem(`handwerker_lastViewed_${tab}`);
    if (value) stored[tab] = value;
  });
  
  if (Object.keys(stored).length > 0) {
    setLastViewedTabs(prev => ({ ...prev, ...stored }));
  }
}, []);
  
  const loadDashboardData = async (handwerker) => {
  try {
    setLoading(true);
    const timestamp = Date.now(); // Cache-Busting
    
    // Lade verfügbare Ausschreibungen
    const tendersRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/tenders/new?t=${timestamp}`));
    if (tendersRes.ok) {
      const tendersData = await tendersRes.json();
      // Filtere nur doppelte Einträge und final beauftragte
      const uniqueTenders = tendersData.filter((tender, index, self) =>
        index === self.findIndex((t) => t.id === tender.id) &&
        tender.offer_status !== 'accepted' &&
        tender.offer_status !== 'final_accepted' &&
        tender.offer_status !== 'preliminary' &&
        tender.offer_status !== 'confirmed' &&
        tender.status !== 'rejected' &&
        tender.status !== 'cancelled' &&
        tender.status !== 'awarded'
      );
      setTenders(uniqueTenders);
    }
    
    // Lade verfügbare Bündel
    const bundlesRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/bundles?t=${timestamp}`));
    if (bundlesRes.ok) {
      const bundlesData = await bundlesRes.json();
      setBundles(bundlesData);
    }
    
    // Lade abgegebene Angebote
    const offersRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/offers?t=${timestamp}`));
    if (offersRes.ok) {
      const offersData = await offersRes.json();
      setOffers(offersData);
    }
    
    // Lade Vertragsanbahnungen
    const contractsRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/contracts?t=${timestamp}`));
    console.log('🔴 Contracts Response:', contractsRes.ok, contractsRes.status);
    
    if (contractsRes.ok) {
      const contractsData = await contractsRes.json();
      console.log('🔴 Contracts Data empfangen:', contractsData);
      console.log('🔴 Contracts Length:', contractsData.length);
      setContracts(contractsData);
      console.log('🔴 setContracts() aufgerufen');
    }
    
    // Lade erteilte Aufträge
const ordersRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/orders?t=${timestamp}`));
if (ordersRes.ok) {
  const ordersData = await ordersRes.json();
  setOrders(ordersData);
  
  // ✅ NEU: Lade Nachtrags-Summen für alle Aufträge
  if (ordersData.length > 0) {
    const orderIds = ordersData.map(o => o.id);
    await loadOrderTotals(orderIds);
  }
}
    
    // Lade auch die Notifications beim initialen Laden
    if (handwerker.id) {
      const notifRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/notifications?t=${timestamp}`));
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        setNotifications(notifData);
      }
    }
    
  } catch (err) {
    console.error('Fehler beim Laden der Dashboard-Daten:', err);
  } finally {
    setLoading(false);
  }
};

const loadOrderTotals = async (orderIds) => {
  const totals = {};
  for (const orderId of orderIds) {
    try {
      const res = await fetch(apiUrl(`/api/orders/${orderId}/total-with-nachtraege`));
      if (res.ok) {
        const data = await res.json();
        totals[orderId] = data;
      }
    } catch (error) {
      console.error(`Error loading totals for order ${orderId}:`, error);
    }
  }
  setOrderTotals(totals);
};
  
  const handleRejectTender = async (tenderId) => {
    if (!window.confirm('Diese Ausschreibung wirklich ablehnen? Sie wird dauerhaft ausgeblendet.')) {
      return;
    }
    
    try {
      await fetch(apiUrl(`/api/tenders/${tenderId}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handwerkerId: handwerkerData.id })
      });
      
      // Aus Liste entfernen
      setTenders(prev => prev.filter(t => t.id !== tenderId));
    } catch (error) {
      console.error('Error rejecting tender:', error);
    }
  };
  
  const handleOpenTender = async (tender) => {
    // Markiere als angesehen
    await fetch(apiUrl(`/api/tenders/${tender.id}/track-view`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handwerkerId: handwerkerData.id })
    });
    
    // Navigiere zur Angebotsseite
    navigate(`/handwerker/tender/${tender.id}/offer`);
  };
  
  const handleAcceptPreliminary = async (contractId) => {
    if (!window.confirm('Möchten Sie die vorläufige Beauftragung annehmen? Die Kontaktdaten werden freigegeben.')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/contracts/${contractId}/accept-preliminary`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        alert('Vorläufige Beauftragung angenommen! Sie können nun direkt Kontakt aufnehmen.');
        loadDashboardData(handwerkerData);
      }
    } catch (err) {
      console.error('Fehler:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawOffer = async (offerId) => {
  if (!window.confirm('Möchten Sie Ihr Angebot wirklich zurückziehen? Sie können es danach erneut bearbeiten.')) {
    return;
  }

  try {
    setLoading(true);
    const res = await fetch(apiUrl(`/api/offers/${offerId}/withdraw-for-edit`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handwerkerId: handwerkerData.id })
    });

    if (res.ok) {
      alert('Angebot zurückgezogen. Sie können es nun unter "Ausschreibungen" erneut bearbeiten.');
      loadDashboardData(handwerkerData);
    }
  } catch (err) {
    console.error('Fehler:', err);
    alert('Fehler beim Zurückziehen des Angebots');
  } finally {
    setLoading(false);
  }
};

// NEU: Verifizierung prüfen vor Navigation
const checkVerificationAndNavigate = (callback) => {
  const handwerkerData = JSON.parse(sessionStorage.getItem('handwerkerData'));
  
  if (!handwerkerData.verified || handwerkerData.verification_status !== 'verified') {
    setShowVerificationModal(true);
    return false;
  }
  
  // Wenn verifiziert, führe die Callback-Funktion aus
  callback();
  return true;
};
  
  const handleLogout = () => {
    sessionStorage.removeItem('handwerkerData');
    navigate('/');
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
  
  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-white">Lade Dashboard...</p>
      </div>
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
        <h1 className="text-xl text-white">Handwerker-Dashboard</h1>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Notification Center */}
        <NotificationCenter 
          userType="handwerker"
          userId={handwerkerData?.id}
          apiUrl={apiUrl}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (handwerkerData) {
              loadDashboardData(handwerkerData);
            }
          }}
          onMessageCenterOpen={() => {  
            messageCenterRef.current?.setIsOpen(true);
          }}
        />
        
        {/* Message Center */}
        <MessageCenter
          ref={messageCenterRef} 
          userType="handwerker"
          userId={handwerkerData?.id}
          userName={handwerkerData?.company_name}
          apiUrl={apiUrl}
        /> 
        
        {/* NEU: Firmenname + Bewertungs-Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-white font-semibold text-lg">
              {handwerkerData?.company_name || handwerkerData?.companyName}
            </p>
            <p className="text-gray-400 text-xs">ID: {handwerkerData?.companyId}</p>
          </div>
          
          {/* NEU: Bewertungs-Badge */}
          <RatingBadge 
            handwerkerId={handwerkerData?.id}
            companyName={handwerkerData?.company_name || handwerkerData?.companyName}
          />
        </div>
        
        {/* Einstellungen Button */}
        <Link 
          to="/handwerker/settings" 
          className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          ⚙️ Einstellungen
        </Link>
        
        {/* Abmelden Button */}
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 rounded-lg transition-colors"
        >
          Abmelden
        </button>
      </div>
    </div>
  </div>
</header>

      {/* Verifizierungs-Status Banner */}
      {handwerkerData?.verificationStatus === 'pending' && (
        <div className="bg-yellow-500/10 border-t border-yellow-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⏳</span>
              <div className="flex-1">
                <p className="text-yellow-300 font-semibold">
                  Verifizierung ausstehend
                </p>
                <p className="text-yellow-200 text-sm mt-1">
                  Ihre Dokumente werden geprüft. Sie erhalten Ihre finale ID nach erfolgreicher Verifizierung.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
  
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistik-Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
    <p className="text-gray-400 text-sm">Neue Ausschreibungen</p>
    <p className="text-2xl font-bold text-teal-400">
      {tenders.filter(t => !t.viewed_at).length}
    </p>
  </div>
  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
    <p className="text-gray-400 text-sm">Verfügbare Bündel</p>
    <p className="text-2xl font-bold text-blue-400">{bundles.length}</p>
  </div>
  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
    <p className="text-gray-400 text-sm">In Vertragsanbahnung</p>
    <p className="text-2xl font-bold text-yellow-400">
      {offers.filter(o => o.status === 'preliminary' || o.status === 'confirmed').length}
    </p>
  </div>
  <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
  <p className="text-gray-400 text-sm">Aktive Aufträge</p>
  <p className="text-2xl font-bold text-green-400">
    {orders.filter(o => o.status !== 'completed' && o.status !== 'abgeschlossen').length}
  </p>
</div>
</div>

        {/* Tabs */}
<div className="flex gap-2 mb-8 border-b border-white/20 overflow-x-auto">
  {['ausschreibungen', 'bundles', 'angebote', 'vertragsanbahnung', 'auftraege', 'termine'].map((tab) => {
    // Berechne Badge-Zahlen
    // Berechne Badge-Zahlen
const badgeCounts = {
  ausschreibungen: tenders.filter(t => 
    !lastViewedTabs.ausschreibungen || 
    new Date(t.created_at) > new Date(lastViewedTabs.ausschreibungen)
  ).length,
  bundles: bundles.filter(b => 
    !lastViewedTabs.bundles || 
    new Date(b.created_at) > new Date(lastViewedTabs.bundles)
  ).length,
  angebote: offers.filter(o => 
    o.status === 'submitted' && 
    (!lastViewedTabs.angebote || 
    new Date(o.created_at) > new Date(lastViewedTabs.angebote))
  ).length,
  vertragsanbahnung: offers.filter(o => 
    (o.status === 'preliminary' || o.status === 'confirmed') &&
    (!lastViewedTabs.vertragsanbahnung || 
    new Date(o.updated_at || o.created_at) > new Date(lastViewedTabs.vertragsanbahnung))
  ).length,
  auftraege: orders.filter(o => 
  o.status !== 'completed' &&
  (!lastViewedTabs.auftraege || 
  new Date(o.created_at) > new Date(lastViewedTabs.auftraege))
).length
};
    
    const badgeCount = badgeCounts[tab] || 0;
    
    return (
      <button
        key={tab}
        onClick={() => {
  setActiveTab(tab);
  if (handwerkerData) {
    loadDashboardData(handwerkerData);
  }
}}
        className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
          activeTab === tab
            ? 'text-teal-400 border-b-2 border-teal-400'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        <span>
          {tab === 'ausschreibungen' && 'Ausschreibungen'}
          {tab === 'bundles' && 'Projektbündel'}
          {tab === 'angebote' && 'Meine Angebote'}
          {tab === 'vertragsanbahnung' && 'Vertragsanbahnung'}
          {tab === 'auftraege' && 'Aufträge'}
          {tab === 'termine' && 'Terminplan'}
        </span>
        {badgeCount > 0 && (
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold min-w-[20px] text-center">
            {badgeCount}
          </span>
        )}
      </button>
    );
  })}
</div>

        {/* Content */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          
          {/* Ausschreibungen Tab */}
          {activeTab === 'ausschreibungen' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Passende Ausschreibungen</h2>
              
              {tenders.length === 0 ? (
                <p className="text-gray-400">Aktuell keine passenden Ausschreibungen verfügbar.</p>
              ) : (
                <div className="space-y-4">
                  {tenders.map((tender) => (
                    <div key={tender.id} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">
                              {tender.trade_name}
                            </h3>
                            <span className="text-sm bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                              {tender.category} - {tender.sub_category}
                            </span>
                            {/* Status Badge direkt inline */}
                            {tender.offer_status === 'submitted' && (
                              <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs">
                                ✓ Angebot abgegeben
                              </span>
                            )}
                            {tender.offer_status === 'preliminary' && (
                              <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs">
                                Vorläufig angeboten
                              </span>
                            )}
                            {tender.tender_status === 'in_progress' && !tender.offer_status && (
                              <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs">
                                In Bearbeitung
                              </span>
                            )}
                            {!tender.viewed_at && !tender.offer_status && (
                              <span className="bg-teal-500 text-white px-2 py-1 rounded-full text-xs">
                                NEU
                              </span>
                            )}
                          </div>
                          
                          <p className="text-gray-300 mb-2">{tender.project_description}</p>
                          
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div className="space-y-1">
                              <p className="text-sm text-gray-400">
                                📍 Ort: {tender.project_zip} {tender.project_city}
                              </p>
                              <p className="text-sm text-gray-400">
                                📅 Zeitraum: {tender.timeframe || 'Nach Absprache'}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm text-gray-400">
                                💰 Volumen: ca. {formatCurrency(Math.round(tender.estimated_value / 1000) * 1000)}
                              </p>
                              <p className="text-sm text-gray-400">
                                ⏰ Frist: {new Date(tender.deadline).toLocaleDateString('de-DE')}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          {!tender.offer_status ? (
                            <div className="flex gap-2">  
                              <button
  onClick={() => checkVerificationAndNavigate(() => handleOpenTender(tender))}
  className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:shadow-lg transform hover:scale-[1.02] transition-all"
>
                                <div>
                                  <div className="font-semibold">Angebot vorläufig abgeben</div>
                                  <div className="text-xs mt-1">Mit Vertragsanbahnung</div>
                                </div>
                              </button>
                              <button
                                onClick={() => handleRejectTender(tender.id)}
                                className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 rounded-lg transition-all"
                                title="Ausschreibung ablehnen"
                              >
                                ❌
                              </button>
                            </div>  
                          ) : (
                            <div>
                              <span className="block bg-green-500/20 text-green-400 px-3 py-2 rounded mb-2">
                                ✓ Angebot abgegeben
                              </span>
                              {tender.handwerker_status === 'preliminary' && (
                                <button
                                  onClick={() => handleOpenTender(tender)}
                                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
                                >
                                  Angebot anpassen
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Projektbündel Tab */}
          {activeTab === 'bundles' && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Verfügbare Projektbündel</h2>
    
    <div className="mb-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <span className="text-3xl">💡</span>
        <div>
          <h3 className="text-lg font-semibold text-green-300 mb-2">Vorteile von Projektbündeln:</h3>
          <ul className="text-green-200 text-sm space-y-1">
            <li>✓ Optimierte Fahrtrouten - weniger Fahrzeit zwischen Projekten</li>
            <li>✓ Höhere Auslastung durch mehrere Projekte gleichzeitig</li>
            <li>✓ Attraktive Bündelrabatte möglich - höhere Gewinnchancen</li>
            <li>✓ Bessere Planbarkeit durch gebündelte Aufträge</li>
          </ul>
        </div>
      </div>
    </div>
    
    {bundles.length === 0 ? (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-4xl">📦</span>
        </div>
        <p className="text-gray-400 text-lg mb-2">Aktuell keine Projektbündel verfügbar</p>
        <p className="text-gray-500 text-sm">
          Neue Bündel erscheinen automatisch, wenn mehrere Projekte in Ihrer Region ausgeschrieben werden
        </p>
      </div>
    ) : (
      <div className="space-y-6">
        {bundles.map((bundle) => {
          // Runde Volumen auf 500 Euro
          const roundedVolume = Math.round((bundle.totalVolume || 0) / 500) * 500;
          
          return (
            <div 
              key={bundle.id} 
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/20 overflow-hidden shadow-xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600/20 to-teal-600/20 p-6 border-b border-white/10">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      {bundle.trade} - Bündel
                    </h3>
                    <p className="text-gray-300 text-sm">Mehrere Projekte in Ihrer Region</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-4 py-2 bg-green-500/20 text-green-300 rounded-full font-semibold">
                      {bundle.projectCount} Projekte
                    </span>
                  </div>
                </div>
                
                {/* Kennzahlen */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Geschätztes Volumen</p>
                    <p className="text-2xl font-bold text-teal-400">
                      {formatCurrency(roundedVolume)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">ca. Netto (gerundet)</p>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Max. Entfernung</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {bundle.maxDistance} km
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Zwischen Projekten</p>
                  </div>
                  
                  <div className="bg-white/5 rounded-lg p-4">
                   <p className="text-gray-400 text-sm mb-1">Fahrzeit</p>
<p className="text-2xl font-bold text-purple-400">
  {bundle.totalTravelTime} Min.
</p>
<p className="text-xs text-gray-500 mt-1">Zwischen allen Projekten</p>
                  </div>
                </div>
              </div>
              
              {/* Projekte Liste */}
              <div className="p-6">
                <h4 className="text-lg font-semibold text-white mb-4">Enthaltene Projekte:</h4>
                <div className="space-y-3 mb-6">
                  {bundle.projects?.map((project, idx) => {
                    // Runde Projektvolumen auf 500 Euro
                    const roundedProjectVolume = Math.round((project.volume || 0) / 500) * 500;
                    
                    return (
                      <div 
                        key={idx} 
                        className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-teal-500/50 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center text-teal-300 font-bold text-sm">
                                {idx + 1}
                              </span>
                              <h5 className="text-white font-semibold">{project.type}</h5>
                            </div>
                            <p className="text-gray-400 text-sm mb-2">
                              📍 PLZ: {project.zip}
                            </p>
                            <div className="flex gap-4 text-sm">
                              <span className="text-gray-500">
                                💰 Volumen: <span className="text-teal-400 font-semibold">{formatCurrency(roundedProjectVolume)}</span>
                              </span>
                              <span className="text-gray-500">
                                ⏱️ Termin: <span className="text-white">{project.timeframe || 'Nach Absprache'}</span>
                              </span>
                            </div>
                          </div>
                          {project.deadline && (
                            <div className="text-right">
                              <p className="text-xs text-gray-500">Frist bis:</p>
                              <p className="text-sm text-orange-400 font-semibold">
                                {new Date(project.deadline).toLocaleDateString('de-DE')}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Hinweise */}
                <div className="space-y-3 mb-6">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-yellow-300 text-sm">
                      <strong>ℹ️ Hinweis:</strong> Genaue Adressen und Kontaktdaten werden nach vorläufiger Beauftragung freigegeben.
                    </p>
                  </div>
                  
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                    <p className="text-blue-300 text-sm">
                      <strong>💡 Tipp:</strong> Mit einem Bündelrabatt erhöhen Sie Ihre Chancen, alle Projekte zu erhalten. 
                      Die Bauherren sehen den Mehrwert der koordinierten Abwicklung.
                    </p>
                  </div>
                </div>
                
                {/* Action Button */}
                <button
  onClick={() => checkVerificationAndNavigate(() => navigate(`/handwerker/bundle/${bundle.id}/offer`))}
  className="w-full px-8 py-4 bg-gradient-to-r from-teal-500 to-blue-600 text-white text-lg font-bold rounded-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
>
                  🎯 Bündelangebot erstellen
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
)}

         {/* Meine Angebote Tab */}
{activeTab === 'angebote' && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Abgegebene Angebote</h2>
    
    {offers.length === 0 ? (
      <p className="text-gray-400">Sie haben noch keine Angebote abgegeben.</p>
    ) : (
      <div className="space-y-4">
        {offers.map((offer) => {
          
          return (
            <div key={offer.id} className="bg-white/5 rounded-lg p-6 hover:bg-white/10 transition-colors">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {/* Header mit Projekt-Info */}
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      {offer.projectType || offer.project_category}
                    </h3>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">
                        {offer.trade}
                      </span>
                      {offer.status === 'submitted' && (
                        <span className="text-sm bg-green-500/20 text-green-300 px-3 py-1 rounded-full">
                          ✓ Abgegeben
                        </span>
                      )}
                      {offer.status === 'preliminary' && (
                        <span className="text-sm bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full">
                          Vorläufig beauftragt
                        </span>
                      )}
                      {offer.status === 'confirmed' && (
                        <span className="text-sm bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">
                          Verbindlich bestätigt
                        </span>
                      )}
                      {offer.viewed_at && (
                        <span className="text-sm bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">
                          👁️ Eingesehen
                        </span>
                        )}
                        {offer.status === 'cancelled' && (
                        <span className="text-sm bg-red-500/20 text-red-300 px-3 py-1 rounded-full">
                          ❌ Ausschreibung zurückgezogen
                        </span>
                      )}
                    </div>
                  </div>
                  
          {/* Projekt-Details Grid */}
<div className="grid grid-cols-2 gap-4 mb-4">
  <div className="space-y-2">
    <div>
      <p className="text-xs text-gray-400">Standort</p>
      <p className="text-sm text-gray-300">📍 {offer.location}</p>
    </div>
    <div>
      <p className="text-xs text-gray-400">Abgabedatum</p>
      <p className="text-sm text-gray-300">
        📅 {offer.submittedDate 
          ? new Date(offer.submittedDate).toLocaleDateString('de-DE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            })
          : new Date(offer.created_at).toLocaleDateString('de-DE', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            })
        }
      </p>
    </div>
  </div>
  <div className="space-y-2">
    <div>
      <p className="text-xs text-gray-400">Ausführungszeit</p>
      <p className="text-sm text-gray-300">
        ⏱️ {offer.execution_time || offer.timeframe || 'Nach Absprache'}
      </p>
    </div>
    {offer.viewed_at && (
      <div>
        <p className="text-xs text-gray-400">Eingesehen am</p>
        <p className="text-sm text-gray-300">
          {new Date(offer.viewed_at).toLocaleDateString('de-DE')}
        </p>
      </div>
    )}
  </div>
</div>

{/* Angebotssumme */}
{(() => {
  // Berechne mit Rabatt
  const bundleDiscount = offer.bundle_discount || 0;
  const discountAmount = bundleDiscount > 0 ? (offer.amount * bundleDiscount / 100) : 0;
  const nettoAfterDiscount = offer.amount - discountAmount;
  const bruttoAmount = nettoAfterDiscount * 1.19;
  
  return (
    <div className="bg-white/10 rounded-lg p-4">
      <div className="space-y-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Netto</p>
          <p className="text-xl font-bold text-white">
            {formatCurrency(offer.amount)}
          </p>
        </div>
        
        {bundleDiscount > 0 && (
          <>
            <div className="border-t border-white/10 pt-2">
              <p className="text-xs text-green-400 mb-1">📦 Bündelrabatt ({bundleDiscount}%)</p>
              <p className="text-lg font-semibold text-green-400">
                - {formatCurrency(discountAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Netto nach Rabatt</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(nettoAfterDiscount)}
              </p>
            </div>
          </>
        )}
        
        <div className="border-t border-white/10 pt-2">
          <p className="text-xs text-gray-400 mb-1">Brutto (inkl. 19% MwSt)</p>
          <p className="text-xl font-bold text-teal-400">
            {formatCurrency(bruttoAmount)}
          </p>
        </div>
      </div>
    </div>
  );
})()}
                  
                  {/* Anmerkungen falls vorhanden */}
                  {offer.notes && (
                    <div className="mt-4 p-3 bg-white/5 rounded border border-white/10">
                      <p className="text-xs text-gray-400 mb-1">Ihre Anmerkungen:</p>
                      <p className="text-sm text-gray-300">{offer.notes}</p>
                    </div>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="ml-6 text-right space-y-2">
                  {offer.status === 'submitted' && (
                    <>
                      <button
                        onClick={() => navigate(`/handwerker/offer/${offer.id}/details`)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        📋 Details ansehen
                      </button>
                      <button
                        onClick={() => handleWithdrawOffer(offer.id)}
                        className="w-full px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/50 rounded-lg transition-colors text-sm"
                      >
                        ✏️ Angebot zurückziehen
                      </button>
                    </>
                  )}
                  
                  {offer.status === 'vorlaeufig_beauftragt' && (
                    <>
                      <span className="block text-xs bg-yellow-600 text-yellow-200 px-3 py-2 rounded mb-2">
                        Vorläufig beauftragt
                      </span>
                      <button
                        onClick={() => handleAcceptPreliminary(offer.id)}
                        className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                      >
                        Beauftragung annehmen
                      </button>
                      <button
                        onClick={() => navigate(`/handwerker/offer/${offer.id}/details`)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        📋 Details ansehen
                      </button>
                    </>
                  )}
                  
                  {offer.status === 'preliminary' && (
                    <>
                      <span className="block text-xs bg-yellow-600 text-yellow-200 px-3 py-2 rounded mb-2">
                        In Vertragsanbahnung
                      </span>
                      <button
                        onClick={() => navigate(`/handwerker/offer/${offer.id}/details`)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        📋 Details ansehen
                      </button>
                      <p className="text-xs text-gray-400 mt-2">
                        Warte auf Ortstermin und Bestätigung
                      </p>
                    </>
                  )}
                  
                  {offer.status === 'confirmed' && (
                    <>
                      <span className="block text-xs bg-green-600 text-green-200 px-3 py-2 rounded mb-2">
                        ✓ Verbindlich bestätigt
                      </span>
                      <button
                        onClick={() => navigate(`/handwerker/offer/${offer.id}/details`)}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                      >
                        📋 Details ansehen
                      </button>
                      <p className="text-xs text-gray-400 mt-2">
                        Warte auf finale Beauftragung
                      </p>
                    </>
                  )}
                  {/* Button zum Entfernen stornierter Angebote */}
                  {offer.status === 'cancelled' && (
                    <div className="space-y-3">
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <p className="text-xs text-red-300">
                          ⚠️ Der Bauherr hat diese Ausschreibung zurückgezogen. Ihr Angebot ist nicht mehr gültig.
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          if (!window.confirm('Möchten Sie dieses stornierte Angebot aus Ihrer Liste entfernen?')) {
                            return;
                          }
                          
                          try {
                            const res = await fetch(apiUrl(`/api/offers/${offer.id}/remove-cancelled`), {
                              method: 'DELETE'
                            });
                            
                            if (res.ok) {
                              alert('✅ Angebot wurde entfernt');
                              loadDashboardData(handwerkerData);
                            } else {
                              const error = await res.json();
                              alert('❌ Fehler: ' + (error.error || 'Unbekannter Fehler'));
                            }
                          } catch (err) {
                            console.error('Error removing cancelled offer:', err);
                            alert('❌ Fehler beim Entfernen des Angebots');
                          }
                        }}
                        className="w-full px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors text-sm flex items-center justify-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Angebot entfernen
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
    
    {/* ═══════════════════════════════════════════════════════════════ */}
    {/* NEU: Abgelehnte Angebote */}
    {/* ═══════════════════════════════════════════════════════════════ */}
    {notifications?.filter(n => n.type === 'offer_rejected').length > 0 && (
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span>❌ Abgelehnte Angebote</span>
          <span className="text-sm text-gray-400">
            ({notifications.filter(n => n.type === 'offer_rejected').length})
          </span>
        </h3>
        
        <div className="space-y-3">
          {notifications
            .filter(n => n.type === 'offer_rejected')
            .map((notification, idx) => {
              const metadata = typeof notification.metadata === 'string' 
                ? JSON.parse(notification.metadata) 
                : notification.metadata;
              
              return (
                <div 
                  key={idx} 
                  className={`bg-white/5 rounded-lg p-4 border ${
                    notification.read ? 'border-white/10' : 'border-red-500/30'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-white">
                          {metadata?.tradeName || 'Angebot'}
                        </h4>
                        {!notification.read && (
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                            NEU
                          </span>
                        )}
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <p className="text-gray-400">
                          📅 Abgelehnt am: {new Date(notification.created_at).toLocaleDateString('de-DE')}
                        </p>
                        <p className="text-gray-400">
                          💼 Projekt: {metadata?.projectCategory || 'N/A'}
                        </p>
                        {metadata?.amount && (
                          <p className="text-gray-400">
                            💰 Angebotssumme: {formatCurrency(metadata.amount)}
                          </p>
                        )}
                      </div>
                      
                      {/* Ablehnungsgrund */}
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded">
                        <p className="text-xs text-red-300 mb-1">Ablehnungsgrund:</p>
                        <p className="text-sm text-white">
                          {metadata?.reason || 'Nicht angegeben'}
                        </p>
                        {metadata?.notes && (
                          <>
                            <p className="text-xs text-red-300 mt-2 mb-1">Anmerkung:</p>
                            <p className="text-sm text-gray-300">{metadata.notes}</p>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {!notification.read && (
                      <button
                        onClick={async () => {
  await fetch(apiUrl(`/api/notifications/${notification.id}/mark-read`), {
    method: 'POST'
  });
  // Notifications neu laden - direkt hier ohne loadNotifications()
  try {
    const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/notifications`));
    if (res.ok) {
      const data = await res.json();
      setNotifications(data);
    }
  } catch (error) {
    console.error('Fehler beim Laden der Benachrichtigungen:', error);
  }
}}
                        className="ml-4 px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                      >
                        Als gelesen markieren
                      </button>
                    )}
                    {/* ✅ Delete Offer Button */}
<button
  onClick={async () => {
    try {
      await fetch(apiUrl(`/api/notifications/${notification.id}`), {
        method: 'DELETE'
      });
      // Reload notifications
      const res = await fetch(apiUrl(`/api/handwerker/${handwerkerData.id}/notifications`));
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }}
  className="ml-2 p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
  title="Eintrag entfernen"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
</button>                
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    )}
  </div>
)}

         {/* Vertragsanbahnung Tab */}
{activeTab === 'vertragsanbahnung' && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Vertragsanbahnungen</h2>
    
    <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
      <p className="text-yellow-300 text-sm">
        <strong>⚠️ Exklusivitätsvereinbarung:</strong> In dieser Phase hat der Bauherr Ihr Angebot ausgewählt und möchte Sie kennenlernen. 
        Während dieser exklusiven Verhandlungsphase sind weitere Angebote für dieses Gewerk in byndl gesperrt. Nutzen Sie die Zeit für Ortstermine und finale Abstimmungen. 
        Bitte beachten Sie auch die Regelungen zur zweistufigen Vergabe in unseren AGB.
      </p>
    </div>
    
    {contracts.length === 0 ? (
      <p className="text-gray-400">Keine laufenden Vertragsanbahnungen.</p>
    ) : (
      <div className="space-y-6">
        {contracts.map((contract, idx) => {
          const netto = parseFloat(contract.offer_amount) || 0;
          const bundleDiscount = contract.bundle_discount || 0;
          const discountAmount = bundleDiscount > 0 ? (netto * bundleDiscount / 100) : 0;
          const nettoAfterDiscount = netto - discountAmount;
          const brutto = nettoAfterDiscount * 1.19;
          
          return (
            <div key={idx} className="bg-white/5 rounded-lg p-6 border border-white/10">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {contract.trade_name}
                  </h3>
                  
                  {/* Projekt */}
                  <div className="mb-3 p-3 bg-blue-500/10 rounded">
                    <p className="text-blue-300 text-sm">
                      <strong>🏗️ Projekt:</strong> {contract.project_category} - {contract.project_sub_category}
                    </p>
                    <p className="text-blue-200 text-xs mt-1">
                      {contract.project_description}
                    </p>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="mt-2">
                    {contract.offer_status === 'preliminary' && !contract.offer_confirmed_at && (
                      <span className="inline-block px-3 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded-full">
                        ⏳ Angebot nach Besichtigung noch nicht bestätigt
                      </span>
                    )}
                    {contract.offer_status === 'confirmed' && (
                      <span className="inline-block px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">
                        ✓ Angebot bestätigt - Warte auf verbindliche Beauftragung
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-right ml-6">
  <p className="text-sm text-gray-400 mb-1">Angebotssumme</p>
  <p className="text-xl font-bold text-white">
    {formatCurrency(netto)}
  </p>
  <p className="text-sm text-gray-400">Netto</p>
  
  {bundleDiscount > 0 && (
    <>
      <div className="mt-2 pt-2 border-t border-white/20">
        <p className="text-xs text-green-400">📦 Bündelrabatt ({bundleDiscount}%)</p>
        <p className="text-sm font-semibold text-green-400">
          - {formatCurrency(discountAmount)}
        </p>
      </div>
      <div className="mt-1">
        <p className="text-sm text-gray-400">Netto nach Rabatt</p>
        <p className="text-lg font-bold text-white">
          {formatCurrency(nettoAfterDiscount)}
        </p>
      </div>
    </>
  )}
  
  <div className="mt-2 pt-2 border-t border-white/20">
    <p className="text-lg font-semibold text-teal-400">
      {formatCurrency(brutto)}
    </p>
    <p className="text-xs text-gray-400">Brutto (inkl. 19% MwSt.)</p>
  </div>
  
  <p className="text-xs text-gray-400 mt-3">
    Vertragsanbahnung seit:<br />
    <span className="text-white">
      {contract.preliminary_accepted_at 
        ? new Date(contract.preliminary_accepted_at).toLocaleDateString('de-DE')
        : 'N/A'}
    </span>
  </p>
</div>
              </div>
              
              {/* Kontaktdaten Bauherr */}
              <div className="bg-white/10 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold text-white mb-3">📞 Kontaktdaten Bauherr</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-gray-300">
                    <p><strong className="text-white">Name:</strong> {contract.bauherr_name || 'Nicht verfügbar'}</p>
                    <p className="mt-1"><strong className="text-white">Tel:</strong> {contract.bauherr_phone || 'Nicht verfügbar'}</p>
                  </div>
                  <div className="text-gray-300">
                    <p><strong className="text-white">E-Mail:</strong> {contract.bauherr_email || 'Nicht verfügbar'}</p>
                    <p className="mt-1"><strong className="text-white">Adresse:</strong> {contract.project_address || 'Nicht verfügbar'}</p>
                  </div>
                </div>
              </div>
              
              {/* Ausführungstermine (falls schon eingetragen) */}
              {contract.execution_start && contract.execution_end && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                  <p className="text-green-300 text-sm">
                    <strong>📅 Geplante Ausführung:</strong><br />
                    {new Date(contract.execution_start).toLocaleDateString('de-DE')} bis {new Date(contract.execution_end).toLocaleDateString('de-DE')}
                  </p>
                </div>
              )}
              
              {/* Aktionsbuttons */}
              <div className="flex flex-wrap gap-3">
                {/* 1. Ortstermin vereinbaren */}
                <button
                  onClick={() => navigate(`/ortstermin/${contract.offer_id}`)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  📅 Ortstermin vereinbaren
                </button>
                
                {/* 2. Angebot anpassen und bestätigen */}
                {contract.offer_status === 'preliminary' && !contract.offer_confirmed_at && (
                  <button
                    onClick={() => navigate(`/handwerker/offer/${contract.offer_id}/confirm`)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg font-semibold hover:shadow-xl transform hover:scale-[1.02] transition-all"
                  >
                    ✓ Angebot anpassen und bestätigen
                  </button>
                )}
                
                {/* Wartemeldung wenn bestätigt */}
                {contract.offer_status === 'confirmed' && (
                  <div className="flex-1 px-6 py-3 bg-green-500/20 border border-green-500/50 text-green-300 rounded-lg text-center">
                    ⏳ Warte auf verbindliche Beauftragung durch Bauherr
                  </div>
                )}
                
                {/* 3. Angebot zurückziehen */}
                <button
                  onClick={async () => {
                    if (!window.confirm('Möchten Sie dieses Angebot wirklich zurückziehen? Die Vertragsanbahnung wird beendet.')) return;
                    
                    try {
                      setLoading(true);
                      const res = await fetch(apiUrl(`/api/offers/${contract.offer_id}/withdraw`), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          reason: 'Handwerker zieht Angebot zurück'
                        })
                      });
                      
                      if (res.ok) {
                        alert('Angebot wurde zurückgezogen. Vertragsanbahnung beendet.');
                        loadDashboardData(handwerkerData); // Reload
                      } else {
                        throw new Error('Fehler beim Zurückziehen');
                      }
                    } catch (err) {
                      console.error('Error:', err);
                      alert('Fehler beim Zurückziehen des Angebots');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                >
                  ❌ Angebot zurückziehen
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
)}

         {activeTab === 'auftraege' && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Meine Aufträge</h2>
    
    {/* AKTIVE AUFTRÄGE */}
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">Aktive Aufträge</h3>
      {orders.filter(order => order.status !== 'completed').length === 0 ? (
        <div className="bg-white/10 backdrop-blur rounded-lg p-8 border border-white/20 text-center">
          <p className="text-gray-400 mb-4">Noch keine aktiven Aufträge erhalten.</p>
          <p className="text-gray-500 text-sm">
            Aufträge erscheinen hier, sobald ein Bauherr Ihr Angebot verbindlich beauftragt.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.filter(order => order.status !== 'completed').map((order, idx) => {
  // ✅ NEU: Verwende Totals inkl. Nachträge falls vorhanden
  const totals = orderTotals[order.id];
  
  const netto = totals ? totals.totalNetto : (parseFloat(order.amount) || 0);
  const bundleDiscount = order.bundle_discount || 0;
  const discountAmount = totals ? totals.discountAmount : (bundleDiscount > 0 ? (netto * bundleDiscount / 100) : 0);
  const nettoAfterDiscount = totals ? totals.nettoAfterDiscount : (netto - discountAmount);
  const mwst = totals ? totals.mwst : (nettoAfterDiscount * 0.19);
  const brutto = totals ? totals.totalBrutto : (nettoAfterDiscount + mwst);
  
  // ✅ NEU: Nachtrags-Info
  const nachtraegeSum = totals ? totals.nachtraegeSum : 0;
  const pendingNachtraege = totals ? totals.pendingCount : 0;
  const approvedNachtraege = totals ? totals.approvedCount : 0;
  
  return (
    <div key={idx} className="bg-white/5 rounded-lg p-6 border border-white/10">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xl font-semibold text-white">{order.trade_name}</h3>
            <span className="px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">
              Werkvertrag nach VOB/B
            </span>
            {/* ✅ NEU: Nachtrags-Badge */}
            {(approvedNachtraege > 0 || pendingNachtraege > 0) && (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded-full">
                {approvedNachtraege > 0 && `${approvedNachtraege} NT beauftragt`}
                {approvedNachtraege > 0 && pendingNachtraege > 0 && ' • '}
                {pendingNachtraege > 0 && `${pendingNachtraege} NT in Prüfung`}
              </span>
            )}
          </div>
          
          <p className="text-gray-300 mb-2">
            Auftraggeber: <strong>{order.bauherr_name}</strong>
          </p>
          
          <div className="flex gap-4 text-sm text-gray-400">
            <p>📋 Auftrags-Nr: <strong className="text-white">#{order.id}</strong></p>
            <p>📅 Erteilt: <strong className="text-white">{new Date(order.created_at).toLocaleDateString('de-DE')}</strong></p>
          </div>
          
          {/* Projektadresse */}
          <div className="mt-3 p-3 bg-blue-500/10 rounded">
            <p className="text-blue-300 text-sm">
              <strong>🏗️ Ausführungsort:</strong><br />
              {order.project_street} {order.project_house_number}<br />
              {order.project_zip} {order.project_city}
            </p>
          </div>
          
          {/* Ausführungstermine */}
          <div className="mt-3 p-3 bg-purple-500/10 rounded">
            <p className="text-purple-300 text-sm">
              <strong>📅 Ausführungszeitraum:</strong><br />
              {new Date(order.execution_start).toLocaleDateString('de-DE')} bis {new Date(order.execution_end).toLocaleDateString('de-DE')}
            </p>
          </div>
        </div>
        
        {/* Vergütung - ✅ ANGEPASST mit Nachträgen */}
        <div className="text-right ml-6">
          <p className="text-sm text-gray-400 mb-1">Auftragssumme</p>
          
          {/* Original ohne Nachträge */}
          <p className="text-lg font-semibold text-gray-300">
            {formatCurrency(parseFloat(order.amount) || 0)}
          </p>
          <p className="text-xs text-gray-400">Ursprungsauftrag (Netto)</p>
          
          {/* ✅ NEU: Nachträge anzeigen falls vorhanden */}
          {nachtraegeSum > 0 && (
            <div className="mt-2 pt-2 border-t border-white/20">
              <p className="text-xs text-teal-400">+ Nachträge</p>
              <p className="text-sm font-semibold text-teal-400">
                {formatCurrency(nachtraegeSum)}
              </p>
            </div>
          )}
          
          {bundleDiscount > 0 && (
            <>
              <div className="mt-2 pt-2 border-t border-white/20">
                <p className="text-xs text-green-400">📦 Bündelrabatt ({bundleDiscount}%)</p>
                <p className="text-sm font-semibold text-green-400">
                  - {formatCurrency(discountAmount)}
                </p>
              </div>
            </>
          )}
          
          {/* Gesamtsumme */}
          <div className="mt-2 pt-2 border-t border-white/20">
            <p className="text-xs text-gray-400">Gesamt Netto{nachtraegeSum > 0 ? ' (inkl. NT)' : ''}</p>
            <p className="text-xl font-bold text-white">
              {formatCurrency(netto)}
            </p>
          </div>
          
          <div className="mt-2 pt-2 border-t border-white/20">
            <p className="text-sm text-gray-400">zzgl. 19% MwSt.</p>
            <p className="text-2xl font-bold text-teal-400">
              {formatCurrency(brutto)}
            </p>
            <p className="text-xs text-gray-400">Brutto</p>
          </div>
          
          {/* Status Badge */}
          <span className={`mt-3 text-xs px-3 py-1 rounded inline-block ${
            order.status === 'active' ? 'bg-blue-600 text-blue-200' :
            order.status === 'completed' ? 'bg-green-600 text-green-200' :
            order.status === 'in_progress' ? 'bg-yellow-600 text-yellow-200' :
            'bg-gray-600 text-gray-300'
          }`}>
            {order.status === 'active' ? '🔧 In Ausführung' :
             order.status === 'completed' ? '✅ Abgeschlossen' :
             order.status === 'in_progress' ? '⚙️ In Bearbeitung' :
             order.status}
          </span>
        </div>
      </div>
      
      {/* Kontaktdaten Bauherr */}
      <div className="bg-white/10 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-white mb-3">📞 Kontaktdaten Auftraggeber</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="text-gray-300">
            <p><strong className="text-white">Name:</strong> {order.bauherr_name || order.clientName || 'Nicht verfügbar'}</p>
            <p className="mt-1"><strong className="text-white">Tel:</strong> {order.bauherr_phone || order.clientPhone || 'Nicht verfügbar'}</p>
          </div>
          <div className="text-gray-300">
            <p><strong className="text-white">E-Mail:</strong> {order.bauherr_email || order.clientEmail || 'Nicht verfügbar'}</p>
            <p className="mt-1"><strong className="text-white">Adresse:</strong> {order.project_street} {order.project_house_number}, {order.project_zip} {order.project_city}</p>
          </div>
        </div>
      </div>
      
      {/* Werkvertrag-Aktionen - ✅ MIT NACHTRAGS-BUTTONS */}
      <div className="border-t border-white/10 pt-4 mt-4">
        <div className="flex gap-3 flex-wrap">
          {/* PDF Export */}
          <button
            onClick={() => window.open(apiUrl(`/api/orders/${order.id}/contract-pdf`), '_blank')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Werkvertrag als PDF
          </button>
          
          {/* Vertrag ansehen */}
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
          
          {/* LV Details */}
          <button
            onClick={() => navigate(`/handwerker/order/${order.id}/lv-details`)}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            LV-Details ansehen
          </button>
          
          {/* ✅ NEU: Nachtrag einreichen */}
          <button
            onClick={() => navigate(`/handwerker/auftrag/${order.id}/nachtrag/neu`)}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nachtrag einreichen
          </button>
          
          {/* ✅ NEU: Eingereichte Nachträge (nur wenn Nachträge existieren) */}
          {(approvedNachtraege > 0 || pendingNachtraege > 0) && (
            <button
              onClick={() => navigate(`/handwerker/auftrag/${order.id}/nachtraege`)}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Eingereichte Nachträge ({approvedNachtraege + pendingNachtraege})
            </button>
          )}
        </div>
      </div>
      
      {/* Status-Infos */}
      {order.status === 'active' && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded">
          <p className="text-blue-300 text-sm">
            <strong>ℹ️ Status:</strong> Auftrag in Ausführung. Nach Fertigstellung erfolgt die Abnahme durch den Bauherrn.
          </p>
        </div>
      )}
      
      {/* Anmerkungen */}
      {order.notes && (
        <div className="mt-4 p-3 bg-white/5 rounded">
          <p className="text-gray-400 text-xs mb-1">Anmerkungen:</p>
          <p className="text-gray-300 text-sm">{order.notes}</p>
        </div>
      )}
    </div>
  );
})}
        </div>
      )}
    </div>

    {/* ABGESCHLOSSENE AUFTRÄGE */}
    <div className="mt-8 pt-8 border-t border-white/20">
      <h3 className="text-lg font-semibold text-white mb-4">Abgeschlossene Aufträge</h3>
      {orders.filter(order => order.status === 'completed').length === 0 ? (
        <div className="bg-white/10 backdrop-blur rounded-lg p-6 border border-white/20 text-center">
          <p className="text-gray-400">Noch keine abgeschlossenen Aufträge</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.filter(order => order.status === 'completed').map((order, idx) => {
            const netto = parseFloat(order.amount) || 0;
            const bundleDiscount = order.bundle_discount || 0;
            const discountAmount = bundleDiscount > 0 ? (netto * bundleDiscount / 100) : 0;
            const nettoAfterDiscount = netto - discountAmount;
            const brutto = nettoAfterDiscount * 1.19;
            
            return (
              <div key={idx} className="bg-white/5 rounded-lg p-5 border border-white/10 opacity-60 cursor-not-allowed">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-300">{order.trade_name}</h3>
                      <span className="text-sm text-gray-500">#{order.id}</span>
                      <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-300 rounded">
                        ✓ Abgeschlossen
                      </span>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-400">
                      <div>
                        <span className="text-gray-500">Abnahme:</span> {new Date(order.accepted_at || order.updated_at).toLocaleDateString('de-DE')}
                      </div>
                      <div>
                        <span className="text-gray-500">Bauherr:</span> {order.bauherr_name}
                      </div>
                      <div>
                        <span className="text-gray-500">Ort:</span> {order.project_zip} {order.project_city}
                      </div>
                    </div>
                    
                    {/* Gewährleistungshinweis - HIER RICHTIG PLATZIERT */}
                    {order.accepted_at && (
                      <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded">
                        <p className="text-green-300 text-xs">
                          <strong>✅ Gewährleistung:</strong> {order.warranty_period || 4} Jahre bis {new Date(new Date(order.accepted_at).setFullYear(new Date(order.accepted_at).getFullYear() + (order.warranty_period || 4))).toLocaleDateString('de-DE')}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Schlussrechnung</p>
                    <p className="text-xl font-bold text-green-400">{formatCurrency(brutto)}</p>
                    <p className="text-xs text-gray-500">Brutto</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
)}

          {/* Terminplan Tab */}
{activeTab === 'termine' && (
  <HandwerkerScheduleTab
    handwerkerId={handwerkerData.id}
    apiUrl={apiUrl}
  />
)}
  </div>  
</div>
      
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

   {/* Verifizierungs-Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-lg w-full border border-white/20 shadow-2xl">
            <div className="text-center">
              {/* Icon */}
              <div className="mb-6">
                <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-5xl">⏳</span>
                </div>
              </div>
              
              {/* Titel */}
              <h3 className="text-2xl font-bold text-white mb-3">
                Verifizierung ausstehend
              </h3>
              
              {/* Beschreibung */}
              <p className="text-gray-300 mb-6 text-lg">
                Ihr Account wird derzeit von unserem Team geprüft. Sie können erst Angebote erstellen, 
                nachdem die Verifizierung abgeschlossen ist.
              </p>
              
              {/* Info Box */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-5 mb-6 text-left">
                <p className="text-blue-300 text-sm">
                  <strong className="text-blue-200 text-base">ℹ️ Was wird geprüft?</strong>
                </p>
                <ul className="mt-3 space-y-2 text-blue-200 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Gewerbeschein / Gewerbeanmeldung</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Handwerkskarte / Meisterbrief / Qualifikationen</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>Kontaktdaten und Firmendaten</span>
                  </li>
                </ul>
                <div className="mt-4 pt-4 border-t border-blue-500/30">
                  <p className="text-blue-200 text-sm">
                    ⏱️ Die Prüfung dauert in der Regel <strong>1-2 Werktage</strong>.
                  </p>
                </div>
              </div>
              
              {/* Status Info */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <p className="text-yellow-200 text-sm">
                  Sie erhalten eine E-Mail, sobald Ihr Account verifiziert wurde.
                </p>
              </div>
              
              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowVerificationModal(false)}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-600 hover:to-blue-700 text-white rounded-lg font-semibold transition-all transform hover:scale-[1.02]"
                >
                  Verstanden
                </button>
                <button
                  onClick={() => {
                    setShowVerificationModal(false);
                    setActiveTab('einstellungen'); // Navigiere zu Einstellungen
                  }}
                  className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold transition-all border border-white/20"
                >
                  Zu Einstellungen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}         
