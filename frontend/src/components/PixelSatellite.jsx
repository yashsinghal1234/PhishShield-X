import React, { useState, useEffect } from 'react';

/**
 * PixelSatellite:
 * Exact recreation of Card 2 from the Uniqode brand collage:
 * - Light silver-gray cross-stitch halftone grid
 * - Electric blue satellite orbiting with diagonal signal beam
 * - Live animated signal packets traveling down the beam
 * - Pulsing antenna beacon
 */
export default function PixelSatellite({ className = '' }) {
  const rows = 18;
  const cols = 15;

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((prev) => (prev + 1) % 100);
    }, 110);
    return () => clearInterval(timer);
  }, []);

  // Determine pixel identity and base color
  const getPixelMetadata = (r, c) => {
    // 1. Antenna beam line heading upward (r: 0-1, c: 2-3)
    if (r === 0 && c === 2) return { type: 'antenna-tip', baseColor: '#0047FF' };
    if (r === 1 && c === 3) return { type: 'antenna', baseColor: '#0047FF' };

    // 2. Dish & transmitter at top left (r: 2-4, c: 3-5)
    if (r === 2 && c === 4) return { type: 'dish', baseColor: '#0047FF' };
    if (r === 3 && (c === 3 || c === 4 || c === 5)) return { type: 'dish', baseColor: '#0047FF' };
    if (r === 4 && (c === 4 || c === 5)) return { type: 'dish', baseColor: '#0047FF' };

    // 3. Main Satellite Core Body (r: 5-8, c: 5-8)
    if (r >= 5 && r <= 8 && c >= 5 && c <= 8) {
      return { type: 'core', baseColor: '#0047FF' };
    }

    // 4. Solar Wings (Left Wing: r: 6-7, c: 2-4)
    if ((r === 6 || r === 7) && c >= 2 && c <= 4) {
      return { type: 'wing', baseColor: '#1D4ED8' };
    }

    // 5. Solar Wings (Right Wing: r: 6-7, c: 9-11)
    if ((r === 6 || r === 7) && c >= 9 && c <= 11) {
      return { type: 'wing', baseColor: '#1D4ED8' };
    }

    // 6. Beaming Signal Wave (Diagonal ray towards bottom right, r: 9-13)
    if (r === 9 && (c === 8 || c === 9)) return { type: 'ray', step: 1, baseColor: '#0047FF' };
    if (r === 10 && (c === 9 || c === 10)) return { type: 'ray', step: 2, baseColor: '#0047FF' };
    if (r === 11 && (c === 10 || c === 11)) return { type: 'ray', step: 3, baseColor: '#0047FF' };
    if (r === 12 && (c === 11 || c === 12)) return { type: 'ray', step: 4, baseColor: '#0047FF' };
    if (r === 13 && (c === 11 || c === 12 || c === 13)) return { type: 'ray', step: 5, baseColor: '#0047FF' };

    // 7. Target Terminal / Ground Station (r: 14-16, c: 10-14)
    if (r >= 14 && r <= 16 && c >= 10 && c <= 14) {
      return { type: 'terminal', baseColor: '#0047FF' };
    }

    return null;
  };

  const packetStep = tick % 9;
  const sweepPos = tick % 22;

  return (
    <div className={`flex items-center justify-center select-none w-full h-full p-2 ${className}`}>
      <div
        className="grid gap-[3px] sm:gap-[3.5px]"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const meta = getPixelMetadata(r, c);

            if (meta) {
              let isGlowing = false;
              let dotColor = meta.baseColor;

              // Signal packet animation traveling down the diagonal ray
              if (meta.type === 'ray') {
                if (meta.step === (packetStep % 5) + 1) {
                  isGlowing = true;
                  dotColor = '#FFFFFF';
                }
              }

              // Antenna beacon blinking
              if (meta.type === 'antenna-tip') {
                if (tick % 5 === 0) {
                  isGlowing = true;
                  dotColor = '#93C5FD';
                }
              }

              // Terminal acknowledgment pulse
              if (meta.type === 'terminal') {
                if (packetStep >= 5 && packetStep <= 7) {
                  isGlowing = true;
                  dotColor = '#60A5FA';
                }
              }

              return (
                <div
                  key={`${r}-${c}`}
                  className={`w-[6px] h-[6px] sm:w-[7px] sm:h-[7px] rounded-[1.5px] transition-all duration-150 ${
                    isGlowing
                      ? 'scale-125 shadow-sm shadow-[#0047FF]'
                      : ''
                  }`}
                  style={{
                    backgroundColor: dotColor,
                  }}
                />
              );
            }

            // Idle Background Matrix Dots: fine neutral dots with ambient radar sweep
            const diagDist = r + c;
            const isSwept = Math.abs(diagDist - sweepPos) <= 1;

            return (
              <div
                key={`${r}-${c}`}
                className={`w-[6px] h-[6px] sm:w-[7px] sm:h-[7px] rounded-[1.5px] transition-all duration-300 ${
                  isSwept
                    ? 'bg-[#0047FF]/35 scale-110'
                    : 'bg-[#B0B9C3]/70 hover:bg-[#94A3B8]'
                }`}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
