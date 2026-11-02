import React, { useState, useEffect } from 'react';

/**
 * PantomPlusCard:
 * Dense, rich cross-marker (+) matrix tailored to Card 2:
 * - Serif italic "Hey,"
 * - Expanded dense 12x20 cross matrix (+) filling the card with zero dead space
 * - Dynamic light wave rolling across the crosses
 * - Multi-colored keyword editorial copy (URL, QR code, email, headers, visual)
 * - Dual action pills: [Inspect Target] and [u < 0.041 →]
 */
export default function PantomPlusCard({ onLaunchScan, className = '' }) {
  const rows = 12;
  const cols = 20;
  const [tick, setTick] = useState(0);

  // Smooth wave animation rolling across the plus matrix
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => (prev + 1) % 100);
    }, 110);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`w-full h-full flex flex-col justify-between p-5 sm:p-6 select-none text-white ${className}`}>
      
      {/* 1. Header: Serif "Hey," */}
      <div>
        <h2 className="font-serif italic text-2xl sm:text-3xl text-white font-normal tracking-tight mb-2">
          Hey,
        </h2>

        {/* 2. Center: Dense Dynamic Cross (+) Grid - No gaps, full coverage */}
        <div className="my-1 py-0.5 font-mono text-[12px] sm:text-[13px] leading-[1.25] tracking-[0.22em] sm:tracking-[0.26em] overflow-hidden">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex whitespace-nowrap justify-between">
              {Array.from({ length: cols }).map((_, c) => {
                // Diagonal light wave equation
                const dist = (c * 2 + r * 2.5 - tick * 1.6) % 36;
                const normDist = ((dist % 36) + 36) % 36;
                const isBright = normDist < 4.5;
                const isMedium = normDist >= 4.5 && normDist < 10;

                let color = 'text-white/25'; // clearly visible muted baseline
                if (isBright) {
                  color = 'text-white font-bold scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]';
                } else if (isMedium) {
                  color = 'text-white/55';
                }

                return (
                  <span
                    key={c}
                    className={`inline-block transition-all duration-150 ${color}`}
                  >
                    +
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Bottom Editorial Copy & Pills */}
      <div className="pt-2">
        <p className="text-[12.5px] sm:text-[13.5px] text-white/90 font-normal leading-[1.42] tracking-tight">
          We help <span className="italic font-serif">defenders</span> detect phishing in real-time from{' '}
          <span className="text-[#3B82F6] font-semibold">URL</span>,{' '}
          <span className="text-[#EF4444] font-semibold">QR code</span>,{' '}
          <span className="text-[#10B981] font-semibold">email</span>,{' '}
          <span className="text-[#F59E0B] font-semibold">headers</span>,{' '}
          <span className="text-[#A855F7] font-semibold">visual</span> all done by AI.
        </p>

        <p className="text-[11px] sm:text-[11.5px] text-white/45 italic font-serif mt-1">
          multi-modal evidential neural intelligence is our superpower
        </p>

        {/* 4. Action Pill Buttons */}
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={onLaunchScan}
            className="px-3.5 py-1.5 rounded-full bg-white text-[#0A0D14] text-[11px] sm:text-[12px] font-semibold hover:bg-white/90 transition-all cursor-pointer shadow-sm"
          >
            Inspect Target
          </button>

          <button
            type="button"
            onClick={onLaunchScan}
            className="px-3.5 py-1.5 rounded-full bg-white/10 text-white/85 text-[11px] sm:text-[12px] font-medium border border-white/15 hover:bg-white/20 transition-all cursor-pointer"
          >
            Live Sandbox &rarr;
          </button>
        </div>
      </div>

    </div>
  );
}
