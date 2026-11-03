import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

/**
 * EditorialFooter:
 * Exact architectural recreation of the Swiss brutalist editorial footer:
 * 1. Top Section:
 *    - Left: Numbered index directory (01 Overview ... 08 Documentation)
 *    - Center: CTA block with kicker, bold headline, copy, and chamfered action button
 *    - Right: Parabolic wireframe arc mesh + dual directory columns (Modules & Community)
 * 2. Bottom Section:
 *    - Electric Blue (#0047FF) ticket banner with hatched tab, live metrics, and description
 *    - GIGANTIC "PhishShield" editorial serif wordmark
 *    - Terminal footer sub-bar with dot-leader ornaments
 */

const INDEX_ITEMS = [
  { num: '01', label: 'Architecture', path: '/url' },
  { num: '02', label: 'Quishing ViT', path: '/qr' },
  { num: '03', label: 'Dirichlet EDL', path: '/url' },
  { num: '04', label: 'SPF / DKIM Consensus', path: '/email' },
  { num: '05', label: 'Threat Taxonomy', path: '/history' },
  { num: '06', label: 'Evidential Benchmarks', path: '/url' },
  { num: '07', label: 'Browser Extension', path: '/url' },
  { num: '08', label: 'Documentation', path: '/email' }
];

const MODULE_LINKS = [
  { label: 'URL Lexical Scanner', path: '/url' },
  { label: 'Vision-ViT Quishing', path: '/qr' },
  { label: 'Email Consensus', path: '/email' },
  { label: 'Threat Radar History', path: '/history' },
  { label: 'Dirichlet Density α_k', path: '/url' },
  { label: '404 Sandbox', path: '/url' }
];

const COMMUNITY_LINKS = [
  { label: 'GitHub Repository', href: 'https://github.com' },
  { label: 'Research Paper', path: '/email' },
  { label: 'Benchmark Dataset', path: '/history' },
  { label: 'Chrome Extension', path: '/url' },
  { label: 'Documentation', path: '/email' },
  { label: 'Discord Community', href: 'https://discord.com' }
];

