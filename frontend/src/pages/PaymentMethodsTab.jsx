// src/pages/PaymentMethodsTab.jsx
import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, IbanElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { apiUrl } from '../api';

// Stripe Public Key aus Environment
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_...');

// Karten-Logos
const CardBrandLogo = ({ brand }) => {
  const logos = {
    visa: '💳 Visa',
    mastercard: '💳 Mastercard',
    amex: '💳 Amex',
    discover: '💳 Discover',
    diners: '💳 Diners',
    jcb: '💳 JCB',
    unionpay: '💳 UnionPay',
  };
  return <span>{logos[brand] || '💳 Karte'}</span>;
};

// Innere Komponente mit Stripe Hooks (für Handwerker) - MIT SEPA SUPPORT
function PaymentMethodForm({ userType, userId, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formComplete, setFormComplete] = useState(false);
  const [paymentType, setPaymentType] = useState('card'); // 'card' oder 'sepa'
  const [accountHolderName, setAccountHolderName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) return;
    
    setLoading(true);
    setError('');
    
    try {
      const setupRes = await fetch(apiUrl('/api/stripe/create-setup-intent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          [userType === 'handwerker' ? 'handwerkerId' : 'bauherrId']: userId 
        })
      });
      
      const { clientSecret, error: setupError } = await setupRes.json();
      
      if (setupError) {
        throw new Error(setupError);
      }
      
      let result;
      
      if (paymentType === 'card') {
        result = await stripe.confirmCardSetup(clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement),
          }
        });
      } else {
        // SEPA-Lastschrift
        result = await stripe.confirmSepaDebitSetup(clientSecret, {
          payment_method: {
            sepa_debit: elements.getElement(IbanElement),
            billing_details: {
              name: accountHolderName,
              email: '', // Optional - wird vom Backend geholt
            },
          }
        });
      }
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      if (userType === 'handwerker') {
        await fetch(apiUrl('/api/stripe/set-default-payment-method'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handwerkerId: userId,
            paymentMethodId: result.setupIntent.payment_method
          })
        });
      }
      
      onSuccess();
      
    } catch (err) {
      setError(err.message || 'Fehler beim Speichern der Zahlungsmethode');
    } finally {
      setLoading(false);
    }
  };

  const elementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        '::placeholder': { color: '#9ca3af' },
      },
      invalid: { color: '#ef4444' },
    },
  };

  const ibanOptions = {
    supportedCountries: ['SEPA'],
    placeholderCountry: 'DE',
    style: elementOptions.style,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Auswahl: Kreditkarte oder SEPA */}
      <div className="flex gap-3 mb-4">
        <button
          type="button"
          onClick={() => { setPaymentType('card'); setFormComplete(false); }}
          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
            paymentType === 'card' 
              ? 'border-teal-500 bg-teal-500/20 text-teal-400' 
              : 'border-white/20 bg-white/5 text-gray-400 hover:border-white/40'
          }`}
        >
          💳 Kreditkarte
        </button>
        <button
          type="button"
          onClick={() => { setPaymentType('sepa'); setFormComplete(false); }}
          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
            paymentType === 'sepa' 
              ? 'border-teal-500 bg-teal-500/20 text-teal-400' 
              : 'border-white/20 bg-white/5 text-gray-400 hover:border-white/40'
          }`}
        >
          🏦 SEPA-Lastschrift
        </button>
      </div>

      {paymentType === 'card' ? (
        <div className="bg-white/10 rounded-lg p-4 border border-white/20">
          <label className="block text-white text-sm font-medium mb-3">
            Kartendaten eingeben
          </label>
          <div className="bg-white rounded-lg p-3">
            <CardElement
              options={elementOptions}
              onChange={(e) => setFormComplete(e.complete)}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white/10 rounded-lg p-4 border border-white/20">
            <label className="block text-white text-sm font-medium mb-3">
              Kontoinhaber
            </label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Max Mustermann"
              className="w-full px-4 py-3 bg-white rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>
          <div className="bg-white/10 rounded-lg p-4 border border-white/20">
            <label className="block text-white text-sm font-medium mb-3">
              IBAN eingeben
            </label>
            <div className="bg-white rounded-lg p-3">
              <IbanElement
                options={ibanOptions}
                onChange={(e) => setFormComplete(e.complete && accountHolderName.length > 2)}
              />
            </div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-blue-300 text-xs">
              ℹ️ Mit der Angabe Ihrer IBAN ermächtigen Sie byndl, Zahlungen von Ihrem Konto 
              mittels SEPA-Lastschrift einzuziehen. Sie können innerhalb von 8 Wochen ab 
              Belastungsdatum die Erstattung verlangen.
            </p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}
      
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={!stripe || !formComplete || loading || (paymentType === 'sepa' && accountHolderName.length < 3)}
          className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {loading ? 'Wird gespeichert...' : 'Speichern'}
        </button>
      </div>
      
      <p className="text-gray-400 text-xs text-center">
        🔒 Ihre Zahlungsdaten werden sicher über Stripe verarbeitet und nicht auf unseren Servern gespeichert.
      </p>
    </form>
  );
}

