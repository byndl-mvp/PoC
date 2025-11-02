// src/pages/OfferDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function OfferDetailPage() {
  const { projectId, offerId } = useParams();
  const navigate = useNavigate();
  
  const [offer, setOffer] = useState(null);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('positions');

  useEffect(() => {
    const userData = sessionStorage.getItem('userData');
    const token = sessionStorage.getItem('bauherrToken');
    
    if (!userData || !token) {
      navigate('/bauherr/login');
      return;
    }

    loadData();
  }, [projectId, offerId]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const loadData = async () => {
  try {
    // Lade Angebotsdaten
    const offerRes = await fetch(apiUrl(`/api/projects/${projectId}/offers/${offerId}`));
    if (offerRes.ok) {
      const offerData = await offerRes.json();
      setOffer(offerData);
    }
    
    // Lade Projektdaten - KORRIGIERTE ROUTE
    const projectRes = await fetch(apiUrl(`/api/projects/${projectId}/dashboard-details`));
    if (projectRes.ok) {
      const projectData = await projectRes.json();
      setProject(projectData.project); // Beachte: .project, da dashboard-details ein Objekt mit project-Key zurückgibt
    }
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    setLoading(false);
  }
};

  const handleAccept = async () => {
    if (!window.confirm('Möchten Sie dieses Angebot verbindlich annehmen?')) return;
    
    try {
      const res = await fetch(apiUrl(`/api/offers/${offerId}/accept`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        alert('Angebot erfolgreich angenommen!');
        navigate('/bauherr/dashboard');
      }
    } catch (error) {
      console.error('Error accepting offer:', error);
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Möchten Sie dieses Angebot wirklich ablehnen?')) return;
    
    try {
      const res = await fetch(apiUrl(`/api/offers/${offerId}/reject`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (res.ok) {
        alert('Angebot abgelehnt.');
        navigate('/bauherr/dashboard');
      }
    } catch (error) {
      console.error('Error rejecting offer:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(value || 0);
  };

// Berechne Rabatt
const calculatePriceWithDiscount = (offer) => {
  const netto = offer?.amount || 0;
  const bundleDiscount = offer?.bundle_discount || 0;
  const discountAmount = bundleDiscount > 0 ? (netto * bundleDiscount / 100) : 0;
  const nettoAfterDiscount = netto - discountAmount;
  const mwst = nettoAfterDiscount * 0.19;
  const brutto = nettoAfterDiscount + mwst;
  
  return {
    netto,
    bundleDiscount,
    discountAmount,
    nettoAfterDiscount,
    mwst,
    brutto
  };
};
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
        <div className="text-center text-white">
          <p>Angebot nicht gefunden</p>
          <button onClick={() => navigate('/bauherr/dashboard')} className="mt-4 text-teal-400">
            Zurück zum Dashboard
          </button>
        </div>
      </div>
    );
  }

 // Parse LV-Daten korrekt
let positions = [];
if (offer.lv_data) {
  let parsedLV = offer.lv_data;
  
  // Falls String, parse es
  if (typeof parsedLV === 'string') {
    parsedLV = JSON.parse(parsedLV);
  }
  
  // Normalisiere zu Array
  if (Array.isArray(parsedLV)) {
    // lv_data ist direkt das Array
    positions = parsedLV;
  } else if (parsedLV && Array.isArray(parsedLV.positions)) {
    // lv_data ist ein Objekt mit positions-Key
    positions = parsedLV.positions;
  }
}

  const handlePreliminaryOrder = async () => {
  try {
    // Erst prüfen ob bereits eine Vertragsanbahnung existiert
    const checkRes = await fetch(
      apiUrl(`/api/projects/${projectId}/trades/${offer.trade_code}/preliminary-check`)
    );
    const checkData = await checkRes.json();
    
    if (checkData.hasExisting) {
      alert(`⚠️ Exklusivität in der Vertragsanbahnung

Sie befinden sich in diesem Gewerk bereits in der Vertragsanbahnung mit ${checkData.companyName}.

In der Kennenlernphase hat der ausgewählte Handwerker Exklusivität zu Ihrem Auftrag. Dies gibt beiden Seiten die nötige Sicherheit, um:
- Offene Fragen in Ruhe zu klären
- Einen Ortstermin durchzuführen
- Die Kalkulation transparent anzupassen
- Nachträge in der Ausführungsphase zu vermeiden

Diese Regelung verhindert Missverständnisse und schafft faire Bedingungen für alle Beteiligten. 

Falls Sie mit ${checkData.companyName} nicht weitermachen möchten, können Sie die Vertragsanbahnung im Dashboard beenden.`);
      return;
    }
    
    // Bestätigungsdialog
    if (!window.confirm(`Möchten Sie mit ${offer.company_name} in die Vertragsanbahnung gehen?

Hinweis: In der Vertragsanbahnung erhält dieser Handwerker Exklusivität für dieses Gewerk. Sie können dann keine anderen Angebote für ${offer.trade_name} vorläufig annehmen.`)) {
      return;
    }
    
    const res = await fetch(apiUrl(`/api/offers/${offerId}/preliminary-accept`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId })
    });
    
    const data = await res.json();
    
    if (res.status === 400 && data.error === 'conflict') {
      alert(`⚠️ ${data.message}

In der Kennenlernphase hat der ausgewählte Handwerker Exklusivität. Dies schützt beide Seiten und ermöglicht eine vertrauensvolle Zusammenarbeit.`);
      return;
    }
    
    if (res.ok) {
      alert('✅ Vorläufige Beauftragung erfolgreich! Die Kontaktdaten wurden freigegeben.');
      loadData(); // Daten neu laden
    }
  } catch (error) {
    console.error('Error in preliminary order:', error);
    alert('Fehler bei der vorläufigen Beauftragung');
  }
};
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/bauherr/dashboard')}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Zurück zum Dashboard
          </button>
          
          <h1 className="text-4xl font-bold text-white mb-2">Angebotsdetails</h1>
          <p className="text-gray-400">
            {project?.category} - {project?.sub_category}
          </p>
        </div>

        {/* Anbieter Info */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm text-gray-400 mb-1">Anbieter</h3>
              <p className="text-xl font-semibold text-white">{offer.company_name}</p>
              <p className="text-gray-300">{offer.trade_name}</p>
            </div>
            <div>
  <h3 className="text-sm text-gray-400 mb-1">Angebotssumme</h3>
  {(() => {
  const prices = calculatePriceWithDiscount(offer);
  return (
    <>
      <p className="text-sm text-gray-400">Netto: {formatCurrency(prices.netto)}</p>
      {prices.bundleDiscount > 0 && (
        <>
          <p className="text-sm text-green-400">
            📦 Rabatt ({prices.bundleDiscount}%): -{formatCurrency(prices.discountAmount)}
          </p>
          <p className="text-sm text-gray-400">
            Nach Rabatt: {formatCurrency(prices.nettoAfterDiscount)}
          </p>
        </>
      )}
      <p className="text-2xl font-bold text-teal-400">{formatCurrency(prices.brutto)}</p>
    </>
  );
})()}
  <p className="text-xs text-gray-400 mt-1">Brutto (inkl. 19% MwSt.)</p>
</div>
            <div>
              <h3 className="text-sm text-gray-400 mb-1">Status</h3>
              <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                offer.status === 'accepted' ? 'bg-green-500/20 text-green-400' :
                offer.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                'bg-yellow-500/20 text-yellow-400'
              }`}>
                {offer.status === 'accepted' ? 'Angenommen' :
                 offer.status === 'rejected' ? 'Abgelehnt' : 'Offen'}
              </span>
            </div>
          </div>
        </div>

        {/* HIER NEUEN ACTION BUTTON EINFÜGEN */}
{offer.status === 'submitted' && (
  <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl p-6 mb-6 border border-yellow-500/50">
    <div className="text-center">
      <h3 className="text-xl font-bold text-white mb-3">Nächster Schritt</h3>
      <p className="text-gray-300 mb-4">
        Starten Sie die Vertragsanbahnung mit diesem Handwerker
      </p>
      <button
        onClick={handlePreliminaryOrder}
        className="px-8 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-bold text-lg"
      >
        🤝 Vorläufig beauftragen
      </button>
      <p className="text-xs text-gray-400 mt-3">
        Kontaktdaten werden freigegeben • 24 Monate Nachwirkfrist beginnt
      </p>
    </div>
  </div>
)}
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/20">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'positions' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            Positionen
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'contact' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            Kontaktdaten
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'notes' ? 'text-teal-400 border-b-2 border-teal-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            Anmerkungen
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 mb-6">
          {activeTab === 'positions' && (
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">Leistungspositionen</h3>
              {positions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-white">
                    <thead className="bg-white/10">
                      <tr>
                        <th className="text-left p-3">Pos.</th>
                        <th className="text-left p-3">Bezeichnung</th>
                        <th className="text-right p-3">Menge</th>
                        <th className="text-left p-3">Einheit</th>
                        <th className="text-right p-3">EP (€)</th>
                        <th className="text-right p-3">GP (€)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos, idx) => (
                        <tr key={idx} className="border-t border-white/10">
                          <td className="p-3">{idx + 1}</td>
                          <td className="p-3">
                            <div>{pos.title}</div>
                            <div className="text-xs text-gray-400">{pos.description}</div>
                          </td>
                          <td className="text-right p-3">{pos.quantity}</td>
                          <td className="p-3">{pos.unit}</td>
                          <td className="text-right p-3">{formatCurrency(pos.unitPrice)}</td>
                          <td className="text-right p-3 text-teal-400">{formatCurrency(pos.totalPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-white/20">
  <tr>
    <td colSpan="5" className="text-right p-3 font-semibold text-gray-400">Gesamtsumme Netto:</td>
    <td className="text-right p-3 font-semibold text-white">
      {formatCurrency(offer.amount)}
    </td>
  </tr>
  <tr>
    <td colSpan="5" className="text-right p-3 text-sm text-gray-400">zzgl. 19% MwSt.:</td>
    <td className="text-right p-3 text-sm text-gray-300">
      {formatCurrency((offer.amount || 0) * 0.19)}
    </td>
  </tr>
  <tr className="border-t border-white/20">
    <td colSpan="5" className="text-right p-3 font-bold text-white">Gesamtsumme Brutto:</td>
    <td className="text-right p-3 text-xl font-bold text-teal-400">
      {formatCurrency((offer.amount || 0) * 1.19)}
    </td>
  </tr>
</tfoot>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400">Keine detaillierten Positionen vorhanden</p>
              )}
            </div>
          )}

          {activeTab === 'contact' && (
  <div>
    <h3 className="text-xl font-semibold text-white mb-4">Kontaktdaten</h3>

    {console.log('🔍 OFFER DATA:', offer)} 
    
    {offer.status === 'preliminary' || offer.status === 'confirmed' || offer.status === 'accepted' ? (
      // Kontaktdaten nur bei vorläufiger oder finaler Beauftragung zeigen
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-400">Firma</p>
          <p className="text-white">{offer.company_name}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">E-Mail</p>
          <p className="text-white">{offer.email}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Telefon</p>
          <p className="text-white">{offer.phone}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Adresse</p>
          <p className="text-white">
            {offer.street} {offer.house_number}<br/>
            {offer.zip_code} {offer.city}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Ausführungszeitraum</p>
          <p className="text-white">{
  offer.execution_start && offer.execution_end 
    ? `${new Date(offer.execution_start).toLocaleDateString('de-DE')} - ${new Date(offer.execution_end).toLocaleDateString('de-DE')}`
    : offer.execution_time || 'Nach Absprache'
}</p>
        </div>
      </div>
    ) : (
      // Hinweis bei noch nicht beauftragtem Angebot
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-yellow-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <h4 className="text-yellow-300 font-semibold mb-1">Kontaktdaten geschützt</h4>
            <p className="text-gray-300 text-sm">
              Die Kontaktdaten werden erst nach einer vorläufigen Beauftragung freigegeben. 
              Dies schützt beide Seiten und ermöglicht einen strukturierten Vergabeprozess.
            </p>
            <button
              onClick={() => {
                if (window.confirm('Möchten Sie dieses Angebot vorläufig beauftragen und die Kontaktdaten freigeben?')) {
                  handlePreliminaryOrder();
                }
              }}
              className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Vorläufig beauftragen & Kontakte freigeben
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
)}

          {activeTab === 'notes' && (
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">Anmerkungen</h3>
              <p className="text-gray-300">{offer.notes || 'Keine Anmerkungen vorhanden'}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {offer.status === 'offen' && (
          <div className="flex gap-4 justify-center">
            <button
              onClick={handleAccept}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
            >
              Angebot annehmen
            </button>
            <button
              onClick={handleReject}
              className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
            >
              Angebot ablehnen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
