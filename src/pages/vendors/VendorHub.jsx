import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ClipboardList, FileSignature, CalendarCheck, Star, HandHeart, Mail, Phone } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { EMAIL, OFFICE } from '../../lib/team';
import './forms.css';

const FORMS = [
  { to: '/apply', Icon: ClipboardList, kicker: 'Market events', title: 'Vend at a P31 Market', body: 'Apply for a booth at our seasonal markets. Official acceptance and event details are emailed to you.', cta: 'Apply to vend', tone: 'night' },
  { to: '/vendors/register', Icon: CalendarCheck, kicker: 'Approved vendors', title: 'Market registration', body: 'Reserve your space at a market: your details, the Vendor Rules & Regulations, your signature and your logo.', cta: 'Register for a market' },
  { to: '/storefront', Icon: FileSignature, kicker: 'Virtual storefront', title: 'Open a virtual storefront', body: 'Your own storefront on p31market.com: the benefits, responsibilities and terms, then the Storefront Agreement, signed online.', cta: 'Start your storefront', tone: 'night' },
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
      lead="Everything a vendor signs or sends us, in one place: apply to vend at a market, open a virtual storefront, register for a market, share feedback, or volunteer."
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
