import React, { useState, useEffect } from 'react';

// Wiederverwendbare E-Mail Verifizierungs-Modal Komponente
// AKTUALISIERT: Kein Dashboard-Zugang vor E-Mail-Verifizierung
export function EmailVerificationModal({ 
  isOpen, 
  email, 
  userName, 
  companyId,  // NEU: Optional für Handwerker
  onResendEmail, 
  onClose,
  userType = 'bauherr' // 'bauherr' oder 'handwerker'
}) {
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [resendStatus, setResendStatus] = useState('');

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResendEmail = async () => {
    if (resendCooldown > 0) return;
    
    setResendStatus('sending');
    setResendCooldown(60); // 60 Sekunden Wartezeit
    setResendAttempts(resendAttempts + 1);
    
    try {
      const result = await onResendEmail();
      if (result.success) {
        setResendStatus('success');
      } else {
        setResendStatus('error');
        setResendCooldown(0);
      }
    } catch (error) {
      setResendStatus('error');
      setResendCooldown(0);
    }
    
    // Status nach 3 Sekunden zurücksetzen
    setTimeout(() => setResendStatus(''), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto p-8 border border-white/20">
        
        {/* Header mit animiertem E-Mail Icon */}
        <div className="text-center mb-6">
          <div className="mx-auto w-24 h-24 bg-gradient-to-br from-teal-500 to-blue-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-2">
            Registrierung erfolgreich!
          </h2>
          <p className="text-gray-300">
            Willkommen bei byndl, {userName}!
          </p>
        </div>

        {/* Betriebs-ID Anzeige (nur für Handwerker) */}
        {companyId && (
          <div className="bg-teal-500/20 border border-teal-500/50 rounded-lg p-4 mb-6">
            <p className="text-teal-300 text-sm mb-1">Ihre Betriebs-ID:</p>
            <p className="text-white font-mono text-lg font-bold">{companyId}</p>
          </div>
        )}

        {/* E-Mail Bestätigung erforderlich */}
        <div className="bg-yellow-500/20 border-l-4 border-yellow-500 rounded-lg p-4 mb-6">
          <h3 className="text-yellow-300 font-semibold mb-2">
            E-Mail-Bestätigung erforderlich
          </h3>
          <p className="text-gray-300 text-sm mb-3">
            Wir haben eine Bestätigungs-E-Mail an folgende Adresse gesendet:
          </p>
          <p className="text-white font-mono bg-black/30 px-3 py-2 rounded text-sm break-all">
            {email}
          </p>
        </div>

        {/* Anweisungen */}
        <div className="space-y-4 mb-6">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-teal-400 font-bold">1</span>
            </div>
            <div>
              <p className="text-white font-medium">Öffnen Sie Ihr E-Mail-Postfach</p>
              <p className="text-gray-400 text-sm">Prüfen Sie auch den Spam-Ordner</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-teal-400 font-bold">2</span>
            </div>
            <div>
              <p className="text-white font-medium">Klicken Sie auf den Bestätigungslink</p>
              <p className="text-gray-400 text-sm">Der Link ist 48 Stunden gültig</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-teal-400 font-bold">3</span>
            </div>
            <div>
              <p className="text-white font-medium">Melden Sie sich an</p>
              <p className="text-gray-400 text-sm">Nach der Bestätigung können Sie alle Funktionen nutzen</p>
            </div>
          </div>
        </div>

        {/* WICHTIG: Kein Dashboard-Zugang ohne Verifizierung */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
          <p className="text-red-300 text-sm">
            <strong>Wichtig:</strong> Sie können sich erst nach der E-Mail-Bestätigung anmelden. 
            Dies dient Ihrer Sicherheit und schützt vor unbefugtem Zugriff.
          </p>
        </div>

        {/* E-Mail erneut senden */}
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6">
          <p className="text-gray-300 text-sm mb-3">
            Keine E-Mail erhalten?
          </p>
          
          {resendStatus === 'success' && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 mb-3">
              <p className="text-green-300 text-sm">✓ E-Mail wurde erneut gesendet!</p>
            </div>
          )}
          
          {resendStatus === 'error' && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-3">
              <p className="text-red-300 text-sm">✗ Fehler beim Versenden. Bitte versuchen Sie es später.</p>
            </div>
          )}
          
          <button
            onClick={handleResendEmail}
            disabled={resendCooldown > 0 || resendStatus === 'sending'}
            className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resendStatus === 'sending' ? (
              <span>E-Mail wird gesendet...</span>
            ) : resendCooldown > 0 ? (
              <span>Erneut senden in {resendCooldown}s</span>
            ) : (
              <span>E-Mail erneut senden</span>
            )}
          </button>
          
          {resendAttempts >= 3 && (
            <p className="text-orange-400 text-xs mt-2">
              Nach 3 Versuchen: Bitte kontaktieren Sie unseren Support unter support@byndl.de
            </p>
          )}
        </div>

        {/* Action Button - NUR Login, kein Dashboard */}
        <div className="space-y-3">
          <button
            onClick={() => {
              onClose();
              window.location.href = `/${userType}/login`;
            }}
            className="w-full px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all font-semibold"
          >
            Zum Login
          </button>
          
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-white/10 backdrop-blur border border-white/30 rounded-lg text-white hover:bg-white/20 transition-all"
          >
            Schließen
          </button>
        </div>
        
        {/* Footer */}
        <p className="text-gray-500 text-xs text-center mt-6">
          Probleme? Kontaktieren Sie uns unter support@byndl.de
        </p>
      </div>
    </div>
  );
}

export default EmailVerificationModal;
