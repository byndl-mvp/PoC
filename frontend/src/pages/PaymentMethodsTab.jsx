// src/pages/PaymentMethodsTab.jsx
import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
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

// Innere Komponente mit Stripe Hooks (für Handwerker)
function PaymentMethodForm({ userType, userId, onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cardComplete, setCardComplete] = useState(false);

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
      
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
        }
      });
      
      if (stripeError) {
        throw new Error(stripeError.message);
      }
      
      if (userType === 'handwerker') {
        await fetch(apiUrl('/api/stripe/set-default-payment-method'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            handwerkerId: userId,
            paymentMethodId: setupIntent.payment_method
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white/10 rounded-lg p-4 border border-white/20">
        <label className="block text-white text-sm font-medium mb-3">
          Kartendaten eingeben
        </label>
        <div className="bg-white rounded-lg p-3">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#1f2937',
                  '::placeholder': { color: '#9ca3af' },
                },
                invalid: { color: '#ef4444' },
              },
            }}
            onChange={(e) => setCardComplete(e.complete)}
          />
        </div>
      </div>
      
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
          disabled={!stripe || !cardComplete || loading}
          className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        >
          {loading ? 'Wird gespeichert...' : 'Speichern'}
        </button>
      </div>
      
      <p className="text-gray-400 text-xs text-center">
        🔒 Ihre Kartendaten werden sicher über Stripe verarbeitet und nicht auf unseren Servern gespeichert.
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
              <img 
                src="https://cdn.brandfolder.io/KGT2DTA4/at/8vbr8k4mr5xjwk4hxq4t9vs/Visa_Brandmark_Blue_RGB.svg" 
                alt="Visa" 
                className="h-8 mb-2"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span className="text-white font-medium text-sm hidden">Visa</span>
            </div>
            
            {/* Mastercard */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <img 
                src="https://brand.mastercard.com/content/dam/mccom/brandcenter/thumbnails/mastercard_vrt_pos_92px_2x.png" 
                alt="Mastercard" 
                className="h-10 mb-2"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span className="text-white font-medium text-sm hidden">Mastercard</span>
            </div>
            
            {/* American Express */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <img 
                src="https://www.aexp-static.com/cdaas/one/statics/axp-static-assets/1.8.0/package/dist/img/logos/dls-logo-bluebox-solid.svg" 
                alt="American Express" 
                className="h-10 mb-2"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span className="text-white font-medium text-sm hidden">Amex</span>
            </div>
            
            {/* PayPal */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <img 
                src="https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-200px.png" 
                alt="PayPal" 
                className="h-8 mb-2"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span className="text-white font-medium text-sm hidden">PayPal</span>
            </div>
            
            {/* SEPA Lastschrift */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Sepa_logo.svg/200px-Sepa_logo.svg.png" 
                alt="SEPA" 
                className="h-8 mb-2"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span className="text-white font-medium text-sm hidden">SEPA</span>
              <p className="text-gray-400 text-xs">Lastschrift</p>
            </div>
            
            {/* Giropay */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <img 
                src="https://www.giropay.de/fileadmin/user_upload/logos/giropay_Logo.svg" 
                alt="Giropay" 
                className="h-8 mb-2"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span className="text-white font-medium text-sm hidden">Giropay</span>
            </div>
            
            {/* Klarna */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <img 
                src="https://x.klarnacdn.net/payment-method/assets/badges/generic/klarna.svg" 
                alt="Klarna" 
                className="h-8 mb-2"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span className="text-white font-medium text-sm hidden">Klarna</span>
            </div>
            
            {/* Apple Pay */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <img 
                src="https://developer.apple.com/assets/elements/icons/apple-pay/apple-pay.svg" 
                alt="Apple Pay" 
                className="h-10 mb-2"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span className="text-white font-medium text-sm hidden">Apple Pay</span>
            </div>
            
            {/* Google Pay */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center min-h-[100px]">
              <img 
                src="https://developers.google.com/static/pay/api/images/brand-guidelines/google-pay-mark.png" 
                alt="Google Pay" 
                className="h-8 mb-2"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span className="text-white font-medium text-sm hidden">Google Pay</span>
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
                Stripe ist PCI DSS Level 1 zertifiziert.
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
