import React, { useEffect, useRef } from 'react';
import continentCoords from '../assets/globe-continent-points.json';

/**
 * HalftoneGlobe:
 * 100% Solid Dot-Matrix 3D Globe:
 * - Pure, clean, crisp solid white halftone dots (all open circles, rings, and 'f' glyphs removed)
 * - Optimized spatial separation so dots never collide or feel congested
 * - Natural 3D spherical depth falloff and smooth continuous rotation
 */
export default function HalftoneGlobe({ size = 500, className = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const dpr = Math.min(window.devicePixelRatio || 2, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const radius = size * 0.44;
    const cx = size / 2;
    const cy = size / 2;

    // Filter points with calibrated 3D angular separation for high dot density without overlapping
    const filteredPoints = [];
    const minDistanceSquared = 0.0016; // Increased dot density (~2,000 crisp dots)

    for (let i = 0; i < continentCoords.length; i++) {
      const [nx, ny, nz] = continentCoords[i];

      // Check distance against already added points
      let tooClose = false;
      for (let j = 0; j < filteredPoints.length; j++) {
        const fp = filteredPoints[j];
        const dx = nx - fp.nx;
        const dy = ny - fp.ny;
        const dz = nz - fp.nz;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq < minDistanceSquared) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        // Crisp, pure solid halftone dot
        filteredPoints.push({
          nx,
          ny,
          nz,
          x: nx * radius,
          y: ny * radius,
          z: nz * radius,
          baseRadius: 1.55,
        });
      }
    }

    let angle = 0;
    const tilt = 0.22;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      // Smooth auto-rotation
      angle += 0.0035;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const projected = [];

      for (let i = 0; i < filteredPoints.length; i++) {
        const p = filteredPoints[i];

        // 1. Rotation around Y axis
        const rx = p.x * cosA - p.z * sinA;
        const rz = p.x * sinA + p.z * cosA;
        const ry = p.y;

        // 2. Earth's axial tilt
        const tx = rx;
        const ty = ry * cosT - rz * sinT;
        const tz = ry * sinT + rz * cosT;

        // Only render clearly visible front-facing hemisphere
        if (tz > radius * 0.06) {
          const normalZ = tz / radius; // 1 at center, ~0 at edge
          const edgeFactor = Math.pow(normalZ, 0.65);
          const alpha = Math.min(1, Math.max(0.18, Math.pow(normalZ, 0.55)));

          projected.push({
            px: cx + tx,
            py: cy - ty,
            rz: tz,
            radius: p.baseRadius * (0.6 + edgeFactor * 0.5),
            alpha,
          });
        }
      }

      // Sort back-to-front
      projected.sort((a, b) => a.rz - b.rz);

      // Render 100% pure solid halftone dots
      for (let i = 0; i < projected.length; i++) {
        const pt = projected[i];

        ctx.beginPath();
        ctx.arc(pt.px, pt.py, pt.radius, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(255, 255, 255, ${pt.alpha * 0.95})`;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [size]);

  return (
    <div className={`relative flex items-center justify-center select-none w-full max-w-full overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', maxWidth: `${size}px`, height: 'auto', aspectRatio: '1 / 1' }}
        className="pointer-events-none drop-shadow-xl max-w-full"
      />
    </div>
  );
}
