import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Send, Hash, Users, Bell, Search, Settings } from 'lucide-react';
import './Community.css';

const MOCK_CHANNELS = [
  { id: 'general', name: 'General Collective', unread: 0 },
  { id: 'market-logistics', name: 'Market Logistics', unread: 0 },
  { id: 'wellness', name: 'Wellness & Prayer', unread: 0 },
];

const Community = () => {
  const { user, profile, curatorData } = useAuth();
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  // Fetch initial messages and subscribe to real-time
  useEffect(() => {
    fetchMessages();

    // REAL-TIME SUBSCRIPTION
    const channel = supabase
      .channel(`chat:${activeChannel}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `channel_id=eq.${activeChannel}`
      }, (payload) => {
        // We'll re-fetch or append. Appending is better for performance.
        // For simplicity and to get profile data, we re-fetch the new row
        fetchNewMessage(payload.new.id);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeChannel]);

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        profiles (full_name, avatar_url)
      `)
      .eq('channel_id', activeChannel)
      .order('created_at', { ascending: true });

    if (!error) setMessages(data);
  };

  const fetchNewMessage = async (id) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(full_name, avatar_url)')
      .eq('id', id)
      .single();
    
    if (!error && data) {
      setMessages(prev => [...prev.filter(m => m.id !== id), data]);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    if (!curatorData?.is_paid) {
      alert('Community Chat is reserved for verified Curators. Please check your email for the onboarding message.');
      return;
    }

    const { error } = await supabase
      .from('messages')
      .insert([{
        profile_id: user.id,
        channel_id: activeChannel,
        text: inputText
      }]);

    if (!error) setInputText('');
    else alert('Error sending message: ' + error.message);
  };

  return (
    <div className="community-dashboard">
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <h2 className="font-headline text-gold">Elite Chat</h2>
          <span className="online-status">● P31 Collective</span>
        </div>

        <div className="sidebar-scrollable">
          <div className="channel-section">
            <span className="channel-label">Sanctuary Channels</span>
            <ul className="channel-list">
              {MOCK_CHANNELS.map(channel => (
                <li 
                  key={channel.id} 
                  className={`channel-item ${activeChannel === channel.id ? 'active' : ''}`}
                  onClick={() => setActiveChannel(channel.id)}
                >
                  <Hash size={16} className="channel-icon" />
                  <span className="channel-name">{channel.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-mini-profile">
            <img src={profile?.avatar_url || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100'} alt="User" />
            <div className="user-mini-info">
              <span className="user-mini-name">{profile?.full_name || 'Anonymous'}</span>
              <span className="user-mini-status">{curatorData?.is_paid ? 'Verified Curator' : 'Pending Verification'}</span>
            </div>
            <Settings size={18} className="user-mini-settings" />
          </div>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-header-info">
            <h1 className="font-headline text-primary"># {activeChannel.replace('-', ' ')}</h1>
            <p className="chat-header-desc">Communing with the elite curators of P31.</p>
          </div>
        </header>

        <div className="chat-feed">
          <div className="messages-list">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.profile_id === user?.id ? 'current-user-row' : ''}`}>
                {msg.profile_id !== user?.id && (
                  <div className="message-avatar">
                    <img src={msg.profiles?.avatar_url || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100'} alt={msg.profiles?.full_name} />
                  </div>
                )}
                
                <div className={`message-bubble-container ${msg.profile_id === user?.id ? 'current-user' : ''}`}>
                  <div className="message-meta">
                    <span className="message-author">{msg.profiles?.full_name}</span>
                    <span className="message-time">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                  <div className={`message-bubble ${msg.profile_id === user?.id ? 'bubble-gold' : 'bubble-plum'}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="chat-input-area">
          <form onSubmit={handleSendMessage} className="chat-input-form glass-card">
            <input 
              type="text" 
              placeholder={curatorData?.is_paid ? "Sow your thoughts..." : "Channel locked until verification..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!curatorData?.is_paid}
              className="chat-input"
            />
            <button type="submit" className="chat-send-btn" disabled={!inputText.trim() || !curatorData?.is_paid}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Community;
