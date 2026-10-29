import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  Shield,
  Link as LinkIcon,
  Mail,
  QrCode,
  History,
  LayoutDashboard,
  Settings,
  CircleHelp,
  Puzzle,
  Sun,
  Moon
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import UrlDetection from './pages/UrlDetection';
import EmailDetection from './pages/EmailDetection';
import QrDetection from './pages/QrDetection';
import HistoryPage from './pages/HistoryPage';
import { ThemeProvider, useTheme } from './context/ThemeContext';

function Sidebar() {
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();

  const navItems = [
    { path: '/', name: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { path: '/url', name: 'URL Detection', icon: <LinkIcon size={20} /> },
    { path: '/email', name: 'Email Detection', icon: <Mail size={20} /> },
    { path: '/qr', name: 'QR Detection', icon: <QrCode size={20} /> },
    { path: '/history', name: 'Scan History', icon: <History size={20} /> },
  ];

  return (
    <aside className="fixed left-4 top-4 bottom-4 z-40 w-64 rounded-2xl bg-white border border-[#E5E9EB] shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-4 flex flex-col justify-between">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-2 py-1 mb-6">
          <div className="h-10 w-10 rounded-xl bg-[#EAF5F0] text-[#1F6A45] flex items-center justify-center shrink-0">
            <Shield size={24} className="fill-[#1F6A45] text-[#1F6A45]" />
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-[#0F1720] leading-tight tracking-tight">
              PhishShield-X
            </h1>
            <p className="text-[11px] font-medium text-[#8B97A3] tracking-normal">
              Security Intelligence
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={[
                  'flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-medium transition-all duration-200',
                  active
                    ? 'bg-[#1F6A45] text-white shadow-sm'
                    : 'text-[#475569] hover:bg-[#F4F7F6] hover:text-[#0F1720]'
                ].join(' ')}
              >
                <span className={active ? 'text-white' : 'text-[#64748B]'}>{item.icon}</span>
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Footer Actions */}
      <div className="pt-4 border-t border-[#E5E9EB] space-y-3">
        <a
          href="/phishshield-extension.zip"
          download="PhishShield-EDL-Extension.zip"
          className="w-full flex items-center gap-3 rounded-xl bg-white border border-[#1F6A45]/30 px-3.5 py-3 text-[14px] font-semibold text-[#1F6A45] hover:bg-[#EAF5F0] shadow-sm transition-colors"
          title="Download browser extension (Manifest V3) — then load unpacked in Chrome"
        >
          <Puzzle size={20} />
          <span>Get Extension</span>
        </a>
        <p className="px-3 text-[10.5px] text-[#8B97A3] leading-snug -mt-1">
          In-browser shield: auto URL verdicts, block interstitial &amp; passive QR defense — backend must run on :8000.
        </p>

        <button
          type="button"
          className="w-full rounded-xl border border-[#1F6A45] text-[#1F6A45] py-2.5 text-[14px] font-semibold hover:bg-[#EAF5F0] transition-colors"
        >
          Upgrade Protection
        </button>

        <div className="space-y-1">
          {/* Theme Switcher Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full text-left flex items-center justify-between rounded-lg px-3 py-2 text-[14px] font-medium text-[#475569] hover:bg-[#F4F7F6] hover:text-[#0F1720] transition-colors cursor-pointer"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <div className="flex items-center gap-3">
              {isDark ? (
                <Sun size={18} className="text-amber-400" />
              ) : (
                <Moon size={18} className="text-[#475569]" />
              )}
              <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
            <span
              className={`inline-flex items-center w-8 h-4 rounded-full p-0.5 transition-colors ${
                isDark ? 'bg-[#1F6A45]' : 'bg-[#CBD5E1]'
              }`}
            >
              <span
                className={`block w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform ${
                  isDark ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </span>
          </button>

          <button
            type="button"
            className="w-full text-left flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium text-[#475569] hover:bg-[#F4F7F6] hover:text-[#0F1720] transition-colors"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className="w-full text-left flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium text-[#475569] hover:bg-[#F4F7F6] hover:text-[#0F1720] transition-colors"
          >
            <CircleHelp size={18} />
            <span>Support</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function App() {
  React.useEffect(() => {
    // Proactively warm up cloud backend (e.g. Render spin-up) on initial site entry
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    fetch(`${backendUrl}/health`, { mode: 'no-cors' }).catch(() => {});
  }, []);

  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-[#F4F7F6] text-[#0F1720] font-['Poppins'] transition-colors duration-200">
          <Sidebar />
          <main className="min-h-screen ml-0 md:ml-68 p-4 md:p-7 max-w-7xl mx-auto">
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
    </ThemeProvider>
  );
}

export default App;
