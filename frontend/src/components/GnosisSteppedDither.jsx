import React, { useEffect, useRef } from 'react';
import { buildRetroCollageBuffer } from '../utils/retroPixelCollage';

/**
 * GnosisSteppedDither:
 * Renders the stepped staircase hero artwork directly out of the 1-bit Bayer-dithered pixel grid:
 * - Always-visible retro cyber-collage (VIRUS DETECTED dithered skull, ERROR/PHISH ALERT dialogs,
 *   PAYLOAD.EXE, AUTH bar, pixel toolbar) rendered in #0047FF, #FFFFFF, and #000000
 * - Living 4x4 Bayer dither wave & interactive mouse ripple woven directly into the pixel mesh
 */
export default function GnosisSteppedDither({ className = '', height = 420 }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const [currentHeight, setCurrentHeight] = React.useState(height);

  useEffect(() => {
    const getResponsiveHeight = () => {
      if (typeof window === 'undefined') return height;
      if (window.innerWidth < 640) return Math.min(240, height);
      if (window.innerWidth < 1024) return Math.min(320, height);
      return height;
    };

    const initialH = getResponsiveHeight();
    setCurrentHeight(initialH);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Pre-build the 400x140 1-bit retro pixel collage once
    const collage = buildRetroCollageBuffer();
    const collageW = collage.width;
    const collageH = collage.height;
    const collageData = collage.data;

    let width = (canvas.width = canvas.parentElement.clientWidth);
    let h = (canvas.height = initialH);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      const newH = getResponsiveHeight();
      setCurrentHeight(newH);
      width = canvas.width = canvas.parentElement.clientWidth;
      h = canvas.height = newH;
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Resolution scale for retro dither pixelation effect
    const scale = 3;

    // Standard 4x4 Bayer Dither Matrix for authentic digital stippling
    const bayer4 = [
      [ 0,  8,  2, 10],
      [12,  4, 14,  6],
      [ 3, 11,  1,  9],
      [15,  7, 13,  5]
    ];

    let t = 0;

    const render = () => {
      t += 0.018;

      const mx = mouseRef.current.x / scale;
      const my = mouseRef.current.y / scale;
      const cols = Math.max(1, Math.ceil(width / scale));
      const rows = Math.max(1, Math.ceil(h / scale));

      const imgData = ctx.createImageData(width, h);
      const data = imgData.data;

      for (let y = 0; y < h; y += scale) {
        const rowIdx = Math.floor(y / scale);
        const bayerY = rowIdx % 4;
        const cy = Math.min(collageH - 1, Math.floor((rowIdx / rows) * collageH));

        for (let x = 0; x < width; x += scale) {
          const colIdx = Math.floor(x / scale);
          const bayerX = colIdx % 4;
          const threshold = bayer4[bayerY][bayerX] / 16.0;

          const dx = colIdx - mx;
          const dy = rowIdx - my;
          const distSq = dx * dx + dy * dy;

          // Multi-frequency wave synthesis & interactive mouse ripple
          const wave1 = Math.sin(colIdx * 0.035 + t * 0.8 + Math.cos(rowIdx * 0.02 + t * 0.4) * 2.2);
          const wave2 = Math.cos(rowIdx * 0.04 - t * 0.6 + Math.sin(colIdx * 0.03 + t * 0.5) * 1.8);
          const wave3 = Math.sin((colIdx + rowIdx) * 0.025 + t * 0.5);
          const mouseDistort = distSq < 3600 ? Math.sin(Math.sqrt(distSq) * 0.15 - t * 4) * 0.8 : 0;

          let val = (wave1 + wave2 + wave3 + mouseDistort + 3) / 6;
          val = Math.pow(val, 2.4);

          // Sample exact 1-bit collage pixel
          const cx = Math.min(collageW - 1, Math.floor((colIdx / cols) * collageW));
          const cIdx = (cy * collageW + cx) * 4;
          let r = collageData[cIdx];
          let g = collageData[cIdx + 1];
          let b = collageData[cIdx + 2];

          // Weave the living Bayer dither pixel texture directly into the blue & black areas
          const isBlueArea = b > 200 && r < 50 && g < 120;
          const isBlackArea = r < 20 && g < 20 && b < 20;

          if (isBlueArea && val * 0.72 > threshold) {
            r = 215;
            g = 232;
            b = 255;
          } else if (isBlackArea && val * 0.62 > threshold) {
            r = 0;
            g = 71;
            b = 255;
          }

          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = x + sx;
              const py = y + sy;
              if (px < width && py < h) {
                const idx = (py * width + px) * 4;
                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
              }
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [height]);

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#080A0F] ${className}`}
      style={{
        height: `${currentHeight}px`,
        // Exact geometric staircase proportions
        clipPath: 'polygon(0% 38%, 42% 38%, 42% 22%, 63% 22%, 63% 6%, 94% 6%, 94% 13%, 100% 13%, 100% 100%, 0% 100%)',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${currentHeight}px` }}
        className="block"
      />
    </div>
  );
}
