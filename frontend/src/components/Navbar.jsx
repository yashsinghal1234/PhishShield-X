import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  Puzzle
} from 'lucide-react';

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

  // Navbar options curated specifically for the PhishShield multi-modal project:
  const navLinks = [
    { path: '/url', label: 'URL Scanner', icon: 'diamond' },
    { path: '/qr', label: 'Quishing', icon: 'frame' },
    { path: '/email', label: 'Email Intel', icon: 'aperture' },
    { path: '/docs', label: 'Documentation', icon: 'cross' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#080A0F]/95 backdrop-blur-md border-b border-[#1E2533]/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Left: Brand Icon + Name + Dot Matrix Nav Links */}
        <div className="flex items-center gap-10">
          {/* Brand Link */}
          <Link to="/" className="flex items-center group">
            <span className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-bold tracking-tight text-white hover:text-white/90 transition-colors">
              PhishShield
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
                  className={`group transition-all flex items-center gap-2.5 py-1.5 relative ${
                    isActive
                      ? 'text-[#38BDF8] font-semibold'
                      : 'text-white/80 hover:text-[#38BDF8]'
                  }`}
                >
                  <DotMatrixGlyph
                    type={link.icon}
                    isActive={isActive}
                    className={isActive ? 'text-[#38BDF8]' : 'text-white/70'}
                  />
                  <span
                    className={`tracking-tight transition-all pb-1 ${
                      isActive
                        ? 'border-b-2 border-dotted border-[#38BDF8] text-[#38BDF8]'
                        : 'border-b-2 border-transparent group-hover:border-dotted group-hover:border-[#38BDF8]/40'
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Actions: Extension Pill (Kept exactly as requested) */}
        <div className="flex items-center gap-3.5">
          <a
            href="/phishshield-extension.zip"
            download="PhishShield-EDL-Extension.zip"
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0047FF] hover:bg-[#0039CC] text-white text-xs font-['Silkscreen'] font-bold tracking-wider transition-all shadow-sm shadow-[#0047FF]/20"
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
                    className={isActive ? 'text-[#38BDF8]' : 'text-white/70'}
                  />
                  <span className={isActive ? 'border-b-2 border-dotted border-[#38BDF8] pb-0.5' : ''}>
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
                className={location.pathname === '/history' ? 'text-[#38BDF8]' : 'text-white/70'}
              />
              <span className={location.pathname === '/history' ? 'border-b-2 border-dotted border-[#38BDF8] pb-0.5' : ''}>
                Audit History
              </span>
            </div>
            {location.pathname === '/history' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] shadow-[0_0_6px_#38BDF8]"></span>
            )}
          </Link>
          <div className="pt-2">
            <a
              href="/phishshield-extension.zip"
              download="PhishShield-EDL-Extension.zip"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#0047FF] text-white text-xs font-['Silkscreen'] font-bold tracking-wider"
            >
              <Puzzle size={14} />
              <span>GET EXTENSION</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
