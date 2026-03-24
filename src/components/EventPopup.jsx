import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import './EventPopup.css';

const EventPopup = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Target Date: March 29, 2026 15:30:00 (3:30 PM EST)
    const targetDate = new Date('2026-03-29T15:30:00-05:00').getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="event-popup-overlay">
      <button className="popup-close-btn" onClick={() => setIsVisible(false)}><X size={20} /></button>
      <div className="popup-content">
        <span className="popup-label">The Grand Launch</span>
        <h4 className="popup-title">March 29th, 2026</h4>
        <div className="countdown-grid">
          <div className="cd-box"><span>{timeLeft.days}</span><small>Days</small></div>
          <div className="cd-box"><span>{timeLeft.hours}</span><small>Hours</small></div>
          <div className="cd-box"><span>{timeLeft.minutes}</span><small>Mins</small></div>
          <div className="cd-box"><span>{timeLeft.seconds}</span><small>Secs</small></div>
        </div>
        <a href="https://www.eventbrite.com/e/proverbs-31-marketplace-tickets-1984190041828" target="_blank" rel="noreferrer" className="btn-solid-gold w-100 text-center mt-3" style={{display: 'block', padding: '10px', fontSize: '1rem', marginTop: '1.5rem'}}>
          Secure Your RSVP
        </a>
      </div>
    </div>
  );
};

export default EventPopup;
