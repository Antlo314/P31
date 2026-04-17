import React from 'react';
import { Link } from 'react-router-dom';

const Community = () => {
  return (
    <div className="container-fluid flex-center" style={{minHeight: '80vh', paddingTop: '20vh', flexDirection: 'column', textAlign: 'center'}}>
      <span className="material-symbols-outlined text-gold" style={{fontSize: '4rem', marginBottom: '1rem'}}>forum</span>
      <h1 className="font-headline text-primary" style={{fontSize: 'clamp(2.5rem, 5vw, 4rem)', marginBottom: '1rem'}}>
        The Collective <span className="text-gold" style={{fontStyle: 'italic'}}>Chat</span>
      </h1>
      <p style={{color: 'var(--on-surface-variant)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 3rem auto', lineHeight: '1.6'}}>
        This highly anticipated community board is currently under construction. Soon, you will be able to connect, share resources, and commune with fellow visionaries.
      </p>
      <Link to="/" className="btn-solid-gold">
        Return Home
      </Link>
    </div>
  );
};

export default Community;
