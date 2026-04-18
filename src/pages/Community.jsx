import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Send, Hash, Users, Bell, Search, Settings, Crown, Leaf, Trash2, MessageCircle, UserPlus, ShieldCheck } from 'lucide-react';
import './Community.css';

const PUBLIC_CHANNELS = [
  { id: 'general', name: 'General Collective', description: 'The main gathering place for P31 Curators.' },
  { id: 'market-logistics', name: 'Market Logistics', description: 'Logistics, scheduling, and infrastructure updates.' },
  { id: 'wellness', name: 'Wellness & Prayer', description: 'Spiritual support and communal well-being.' },
];

const Community = () => {
  const { user, profile, curatorData, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('channels'); // 'channels' or 'dms'
  const [activeChannelId, setActiveChannelId] = useState('general');
  const [activeDmRecipient, setActiveDmRecipient] = useState(null);
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [curators, setCurators] = useState([]);
  const [isLoadingCurators, setIsLoadingCurators] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch curators for DM selection
  useEffect(() => {
    const fetchCurators = async () => {
      setIsLoadingCurators(true);
      try {
        const { data, error } = await supabase
          .from('curator_data')
          .select('*, profiles(full_name, avatar_url, email)')
          .eq('status', 'approved')
          .neq('id', user?.id) // Don't DM yourself
          .order('business_name', { ascending: true });
        
        if (error) throw error;
        setCurators(data || []);
      } catch (err) {
        console.warn('Error fetching curators:', err.message);
      } finally {
        setIsLoadingCurators(false);
      }
    };

    if (user) fetchCurators();
  }, [user]);

  // Fetch initial messages and subscribe to real-time
  useEffect(() => {
    if (!supabase || !user) return;
    
    fetchMessages();

    // REAL-TIME SUBSCRIPTION
    // We listen to the entire messages table for relevant updates
    const channel = supabase
      .channel('collective-chat')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new;
          // Only append if it belongs to the current view
          const isCurrentChannel = !activeDmRecipient && newMsg.channel_id === activeChannelId && !newMsg.recipient_id;
          const isCurrentDm = activeDmRecipient && (
            (newMsg.profile_id === user.id && newMsg.recipient_id === activeDmRecipient.id) ||
            (newMsg.profile_id === activeDmRecipient.id && newMsg.recipient_id === user.id)
          );

          if (isCurrentChannel || isCurrentDm) {
            fetchNewMessage(newMsg.id);
          }
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, activeChannelId, activeDmRecipient]);

  const fetchMessages = async () => {
    let query = supabase
      .from('messages')
      .select(`
        *,
        profiles (full_name, avatar_url, email),
        curator_data:profile_id (is_early_bird)
      `)
      .order('created_at', { ascending: true });

    if (activeDmRecipient) {
      // DM Query: Messages between Me and Recipient
      query = query.or(`and(profile_id.eq.${user.id},recipient_id.eq.${activeDmRecipient.id}),and(profile_id.eq.${activeDmRecipient.id},recipient_id.eq.${user.id})`);
    } else {
      // Channel Query
      query = query.eq('channel_id', activeChannelId).is('recipient_id', null);
    }

    const { data, error } = await query;
    if (!error) setMessages(data);
  };

  const fetchNewMessage = async (id) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(full_name, avatar_url, email), curator_data:profile_id(is_early_bird)')
      .eq('id', id)
      .single();
    
    if (!error && data) {
      setMessages(prev => {
        // Prevent duplicates
        if (prev.find(m => m.id === id)) return prev;
        return [...prev, data];
      });
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;

    if (!curatorData?.is_paid && !isAdmin) {
      alert('Collective Communication is reserved for verified Curators.');
      return;
    }

    const messagePayload = {
      profile_id: user.id,
      text: inputText
    };

    if (activeDmRecipient) {
      messagePayload.recipient_id = activeDmRecipient.id;
      messagePayload.channel_id = 'dm'; // Placeholder for consistency
    } else {
      messagePayload.channel_id = activeChannelId;
      messagePayload.recipient_id = null;
    }

    const { error } = await supabase
      .from('messages')
      .insert([messagePayload]);

    if (!error) setInputText('');
    else alert('Error sending message: ' + error.message);
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('Withdraw this message from the collective?')) return;
    
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', msgId);

    if (error) alert('Error deleting: ' + error.message);
  };

  const selectChannel = (id) => {
    setActiveTab('channels');
    setActiveChannelId(id);
    setActiveDmRecipient(null);
    setMessages([]); // Clear for transition effect
  };

  const selectDm = (curator) => {
    setActiveTab('dms');
    setActiveDmRecipient(curator);
    setActiveChannelId('dm');
    setMessages([]); // Clear for transition effect
  };

  const activeHeaderTitle = activeDmRecipient 
    ? `Private: ${activeDmRecipient.profiles?.full_name}`
    : `# ${activeChannelId.replace('-', ' ')}`;

  const activeHeaderDesc = activeDmRecipient
    ? `Secure transmission with ${activeDmRecipient.business_name}.`
    : PUBLIC_CHANNELS.find(c => c.id === activeChannelId)?.description;

  return (
    <div className="community-dashboard">
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <h2 className="font-headline text-gold">Elite Chat</h2>
          <span className="online-status">● P31 Collective</span>
        </div>

        <div className="sidebar-scrollable">
          {/* Public Channels */}
          <div className="channel-section">
            <span className="channel-label">Sanctuary Channels</span>
            <ul className="channel-list">
              {PUBLIC_CHANNELS.map(channel => (
                <li 
                  key={channel.id} 
                  className={`channel-item ${!activeDmRecipient && activeChannelId === channel.id ? 'active' : ''}`}
                  onClick={() => selectChannel(channel.id)}
                >
                  <Hash size={16} className="channel-icon" />
                  <span className="channel-name">{channel.name}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Direct Messages */}
          <div className="channel-section mt-8">
            <div className="flex-between pr-2">
              <span className="channel-label">Elite Contacts</span>
              <Users size={12} className="opacity-40" />
            </div>
            <ul className="channel-list">
              {curators.map(curator => (
                <li 
                  key={curator.id} 
                  className={`channel-item ${activeDmRecipient?.id === curator.id ? 'active' : ''}`}
                  onClick={() => selectDm(curator)}
                >
                  <div className="dm-avatar-mini">
                    <img src={curator.profiles?.avatar_url || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=40'} alt="Avatar" />
                  </div>
                  <span className="channel-name">{curator.profiles?.full_name}</span>
                  {activeDmRecipient?.id === curator.id && <ShieldCheck size={12} className="text-gold" />}
                </li>
              ))}
              {curators.length === 0 && !isLoadingCurators && (
                <li className="channel-item opacity-40 italic text-xs">No other curators found.</li>
              )}
            </ul>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-mini-profile">
            <img src={profile?.avatar_url || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100'} alt="User" />
            <div className="user-mini-info">
              <span className="user-mini-name">{profile?.full_name || 'Anonymous'}</span>
              <span className="user-mini-status">{curatorData?.is_paid || isAdmin ? 'Verified Curator' : 'Pending Verification'}</span>
            </div>
            <Settings size={18} className="user-mini-settings" />
          </div>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-header-info">
            <h1 className="font-headline text-primary">{activeHeaderTitle}</h1>
            <p className="chat-header-desc">{activeHeaderDesc}</p>
          </div>
          <div className="chat-header-actions">
             {activeDmRecipient && <div className="botanical-badge text-gold"><ShieldCheck size={12} /> Encrypted</div>}
          </div>
        </header>

        <div className="chat-feed">
          <div className="messages-list">
            {messages.map((msg) => {
              const msgIsAdmin = ['info@lumenlabsatl.com', 'proverbs31markets@gmail.com'].includes(msg.profiles?.email?.toLowerCase());
              const msgIsFounder = msg.curator_data?.[0]?.is_early_bird;
              const isMine = msg.profile_id === user?.id;
              const canDelete = isMine || isAdmin;

              return (
                <div key={msg.id} className={`message-row ${isMine ? 'current-user-row' : ''}`}>
                  {!isMine && (
                    <div className="message-avatar">
                      <img src={msg.profiles?.avatar_url || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100'} alt={msg.profiles?.full_name} />
                    </div>
                  )}
                  
                  <div className={`message-bubble-container ${isMine ? 'current-user' : ''}`}>
                    <div className="message-meta">
                      <span className="message-author">
                        {msg.profiles?.full_name}
                        {msgIsAdmin && <Crown size={12} className="meta-prestige text-gold" />}
                        {msgIsFounder && !msgIsAdmin && <Leaf size={12} className="meta-prestige text-olive" />}
                      </span>
                      <span className="message-time">{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      {canDelete && (
                        <button onClick={() => handleDeleteMessage(msg.id)} className="msg-delete-btn" title="Delete Message">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <div className={`message-bubble ${isMine ? 'bubble-gold' : 'bubble-plum'}`}>
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div className="empty-chat-state">
                <MessageCircle size={48} className="opacity-10 mb-4" />
                <p className="opacity-40 italic">The silence is a canvas. Sow the first seed of conversation.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="chat-input-area">
          <form onSubmit={handleSendMessage} className="chat-input-form glass-card">
            <input 
              type="text" 
              placeholder={(curatorData?.is_paid || isAdmin) ? "Sow your thoughts..." : "Channel locked until verification..."}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!curatorData?.is_paid && !isAdmin}
              className="chat-input"
            />
            <button type="submit" className="chat-send-btn" disabled={!inputText.trim() || (!curatorData?.is_paid && !isAdmin)}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};

export default Community;
