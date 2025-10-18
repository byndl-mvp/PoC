import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Search, ChevronLeft } from 'lucide-react';

const MessageCenter = ({ userType, userId, userName, apiUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);

  useEffect(() => {
  if (isOpen) {
    loadConversations();
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }
}, [isOpen, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
  if (selectedConversation) {
    loadMessages(selectedConversation.id);
    markAsRead(selectedConversation.id);
    const interval = setInterval(() => loadMessages(selectedConversation.id), 5000);
    return () => clearInterval(interval);
  }
}, [selectedConversation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const res = await fetch(apiUrl(`/api/conversations/${userType}/${userId}`));
      const data = await res.json();
      setConversations(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const res = await fetch(apiUrl(`/api/conversations/${conversationId}/messages`));
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error('Fehler beim Laden:', error);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      await fetch(apiUrl(`/api/conversations/${conversationId}/mark-read`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType, userId })
      });
      loadConversations();
    } catch (error) {
      console.error('Fehler:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    try {
      await fetch(apiUrl(`/api/conversations/${selectedConversation.id}/messages`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderType: userType,
          senderId: userId,
          message: newMessage
        })
      });
      
      setNewMessage('');
      loadMessages(selectedConversation.id);
      loadConversations();
    } catch (error) {
      console.error('Fehler beim Senden:', error);
    }
  };

  const getConversationTitle = (conv) => {
  const info = conv.conversation_info;
  
  switch (conv.type) {
    case 'direct':
      return info?.name || 'Direktnachricht';
    case 'project_group':
      return `📁 ${info?.title || 'Projekt-Gruppe'}`;
    case 'handwerker_coordination':
      // ═══ NEU: Unterschiedlicher Titel je nach User-Typ ═══
      if (userType === 'bauherr') {
        return `👀 Handwerker-Koordination: ${info?.project_title || 'Projekt'}`;
      } else {
        return `🔧 Handwerker-Koordination: ${info?.project_title || 'Projekt'}`;
      }
    default:
      return 'Konversation';
  }
};

  const getConversationSubtitle = (conv) => {
  const info = conv.conversation_info;
  
  if (conv.type === 'direct') {
    return info?.type === 'bauherr' ? 'Bauherr' : 'Handwerker';
  } else if (conv.type === 'handwerker_coordination' && userType === 'bauherr') {
    // ═══ NEU: Hinweis für Bauherr ═══
    return `Sie können mitlesen & Anmerkungen machen`;
  } else {
    return `${info?.member_count || 0} Teilnehmer`;
  }
};

  const totalUnread = Array.isArray(conversations) 
  ? conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)
  : 0;

  const filteredConversations = Array.isArray(conversations)
  ? conversations.filter(conv => {
      const title = getConversationTitle(conv).toLowerCase();
      return title.includes(searchTerm.toLowerCase());
    })
  : [];

  return (
    <>
     {/* Message Icon Button */}
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-3 bg-white/10 backdrop-blur rounded-lg border border-white/20 hover:bg-white/20 transition-all"
      >
        <MessageSquare className="w-6 h-6 text-white" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>
    </div>

    {/* Message Center Panel */}
    {isOpen && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[999999] p-4">
        <div className="bg-gray-900 rounded-lg border border-white/20 shadow-2xl w-full max-w-6xl h-[80vh] flex overflow-hidden">
            
            {/* Sidebar - Conversations List */}
            <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-white/20`}>
              {/* Header */}
              <div className="p-4 border-b border-white/20 bg-gradient-to-r from-teal-600/20 to-blue-600/20">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Nachrichten
                    {totalUnread > 0 && (
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        {totalUnread}
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-white/10 rounded"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Conversations List */}
              <div className="flex-1 overflow-y-auto">
                {filteredConversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">
                      Noch keine Konversationen
                    </p>
                    <p className="text-gray-500 text-xs mt-2">
                      Nachrichten werden nach vorläufiger Beauftragung freigeschaltet
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/10">
                    {filteredConversations.map((conv) => (
                      <button
                        key={conv.id}
                        onClick={() => setSelectedConversation(conv)}
                        className={`w-full p-4 hover:bg-white/5 transition-colors text-left ${
                          selectedConversation?.id === conv.id ? 'bg-white/10' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0 ${
                            conv.type === 'direct' 
                              ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                              : conv.type === 'project_group'
                              ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30'
                              : 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30'
                          }`}>
                            {conv.type === 'direct' ? '💬' : conv.type === 'project_group' ? '📁' : '🔧'}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-semibold text-white text-sm truncate">
                                {getConversationTitle(conv)}
                              </h4>
                              {conv.unread_count > 0 && (
                                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full ml-2">
                                  {conv.unread_count}
                                </span>
                              )}
                            </div>
                            
                            <p className="text-xs text-gray-400 mb-1">
                              {getConversationSubtitle(conv)}
                            </p>
                            
                            {conv.last_message && (
                              <p className="text-xs text-gray-500 truncate">
                                {conv.last_message.sender_name}: {conv.last_message.text}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Main Chat Area */}
            <div className={`${selectedConversation ? 'flex' : 'hidden md:flex'} flex-col flex-1`}>
              {selectedConversation ? (
                <>
                  {/* Chat Header */}
      <div className="p-4 border-b border-white/20 bg-gradient-to-r from-teal-600/10 to-blue-600/10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedConversation(null)}
            className="md:hidden p-2 hover:bg-white/10 rounded"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${
            selectedConversation.type === 'direct' 
              ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30'
              : selectedConversation.type === 'project_group'
              ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30'
              : 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30'
          }`}>
            {selectedConversation.type === 'direct' ? '💬' : selectedConversation.type === 'project_group' ? '📁' : '🔧'}
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold text-white">
              {getConversationTitle(selectedConversation)}
            </h3>
            <p className="text-xs text-gray-400">
              {getConversationSubtitle(selectedConversation)}
            </p>
          </div>
        </div>
        
        {/* ═══ NEU: Info-Banner für Handwerker-Koordination ═══ */}
        {selectedConversation.type === 'handwerker_coordination' && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${
            userType === 'bauherr' 
              ? 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
              : 'bg-orange-500/10 border border-orange-500/30 text-orange-300'
          }`}>
            {userType === 'bauherr' ? (
              <>
                <strong>ℹ️ Beobachter-Modus:</strong> Dies ist der Koordinations-Chat der Handwerker. 
                Sie können mitlesen und bei Bedarf Anmerkungen machen.
              </>
            ) : (
              <>
                <strong>🔧 Handwerker-Koordination:</strong> Koordinieren Sie sich hier mit den anderen 
                Gewerken zur Baustelle. Der Bauherr kann mitlesen.
              </>
            )}
          </div>
        )}
      </div>
      
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, idx) => {
                      const isOwn = msg.sender_type === userType && msg.sender_id === userId;
                      const showSender = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id || messages[idx - 1].sender_type !== msg.sender_type;
                      
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                            {showSender && !isOwn && (
                              <span className="text-xs text-gray-400 mb-1 px-3">
                                {msg.sender_name}
                              </span>
                            )}
                            
                            <div className={`px-4 py-2 rounded-2xl ${
                              isOwn 
                                ? 'bg-gradient-to-r from-teal-500 to-blue-500 text-white'
                                : 'bg-white/10 text-white'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {msg.message}
                              </p>
                            </div>
                            
                            <span className="text-xs text-gray-500 mt-1 px-3">
                              {new Date(msg.created_at).toLocaleTimeString('de-DE', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-white/20 bg-gray-900/50">
                    <div className="flex gap-2">
                      <input
                        ref={messageInputRef}
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                        placeholder="Nachricht schreiben..."
                        className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-teal-500"
                      />
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim()}
                        className="px-6 py-3 bg-gradient-to-r from-teal-500 to-blue-500 text-white rounded-lg hover:from-teal-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Send className="w-5 h-5" />
                        <span className="hidden sm:inline">Senden</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-white mb-2">
                      Wählen Sie eine Konversation
                    </h3>
                    <p className="text-gray-400 text-sm">
                      Wählen Sie links eine Konversation aus, um zu chatten
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageCenter;
