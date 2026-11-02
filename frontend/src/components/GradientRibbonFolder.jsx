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
      className={`group relative w-full min-h-[480px] sm:min-h-[540px] overflow-hidden flex flex-col items-center justify-center select-none transition-all duration-300 ${
        isDragOver ? 'bg-white/[0.02]' : ''
      }`}
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

      {/* Subtle top credits watermark from original reference artwork */}
      <div className="absolute top-6 inset-x-0 text-center pointer-events-none z-10 opacity-40 group-hover:opacity-70 transition-opacity">
        <span className="font-['Silkscreen'] text-[10px] tracking-widest uppercase text-white/70 block">
          PHYSICAL RECONNAISSANCE // QUISHNET-V2
        </span>
        <span className="text-[11px] font-mono text-white/50 block mt-0.5">
          Drop physical barcode or click folder to inspect
        </span>
      </div>

      {/* =========================================================================
          BACKGROUND SVG: 3D GLOWING GRADIENT RIBBONS + HORIZONTAL LIGHT BEAM
          Spans continuously from the screen's left edge to the right edge
          ========================================================================= */}
      <svg
        viewBox="0 0 1600 500"
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

          {/* Right Expanding Ambient Light Cone Gradient */}
          <linearGradient id="ambientLaserCone" x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.55" />
            <stop offset="15%" stopColor="#60A5FA" stopOpacity="0.38" />
            <stop offset="45%" stopColor="#3B82F6" stopOpacity="0.22" />
            <stop offset="80%" stopColor="#1D4ED8" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0.0" />
          </linearGradient>

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
        <circle cx="-10" cy="60" r="70" fill="#00F5D4" opacity="0.28" filter="url(#ambientSourceGlow)" />
        <circle cx="-10" cy="190" r="75" fill="#A855F7" opacity="0.30" filter="url(#ambientSourceGlow)" />
        <circle cx="-10" cy="310" r="70" fill="#F59E0B" opacity="0.25" filter="url(#ambientSourceGlow)" />
        <circle cx="-10" cy="430" r="75" fill="#F43F5E" opacity="0.30" filter="url(#ambientSourceGlow)" />

        {/* ---------------------------------------------------------------------
            THE 4 CONVERGING 3D GRADIENT RIBBONS
            Drawn from Left Screen Edge (x = -30) to Folder Entrance (x = 760)
            --------------------------------------------------------------------- */}
        
        {/* Ribbon 1: Cyan Loop (Upper Left from start of screen) */}
        <path
          d="M -30 60 C 260 60 320 230 520 230 C 620 230 690 250 760 255"
          stroke="url(#ribbonCyan)"
          strokeWidth="32"
          strokeLinecap="round"
          opacity="0.3"
          filter="url(#tubularGlow)"
        />
        <path
          d="M -30 60 C 260 60 320 230 520 230 C 620 230 690 250 760 255"
          stroke="url(#ribbonCyan)"
          strokeWidth="20"
          strokeLinecap="round"
          className="transition-all duration-300 group-hover:stroke-width-[22]"
        />
        <path
          d="M -30 59 C 260 59 320 229 520 229 C 620 229 690 249 760 254"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />

        {/* Ribbon 2: Purple High Arch (Upper Arch from start of screen) */}
        <path
          d="M -30 190 C 220 160 260 75 440 85 C 600 95 670 225 760 252"
          stroke="url(#ribbonPurple)"
          strokeWidth="34"
          strokeLinecap="round"
          opacity="0.3"
          filter="url(#tubularGlow)"
        />
        <path
          d="M -30 190 C 220 160 260 75 440 85 C 600 95 670 225 760 252"
          stroke="url(#ribbonPurple)"
          strokeWidth="22"
          strokeLinecap="round"
        />
        <path
          d="M -30 189 C 220 159 260 74 440 84 C 600 94 670 224 760 251"
          stroke="#FFFFFF"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.3"
        />

        {/* Ribbon 3: Amber / Yellow Mid Ribbon (from start of screen) */}
        <path
          d="M -30 310 C 260 310 380 195 540 215 C 620 225 690 250 760 258"
          stroke="url(#ribbonAmber)"
          strokeWidth="30"
          strokeLinecap="round"
          opacity="0.28"
          filter="url(#tubularGlow)"
        />
        <path
          d="M -30 310 C 260 310 380 195 540 215 C 620 225 690 250 760 258"
          stroke="url(#ribbonAmber)"
          strokeWidth="19"
          strokeLinecap="round"
        />
        <path
          d="M -30 309 C 260 309 380 194 540 214 C 620 224 690 249 760 257"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />

        {/* Ribbon 4: Hot Coral Bottom Curve (from start of screen) */}
        <path
          d="M -30 430 C 240 430 320 370 460 370 C 580 370 670 290 760 262"
          stroke="url(#ribbonCoral)"
          strokeWidth="36"
          strokeLinecap="round"
          opacity="0.32"
          filter="url(#tubularGlow)"
        />
        <path
          d="M -30 430 C 240 430 320 370 460 370 C 580 370 670 290 760 262"
          stroke="url(#ribbonCoral)"
          strokeWidth="24"
          strokeLinecap="round"
        />
        <path
          d="M -30 429 C 240 429 320 369 460 369 C 580 369 670 289 760 261"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.35"
        />

        {/* ---------------------------------------------------------------------
            THE HORIZONTAL EXPANDING AMBIENT LIGHT SPREAD (Outer Fan Only)
            Centered at the exact vertical midpoint of the folder (y = 224)
            Shoots straight out to the Far Right Screen Edge (x = 1640)
            --------------------------------------------------------------------- */}
        
        {/* Outer Atmospheric Haze Cone (Shifted slightly down to y = 236) */}
        <polygon
          points="800,236 1640,26 1640,446"
          fill="url(#ambientLaserCone)"
          filter="url(#atmosphericHaze)"
          opacity="0.85"
        />
      </svg>

      {/* =========================================================================
          THE MACOS FROSTED FOLDER (Positioned at Convergence Point)
          ========================================================================= */}
      <div className="relative z-10 flex flex-col items-center my-auto pt-6">
        
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

