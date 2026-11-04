import React, { useState } from 'react';
import { QrCode, ShieldCheck, Check, Sparkles } from 'lucide-react';

/**
 * GradientRibbonFolder:
 * Faithfully recreates the artwork reference (Ashwin Pradeep Kumar - "Gradients Exploration"):
 * - Smooth 3D glowing multi-colored tubular gradient ribbons (cyan, purple, amber, coral)
 *   curving in from the left.
 * - The sleek frosted macOS dark folder anchored at the convergence point.
 * - A radiant white focal point and expanding horizontal light beam firing to the right.
 * - Clicking the folder or dropzone opens the native file selection dialog.
 */
export default function GradientRibbonFolder({
  file,
  preview,
  onFileSelect,
  inputRef,
  isScanning = false
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClick = () => {
    if (inputRef && inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative w-full min-h-[380px] sm:min-h-[420px] overflow-hidden flex flex-col items-center justify-center select-none transition-all duration-300 ${
        isDragOver ? 'bg-white/[0.02]' : ''
      }`}
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 15px, black calc(100% - 15px), transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15px, black calc(100% - 15px), transparent 100%)'
      }}
    >
      {/* Hidden native input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onFileSelect(e.target.files[0]);
          }
        }}
        className="hidden"
      />

      {/* =========================================================================
          BACKGROUND SVG: 3D GLOWING GRADIENT RIBBONS + HORIZONTAL LIGHT BEAM
          Spans continuously from the screen's left edge to the right edge
          ========================================================================= */}
      <svg
        viewBox="0 0 1600 450"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
      >
        <defs>
          {/* Gradient 1: Cyan / Emerald Ribbon */}
          <linearGradient id="ribbonCyan" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F5D4" />
            <stop offset="50%" stopColor="#00BBF9" />
            <stop offset="100%" stopColor="#4361EE" />
          </linearGradient>

          {/* Gradient 2: Purple / Violet Ribbon */}
          <linearGradient id="ribbonPurple" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D946EF" />
            <stop offset="50%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>

          {/* Gradient 3: Warm Amber / Gold Ribbon */}
          <linearGradient id="ribbonAmber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="60%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EA580C" />
          </linearGradient>

          {/* Gradient 4: Hot Coral / Crimson Ribbon */}
          <linearGradient id="ribbonCoral" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FB7185" />
            <stop offset="50%" stopColor="#F43F5E" />
            <stop offset="100%" stopColor="#E11D48" />
          </linearGradient>

          {/* Multi-stop Connector Line Gradient */}
          <linearGradient id="flowPipeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FE70A3" />
            <stop offset="28%" stopColor="#FE70A3" />
            <stop offset="48%" stopColor="#FFA048" />
            <stop offset="78%" stopColor="#FEE140" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>

          {/* Badge Drop Shadows */}
          <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000000" floodOpacity="0.45" />
          </filter>

          <filter id="pipeGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Glow Filters */}
          <filter id="tubularGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="15" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="laserGlow" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="8" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>

          <filter id="atmosphericHaze" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="16" />
          </filter>

          <filter id="ambientSourceGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="28" />
          </filter>
        </defs>

        {/* ---------------------------------------------------------------------
            SOURCE GLOW NODES (Soft atmospheric ambient glows at screen left edge)
            --------------------------------------------------------------------- */}
        <circle cx="-10" cy="35" r="55" fill="#00F5D4" opacity="0.22" filter="url(#ambientSourceGlow)" />
        <circle cx="-10" cy="130" r="65" fill="#A855F7" opacity="0.25" filter="url(#ambientSourceGlow)" />
        <circle cx="-10" cy="250" r="65" fill="#F59E0B" opacity="0.22" filter="url(#ambientSourceGlow)" />
        <circle cx="-10" cy="355" r="55" fill="#F43F5E" opacity="0.24" filter="url(#ambientSourceGlow)" />

        {/* ---------------------------------------------------------------------
            THE 4 CONVERGING 3D GRADIENT RIBBONS
            Drawn from Left Screen Edge (x = -30) to Folder Entrance (x = 760)
            --------------------------------------------------------------------- */}
        
        {/* Ribbon 1: Cyan Loop (Upper Left from start of screen) */}
        <path
          d="M -30 20 C 260 20 320 170 520 170 C 620 170 690 186 760 191"
          stroke="url(#ribbonCyan)"
          strokeWidth="32"
          strokeLinecap="round"
          opacity="0.3"
          filter="url(#tubularGlow)"
        />
        <path
          d="M -30 20 C 260 20 320 170 520 170 C 620 170 690 186 760 191"
          stroke="url(#ribbonCyan)"
          strokeWidth="20"
          strokeLinecap="round"
          className="transition-all duration-300 group-hover:stroke-width-[22]"
        />
        <path
          d="M -30 19 C 260 19 320 169 520 169 C 620 169 690 185 760 190"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />

        {/* Ribbon 2: Purple High Arch (Upper Arch from start of screen) */}
        <path
          d="M -30 130 C 220 100 260 25 440 35 C 600 45 670 162 760 188"
          stroke="url(#ribbonPurple)"
          strokeWidth="34"
          strokeLinecap="round"
          opacity="0.3"
          filter="url(#tubularGlow)"
        />
        <path
          d="M -30 130 C 220 100 260 25 440 35 C 600 45 670 162 760 188"
          stroke="url(#ribbonPurple)"
          strokeWidth="22"
          strokeLinecap="round"
        />
        <path
          d="M -30 129 C 220 99 260 24 440 34 C 600 44 670 161 760 187"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.3"
        />

        {/* Ribbon 3: Amber / Yellow Mid Ribbon (from start of screen) */}
        <path
          d="M -30 250 C 260 250 380 135 540 155 C 620 165 690 188 760 194"
          stroke="url(#ribbonAmber)"
          strokeWidth="30"
          strokeLinecap="round"
          opacity="0.28"
          filter="url(#tubularGlow)"
        />
        <path
          d="M -30 250 C 260 250 380 135 540 155 C 620 165 690 188 760 194"
          stroke="url(#ribbonAmber)"
          strokeWidth="19"
          strokeLinecap="round"
        />
        <path
          d="M -30 249 C 260 249 380 134 540 154 C 620 164 690 187 760 193"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />

        {/* Ribbon 4: Hot Coral Bottom Curve (from start of screen) */}
        <path
          d="M -30 370 C 240 370 320 310 460 310 C 580 310 670 230 760 198"
          stroke="url(#ribbonCoral)"
          strokeWidth="36"
          strokeLinecap="round"
          opacity="0.32"
          filter="url(#tubularGlow)"
        />
        <path
          d="M -30 370 C 240 370 320 310 460 310 C 580 310 670 230 760 198"
          stroke="url(#ribbonCoral)"
          strokeWidth="24"
          strokeLinecap="round"
        />
        <path
          d="M -30 369 C 240 369 320 309 460 309 C 580 309 670 229 760 197"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.35"
        />

        {/* ---------------------------------------------------------------------
            CYBER SECURITY PIPELINE (ShadowLens Evidential Flow)
            Replaces the empty light beam with a clean, connected security pipeline
            --------------------------------------------------------------------- */}

        {/* The Smooth Connecting Flow Pipes (Pink -> Orange -> Yellow -> Purple) */}
        {/* Segment 1: Origin from folder right edge towards Decode */}
        <path
          d="M 915 192 L 965 192 Q 1005 192 1005 160 L 1005 100 Q 1005 65 1040 65 L 1070 65"
          stroke="url(#flowPipeGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#pipeGlow)"
        />
        {/* Segment 2: Downwards curve to Analyze */}
        <path
          d="M 1005 130 L 1005 250 Q 1005 284 1035 284 L 1065 284"
          stroke="url(#flowPipeGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#pipeGlow)"
        />
        {/* Segment 3: Analyze to Verify */}
        <path
          d="M 1235 284 L 1300 284 Q 1340 284 1340 250 L 1340 145 Q 1340 114 1375 114 L 1400 114"
          stroke="url(#flowPipeGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#pipeGlow)"
        />
        {/* Segment 4: Verify to Shield */}
        <path
          d="M 1500 114 L 1525 114 Q 1550 114 1550 145 L 1550 250 Q 1550 284 1525 284 L 1495 284"
          stroke="url(#flowPipeGradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          filter="url(#pipeGlow)"
        />

        {/* Sleek Cyber Junction Nodes (No cartoon avatars) */}
        <g filter="url(#pipeGlow)">
          <circle cx="1005" cy="130" r="8" fill="#080A10" stroke="#FE70A3" strokeWidth="2.5" />
          <circle cx="1005" cy="130" r="3.2" fill="#FE70A3" />

          <circle cx="1270" cy="284" r="8" fill="#080A10" stroke="#FFA048" strokeWidth="2.5" />
          <circle cx="1270" cy="284" r="3.2" fill="#FFA048" />

          <circle cx="1550" cy="199" r="8" fill="#080A10" stroke="#FEE140" strokeWidth="2.5" />
          <circle cx="1550" cy="199" r="3.2" fill="#FEE140" />
        </g>

        {/* ---------------------------------------------------------------------
            THE 4 CURATED CYBER SECURITY BADGES (Decode -> Analyze -> Verify -> Shield)
            --------------------------------------------------------------------- */}
        
        {/* Stage 1: Decode (Pink) - Barcode & payload extraction */}
        <g filter="url(#badgeShadow)" className="cursor-pointer transition-transform duration-200 hover:scale-105">
          <rect
            x="1070"
            y="30"
            width="170"
            height="68"
            rx="24"
            ry="24"
            fill="#FE70A3"
          />
          <text
            x="1155"
            y="75"
            textAnchor="middle"
            fontFamily="'Plus Jakarta Sans', -apple-system, sans-serif"
            fontSize="28"
            fontWeight="800"
            fill="#080A10"
            letterSpacing="-0.01em"
          >
            Decode
          </text>
        </g>

        {/* Stage 2: Analyze (Warm Amber) - Multi-modal heuristics */}
        <g filter="url(#badgeShadow)" className="cursor-pointer transition-transform duration-200 hover:scale-105">
          <rect
            x="1065"
            y="250"
            width="170"
            height="68"
            rx="24"
            ry="24"
            fill="#FFA048"
          />
          <text
            x="1150"
            y="295"
            textAnchor="middle"
            fontFamily="'Plus Jakarta Sans', -apple-system, sans-serif"
            fontSize="28"
            fontWeight="800"
            fill="#080A10"
            letterSpacing="-0.01em"
          >
            Analyze
          </text>
        </g>

        {/* Stage 3: Verify (Sunny Yellow) - Dirichlet evidential consensus */}
        <g filter="url(#badgeShadow)" className="cursor-pointer transition-transform duration-200 hover:scale-105">
          <rect
            x="1400"
            y="80"
            width="155"
            height="68"
            rx="24"
            ry="24"
            fill="#FEE140"
          />
          <text
            x="1477"
            y="125"
            textAnchor="middle"
            fontFamily="'Plus Jakarta Sans', -apple-system, sans-serif"
            fontSize="28"
            fontWeight="800"
            fill="#080A10"
            letterSpacing="-0.01em"
          >
            Verify
          </text>
        </g>

        {/* Stage 4: Shield (Lavender) - Threat neutralization & isolation */}
        <g filter="url(#badgeShadow)" className="cursor-pointer transition-transform duration-200 hover:scale-105">
          <rect
            x="1380"
            y="250"
            width="155"
            height="68"
            rx="24"
            ry="24"
            fill="#A78BFA"
          />
          <text
            x="1457"
            y="295"
            textAnchor="middle"
            fontFamily="'Plus Jakarta Sans', -apple-system, sans-serif"
            fontSize="28"
            fontWeight="800"
            fill="#080A10"
            letterSpacing="-0.01em"
          >
            Shield
          </text>
        </g>
      </svg>

      {/* =========================================================================
          THE MACOS FROSTED FOLDER (Positioned at Convergence Point)
          ========================================================================= */}
      <div className="relative z-10 flex flex-col items-center justify-center my-auto pt-0">
        
        {/* Only clicking directly on the folder (or text below) triggers file selection */}
        <div
          onClick={handleClick}
          className="relative w-48 sm:w-56 h-36 sm:h-40 mb-4 transition-transform duration-300 hover:scale-105 cursor-pointer"
        >
          
          {/* Back folder tab + base layer */}
          <div className="absolute inset-0 rounded-[22px] bg-[#222630] shadow-2xl border border-white/10 overflow-hidden">
            {/* Top-left folder tab */}
            <div className="absolute top-0 left-0 w-28 h-7 bg-[#2E3340] rounded-tl-[20px] rounded-tr-[14px]" />
          </div>

          {/* Inner Documents peeking out from the folder pocket */}
          <div className="absolute inset-x-5 top-2 h-24 pointer-events-none transition-transform duration-300 ease-out group-hover:-translate-y-3">
            {preview ? (
              /* Live QR image thumbnail inserted as the main sheet inside the folder */
              <div className="absolute inset-x-3 top-0 h-28 rounded-xl bg-white shadow-xl p-2 flex items-center justify-center border border-slate-200 overflow-hidden transform rotate-[-1deg]">
                <img
                  src={preview}
                  alt="Selected QR Preview"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
            ) : (
              <>
                {/* Back paper sheet (slightly tilted left) */}
                <div className="absolute left-3 right-12 top-1 h-24 rounded-xl bg-[#E8EDF5] shadow-sm transform -rotate-3 border border-white/40 p-2.5 flex flex-col gap-1.5 opacity-90">
                  <div className="w-9 h-1.5 rounded-full bg-slate-300" />
                  <div className="w-18 h-1 rounded-full bg-slate-300/60" />
                </div>

                {/* Front paper sheet (slightly tilted right with mini doc lines) */}
                <div className="absolute left-9 right-3 top-0 h-26 rounded-xl bg-white shadow-md transform rotate-2 border border-slate-200 p-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <QrCode size={12} className="text-[#0047FF]" />
                      <div className="w-12 h-1.5 rounded-full bg-slate-300" />
                    </div>
                    <div className="w-16 h-1 rounded-full bg-slate-200" />
                    <div className="w-14 h-1 rounded-full bg-slate-200" />
                  </div>
                  <div className="w-8 h-1.5 rounded-full bg-[#0047FF]/40 self-end" />
                </div>
              </>
            )}
          </div>

          {/* Front Folder Pocket (Dark matte frosted cover with smooth rounded curve) */}
          <div className="absolute inset-x-0 bottom-0 h-28 sm:h-32 rounded-[22px] bg-gradient-to-b from-[#343946] via-[#262A34] to-[#1C1F26] border border-white/10 shadow-2xl flex flex-col justify-between p-4 overflow-hidden">
            
            {/* Subtle top bevel light reflection */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            
            {/* Top spacer */}
            <div />

            {/* Bottom App Micro-Badges (Matching Drive/Notion badges in reference image) */}
            <div className="relative z-10 flex items-center -space-x-1.5">
              {/* Badge 1: PhishShield Blue Security Shield */}
              <div className="h-7 w-7 rounded-lg bg-[#0047FF] ring-2 ring-[#1C1F26] flex items-center justify-center shadow-md text-white">
                <ShieldCheck size={15} />
              </div>

              {/* Badge 2: Dark Cyber QR Matrix Badge */}
              <div className="h-7 w-7 rounded-lg bg-[#0A0D14] ring-2 ring-[#1C1F26] flex items-center justify-center shadow-md text-[#38BDF8] border border-white/10">
                <QrCode size={14} />
              </div>
            </div>
          </div>

        </div>

        {/* Labels directly below the folder (clicking also triggers selection) */}
        <div onClick={handleClick} className="text-center space-y-1 relative z-10 cursor-pointer">
          <h3 className="font-['Plus_Jakarta_Sans'] text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-[#38BDF8] transition-colors">
            {file ? file.name : 'Upload QR Code'}
          </h3>
          <p className="text-xs font-normal text-white/60 flex items-center justify-center gap-1.5">
            {file ? (
              <>
                <span className="font-mono text-emerald-400">Click to change file</span>
                <span>•</span>
                <span className="font-mono">{(file.size / 1024).toFixed(1)} KB</span>
              </>
            ) : (
              <>
                <span>PNG, JPG, WEBP, SVG</span>
                <span>•</span>
                <span className="text-white/80 group-hover:text-white transition-colors">Click to browse</span>
              </>
            )}
          </p>
        </div>

      </div>

      {/* Drag Over Active Notification */}
      {isDragOver && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center z-20 animate-bounce">
          <span className="px-4 py-1.5 rounded-full bg-[#0047FF] text-white text-xs font-['Silkscreen'] tracking-wider shadow-xl">
            DROP IMAGE TO ANALYZE
          </span>
        </div>
      )}
    </div>
  );
}

