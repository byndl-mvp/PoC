import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

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
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [tenders, setTenders] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [offers, setOffers] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [schedule, setSchedule] = useState([]); // eslint-disable-line no-unused-vars

  useEffect(() => {
    const storedData = sessionStorage.getItem('handwerkerData');
    if (!storedData) {
      navigate('/handwerker/login');
      return;
    }
    
    const data = JSON.parse(storedData);
    setHandwerkerData(data);
    loadDashboardData(data);
  }, [navigate]);
  
  const loadDashboardData = async (handwerker) => {
    try {
      setLoading(true);

      // Lade verfügbare Ausschreibungen
const tendersRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/tenders/new`));
if (tendersRes.ok) {
  const tendersData = await tendersRes.json();
  // Filtere nur doppelte Einträge und final beauftragte
  const uniqueTenders = tendersData.filter((tender, index, self) =>
    index === self.findIndex((t) => t.id === tender.id) &&
    tender.offer_status !== 'accepted' &&
    tender.offer_status !== 'final_accepted' &&
    tender.offer_status !== 'preliminary' &&
    tender.offer_status !== 'confirmed' &&
    tender.status !== 'rejected'
  );
  setTenders(uniqueTenders);
}
      
      // Lade verfügbare Bündel
      const bundlesRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/bundles`));
      if (bundlesRes.ok) {
        const bundlesData = await bundlesRes.json();
        setBundles(bundlesData);
      }
      
      // Lade abgegebene Angebote
      const offersRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/offers`));
      if (offersRes.ok) {
        const offersData = await offersRes.json();
        setOffers(offersData);
      }
      
      // Lade Vertragsanbahnungen
      const contractsRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/contracts`));
      if (contractsRes.ok) {
        const contractsData = await contractsRes.json();
        setContracts(contractsData);
      }
      
      // Lade erteilte Aufträge
      const ordersRes = await fetch(apiUrl(`/api/handwerker/${handwerker.id}/orders`));
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData);
      }
      
    } catch (err) {
      console.error('Fehler beim Laden der Dashboard-Daten:', err);
    } finally {
      setLoading(false);
    }
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

  const handleConfirmOffer = async (contractId) => {
    if (!window.confirm('Bestätigen Sie Ihr Angebot nach der Besichtigung? Dies ermöglicht die verbindliche Beauftragung.')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/contracts/${contractId}/confirm-offer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        alert('Angebot bestätigt! Der Bauherr kann nun verbindlich beauftragen.');
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

  const handleLogout = () => {
    sessionStorage.removeItem('handwerkerData');
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
              <div className="text-right">
                <p className="text-white font-semibold">{handwerkerData?.companyName}</p>
                <p className="text-gray-400 text-xs">ID: {handwerkerData?.companyId}</p>
              </div>
              <div className="text-gray-400 text-sm">
                Region: {handwerkerData?.region} | Radius: {handwerkerData?.actionRadius} km
              </div>
              <Link 
                to="/handwerker/settings" 
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
              >
                ⚙️ Einstellungen
              </Link>
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
            <p className="text-2xl font-bold text-teal-400">{tenders.filter(t => t.isNew).length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <p className="text-gray-400 text-sm">Verfügbare Bündel</p>
            <p className="text-2xl font-bold text-blue-400">{bundles.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <p className="text-gray-400 text-sm">In Vertragsanbahnung</p>
            <p className="text-2xl font-bold text-yellow-400">{contracts.length}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <p className="text-gray-400 text-sm">Aktive Aufträge</p>
            <p className="text-2xl font-bold text-green-400">{orders.filter(o => o.status === 'aktiv').length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-white/20 overflow-x-auto">
          {['ausschreibungen', 'bundles', 'angebote', 'vertragsanbahnung', 'auftraege', 'termine'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'text-teal-400 border-b-2 border-teal-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab === 'ausschreibungen' && 'Ausschreibungen'}
              {tab === 'bundles' && 'Projektbündel'}
              {tab === 'angebote' && 'Meine Angebote'}
              {tab === 'vertragsanbahnung' && 'Vertragsanbahnung'}
              {tab === 'auftraege' && 'Aufträge'}
              {tab === 'termine' && 'Terminplan'}
            </button>
          ))}
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
                                onClick={() => handleOpenTender(tender)}
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
              
              <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-300 text-sm">
                  <strong>💡 Vorteil:</strong> Bei Bündeln können Sie effizientere Preise anbieten und Ihre Fahrtwege optimieren.
                </p>
              </div>
              
              {bundles.length === 0 ? (
                <p className="text-gray-400">Aktuell keine Bündel in Ihrer Region verfügbar.</p>
              ) : (
                <div className="space-y-4">
                  {bundles.map((bundle) => (
                    <div key={bundle.id} className="bg-gradient-to-r from-blue-600/10 to-teal-600/10 rounded-lg p-6 border border-white/20">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-white mb-2">
                            {bundle.trade}-Bündel {bundle.region}
                          </h3>
                          <span className="bg-green-500/20 text-green-300 text-sm px-3 py-1 rounded-full">
                            {bundle.projectCount} Projekte | Gesamtvolumen: {bundle.totalVolume?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-400">Maximale Fahrtstrecke:</p>
                          <p className="text-lg font-bold text-white">{bundle.maxDistance} km</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        {bundle.projects?.map((project, idx) => (
                          <div key={idx} className="bg-white/5 rounded p-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="text-white font-medium">Projekt {idx + 1}: {project.type}</p>
                                <p className="text-sm text-gray-400">📍 {project.address} | 💰 {project.volume?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                              </div>
                              <input type="checkbox" className="w-5 h-5" defaultChecked />
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex gap-4">
                        <button className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:from-teal-600 hover:to-blue-700 transition-all">
                          Für alle Projekte anbieten
                        </button>
                        <button className="px-4 py-2 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all">
                          Individuell auswählen
                        </button>
                      </div>
                    </div>
                  ))}
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
          // Berechne Brutto (19% MwSt)
          const bruttoAmount = offer.amount * 1.19;
          
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
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Netto</p>
                        <p className="text-xl font-bold text-teal-400">
                          {formatCurrency(offer.amount)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Brutto (inkl. 19% MwSt)</p>
                        <p className="text-xl font-bold text-white">
                          {formatCurrency(bruttoAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
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
                  
                  {/* WICHTIG: Hier die Funktion verwenden! */}
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
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
)}

          {/* Vertragsanbahnung Tab */}
{activeTab === 'contracts' && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Vertragsanbahnungen</h2>
    
    <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
      <p className="text-yellow-300 text-sm">
        <strong>⚠️ Exklusivitätsvereinbarung:</strong> In dieser Phase haben Sie exklusiven Kontakt zum Bauherren. 
        Die Nachwirkfrist von 24 Monaten ist aktiv. Nutzen Sie die Zeit für Ortstermine und finale Abstimmungen.
      </p>
    </div>
    
    {tenders.filter(t => t.offer_status === 'preliminary' || t.offer_status === 'confirmed').length === 0 ? (
      <p className="text-gray-400">Keine laufenden Vertragsanbahnungen.</p>
    ) : (
      <div className="space-y-6">
        {tenders.filter(t => t.offer_status === 'preliminary' || t.offer_status === 'confirmed').map((tender, idx) => {
          const netto = parseFloat(tender.offer_amount) || 0;
          const brutto = netto * 1.19;
          
          return (
            <div key={idx} className="bg-white/5 rounded-lg p-6 border border-white/10">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {tender.trade_name}
                  </h3>
                  
                  {/* Projekt */}
                  <div className="mb-3 p-3 bg-blue-500/10 rounded">
                    <p className="text-blue-300 text-sm">
                      <strong>🏗️ Projekt:</strong> {tender.project_category} - {tender.project_sub_category}
                    </p>
                    <p className="text-blue-200 text-xs mt-1">
                      {tender.project_description}
                    </p>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="mt-2">
                    {tender.offer_status === 'preliminary' && !tender.offer_confirmed_at && (
                      <span className="inline-block px-3 py-1 bg-yellow-500/20 text-yellow-300 text-sm rounded-full">
                        ⏳ Angebot nach Besichtigung noch nicht bestätigt
                      </span>
                    )}
                    {tender.offer_status === 'confirmed' && (
                      <span className="inline-block px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">
                        ✓ Angebot bestätigt - Warte auf verbindliche Beauftragung
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-right ml-6">
                  <p className="text-sm text-gray-400 mb-1">Angebotssumme</p>
                  <p className="text-xl font-bold text-teal-400">
                    {formatCurrency(netto)}
                  </p>
                  <p className="text-sm text-gray-400">Netto</p>
                  <p className="text-lg font-semibold text-white mt-1">
                    {formatCurrency(brutto)}
                  </p>
                  <p className="text-xs text-gray-400">Brutto (inkl. 19% MwSt.)</p>
                  
                  <p className="text-xs text-gray-400 mt-3">
                    Vertragsanbahnung seit:<br />
                    <span className="text-white">
                      {tender.preliminary_accepted_at 
                        ? new Date(tender.preliminary_accepted_at).toLocaleDateString('de-DE')
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
                    <p><strong className="text-white">Name:</strong> {tender.bauherr_name || 'Nicht verfügbar'}</p>
                    <p className="mt-1"><strong className="text-white">Tel:</strong> {tender.bauherr_phone || 'Nicht verfügbar'}</p>
                  </div>
                  <div className="text-gray-300">
                    <p><strong className="text-white">E-Mail:</strong> {tender.bauherr_email || 'Nicht verfügbar'}</p>
                    <p className="mt-1"><strong className="text-white">Adresse:</strong> {tender.project_address || 'Nicht verfügbar'}</p>
                  </div>
                </div>
              </div>
              
              {/* Ausführungstermine (falls schon eingetragen) */}
              {tender.execution_start && tender.execution_end && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                  <p className="text-green-300 text-sm">
                    <strong>📅 Geplante Ausführung:</strong><br />
                    {new Date(tender.execution_start).toLocaleDateString('de-DE')} bis {new Date(tender.execution_end).toLocaleDateString('de-DE')}
                  </p>
                </div>
              )}
              
              {/* Aktionsbuttons */}
              <div className="flex flex-wrap gap-3">
                {/* 1. Ortstermin vereinbaren */}
                <button
                  onClick={() => navigate(`/ortstermin/${tender.offer_id}`)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  📅 Ortstermin vereinbaren
                </button>
                
                {/* 2. Angebot anpassen und bestätigen */}
                {tender.offer_status === 'preliminary' && !tender.offer_confirmed_at && (
                  <button
                    onClick={() => navigate(`/handwerker/offer/${tender.offer_id}/confirm`)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg font-semibold hover:shadow-xl transform hover:scale-[1.02] transition-all"
                  >
                    ✓ Angebot anpassen und bestätigen
                  </button>
                )}
                
                {/* Wartemeldung wenn bestätigt */}
                {tender.offer_status === 'confirmed' && (
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
                      const res = await fetch(apiUrl(`/api/offers/${tender.offer_id}/withdraw`), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          reason: 'Handwerker zieht Angebot zurück'
                        })
                      });
                      
                      if (res.ok) {
                        alert('Angebot wurde zurückgezogen. Vertragsanbahnung beendet.');
                        loadTenders(); // Reload
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

         {/* Aufträge Tab - MIT WERKVERTRAG */}
{activeTab === 'orders' && (
  <div>
    <h2 className="text-2xl font-bold text-white mb-6">Erteilte Aufträge / Werkverträge</h2>
    
    {orders.length === 0 ? (
      <p className="text-gray-400">Noch keine Aufträge erteilt.</p>
    ) : (
      <div className="space-y-6">
        {orders.map((order, idx) => (
          <div key={idx} className="bg-white/5 rounded-lg p-6 border border-white/10">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-white">{order.tradeName}</h3>
                  <span className="px-3 py-1 bg-green-500/20 text-green-300 text-sm rounded-full">
                    Werkvertrag nach VOB/B
                  </span>
                </div>
                <p className="text-gray-300 mb-2">{order.companyName}</p>
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
              
              <div className="text-right ml-6">
                <p className="text-2xl font-bold text-green-400 mb-2">
                  {order.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </p>
                <p className="text-xs text-gray-400 mb-2">Netto</p>
                <span className={`text-xs px-3 py-1 rounded inline-block ${
                  order.status === 'active' ? 'bg-blue-600 text-blue-200' :
                  order.status === 'completed' ? 'bg-green-600 text-green-200' :
                  'bg-gray-600 text-gray-300'
                }`}>
                  {order.status === 'active' ? 'In Ausführung' :
                   order.status === 'completed' ? 'Abgeschlossen' :
                   order.status}
                </span>
              </div>
            </div>
            
            {/* Werkvertrag-Aktionen */}
            <div className="border-t border-white/10 pt-4 mt-4">
              <div className="flex gap-3">
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
                  onClick={() => {
                    // Modal mit Vertragstext öffnen
                    alert('Vertragsansicht wird geöffnet...');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  📋 Vertrag ansehen
                </button>
                
                {order.status === 'active' && (
                  <button
                    onClick={async () => {
                      if (!window.confirm('Möchten Sie die Leistung abnehmen? Dies bestätigt die ordnungsgemäße Ausführung.')) return;
                      
                      try {
                        const res = await fetch(apiUrl(`/api/orders/${order.id}/accept-completion`), {
                          method: 'POST'
                        });
                        
                        if (res.ok) {
                          alert('Leistung abgenommen. Gewährleistungsfrist beginnt.');
                          loadProjectDetails(selectedProject.id);
                        }
                      } catch (err) {
                        console.error('Error:', err);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    ✓ Leistung abnehmen
                  </button>
                )}
              </div>
            </div>
            
            {/* Gewährleistungshinweis */}
            {order.status === 'completed' && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded">
                <p className="text-yellow-300 text-sm">
                  <strong>⚠️ Gewährleistung:</strong> {order.warranty_period || 4} Jahre ab Abnahme
                  {order.accepted_at && ` (bis ${new Date(new Date(order.accepted_at).setFullYear(new Date(order.accepted_at).getFullYear() + (order.warranty_period || 4))).toLocaleDateString('de-DE')})`}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}

          {/* Terminplan Tab */}
          {activeTab === 'termine' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Terminübersicht</h2>
              
              <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                  <strong>ℹ️ Info:</strong> Die KI optimiert Ihre Termine automatisch bei gebündelten Projekten.
                </p>
              </div>
              
              <div className="grid gap-4">
                {[...Array(4)].map((_, weekOffset) => {
                  const weekNumber = getWeek(new Date()) + weekOffset;
                  const weekOrders = orders.filter(o => o.executionWeek === weekNumber);
                  
                  return (
                    <div key={weekOffset} className="bg-white/5 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="text-white font-semibold">KW {weekNumber}/2025</h3>
                        <span className="text-sm text-gray-400">
                          {weekOrders.length} Aufträge
                        </span>
                      </div>
                      {weekOrders.length > 0 ? (
                        <div className="space-y-2">
                          {weekOrders.map((order, idx) => (
                            <div key={idx} className="bg-white/10 rounded p-2">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-white text-sm">{order.trade}</p>
                                  <p className="text-gray-400 text-xs">{order.projectAddress}</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  order.isBundle ? 'bg-blue-600 text-blue-200' : 'bg-gray-600 text-gray-300'
                                }`}>
                                  {order.isBundle ? 'Bündel' : 'Einzel'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">Keine Termine</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function for week number
const getWeek = (date) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
};
