import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

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
  const [schedule, setSchedule] = useState([]);
  
  // Modal states
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedTender, setSelectedTender] = useState(null);
  const [offerData, setOfferData] = useState({
    amount: '',
    executionTime: '',
    notes: '',
    bundleDiscount: 0,
    includeMaterial: true,
    includeAnfahrt: true
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
  }, [navigate]);

  const loadDashboardData = async (handwerker) => {
    try {
      setLoading(true);
      
      // Lade Ausschreibungen passend zu Gewerken und Region
      const tendersRes = await fetch(apiUrl(`/api/handwerker/${handwerker.companyId}/tenders`));
      if (tendersRes.ok) {
        const tendersData = await tendersRes.json();
        setTenders(tendersData);
      }
      
      // Lade verfügbare Bündel
      const bundlesRes = await fetch(apiUrl(`/api/handwerker/${handwerker.companyId}/bundles`));
      if (bundlesRes.ok) {
        const bundlesData = await bundlesRes.json();
        setBundles(bundlesData);
      }
      
      // Lade abgegebene Angebote
      const offersRes = await fetch(apiUrl(`/api/handwerker/${handwerker.companyId}/offers`));
      if (offersRes.ok) {
        const offersData = await offersRes.json();
        setOffers(offersData);
      }
      
      // Lade Vertragsanbahnungen
      const contractsRes = await fetch(apiUrl(`/api/handwerker/${handwerker.companyId}/contracts`));
      if (contractsRes.ok) {
        const contractsData = await contractsRes.json();
        setContracts(contractsData);
      }
      
      // Lade erteilte Aufträge
      const ordersRes = await fetch(apiUrl(`/api/handwerker/${handwerker.companyId}/orders`));
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

  const handleSubmitOffer = async () => {
    if (!selectedTender || !offerData.amount || !offerData.executionTime) {
      alert('Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(apiUrl('/api/offers/create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenderId: selectedTender.id,
          handwerkerId: handwerkerData.companyId,
          ...offerData,
          timestamp: new Date().toISOString()
        })
      });

      if (res.ok) {
        alert('Angebot erfolgreich abgegeben!');
        setShowOfferModal(false);
        setOfferData({
          amount: '',
          executionTime: '',
          notes: '',
          bundleDiscount: 0,
          includeMaterial: true,
          includeAnfahrt: true
        });
        loadDashboardData(handwerkerData);
      }
    } catch (err) {
      console.error('Fehler beim Abgeben des Angebots:', err);
      alert('Fehler beim Abgeben des Angebots.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptPreliminary = async (contractId) => {
    if (!confirm('Möchten Sie die vorläufige Beauftragung annehmen? Die Kontaktdaten werden freigegeben.')) {
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
    if (!confirm('Bestätigen Sie Ihr Angebot nach der Besichtigung? Dies ermöglicht die verbindliche Beauftragung.')) {
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
    if (!confirm('Möchten Sie Ihr Angebot wirklich zurückziehen?')) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/offers/${offerId}/withdraw`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (res.ok) {
        alert('Angebot zurückgezogen.');
        loadDashboardData(handwerkerData);
      }
    } catch (err) {
      console.error('Fehler:', err);
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
              <div className="text-gray-300">
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
                </svg>
                {handwerkerData?.companyName}
              </div>
              <div className="text-gray-400 text-sm">
                Region: {handwerkerData?.region} | Radius: {handwerkerData?.actionRadius} km
              </div>
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
              
              <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <p className="text-blue-300 text-sm">
                  <strong>ℹ️ Tipp:</strong> Diese Ausschreibungen passen zu Ihren Gewerken, Ihrer Region und Ihrem Aktionsradius.
                </p>
              </div>
              
              {tenders.length === 0 ? (
                <p className="text-gray-400">Aktuell keine passenden Ausschreibungen verfügbar.</p>
              ) : (
                <div className="space-y-4">
                  {tenders.map((tender) => (
                    <div key={tender.id} className="bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">{tender.trade}</h3>
                            {tender.isNew && (
                              <span className="bg-teal-500 text-white text-xs px-2 py-1 rounded">NEU</span>
                            )}
                            {tender.isBundle && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">BÜNDEL</span>
                            )}
                          </div>
                          <p className="text-gray-300">{tender.projectType}</p>
                          <p className="text-sm text-gray-400 mt-1">
                            📍 {tender.location} | {tender.distance} km entfernt
                          </p>
                          <p className="text-sm text-gray-400">
                            📅 Ausführung: {tender.executionDate}
                          </p>
                          <p className="text-sm text-gray-400">
                            💰 Geschätztes Volumen: {tender.estimatedVolume?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <button
                            onClick={() => {
                              setSelectedTender(tender);
                              setShowOfferModal(true);
                            }}
                            className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
                          >
                            Angebot abgeben
                          </button>
                          <p className="text-xs text-gray-400 mt-2">
                            Frist: {new Date(tender.deadline).toLocaleDateString('de-DE')}
                          </p>
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
                  {offers.map((offer) => (
                    <div key={offer.id} className="bg-white/5 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white">{offer.trade}</h3>
                          <p className="text-gray-300">{offer.projectType} - {offer.location}</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Abgegeben: {new Date(offer.submittedDate).toLocaleDateString('de-DE')}
                          </p>
                          <p className="text-teal-400 font-bold mt-2">
                            {offer.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </p>
                        </div>
                        <div className="text-right">
                          {offer.status === 'offen' && (
                            <>
                              <span className="block text-xs bg-gray-600 text-gray-200 px-2 py-1 rounded mb-2">
                                Warte auf Antwort
                              </span>
                              <button
                                onClick={() => handleWithdrawOffer(offer.id)}
                                className="text-red-400 hover:text-red-300 text-sm"
                              >
                                Zurückziehen
                              </button>
                            </>
                          )}
                          {offer.status === 'eingesehen' && (
                            <span className="block text-xs bg-blue-600 text-blue-200 px-2 py-1 rounded">
                              Vom Bauherren eingesehen
                            </span>
                          )}
                          {offer.status === 'vorläufig_beauftragt' && (
                            <button
                              onClick={() => handleAcceptPreliminary(offer.id)}
                              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                            >
                              Vorläufige Beauftragung annehmen
                            </button>
                          )}
                          {offer.status === 'abgelehnt' && (
                            <span className="block text-xs bg-red-600 text-red-200 px-2 py-1 rounded">
                              Abgelehnt
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

          {/* Vertragsanbahnung Tab */}
          {activeTab === 'vertragsanbahnung' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Vertragsanbahnungen</h2>
              
              <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <p className="text-yellow-300 text-sm">
                  <strong>⚠️ Exklusivitätsvereinbarung:</strong> In dieser Phase haben Sie exklusiven Kontakt zum Bauherren. 
                  Die Nachwirkfrist von 24 Monaten ist aktiv. Nutzen Sie die Zeit für Ortstermine und finale Abstimmungen.
                </p>
              </div>
              
              {contracts.length === 0 ? (
                <p className="text-gray-400">Keine laufenden Vertragsanbahnungen.</p>
              ) : (
                <div className="space-y-4">
                  {contracts.map((contract) => (
                    <div key={contract.id} className="bg-white/5 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white">{contract.trade}</h3>
                          <p className="text-gray-300">{contract.projectType}</p>
                          <div className="mt-3 bg-white/10 rounded p-3">
                            <p className="text-sm text-white font-medium mb-2">Kontaktdaten Bauherr:</p>
                            <p className="text-sm text-gray-300">
                              Name: {contract.clientName}<br />
                              Tel: {contract.clientPhone}<br />
                              E-Mail: {contract.clientEmail}<br />
                              Adresse: {contract.projectAddress}
                            </p>
                          </div>
                          <p className="text-sm text-gray-400 mt-3">
                            Vertragsanbahnung seit: {new Date(contract.preliminaryDate).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-teal-400 mb-3">
                            {contract.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </p>
                          {!contract.offerConfirmed ? (
                            <div className="space-y-2">
                              <button
                                onClick={() => handleConfirmOffer(contract.id)}
                                className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                              >
                                Angebot nach Besichtigung bestätigen
                              </button>
                              <button className="w-full px-4 py-2 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all text-sm">
                                Angebot anpassen
                              </button>
                              <button className="w-full px-4 py-2 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors text-sm">
                                Angebot zurückziehen
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <span className="block bg-green-600 text-green-200 text-sm px-3 py-2 rounded">
                                ✓ Angebot bestätigt
                              </span>
                              <p className="text-xs text-gray-400">
                                Warte auf verbindliche Beauftragung
                              </p>
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

          {/* Aufträge Tab */}
          {activeTab === 'auftraege' && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Erteilte Aufträge</h2>
              
              {orders.length === 0 ? (
                <p className="text-gray-400">Noch keine Aufträge erteilt.</p>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="bg-white/5 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-white">{order.trade}</h3>
                          <p className="text-gray-300">{order.projectType} - {order.clientName}</p>
                          <p className="text-sm text-gray-400">📍 {order.projectAddress}</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Beauftragt: {new Date(order.orderDate).toLocaleDateString('de-DE')}
                          </p>
                          <p className="text-sm text-gray-400">
                            Ausführung: KW {order.executionWeek}/2025
                          </p>
                          {order.isBundle && (
                            <span className="inline-block mt-2 bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">
                              Teil eines Projektbündels ({order.bundleDiscount}% Rabatt gewährt)
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-400 mb-2">
                            {order.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </p>
                          <span className={`text-xs px-2 py-1 rounded inline-block ${
                            order.status === 'geplant' ? 'bg-gray-600 text-gray-200' :
                            order.status === 'aktiv' ? 'bg-blue-600 text-blue-200' :
                            order.status === 'pausiert' ? 'bg-yellow-600 text-yellow-200' :
                            order.status === 'abgeschlossen' ? 'bg-green-600 text-green-200' :
                            'bg-gray-600 text-gray-300'
                          }`}>
                            {order.status}
                          </span>
                          {order.progress !== undefined && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-400 mb-1">Fortschritt:</p>
                              <div className="w-32 bg-white/20 rounded-full h-2">
                                <div 
                                  className="bg-teal-500 h-2 rounded-full transition-all"
                                  style={{ width: `${order.progress}%` }}
                                ></div>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">{order.progress}%</p>
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
                  const weekNumber = new Date().getWeek() + weekOffset;
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

      {/* Angebot abgeben Modal */}
      {showOfferModal && selectedTender && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-white/20 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Angebot erstellen</h2>
            
            <div className="bg-white/10 rounded-lg p-4 mb-6">
              <p className="text-gray-300 mb-2">Projekt: {selectedTender.projectType}</p>
              <p className="text-gray-400 text-sm">Gewerk: {selectedTender.trade}</p>
              <p className="text-gray-400 text-sm">Ort: {selectedTender.location}</p>
              {selectedTender.isBundle && (
                <p className="text-blue-300 text-sm mt-2">
                  ⚠️ Dies ist Teil eines Bündels mit {selectedTender.bundleCount} Projekten
                </p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-white font-medium mb-2">Angebotssumme (brutto) *</label>
                <input
                  type="number"
                  value={offerData.amount}
                  onChange={(e) => setOfferData({...offerData, amount: e.target.value})}
                  placeholder="z.B. 15000"
                  className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                  required
                />
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Ausführungszeitraum *</label>
                <input
                  type="text"
                  value={offerData.executionTime}
                  onChange={(e) => setOfferData({...offerData, executionTime: e.target.value})}
                  placeholder="z.B. KW 25-26/2025"
                  className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                  required
                />
              </div>

              {selectedTender.isBundle && (
                <div>
                  <label className="block text-white font-medium mb-2">Bündelrabatt (%)</label>
                  <input
                    type="number"
                    value={offerData.bundleDiscount}
                    onChange={(e) => setOfferData({...offerData, bundleDiscount: e.target.value})}
                    min="0"
                    max="30"
                    placeholder="z.B. 10"
                    className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                  />
                  <p className="text-gray-400 text-xs mt-1">
                    Rabatt gilt nur bei Beauftragung aller Bündel-Projekte
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    checked={offerData.includeMaterial}
                    onChange={(e) => setOfferData({...offerData, includeMaterial: e.target.checked})}
                    className="mr-3"
                  />
                  Material inklusive
                </label>
                <label className="flex items-center text-white">
                  <input
                    type="checkbox"
                    checked={offerData.includeAnfahrt}
                    onChange={(e) => setOfferData({...offerData, includeAnfahrt: e.target.checked})}
                    className="mr-3"
                  />
                  Anfahrt inklusive
                </label>
              </div>

              <div>
                <label className="block text-white font-medium mb-2">Anmerkungen</label>
                <textarea
                  value={offerData.notes}
                  onChange={(e) => setOfferData({...offerData, notes: e.target.value})}
                  rows="3"
                  placeholder="Zusätzliche Informationen zum Angebot..."
                  className="w-full bg-white/20 backdrop-blur border border-white/30 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowOfferModal(false)}
                className="flex-1 px-4 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSubmitOffer}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold disabled:opacity-50"
              >
                {loading ? 'Wird gesendet...' : 'Angebot abgeben'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function for week number
Date.prototype.getWeek = function() {
  const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
};
