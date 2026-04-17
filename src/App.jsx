import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import Calendar from './pages/Calendar';
import Directory from './pages/Directory';
import CuratorProfile from './pages/CuratorProfile';
import Register from './pages/Register';
import Visionary from './pages/Visionary';
import Apply from './pages/Apply';
import Community from './pages/Community';
import LeadPopup from './components/LeadPopup';

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
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/visionary" element={<Visionary />} />
            <Route path="/curator/:id" element={<CuratorProfile />} />
            <Route path="/register" element={<Register />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/community" element={<Community />} />
          </Routes>
        </main>
        <Footer />
        <LeadPopup />
      </div>
    </Router>
  );
}

export default App;
