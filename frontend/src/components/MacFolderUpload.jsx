import React, { useState } from 'react';
import { QrCode, ShieldCheck, Check, Sparkles, FileImage } from 'lucide-react';

/**
 * MacFolderUpload:
 * Recreates the exact macOS-style dark frosted folder upload interaction
 * from the user's reference image:
 * - Back folder body with top tab
 * - White inner documents that peek out and slide up on hover
 * - Smooth matte front folder pocket with bevel highlight
 * - Bottom-left micro app badges (QR + PhishShield)
 * - Typography: "Upload QR Code" with subtitle
 * - Full drag-and-drop & click-to-browse file picker integration
 */
export default function MacFolderUpload({
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
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative w-full py-12 sm:py-20 px-4 rounded-3xl transition-all duration-300 cursor-pointer flex flex-col items-center justify-center select-none ${
        isDragOver
          ? 'bg-[#0047FF]/10 ring-2 ring-[#0047FF]/50 scale-[1.02]'
          : 'hover:scale-[1.01]'
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

      {/* =========================================================================
          THE MACOS FOLDER COMPONENT (Exact visual replica of user image)
          ========================================================================= */}
      <div className="relative w-48 sm:w-56 h-36 sm:h-40 mb-6 transition-transform duration-300 group-hover:scale-105">
        
        {/* Back folder tab + base layer */}
        <div className="absolute inset-0 rounded-[22px] bg-[#2A2E37] shadow-2xl border border-white/5 overflow-hidden">
          {/* Top-left folder tab */}
          <div className="absolute top-0 left-0 w-28 h-7 bg-[#343844] rounded-tl-[20px] rounded-tr-[14px]" />
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
        <div className="absolute inset-x-0 bottom-0 h-28 sm:h-32 rounded-[22px] bg-gradient-to-b from-[#3A3F4C] via-[#2D313C] to-[#22252D] border border-white/10 shadow-2xl flex flex-col justify-between p-4 overflow-hidden">
          
          {/* Subtle top bevel light reflection */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          
          {/* Top spacer */}
          <div />

          {/* Bottom App Micro-Badges (Matching Drive/Notion badges in reference image) */}
          <div className="relative z-10 flex items-center -space-x-1.5">
            {/* Badge 1: PhishShield Blue Security Shield */}
            <div className="h-7 w-7 rounded-lg bg-[#0047FF] ring-2 ring-[#22252D] flex items-center justify-center shadow-md text-white">
              <ShieldCheck size={15} />
            </div>

            {/* Badge 2: Dark Cyber QR Matrix Badge */}
            <div className="h-7 w-7 rounded-lg bg-[#0F141F] ring-2 ring-[#22252D] flex items-center justify-center shadow-md text-[#38BDF8] border border-white/10">
              <QrCode size={14} />
            </div>
          </div>
        </div>

      </div>

      {/* =========================================================================
          LABELS BELOW FOLDER: Title + Subtitle
          (Exact Recreation of "Onboarding / 15 Files" typography from reference image)
          ========================================================================= */}
      <div className="text-center space-y-1.5 relative z-10">
        <h3 className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-[#38BDF8] transition-colors">
          {file ? file.name : 'Upload QR Code'}
        </h3>
        <p className="text-xs sm:text-sm font-normal text-white/60 flex items-center justify-center gap-1.5">
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

      {/* Floating indicator tag on dragover or file presence */}
      {isDragOver && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center animate-bounce">
          <span className="px-3 py-1 rounded-full bg-[#0047FF] text-white text-[11px] font-['Silkscreen'] tracking-wider shadow-lg">
            DROP IMAGE TO LOAD
          </span>
        </div>
      )}
    </div>
  );
}

