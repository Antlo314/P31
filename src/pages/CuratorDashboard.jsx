import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import Community from './Community'; // Nested import
import { User, Camera, Settings, Layout, ShoppingBag, MessageSquare, LogOut, Save, ExternalLink, ShieldAlert, Leaf, Sparkles, Instagram, Facebook, Globe, MapPin, Phone, Mail, Crown, Bell, Plus, Trash2, Send, Copy, Check, ShoppingCart, Loader2, CreditCard, X, QrCode, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import './CuratorDashboard.css';

const CuratorDashboard = () => {
  const { user, profile, curatorData, isAdmin, signOut, fetchUserData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Deriving activeTab from the URL path instead of local state
  const activeTab = location.pathname.split('/').pop() || 'identity';
  const setActiveTab = (tab) => navigate(`/dashboard/${tab}`);

  const [profileImage, setProfileImage] = useState(null);
  
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '', type: 'info' });
  const [announcements, setAnnouncements] = useState([]);
  const [leads, setLeads] = useState([]);
  const [products, setProducts] = useState([]);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ 
    name: '', 
    description: '', 
    price: '', 
    image_url: '', 
    image_urls: [], 
    category: 'Collection', 
    external_url: '', 
    stock_status: 'in_stock' 
  });
  const [productImageLoading, setProductImageLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [partnershipInquiries, setPartnershipInquiries] = useState([]);
  const [reviewingCurator, setReviewingCurator] = useState(null);
  const [reviewingCuratorProducts, setReviewingCuratorProducts] = useState([]);
  const [adminError, setAdminError] = useState(null);
  const [adminFeedbackMap, setAdminFeedbackMap] = useState({}); // state to hold feedback input per vendor
  
  const [testimonials, setTestimonials] = useState([]);
  const [isTestimonialModalOpen, setIsTestimonialModalOpen] = useState(false);
  const [testimonialForm, setTestimonialForm] = useState({ customer_name: '', content: '', rating: 5 });
  
  const [privateMessages, setPrivateMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState(null); // For admin to pick curator
  
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(1);
  
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
    publicEmail: '',
    bannerUrl: '',
    logoUrl: '',
    stripeLink: '',
    cashappTag: '',
    venmoHandle: '',
    otherPaymentLabel: '',
    themePreference: 'classic_gold',
    shopAnnouncement: '',
    customTitle: ''
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
        publicEmail: curatorData.public_email || '',
        bannerUrl: curatorData.banner_url || '',
        logoUrl: curatorData.logo_url || '',
        stripeLink: curatorData.stripe_link || '',
        cashappTag: curatorData.cashapp_tag || '',
        venmoHandle: curatorData.venmo_handle || '',
        otherPaymentLink: curatorData.other_payment_link || '',
        otherPaymentLabel: curatorData.other_payment_label || '',
        themePreference: curatorData.theme_preference || 'classic_gold',
        shopAnnouncement: curatorData.shop_announcement || '',
        customTitle: curatorData.custom_title || ''
      });
    }
  }, [curatorData]);

  useEffect(() => {
    // Show walkthrough if first time or incomplete
    if (curatorData && !curatorData.status && !localStorage.getItem('p31_walkthrough_seen')) {
      setShowWalkthrough(true);
    }
  }, [curatorData]);

  const [linkCopied, setLinkCopied] = useState(false);
  const copyShopLink = () => {
    const fullUrl = `${window.location.origin}/${editData.slug}`;
    navigator.clipboard.writeText(fullUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleBusinessNameChange = (e) => {
    const newName = e.target.value;
    const updates = { businessName: newName };
    
    // Auto-suggest slug only if current slug is based on the OLD name or empty
    const oldNameSlug = editData.businessName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!editData.slug || editData.slug === oldNameSlug || editData.slug.includes("'s-sanctuary")) {
      updates.slug = newName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    }
    
    setEditData({...editData, ...updates});
  };

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

  const fetchPartnershipInquiries = async () => {
    try {
      const { data, error } = await supabase
        .from('partnerships')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPartnershipInquiries(data || []);
    } catch (err) {
      console.warn('Partnership fetch error:', err.message);
    }
  };

  const openReviewer = async (curator) => {
    setReviewingCurator(curator);
    setReviewingCuratorProducts([]); 
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('curator_id', curator.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReviewingCuratorProducts(data || []);
    } catch (err) {
      console.warn('Review product fetch error:', err.message);
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
      fetchPartnershipInquiries();
      fetchAllCurators(); // For messaging
    }
    if (user) {
      fetchTestimonials();
      fetchPrivateMessages();
    }
  }, [isAdmin, activeTab, user]);

  const fetchTestimonials = async () => {
    const { data } = await supabase.from('testimonials').select('*').eq('curator_id', user.id);
    setTestimonials(data || []);
  };

  const fetchPrivateMessages = async () => {
    const { data } = await supabase
      .from('private_messages')
      .select('*, sender:profiles!private_messages_sender_id_fkey(full_name, avatar_url)')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: true });
    setPrivateMessages(data || []);
  };

  const [allCurators, setAllCurators] = useState([]);
  const fetchAllCurators = async () => {
    const { data } = await supabase.from('curator_data').select('*, profiles(full_name)');
    setAllCurators(data || []);
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
          banner_url: editData.bannerUrl,
          logo_url: editData.logoUrl,
          stripe_link: editData.stripeLink,
          cashapp_tag: editData.cashappTag,
          venmo_handle: editData.venmoHandle,
          other_payment_link: editData.otherPaymentLink,
          other_payment_label: editData.otherPaymentLabel,
          theme_preference: editData.themePreference,
          shop_announcement: editData.shopAnnouncement,
          custom_title: editData.customTitle,
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

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setFormLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `banner-${user.id}-${Math.random()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('curator_data')
        .update({ banner_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      await fetchUserData(user.id);
      setEditData(prev => ({ ...prev, bannerUrl: publicUrl }));
      alert('Sanctuary Banner Updated.');
    } catch (err) {
      alert('Error uploading banner: ' + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setFormLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${user.id}-${Math.random()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('curator_data')
        .update({ logo_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      await fetchUserData(user.id);
      setEditData(prev => ({ ...prev, logoUrl: publicUrl }));
      alert('Boutique Logo Updated.');
    } catch (err) {
      alert('Error uploading logo: ' + err.message);
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

    // 1. Client-side Validation (Supabase Free Tier Optimization)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      alert('Artifact portraits must be under 5MB to maintain sanctuary performance.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Only visual artifacts (images) can be uploaded to the boutique.');
      return;
    }

    setProductImageLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
      const filePath = fileName; // Clean path in the 'products' bucket

      const { data, error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        if (uploadError.message.includes('bucket not found')) {
          throw new Error('The products repository has not been initialized. Please contact the Master Architect.');
        }
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(filePath);
      
      setProductForm(prev => ({ 
        ...prev, 
        image_url: prev.image_url || publicUrl, // Set as main if empty
        image_urls: [...(prev.image_urls || []), publicUrl] 
      }));
      alert('Portrait successfully uploaded to the collective.');
    } catch (err) {
      console.error('Upload failure:', err);
      alert('Architectural Error: ' + err.message);
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
      setProductForm({ name: '', description: '', price: '', image_url: '', image_urls: [], category: 'Collection', external_url: '', stock_status: 'in_stock' });
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

  const sendPrivateMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const receiverId = isAdmin ? selectedRecipient : '545b1f22-6780-49a8-a3c6-408812815fb0'; 
    await supabase.from('private_messages').insert([{
      sender_id: user.id,
      receiver_id: receiverId,
      content: newMessage
    }]);
    setNewMessage('');
    fetchPrivateMessages();
  };

  const saveTestimonial = async (e) => {
    e.preventDefault();
    await supabase.from('testimonials').insert([{
      ...testimonialForm,
      curator_id: user.id
    }]);
    setIsTestimonialModalOpen(false);
    setTestimonialForm({ customer_name: '', content: '', rating: 5 });
    fetchTestimonials();
  };

  const deleteTestimonial = async (id) => {
    if (window.confirm('Remove this testimonial?')) {
      await supabase.from('testimonials').delete().eq('id', id);
      fetchTestimonials();
    }
  };

  const toggleFeatured = async (id, currentStatus) => {
    await supabase.from('curator_data').update({ is_featured: !currentStatus }).eq('id', id);
    if (reviewingCurator) setReviewingCurator(prev => ({ ...prev, is_featured: !currentStatus }));
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

  const updateBadges = async (id, badgesString) => {
    const badgesArray = badgesString.split(',').map(s => s.trim()).filter(s => s !== '');
    await supabase.from('curator_data').update({ verification_badges: badgesArray }).eq('id', id);
    if (reviewingCurator) setReviewingCurator(prev => ({ ...prev, verification_badges: badgesArray }));
    fetchPendingApprovals();
  };

  const deletePartnershipInquiry = async (id) => {
    if (window.confirm('Archive this partnership inquiry?')) {
      await supabase.from('partnerships').delete().eq('id', id);
      fetchPartnershipInquiries();
    }
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

          <button 
            onClick={() => setActiveTab('testimonials')} 
            className={`nav-item ${activeTab === 'testimonials' ? 'active' : ''}`}
          >
            <MessageSquare size={20} /> Testimonials
          </button>

          <button 
            onClick={() => setActiveTab('concierge')} 
            className={`nav-item ${activeTab === 'concierge' ? 'active' : ''}`}
          >
            <Bell size={20} /> Concierge
          </button>

          {isAdmin && (
            <button 
              onClick={() => setActiveTab('governance')} 
              className={`nav-item ${activeTab === 'governance' ? 'active' : ''}`}
            >
              <Crown size={20} /> Governance
            </button>
          )}

          <div className="nav-item-with-badge">
            <Link to="/directory" className="nav-item"><ExternalLink size={20} /> View Directory</Link>
            <span className="sidebar-construction-tag">Under Construction</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleSignOut} className="logout-btn"><LogOut size={18} /> Exit Studio</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        <Routes>
          <Route path="/" element={<Navigate to="identity" replace />} />
          <Route path="identity" element={
            <div className="dashboard-view">
            <header className="dashboard-header">
              <h1 className="font-headline text-primary">Curator <span className="text-gold">Studio</span></h1>
              <p>Welcome back, {profile?.full_name}. Refine your sanctuary’s professional presence.</p>
            </header>

            {/* Identity Stats Overview */}
            <div className="stats-row mb-8">
              <div className="stat-pill glass-card">
                <span className="stat-label">Product Views</span>
                <span className="stat-value text-gold">284</span>
              </div>
              <div className="stat-pill glass-card">
                <span className="stat-label">Purchase Clicks</span>
                <span className="stat-value text-gold">42</span>
              </div>
              <div className="stat-pill glass-card">
                <span className="stat-label">Profile Authority</span>
                <span className="stat-value text-gold">88%</span>
              </div>
            </div>

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
                      onChange={handleBusinessNameChange}
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
                       <button 
                         type="button" 
                         onClick={copyShopLink} 
                         className="slug-copy-btn"
                         title="Copy Shop Link"
                       >
                         {linkCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                       </button>
                     </div>
                    <p className="help-text">Letters, numbers, and hyphens only.</p>
                  </div>

                  <div className="form-group">
                    <label>Professional Custom Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Master Artisan, Lead Curator" 
                      value={editData.customTitle}
                      onChange={(e) => setEditData({...editData, customTitle: e.target.value})}
                    />
                    <p className="help-text">Displays next to your name in chat and on your profile.</p>
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

                <div className="form-divider-label">
                  <Sparkles size={16} /> Sanctuary Atmosphere & Themes
                </div>

                <div className="form-group">
                  <label>Shop Theme Aesthetic</label>
                  <select 
                    value={editData.themePreference}
                    onChange={(e) => setEditData({...editData, themePreference: e.target.value})}
                    className="premium-select"
                  >
                    <option value="classic_gold">Classic P31 Gold</option>
                    <option value="midnight_obsidian">Midnight Obsidian (High Contrast)</option>
                    <option value="botanical_green">Botanical Forest (Green Accent)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Global Shop Announcement</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Free shipping on orders over $100!" 
                    value={editData.shopAnnouncement}
                    onChange={(e) => setEditData({...editData, shopAnnouncement: e.target.value})}
                  />
                  <p className="help-text">Appears as a prominent banner at the top of your shop.</p>
                </div>

                <button type="submit" className="btn-solid-gold mt-8" disabled={formLoading}>
                  {formLoading ? 'Synchronizing...' : 'Save Sanctuary Settings'}
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
                      ? "Adjustments required. See guidance below."
                      : "Refine your boutique to request market placement."}
                  </p>

                  {curatorData?.status === 'rejected' && curatorData?.admin_feedback && (
                    <div className="admin-feedback-box glass-border mt-4 p-4" style={{borderColor: 'rgba(255, 75, 75, 0.3)', background: 'rgba(255, 75, 75, 0.03)'}}>
                       <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase mb-2">
                         <ShieldAlert size={14} /> Architect's Guidance
                       </div>
                       <p className="text-sm italic opacity-80" style={{color: 'var(--on-surface)'}}>
                         "{curatorData.admin_feedback}"
                       </p>
                    </div>
                  )}
                  <div className="divider-thistle"></div>
                  
                   <div className="divider-thistle"></div>
                  
                  {/* Submission Checklist */}
                  <div className="submission-checklist mb-4">
                    <h4 className="text-[10px] uppercase tracking-widest opacity-40 mb-3">Sanctuary Progress</h4>
                    <div className={`check-item ${editData.businessName ? 'success' : 'pending'}`}>
                      {editData.businessName ? '✓' : '○'} Brand Identity
                    </div>
                    <div className={`check-item ${products.length >= 1 ? 'success' : 'pending'}`}>
                      {products.length >= 1 ? '✓' : '○'} Artisan Collection ({products.length}/10)
                    </div>
                    <div className={`check-item ${editData.bannerUrl && editData.logoUrl ? 'success' : 'pending'}`}>
                      {editData.bannerUrl && editData.logoUrl ? '✓' : '○'} Shop Aesthetics
                    </div>
                    <div className={`check-item ${(editData.stripeLink || editData.cashappTag || editData.venmoHandle) ? 'success' : 'pending'}`}>
                      {(editData.stripeLink || editData.cashappTag || editData.venmoHandle) ? '✓' : '○'} Payment Connectivity
                    </div>
                  </div>

                  <div className="onboarding-guide-trigger" onClick={() => setShowWalkthrough(true)}>
                    <Sparkles size={14} /> Need architectural guidance?
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

                <section className="dashboard-card glass-card">
                  <h2 className="card-title text-gold"><QrCode size={20} /> Share Your Sanctuary</h2>
                  <div className="qr-share-layout flex flex-col items-center gap-6 py-8">
                    <div className="qr-container p-6 bg-white rounded-2xl shadow-xl border-4 border-gold">
                      <QRCodeSVG 
                        id="sanctuary-qr"
                        value={`${window.location.origin}/${editData.slug}`} 
                        size={200}
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm opacity-70 mb-6">Display this code at physical markets to bridge your digital and physical influence.</p>
                      <button 
                        onClick={() => {
                          const svg = document.getElementById('sanctuary-qr');
                          const svgData = new XMLSerializer().serializeToString(svg);
                          const canvas = document.createElement("canvas");
                          const ctx = canvas.getContext("2d");
                          const img = new Image();
                          img.onload = () => {
                            canvas.width = img.width;
                            canvas.height = img.height;
                            ctx.drawImage(img, 0, 0);
                            const pngFile = canvas.toDataURL("image/png");
                            const downloadLink = document.createElement("a");
                            downloadLink.download = `${editData.slug}-qr-code.png`;
                            downloadLink.href = pngFile;
                            downloadLink.click();
                          };
                          img.src = "data:image/svg+xml;base64," + btoa(svgData);
                        }}
                        className="btn-outline-primary flex items-center gap-2"
                      >
                        <Download size={18} /> Download Brand QR
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
            </div>
          } />

          <Route path="storefront" element={
            <div className="dashboard-view boutique-studio">
            <header className="dashboard-header flex-between">
              <div>
                <h1 className="font-headline text-primary">Marketplace <span className="text-gold">Studio</span></h1>
                <p>Curate your botanical collection and shop aesthetics.</p>
              </div>
              <div className="flex-center gap-4">
                {editData.slug && (
                  <Link to={`/${editData.slug}`} target="_blank" className="btn-outline-primary flex-center gap-2">
                    <ExternalLink size={16} /> View Store
                  </Link>
                )}
                <button 
                  onClick={() => {
                    setEditingProduct(null);
                    setProductForm({ name: '', description: '', price: '', image_url: '', image_urls: [], category: 'Collection', external_url: '' });
                    setIsProductModalOpen(true);
                  }} 
                  className="btn-solid-gold flex-center gap-2"
                  disabled={products.length >= 10}
                >
                  <Plus size={18} /> Add Artifact
                </button>
              </div>
            </header>

            {/* Storefront Aesthetic & Payment Manager */}
            <section className="storefront-aesthetics glass-card mb-8">
              <div className="flex-between mb-6">
                <h2 className="card-title text-gold m-0"><Sparkles size={20} /> Shop Aesthetics & Payments</h2>
                <button onClick={handleSave} className="btn-solid-gold btn-sm" disabled={formLoading}>
                  <Save size={14} /> {formLoading ? 'Saving...' : 'Save Settings'}
                </button>
              </div>

              <div className="aesthetics-grid mb-8">
                <div className="aesthetic-upload">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2 block">Shop Banner</label>
                  <div className="banner-preview-wrapper" onClick={() => document.getElementById('banner-input').click()}>
                    {editData.bannerUrl ? <img src={editData.bannerUrl} alt="Banner" /> : <div className="banner-placeholder"><Camera size={32} /><p>Upload Banner</p></div>}
                    <div className="upload-overlay"><Camera size={24} /></div>
                  </div>
                  <input type="file" id="banner-input" hidden accept="image/*" onChange={handleBannerUpload} />
                </div>
                <div className="aesthetic-upload logo-upload">
                  <label className="text-xs font-bold uppercase tracking-wider opacity-60 mb-2 block">Shop Logo</label>
                  <div className="logo-preview-wrapper" onClick={() => document.getElementById('logo-input').click()}>
                    {editData.logoUrl ? <img src={editData.logoUrl} alt="Logo" /> : <div className="logo-placeholder"><Sparkles size={24} /></div>}
                    <div className="upload-overlay"><Camera size={18} /></div>
                  </div>
                  <input type="file" id="logo-input" hidden accept="image/*" onChange={handleLogoUpload} />
                </div>
              </div>

              <div className="divider-thistle mb-6"></div>

              <div className="payment-config-grid">
                <div className="form-group">
                  <label><CreditCard size={14} /> Stripe Payment Link</label>
                  <input 
                    type="url" 
                    placeholder="https://buy.stripe.com/..." 
                    value={editData.stripeLink}
                    onChange={(e) => setEditData({...editData, stripeLink: e.target.value})}
                  />
                  <p className="help-text">Direct Stripe Checkout or Payment Link.</p>
                </div>

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>CashApp Tag</label>
                    <div className="input-with-prefix">
                      <span className="url-prefix">$</span>
                      <input 
                        type="text" 
                        placeholder="YourTag" 
                        value={editData.cashappTag}
                        onChange={(e) => setEditData({...editData, cashappTag: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Venmo Handle</label>
                    <div className="input-with-prefix">
                      <span className="url-prefix">@</span>
                      <input 
                        type="text" 
                        placeholder="YourUsername" 
                        value={editData.venmoHandle}
                        onChange={(e) => setEditData({...editData, venmoHandle: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-row-grid">
                  <div className="form-group">
                    <label>Other Payment Label</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Zelle, PayPal" 
                      value={editData.otherPaymentLabel}
                      onChange={(e) => setEditData({...editData, otherPaymentLabel: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Other Payment Link/ID</label>
                    <input 
                      type="text" 
                      placeholder="Email or URL" 
                      value={editData.otherPaymentLink}
                      onChange={(e) => setEditData({...editData, otherPaymentLink: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </section>

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
                        setProductForm({ name: p.name, description: p.description, price: p.price, image_url: p.image_url, image_urls: p.image_urls || [], category: p.category || 'Collection', external_url: p.external_url || '', stock_status: p.stock_status || 'in_stock' });
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
                      <div className="avatar-preview-wrapper bg-muted flex-center" onClick={() => document.getElementById('prod-img-input').click()}>
                        {productImageLoading ? <Loader2 className="animate-spin text-gold" /> : (
                          productForm.image_url ? <img src={productForm.image_url} alt="Main" /> : <Plus size={32} className="text-gold" />
                        )}
                      </div>
                      <input type="file" id="prod-img-input" hidden accept="image/*" onChange={handleProductImageUpload} />
                      <p className="help-text">Select the primary artifact portrait.</p>
                    </div>

                    {productForm.image_urls?.length > 0 && (
                      <div className="form-group">
                        <label>Artifact Gallery ({productForm.image_urls.length}/5)</label>
                        <div className="flex gap-2 flex-wrap mt-2">
                          {productForm.image_urls.map((url, i) => (
                            <div key={i} className="relative w-16 h-16 rounded border border-thistle overflow-hidden group">
                              <img src={url} className="w-full h-full object-cover" alt={`Gallery ${i}`} />
                              <button 
                                type="button"
                                onClick={() => setProductForm(prev => ({
                                  ...prev, 
                                  image_urls: prev.image_urls.filter((_, idx) => idx !== i),
                                  image_url: prev.image_url === url ? (prev.image_urls[1] || '') : prev.image_url
                                }))}
                                className="absolute inset-0 bg-red-500/80 text-white flex-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          {productForm.image_urls.length < 5 && (
                            <button type="button" onClick={() => document.getElementById('prod-img-input').click()} className="w-16 h-16 rounded border-2 border-dashed border-thistle flex-center text-gold hover:border-gold transition-colors">
                              <Plus size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Artifact Name</label>
                      <input type="text" value={productForm.name} onChange={e => setProductForm({...productForm, name: e.target.value})} required />
                    </div>
                    <div className="form-row-grid">
                      <div className="form-group">
                        <label>Price (USD)</label>
                        <input type="number" step="0.01" value={productForm.price} onChange={e => setProductForm({...productForm, price: e.target.value})} required />
                      </div>
                      <div className="form-group">
                        <label>Category</label>
                        <select 
                          value={productForm.category} 
                          onChange={e => setProductForm({...productForm, category: e.target.value})}
                          className="premium-select"
                        >
                          <option value="Collection">Collection</option>
                          <option value="Skin">Skin</option>
                          <option value="Wellness">Wellness</option>
                          <option value="Home">Home</option>
                          <option value="Art">Art</option>
                          <option value="Apparel">Apparel</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Availability Status</label>
                        <select 
                          value={productForm.stock_status} 
                          onChange={e => setProductForm({...productForm, stock_status: e.target.value})}
                          className="premium-select"
                        >
                          <option value="in_stock">In Stock</option>
                          <option value="out_of_stock">Sold Out</option>
                          <option value="limited_edition">Limited Edition</option>
                          <option value="pre_order">Pre-Order</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Direct Purchase URL (External Website)</label>
                      <input 
                        type="url" 
                        placeholder="https://yourwebsite.com/product"
                        value={productForm.external_url} 
                        onChange={e => setProductForm({...productForm, external_url: e.target.value})} 
                      />
                      <p className="help-text">Link where customers can actually buy this artifact.</p>
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
          } />

          <Route path="community" element={
            <div className="dashboard-chat-view">
               <Community />
            </div>
          } />

          <Route path="governance" element={
            isAdmin ? (
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
                          <button 
                            onClick={() => openReviewer(p)} 
                            className="btn-solid-gold w-full flex-center gap-2"
                          >
                            <Layout size={16} /> Review Sanctuary Boutique
                          </button>
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

              {/* Partnership Inquiries Section */}
              <div className="mb-12">
                <section className="dashboard-card glass-card">
                  <h2 className="card-title text-gold"><Users size={20} /> Partnership Inquiries</h2>
                  <div className="admin-announcements-list">
                    {partnershipInquiries.map(p => (
                      <div key={p.id} className="admin-governance-item glass-border p-6 mb-4">
                        <div className="flex-between mb-4">
                          <div className="a-item-text">
                            <strong className="text-primary">{p.full_name}</strong>
                            <p className="text-xs opacity-60">{p.email} • {p.phone}</p>
                            <span className="early-bird-badge botanical-badge mt-2" style={{display: 'inline-block'}}>
                              {p.partnership_type} Alignment
                            </span>
                          </div>
                          <button onClick={() => deletePartnershipInquiry(p.id)} className="icon-btn text-red">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="p-4 bg-muted rounded-md text-sm italic opacity-80" style={{background: 'rgba(58, 28, 54, 0.03)'}}>
                          "{p.message}"
                        </div>
                      </div>
                    ))}
                    {partnershipInquiries.length === 0 && (
                      <p className="opacity-50 italic text-sm text-center py-8">No partnership inquiries yet.</p>
                    )}
                  </div>
                </section>
              </div>

              {/* MASTER REVIEWER MODAL */}
              {reviewingCurator && (
                <div className="modal-overlay flex-center" style={{zIndex: 2000}}>
                  <div className="modal-content glass-card shadow-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <header className="flex-between mb-8 border-b border-thistle pb-4">
                      <div>
                        <h2 className="font-headline text-primary">{reviewingCurator.business_name || 'Project: Anonymous'}</h2>
                        <p className="text-sm opacity-60">Architectural Review for {reviewingCurator.profiles?.full_name}</p>
                      </div>
                      <button onClick={() => setReviewingCurator(null)} className="icon-btn"><LogOut size={20} /></button>
                    </header>

                    <div className="review-grid" style={{display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1fr', gap: '3rem'}}>
                      {/* Left: Identity Audit */}
                      <div className="audit-identity">
                        <h4 className="font-label text-gold mb-4">Boutique Identity</h4>
                        <div className="p-6 bg-surface rounded-xl mb-6">
                          <p className="font-headline text-lg mb-2">{reviewingCurator.tagline || 'No Tagline Set'}</p>
                          <p className="text-sm italic opacity-80 mb-4">"{reviewingCurator.bio || 'No Bio Provided'}"</p>
                          <div className="flex gap-4 text-xs opacity-60">
                             <span><MapPin size={12} /> {reviewingCurator.location || 'Remote'}</span>
                             <span><Globe size={12} /> {reviewingCurator.website ? 'Web Presence Verified' : 'No External Link'}</span>
                          </div>
                        </div>

                        <h4 className="font-label text-gold mb-4">Architect's Decision</h4>
                        <textarea 
                          className="feedback-input h-32 mb-4"
                          placeholder="Provide corrections or architectural guidance..."
                          value={adminFeedbackMap[reviewingCurator.id] || ''}
                          onChange={(e) => setAdminFeedbackMap({...adminFeedbackMap, [reviewingCurator.id]: e.target.value})}
                        ></textarea>
                        <div className="flex gap-4">
                          <button 
                            onClick={() => { approveVendor(reviewingCurator.id, adminFeedbackMap[reviewingCurator.id]); setReviewingCurator(null); }}
                            className="btn-solid-gold flex-1"
                          >Approve Sanctuary</button>
                          <button 
                            onClick={() => { rejectVendor(reviewingCurator.id, adminFeedbackMap[reviewingCurator.id]); setReviewingCurator(null); }}
                            className="btn-outline-primary flex-1"
                            style={{color: '#ff4b4b', borderColor: '#ff4b4b'}}
                          >Reject Artifacts</button>
                        </div>

                        <div className="mt-8 pt-8 border-t border-thistle">
                           <h4 className="font-label text-gold mb-4">Promotional Authority</h4>
                           <button 
                             onClick={() => toggleFeatured(reviewingCurator.id, reviewingCurator.is_featured)}
                             className={`btn-outline-primary w-full flex-center gap-2 ${reviewingCurator.is_featured ? 'active-featured' : ''}`}
                             style={reviewingCurator.is_featured ? {background: 'var(--metallic-gold)', color: 'white'} : {}}
                           >
                             <Sparkles size={16} /> {reviewingCurator.is_featured ? 'Curator Featured' : 'Feature this Curator'}
                           </button>
                           <p className="text-[10px] opacity-50 mt-2">Featured curators appear at the top of the P31 Directory.</p>
                        </div>

                        <div className="mt-8 pt-8 border-t border-thistle">
                           <h4 className="font-label text-gold mb-4">Verification Badges</h4>
                           <input 
                             type="text" 
                             className="feedback-input"
                             placeholder="Handmade, Organic, Black-Owned..."
                             defaultValue={reviewingCurator.verification_badges?.join(', ')}
                             onBlur={(e) => updateBadges(reviewingCurator.id, e.target.value)}
                           />
                           <p className="text-[10px] opacity-50 mt-2">Enter badges separated by commas.</p>
                        </div>
                      </div>

                      {/* Right: Artifact Audit */}
                      <div className="audit-artifacts">
                         <h4 className="font-label text-gold mb-4">Artisan Collection ({reviewingCuratorProducts.length})</h4>
                         <div className="review-product-list" style={{display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px'}}>
                            {reviewingCuratorProducts.map(prod => (
                              <div key={prod.id} className="review-prod-item flex gap-4 p-3 glass-card" style={{padding: '0.75rem', transform: 'none'}}>
                                 <img src={prod.image_url} alt="" style={{width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover'}} />
                                 <div style={{flex: 1}}>
                                    <p className="font-bold text-sm">{prod.name}</p>
                                    <p className="text-xs text-gold">${prod.price}</p>
                                    <p className="text-[10px] opacity-60 line-clamp-2">{prod.description}</p>
                                 </div>
                              </div>
                            ))}
                            {reviewingCuratorProducts.length === 0 && (
                              <div className="text-center py-10 opacity-40 italic text-sm">
                                 No artifacts have been uploaded to this sanctuary.
                              </div>
                            )}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
              </div>
            ) : <Navigate to="identity" replace />
          } />

          <Route path="testimonials" element={
            <div className="dashboard-view">
              <header className="dashboard-header">
                <h1 className="font-headline text-primary">Customer <span className="text-gold">Voices</span></h1>
                <p>Curate the testimonials that define your brand's reputation for excellence.</p>
              </header>

              <section className="dashboard-card glass-card">
                <div className="flex-between mb-8">
                  <h2 className="card-title text-gold m-0"><MessageSquare size={20} /> Artisan Testimonials</h2>
                  <button onClick={() => setIsTestimonialModalOpen(true)} className="btn-solid-gold btn-sm"><Plus size={16} /> Add Voice</button>
                </div>

                <div className="testimonials-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem'}}>
                  {testimonials.map(t => (
                    <div key={t.id} className="testimonial-item p-6 bg-surface rounded-xl border border-thistle relative">
                      <button onClick={() => deleteTestimonial(t.id)} className="absolute top-2 right-2 text-red-500 opacity-40 hover:opacity-100"><Trash2 size={16} /></button>
                      <div className="flex gap-1 mb-3">
                        {[...Array(t.rating)].map((_, i) => <Sparkles key={i} size={12} className="text-gold" />)}
                      </div>
                      <p className="italic text-sm opacity-80 mb-4">"{t.content}"</p>
                      <p className="font-bold text-xs text-primary">— {t.customer_name}</p>
                    </div>
                  ))}
                  {testimonials.length === 0 && (
                    <div className="col-span-full text-center py-20 opacity-40 italic">
                      No testimonials added yet. Let your customers speak for your craftsmanship.
                    </div>
                  )}
                </div>
              </section>

              {isTestimonialModalOpen && (
                <div className="modal-overlay flex-center">
                  <form onSubmit={saveTestimonial} className="modal-content glass-card p-8 max-w-md w-full">
                    <h2 className="font-headline text-2xl text-primary mb-6">Add Customer Voice</h2>
                    <div className="form-group mb-4">
                      <label>Customer Name</label>
                      <input 
                        type="text" 
                        required 
                        value={testimonialForm.customer_name}
                        onChange={e => setTestimonialForm({...testimonialForm, customer_name: e.target.value})}
                      />
                    </div>
                    <div className="form-group mb-4">
                      <label>Testimonial Content</label>
                      <textarea 
                        required 
                        className="feedback-input"
                        value={testimonialForm.content}
                        onChange={e => setTestimonialForm({...testimonialForm, content: e.target.value})}
                      ></textarea>
                    </div>
                    <div className="form-group mb-6">
                      <label>Rating (1-5)</label>
                      <select 
                        value={testimonialForm.rating}
                        onChange={e => setTestimonialForm({...testimonialForm, rating: parseInt(e.target.value)})}
                        className="premium-select"
                      >
                        {[5,4,3,2,1].map(n => <option key={n} value={n}>{n} Stars</option>)}
                      </select>
                    </div>
                    <div className="flex gap-4">
                      <button type="submit" className="btn-solid-gold flex-1">Add to Profile</button>
                      <button type="button" onClick={() => setIsTestimonialModalOpen(false)} className="btn-outline-primary flex-1">Cancel</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          } />

          <Route path="concierge" element={
            <div className="dashboard-view">
              <header className="dashboard-header">
                <h1 className="font-headline text-primary">Studio <span className="text-gold">Concierge</span></h1>
                <p>Direct architectural guidance from the Master Architects.</p>
              </header>

              <div className="concierge-layout" style={{display: 'grid', gridTemplateColumns: isAdmin ? '300px 1fr' : '1fr', gap: '2rem'}}>
                {isAdmin && (
                  <div className="concierge-sidebar glass-card p-6">
                    <h4 className="font-label text-gold mb-4">Active Curators</h4>
                    <div className="curator-list flex flex-col gap-2">
                      {allCurators.map(c => (
                        <button 
                          key={c.id} 
                          onClick={() => setSelectedRecipient(c.id)}
                          className={`text-left p-3 rounded-lg text-sm transition-all ${selectedRecipient === c.id ? 'bg-gold-light text-white' : 'hover:bg-muted'}`}
                        >
                          {c.profiles?.full_name || 'Anonymous'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="concierge-chat glass-card flex flex-col h-[600px]">
                  <div className="chat-header p-6 border-b border-thistle flex-between">
                    <h3 className="font-label text-primary m-0">
                      {isAdmin ? (selectedRecipient ? `Chatting with ${allCurators.find(c => c.id === selectedRecipient)?.profiles?.full_name}` : 'Select a Curator') : 'Master Architect Concierge'}
                    </h3>
                  </div>
                  
                  <div className="chat-messages flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                    {privateMessages.filter(m => isAdmin ? (m.sender_id === selectedRecipient || m.receiver_id === selectedRecipient) : true).map(m => (
                      <div key={m.id} className={`message-bubble max-w-[80%] p-4 rounded-2xl ${m.sender_id === user.id ? 'bg-gold-light text-white self-end' : 'bg-surface border border-thistle self-start'}`}>
                        <p className="text-sm m-0">{m.content}</p>
                        <span className="text-[10px] opacity-60 mt-1 block">{new Date(m.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))}
                    {(!isAdmin || selectedRecipient) && privateMessages.filter(m => isAdmin ? (m.sender_id === selectedRecipient || m.receiver_id === selectedRecipient) : true).length === 0 && (
                      <div className="text-center py-20 opacity-40 italic">Start the conversation...</div>
                    )}
                  </div>

                  {(!isAdmin || selectedRecipient) && (
                    <form onSubmit={sendPrivateMessage} className="chat-input-area p-6 border-t border-thistle flex gap-4">
                      <input 
                        type="text" 
                        className="feedback-input m-0" 
                        placeholder="Type your message..." 
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                      />
                      <button type="submit" className="btn-solid-gold"><Send size={18} /></button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          } />
        </Routes>
      </main>

      {/* STUDIO WALKTHROUGH OVERLAY */}
      {showWalkthrough && (
        <div className="walkthrough-overlay flex-center">
          <div className="walkthrough-card glass-card shadow-2xl p-10 max-w-md w-full relative">
            <button className="absolute top-4 right-4 opacity-40 hover:opacity-100" onClick={() => {
              setShowWalkthrough(false);
              localStorage.setItem('p31_walkthrough_seen', 'true');
            }}><X size={20} /></button>
            
            <div className="walkthrough-icon-ring mb-6">
              {walkthroughStep === 1 && <Sparkles size={32} className="text-gold" />}
              {walkthroughStep === 2 && <User size={32} className="text-gold" />}
              {walkthroughStep === 3 && <ShoppingBag size={32} className="text-gold" />}
              {walkthroughStep === 4 && <Layout size={32} className="text-gold" />}
              {walkthroughStep === 5 && <CreditCard size={32} className="text-gold" />}
              {walkthroughStep === 6 && <ShieldAlert size={32} className="text-gold" />}
            </div>

            <h2 className="font-headline text-2xl text-primary mb-4">
              {walkthroughStep === 1 && "Welcome, Curator"}
              {walkthroughStep === 2 && "Identity First"}
              {walkthroughStep === 3 && "Curate Artifacts"}
              {walkthroughStep === 4 && "Visual Excellence"}
              {walkthroughStep === 5 && "Accept Payments"}
              {walkthroughStep === 6 && "Master Review"}
            </h2>

            <p className="opacity-80 leading-relaxed mb-8">
              {walkthroughStep === 1 && "Welcome to the P31 Curator Studio. We have created this space for you to build a sanctuary for your brand. Let's walk through the initialization process."}
              {walkthroughStep === 2 && "Start in the 'Identity' tab. Define your business name, story, and vanity URL. This is the foundation of your digital presence."}
              {walkthroughStep === 3 && "In the 'Storefront' tab, upload your first artifacts. Each item represents your craftsmanship. You can list up to 10 products."}
              {walkthroughStep === 4 && "Elevate your shop by uploading a premium banner and logo. Consistent aesthetics build trust and prestige with your customers."}
              {walkthroughStep === 5 && "Ensure you can receive the fruits of your labor. Connect your Stripe, Cash App, or Venmo so customers can purchase directly."}
              {walkthroughStep === 6 && "Once your sanctuary is complete, click 'Submit for Review'. Our architects will vet your shop for the upcoming Marketplace."}
            </p>

            <div className="flex-between">
              <div className="walkthrough-dots">
                {[1,2,3,4,5,6].map(s => (
                  <span key={s} className={`dot ${walkthroughStep === s ? 'active' : ''}`}></span>
                ))}
              </div>
              <button 
                onClick={() => {
                  if (walkthroughStep < 6) setWalkthroughStep(walkthroughStep + 1);
                  else {
                    setShowWalkthrough(false);
                    localStorage.setItem('p31_walkthrough_seen', 'true');
                  }
                }}
                className="btn-solid-gold"
              >
                {walkthroughStep === 6 ? "Begin Curation" : "Next Step"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuratorDashboard;
