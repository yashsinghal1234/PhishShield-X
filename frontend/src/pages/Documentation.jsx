import React, { useState, useRef, useEffect } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Terminal,
  FileText,
  ShieldAlert,
  Cpu,
  Globe,
  QrCode,
  Layers,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Grid
} from 'lucide-react';

export default function Documentation() {
  const [activeTab, setActiveTab] = useState('edl'); // 'edl' | 'quishing' | 'lexical' | 'api'
  const [currentPage, setCurrentPage] = useState(1); // 1 to maxPages
  const [mobileFlap, setMobileFlap] = useState('spec'); // 'spec' | 'evidence' for mobile view
  const [isFlipping, setIsFlipping] = useState(false);
  const [sheetOrder, setSheetOrder] = useState(['main', 'excerpt', 'receipt']); // stacking order (last is top)
  const [positions, setPositions] = useState({
    main: { x: 0, y: 0 },
    excerpt: { x: 0, y: 0 },
    receipt: { x: 0, y: 0 },
  });
  const [draggingSheet, setDraggingSheet] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Maximum pages per dossier file tab
  const tabMaxPages = {
    edl: 4,
    quishing: 3,
    lexical: 3,
    api: 3
  };

  const maxPages = tabMaxPages[activeTab] || 3;

  const changePage = (pageNum) => {
    if (pageNum === currentPage || pageNum < 1 || pageNum > maxPages) return;
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentPage(pageNum);
      setIsFlipping(false);
    }, 150);
  };

  const dragRef = useRef({
    sheetId: null,
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
    hasMoved: false,
  });

  const bringToFront = (sheetId) => {
    setSheetOrder((prev) => {
      const next = prev.filter((id) => id !== sheetId);
      next.push(sheetId);
      return next;
    });
  };

  const getZIndex = (sheetId) => {
    const idx = sheetOrder.indexOf(sheetId);
    return idx === -1 ? 20 : 20 + idx * 10;
  };

  const handleMouseDown = (sheetId, e) => {
    // Don't initiate drag if clicking buttons, links, or code blocks
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('pre')) {
      return;
    }
    bringToFront(sheetId);
    dragRef.current = {
      sheetId,
      startX: e.clientX,
      startY: e.clientY,
      initX: positions[sheetId]?.x || 0,
      initY: positions[sheetId]?.y || 0,
      hasMoved: false,
    };
    setDraggingSheet(sheetId);
  };

  const handleTouchStart = (sheetId, e) => {
    if (e.target.closest('button') || e.target.closest('a') || e.target.closest('pre')) {
      return;
    }
    if (!e.touches || e.touches.length === 0) return;
    bringToFront(sheetId);
    const touch = e.touches[0];
    dragRef.current = {
      sheetId,
      startX: touch.clientX,
      startY: touch.clientY,
      initX: positions[sheetId]?.x || 0,
      initY: positions[sheetId]?.y || 0,
      hasMoved: false,
    };
    setDraggingSheet(sheetId);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragRef.current.sheetId) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.hasMoved = true;
      }
      const { sheetId, initX, initY } = dragRef.current;
      setPositions((prev) => ({
        ...prev,
        [sheetId]: { x: initX + dx, y: initY + dy },
      }));
    };

    const handleTouchMove = (e) => {
      if (!dragRef.current.sheetId || !e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragRef.current.startX;
      const dy = touch.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragRef.current.hasMoved = true;
      }
      const { sheetId, initX, initY } = dragRef.current;
      setPositions((prev) => ({
        ...prev,
        [sheetId]: { x: initX + dx, y: initY + dy },
      }));
    };

    const handleEnd = () => {
      dragRef.current.sheetId = null;
      setDraggingSheet(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, []);

  const resetPositions = () => {
    setPositions({
      main: { x: 0, y: 0 },
      excerpt: { x: 0, y: 0 },
      receipt: { x: 0, y: 0 },
    });
  };

  const copySnippet = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Archival dossier tabs matching reference artwork side tabs
  const dossierTabs = [
    {
      id: 'edl',
      label: 'Evidential Core',
      fileNo: 'File #01',
      color: 'bg-[#E11D48]', // Crimson/Coral Tab
      hoverColor: 'hover:bg-[#BE123C]',
      category: 'Mathematical Foundations'
    },
    {
      id: 'quishing',
      label: 'QuishNet-v2 Matrix',
      fileNo: 'File #02',
      color: 'bg-[#1D4ED8]', // Cobalt Blue Tab
      hoverColor: 'hover:bg-[#1E40AF]',
      category: 'Vision Decoders'
    },
    {
      id: 'lexical',
      label: 'Lexical Ingestion',
      fileNo: 'File #03',
      color: 'bg-[#0D9488]', // Teal Tab
      hoverColor: 'hover:bg-[#0F766E]',
      category: '34-Dim OSINT'
    },
    {
      id: 'api',
      label: 'Telemetry & Endpoints',
      fileNo: 'File #04',
      color: 'bg-[#4F46E5]', // Indigo Tab
      hoverColor: 'hover:bg-[#4338CA]',
      category: 'Client Schemas'
    }
  ];

  return (
    <div className="w-full min-h-screen bg-[#07090E] text-white font-['Plus_Jakarta_Sans'] -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-10 select-none">
      
      {/* =========================================================================
          HERO TITLE & METADATA (Fragment 17B / System Architecture)
          Directly under Navbar - clean editorial presentation
          ========================================================================= */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <span className="font-mono text-xs text-white/40 tracking-wider block">
              Unindexed Materials / Recovered Entries / Fragment 17B
            </span>
            <h1 className="font-['Instrument_Serif'] text-6xl sm:text-7xl md:text-8xl tracking-tight text-white font-normal leading-none">
              Fragment 17B
            </h1>
          </div>

          {/* Right Metadata Block with API links */}
          <div className="md:text-right space-y-2 font-mono text-xs text-white/50 max-w-sm">
            <div className="flex md:justify-end items-center gap-2 mb-2">
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-[11px]"
              >
                <Terminal size={11} />
                <span>FastAPI Docs</span>
                <ExternalLink size={9} className="opacity-50" />
              </a>
              <a
                href="http://localhost:8000/redoc"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-[11px]"
              >
                <FileText size={11} />
                <span>ReDoc</span>
                <ExternalLink size={9} className="opacity-50" />
              </a>
              <div className="flex items-center gap-1 ml-1 border-l border-white/10 pl-2">
                <span className="inline-block w-4 h-4 rounded border border-white/30 text-[9px] text-center leading-4 text-white/70">
                  ⊞
                </span>
                <span className="inline-block w-4 h-4 rounded border border-white/10 text-[9px] text-center leading-4 text-white/40">
                  ⊟
                </span>
              </div>
            </div>
            <p className="leading-snug">
              Multimodal Evidential Phishing Defense Architecture & Epistemic Telemetry.
            </p>
            <p className="text-white/80 font-medium">
              PhishShield-X v2.4 // Production Kernel
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          THE BLUE ARCHIVAL DOSSIER CENTERPIECE (TWO-PAGE FOLDER STYLE)
          Left Flap: Small Artifacts (Pink Excerpt A + Yellow Torn Receipt)
          Right Flap: Main Documentation Page (White Punched Ledger with Math & Specs)
          ========================================================================= */}
      <div className="max-w-[1520px] mx-auto relative pb-20 pr-0 lg:pr-16">
        
        {/* Mobile Dossier Horizontal Tabs (< lg) */}
        <div className="flex lg:hidden overflow-x-auto pb-3 gap-2 no-scrollbar mb-2 px-1">
          {dossierTabs.map((tab) => {
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(1);
                  bringToFront('main');
                }}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-white font-mono text-xs uppercase shadow-md transition-all cursor-pointer ${tab.color} ${tab.hoverColor} ${
                  isCurrent ? 'ring-2 ring-white font-bold opacity-100 scale-[1.02]' : 'opacity-80'
                }`}
              >
                <span className="font-['Silkscreen'] text-[9px] tracking-wider">{tab.fileNo}</span>
                <span className="text-[11px] font-sans font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile Flap Selector (Ledger vs Evidence) */}
        <div className="flex lg:hidden items-center justify-center p-1 bg-[#1053F3]/50 border border-blue-400/30 rounded-xl mb-3 text-xs font-mono">
          <button
            type="button"
            onClick={() => setMobileFlap('spec')}
            className={`flex-1 py-2 px-2 rounded-lg text-center font-bold transition-all cursor-pointer ${
              mobileFlap === 'spec'
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-white/80 hover:text-white'
            }`}
          >
            📋 Specification (File 0{activeTab === 'edl' ? '1' : activeTab === 'quishing' ? '2' : activeTab === 'lexical' ? '3' : '4'})
          </button>
          <button
            type="button"
            onClick={() => setMobileFlap('evidence')}
            className={`flex-1 py-2 px-2 rounded-lg text-center font-bold transition-all cursor-pointer ${
              mobileFlap === 'evidence'
                ? 'bg-[#F8A5B2] text-slate-900 shadow-md'
                : 'text-white/80 hover:text-white'
            }`}
          >
            📑 Evidence Slips (2)
          </button>
        </div>

        {/* Main Blue Folder Container */}
        <div className="relative rounded-[24px] sm:rounded-[36px] bg-[#1053F3] p-4 sm:p-7 lg:p-9 shadow-2xl min-h-[820px] border border-blue-400/25">
          
          {/* Subtle archival linen texture overlay */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#FFFFFF_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none rounded-[24px] sm:rounded-[36px]" />

          {/* Center Folder Crease / Spine (3D depth fold between Left & Right flaps) */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-8 -translate-x-1/2 pointer-events-none z-10">
            <div className="w-full h-full bg-gradient-to-r from-black/25 via-black/40 to-black/15 shadow-inner" />
            <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-white/20 -translate-x-1/2" />
          </div>

          {/* -------------------------------------------------------------------
              SIDE FILE TABS (Sticking outwards past the right edge of the folder - DESKTOP ONLY)
              ------------------------------------------------------------------- */}
          <div className="hidden lg:flex absolute -right-11 sm:-right-12 top-12 sm:top-18 flex-col gap-3 z-30">
            {dossierTabs.map((tab) => {
              const isCurrent = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setCurrentPage(1);
                    bringToFront('main');
                  }}
                  className={`relative flex items-center justify-center py-5 px-1.5 rounded-r-xl text-white font-mono uppercase tracking-wider shadow-2xl transition-all cursor-pointer ${tab.color} ${tab.hoverColor} ${
                    isCurrent
                      ? 'w-11 sm:w-13 translate-x-1 ring-2 ring-white/60 font-bold opacity-100 shadow-blue-950/60'
                      : 'w-9 sm:w-11 opacity-85 hover:opacity-100 hover:translate-x-1'
                  }`}
                  style={{ writingMode: 'vertical-rl' }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-['Silkscreen'] text-[9px] tracking-widest">{tab.fileNo}</span>
                    <span className="text-[11px] font-sans font-medium tracking-normal">{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* -------------------------------------------------------------------
              TWO-PAGE SPREAD GRID (Left: Small Artifacts / Right: Main Page)
              ------------------------------------------------------------------- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 relative z-20 items-stretch">
            
            {/* =================================================================
                LEFT FLAP: SMALL EVIDENCE ARTIFACTS
                Top: Pink Excerpt A (Security Advisory Bulletin)
                Bottom: Yellow Torn Audit Slip (Forensic Chain-of-Custody)
                ================================================================= */}
            <div className={`flex-col justify-between gap-6 relative min-h-[660px] lg:min-h-[680px] ${
              mobileFlap === 'evidence' ? 'flex' : 'hidden lg:flex'
            }`}>
              
              {/* SHEET 2: PINK EXCERPT SHEET ("Excerpt A" / Threat Bulletin) */}
              <div
                onMouseDown={(e) => handleMouseDown('excerpt', e)}
                onTouchStart={(e) => handleTouchStart('excerpt', e)}
                onClick={() => bringToFront('excerpt')}
                style={{
                  transform: `translate3d(${positions.excerpt.x}px, ${positions.excerpt.y}px, 0)`,
                  zIndex: getZIndex('excerpt'),
                  touchAction: 'none'
                }}
                className={`relative w-full rounded-xl sm:rounded-2xl bg-[#F8A5B2] text-slate-900 p-6 sm:p-7 shadow-2xl border border-black/15 cursor-grab active:cursor-grabbing select-none ${
                  draggingSheet === 'excerpt'
                    ? 'transition-none ring-4 ring-black/15 shadow-2xl'
                    : 'transition-transform duration-200 hover:-translate-y-1'
                }`}
              >
                {/* Boxed stamp on pink sheet */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-black/15">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-slate-700 block">
                      SECURITY ADVISORY // CRITICAL BULLETIN
                    </span>
                    <h3 className="font-['Instrument_Serif'] italic text-2xl sm:text-3xl text-slate-900">
                      Adversarial Zero-Day Intercept
                    </h3>
                  </div>
                  <div className="border border-black/30 px-2 py-0.5 rounded font-mono text-[10px] uppercase font-semibold bg-white/40">
                    Bulletin #0027-A
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs font-serif leading-relaxed text-slate-800">
                  <p>
                    Adversarial campaign telemetry demonstrates widespread adoption of multi-stage homoglyph domain generation (DGA) coupled with recursive shortener redirects. Perpetrators deploy compromised Cloudflare free-tier TLS certificates to mask fraudulent landing portals.
                  </p>
                  <div className="space-y-2 font-mono text-[10.5px] text-slate-700">
                    <p>
                      PhishShield Evidential Arbitration intercepted payload cluster 0027-A. Epistemic uncertainty evaluated at u = 0.42 (exceeding detonation gate u ≥ 0.35), triggering automated headless DOM capture and sinkhole quarantine.
                    </p>
                    <div className="pt-2 flex items-center justify-between text-[9.5px] border-t border-black/10 text-slate-700 font-semibold">
                      <span>CASE: PSX-2026-0027A</span>
                      <span>VERDICT: MALICIOUS</span>
                      <span className="text-red-700">SEV: CRITICAL</span>
                    </div>
                  </div>
                </div>

                {/* Authentic Circular Stamp on Pink Paper */}
                <div className="absolute right-5 bottom-3.5 flex items-center gap-2 pointer-events-none opacity-85">
                  <div className="text-right">
                    <span className="block text-[8px] font-mono uppercase tracking-widest text-slate-700">KERNEL VERIFIED</span>
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-dashed border-red-700 flex items-center justify-center font-['Instrument_Serif'] italic text-[11px] text-red-900">
                    SEC
                  </div>
                </div>
              </div>

              {/* SHEET 3: YELLOW PINNED TORN RECEIPT ("RECEIPT" SLIP) */}
              <div
                onMouseDown={(e) => handleMouseDown('receipt', e)}
                onTouchStart={(e) => handleTouchStart('receipt', e)}
                onClick={() => bringToFront('receipt')}
                style={{
                  transform: `translate3d(${positions.receipt.x}px, ${positions.receipt.y}px, 0)`,
                  zIndex: getZIndex('receipt'),
                  // Jagged torn receipt bottom edge styling
                  clipPath: 'polygon(0% 0%, 100% 0%, 100% 96%, 95% 100%, 90% 96%, 85% 100%, 80% 96%, 75% 100%, 70% 96%, 65% 100%, 60% 96%, 55% 100%, 50% 96%, 45% 100%, 40% 96%, 35% 100%, 30% 96%, 25% 100%, 20% 96%, 15% 100%, 10% 96%, 5% 100%, 0% 96%)',
                  touchAction: 'none'
                }}
                className={`relative ml-1 sm:ml-4 -rotate-1 w-64 sm:w-76 rounded-t-lg bg-[#FEF08A] text-slate-900 p-4.5 shadow-2xl border border-black/20 cursor-grab active:cursor-grabbing select-none ${
                  draggingSheet === 'receipt'
                    ? 'transition-none ring-4 ring-amber-400/40 shadow-2xl'
                    : 'transition-transform duration-200 hover:-translate-y-1'
                }`}
              >
                {/* Realistic Silver Paperclip SVG Pinning the Receipt */}
                <div className="absolute -top-4 right-6 w-5 h-12 pointer-events-none z-50">
                  <svg viewBox="0 0 24 50" fill="none" className="w-full h-full drop-shadow-md">
                    <path
                      d="M 6 12 V 38 C 6 44, 18 44, 18 38 V 8 C 18 3, 10 3, 10 8 V 32 C 10 35, 14 35, 14 32 V 14"
                      stroke="#475569"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M 6 12 V 38 C 6 44, 18 44, 18 38 V 8 C 18 3, 10 3, 10 8 V 32 C 10 35, 14 35, 14 32 V 14"
                      stroke="#E2E8F0"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Receipt Header */}
                <div className="text-center border-b border-black/15 pb-2 mb-2.5">
                  <span className="font-['Silkscreen'] text-[9px] uppercase tracking-widest text-slate-600 block">
                    PHISHSHIELD // CHAIN OF CUSTODY
                  </span>
                  <h4 className="font-mono text-lg font-extrabold tracking-widest text-slate-900 uppercase">
                    FORENSIC AUDIT
                  </h4>
                </div>

                {/* Receipt Forensic Key-Values */}
                <div className="space-y-1.5 font-mono text-[10px] text-slate-800 leading-tight">
                  <div className="flex justify-between">
                    <span className="text-slate-500">SENSOR:</span>
                    <span className="font-bold">Autonomous Daemon #04</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">TIMESTAMP:</span>
                    <span>Nov 02, 2026 // 20:45 UTC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ENGINE:</span>
                    <span>M³ Multimodal Early Fusion</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">VERDICT:</span>
                    <span className="font-bold text-red-700">0027-A MALICIOUS (OOD)</span>
                  </div>
                </div>

                {/* Signature Box */}
                <div className="mt-3.5 pt-2 border-t border-black/15 flex flex-col items-center">
                  <div className="w-full border border-black/30 rounded p-1.5 bg-amber-100/60 flex items-center justify-center">
                    <span className="font-['Instrument_Serif'] italic text-sm tracking-widest text-slate-800 font-semibold">
                      PhishShield Security Kernel
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">Automated Cryptographic Seal</span>
                </div>
              </div>

            </div>

            {/* =================================================================
                RIGHT FLAP: PRIMARY WHITE DOSSIER PAGE (PAGINATED SPREAD)
                Exact same height as left flap, interactive multi-page folding
                ================================================================= */}
            <div className={`relative min-h-[660px] lg:min-h-[680px] flex flex-col ${
              mobileFlap === 'spec' ? 'flex' : 'hidden lg:flex'
            }`}>
              <div
                onMouseDown={(e) => handleMouseDown('main', e)}
                onTouchStart={(e) => handleTouchStart('main', e)}
                onClick={() => bringToFront('main')}
                style={{
                  transform: `translate3d(${positions.main.x}px, ${positions.main.y}px, 0)`,
                  zIndex: getZIndex('main'),
                  touchAction: 'none'
                }}
                className={`relative rounded-xl sm:rounded-2xl bg-[#FAF9F5] text-[#1A1A1A] p-4 sm:p-7 lg:p-8 shadow-2xl border border-black/10 select-none cursor-grab active:cursor-grabbing min-h-[660px] lg:min-h-[680px] flex flex-col justify-between ${
                  draggingSheet === 'main' ? 'transition-none ring-4 ring-black/15 shadow-2xl' : 'transition-transform duration-200'
                }`}
              >
                
                {/* 5 Binder Punch Holes along the Left Margin */}
                <div className="absolute left-2 sm:left-4 top-8 bottom-8 flex flex-col justify-between pointer-events-none">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full bg-[#1053F3] shadow-inner border border-black/25" />
                  ))}
                </div>

                {/* Vertical Edge Barcode & Reference Tag */}
                <div className="hidden sm:flex absolute right-3 sm:right-5 top-20 bottom-20 items-center pointer-events-none opacity-40">
                  <span
                    className="font-mono text-[9px] tracking-[0.25em] text-black"
                    style={{ writingMode: 'vertical-rl' }}
                  >
                    PHISHSHIELD-X // SPECIFICATION DOSSIER // ARCHIVE
                  </span>
                </div>

                {/* Top Section: Header inside White Sheet */}
                <div>
                  <div className="flex items-start justify-between border-b border-black/10 pb-3 mb-4 pl-4 sm:pl-7">
                    <div>
                      <span className="font-mono text-[9px] sm:text-[9.5px] tracking-widest uppercase text-slate-500 block mb-0.5">
                        PHISHSHIELD-X ARCHITECTURAL SPECIFICATION
                      </span>
                      <h2 className="font-['Instrument_Serif'] italic text-xl sm:text-2xl md:text-3xl text-slate-900 leading-tight">
                        {activeTab === 'edl' && (
                          currentPage === 1 ? 'Evidential Deep Learning' :
                          currentPage === 2 ? 'Dynamic Routing & Detonation' :
                          currentPage === 3 ? 'Bayes Loss & Regularization' :
                          'Empirical Calibration Benchmarks'
                        )}
                        {activeTab === 'quishing' && (
                          currentPage === 1 ? 'Symbology Ingestion Pipeline' :
                          currentPage === 2 ? 'ViT Patch Attention & Decal Tampering' :
                          'Multi-Hop Redirect Unfolding & Fusion'
                        )}
                        {activeTab === 'lexical' && (
                          currentPage === 1 ? '34-Dim Lexical Acoustics & Entropy' :
                          currentPage === 2 ? 'Infrastructure & ASN Profiling' :
                          'Cryptographic TLS & Homoglyph Defense'
                        )}
                        {activeTab === 'api' && (
                          currentPage === 1 ? 'URL Threat Detection API' :
                          currentPage === 2 ? 'Multimodal Barcode & Email Endpoints' :
                          'Headless Detonation & Telemetry Streaming'
                        )}
                      </h2>
                    </div>

                    {/* Boxed Stamp with File & Page */}
                    <div className="border border-slate-400 px-2.5 py-1 rounded font-mono text-[10.5px] uppercase tracking-wider text-slate-800 font-semibold bg-white/70 shadow-xs">
                      {activeTab === 'edl' && `File #01 // P.0${currentPage}`}
                      {activeTab === 'quishing' && `File #02 // P.0${currentPage}`}
                      {activeTab === 'lexical' && `File #03 // P.0${currentPage}`}
                      {activeTab === 'api' && `File #04 // P.0${currentPage}`}
                    </div>
                  </div>

                  {/* Document Body: Curated Content Per Page */}
                  <div
                    className={`grid grid-cols-1 md:grid-cols-12 gap-5 pl-5 sm:pl-7 transition-all duration-200 ${
                      isFlipping ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
                    }`}
                  >
                    
                    {/* =========================================================
                        TAB 1: EVIDENTIAL DEEP LEARNING (EDL) - 4 PAGES
                        ========================================================= */}
                    {activeTab === 'edl' && currentPage === 1 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">DIRICHLET PRIOR:</strong>
                            Uniform prior α_0 = [1.0, 1.0].
                          </p>
                          <p>
                            Uncertainty u scales inversely with total subjective evidence sum S.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                              KERNEL 01 // M3 FOUNDATION
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs sm:text-sm leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            Conventional softmax neural networks force artificial certainty onto Out-of-Distribution (OOD) adversarial payloads, mapping novel variants to confident false negatives.
                          </p>
                          
                          <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
                            PhishShield models class probabilities as a higher-order Dirichlet probability density over the multinomial simplex parameterized by non-negative evidence vectors <span className="font-mono bg-slate-200 px-1 py-0.5 rounded font-bold text-slate-900">e_k ≥ 0</span>.
                          </p>

                          <div className="rounded-lg border border-slate-300 bg-white p-2.5 font-mono text-xs space-y-1.5 shadow-xs">
                            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-bold border-b border-slate-200 pb-1 flex justify-between">
                              <span>// PROOF SPECIFICATION 17B-EDL</span>
                              <span className="text-blue-700 font-bold">K = 2 CLASSES</span>
                            </div>
                            <div className="space-y-1 text-slate-700 text-[10px]">
                              <div className="flex justify-between items-center p-1.5 bg-slate-50 rounded border border-slate-200">
                                <span className="text-slate-500">Dirichlet Evidence Sum (S):</span>
                                <span className="font-bold text-slate-900 font-mono">S = ∑ α_k = ∑ (e_k + 1)</span>
                              </div>
                              <div className="flex justify-between items-center p-1.5 bg-blue-50 rounded border border-blue-200">
                                <span className="text-blue-900">Vacuous Epistemic Uncertainty (u):</span>
                                <span className="font-bold text-blue-800 font-mono">u = K / S ∈ (0, 1]</span>
                              </div>
                              <div className="flex justify-between items-center p-1.5 bg-slate-50 rounded border border-slate-200">
                                <span className="text-slate-500">Expected Probability (p_k):</span>
                                <span className="font-bold text-slate-900 font-mono">p_k = α_k / S</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === 'edl' && currentPage === 2 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">ROUTING SPECIFICATION:</strong>
                            Autonomous thresholding decouples known threats from novel attack vectors.
                          </p>
                          <p>
                            Zero-day isolation threshold calibrated at u ≥ 0.35.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono font-semibold">
                              DETONATION GATES
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-2.5 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            Multi-threshold evidential gating dynamically routes traffic based on measured uncertainty, eliminating user friction while quarantining zero-day campaigns.
                          </p>

                          <div className="space-y-2 font-mono text-[10.5px]">
                            <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-lg">
                              <span className="font-bold text-emerald-800 block">GATE 1: LOW UNCERTAINTY (SAFE TRANSIT)</span>
                              <span className="text-slate-600">u &lt; 0.25 ∧ p_safe &gt; 0.85 → Direct transit authorized without interstitial friction.</span>
                            </div>
                            <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg">
                              <span className="font-bold text-amber-800 block">GATE 2: BORDERLINE UNCERTAINTY (ACTIVE FRICTION)</span>
                              <span className="text-slate-600">0.25 ≤ u &lt; 0.35 → Warning overlay displayed with brand impersonation indicators.</span>
                            </div>
                            <div className="p-2 bg-red-50 border border-red-300 rounded-lg">
                              <span className="font-bold text-red-800 block">GATE 3: HIGH UNCERTAINTY (SANDBOX DETONATION)</span>
                              <span className="text-slate-600">u ≥ 0.35 ∨ p_phish &gt; 0.70 → Ephemeral Playwright browser sandbox detonation triggered.</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === 'edl' && currentPage === 3 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">LOSS OPTIMIZATION:</strong>
                            Minimizes empirical Bayes risk with KL divergence penalty on unobserved shifts.
                          </p>
                          <p>
                            Annealing coefficient λ_t = min(1.0, t/10).
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-semibold">
                              LOSS REGULARIZATION
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            To ensure high evidential humility, the objective loss function penalizes misleading evidence on non-ground-truth classes using Kullback-Leibler divergence against the uniform prior.
                          </p>

                          <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[10.5px] space-y-2">
                            <span className="text-slate-400 block">// REGULARIZED EVIDENTIAL OBJECTIVE</span>
                            <div className="text-emerald-400 font-bold">
                              L_EDL = ∑ (y_k - p_k)² + [p_k(1-p_k)/(S+1)] + λ_t · KL[Dir(α) || Dir(1)]
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-700">
                            The expected sum-of-squares balances class prediction, the variance term penalizes distribution noise, and the KL divergence enforces that unseen adversarial samples shrink evidence back to vacuous uncertainty (<span className="font-mono font-bold text-slate-900">u → 1.0</span>).
                          </p>
                        </div>
                      </>
                    )}

                    {activeTab === 'edl' && currentPage === 4 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">BENCHMARK SUITE:</strong>
                            Evaluated on 100,000 URLs from PhishTank, OpenPhish, and Tranco Top 1M.
                          </p>
                          <p>
                            ECE reduced from 0.082 to 0.012.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-semibold">
                              EMPIRICAL AUDIT
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            Comparative calibration demonstrates dramatic reduction in false confidence compared to traditional gradient-boosted trees and standard deep neural networks.
                          </p>

                          <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg">
                              <span className="text-slate-500 block text-[9.5px]">DETECTION ACCURACY</span>
                              <span className="font-bold text-slate-900 text-base">99.42%</span>
                              <span className="text-[9px] text-slate-500 block">Verified Phishing (u &lt; 0.25)</span>
                            </div>
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg">
                              <span className="text-slate-500 block text-[9.5px]">FALSE POSITIVE RATE</span>
                              <span className="font-bold text-emerald-700 text-base">&lt; 0.18%</span>
                              <span className="text-[9px] text-slate-500 block">Tranco Top 10,000 Domains</span>
                            </div>
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg">
                              <span className="text-slate-500 block text-[9.5px]">OOD AUROC SCORE</span>
                              <span className="font-bold text-blue-700 text-base">0.984</span>
                              <span className="text-[9px] text-slate-500 block">Zero-Day Campaign Detection</span>
                            </div>
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg">
                              <span className="text-slate-500 block text-[9.5px]">INFERENCE LATENCY</span>
                              <span className="font-bold text-slate-900 text-base">8.4ms</span>
                              <span className="text-[9px] text-slate-500 block">Single CPU Core (Warm)</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* =========================================================
                        TAB 2: QUISHNET-V2 MATRIX - 3 PAGES
                        ========================================================= */}
                    {activeTab === 'quishing' && currentPage === 1 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">OPTICAL PIPELINE:</strong>
                            Adaptive Gaussian binarization + Reed-Solomon codeword extraction.
                          </p>
                          <p>
                            Tolerates up to 30% pixel occlusion.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                              ZBAR MORPHOLOGY
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            Physical QR codes present severe optical degradation: camera glare, printing skew, dark-mode color inversion, and scratched physical substrates.
                          </p>

                          <div className="p-3 bg-slate-100 rounded-xl border border-slate-300 font-mono text-xs space-y-1.5 shadow-xs">
                            <span className="font-bold text-slate-900 block text-[10px]">// MULTI-PASS EXTRACTION WORKFLOW</span>
                            <div className="space-y-1 text-slate-700 text-[10.5px]">
                              <p>1. Multi-scale binarization with Otsu adaptive thresholding</p>
                              <p>2. Dual-channel inverted contrast normalization (dark-mode compensation)</p>
                              <p>3. Direct symbology extraction of Reed-Solomon error correction codewords</p>
                              <p>4. Transparent alpha-channel reconstruction for stylized marketing codes</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === 'quishing' && currentPage === 2 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">PHYSICAL TAMPERING:</strong>
                            ViT-B/16 patch embeddings over barcode boundary.
                          </p>
                          <p>
                            Identifies malicious sticker overlays on legitimate signage.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono font-semibold">
                              DECAL TAMPER RADAR
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            Physical quishing attacks frequently exploit environmental trust by pasting adhesive vinyl decals over authentic parking meters, restaurant tables, and payment terminals.
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10.5px]">
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg space-y-1">
                              <span className="font-bold text-slate-900">Decal Edge & Seam Detection</span>
                              <p className="text-slate-600">Analyzes micro-creases and specular glare discontinuities along sticker boundaries.</p>
                            </div>
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg space-y-1">
                              <span className="font-bold text-slate-900">Contrast Inversion Normalizer</span>
                              <p className="text-slate-600">Reverses inverted luminescence palettes used to bypass naive barcode scanners.</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === 'quishing' && currentPage === 3 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">REDIRECT TRACE:</strong>
                            Recursively unmasks HTTP 301/302 shorteners up to 10 hops.
                          </p>
                          <p>
                            Fuses optical & lexical signals via M³ early fusion layer.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-semibold">
                              M³ EARLY FUSION
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            Adversaries hide destination payloads behind multi-hop shortener chains (bit.ly, tinyurl, is.gd) to prevent static gateway URL filtering.
                          </p>

                          <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg font-mono text-[10.5px] text-slate-700 space-y-1.5">
                            <span className="font-bold text-slate-900 block">// REDIRECT TRACE & EARLY FUSION PIPELINE</span>
                            <p>1. Headless TCP socket follows HTTP 301/302 Location headers to true target apex.</p>
                            <p>2. ViT visual feature vector concatenated with 34-dim lexical feature vector.</p>
                            <p>3. Unified Dirichlet layer evaluates joint evidence across visual and network signals.</p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* =========================================================
                        TAB 3: 34-DIM LEXICAL INGESTION - 3 PAGES
                        ========================================================= */}
                    {activeTab === 'lexical' && currentPage === 1 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">TOKEN ACOUSTICS:</strong>
                            Shannon entropy, character n-grams, and vowel-consonant ratios.
                          </p>
                          <p>
                            Extraction latency: 8.4ms per URL.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                              34-DIM OSINT
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            Every domain registers a distinct digital acoustic signature—entropy in its characters, suspicious homoglyphs in its punycode, and typo-squatting edit distances.
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10.5px]">
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg space-y-1">
                              <span className="font-bold text-slate-900">Shannon Token Entropy</span>
                              <p className="text-slate-600">H(X) = -∑ P(x) log2 P(x). Detects algorithmically generated domain names (DGA).</p>
                            </div>
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg space-y-1">
                              <span className="font-bold text-slate-900">Levenshtein Brand Distance</span>
                              <p className="text-slate-600">Calculates edit distances against the top 10,000 targeted enterprise domains.</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === 'lexical' && currentPage === 2 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">INFRASTRUCTURE RADAR:</strong>
                            WHOIS domain lifespan and Autonomous System (ASN) churn.
                          </p>
                          <p>
                            Zero-day flags trigger on active age &lt; 30 days.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono font-semibold">
                              NETWORK RADAR
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            Adversarial hosting environments exhibit extreme volatility: rapid DNS A-record hopping, bulletproof hosting ASNs, and newly registered domains.
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10.5px]">
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg space-y-1">
                              <span className="font-bold text-slate-900">WHOIS Registration Delta</span>
                              <p className="text-slate-600">Calculates domain creation delta; ephemeral attack domains rarely survive beyond 72 hours.</p>
                            </div>
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg space-y-1">
                              <span className="font-bold text-slate-900">Autonomous System (ASN) Profiling</span>
                              <p className="text-slate-600">Cross-references network prefixes with known high-abuse bulletproof hosting ASNs.</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === 'lexical' && currentPage === 3 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">CRYPTOGRAPHIC DEFENSE:</strong>
                            SSL Subject Alternative Name (SAN) & Punycode homoglyph defense.
                          </p>
                          <p>
                            Unmasks Cyrillic & Greek homoglyphs in Unicode hosts.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-semibold">
                              PUNYCODE SHIELD
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            Attackers exploit internationalized domain names (IDN) with look-alike characters (e.g. Cyrillic 'а' substituted for Latin 'a') to spoof trusted logins.
                          </p>

                          <div className="space-y-2 font-mono text-[10.5px]">
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg">
                              <span className="font-bold text-slate-900 block mb-0.5">SSL SAN Discrepancy Analysis</span>
                              <p className="text-slate-600">Evaluates Cloudflare/Let's Encrypt multi-domain certificates where SAN listings diverge from the primary host.</p>
                            </div>
                            <div className="p-2.5 bg-white border border-slate-300 rounded-lg">
                              <span className="font-bold text-slate-900 block mb-0.5">Punycode & Homoglyph Resolution</span>
                              <p className="text-slate-600">Translates `xn--` encoded labels to normalized Unicode and computes visual similarity against authentic corporate brands.</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* =========================================================
                        TAB 4: TELEMETRY & ENDPOINTS (API) - 3 PAGES
                        ========================================================= */}
                    {activeTab === 'api' && currentPage === 1 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">URL INSPECTION:</strong>
                            Sub-100ms inference pipelines via standard JSON HTTP protocols.
                          </p>
                          <p>
                            Direct gateway integration for enterprise proxies.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-semibold">
                              POST /api/detect/url
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            The PhishShield intelligence daemon provides real-time URL inspection with Dirichlet uncertainty arbitration.
                          </p>

                          <div className="space-y-2 font-mono text-xs">
                            <div className="p-2.5 bg-slate-900 text-slate-200 rounded-lg space-y-1.5 shadow-sm">
                              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1 text-[11px]">
                                <span>POST /api/detect/url</span>
                                <button
                                  onClick={() => copySnippet('curl-url', 'curl -X POST "http://localhost:8000/api/detect/url" -H "Content-Type: application/json" -d \'{"url": "https://suspicious-login.xyz"}\'')}
                                  className="text-[10px] hover:text-white flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedCode === 'curl-url' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                  <span>{copiedCode === 'curl-url' ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                              <pre className="overflow-x-auto text-emerald-400 font-mono text-[10.5px] leading-tight">
{`curl -X POST "http://localhost:8000/api/detect/url" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://suspicious-login.xyz"}'`}
                              </pre>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === 'api' && currentPage === 2 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">MULTIMODAL UPLOADS:</strong>
                            Multipart form-data and binary image uploads for barcodes & emails.
                          </p>
                          <p>
                            Processes PNG, JPEG, WebP, and raw EML files.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-mono font-semibold">
                              QR & EML ENDPOINTS
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            Binary decoders accept image and email payloads for morphological QR parsing and SPF/DKIM header evaluation.
                          </p>

                          <div className="space-y-2 font-mono text-xs">
                            <div className="p-2.5 bg-slate-900 text-slate-200 rounded-lg space-y-1.5 shadow-sm">
                              <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-1 text-[11px]">
                                <span>POST /api/detect/qr</span>
                                <button
                                  onClick={() => copySnippet('curl-qr', 'curl -X POST "http://localhost:8000/api/detect/qr" -F "file=@sample_qr.png"')}
                                  className="text-[10px] hover:text-white flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedCode === 'curl-qr' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                  <span>{copiedCode === 'curl-qr' ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                              <pre className="overflow-x-auto text-emerald-400 font-mono text-[10.5px] leading-tight">
{`curl -X POST "http://localhost:8000/api/detect/qr" \\
  -F "file=@sample_qr.png"`}
                              </pre>
                            </div>

                            <div className="p-2 bg-slate-100 border border-slate-200 rounded font-mono text-[10.5px] text-slate-700 flex justify-between items-center">
                              <span>POST /api/detect/email</span>
                              <span className="text-slate-600 font-semibold">Multipart .EML / text content</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {activeTab === 'api' && currentPage === 3 && (
                      <>
                        <div className="md:col-span-4 border-l-2 border-slate-300/80 pl-3 space-y-3 font-mono text-[10px] text-slate-600 leading-relaxed">
                          <p>
                            <strong className="text-slate-900 block font-semibold mb-0.5">DETONATION ENGINE:</strong>
                            Isolated DOM rendering via headless Chromium container.
                          </p>
                          <p>
                            Results cached for 1 hour via TTLCache.
                          </p>
                          <div className="pt-1">
                            <span className="text-[9px] tracking-widest uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-semibold">
                              SANDBOX CAPTURE
                            </span>
                          </div>
                        </div>

                        <div className="md:col-span-8 space-y-3 text-slate-800 text-xs leading-relaxed">
                          <p className="font-serif italic text-sm text-slate-900 leading-snug">
                            For suspicious or high-uncertainty targets, PhishShield executes an ephemeral Playwright browser session to capture visual DOM state safely.
                          </p>

                          <div className="space-y-2 font-mono text-[10.5px]">
                            <div className="p-2.5 bg-slate-900 text-slate-200 rounded-lg">
                              <span className="text-slate-400 block mb-0.5">GET /api/detect/screenshot?url=...</span>
                              <p className="text-emerald-400">Returns rendered PNG screenshot buffer or synthetic sandbox card for sinkholed hosts.</p>
                            </div>
                            <div className="p-2 bg-slate-100 border border-slate-200 rounded font-mono text-slate-700 flex justify-between items-center">
                              <span>GET /health</span>
                              <span className="text-emerald-700 font-bold">200 OK // Status: Healthy</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                  </div>
                </div>

                {/* Bottom Section: Footer with Dynamic Multi-Page Folding & Clean Controls */}
                <div className="mt-auto pt-4 border-t border-black/10 flex flex-wrap items-center justify-between gap-2.5 text-slate-600 font-mono text-xs pl-4 sm:pl-7">
                  
                  {/* Left: Project Branding */}
                  <div className="hidden sm:flex items-center gap-2">
                    <ShieldAlert size={14} className="text-blue-600" />
                    <span className="font-mono text-[10px] tracking-wider text-slate-700 uppercase font-bold">
                      PHISHSHIELD-X // SPECIFICATION DOSSIER
                    </span>
                  </div>

                  {/* Center: Dynamic Multi-Page Turn Controls (< 01 02 03 ... >) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 bg-black/[0.04] p-1 rounded-lg border border-black/10 shadow-inner">
                    <button
                      onClick={() => changePage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-1 sm:p-1.5 rounded text-slate-600 hover:text-black hover:bg-black/5 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft size={13} />
                    </button>

                    {Array.from({ length: maxPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        onClick={() => changePage(pageNum)}
                        className={`px-2 sm:px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-600 hover:text-black hover:bg-black/5'
                        }`}
                        title={`Turn to Page 0${pageNum}`}
                      >
                        0{pageNum}
                      </button>
                    ))}

                    <button
                      onClick={() => changePage(Math.min(maxPages, currentPage + 1))}
                      disabled={currentPage === maxPages}
                      className="p-1 sm:p-1.5 rounded text-slate-600 hover:text-black hover:bg-black/5 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight size={13} />
                    </button>
                  </div>

                  {/* Right: Page Counter */}
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500 hidden md:inline">
                      CLASSIFIED SPEC
                    </span>
                    <span className="font-bold text-slate-900 font-mono text-xs whitespace-nowrap">
                      PAGE 0{currentPage} / 0{maxPages}
                    </span>
                  </div>

                </div>

              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
