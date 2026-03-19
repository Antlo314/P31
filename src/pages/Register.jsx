import React from 'react';

const Register = () => {
  return (
    <div className="register-v2 container-fluid" style={{paddingTop: '20vh', minHeight: '80vh', backgroundColor: 'var(--royal-plum)'}}>
      <div className="text-center" style={{maxWidth: '800px', margin: '0 auto'}}>
        <h1 style={{fontSize: 'clamp(3rem, 6vw, 6rem)', marginBottom: '4vh', color: 'var(--pure-white)', textTransform: 'uppercase', lineHeight: 1}}>
          Join The <span className="text-gold">Collective</span>
        </h1>
        <p style={{fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', marginBottom: '6vh', lineHeight: 1.6}}>
          Are you a woman creative ready to showcase your brand to an audience that values premium craftsmanship? 
          Submit your portfolio for consideration.
        </p>
        
        <a href="https://forms.gle/vmkK7fhgwiYNYEa38" target="_blank" rel="noreferrer" className="btn-primary">
          Begin Curated Application
        </a>
      </div>
    </div>
  );
};

export default Register;
