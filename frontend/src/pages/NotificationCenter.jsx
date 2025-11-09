import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { Bell, X, Check, Trash2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; 

const NotificationCenter = ({ userType, userId, apiUrl, onNotificationClick, onTabChange, onScheduleReload }) => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  
  // Hilfsfunktion zum sicheren Parsen von metadata
  const parseMetadata = (metadata) => {
    if (!metadata) return {};
    if (typeof metadata === 'object') return metadata;
    try {
      return JSON.parse(metadata);
    } catch (e) {
      console.error('Failed to parse metadata:', e);
      return {};
    }
  };

  // Notifications laden
  const loadNotifications = useCallback(async () => {
    if (!userId || !apiUrl) return;
    
    setIsLoading(true);
    try {
      const endpoint = userType === 'bauherr' 
        ? `/api/bauherr/${userId}/notifications`
        : `/api/handwerker/${userId}/notifications`;
      
      const res = await fetch(apiUrl(endpoint));
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Benachrichtigungen:', error);
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, userType, apiUrl]);

  // Initial laden und Polling
  useEffect(() => {
    if (userId) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [loadNotifications, userId]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        buttonRef.current && 
        dropdownRef.current && 
        !buttonRef.current.contains(event.target) &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // ESC key handler
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const markAsRead = async (notificationId) => {
    try {
      await fetch(apiUrl(`/api/notifications/${notificationId}/mark-read`), {
        method: 'POST'
      });
      await loadNotifications();
    } catch (error) {
      console.error('Fehler beim Markieren als gelesen:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(apiUrl('/api/notifications/mark-all-read'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType, userId })
      });
      await loadNotifications();
    } catch (error) {
      console.error('Fehler beim Markieren aller als gelesen:', error);
    }
  };

  const deleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await fetch(apiUrl(`/api/notifications/${notificationId}`), {
        method: 'DELETE'
      });
      await loadNotifications();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

 const handleNotificationClick = async (notification) => {
  try {
    // Als gelesen markieren
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
   // Ortstermine - zur OrtsterminPage navigieren
    if (notification.type === 'appointment_request' || notification.type === 'appointment_confirmed') {
      console.log('3. Termin-Notification erkannt');
      const metadata = parseMetadata(notification.metadata);
      console.log('4. Metadata:', metadata);
      const offerId = metadata?.offer_id || metadata?.offerId || notification.reference_id;
      console.log('5. OfferId:', offerId);
      console.log('6. Navigiere zu:', `/ortstermin/${offerId}`);
      
      navigate(`/ortstermin/${offerId}`);
      setIsOpen(false);
      return;
    }

    // Deadline-Warnung - zu Ausschreibungen Tab
    if (notification.type === 'deadline_warning') {
      const metadata = parseMetadata(notification.metadata);
      if (metadata.action === 'view_tenders' && onTabChange) {
        onTabChange('tenders');
        setIsOpen(false);  
      }
    }
    
    // Schedule-Notifications - Tab wechseln UND Schedule reload triggern
    if (notification.type === 'schedule_generated' && onScheduleReload) {
      onScheduleReload();
    }
    
    // Andere Notifications - Tab wechseln wenn onTabChange vorhanden ist
    if (onTabChange) {
      const tabMapping = {
        'new_tender': 'ausschreibungen',
        'preliminary_accepted': 'contracts',
        'offer_rejected': 'angebote', 
        'offer_withdrawn': 'angebote',
        'awarded': 'auftraege',
        'work_completed': 'auftraege',
        'message_from_bauherr': 'messages',
        'message_from_handwerker': 'messages',
        'schedule_generated': 'schedule',
        'schedule_active': 'schedule',
        'schedule_change_request': 'contracts',           
        'schedule_changed': 'schedule',
        'schedule_change_accepted': 'schedule',           
        'schedule_change_rejected': 'schedule',           
        'change_request_approved': 'schedule',
        'change_request_rejected': 'schedule'
      };
      
      if (tabMapping[notification.type]) {
        onTabChange(tabMapping[notification.type]);
        setIsOpen(false);
      }
    }
    
    // Falls onNotificationClick Callback vorhanden (für Kompatibilität)
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
    
  } catch (error) {
    console.error('Fehler:', error);
  }
};

  const unreadCount = notifications.filter(n => 
  !n.read && 
  n.type !== 'message_from_bauherr' && 
  n.type !== 'message_from_handwerker'
).length;
  
  const getNotificationIcon = (type) => {
    const icons = {
      'new_offer': '💰',
      'new_tender': '📢',
      'preliminary_accepted': '🤝',
      'offer_confirmed': '✅',
      'offer_rejected': '❌',
      'awarded': '🎉',
      'appointment_request': '📅',
      'appointment_confirmed': '📆',
      'message': '💬',
      'warning': '⚠️',
      'offer_withdrawn': '↩️',
      'message_from_bauherr': '👤',
      'message_from_handwerker': '👷',
      'contract_created': '📄',
      'not_selected': '📭',
      'info': 'ℹ️',
      'work_completed': '✔️',
      'schedule_generated': '📅',
      'schedule_active': '📅',
      'schedule_change_request': '⏰',
      'schedule_changed': '🔄',
      'change_request_approved': '✅',
      'change_request_rejected': '❌',
      'schedule_change_accepted': '✅',
      'schedule_change_rejected': '❌'
  };
    return icons[type] || '🔔';
  };

  const getNotificationColor = (type) => {
    const colors = {
      'new_offer': 'from-green-500/20 to-emerald-500/20 border-green-500/30',
      'new_tender': 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
      'preliminary_accepted': 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
      'offer_confirmed': 'from-teal-500/20 to-green-500/20 border-teal-500/30',
      'offer_rejected': 'from-red-500/20 to-orange-500/20 border-red-500/30',
      'awarded': 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30',
      'appointment_request': 'from-indigo-500/20 to-blue-500/20 border-indigo-500/30',
      'offer_withdrawn': 'from-orange-500/20 to-red-500/20 border-orange-500/30',
      'message_from_bauherr': 'from-blue-500/20 to-purple-500/20 border-blue-500/30',
      'message_from_handwerker': 'from-green-500/20 to-teal-500/20 border-green-500/30',
      'contract_created': 'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
      'not_selected': 'from-gray-500/20 to-gray-600/20 border-gray-500/30',
      'appointment_confirmed': 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
      'work_completed': 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
      'schedule_generated': 'from-blue-600/20 to-teal-600/20 border-blue-500/30',
      'schedule_active': 'from-blue-600/20 to-teal-600/20 border-blue-500/30',
      'schedule_change_request': 'from-orange-600/20 to-red-600/20 border-orange-500/30',
      'schedule_changed': 'from-purple-600/20 to-blue-600/20 border-purple-500/30',
      'change_request_approved': 'from-green-600/20 to-teal-600/20 border-green-500/30',
      'change_request_rejected': 'from-red-600/20 to-orange-600/20 border-red-500/30',
      'schedule_change_accepted': 'from-green-600/20 to-teal-600/20 border-green-500/30',
      'schedule_change_rejected': 'from-red-600/20 to-orange-600/20 border-red-500/30'
    };
    return colors[type] || 'from-gray-500/20 to-slate-500/20 border-gray-500/30';
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'N/A';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatMessage = (notification) => {
  const metadata = parseMetadata(notification.metadata);
  const details = notification.details || metadata || {};
  
  const getValue = (keys, fallback = 'Unbekannt') => {
    for (const key of keys) {
      if (details[key]) return details[key];
    }
    return fallback;
  };
  
  // Projekt-Info hinzufügen
  const projectInfo = details.project_name ? ` - Projekt: ${details.project_name}` : '';
  
  switch (notification.type) {
    case 'new_offer':
      return `Neues Angebot von ${getValue(['company_name', 'companyName'], 'Handwerker')} für ${getValue(['trade_name', 'tradeName'], 'Gewerk')} (${formatCurrency(details.amount)})${projectInfo}`;
    
    case 'new_tender':
      return `Neue Ausschreibung: ${getValue(['trade_name', 'tradeName'], 'Projekt')}${details.project_zip ? ` in ${details.project_zip}` : ''}${projectInfo}`;
    
    case 'preliminary_accepted':
      return `Vorläufige Beauftragung von ${getValue(['bauherr_name', 'bauherrName'], 'Bauherr')} für ${getValue(['trade_name', 'tradeName'], 'Gewerk')}${projectInfo}`;
    
    case 'offer_confirmed':
      return `${getValue(['company_name', 'companyName'], 'Handwerker')} hat das Angebot für ${getValue(['trade_name', 'tradeName'], 'Gewerk')} bestätigt${projectInfo}`;
    
    case 'offer_rejected':
      const reason = details.reason || 'Kein Grund angegeben';
      return `Angebot für ${getValue(['trade_name', 'tradeName'], 'Gewerk')} abgelehnt: ${reason}${projectInfo}`;
    
    case 'offer_withdrawn':
      return `${getValue(['company_name', 'companyName'], 'Handwerker')} hat das Angebot für ${getValue(['trade_name', 'tradeName'], 'Gewerk')} zurückgezogen${projectInfo}`;
    
    case 'awarded':
      return `Auftrag erteilt: ${getValue(['trade_name', 'tradeName'], 'Gewerk')} an ${getValue(['company_name', 'companyName'], 'Handwerker')} (${formatCurrency(details.amount)})${projectInfo}`;
    
    case 'contract_created':
      return `Werkvertrag erstellt für ${getValue(['trade_name', 'tradeName'], 'Gewerk')} mit ${getValue(['company_name', 'companyName'], 'Handwerker')}${projectInfo}`;
    
    case 'not_selected':
      return `Ihr Angebot für ${getValue(['trade_name', 'tradeName'], 'Gewerk')} wurde nicht berücksichtigt${projectInfo}`;
    
    // ZEILE 246 ERSETZEN:
case 'appointment_request':
  const appointmentSender = getValue(['sender_name', 'senderName']) || 
    (getValue(['bauherr_name', 'bauherrName']) || getValue(['company_name', 'companyName'], 'Unbekannt'));
  return `Terminvorschlag von ${appointmentSender} für ${getValue(['trade_name', 'tradeName'], 'Gewerk')}${projectInfo}`;
    
    case 'appointment_confirmed':
      return `Termin bestätigt mit ${getValue(['sender_name', 'senderName', 'company_name'], 'Unbekannt')} für ${getValue(['trade_name', 'tradeName'], 'Gewerk')}${projectInfo}`;
    
    case 'message':
    case 'message_from_bauherr':
      return `Nachricht von ${getValue(['sender_name', 'senderName', 'bauherr_name'], 'Bauherr')}: "${getValue(['message_preview', 'messagePreview'], 'Neue Nachricht')}"${projectInfo}`;
    
    case 'message_from_handwerker':
      return `Nachricht von ${getValue(['sender_name', 'senderName', 'company_name'], 'Handwerker')}: "${getValue(['message_preview', 'messagePreview'], 'Neue Nachricht')}"${projectInfo}`;

    case 'work_completed':
      return `${getValue(['sender_name', 'senderName'], 'Bauherr')} hat die Leistung für ${getValue(['trade_name', 'tradeName'], 'Auftrag')} abgenommen`;

    case 'schedule_generated':
      return `Terminplan wurde erstellt - Bitte prüfen und freigeben${projectInfo}`;
    
    case 'schedule_active':
      return `Terminplan freigegeben - Bitte bestätigen Sie Ihre Einsatzzeiten${projectInfo}`;
    
    case 'schedule_change_request':
      const changeReason = details.reason || 'Keine Begründung angegeben';
      return (
        <div>
          <div className="font-semibold mb-1">
            {getValue(['company_name', 'companyName'], 'Handwerker')} hat Terminänderung für {getValue(['trade_name', 'tradeName'], 'Gewerk')} vorgeschlagen
          </div>
          <div className="text-sm text-gray-400 mt-1 italic">
            Begründung: "{changeReason}"
          </div>
        </div>
      );
    
    case 'schedule_changed':
      return `Terminplan wurde angepasst - Bitte prüfen Sie Ihre Termine${projectInfo}`;
    
    case 'change_request_approved':
      return `Ihre Terminänderung für ${getValue(['trade_name', 'tradeName'], 'Gewerk')} wurde genehmigt${projectInfo}`;
    
    case 'change_request_rejected':
      return `Ihre Terminänderung für ${getValue(['trade_name', 'tradeName'], 'Gewerk')} wurde abgelehnt${details.rejection_reason ? `: ${details.rejection_reason}` : ''}${projectInfo}`;      

    case 'schedule_change_accepted':
      return `Bauherr hat Ihre Terminänderung für ${getValue(['trade_name', 'tradeName'], 'Gewerk')} akzeptiert${projectInfo}`;
    
    case 'schedule_change_rejected':
      const rejectionReason = details.reason || 'Keine Begründung angegeben';
      return `Bauherr hat Ihre Terminänderung für ${getValue(['trade_name', 'tradeName'], 'Gewerk')} abgelehnt: "${rejectionReason}"${projectInfo}`;
      
    default:
      return notification.message || `Neue Benachrichtigung${projectInfo}`;
  }
};
  
  const formatTime = (date) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffInMs = now - notificationDate;
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMinutes < 1) return 'Gerade eben';
    if (diffInMinutes < 60) return `vor ${diffInMinutes} Min.`;
    if (diffInHours < 24) return `vor ${diffInHours} Std.`;
    if (diffInDays < 7) return `vor ${diffInDays} Tag${diffInDays !== 1 ? 'en' : ''}`;
    
    return notificationDate.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  };

  const getDropdownPosition = () => {
    if (!buttonRef.current) return {};
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 600;
    const spaceBelow = window.innerHeight - rect.bottom;
    
    // Position above if not enough space below
    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
      return {
        bottom: window.innerHeight - rect.top + 8,
        right: window.innerWidth - rect.right
      };
    }
    
    return {
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right
    };
  };

  return (
    <>
      {/* Notification Bell Button */}
      <div ref={buttonRef} className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-3 bg-white/10 backdrop-blur rounded-lg border border-white/20 hover:bg-white/20 transition-all group"
          aria-label="Benachrichtigungen"
          aria-expanded={isOpen}
        >
          <Bell className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Notification Panel - Portal */}
      {isOpen && ReactDOM.createPortal(
        <div 
          ref={dropdownRef}
          className="fixed w-96 max-h-[600px] bg-gray-900 rounded-lg border border-white/20 shadow-2xl overflow-hidden flex flex-col animate-fadeIn"
          style={{
            ...getDropdownPosition(),
            zIndex: 999999
          }}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/20 bg-gradient-to-r from-purple-600/20 to-blue-600/20">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Benachrichtigungen
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                    {unreadCount} neu
                  </span>
                )}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                aria-label="Schließen"
              >
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>
            
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="mt-2 text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors"
              >
                <Check className="w-3 h-3" />
                Alle als gelesen markieren
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-gray-400 mt-2">Lade Benachrichtigungen...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Keine Benachrichtigungen</p>
                <p className="text-gray-500 text-xs mt-1">Neue Benachrichtigungen erscheinen hier</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {notifications.map((notification) => {
                  const metadata = parseMetadata(notification.metadata);
                          
                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-white/5 transition-colors cursor-pointer ${
                        !notification.read ? 'bg-white/5' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getNotificationColor(notification.type)} flex items-center justify-center text-xl border`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!notification.read ? 'text-white font-semibold' : 'text-gray-300'}`}>
                            {formatMessage(notification)}
                          </p>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-gray-500" />
                            <span className="text-xs text-gray-500">
                              {formatTime(notification.created_at)}
                            </span>
                          </div>

                          {/* Spezielle Anzeige für abgelehnte Angebote */}
                          {notification.type === 'offer_rejected' && metadata.reason && (
                            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs">
                              <p className="text-red-300 font-semibold">Ablehnungsgrund:</p>
                              <p className="text-red-200 mt-1">{metadata.reason}</p>
                              {metadata.notes && (
                                <p className="text-gray-400 mt-2">
                                  Zusätzliche Anmerkung: {metadata.notes}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Termin-Details */}
                          {(notification.type === 'appointment_request' || notification.type === 'appointment_confirmed') && metadata.date && (
                            <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs">
                              <p className="text-blue-300">
                                📅 {new Date(metadata.date).toLocaleDateString('de-DE', {
                                  weekday: 'long',
                                  day: '2-digit',
                                  month: 'long',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })} Uhr
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="p-1 hover:bg-white/10 rounded transition-colors group"
                              title="Als gelesen markieren"
                            >
                              <Check className="w-4 h-4 text-green-400 group-hover:scale-110 transition-transform" />
                            </button>
                          )}
                          <button
                            onClick={(e) => deleteNotification(notification.id, e)}
                            className="p-1 hover:bg-white/10 rounded transition-colors group"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4 text-red-400 group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default NotificationCenter;
