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
import { isCollective, crossSiteTarget } from './lib/site';
import MotionRoot from './components/MotionRoot';
import { CollectiveNav, CollectiveFooter } from './components/CollectiveChrome';

// Everything but the landing page loads on demand, so phones only download
// what they open.
const About = lazy(() => import('./pages/About'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Directory = lazy(() => import('./pages/Directory'));
const CuratorProfile = lazy(() => import('./pages/CuratorProfile'));
const Partner = lazy(() => import('./pages/Partner'));
const Login = lazy(() => import('./pages/Login'));
const CuratorDashboard = lazy(() => import('./pages/CuratorDashboard'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Services = lazy(() => import('./pages/Services'));
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'));
const Shop = lazy(() => import('./pages/Shop'));
const MentorshipLanding = lazy(() => import('./academy/Mentorship').then((m) => ({ default: m.MentorshipLanding })));
const MentorshipProgram = lazy(() => import('./academy/Mentorship').then((m) => ({ default: m.MentorshipProgram })));
const Portal = lazy(() => import('./academy/Portal'));
const CollectiveHome = lazy(() => import('./academy/CollectiveHome'));
const Verify = lazy(() => import('./academy/Verify'));
const AcademyHome = lazy(() => import('./academy/AcademyHome'));
const Join = lazy(() => import('./academy/Join'));
const Enroll = lazy(() => import('./academy/Enroll'));

// The team console is its own app: loaded only when someone opens it,
// and drawn without the public site's header, footer and popups.
const SystemsApp = lazy(() => import('./systems/SystemsApp'));
// Member dashboards: mentorship classrooms / mentor consoles, and the Content Studio.
const AcademyApp = lazy(() => import('./academy/app/AcademyApp'));
const StudioApp = lazy(() => import('./studio/StudioApp'));
// The team's home: what needs attention across every dashboard they run.
const Today = lazy(() => import('./today/Today'));
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
      <SiteGate>
        <Routes>
          <Route
            path="/systems/*"
            element={
              <Suspense fallback={<div aria-busy="true" style={{ minHeight: '100dvh', background: '#12081d' }} />}>
                <SystemsApp />
              </Suspense>
            }
          />
          <Route
            path="/academy/:program/*"
            element={<Suspense fallback={<div aria-busy="true" style={{ minHeight: '100dvh', background: '#FCFBFE' }} />}><AcademyApp /></Suspense>}
          />
          <Route
            path="/studio/*"
            element={<Suspense fallback={<div aria-busy="true" style={{ minHeight: '100dvh', background: '#12081d' }} />}><StudioApp /></Suspense>}
          />
          <Route
            path="/today"
            element={<Suspense fallback={<div aria-busy="true" style={{ minHeight: '100dvh', background: '#FCFBFE' }} />}><Today /></Suspense>}
          />
          {Lab && <Route path="/__lab" element={<Suspense fallback={null}><Lab /></Suspense>} />}
          <Route path="/*" element={isCollective ? <CollectiveRoutes /> : <SiteRoutes />} />
        </Routes>
      </SiteGate>
    </Router>
  );
}

export default App;
