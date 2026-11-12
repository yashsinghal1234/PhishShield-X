import React, { useEffect, useRef } from 'react';
import { buildRetroCollageBuffer } from '../utils/retroPixelCollage';

/**
 * GnosisSteppedDither:
 * Recreates the exact Gnosis / XXIX stepped silhouette and generative dithered texture:
 * - Beautifully balanced 90-degree stepped staircase container matching the original editorial proportions
 * - Procedural dithered wave / flow field in electric cobalt blue (#0047FF) and white stippled dots
 * - Hover Reveal Spotlight: Moving the cursor over the dithered pixels dissolves into a hidden
 *   1-bit retro cyber-collage (VIRUS DETECTED dithered skull, ERROR dialogs, PAYLOAD.EXE, pixel toolbar)
 *   through the same 4x4 Bayer dither matrix.
 */
export default function GnosisSteppedDither({ className = '', height = 420 }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const isHoveringRef = useRef(false);
  const hoverAlphaRef = useRef(0);
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

    const updatePointer = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      mouseRef.current = { x, y };
      isHoveringRef.current = x >= 0 && x <= rect.width && y >= 0 && y <= rect.height;
    };

    const handleMouseMove = (e) => {
      updatePointer(e.clientX, e.clientY);
    };

    const handleMouseLeave = () => {
      isHoveringRef.current = false;
    };

    const handleTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      updatePointer(e.touches[0].clientX, e.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      isHoveringRef.current = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('touchstart', handleTouchMove, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd);

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

      // Smoothly ease hover reveal spotlight in/out
      const targetAlpha = isHoveringRef.current ? 1 : 0;
      hoverAlphaRef.current += (targetAlpha - hoverAlphaRef.current) * 0.16;
      const hoverAlpha = hoverAlphaRef.current;

      ctx.fillStyle = '#0047FF'; // Electric Gnosis Cobalt Blue base
      ctx.fillRect(0, 0, width, h);

      const mx = mouseRef.current.x / scale;
      const my = mouseRef.current.y / scale;
      const cols = Math.max(1, Math.ceil(width / scale));
      const rows = Math.max(1, Math.ceil(h / scale));

      // Spotlight radii in grid units (3px per unit -> 34*3=102px solid core, 58*3=174px dither edge)
      const innerR = 34 * hoverAlpha;
      const outerR = 58 * hoverAlpha;
      const outerRSq = outerR * outerR;

      const imgData = ctx.getImageData(0, 0, width, h);
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

          // Check if this pixel block falls inside the hover reveal spotlight
          let useCollage = false;
          let r = 255;
          let g = 255;
          let b = 255;

          if (hoverAlpha > 0.03 && distSq < outerRSq) {
            const dist = Math.sqrt(distSq);
            const revealProb =
              dist <= innerR ? 1.0 : Math.max(0, 1 - (dist - innerR) / Math.max(1, outerR - innerR));

            if (revealProb > threshold) {
              useCollage = true;
              const cx = Math.min(collageW - 1, Math.floor((colIdx / cols) * collageW));
              const cIdx = (cy * collageW + cx) * 4;
              r = collageData[cIdx];
              g = collageData[cIdx + 1];
              b = collageData[cIdx + 2];
            }
          }

          if (useCollage) {
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
            continue;
          }

          // Multi-frequency wave synthesis mimicking reaction-diffusion / moiré waves
          const wave1 = Math.sin(colIdx * 0.035 + t * 0.8 + Math.cos(rowIdx * 0.02 + t * 0.4) * 2.2);
          const wave2 = Math.cos(rowIdx * 0.04 - t * 0.6 + Math.sin(colIdx * 0.03 + t * 0.5) * 1.8);
          const wave3 = Math.sin((colIdx + rowIdx) * 0.025 + t * 0.5);

          const mouseDistort = distSq < 3600 ? Math.sin(Math.sqrt(distSq) * 0.15 - t * 4) * 0.8 : 0;

          let val = (wave1 + wave2 + wave3 + mouseDistort + 3) / 6;
          val = Math.pow(val, 2.4);

          if (val > threshold) {
            for (let sy = 0; sy < scale; sy++) {
              for (let sx = 0; sx < scale; sx++) {
                const px = x + sx;
                const py = y + sy;
                if (px < width && py < h) {
                  const idx = (py * width + px) * 4;
                  data[idx] = 255;
                  data[idx + 1] = 255;
                  data[idx + 2] = 255;
                  data[idx + 3] = 255;
                }
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
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      canvas.removeEventListener('touchstart', handleTouchMove);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [height]);

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#080A0F] cursor-crosshair ${className}`}
      style={{
        height: `${currentHeight}px`,
        // Exact geometric staircase proportions: moved very slightly closer to the header text
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
