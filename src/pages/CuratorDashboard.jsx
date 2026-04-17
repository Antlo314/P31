import React, { useState } from 'react';
import { User, Camera, Settings, Layout, ShoppingBag, MessageSquare, LogOut, Save } from 'lucide-react';
import './CuratorDashboard.css';

const CuratorDashboard = () => {
  const [profile, setProfile] = useState({
    businessName: 'Luminescent Essentials',
    tagline: 'Artisanal candle maker specializing in non-toxic luxury.',
    bio: 'Transforming spaces with divine scents and eco-friendly craftsmanship.',
    avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1bfa82?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80'
  });

  const handleSave = (e) => {
    e.preventDefault();
    console.log('Profile saved:', profile);
    alert('Profile updated successfully (Visual Preview)');
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <span className="font-headline text-gold">P31 Portal</span>
        </div>
        
        <nav className="sidebar-nav">
          <a href="#" className="nav-item active"><Layout size={20} /> Dashboard</a>
          <a href="#" className="nav-item"><User size={20} /> My Profile</a>
          <a href="#" className="nav-item"><ShoppingBag size={20} /> My Storefront</a>
          <a href="/community" className="nav-item"><MessageSquare size={20} /> Community Chat</a>
          <a href="#" className="nav-item"><Settings size={20} /> Settings</a>
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn"><LogOut size={18} /> Sign Out</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h1 className="font-headline text-primary">Curator <span className="text-gold">Studio</span></h1>
          <p>Manage your sanctuary identity and professional presence.</p>
        </header>

        <div className="dashboard-grid">
          {/* Profile Edit Card */}
          <section className="dashboard-card glass-card">
            <h2 className="card-title"><User size={20} className="text-gold" /> Identity Settings</h2>
            
            <form onSubmit={handleSave} className="premium-form dashboard-form">
              <div className="avatar-upload-container">
                <div className="avatar-preview">
                  <img src={profile.avatar} alt="Avatar" />
                  <label className="avatar-upload-btn">
                    <Camera size={16} />
                    <input type="file" hidden />
                  </label>
                </div>
                <p className="upload-help">Recommended: High-fidelity square portrait.</p>
              </div>

              <div className="form-group">
                <label>Business Name</label>
                <input 
                  type="text" 
                  value={profile.businessName}
                  onChange={(e) => setProfile({...profile, businessName: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Professional Tagline</label>
                <input 
                  type="text" 
                  value={profile.tagline}
                  onChange={(e) => setProfile({...profile, tagline: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Our Story (Bio)</label>
                <textarea 
                  rows="4" 
                  value={profile.bio}
                  onChange={(e) => setProfile({...profile, bio: e.target.value})}
                ></textarea>
              </div>

              <button type="submit" className="btn-solid-gold">
                <Save size={18} /> Save Identity Changes
              </button>
            </form>
          </section>

          {/* Quick Stats / Info Card */}
          <div className="dashboard-sidebar-panels">
            <section className="dashboard-card status-card glass-card">
              <h3 className="card-title">Market Status</h3>
              <div className="status-indicator">
                <span className="status-dot active"></span>
                <span className="status-text">Approved Curator</span>
              </div>
              <p className="status-sub">Your profile is visible in the directory.</p>
              <div className="divider-thistle"></div>
              <div className="mini-stat">
                <span className="stat-label">Directory Views</span>
                <span className="stat-val">1,248</span>
              </div>
            </section>

            <section className="dashboard-card tip-card glass-card">
              <h3 className="card-title">Curator Tip</h3>
              <p className="tip-text">"High-quality imagery increases storefront engagement by 40%. Ensure your profile photo reflects your brand's excellence."</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CuratorDashboard;
