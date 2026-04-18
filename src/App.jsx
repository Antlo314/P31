import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Calendar from './pages/Calendar';
import Directory from './pages/Directory';
import CuratorProfile from './pages/CuratorProfile';
import Visionary from './pages/Visionary';
import Community from './pages/Community';
import Login from './pages/Login';
import CuratorDashboard from './pages/CuratorDashboard';
import Onboarding from './pages/Onboarding';
import LeadPopup from './components/LeadPopup';
import OfferTicker from './components/OfferTicker';
import AnnouncementBanner from './components/AnnouncementBanner';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="app-container">
        <AnnouncementBanner />
        <OfferTicker />
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/visionary" element={<Visionary />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/dashboard/*" element={<CuratorDashboard />} />
            <Route path="/onboarding-exclusive" element={<Onboarding />} />
            {/* Vanity URL Catch-all: /popcorn or /id */}
            <Route path="/:id" element={<CuratorProfile />} />
          </Routes>
        </main>
        <Footer />
        <LeadPopup />
      </div>
    </Router>
  );
}

export default App;
