import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, X, Info, AlertTriangle } from 'lucide-react';
import './AnnouncementBanner.css';

const AnnouncementBanner = () => {
  const [announcement, setAnnouncement] = useState(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!supabase) return;
    
    const fetchLatest = async () => {
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!error && data) {
          setAnnouncement(data);
        }
      } catch (err) {
        console.warn('Announcement fetch failed:', err.message);
      }
    };

    fetchLatest();
  }, []);

  if (!announcement || !isVisible) return null;

  return (
    <div className={`announcement-banner ${announcement.type}`}>
      <div className="banner-content">
        <span className="banner-icon">
          {announcement.type === 'urgent' ? <AlertTriangle size={16} /> : <Info size={16} />}
        </span>
        <div className="banner-text">
          <span className="banner-title">{announcement.title}</span>
          <span className="banner-desc">{announcement.content}</span>
        </div>
        <button className="banner-close" onClick={() => setIsVisible(false)}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default AnnouncementBanner;
