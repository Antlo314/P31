import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Community from './Community'; // Nested import
import { User, Camera, Settings, Layout, ShoppingBag, MessageSquare, LogOut, Save, ExternalLink, ShieldAlert, Leaf, Sparkles, Instagram, Facebook, Globe, MapPin, Phone, Mail, Crown, Bell, Users, Trash2, Plus, ShoppingCart, Loader2 } from 'lucide-react';
import './CuratorDashboard.css';

const CuratorDashboard = () => {
  const { user, profile, curatorData, isAdmin, signOut, fetchUserData } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('identity'); // 'identity', 'community', or 'governance'
  const [profileImage, setProfileImage] = useState(null);
  
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', type: 'info' });
  const [announcements, setAnnouncements] = useState([]);
  const [leads, setLeads] = useState([]);
  const [products, setProducts] = useState([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '', image_url: '' });
  const [productImageLoading, setProductImageLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [adminError, setAdminError] = useState(null);
  const [adminFeedbackMap, setAdminFeedbackMap] = useState({}); // state to hold feedback input per vendor
  
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

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setLeads(data);
    } catch (err) {
      console.warn('Leads fetch error:', err.message);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setAnnouncements(data);
    } catch (err) {
      console.warn('Announcements fetch error:', err.message);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').eq('curator_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      if (data) setProducts(data);
    } catch (err) {
      console.warn('Products fetch error:', err.message);
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      setAdminError(null);
      const { data, error } = await supabase.from('curator_data').select('*, profiles(full_name, email)').eq('status', 'pending');
      if (error) throw error;
      if (data) setPendingApprovals(data);
    } catch (err) {
      console.error('Governance fetch error:', err.message);
      setAdminError('Architectural Maintenance Req: ' + err.message);
    }
  };

  useEffect(() => {
    if (user) fetchProducts();
  }, [user]);

  useEffect(() => {
    if (isAdmin && activeTab === 'governance') {
      fetchAnnouncements();
      fetchLeads();
      fetchPendingApprovals();
    }
  }, [isAdmin, activeTab]);

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

  const deleteLead = async (id) => {
    if (window.confirm('Are you sure you want to remove this lead?')) {
      await supabase.from('leads').delete().eq('id', id);
      fetchLeads();
    }
  };

  const handleProductImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProductImageLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `products/${fileName}`;
      await supabase.storage.from('products').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(filePath);
      setProductForm({ ...productForm, image_url: publicUrl });
    } catch (err) {
      alert('Upload error: ' + err.message);
    } finally {
      setProductImageLoading(false);
    }
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    if (products.length >= 10 && !editingProduct) {
      alert('Initial collections are limited to 10 products.');
      return;
    }
    setFormLoading(true);
    try {
      if (editingProduct) {
        await supabase.from('products').update(productForm).eq('id', editingProduct.id);
      } else {
        await supabase.from('products').insert([{ ...productForm, curator_id: user.id }]);
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setProductForm({ name: '', description: '', price: '', image_url: '' });
      fetchProducts();
    } catch (err) {
      alert('Error saving product: ' + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const deleteProduct = async (id) => {
    if (window.confirm('Remove this artisan item from your boutique?')) {
      await supabase.from('products').delete().eq('id', id);
      fetchProducts();
    }
  };

  const submitForApproval = async () => {
    try {
      await supabase.from('curator_data').update({ status: 'pending' }).eq('id', user.id);
      await fetchUserData(user.id);
      alert('Sanctuary submitted for architectural review.');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const approveVendor = async (id, feedback = '') => {
    await supabase.from('curator_data').update({ 
      status: 'approved', 
      is_published: true,
      admin_feedback: feedback 
    }).eq('id', id);
    fetchPendingApprovals();
  };

  const rejectVendor = async (id, feedback) => {
    if (!feedback) {
      alert('Please provide architectural guidance for the curator to improve their sanctuary.');
      return;
    }
    await supabase.from('curator_data').update({ 
      status: 'rejected', 
      admin_feedback: feedback 
    }).eq('id', id);
    fetchPendingApprovals();
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
          <button 
            onClick={() => setActiveTab('storefront')} 
            className={`nav-item ${activeTab === 'storefront' ? 'active' : ''}`}
          >
            <ShoppingBag size={20} /> Storefront
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
                      onFocus={(e) => {
                        if (!e.target.value) setEditData({...editData, website: 'https://'});
                      }}
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

                {/* Architectural Guidance Alert */}
                {curatorData?.admin_feedback && curatorData?.status !== 'approved' && (
                  <div className="admin-feedback-alert glass-card mt-8" style={{ background: 'rgba(58, 28, 54, 0.05)', borderColor: 'var(--metallic-gold)' }}>
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="text-gold mt-1" size={20} />
                      <div>
                        <h4 className="font-bold text-primary">Architectural Guidance</h4>
                        <p className="text-sm italic mt-1 opacity-80">"{curatorData.admin_feedback}"</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <div className="dashboard-sidebar-panels">
                <section className="dashboard-card status-card glass-card">
                  <h3 className="card-title text-forest"><Sparkles size={18} /> Market Status</h3>
                  <div className="status-indicator">
                    <span className={`status-dot ${curatorData?.status === 'approved' ? 'active' : ''}`}></span>
                    <span className="status-text">{
                      curatorData?.status === 'approved' ? 'Market Approved' : 
                      curatorData?.status === 'pending' ? 'Reviewing' : 
                      curatorData?.status === 'rejected' ? 'Fix Requested' : 'Draft Mode'
                    }</span>
                  </div>
                  <p className="status-sub">
                    {curatorData?.status === 'approved' 
                      ? "Your sanctuary is approved for the June Marketplace." 
                      : curatorData?.status === 'pending'
                      ? "Your artifacts are currently under architectural review."
                      : curatorData?.status === 'rejected'
                      ? "Adjustments required. See guidance above."
                      : "Refine your boutique to request market placement."}
                  </p>
                  <div className="divider-thistle"></div>
                  
                  {/* Submission Checklist */}
                  <div className="submission-checklist mb-4">
                    <div className={`check-item ${editData.businessName ? 'success' : 'pending'}`}>
                      {editData.businessName ? '✓' : '○'} Business Identity Set
                    </div>
                    <div className={`check-item ${products.length >= 1 ? 'success' : 'pending'}`}>
                      {products.length >= 1 ? '✓' : '○'} At least 1 Artifact Uploaded
                    </div>
                  </div>

                  {curatorData?.status === 'pending' && (
                    <div className="botanical-badge text-gold animate-pulse">
                      <ShieldAlert size={12} /> Under Review
                    </div>
                  )}

                  {(curatorData?.status === 'draft' || curatorData?.status === 'rejected' || !curatorData?.status) && (
                    <button 
                      onClick={submitForApproval} 
                      className={`btn-solid-gold w-full mt-2 ${(products.length < 1 || !editData.businessName) ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={products.length < 1 || !editData.businessName}
                    >
                      {curatorData?.status === 'rejected' ? 'Resubmit Sanctuary' : 'Submit for Review'}
                    </button>
                  )}
                  <div className="divider-thistle mt-4"></div>
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

        {activeTab === 'storefront' && (
          <div className="dashboard-view boutique-studio">
            <header className="dashboard-header flex-between">
              <div>
                <h1 className="font-headline text-primary">Artisan <span className="text-gold">Studio</span></h1>
                <p>Curate your botanical collection. Limit: 10 artifacts.</p>
              </div>
              <button 
                onClick={() => {
                  setEditingProduct(null);
                  setProductForm({ name: '', description: '', price: '', image_url: '' });
                  setIsProductModalOpen(true);
                }} 
                className="btn-solid-gold flex-center gap-2"
                disabled={products.length >= 10}
              >
                <Plus size={18} /> Add Artifact
              </button>
            </header>

            <div className="products-grid">
              {products.map(p => (
                <div key={p.id} className="product-card glass-card">
                  <div className="product-img-frame">
                    <img src={p.image_url || 'https://via.placeholder.com/400x500?text=Artifact'} alt={p.name} />
                  </div>
                  <div className="product-info">
                    <h3 className="font-headline">{p.name}</h3>
                    <p className="product-price text-gold">${p.price}</p>
                    <div className="product-actions flex-center gap-4 mt-4">
                      <button onClick={() => {
                        setEditingProduct(p);
                        setProductForm({ name: p.name, description: p.description, price: p.price, image_url: p.image_url });
                        setIsProductModalOpen(true);
                      }} className="icon-btn"><Settings size={16} /></button>
                      <button onClick={() => deleteProduct(p.id)} className="icon-btn text-red"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <div className="empty-boutique text-center py-20 opacity-50">
                  <ShoppingCart size={48} className="mx-auto mb-4" />
                  <p className="font-headline">Your collection is empty.</p>
                  <p className="text-sm">Begin by adding your first artisan artifact above.</p>
                </div>
              )}
            </div>

            {/* Product Modal */}
            {isProductModalOpen && (
              <div className="modal-overlay flex-center">
                <div className="modal-content glass-card shadow-2xl p-8 max-w-lg w-full">
                  <h2 className="font-headline text-primary mb-6">{editingProduct ? 'Refine Artifact' : 'New Artisan Item'}</h2>
                  <form onSubmit={saveProduct} className="premium-form">
                    <div className="product-image-uploader mb-6">
                      <div className="image-dropzone" onClick={() => document.getElementById('prod-img-input').click()}>
                        {productImageLoading ? <Loader2 className="animate-spin" /> : (
                          productForm.image_url ? <img src={productForm.image_url} alt="Preview" /> : <><Camera size={32} /> <p className="text-xs mt-2">Upload Photo</p></>
                        )}
                      </div>
                      <input type="file" id="prod-img-input" hidden accept="image/*" onChange={handleProductImageUpload} />
                    </div>
                    <div className="form-group">
                      <label>Artifact Name</label>
                      <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} required />
                    </div>
                    <div className="form-row-grid">
                      <div className="form-group">
                        <label>Price (USD)</label>
                        <input type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} required />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea rows="3" value={productForm.description} onChange={e => setProductForm({...productForm, description: e.target.value})}></textarea>
                    </div>
                    <div className="flex-center gap-4 mt-8">
                      <button type="button" onClick={() => setIsProductModalOpen(false)} className="btn-outline-primary flex-1">Cancel</button>
                      <button type="submit" className="btn-solid-gold flex-1">Save Artifact</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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

            {adminError && (
              <div className="admin-error-banner glass-card mb-8" style={{borderColor: '#ff4b4b', color: '#ff4b4b'}}>
                <strong>⚠️ {adminError}</strong>
                <p className="text-sm mt-1">Please ensure standard database migrations (SQL Editor) are applied to the sanctuary.</p>
              </div>
            )}

            <div className="governance-sections">
              {/* Announcements Section */}
              <div className="dashboard-grid admin-grid mb-12">
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

              {/* Vendor Approvals Section */}
              <div className="mb-12">
                <section className="dashboard-card glass-card">
                  <h2 className="card-title text-gold"><ShieldAlert size={20} /> Vendor Approvals</h2>
                  <div className="admin-announcements-list">
                    {pendingApprovals.map(p => (
                      <div key={p.id} className="admin-governance-item glass-border p-6 mb-4">
                        <div className="flex-between mb-4">
                          <div className="a-item-text">
                            <strong>{p.profiles?.full_name || 'Anonymous'} ({p.business_name || 'Unnamed Biz'})</strong>
                            <p className="text-xs opacity-60">Identity: {p.profiles?.email}</p>
                          </div>
                          <div className="vendor-quick-stats font-label text-gold text-xs">
                            Artifacts: {p.products?.length || '0'}
                          </div>
                        </div>

                        <div className="governance-actions-area">
                          <textarea 
                            placeholder="Provide architectural feedback or adjustment requirements..."
                            className="feedback-input mb-4"
                            value={adminFeedbackMap[p.id] || ''}
                            onChange={(e) => setAdminFeedbackMap({...adminFeedbackMap, [p.id]: e.target.value})}
                          ></textarea>
                          
                          <div className="flex gap-4">
                            <button 
                              onClick={() => approveVendor(p.id, adminFeedbackMap[p.id])} 
                              className="btn-solid-gold btn-xs flex-1"
                            >
                              Grant Market Access
                            </button>
                            <button 
                              onClick={() => rejectVendor(p.id, adminFeedbackMap[p.id])} 
                              className="btn-outline-primary btn-xs flex-1"
                              style={{ color: '#ff4b4b', borderColor: '#ff4b4b' }}
                            >
                              Request Fixes
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {pendingApprovals.length === 0 && <p className="opacity-50 italic text-sm text-center py-8">All sanctuaries currently align with architectural standards.</p>}
                  </div>
                </section>
              </div>

              {/* Lead Management Section */}
              <div className="leads-management-section">
                <section className="dashboard-card glass-card">
                  <header className="flex-between mb-6">
                    <h2 className="card-title text-gold"><Users size={20} /> Subscriber & Lead Console</h2>
                    <span className="text-xs opacity-50 uppercase letter-spacing-2">{leads.length} Total Captured</span>
                  </header>
                  
                  <div className="leads-table-container">
                    <table className="leads-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Full Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads.map(lead => (
                          <tr key={lead.id} className="lead-row">
                            <td className="text-xs">{new Date(lead.created_at).toLocaleDateString()}</td>
                            <td className="font-bold">{lead.full_name}</td>
                            <td><a href={`mailto:${lead.email}`} className="text-olive">{lead.email}</a></td>
                            <td className="opacity-70">{lead.phone || '—'}</td>
                            <td>
                              <button onClick={() => deleteLead(lead.id)} className="icon-btn-delete">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {leads.length === 0 && (
                          <tr>
                            <td colSpan="5" className="text-center py-8 opacity-50">No leads captured yet. Keep building.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default CuratorDashboard;
