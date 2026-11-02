import React, { useEffect, useRef } from 'react';

/**
 * GnosisSteppedDither:
 * Recreates the exact Gnosis / XXIX stepped silhouette and generative dithered texture:
 * - Beautifully balanced 90-degree stepped staircase container matching the original editorial proportions
 * - Procedural dithered wave / flow field in electric cobalt blue (#0047FF) and white stippled dots
 * - Interactive mouse ripple & organic ambient flow
 */
export default function GnosisSteppedDither({ className = '', height = 420 }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = canvas.parentElement.clientWidth);
    let h = (canvas.height = height);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      h = canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };
    window.addEventListener('mousemove', handleMouseMove);

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

      ctx.fillStyle = '#0047FF'; // Electric Gnosis Cobalt Blue base
      ctx.fillRect(0, 0, width, h);

      const mx = mouseRef.current.x / scale;
      const my = mouseRef.current.y / scale;

      const imgData = ctx.getImageData(0, 0, width, h);
      const data = imgData.data;

      for (let y = 0; y < h; y += scale) {
        const rowIdx = Math.floor(y / scale);
        const bayerY = rowIdx % 4;

        for (let x = 0; x < width; x += scale) {
          const colIdx = Math.floor(x / scale);
          const bayerX = colIdx % 4;

          // Multi-frequency wave synthesis mimicking reaction-diffusion / moiré waves
          const wave1 = Math.sin(colIdx * 0.035 + t * 0.8 + Math.cos(rowIdx * 0.02 + t * 0.4) * 2.2);
          const wave2 = Math.cos(rowIdx * 0.04 - t * 0.6 + Math.sin(colIdx * 0.03 + t * 0.5) * 1.8);
          const wave3 = Math.sin((colIdx + rowIdx) * 0.025 + t * 0.5);

          const dx = colIdx - mx;
          const dy = rowIdx - my;
          const distSq = dx * dx + dy * dy;
          const mouseDistort = distSq < 3600 ? Math.sin(Math.sqrt(distSq) * 0.15 - t * 4) * 0.8 : 0;

          let val = (wave1 + wave2 + wave3 + mouseDistort + 3) / 6;
          val = Math.pow(val, 2.4);

          const threshold = bayer4[bayerY][bayerX] / 16.0;

          if (val > threshold) {
            for (let dy = 0; dy < scale; dy++) {
              for (let dx = 0; dx < scale; dx++) {
                const px = x + dx;
                const py = y + dy;
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
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [height]);

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      style={{
        height: `${height}px`,
        // Exact geometric staircase proportions: moved very slightly closer to the header text
        clipPath: 'polygon(0% 38%, 42% 38%, 42% 22%, 63% 22%, 63% 6%, 94% 6%, 94% 13%, 100% 13%, 100% 100%, 0% 100%)',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: `${height}px` }}
        className="block"
      />
    </div>
  );
}
