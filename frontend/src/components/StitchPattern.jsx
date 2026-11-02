import React, { useState, useEffect } from 'react';

/**
 * StitchPattern renders the signature Uniqode generative cross-stitch textile pattern
 * seen on the middle-left card of the brand identity sheet with live animated pulses.
 */
export default function StitchPattern({ rows = 9, cols = 14, className = '', activeDensity = 'normal' }) {
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulseIndex((prev) => (prev + 1) % (rows * cols));
    }, 180);
    return () => clearInterval(timer);
  }, [rows, cols]);

  // Pre-calculated stitch cross patterns with weighted blues, ice blues, and slates
  const stitches = React.useMemo(() => {
    const list = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = (r * 17 + c * 23) % 100;
        let color = 'rgba(0, 71, 255, 0.18)'; // light blue
        let char = '+';
        let weight = 'font-normal';

        if (seed > 85) {
          color = '#0047FF'; // primary electric blue
          char = '×';
          weight = 'font-bold';
        } else if (seed > 65) {
          color = '#9BBFE0'; // ice blue
          char = '+';
        } else if (seed > 40) {
          color = 'rgba(0, 71, 255, 0.4)';
          char = '+';
        } else if (seed > 20) {
          color = 'rgba(155, 191, 224, 0.5)';
          char = '·';
        }

        list.push({ id: `${r}-${c}`, r, c, char, color, weight });
      }
    }
    return list;
  }, [rows, cols]);

  return (
    <div
      className={`grid select-none font-['Silkscreen'] text-[11px] sm:text-[12px] leading-tight tracking-widest ${className}`}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
    >
      {stitches.map((s, idx) => {
        // Wave animation propagating through the stitches
        const isPulse = Math.abs(idx - pulseIndex) < 2 || Math.abs(idx - (pulseIndex + 30) % (rows * cols)) < 1;

        return (
          <span
            key={s.id}
            className={`flex items-center justify-center transition-all duration-200 ${s.weight} ${
              isPulse ? 'scale-135 text-[#0047FF] font-black' : 'hover:scale-125'
            }`}
            style={{ color: isPulse ? '#0047FF' : s.color }}
          >
            {s.char}
          </span>
        );
      })}
    </div>
  );
}
