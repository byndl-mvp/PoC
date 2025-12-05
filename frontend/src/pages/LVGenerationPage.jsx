// src/pages/LVGenerationPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { apiUrl } from '../api';

export default function LVGenerationPage() {
  const { projectId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'pending', 'error'
  const [error, setError] = useState('');
  const [paymentDetails, setPaymentDetails] = useState(null);
  
  const sessionId = searchParams.get('session_id');
  const cancelled = searchParams.get('cancelled');
  
  useEffect(() => {
    // Wenn Zahlung abgebrochen wurde
    if (cancelled === 'true') {
      setStatus('cancelled');
      return;
    }
    
    const verifyPayment = async () => {
      if (!sessionId) {
        setError('Keine Zahlungs-Session gefunden');
        setStatus('error');
        return;
      }
      
      try {
        // Prüfe Zahlungsstatus bei Stripe
        const res = await fetch(apiUrl(`/api/stripe/session-status/${sessionId}`));
        const data = await res.json();
        
        if (data.status === 'paid') {
          setStatus('success');
          setPaymentDetails(data);
        } else if (data.status === 'unpaid') {
          setStatus('pending');
        } else {
          setStatus('error');
          setError('Zahlungsstatus unbekannt');
        }
      } catch (err) {
        console.error('Verification error:', err);
        setStatus('error');
        setError('Fehler bei der Verifizierung der Zahlung');
      }
    };
    
    verifyPayment();
  }, [sessionId, cancelled]);
  
  // Automatische Weiterleitung nach 5 Sekunden bei Erfolg
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        navigate('/bauherr/dashboard');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-teal-500 rounded-full filter blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full filter blur-3xl"></div>
      </div>
      
      <div className="relative max-w-lg w-full">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 text-center">
          
          {/* Verifying */}
          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
              <h2 className="text-2xl font-bold text-white mb-4">Zahlung wird verifiziert...</h2>
              <p className="text-gray-300">Bitte warten Sie einen Moment.</p>
            </>
          )}
          
          {/* Success */}
          {status === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Zahlung erfolgreich!</h2>
              <p className="text-gray-300 mb-6">
                Vielen Dank für Ihre Zahlung. Sie können jetzt Ihre Leistungsverzeichnisse erstellen lassen.
              </p>
              
              {paymentDetails && (
                <div className="bg-white/5 rounded-lg p-4 mb-6 text-left">
                  <p className="text-gray-400 text-sm">Bezahlter Betrag:</p>
                  <p className="text-white text-xl font-bold">
                    {paymentDetails.amountTotal?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </p>
                  {paymentDetails.customerEmail && (
                    <p className="text-gray-400 text-sm mt-2">
                      Rechnung wird gesendet an: {paymentDetails.customerEmail}
                    </p>
                  )}
                </div>
              )}
              
              <div className="bg-teal-500/20 border border-teal-500/50 rounded-lg p-4 mb-6">
                <p className="text-teal-300 text-sm">
                  ✓ Ihre Rechnung wird per E-Mail zugestellt.<br/>
                  ✓ Sie werden in 5 Sekunden automatisch weitergeleitet.
                </p>
              </div>
              
              <Link
                to="/bauherr/dashboard"
                className="inline-block w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all"
              >
                Zum Dashboard & LVs erstellen →
              </Link>
            </>
          )}
          
          {/* Pending */}
          {status === 'pending' && (
            <>
              <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Zahlung in Bearbeitung</h2>
              <p className="text-gray-300 mb-6">
                Ihre Zahlung wird noch verarbeitet. Dies kann bei einigen Zahlungsmethoden 
                einige Minuten dauern.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Status erneut prüfen
              </button>
            </>
          )}
          
          {/* Cancelled */}
          {status === 'cancelled' && (
            <>
              <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Zahlung abgebrochen</h2>
              <p className="text-gray-300 mb-6">
                Sie haben den Zahlungsvorgang abgebrochen. Keine Sorge – es wurde nichts berechnet.
              </p>
              <div className="flex gap-3">
                <Link
                  to={`/project/${projectId}/trades`}
                  className="flex-1 px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors text-center"
                >
                  Erneut versuchen
                </Link>
                <Link
                  to="/bauherr/dashboard"
                  className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-center"
                >
                  Zum Dashboard
                </Link>
              </div>
            </>
          )}
          
          {/* Error */}
          {status === 'error' && (
            <>
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-4">Fehler</h2>
              <p className="text-red-300 mb-6">{error}</p>
              <div className="flex gap-3">
                <Link
                  to={`/project/${projectId}/trades`}
                  className="flex-1 px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors text-center"
                >
                  Erneut versuchen
                </Link>
                <Link
                  to="/bauherr/dashboard"
                  className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-center"
                >
                  Zum Dashboard
                </Link>
              </div>
            </>
          )}
          
        </div>
        
        {/* Hilfe-Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-400 text-sm">
            Probleme bei der Zahlung?{' '}
            <a href="mailto:support@byndl.de" className="text-teal-400 hover:text-teal-300">
              Kontaktieren Sie uns
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
