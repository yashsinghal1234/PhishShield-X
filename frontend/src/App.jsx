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
  Search,
  Bell
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import UrlDetection from './pages/UrlDetection';
import EmailDetection from './pages/EmailDetection';
import QrDetection from './pages/QrDetection';
import HistoryPage from './pages/HistoryPage';

function Sidebar() {
  const location = useLocation();

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
        <button
          type="button"
          className="w-full rounded-xl border border-[#1F6A45] text-[#1F6A45] py-2.5 text-[14px] font-semibold hover:bg-[#EAF5F0] transition-colors"
        >
          Upgrade Protection
        </button>

        <div className="space-y-1">
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

function Header() {
  return (
    <header className="mb-6 flex items-center justify-between gap-4">
      {/* Search Input Bar */}
      <div className="relative flex-1 max-w-xl">
        <div className="flex items-center gap-2.5 rounded-full bg-white border border-[#E5E9EB] px-4 py-2.5 shadow-sm text-sm text-[#64748B] focus-within:border-[#1F6A45] focus-within:ring-1 focus-within:ring-[#1F6A45] transition-all">
          <Search size={18} className="text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Search logs, alerts, settings..."
            className="w-full bg-transparent text-[#0F1720] placeholder-[#94A3B8] focus:outline-none text-sm"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-mono font-semibold text-[#64748B]">
            ⌘ K
          </kbd>
        </div>
      </div>

      {/* Right User Controls */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="relative flex items-center justify-center h-10 w-10 rounded-full bg-white border border-[#E5E9EB] text-[#475569] hover:bg-[#F8FAFC] shadow-sm transition-colors"
        >
          <Bell size={18} />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#DC2626] ring-2 ring-white" />
        </button>

        <div className="h-10 w-10 rounded-full overflow-hidden border border-[#E5E9EB] shadow-sm">
          <img
            src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
            alt="User profile"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#F4F7F6] text-[#0F1720] font-['Poppins']">
        <Sidebar />
        <main className="min-h-screen ml-0 md:ml-68 p-4 md:p-7 max-w-7xl mx-auto">
          <Header />
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