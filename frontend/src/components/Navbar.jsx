import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Puzzle,
  Mail
} from 'lucide-react';
import ContactModal from './ContactModal';

/**
 * DotMatrixGlyph:
 * Recreates the retro 5x5 dot-matrix micro-glyphs seen in the reference navbar:
 * - aperture: Rounded square border with center dot ("About")
 * - frame: Hollow rounded square frame ("Research")
 * - cross: X-shaped dot constellation ("Careers")
 * - diamond: Diamond / reticle pattern ("Explore")
 */
function DotMatrixGlyph({ type = 'aperture', className = '', isActive = false }) {
  const patterns = {
    // 1. "About" style: rounded square border with center dot
    aperture: [
      [0, 1], [0, 2], [0, 3],
      [1, 0], [1, 4],
      [2, 0], [2, 2], [2, 4],
      [3, 0], [3, 4],
      [4, 1], [4, 2], [4, 3]
    ],
    // 2. "Research" style: rounded hollow square frame
    frame: [
      [0, 1], [0, 2], [0, 3],
      [1, 0], [1, 4],
      [2, 0], [2, 4],
      [3, 0], [3, 4],
      [4, 1], [4, 2], [4, 3]
    ],
    // 3. "Careers" style: X-shaped cross
    cross: [
      [0, 0], [0, 4],
      [1, 1], [1, 3],
      [2, 2],
      [3, 1], [3, 3],
      [4, 0], [4, 4]
    ],
    // 4. "Explore" diamond pattern:
    diamond: [
      [0, 2],
      [1, 1], [1, 3],
      [2, 0], [2, 4],
      [3, 1], [3, 3],
      [4, 2]
    ]
  };

  const dots = patterns[type] || patterns.aperture;

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      className={`shrink-0 text-current transition-transform duration-200 group-hover:scale-110 ${className}`}
      fill="currentColor"
    >
      {dots.map(([r, c], idx) => (
        <rect
          key={idx}
          x={c * 3.1 + 1.2}
          y={r * 3.1 + 1.2}
          width="2"
          height="2"
          rx="0.45"
          className={`transition-colors duration-150 ${
            isActive ? 'fill-[#38BDF8]' : 'group-hover:fill-[#38BDF8]'
          }`}
        />
      ))}
    </svg>
  );
}

export default function Navbar() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // Navbar options curated specifically for the PhishShield multi-modal project:
  const navLinks = [
    { path: '/url', label: 'URL Scanner', icon: 'diamond' },
    { path: '/qr', label: 'Quishing', icon: 'frame' },
    { path: '/email', label: 'Email Intel', icon: 'aperture' },
    { path: '/docs', label: 'Documentation', icon: 'cross' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full bg-[#080A0F]/90 backdrop-blur-md border-b border-[#1E2533]/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Left: Brand Icon + Name + Dot Matrix Nav Links */}
        <div className="flex items-center gap-8 sm:gap-10">
          {/* Brand Link */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/shadowlens-logo.png"
              alt="ShadowLens Mascot"
              className="w-9 h-9 shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(56,189,248,0.25)] transition-transform duration-200 group-hover:scale-105"
            />
            <span className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-bold tracking-tight text-white hover:text-white/90 transition-colors">
              ShadowLens
            </span>
          </Link>

          {/* Minimalist Dot Matrix Links with Active Blue & Dotted Underline Effect */}
          <nav className="hidden md:flex items-center gap-8 text-[15px] font-['Plus_Jakarta_Sans'] font-medium">
            {navLinks.map((link) => {
              const isActive =
                location.pathname === link.path ||
                (link.path === '/docs' && location.pathname === '/documentation');
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`group transition-all inline-flex items-center gap-2.5 py-1 ${
                    isActive
                      ? 'text-[#38BDF8] font-semibold'
                      : 'text-white/80 hover:text-[#38BDF8]'
                  }`}
                >
                  <DotMatrixGlyph
                    type={link.icon}
                    isActive={isActive}
                    className={`shrink-0 ${isActive ? 'text-[#38BDF8]' : 'text-white/70'}`}
                  />
                  <span className="tracking-tight leading-none relative">
                    {link.label}
                    <span
                      className={`absolute left-0 right-0 -bottom-1.5 border-b-2 border-dotted transition-all pointer-events-none ${
                        isActive
                          ? 'border-[#38BDF8] opacity-100'
                          : 'border-transparent opacity-0 group-hover:border-[#38BDF8]/40 group-hover:opacity-100'
                      }`}
                    />
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: Contact Us + Get Extension Pill */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setContactModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/15 hover:border-[#38BDF8]/50 bg-white/[0.04] hover:bg-[#0047FF]/10 text-white/90 hover:text-[#38BDF8] text-xs font-['Plus_Jakarta_Sans'] font-semibold tracking-tight transition-all duration-200 cursor-pointer shadow-sm"
          >
            <Mail size={13} className="text-[#38BDF8]" />
            <span>Contact Us</span>
          </button>

          <a
            href="/phishshield-extension.zip"
            download="PhishShield-EDL-Extension.zip"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0047FF] hover:bg-[#0039CC] text-white text-xs font-['Silkscreen'] font-bold tracking-wider transition-all shadow-sm shadow-[#0047FF]/20 cursor-pointer"
          >
            <Puzzle size={13} />
            <span>GET EXTENSION</span>
          </a>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-white"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#1E2533] bg-[#080A0F] px-4 py-4 space-y-2">
          {navLinks.map((link) => {
            const isActive =
              location.pathname === link.path ||
              (link.path === '/docs' && location.pathname === '/documentation');
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'text-[#38BDF8] bg-[#0047FF]/15 border border-[#38BDF8]/30 font-semibold'
                    : 'text-white/90 hover:text-[#38BDF8] hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <DotMatrixGlyph
                    type={link.icon}
                    isActive={isActive}
                    className={`shrink-0 ${isActive ? 'text-[#38BDF8]' : 'text-white/70'}`}
                  />
                  <span className="leading-none">
                    {link.label}
                  </span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_6px_#38BDF8]"></span>
                )}
              </Link>
            );
          })}
          <Link
            to="/history"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center justify-between py-2.5 px-3 rounded-xl transition-all ${
              location.pathname === '/history'
                ? 'text-[#38BDF8] bg-[#0047FF]/15 border border-[#38BDF8]/30 font-semibold'
                : 'text-white/90 hover:text-[#38BDF8] hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-3">
              <DotMatrixGlyph
                type="aperture"
                isActive={location.pathname === '/history'}
                className={`shrink-0 ${location.pathname === '/history' ? 'text-[#38BDF8]' : 'text-white/70'}`}
              />
              <span className="leading-none">
                Audit History
              </span>
            </div>
            {location.pathname === '/history' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_6px_#38BDF8]"></span>
            )}
          </Link>
          <div className="pt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setContactModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full border border-white/15 bg-white/[0.05] text-white text-xs font-semibold"
            >
              <Mail size={13} className="text-[#38BDF8]" />
              <span>Contact Us</span>
            </button>
            <a
              href="/phishshield-extension.zip"
              download="PhishShield-EDL-Extension.zip"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full bg-[#0047FF] text-white text-xs font-['Silkscreen'] font-bold tracking-wider"
            >
              <Puzzle size={13} />
              <span>GET EXT</span>
            </a>
          </div>
        </div>
      )}

      {/* Interactive Contact Modal */}
      <ContactModal
        isOpen={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
      />
    </header>
  );
}
