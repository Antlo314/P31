import React, { useState, useEffect } from 'react';
import './OfferTicker.css';

const OfferTicker = () => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isOfferActive, setIsOfferActive] = useState(true);

  // Target Date: May 1st, 2026 00:00:00
  const deadline = new Date('2026-05-01T00:00:00').getTime();

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = deadline - now;

      if (distance < 0) {
        setIsOfferActive(false);
        clearInterval(timer);
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!isOfferActive) return null;

  return (
    <div className="offer-ticker">
      <div className="ticker-content">
        <span className="ticker-badge">Early Bird Offer</span>
        <p className="ticker-text">
          Register for June Market now & get your Storefront <strong>FREE</strong>. 
          Limited time offer: <span className="timer-countdown">{timeLeft}</span>
        </p>
        <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noopener noreferrer" className="ticker-link">
          Apply Now →
        </a>
      </div>
    </div>
  );
};

export default OfferTicker;
