import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import LeadPopup from './components/LeadPopup';
import CartSheet from './components/CartSheet';
import OfferTicker from './components/OfferTicker';
import AnnouncementBanner from './components/AnnouncementBanner';
import { ROUTE_META, SITE_NAME, COLLECTIVE_URL, COLLECTIVE_NAME, COLLECTIVE_META, applyMeta } from './lib/seo';
import { isFlushRoute } from './lib/routes';
import { startIntentPreload } from './lib/preload';
import { isCollective, crossSiteTarget } from './lib/site';
import MotionRoot from './components/MotionRoot';
import { CollectiveNav, CollectiveFooter } from './components/CollectiveChrome';

// Everything but the landing page loads on demand, so phones only download
// what they open. The loaders are named so a link can start one early (see INTENT below).
const load = {
  about: () => import('./pages/About'),
  calendar: () => import('./pages/Calendar'),
  directory: () => import('./pages/Directory'),
  curator: () => import('./pages/CuratorProfile'),
  partner: () => import('./pages/Partner'),
  login: () => import('./pages/Login'),
  dashboard: () => import('./pages/CuratorDashboard'),
  onboarding: () => import('./pages/Onboarding'),
  services: () => import('./pages/Services'),
  unsubscribe: () => import('./pages/Unsubscribe'),
  shop: () => import('./pages/Shop'),
  apply: () => import('./pages/VendorApply'),
  // The vendor forms that replaced JotForm: hub, storefront agreement, market registration, feedback, volunteers.
  vendorHub: () => import('./pages/vendors/VendorHub'),
  agreement: () => import('./pages/vendors/StorefrontAgreement'),
  registration: () => import('./pages/vendors/VendorRegistration'),
  feedback: () => import('./pages/vendors/VendorFeedback'),
  volunteer: () => import('./pages/vendors/Volunteer'),
  mentorship: () => import('./academy/Mentorship'),
  portal: () => import('./academy/Portal'),
  collective: () => import('./academy/CollectiveHome'),
  verify: () => import('./academy/Verify'),
  academy: () => import('./academy/AcademyHome'),
  join: () => import('./academy/Join'),
  enroll: () => import('./academy/Enroll'),
  // The team console is its own app: loaded only when someone opens it,
  // and drawn without the public site's header, footer and popups.
  systems: () => import('./systems/SystemsApp'),
  // Member dashboards: mentorship classrooms / mentor consoles, and the Content Studio.
  classroom: () => import('./academy/app/AcademyApp'),
  studio: () => import('./studio/StudioApp'),
  // The team's home: what needs attention across every dashboard they run.
  today: () => import('./today/Today'),
  // The Gathering: P31's community space (vendors, students, mentors, team, overseers).
  gather: () => import('./gather/Gather'),
};
const About = lazy(load.about);
const Calendar = lazy(load.calendar);
const Directory = lazy(load.directory);
const CuratorProfile = lazy(load.curator);
const Partner = lazy(load.partner);
const Login = lazy(load.login);
const CuratorDashboard = lazy(load.dashboard);
const Onboarding = lazy(load.onboarding);
const Services = lazy(load.services);
const Unsubscribe = lazy(load.unsubscribe);
const Shop = lazy(load.shop);
const VendorApply = lazy(load.apply);
const VendorHub = lazy(load.vendorHub);
const StorefrontAgreement = lazy(load.agreement);
const VendorRegistration = lazy(load.registration);
const VendorFeedback = lazy(load.feedback);
const Volunteer = lazy(load.volunteer);
const MentorshipLanding = lazy(() => load.mentorship().then((m) => ({ default: m.MentorshipLanding })));
const MentorshipProgram = lazy(() => load.mentorship().then((m) => ({ default: m.MentorshipProgram })));
const Portal = lazy(load.portal);
const CollectiveHome = lazy(load.collective);
const Verify = lazy(load.verify);
const AcademyHome = lazy(load.academy);
const Join = lazy(load.join);
const Enroll = lazy(load.enroll);
const SystemsApp = lazy(load.systems);
const AcademyApp = lazy(load.classroom);
const StudioApp = lazy(load.studio);
const Today = lazy(load.today);
const Gather = lazy(load.gather);

