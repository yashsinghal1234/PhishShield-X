import React, { useState, useEffect } from 'react';

/**
 * PixelQrScanner:
 * Pure minimalist 8-bit micro-QR scanner matrix designed for Card 2.
 * Clean graphical presentation: completely removed headers, text badges, and divider lines.
 */

// 15x15 Micro-QR Binary Matrix (1 = dark module, 0 = light module)
const QR_GRID = [
  [1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0],
  [0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1],
  [1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0],
  [1, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 1]
];

export default function PixelQrScanner({ className = '' }) {
  const [laserY, setLaserY] = useState(0); // 0 to 100 percentage
  const [direction, setDirection] = useState(1); // 1 = down, -1 = up

  // Laser scanner oscillating loop
  useEffect(() => {
    const timer = setInterval(() => {
      setLaserY((prev) => {
        let next = prev + direction * 3.2;
        if (next >= 100) {
          setDirection(-1);
          return 100;
        }
        if (next <= 0) {
          setDirection(1);
          return 0;
        }
        return next;
      });
    }, 40);

    return () => clearInterval(timer);
  }, [direction]);

  return (
    <div className={`w-full h-full flex items-center justify-center p-3 select-none ${className}`}>
      
      {/* Centered Micro-QR Pixel Matrix with Reticle & Laser Sweep */}
      <div className="relative p-4 sm:p-5 bg-[#F4F6FB] rounded-2xl border border-[#E2E6EE] shadow-sm flex items-center justify-center">
        
        {/* Reticle Corner Brackets */}
        <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-[#0047FF]" />
        <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-[#0047FF]" />
        <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-[#0047FF]" />
        <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-[#0047FF]" />

        {/* 15x15 Pixel Grid */}
        <div
          className="relative grid gap-[3px] sm:gap-[3.5px] md:gap-[4px] w-[145px] h-[145px] sm:w-[170px] sm:h-[170px] md:w-[195px] md:h-[195px]"
          style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
        >
          {QR_GRID.map((row, r) =>
            row.map((val, c) => {
              const isDark = val === 1;
              const rowPct = (r / 14) * 100;
              const isIlluminated = Math.abs(rowPct - laserY) < 13;

              let bg = isDark ? '#0047FF' : 'transparent';
              if (isDark && isIlluminated) {
                bg = '#60A5FA'; // Luminous electric blue under laser
              }

              return (
                <div
                  key={`${r}-${c}`}
                  className="w-full h-full rounded-[1px] transition-colors duration-75"
                  style={{
                    backgroundColor: bg,
                  }}
                />
              );
            })
          )}

          {/* Traveling Laser Line */}
          <div
            className="absolute left-0 right-0 h-[3.5px] bg-[#38BDF8] shadow-[0_0_12px_#38BDF8] pointer-events-none transition-all duration-75"
            style={{
              top: `${laserY}%`,
            }}
          >
            {/* Soft scan trail */}
            <div
              className={`absolute left-0 right-0 h-6 bg-gradient-to-${
                direction === 1 ? 't' : 'b'
              } from-[#38BDF8]/25 to-transparent pointer-events-none`}
              style={{
                top: direction === 1 ? '-24px' : '4px',
              }}
            />
          </div>
        </div>

      </div>

    </div>
  );
}
