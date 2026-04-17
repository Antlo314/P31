import React, { useState, useEffect, useRef } from 'react';
import { Send, Hash, Users, Bell, Search, Settings } from 'lucide-react';
import './Community.css';

const MOCK_CHANNELS = [
  { id: 'general', name: 'General Collective', unread: 0 },
  { id: 'market-logistics', name: 'Market Logistics & Touring', unread: 3 },
  { id: 'wellness', name: 'Wellness & Prayer', unread: 0 },
  { id: 'resources', name: 'Curator Resources', unread: 0 },
];

const INITIAL_MESSAGES = [
  {
    id: 1,
    user: 'Melanie Jeffers-Cameron',
    avatar: 'https://static.wixstatic.com/media/a60154_732e513fd3594078b0b4c1d08679ba20~mv2.png',
    time: '10:04 AM',
    text: 'Good morning ladies! Just a reminder that the vendor applications for the Autumn Gathering close next Friday.',
    isAdmin: true,
  },
  {
    id: 2,
    user: 'Serena James',
    avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1bfa82?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',
    time: '10:15 AM',
    text: 'Submitted mine last night! Highly looking forward to it. Did we finalize the tent dimensions?',
    isAdmin: false,
  },
  {
    id: 3,
    user: 'Aaliyah Brown',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',
    time: '10:32 AM',
    text: 'I believe they are 10x10 standard this time around.',
    isAdmin: false,
  }
];

const Community = () => {
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage = {
      id: Date.now(),
      user: 'You (Preview)',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: inputText,
      isAdmin: false,
      isCurrentUser: true,
    };

    setMessages([...messages, newMessage]);
    setInputText('');
  };

  return (
    <div className="community-dashboard">
      
      {/* ── SIDEBAR ────────────────────────────────────────────── */}
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <h2 className="font-headline text-gold">P31 Collective</h2>
          <span className="online-status">● 42 Members Online</span>
        </div>

        <div className="sidebar-scrollable">
          <div className="channel-section">
            <span className="channel-label">Channels</span>
            <ul className="channel-list">
              {MOCK_CHANNELS.map(channel => (
                <li 
                  key={channel.id} 
                  className={`channel-item ${activeChannel === channel.id ? 'active' : ''}`}
                  onClick={() => setActiveChannel(channel.id)}
                >
                  <Hash size={16} className="channel-icon" />
                  <span className="channel-name">{channel.name}</span>
                  {channel.unread > 0 && <span className="unread-badge">{channel.unread}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-mini-profile">
            <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80" alt="User" />
            <div className="user-mini-info">
              <span className="user-mini-name">Guest Preview</span>
              <span className="user-mini-status">Browsing</span>
            </div>
            <Settings size={18} className="user-mini-settings" />
          </div>
        </div>
      </aside>

      {/* ── MAIN CHAT AREA ─────────────────────────────────────── */}
      <main className="chat-main">
        
        {/* Chat Header */}
        <header className="chat-header">
          <div className="chat-header-info">
            <h1 className="font-headline text-primary">
              # {MOCK_CHANNELS.find(c => c.id === activeChannel)?.name}
            </h1>
            <p className="chat-header-desc">The main assembly for all P31 Curators and Members.</p>
          </div>
          
          <div className="chat-header-actions">
            <div className="chat-search">
              <Search size={16} />
              <input type="text" placeholder="Search archive..." />
            </div>
            <button className="icon-btn"><Bell size={20} /></button>
            <button className="icon-btn"><Users size={20} /></button>
          </div>
        </header>

        {/* Chat Messages Feed */}
        <div className="chat-feed">
          <div className="chat-feed-intro">
            <Hash size={40} className="intro-icon text-gold" />
            <h2>Welcome to #{MOCK_CHANNELS.find(c => c.id === activeChannel)?.name}</h2>
            <p>This is the start of the collaborative history.</p>
          </div>

          <div className="messages-list">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.isCurrentUser ? 'current-user-row' : ''}`}>
                {!msg.isCurrentUser && (
                  <div className="message-avatar">
                    <img src={msg.avatar} alt={msg.user} />
                  </div>
                )}
                
                <div className={`message-bubble-container ${msg.isCurrentUser ? 'current-user' : ''}`}>
                  <div className="message-meta">
                    <span className="message-author">{msg.user}</span>
                    {msg.isAdmin && <span className="admin-badge">Admin</span>}
                    <span className="message-time">{msg.time}</span>
                  </div>
                  <div className={`message-bubble ${msg.isCurrentUser ? 'bubble-gold' : 'bubble-plum'}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Chat Input Area */}
        <div className="chat-input-area">
          <form onSubmit={handleSendMessage} className="chat-input-form glass-card">
            <input 
              type="text" 
              placeholder="Sow your thoughts into the collective..." 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="chat-input"
            />
            <button type="submit" className="chat-send-btn" disabled={!inputText.trim()}>
              <Send size={18} />
            </button>
          </form>
        </div>

      </main>

    </div>
  );
};

export default Community;