// Which code a link leads to, for preloading on hover / touch / focus. The catch-all shop
// slug comes last so fixed paths win.
const INTENT = [
  [/^\/about$/, load.about], [/^\/calendar$/, load.calendar], [/^\/directory$/, load.directory], [/^\/partner$/, load.partner],
  [/^\/(login|register)$/, load.login], [/^\/dashboard(\/|$)/, load.dashboard], [/^\/services$/, load.services],
  [/^\/(shop|favorites)$/, load.shop], [/^\/apply$/, load.apply], [/^\/vendors$/, load.vendorHub],
  [/^\/(vendors\/agreement|storefront)$/, load.agreement], [/^\/vendors\/register$/, load.registration], [/^\/vendors\/feedback$/, load.feedback],
  [/^\/volunteer$/, load.volunteer], [/^\/mentorship(\/|$)/, load.mentorship], [/^\/portal$/, load.portal],
  [/^\/verify(\/|$)/, load.verify], [/^\/academy$/, load.academy], [/^\/academy\/[^/]+/, load.classroom], [/^\/join$/, load.join],
  [/^\/systems(\/|$)/, load.systems], [/^\/studio(\/|$)/, load.studio], [/^\/today$/, load.today], [/^\/gather(\/|$)/, load.gather],
  [/^\/[a-z0-9][a-z0-9_-]{0,80}$/i, load.curator],
];
const IntentPreload = () => {
  useEffect(() => startIntentPreload(INTENT), []);
  return null;
};

// Dev-only studio test bench; compiled out of production builds.
const Lab = import.meta.env.DEV ? lazy(() => import('./dev/Lab')) : null;

// New page: start at the top, or at the #section the link points to (once it has rendered).
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return undefined; }
    let tries = 0;
    const id = setInterval(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el || ++tries > 40) {
        clearInterval(id);
        if (el) el.scrollIntoView({ block: 'start' });
      }
    }, 50);
    return () => clearInterval(id);
  }, [pathname, hash]);
  return null;
}

// Pages that belong to the other domain (marketplace ↔ Collective) open there.
const SiteGate = ({ children }) => {
  const { pathname, search, hash } = useLocation();
  const target = crossSiteTarget(pathname, search, hash);
  useEffect(() => { if (target) window.location.replace(target); }, [target]);
  return target ? <div aria-busy="true" style={{ minHeight: '100dvh' }} /> : children;
};

// The Collective's own titles for the pages it shares with the marketplace.
const COLLECTIVE_PAGE_META = {
  ...COLLECTIVE_META,
  '/portal': { ...ROUTE_META['/portal'], title: `Member portal — ${COLLECTIVE_NAME}`, origin: COLLECTIVE_URL },
};

// Title / description / share card for fixed pages (storefronts set their own).
const RouteMeta = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const key = pathname.replace(/\/+$/, '') || '/';
    if (isCollective && COLLECTIVE_PAGE_META[key]) applyMeta({ path: key, ...COLLECTIVE_PAGE_META[key] });
    else if (isCollective && key.startsWith('/verify')) applyMeta({ ...COLLECTIVE_META['/verify'], path: key, noindex: key !== '/verify' });
    else if (ROUTE_META[key]) applyMeta({ ...ROUTE_META[key], path: key });
    else if (key.startsWith('/enroll/')) applyMeta({ title: `Your invitation — ${COLLECTIVE_NAME}`, description: ROUTE_META['/mentorship'].description, noindex: true, origin: COLLECTIVE_URL });
    else if (key.startsWith('/dashboard') || key === '/onboarding-exclusive') {
      applyMeta({ title: `Curator studio — ${SITE_NAME}`, description: ROUTE_META['/'].description, noindex: true });
    }
  }, [pathname]);
  return null;
};