// Haupt-Komponente
export default function PaymentMethodsTab({ userType, userId }) {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (userType === 'handwerker') {
      loadPaymentMethods();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userType, userId]);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const res = await fetch(apiUrl(`/api/stripe/payment-methods/${userType}/${userId}`));
      
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(data.paymentMethods || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden:', err);
    } finally {
      setLoading(false);
    }
  };

  const deletePaymentMethod = async (paymentMethodId) => {
    if (!window.confirm('Möchten Sie diese Zahlungsmethode wirklich entfernen?')) return;
    
    try {
      setDeletingId(paymentMethodId);
      
      const res = await fetch(apiUrl(`/api/stripe/payment-method/${paymentMethodId}`), {
        method: 'DELETE'
      });
      
      if (res.ok) {
        setMessage('Zahlungsmethode wurde entfernt.');
        loadPaymentMethods();
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error('Löschen fehlgeschlagen');
      }
    } catch (err) {
      setError('Fehler beim Entfernen der Zahlungsmethode.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setDeletingId(null);
    }
  };

  const setAsDefault = async (paymentMethodId) => {
    try {
      const res = await fetch(apiUrl('/api/stripe/set-default-payment-method'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [userType === 'handwerker' ? 'handwerkerId' : 'bauherrId']: userId,
          paymentMethodId
        })
      });
      
      if (res.ok) {
        setMessage('Standard-Zahlungsmethode wurde aktualisiert.');
        loadPaymentMethods();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setError('Fehler beim Setzen der Standard-Zahlungsmethode.');
      setTimeout(() => setError(''), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ============================================
  // BAUHERREN: Informative Übersicht
  // ============================================
  if (userType === 'bauherr') {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white mb-6">Zahlungsmethoden</h2>
        
        {/* Info-Box */}
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <p className="text-teal-300 font-medium mb-2">
                Flexible Zahlung bei der LV-Erstellung
              </p>
              <p className="text-teal-200/80 text-sm">
                Sie wählen Ihre bevorzugte Zahlungsmethode direkt beim Bezahlvorgang. 
                Es ist keine vorherige Hinterlegung einer Zahlungsmethode erforderlich.
              </p>
            </div>
          </div>
        </div>

        {/* Verfügbare Zahlungsmethoden */}
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Verfügbare Zahlungsmethoden</h3>
          <p className="text-gray-400 text-sm mb-6">
            Bei der Zahlung für Ihre Leistungsverzeichnisse stehen Ihnen folgende Optionen zur Verfügung:
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Visa */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <svg viewBox="0 0 750 471" className="h-8 mb-2" xmlns="http://www.w3.org/2000/svg">
                <path d="M278.198 334.228l33.36-195.763h53.358l-33.384 195.763H278.198zm246.394-191.238c-10.57-3.966-27.135-8.222-47.822-8.222-52.725 0-89.863 26.551-90.18 64.604-.632 28.129 26.517 43.822 46.754 53.185 20.77 9.597 27.751 15.716 27.652 24.283-.133 13.123-16.586 19.116-31.924 19.116-21.357 0-32.688-2.967-50.205-10.277l-6.877-3.112-7.488 43.823c12.463 5.466 35.508 10.198 59.438 10.445 56.09 0 92.502-26.246 93.054-66.882.267-22.27-14.016-39.216-44.801-53.188-18.65-9.056-30.072-15.099-29.951-24.269 0-8.137 9.668-16.838 30.556-16.838 17.449-.271 30.088 3.534 39.936 7.5l4.781 2.259 7.233-42.427h-.156zm137.759-4.254h-41.231c-12.773 0-22.332 3.487-27.941 16.234l-79.244 179.402h56.031s9.159-24.121 11.231-29.418c6.123 0 60.555.083 68.336.083 1.596 6.854 6.492 29.335 6.492 29.335h49.512l-43.186-195.636zm-65.417 126.408c4.414-11.279 21.26-54.723 21.26-54.723-.316.521 4.381-11.334 7.074-18.684l3.607 16.878s10.217 46.729 12.352 56.529h-44.293zM209.394 138.465l-52.239 133.496-5.565-27.129c-9.726-31.274-40.025-65.157-73.898-82.12l47.767 171.204 56.455-.063 84.004-195.388h-56.524" fill="#1A1F71"/>
                <path d="M131.92 138.465H47.391l-.682 4.073c66.939 16.204 111.232 55.363 129.618 102.415l-18.709-89.96c-3.229-12.396-12.597-16.095-25.698-16.528" fill="#F9A533"/>
              </svg>
            </div>
            
            {/* Mastercard */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <svg viewBox="0 0 152 100" className="h-10 mb-2" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" fill="#EB001B"/>
                <circle cx="102" cy="50" r="45" fill="#F79E1B"/>
                <path d="M76 18.5c-10.5 8.5-17.2 21.5-17.2 36s6.7 27.5 17.2 36c10.5-8.5 17.2-21.5 17.2-36s-6.7-27.5-17.2-36z" fill="#FF5F00"/>
              </svg>
            </div>
            
            {/* American Express */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <svg viewBox="0 0 120 80" className="h-10 mb-2" xmlns="http://www.w3.org/2000/svg">
                <rect width="120" height="80" rx="8" fill="#006FCF"/>
                <text x="60" y="48" textAnchor="middle" fill="white" fontFamily="Arial, sans-serif" fontSize="18" fontWeight="bold">AMEX</text>
              </svg>
            </div>
            
            {/* PayPal */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <svg className="h-6 mb-2" viewBox="0 0 124 33" xmlns="http://www.w3.org/2000/svg">
                <path fill="#253B80" d="M46.211 6.749h-6.839a.95.95 0 0 0-.939.802l-2.766 17.537a.57.57 0 0 0 .564.658h3.265a.95.95 0 0 0 .939-.803l.746-4.73a.95.95 0 0 1 .938-.803h2.165c4.505 0 7.105-2.18 7.784-6.5.306-1.89.013-3.375-.872-4.415-.972-1.142-2.696-1.746-4.985-1.746zM47 13.154c-.374 2.454-2.249 2.454-4.062 2.454h-1.032l.724-4.583a.57.57 0 0 1 .563-.481h.473c1.235 0 2.4 0 3.002.704.359.42.469 1.044.332 1.906zM66.654 13.075h-3.275a.57.57 0 0 0-.563.481l-.145.916-.229-.332c-.709-1.029-2.29-1.373-3.868-1.373-3.619 0-6.71 2.741-7.312 6.586-.313 1.918.132 3.752 1.22 5.031.998 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .562.66h2.95a.95.95 0 0 0 .939-.803l1.77-11.209a.568.568 0 0 0-.561-.658zm-4.565 6.374c-.316 1.871-1.801 3.127-3.695 3.127-.951 0-1.711-.305-2.199-.883-.484-.574-.668-1.391-.514-2.301.295-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.499.589.697 1.411.554 2.317zM84.096 13.075h-3.291a.954.954 0 0 0-.787.417l-4.539 6.686-1.924-6.425a.953.953 0 0 0-.912-.678h-3.234a.57.57 0 0 0-.541.754l3.625 10.638-3.408 4.811a.57.57 0 0 0 .465.9h3.287a.949.949 0 0 0 .781-.408l10.946-15.8a.57.57 0 0 0-.468-.895z"/>
                <path fill="#179BD7" d="M94.992 6.749h-6.84a.95.95 0 0 0-.938.802l-2.766 17.537a.569.569 0 0 0 .562.658h3.51a.665.665 0 0 0 .656-.562l.785-4.971a.95.95 0 0 1 .938-.803h2.164c4.506 0 7.105-2.18 7.785-6.5.307-1.89.012-3.375-.873-4.415-.971-1.142-2.694-1.746-4.983-1.746zm.789 6.405c-.373 2.454-2.248 2.454-4.062 2.454h-1.031l.725-4.583a.568.568 0 0 1 .562-.481h.473c1.234 0 2.4 0 3.002.704.359.42.468 1.044.331 1.906zM115.434 13.075h-3.273a.567.567 0 0 0-.562.481l-.145.916-.23-.332c-.709-1.029-2.289-1.373-3.867-1.373-3.619 0-6.709 2.741-7.311 6.586-.312 1.918.131 3.752 1.219 5.031 1 1.176 2.426 1.666 4.125 1.666 2.916 0 4.533-1.875 4.533-1.875l-.146.91a.57.57 0 0 0 .564.66h2.949a.95.95 0 0 0 .938-.803l1.771-11.209a.571.571 0 0 0-.565-.658zm-4.565 6.374c-.314 1.871-1.801 3.127-3.695 3.127-.949 0-1.711-.305-2.199-.883-.484-.574-.666-1.391-.514-2.301.297-1.855 1.805-3.152 3.67-3.152.93 0 1.686.309 2.184.892.501.589.699 1.411.554 2.317zM119.295 7.23l-2.807 17.858a.569.569 0 0 0 .562.658h2.822c.469 0 .867-.34.939-.803l2.768-17.536a.57.57 0 0 0-.562-.659h-3.16a.571.571 0 0 0-.562.482z" fill="#179BD7"/>
              </svg>
            </div>
            
            {/* SEPA Lastschrift */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <div className="bg-white rounded px-3 py-1 mb-1">
                <span className="text-[#2566AF] font-bold text-lg">SEPA</span>
              </div>
              <p className="text-gray-400 text-xs">Lastschrift</p>
            </div>
            
            {/* Giropay */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <div className="bg-[#000268] rounded px-3 py-2">
                <span className="text-white font-bold text-sm">giropay</span>
              </div>
            </div>
            
            {/* Klarna */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <div className="bg-[#FFB3C7] rounded px-3 py-2">
                <span className="text-[#0A0B09] font-bold text-sm">Klarna.</span>
              </div>
            </div>
            
            {/* Apple Pay */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <div className="bg-black rounded px-3 py-2 flex items-center gap-1">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="white">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                <span className="text-white font-medium text-sm">Pay</span>
              </div>
            </div>
            
            {/* Google Pay */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <div className="bg-white rounded px-3 py-2 flex items-center gap-1 border border-gray-200">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-gray-700 font-medium text-sm">Pay</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ablauf */}
        <div className="bg-white/5 rounded-lg p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">So funktioniert die Zahlung</h3>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold text-sm">1</span>
              </div>
              <div>
                <p className="text-white font-medium">Gewerke auswählen</p>
                <p className="text-gray-400 text-sm">Wählen Sie die Gewerke für Ihr Projekt aus.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold text-sm">2</span>
              </div>
              <div>
                <p className="text-white font-medium">Zahlungsmethode wählen</p>
                <p className="text-gray-400 text-sm">Auf der sicheren Stripe-Zahlungsseite wählen Sie Ihre bevorzugte Methode.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-teal-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold text-sm">3</span>
              </div>
              <div>
                <p className="text-white font-medium">LVs erstellen lassen</p>
                <p className="text-gray-400 text-sm">Nach erfolgreicher Zahlung werden Ihre Leistungsverzeichnisse erstellt.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sicherheitshinweis */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <div>
              <p className="text-green-300 font-medium text-sm">100% Sichere Zahlung</p>
              <p className="text-green-200/70 text-xs mt-1">
                Alle Zahlungen werden über Stripe abgewickelt – einem der weltweit führenden Zahlungsanbieter. 
                Ihre Zahlungsdaten werden verschlüsselt übertragen und niemals auf unseren Servern gespeichert.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // HANDWERKER: Zahlungsmethoden verwalten
  // ============================================
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-6">Zahlungsmethoden</h2>
      
      {message && (
        <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
          <p className="text-green-300">{message}</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Info-Box für Handwerker */}
      <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-4">
        <p className="text-teal-300 text-sm">
          <strong>ℹ️ Automatischer Einzug:</strong> Die Vermittlungsprovision wird bei verbindlicher 
          Auftragserteilung automatisch von Ihrer hinterlegten Zahlungsmethode eingezogen. 
          Sie erhalten für jeden Einzug eine ordnungsgemäße Rechnung per E-Mail.
        </p>
      </div>

      {/* Verfügbare Methoden für Einzug */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <p className="text-gray-400 text-sm mb-3">
          Für den automatischen Provisionseinzug können Sie folgende Zahlungsmethoden hinterlegen:
        </p>
        
        <div className="grid grid-cols-3 gap-3">
          {/* Visa */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-center justify-center min-h-[70px]">
            <svg viewBox="0 0 750 471" className="h-6" xmlns="http://www.w3.org/2000/svg">
              <path d="M278.198 334.228l33.36-195.763h53.358l-33.384 195.763H278.198zm246.394-191.238c-10.57-3.966-27.135-8.222-47.822-8.222-52.725 0-89.863 26.551-90.18 64.604-.632 28.129 26.517 43.822 46.754 53.185 20.77 9.597 27.751 15.716 27.652 24.283-.133 13.123-16.586 19.116-31.924 19.116-21.357 0-32.688-2.967-50.205-10.277l-6.877-3.112-7.488 43.823c12.463 5.466 35.508 10.198 59.438 10.445 56.09 0 92.502-26.246 93.054-66.882.267-22.27-14.016-39.216-44.801-53.188-18.65-9.056-30.072-15.099-29.951-24.269 0-8.137 9.668-16.838 30.556-16.838 17.449-.271 30.088 3.534 39.936 7.5l4.781 2.259 7.233-42.427h-.156zm137.759-4.254h-41.231c-12.773 0-22.332 3.487-27.941 16.234l-79.244 179.402h56.031s9.159-24.121 11.231-29.418c6.123 0 60.555.083 68.336.083 1.596 6.854 6.492 29.335 6.492 29.335h49.512l-43.186-195.636zm-65.417 126.408c4.414-11.279 21.26-54.723 21.26-54.723-.316.521 4.381-11.334 7.074-18.684l3.607 16.878s10.217 46.729 12.352 56.529h-44.293zM209.394 138.465l-52.239 133.496-5.565-27.129c-9.726-31.274-40.025-65.157-73.898-82.12l47.767 171.204 56.455-.063 84.004-195.388h-56.524" fill="#1A1F71"/>
              <path d="M131.92 138.465H47.391l-.682 4.073c66.939 16.204 111.232 55.363 129.618 102.415l-18.709-89.96c-3.229-12.396-12.597-16.095-25.698-16.528" fill="#F9A533"/>
            </svg>
          </div>
          
          {/* Mastercard */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10 flex items-center justify-center min-h-[70px]">
            <svg viewBox="0 0 152 100" className="h-8" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" fill="#EB001B"/>
              <circle cx="102" cy="50" r="45" fill="#F79E1B"/>
              <path d="M76 18.5c-10.5 8.5-17.2 21.5-17.2 36s6.7 27.5 17.2 36c10.5-8.5 17.2-21.5 17.2-36s-6.7-27.5-17.2-36z" fill="#FF5F00"/>
            </svg>
          </div>
          
          {/* SEPA */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10 flex flex-col items-center justify-center min-h-[70px]">
            <div className="bg-white rounded px-2 py-1">
              <span className="text-[#2566AF] font-bold text-sm">SEPA</span>
            </div>
            <p className="text-gray-400 text-xs mt-1">Lastschrift</p>
          </div>
        </div>
        
        <p className="text-gray-400 text-xs mt-4">
          💡 <strong>Empfehlung:</strong> SEPA-Lastschrift ermöglicht schnelle und unkomplizierte Abbuchungen ohne manuelle Freigabe.
        </p>
      </div>

      {/* Gespeicherte Zahlungsmethoden */}
      {paymentMethods.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Hinterlegte Zahlungsmethoden</h3>
          {paymentMethods.map((pm) => (
            <div 
              key={pm.id}
              className={`bg-white/5 rounded-lg p-4 border ${
                pm.isDefault ? 'border-teal-500/50' : 'border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {pm.type === 'card' && pm.card && (
                    <>
                      <div className="w-12 h-8 bg-white/10 rounded flex items-center justify-center">
                        <CardBrandLogo brand={pm.card.brand} />
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          •••• •••• •••• {pm.card.last4}
                        </p>
                        <p className="text-gray-400 text-sm">
                          Gültig bis {pm.card.expMonth}/{pm.card.expYear}
                        </p>
                      </div>
                    </>
                  )}
                  
                  {pm.type === 'sepa_debit' && pm.sepaDebit && (
                    <>
                      <div className="w-12 h-8 bg-white/10 rounded flex items-center justify-center">
                        🏦
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          SEPA •••• {pm.sepaDebit.last4}
                        </p>
                        <p className="text-gray-400 text-sm">
                          Lastschrift
                        </p>
                      </div>
                    </>
                  )}
                  
                  {pm.isDefault && (
                    <span className="px-2 py-1 bg-teal-500/20 text-teal-400 text-xs rounded-full">
                      Standard
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {!pm.isDefault && (
                    <button
                      onClick={() => setAsDefault(pm.id)}
                      className="px-3 py-1 text-sm text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      Als Standard
                    </button>
                  )}
                  <button
                    onClick={() => deletePaymentMethod(pm.id)}
                    disabled={deletingId === pm.id}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    title="Entfernen"
                  >
                    {deletingId === pm.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white/5 rounded-lg p-8 text-center border border-white/10">
          <svg className="w-16 h-16 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
          </svg>
          <p className="text-gray-400 mb-4">Keine Zahlungsmethode hinterlegt</p>
          <p className="text-yellow-400 text-sm">
            ⚠️ Bitte hinterlegen Sie eine Zahlungsmethode für den automatischen Provisionseinzug.
          </p>
        </div>
      )}

      {/* Neue Zahlungsmethode hinzufügen */}
      {showAddForm ? (
        <div className="bg-white/5 rounded-lg p-6 border border-white/20">
          <h3 className="text-lg font-semibold text-white mb-4">Neue Zahlungsmethode hinzufügen</h3>
          <Elements stripe={stripePromise}>
            <PaymentMethodForm
              userType={userType}
              userId={userId}
              onSuccess={() => {
                setShowAddForm(false);
                setMessage('Zahlungsmethode wurde hinzugefügt.');
                loadPaymentMethods();
                setTimeout(() => setMessage(''), 3000);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          </Elements>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full px-4 py-3 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/50 text-teal-400 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/>
          </svg>
          Zahlungsmethode hinzufügen
        </button>
      )}

      {/* Sicherheitshinweis */}
      <div className="bg-white/5 rounded-lg p-4 border border-white/10">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
          </svg>
          <div>
            <p className="text-white font-medium text-sm">Sichere Zahlungsabwicklung</p>
            <p className="text-gray-400 text-xs mt-1">
              Ihre Zahlungsdaten werden verschlüsselt über unseren Zahlungsdienstleister Stripe 
              verarbeitet und niemals auf unseren Servern gespeichert. Stripe ist PCI DSS Level 1 
              zertifiziert – der höchste Sicherheitsstandard in der Zahlungsbranche.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
