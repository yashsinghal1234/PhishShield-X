import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import ScrollToTop from './components/ScrollToTop';
import HomePage from './pages/HomePage';
import UrlDetection from './pages/UrlDetection';
import EmailDetection from './pages/EmailDetection';
import QrDetection from './pages/QrDetection';
import HistoryPage from './pages/HistoryPage';
import Documentation from './pages/Documentation';
import EditorialFooter from './components/EditorialFooter';
import { ThemeProvider } from './context/ThemeContext';
import { getApiBaseUrl } from './config/api';

function App() {
  React.useEffect(() => {
    // Proactively warm up cloud backend on initial entry
    const backendUrl = getApiBaseUrl();
    fetch(`${backendUrl}/health`, { mode: 'no-cors' }).catch(() => {});
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <ScrollToTop />
        <div className="min-h-screen bg-[#080A0F] text-[#F1F5F9] font-['Plus_Jakarta_Sans'] overflow-x-hidden flex flex-col justify-between pt-20">
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col justify-between">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/url" element={<UrlDetection />} />
              <Route path="/qr" element={<QrDetection />} />
              <Route path="/email" element={<EmailDetection />} />
              <Route path="/docs" element={<Documentation />} />
              <Route path="/documentation" element={<Documentation />} />
              <Route path="/history" element={<HistoryPage />} />
            </Routes>
            <div className="-mx-4 sm:-mx-7 md:-mx-9 lg:-mx-12 xl:-mx-14 -mb-3 sm:-mb-4">
              <EditorialFooter />
            </div>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