export default function EditorialFooter({ onLaunchScan }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleAction = () => {
    if (onLaunchScan) {
      onLaunchScan();
      return;
    }
    if (location.pathname !== '/url') {
      navigate('/url');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full mt-20 select-none font-['Plus_Jakarta_Sans'] text-white">
      
      {/* =========================================================================
          TOP ZONE: 3-COLUMN ARCHITECTURAL GRID
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 border-t border-l border-r border-[#1E2533] bg-[#0A0D14]">
        
        {/* COLUMN 1 (Cols 1-3): Numbered Directory Index */}
        <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-[#1E2533] p-6 sm:p-7 flex flex-col justify-between">
          <div className="space-y-0 divide-y divide-[#1E2533]/60">
            {INDEX_ITEMS.map((item) => (
              <Link
                key={item.num}
                to={item.path}
                className="flex items-center gap-3 py-2.5 text-[12px] font-['Silkscreen'] tracking-[0.08em] text-white/55 hover:text-white transition-colors group"
              >
                <span className="text-[#38BDF8] group-hover:text-[#0047FF] transition-colors">{item.num}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* COLUMN 2 (Cols 4-7): Central Call-To-Action Block */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#1E2533] p-7 sm:p-9 flex flex-col justify-between">
          <div>
            {/* Top Kicker Badge */}
            <div className="flex items-center gap-2 text-[10px] font-['Silkscreen'] tracking-[0.14em] text-white/45 uppercase mb-6">
              <span className="text-[#0047FF]">◇</span>
              <span>Autonomous Threat Defense</span>
              <span className="text-white/20 tracking-[0.2em] hidden sm:inline">::::::::::::::::::</span>
            </div>

            {/* Headline */}
            <h2 className="font-['Pixelify_Sans'] text-3xl sm:text-5xl lg:text-[54px] font-bold text-white tracking-tight leading-[1.06] mb-4">
              Detect threats.<br />
              Eliminate zero-days.
            </h2>

            {/* Subtitle */}
            <p className="text-sm sm:text-[15px] text-white/65 font-normal leading-[1.6] max-w-md">
              Inspect URLs, physical QR barcodes, and email authentication in real time. Enforce Dirichlet uncertainty bounds while your security operations stay in total control.
            </p>
          </div>

          {/* Chamfered CTA Button */}
          <div className="pt-6 sm:pt-8">
            <button
              type="button"
              onClick={handleAction}
              className="inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-3.5 bg-[#D9D3C7] hover:bg-white text-[#0A0D14] font-['Silkscreen'] text-[11px] sm:text-xs font-bold tracking-[0.14em] uppercase transition-all cursor-pointer shadow-lg relative"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)'
              }}
            >
              RUN LIVE VERIFICATION
            </button>
          </div>
        </div>

        {/* COLUMN 3 (Cols 8-12): Parabolic Wireframe Arcs + Directory */}
        <div className="lg:col-span-4 flex flex-col justify-between">
          
          {/* Top Parabolic Wireframe Arc Mesh Graphic */}
          <div className="border-b border-[#1E2533] pt-4 px-4 pb-0 flex items-end justify-center bg-[#07090E] overflow-hidden">
            <svg
              viewBox="0 0 360 140"
              className="w-full h-[125px] opacity-85 block"
              preserveAspectRatio="none"
            >
              {/* Overlapping parabolic wireframe bezier curves */}
              {Array.from({ length: 11 }).map((_, i) => {
                const xStart = 15 + i * 20;
                const xEnd = 345 - i * 12;
                const cpY = -35 + i * 15;
                return (
                  <path
                    key={`p-${i}`}
                    d={`M ${xStart} 140 Q ${(xStart + xEnd) / 2} ${cpY} ${xEnd} 140`}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.22)"
                    strokeWidth="1.1"
                  />
                );
              })}
              {Array.from({ length: 8 }).map((_, i) => {
                const xStart = 75 + i * 32;
                const xEnd = 350;
                const cpY = -15 + i * 18;
                return (
                  <path
                    key={`cyan-${i}`}
                    d={`M ${xStart} 140 Q ${(xStart + xEnd) / 2} ${cpY} ${xEnd} 140`}
                    fill="none"
                    stroke="rgba(0, 71, 255, 0.42)"
                    strokeWidth="1.2"
                  />
                );
              })}
            </svg>
          </div>

          {/* Bottom Directory Sub-Columns */}
          <div className="grid grid-cols-2 divide-x divide-[#1E2533] p-0 text-[12.5px]">
            
            {/* Pages / Modules Column */}
            <div className="p-5 sm:p-6 space-y-0 divide-y divide-[#1E2533]/50">
              <span className="font-['Silkscreen'] text-[10px] tracking-[0.16em] uppercase text-white/45 block pb-2">
                MODULES
              </span>
              {MODULE_LINKS.map((link) => (
                <Link
                  key={link.label}
                  to={link.path}
                  className="block py-2 text-white/60 hover:text-white transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Community / Social Column */}
            <div className="p-5 sm:p-6 space-y-0 divide-y divide-[#1E2533]/50">
              <span className="font-['Silkscreen'] text-[10px] tracking-[0.16em] uppercase text-white/45 block pb-2">
                COMMUNITY
              </span>
              {COMMUNITY_LINKS.map((link) => (
                link.href ? (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="block py-2 text-white/60 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={link.label}
                    to={link.path}
                    className="block py-2 text-white/60 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </div>

          </div>

        </div>

      </div>

      {/* =========================================================================
          BOTTOM ZONE: THE MASSIVE ELECTRIC BLUE TICKET BANNER + GIANT WORDMARK
          ========================================================================= */}
      <div className="border border-[#1E2533] bg-[#0047FF] text-[#0A0D14] relative overflow-hidden">
        
        {/* Inner Flex Header: Left Hatched Ticket Tab + Stats + Summary */}
        <div className="grid grid-cols-2 md:grid-cols-12 border-b border-[#0A0D14]/15">
          
          {/* Hatched Ticket Notch Tab (Left) */}
          <div className="col-span-2 md:col-span-2 border-b md:border-b-0 md:border-r border-[#0A0D14]/15 p-4 sm:p-6 flex items-center justify-center relative bg-[repeating-linear-gradient(45deg,_rgba(10,13,20,0.08)_0px,_rgba(10,13,20,0.08)_2px,_transparent_2px,_transparent_6px)]">
            {/* Center diamond/flower logo mark */}
            <div className="w-9 h-9 rotate-45 border-2 border-[#0A0D14] flex items-center justify-center bg-[#0047FF] shadow-sm">
              <div className="w-3.5 h-3.5 bg-[#0A0D14]" />
            </div>
          </div>

          {/* Metric 1: Active Status */}
          <div className="col-span-1 md:col-span-2 border-r border-b md:border-b-0 border-[#0A0D14]/15 p-4 sm:p-6 flex flex-col justify-center">
            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#0A0D14] tracking-tight">
              Active
            </span>
            <span className="font-['Silkscreen'] text-[9px] sm:text-[9.5px] uppercase tracking-wider text-[#0A0D14]/75 mt-0.5">
              Engine Status
            </span>
          </div>

          {/* Metric 2: Threats Evaluated */}
          <div className="col-span-1 md:col-span-3 border-b md:border-b-0 md:border-r border-[#0A0D14]/15 p-4 sm:p-6 flex flex-col justify-center">
            <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#0A0D14] tracking-tight font-mono truncate">
              14,892,104
            </span>
            <span className="font-['Silkscreen'] text-[9px] sm:text-[9.5px] uppercase tracking-wider text-[#0A0D14]/75 mt-0.5">
              Threats Evaluated
            </span>
          </div>

          {/* Description Paragraph (Right) */}
          <div className="col-span-2 md:col-span-5 p-4 sm:p-6 flex items-center">
            <p className="font-mono text-[10.5px] sm:text-[11.5px] text-[#0A0D14]/85 leading-relaxed tracking-tight">
              PhishShield is an autonomous evidential threat intelligence operator. It cross-examines URL lexical patterns, ViT QR barcodes, and email consensus automatically, with mathematical uncertainty bounds.
            </p>
          </div>

        </div>

        {/* GIGANTIC EDITORIAL SERIF TYPOGRAPHY WORDMARK */}
        <div className="w-full pt-4 pb-0 px-2 sm:px-4 md:px-6 flex items-end justify-center overflow-hidden">
          <h1
            className="w-full text-center font-['Instrument_Serif',_Georgia,_serif] text-[#0A0D14] font-normal tracking-[-0.03em] leading-[0.82] select-none pointer-events-none"
            style={{
              fontSize: 'clamp(3rem, 16vw, 17.5rem)',
              textShadow: '0 2px 40px rgba(0,0,0,0.1)'
            }}
          >
            PhishShield
          </h1>
        </div>

      </div>

      {/* =========================================================================
          VERY BOTTOM TERMINAL METADATA SUB-BAR
          ========================================================================= */}
      <div className="border-b border-l border-r border-[#1E2533] bg-[#07090E] px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10.5px] font-['Silkscreen'] tracking-[0.14em] uppercase text-white/40">
        
        <div className="flex items-center gap-3">
          <span>© PHISHSHIELD AI, 2026</span>
          <span className="text-white/15 hidden md:inline">::::::::::::::::::::::::::</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-white/50">
          <span>ALL RIGHTS RESERVED</span>
          <Link to="/url" className="hover:text-white transition-colors">TERMS OF USE</Link>
          <Link to="/url" className="hover:text-white transition-colors">PRIVACY POLICY</Link>
          <span className="text-white/15 hidden md:inline">::::::::::::::::::::::</span>
          <span className="text-[#0047FF]">◇</span>
        </div>

      </div>

    </footer>
  );
}

