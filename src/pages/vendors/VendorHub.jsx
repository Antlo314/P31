import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, FileSignature, CalendarCheck, Star, HandHeart, Mail, Phone } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { EMAIL, OFFICE } from '../../lib/team';
import './forms.css';

const FORMS = [
  { to: '/apply', Icon: ClipboardList, kicker: 'Start here', title: 'Apply to vend', body: 'The vendor interest form for the Proverbs 31 Market. Official acceptance and event details are emailed to you.', cta: 'Apply', tone: 'night' },
  { to: '/vendors/register', Icon: CalendarCheck, kicker: 'Approved vendors', title: 'Market registration', body: 'Reserve your space at a market: your details, the Vendor Rules & Regulations, your signature and your logo.', cta: 'Register for a market' },
  { to: '/vendors/agreement', Icon: FileSignature, kicker: 'Virtual storefront', title: 'Storefront Agreement', body: 'Finalize your business storefront on P31 Virtual Marketplace: benefits, responsibilities and terms, signed online.', cta: 'Read and sign' },
  { to: '/vendors/feedback', Icon: Star, kicker: 'After a market', title: 'Vendor Feedback Survey', body: 'Tell us honestly how the market went. Every answer shapes the next one.', cta: 'Give feedback' },
  { to: '/volunteer', Icon: HandHeart, kicker: 'Serve with us', title: 'Volunteer', body: 'Help on market day. The Day-of-Event Acknowledgment takes two minutes.', cta: 'Volunteer' },
];

// /vendors — every form a vendor signs or sends, in one place (what JotForm used to hold).
const VendorHub = () => (
  <div className="k-page">
    <PageHeader
      eyebrow="Proverbs 31 Market"
      title="Vendor"
      accent="forms"
      lead="Everything a vendor signs or sends us, in one place: apply, register for a market, sign the storefront agreement, share feedback, or volunteer."
    />
    <section className="k-section">
      <div className="vf-cards" data-reveal-group>
        {FORMS.map((f) => (
          <Link to={f.to} key={f.to} className={`vf-card ${f.tone ? `vf-card--${f.tone}` : ''}`}>
            <span className="k-icon"><f.Icon size={20} /></span>
            <small>{f.kicker}</small>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
            <span className="k-link">{f.cta} <ArrowRight size={14} /></span>
          </Link>
        ))}
        <div className="vf-card" style={{ justifyContent: 'center' }}>
          <small>Help</small>
          <h3>Questions about a form?</h3>
          <p>Write to the market team or call during office hours ({OFFICE.hours}).</p>
          <a href={`mailto:${EMAIL.vendors}`} className="k-link"><Mail size={14} /> {EMAIL.vendors}</a>
          <a href={`tel:${OFFICE.tel}`} className="k-link"><Phone size={14} /> {OFFICE.phone}</a>
        </div>
      </div>
    </section>
  </div>
);

export default VendorHub;
