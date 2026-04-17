import React, { useState } from 'react';

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', inviteCode: '', password: '' });

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Account creation functionality is currently in development mode.");
  };

  return (
    <div className="register-v2 container-fluid" style={{paddingTop: '20vh', minHeight: '80vh', backgroundColor: 'var(--royal-plum)'}}>
      <div className="text-center" style={{maxWidth: '800px', margin: '0 auto'}}>
        <h1 style={{fontSize: 'clamp(2.5rem, 5vw, 5rem)', marginBottom: '4vh', color: 'var(--pure-white)', textTransform: 'uppercase', lineHeight: 1}}>
          Activate Your <span className="text-gold">Account</span>
        </h1>
        <p style={{fontSize: '1.25rem', color: 'rgba(255,255,255,0.7)', marginBottom: '6vh', lineHeight: 1.6}}>
          Welcome, approved Curator. Please enter your details alongside your official invite code to activate your digital storefront and community access.
        </p>
        
        <div className="register-content" style={{textAlign:'center', marginTop: '2rem', padding: '3rem', background: 'var(--surface)', borderRadius: '24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)'}}>
          <h2 style={{color: 'var(--primary)', marginBottom: '2rem'}}>Member Registration</h2>
          <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px', margin: '0 auto', textAlign: 'left'}}>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              <label style={{color: 'var(--primary)', fontWeight: 600}}>Full Name</label>
              <input type="text" name="name" required value={formData.name} onChange={handleChange} style={{padding: '12px', border: '1px solid var(--outline-variant)', borderRadius: '8px', fontSize: '1rem'}} />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              <label style={{color: 'var(--primary)', fontWeight: 600}}>Approved Email</label>
              <input type="email" name="email" required value={formData.email} onChange={handleChange} style={{padding: '12px', border: '1px solid var(--outline-variant)', borderRadius: '8px', fontSize: '1rem'}} />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              <label style={{color: 'var(--primary)', fontWeight: 600}}>Invite Code</label>
              <input type="text" name="inviteCode" required value={formData.inviteCode} onChange={handleChange} style={{padding: '12px', border: '1px solid var(--outline-variant)', borderRadius: '8px', fontSize: '1rem'}} />
            </div>
            <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
              <label style={{color: 'var(--primary)', fontWeight: 600}}>Create Password</label>
              <input type="password" name="password" required value={formData.password} onChange={handleChange} style={{padding: '12px', border: '1px solid var(--outline-variant)', borderRadius: '8px', fontSize: '1rem'}} />
            </div>
            <button type="submit" className="btn-solid-gold" style={{width: '100%', marginTop: '1rem'}}>Initialize Account</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