function SiteRoutes() {
  const { pathname } = useLocation();
  return (
    <div className="app-container">
      <AnnouncementBanner />
      <OfferTicker />
      <Navbar />
      <RouteMeta />
      <MotionRoot />
      <main className={`site-main ${isFlushRoute(pathname) ? 'is-flush' : ''}`}>
        <Suspense fallback={<div aria-busy="true" style={{ minHeight: '70vh' }} />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/partner" element={<Partner />} />
            <Route path="/apply" element={<VendorApply />} />
            <Route path="/vendors" element={<VendorHub />} />
            <Route path="/storefront" element={<StorefrontAgreement />} />
            <Route path="/vendors/agreement" element={<StorefrontAgreement />} />
            <Route path="/vendors/register" element={<VendorRegistration />} />
            <Route path="/vendors/feedback" element={<VendorFeedback />} />
            <Route path="/volunteer" element={<Volunteer />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/services" element={<Services />} />
            <Route path="/dashboard/*" element={<CuratorDashboard />} />
            <Route path="/onboarding-exclusive" element={<Onboarding />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/favorites" element={<Shop favoritesOnly />} />
            {/* Vanity URL Catch-all: /popcorn or /id */}
            <Route path="/:id" element={<CuratorProfile />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <LeadPopup />
      <CartSheet />
    </div>
  );
}

// thep31collective.org: the mentorships, member portal and enrollment links.
function CollectiveRoutes() {
  const { pathname } = useLocation();
  return (
    <div className="app-container cl-site">
      <CollectiveNav />
      <RouteMeta />
      <MotionRoot />
      <main className={`site-main ${isFlushRoute(pathname) ? 'is-flush' : ''}`}>
        <Suspense fallback={<div aria-busy="true" style={{ minHeight: '70vh' }} />}>
          <Routes>
            <Route path="/" element={<CollectiveHome />} />
            <Route path="/academy" element={<AcademyHome />} />
            <Route path="/join" element={<Join />} />
            <Route path="/mentorship" element={<MentorshipLanding />} />
            <Route path="/mentorship/:program" element={<MentorshipProgram />} />
            <Route path="/portal" element={<Portal />} />
            <Route path="/enroll/:token" element={<Enroll />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/verify/:serial" element={<Verify />} />
          </Routes>
        </Suspense>
      </main>
      <CollectiveFooter />
    </div>
  );
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <IntentPreload />
      <SiteGate>
        <Routes>
          <Route
            path="/systems/*"
            element={
              <Suspense fallback={<div aria-busy="true" style={{ minHeight: '100dvh', background: '#21101E' }} />}>
                <SystemsApp />
              </Suspense>
            }
          />
          <Route
            path="/academy/:program/*"
            element={<Suspense fallback={<div aria-busy="true" style={{ minHeight: '100dvh', background: '#F8F3FA' }} />}><AcademyApp /></Suspense>}
          />
          <Route
            path="/studio/*"
            element={<Suspense fallback={<div aria-busy="true" style={{ minHeight: '100dvh', background: '#21101E' }} />}><StudioApp /></Suspense>}
          />
          <Route
            path="/today"
            element={<Suspense fallback={<div aria-busy="true" style={{ minHeight: '100dvh', background: '#F8F3FA' }} />}><Today /></Suspense>}
          />
          <Route
            path="/gather/:slug?"
            element={<Suspense fallback={<div aria-busy="true" style={{ minHeight: '100dvh', background: '#21101E' }} />}><Gather /></Suspense>}
          />
          {Lab && <Route path="/__lab" element={<Suspense fallback={null}><Lab /></Suspense>} />}
          <Route path="/*" element={isCollective ? <CollectiveRoutes /> : <SiteRoutes />} />
        </Routes>
      </SiteGate>
    </Router>
  );
}

export default App;
