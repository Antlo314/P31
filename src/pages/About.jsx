import React from 'react';
import './About.css';
import premiumMarketLogo from '../assets/premium_logo_2_1773960279606.png';

const About = () => {
  return (
    <div className="about-v2">
      <div className="container-fluid">
        <div className="about-hero-v2 flex-center">
          <div className="about-hero-content text-center">
            <h1 className="about-title-large">The Vision</h1>
            <img src={premiumMarketLogo} alt="P31" className="about-hero-logo" />
            <p className="about-lead">
              The Proverbs 31 Marketplace is an elite, traveling collective of women creatives. 
              We are defying the standard pop-up formula to bring a majestic, high-end shopping 
              experience to Atlanta and beyond.
            </p>
          </div>
        </div>
        
        <div className="about-story-row">
          <div className="story-text">
            <h2>Rooted in Purpose.</h2>
            <div className="divider-v2"></div>
            <p>
              <em>"Give her of the fruit of her hands; And let her own works praise her in the gates"</em><br/>
              &mdash; Proverbs 31:31 KJV
            </p>
            <p style={{marginTop: '32px'}}>
              We curate spaces where faith and luxury converge. Our mission is to empower women to rise,
              build, and elevate their brand presence. Every curator is hand-selected, representing the 
              pinaccle of craftsmanship, beauty, and entrepreneurial excellence.
            </p>
            
            <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noreferrer" className="btn-primary" style={{marginTop: '40px'}}>
              Apply To Join Us
            </a>
          </div>
          
          <div className="story-contact">
            <h3>Direct Inquiries</h3>
            <ul>
              <li><span className="text-gold">T.</span> 1 (470) 562-2852</li>
              <li><span className="text-gold">E.</span> proverbs31markets@gmail.com</li>
              <li><span className="text-gold">L.</span> Atlanta, GA (Touring)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
