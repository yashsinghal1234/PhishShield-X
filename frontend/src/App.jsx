import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Shield, Link as LinkIcon, Mail, QrCode, History, Activity } from 'lucide-react';

import Dashboard from './pages/Dashboard';
import UrlDetection from './pages/UrlDetection';
import EmailDetection from './pages/EmailDetection';
import QrDetection from './pages/QrDetection';
import HistoryPage from './pages/HistoryPage';

function Sidebar() {
  const location = useLocation();
  const navItems = [
    { path: '/', name: 'Dashboard', icon: <Activity size={20} /> },
    { path: '/url', name: 'URL Detection', icon: <LinkIcon size={20} /> },
    { path: '/email', name: 'Email Detection', icon: <Mail size={20} /> },
    { path: '/qr', name: 'QR Detection', icon: <QrCode size={20} /> },
    { path: '/history', name: 'Scan History', icon: <History size={20} /> },
  ];

  return (
    <div className="w-64 glass-panel h-screen m-4 flex flex-col p-4 fixed">
      <div className="flex items-center space-x-3 mb-8 px-2">
        <Shield className="text-primary-500" size={32} />
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-500 to-accent-500">
          PhishShield-X
        </h1>
      </div>
      
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${
              location.pathname === item.path
                ? 'bg-primary-500/20 text-primary-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                : 'text-gray-400 hover:bg-dark-700 hover:text-gray-200'
            }`}
          >
            {item.icon}
            <span className="font-medium">{item.name}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen flex bg-[#0B1120] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-dark-800 via-dark-900 to-black">
        <Sidebar />
        <main className="flex-1 ml-72 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/url" element={<UrlDetection />} />
            <Route path="/email" element={<EmailDetection />} />
            <Route path="/qr" element={<QrDetection />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
