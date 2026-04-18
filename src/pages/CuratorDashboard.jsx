import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Community from './Community'; // Nested import
import { User, Camera, Settings, Layout, ShoppingBag, MessageSquare, LogOut, Save, ExternalLink, ShieldAlert, Leaf, Sparkles, Instagram, Facebook, Globe, MapPin, Phone, Mail, Crown } from 'lucide-react';
import './CuratorDashboard.css';

const CuratorDashboard = () => {
  const { user, profile, curatorData, isAdmin, signOut, fetchUserData } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('identity'); // 'identity', 'community', or 'governance'
  const [profileImage, setProfileImage] = useState(null);
  
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', type: 'info' });
  const [announcements, setAnnouncements] = useState([]);
  
  const [formLoading, setFormLoading] = useState(false);
  const [editData, setEditData] = useState({
    businessName: '',
    tagline: '',
    bio: '',
    slug: '',
    location: '',
    instagram: '',
    facebook: '',
    website: '',
    phone: '',
    publicEmail: ''
  });
  useEffect(() => {
    if (curatorData) {
      setEditData({
        businessName: curatorData.business_name || '',
        tagline: curatorData.tagline || '',
        bio: curatorData.bio || '',
        slug: curatorData.slug || '',
        location: curatorData.location || '',
        instagram: curatorData.instagram || '',
        facebook: curatorData.facebook || '',
        website: curatorData.website || '',
        phone: curatorData.phone || '',
        publicEmail: curatorData.public_email || ''
      });
    }
  }, [curatorData]);

  useEffect(() => {
    if (isAdmin) fetchAnnouncements();
  }, [isAdmin]);

  const fetchAnnouncements = async () => {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (data) setAnnouncements(data);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const { error } = await supabase
        .from('curator_data')
        .update({
          business_name: editData.businessName,
          tagline: editData.tagline,
          bio: editData.bio,
          location: editData.location,
          instagram: editData.instagram,
          facebook: editData.facebook,
          website: editData.website,
          phone: editData.phone,
          public_email: editData.publicEmail,
          slug: editData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '')
        })
        .eq('id', user.id);

      if (error) throw error;
      
      await fetchUserData(user.id);
      alert('Sanctuary Identity Updated Successfully.');
    } catch (err) {
      alert('Error updating profile: ' + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setFormLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      await fetchUserData(user.id);
      alert('Digital Portrait Updated.');
    } catch (err) {
      alert('Error uploading image: ' + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handlePostAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('announcements').insert([{
        ...announcementForm,
        created_by: user.id
      }]);
      if (error) throw error;
      setAnnouncementForm({ title: '', content: '', type: 'info' });
      fetchAnnouncements();
      alert('Global Announcement Published.');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const deleteAnnouncement = async (id) => {
    await supabase.from('announcements').delete().eq('id', id);
    fetchAnnouncements();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (!user) {
    return <div className="dashboard-container flex-center">Redirecting to Login...</div>;
  }

  // PAYMENT GATING Logic (Bypassed for Admins)
  if (curatorData && !curatorData.is_paid && !isAdmin) {
    return (
      <div className="dashboard-container payment-gate">
        <div className="gate-content glass-card shadow-lg text-center">
          <ShieldAlert size={64} className="text-gold mb-4" />
          <h1 className="font-headline text-primary">Establishment Pending</h1>
          <p className="gate-message">
            Check your email for onboarding message and payment link.
          </p>
          <div className="divider-thistle my-4"></div>
          <p className="text-sm opacity-70">Once your early registration fee is verified, your full sanctuary controls will be unlocked.</p>
          <button onClick={handleSignOut} className="btn-outline-primary mt-6">Return to Public Site</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <Leaf className="text-gold" size={24} />
          <span className="font-headline text-gold">P31 Studio</span>
          {isAdmin && <span className="admin-status-pill"><Crown size={12} /> Architect</span>}
        </div>
        
        <nav className="sidebar-nav">
          <button 
            onClick={() => setActiveTab('identity')} 
            className={`nav-item ${activeTab === 'identity' ? 'active' : ''}`}
          >
            <Layout size={20} /> Identity
          </button>
          <button 
            onClick={() => setActiveTab('community')} 
            className={`nav-item ${activeTab === 'community' ? 'active' : ''}`}
          >
            <MessageSquare size={20} /> Collective Chat
          </button>

          {isAdmin && (
            <button 
              onClick={() => setActiveTab('governance')} 
              className={`nav-item ${activeTab === 'governance' ? 'active' : ''}`}
            >
              <Crown size={20} /> Governance
            </button>
          )}

          <Link to="/directory" className="nav-item"><ExternalLink size={20} /> View Directory</Link>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleSignOut} className="logout-btn"><LogOut size={18} /> Exit Studio</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {activeTab === 'identity' && (
          <div className="dashboard-view">
            <header className="dashboard-header">
              <h1 className="font-headline text-primary">Curator <span className="text-gold">Studio</span></h1>
              <p>Welcome back, {profile?.full_name}. Refine your sanctuary’s professional presence.</p>
            </header>

            <div className="dashboard-grid">
              <section className="dashboard-card glass-card">
                <h2 className="card-title text-gold"><User size={20} /> Professional Identity</h2>

                {/* Digital Portrait Section */}
                <div className="avatar-upload-section">
                  <div className="avatar-preview-wrapper" onClick={() => document.getElementById('avatar-input').click()}>
                    <img src={profile?.avatar_url || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200'} alt="Profile" />
                    <div className="avatar-overlay">
                      <Camera size={24} />
                    </div>
                  </div>
                  <input type="file" id="avatar-input" hidden accept="image/*" onChange={handleImageUpload} />
                  <div className="avatar-meta">
                    <h4 className="text-primary font-bold">{profile?.full_name}</h4>
                    <p className="text-xs opacity-60">Architect of {editData.businessName || 'New Sanctuary'}</p>
                  </div>
                </div>
                
                <form onSubmit={handleSave} className="premium-form dashboard-form">
                  <div className="form-group">
                    <label>Business Name</label>
                    <input 
                      type="text" 
                      value={editData.businessName}
                      onChange={(e) => setEditData({...editData, businessName: e.target.value})}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Vanity URL (p31market.com/your-slug)</label>
                    <div className="input-with-prefix">
                      <span className="url-prefix text-olive">p31market.com/</span>
                      <input 
                        type="text" 
                        placeholder="e.g. luxe-candles"
                        value={editData.slug}
                        onChange={(e) => setEditData({...editData, slug: e.target.value})}
                        pattern="[a-zA-Z0-9-]+"
                      />
                    </div>
                    <p className="help-text">Letters, numbers, and hyphens only.</p>
                  </div>

                  <div className="form-group">
                    <label>Sanctuary Tagline</label>
                    <input 
                      type="text" 
                      value={editData.tagline}
                      onChange={(e) => setEditData({...editData, tagline: e.target.value})}
                    />
                  </div>

                  <div className="form-group">
                    <label>The Story (Bio)</label>
                    <textarea 
                      rows="4" 
                      value={editData.bio}
                      onChange={(e) => setEditData({...editData, bio: e.target.value})}
                    ></textarea>
                  </div>

                  <div className="form-row-grid">
                    <div className="form-group">
                      <label><MapPin size={14} /> Studio Location</label>
                      <input 
                        type="text" 
                        placeholder="City, State"
                        value={editData.location}
                        onChange={(e) => setEditData({...editData, location: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label><Phone size={14} /> Concierge Phone</label>
                      <input 
                        type="text" 
                        placeholder="(000) 000-0000"
                        value={editData.phone}
                        onChange={(e) => setEditData({...editData, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label><Mail size={14} /> Business Concierge Email</label>
                    <input 
                      type="email" 
                      placeholder="concierge@yourbrand.com"
                      value={editData.publicEmail}
                      onChange={(e) => setEditData({...editData, publicEmail: e.target.value})}
                    />
                  </div>

                  <div className="form-divider-label">Connectivity (Icons)</div>

                  <div className="form-row-grid">
                    <div className="form-group">
                      <label><Instagram size={14} /> Instagram</label>
                      <input 
                        type="text" 
                        placeholder="@username"
                        value={editData.instagram}
                        onChange={(e) => setEditData({...editData, instagram: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label><Facebook size={14} /> Facebook</label>
                      <input 
                        type="text" 
                        placeholder="facebook.com/page"
                        value={editData.facebook}
                        onChange={(e) => setEditData({...editData, facebook: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label><Globe size={14} /> Brand Website</label>
                    <input 
                      type="url" 
                      placeholder="https://yourbrand.com"
                      value={editData.website}
                      onChange={(e) => setEditData({...editData, website: e.target.value})}
                    />
                  </div>

                  <button type="submit" className="btn-solid-gold" disabled={formLoading}>
                    <Save size={18} /> {formLoading ? 'Synchronizing...' : 'Update Identity'}
                  </button>
                  
                  {editData.slug && (
                    <Link to={`/${editData.slug}`} target="_blank" className="view-live-link text-gold">
                      View Live Storefront <ExternalLink size={14} />
                    </Link>
                  )}
                </form>
              </section>

              <div className="dashboard-sidebar-panels">
                <section className="dashboard-card status-card glass-card">
                  <h3 className="card-title text-forest"><Sparkles size={18} /> Collective Status</h3>
                  <div className="status-indicator">
                    <span className="status-dot active"></span>
                    <span className="status-text">{isAdmin ? 'Master Architect' : 'Elite Member'}</span>
                  </div>
                  <p className="status-sub">
                    {isAdmin 
                      ? "You have ultimate administrative authority over the collective." 
                      : "Your sanctuary is established in the June Market."}
                  </p>
                  <div className="divider-thistle"></div>
                  {(curatorData?.is_early_bird || isAdmin) && (
                    <div className="early-bird-badge botanical-badge">
                      <Leaf size={12} /> {isAdmin ? 'Foundation Founder' : 'June Early Bird • Free Store'}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'community' && (
          <div className="dashboard-chat-view">
             <Community />
          </div>
        )}

        {activeTab === 'governance' && isAdmin && (
          <div className="dashboard-view">
            <header className="dashboard-header">
              <h1 className="font-headline text-primary">Master <span className="text-gold">Governance</span></h1>
              <p>Ultimate architectural authority at your fingertips.</p>
            </header>

            <div className="dashboard-grid admin-grid">
              <section className="dashboard-card glass-card">
                <h2 className="card-title text-gold"><Bell size={20} /> Global Announcement Console</h2>
                <form onSubmit={handlePostAnnouncement} className="premium-form">
                  <div className="form-group">
                    <label>Announcement Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. June Market Updates"
                      value={announcementForm.title}
                      onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Content</label>
                    <textarea 
                      rows="3" 
                      placeholder="Sow the message to the collective..."
                      value={announcementForm.content}
                      onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})}
                      required
                    ></textarea>
                  </div>
                  <div className="form-group">
                    <label>Priority Type</label>
                    <select 
                      value={announcementForm.type}
                      onChange={(e) => setAnnouncementForm({...announcementForm, type: e.target.value})}
                    >
                      <option value="info">Informational (Botanical Green)</option>
                      <option value="urgent">Urgent (Royal Red/Gold)</option>
                    </select>
                  </div>
                  <button type="submit" className="btn-solid-gold">Publish Globally</button>
                </form>
              </section>

              <section className="dashboard-card glass-card">
                <h2 className="card-title text-gold">Active Proclamations</h2>
                <div className="admin-announcements-list">
                  {announcements.map(a => (
                    <div key={a.id} className="admin-announcement-item glass-border">
                      <div className="a-item-text">
                        <strong>{a.title}</strong>
                        <p>{a.content}</p>
                      </div>
                      <button onClick={() => deleteAnnouncement(a.id)} className="text-xs text-red opacity-60 hover:opacity-100">Withdraw</button>
                    </div>
                  ))}
                  {announcements.length === 0 && <p className="opacity-50 italic text-sm">No active proclamations.</p>}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CuratorDashboard;
