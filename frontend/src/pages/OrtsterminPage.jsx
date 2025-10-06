// src/pages/OrtsterminPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api';

export default function OrtsterminPage() {
  const { offerId } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [userType, setUserType] = useState(null); // 'bauherr' or 'handwerker'
  
  // Formular für neuen Terminvorschlag
  const [proposalForm, setProposalForm] = useState({
    date: '',
    time: '',
    duration: 60, // Standard 60 Minuten
    message: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Lade Angebotsdaten
      const offerRes = await fetch(apiUrl(`/api/offers/${offerId}/details`));
      if (offerRes.ok) {
        setOffer(await offerRes.json());
      }
      
      // Lade Terminvorschläge
      const appointmentsRes = await fetch(apiUrl(`/api/offers/${offerId}/appointments`));
      if (appointmentsRes.ok) {
        setAppointments(await appointmentsRes.json());
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };
  
 useEffect(() => {
  // Bestimme Nutzertyp
  const bauherrData = sessionStorage.getItem('userData');
  const handwerkerData = sessionStorage.getItem('handwerkerData');
  
  if (bauherrData) {
    setUserType('bauherr');
  } else if (handwerkerData) {
    setUserType('handwerker');
  } else {
    navigate('/');
    return;
  }

  loadData();
}, [offerId, navigate, loadData]);
  
  const proposeAppointment = async () => {
    const { date, time, duration, message } = proposalForm;
    
    if (!date || !time) {
      alert('Bitte Datum und Uhrzeit auswählen');
      return;
    }
    
    const appointmentDate = new Date(`${date}T${time}`);
    
    try {
      const res = await fetch(apiUrl(`/api/offers/${offerId}/appointments/propose`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposed_by: userType,
          proposed_date: appointmentDate.toISOString(),
          duration,
          message
        })
      });
      
      if (res.ok) {
        alert('Terminvorschlag wurde gesendet!');
        loadData();
        setProposalForm({ date: '', time: '', duration: 60, message: '' });
      }
    } catch (error) {
      console.error('Error proposing appointment:', error);
    }
  };

  const respondToAppointment = async (appointmentId, response) => {
    try {
      const res = await fetch(apiUrl(`/api/appointments/${appointmentId}/respond`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response })
      });
      
      if (res.ok) {
        alert(response === 'accepted' ? 'Termin bestätigt!' : 'Termin abgelehnt.');
        loadData();
      }
    } catch (error) {
      console.error('Error responding to appointment:', error);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-400"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-4xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Zurück
          </button>
          
          <h1 className="text-4xl font-bold text-white mb-2">Terminvereinbarung</h1>
          <p className="text-gray-400">
            Ortstermin für {offer?.trade_name} - {offer?.project_description}
          </p>
        </div>

        {/* Kontaktdaten */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-4">Kontaktdaten</h3>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm text-gray-400 mb-2">Bauherr</h4>
              <p className="text-white">{offer?.bauherr_name}</p>
              <p className="text-gray-300">📞 {offer?.bauherr_phone}</p>
              <p className="text-gray-300">✉️ {offer?.bauherr_email}</p>
            </div>
            <div>
              <h4 className="text-sm text-gray-400 mb-2">Handwerker</h4>
              <p className="text-white">{offer?.company_name}</p>
              <p className="text-gray-300">📞 {offer?.handwerker_phone}</p>
              <p className="text-gray-300">✉️ {offer?.handwerker_email}</p>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/20">
            <h4 className="text-sm text-gray-400 mb-2">Projektadresse</h4>
            <p className="text-white">
              {offer?.project_street} {offer?.project_house_number}<br/>
              {offer?.project_zip} {offer?.project_city}
            </p>
          </div>
        </div>

        {/* Terminvorschläge */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-4">Terminvorschläge</h3>
          
          {appointments.length === 0 ? (
            <p className="text-gray-400 mb-4">Noch keine Terminvorschläge vorhanden.</p>
          ) : (
            <div className="space-y-4 mb-6">
              {appointments.map((apt) => (
                <div key={apt.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-semibold">
                        {new Date(apt.proposed_date).toLocaleDateString('de-DE', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      <p className="text-gray-300">
                        ⏰ {new Date(apt.proposed_date).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} Uhr
                        ({apt.duration} Minuten)
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Vorgeschlagen von: {apt.proposed_by === 'bauherr' ? 'Bauherr' : 'Handwerker'}
                      </p>
                      {apt.message && (
                        <p className="text-sm text-gray-300 mt-2 italic">
                          "{apt.message}"
                        </p>
                      )}
                    </div>
                    
                    <div>
                      {apt.status === 'proposed' && apt.proposed_by !== userType && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => respondToAppointment(apt.id, 'accepted')}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            Annehmen
                          </button>
                          <button
                            onClick={() => respondToAppointment(apt.id, 'rejected')}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                          >
                            Ablehnen
                          </button>
                        </div>
                      )}
                      
                      {apt.status === 'accepted' && (
                        <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded">
                          ✓ Bestätigt
                        </span>
                      )}
                      
                      {apt.status === 'rejected' && (
                        <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded">
                          Abgelehnt
                        </span>
                      )}
                      
                      {apt.status === 'proposed' && apt.proposed_by === userType && (
                        <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded">
                          Warte auf Antwort
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Neuer Terminvorschlag */}
          <div className="border-t border-white/20 pt-6">
            <h4 className="text-lg font-semibold text-white mb-4">Neuen Termin vorschlagen</h4>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Datum</label>
                <input
                  type="date"
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  value={proposalForm.date}
                  onChange={(e) => setProposalForm({...proposalForm, date: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Uhrzeit</label>
                <input
                  type="time"
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  value={proposalForm.time}
                  onChange={(e) => setProposalForm({...proposalForm, time: e.target.value})}
                />
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Dauer (Minuten)</label>
                <select
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white"
                  value={proposalForm.duration}
                  onChange={(e) => setProposalForm({...proposalForm, duration: parseInt(e.target.value)})}
                >
                  <option value="30">30 Minuten</option>
                  <option value="60">60 Minuten</option>
                  <option value="90">90 Minuten</option>
                  <option value="120">120 Minuten</option>
                </select>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Nachricht (optional)</label>
              <textarea
                className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-2 text-white placeholder-gray-400"
                rows="3"
                placeholder="Z.B. Hinweise zur Anfahrt oder besondere Wünsche..."
                value={proposalForm.message}
                onChange={(e) => setProposalForm({...proposalForm, message: e.target.value})}
              />
            </div>
            
            <button
              onClick={proposeAppointment}
              className="px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:shadow-lg transform hover:scale-[1.02] transition-all"
            >
              Termin vorschlagen
            </button>
          </div>
        </div>

        {/* Hinweis */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-yellow-300 text-sm">
            <strong>💡 Tipp:</strong> Nach der Terminbestätigung können beide Parteien direkt telefonisch oder per E-Mail weitere Details klären.
            Die Nachwirkfrist von 24 Monaten ist bereits aktiv.
          </p>
        </div>
      </div>
    </div>
  );
}
