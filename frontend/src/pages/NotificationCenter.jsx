import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check, Trash2, Clock } from 'lucide-react';

const NotificationCenter = ({ userType, userId, apiUrl }) => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!userId) return;
    
    try {
      const endpoint = userType === 'bauherr' 
        ? `/api/bauherr/${userId}/notifications`
        : `/api/handwerker/${userId}/notifications`;
      
      const res = await fetch(apiUrl(endpoint));
      const data = await res.json();
      setNotifications(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  }, [userId, userType, apiUrl]);

  useEffect(() => {
    loadNotifications();
    // Polling alle 30 Sekunden
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const markAsRead = async (notificationId) => {
    try {
      await fetch(apiUrl(`/api/notifications/${notificationId}/mark-read`), {
        method: 'POST'
      });
      loadNotifications();
    } catch (error) {
      console.error('Fehler:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(apiUrl('/api/notifications/mark-all-read'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType, userId })
      });
      loadNotifications();
    } catch (error) {
      console.error('Fehler:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await fetch(apiUrl(`/api/notifications/${notificationId}`), {
        method: 'DELETE'
      });
      loadNotifications();
    } catch (error) {
      console.error('Fehler:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'new_offer': return '💰';
      case 'new_tender': return '📢';
      case 'preliminary_accepted': return '🤝';
      case 'offer_confirmed': return '✅';
      case 'offer_rejected': return '❌';
      case 'awarded': return '🎉';
      case 'appointment_request': return '📅';
      default: return '🔔';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'new_offer': return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
      case 'new_tender': return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30';
      case 'preliminary_accepted': return 'from-purple-500/20 to-pink-500/20 border-purple-500/30';
      case 'offer_confirmed': return 'from-teal-500/20 to-green-500/20 border-teal-500/30';
      case 'offer_rejected': return 'from-red-500/20 to-orange-500/20 border-red-500/30';
      case 'awarded': return 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
      case 'appointment_request': return 'from-indigo-500/20 to-blue-500/20 border-indigo-500/30';
      default: return 'from-gray-500/20 to-slate-500/20 border-gray-500/30';
    }
  };

  const formatMessage = (notification) => {
    const details = notification.details || {};
    
    switch (notification.type) {
      case 'new_offer':
        return `Neues Angebot von ${details.company_name} für ${details.trade_name} (${formatCurrency(details.amount)})`;
      case 'new_tender':
        return `Neue Ausschreibung: ${details.trade_name} in ${details.project_zip}`;
      case 'preliminary_accepted':
        return `Vorläufige Beauftragung von ${details.bauherr_name} für ${details.trade_name}`;
      case 'offer_confirmed':
        return `${details.company_name} hat das Angebot für ${details.trade_name} bestätigt`;
      case 'offer_rejected':
        return notification.message;
      case 'awarded':
        return `Auftrag erteilt: ${details.trade_name} (${formatCurrency(details.amount)})`;
      case 'appointment_request':
        return `Terminvorschlag von ${details.company_name}`;
      default:
        return notification.message;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <>
      {/* Notification Bell Button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-3 bg-white/10 backdrop-blur rounded-lg border border-white/20 hover:bg-white/20 transition-all"
        >
          <Bell className="w-6 h-6 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Panel */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-96 max-h-[600px] bg-gray-900 rounded-lg border border-white/20 shadow-2xl z-50 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-white/20 bg-gradient-to-r from-purple-600/20 to-blue-600/20">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Benachrichtigungen
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="mt-2 text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Alle als gelesen markieren
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">Keine Benachrichtigungen</p>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-white/5 transition-colors ${
                        !notification.read ? 'bg-white/5' : ''
                      }`}
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
                              {new Date(notification.created_at).toLocaleString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          {notification.type === 'offer_rejected' && notification.metadata && (
                            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs">
                              <p className="text-red-300">
                                {typeof notification.metadata === 'string' 
                                  ? JSON.parse(notification.metadata).reason 
                                  : notification.metadata.reason}
                              </p>
                              {(typeof notification.metadata === 'string' 
                                  ? JSON.parse(notification.metadata).notes 
                                  : notification.metadata.notes) && (
                                <p className="text-gray-400 mt-1">
                                  {typeof notification.metadata === 'string' 
                                    ? JSON.parse(notification.metadata).notes 
                                    : notification.metadata.notes}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                              title="Als gelesen markieren"
                            >
                              <Check className="w-4 h-4 text-green-400" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                            title="Löschen"
                          >
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationCenter;
