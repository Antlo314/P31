import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { User, Camera, Settings, Layout, ShoppingBag, MessageSquare, LogOut, Save, ExternalLink, ShieldAlert } from 'lucide-react';
import './CuratorDashboard.css';

const CuratorDashboard = () => {
  const { user, profile, curatorData, signOut, fetchUserData } = useAuth();
  const navigate = useNavigate();
  
  const [formLoading, setFormLoading] = useState(false);
  const [editData, setEditData] = useState({
    businessName: '',
    tagline: '',
    bio: '',
    slug: ''
  });

  useEffect(() => {
    if (curatorData) {
      setEditData({
        businessName: curatorData.business_name || '',
        tagline: curatorData.tagline || '',
        bio: curatorData.bio || '',
        slug: curatorData.slug || ''
      });
    }
  }, [curatorData]);

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (!user) {
    return <div className="dashboard-container flex-center">Redirecting to Login...</div>;
  }

  // PAYMENT GATING Logic
  if (curatorData && !curatorData.is_paid) {
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
          <span className="font-headline text-gold">P31 Studio</span>
        </div>
        
        <nav className="sidebar-nav">
          <a href="#" className="nav-item active"><Layout size={20} /> Identity</a>
          <a href="/community" className="nav-item"><MessageSquare size={20} /> Collective Chat</a>
          <a href="/directory" className="nav-item"><ExternalLink size={20} /> View Directory</a>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleSignOut} className="logout-btn"><LogOut size={18} /> Exit Studio</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1 className="font-headline text-primary">Curator <span className="text-gold">Studio</span></h1>
          <p>Welcome back, {profile?.full_name}. Refine your sanctuary’s professional presence.</p>
        </header>

        <div className="dashboard-grid">
          <section className="dashboard-card glass-card">
            <h2 className="card-title text-gold"><User size={20} /> Professional Identity</h2>
            
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
                  <span className="url-prefix">p31market.com/</span>
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
                  rows="5" 
                  value={editData.bio}
                  onChange={(e) => setEditData({...editData, bio: e.target.value})}
                ></textarea>
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
              <h3 className="card-title">Collective Status</h3>
              <div className="status-indicator">
                <span className="status-dot active"></span>
                <span className="status-text">Elite Member</span>
              </div>
              <p className="status-sub">Your sanctuary is established in the June Market.</p>
              {curatorData?.is_early_bird && (
                <div className="early-bird-badge">June Early Bird • Free Store</div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CuratorDashboard;
