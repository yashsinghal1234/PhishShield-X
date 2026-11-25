import React, { useEffect, useRef, useState } from 'react';

/**
 * PixelSpiderDescent:
 * Authentic Retro Pixel Game Spider:
 * - Real pixel web weaving: anchors from text letters with diagonal pixel struts and a vertical silk line.
 * - Dynamic 8-bit frame-by-frame leg animation:
 *   - When descending: legs actively crawl and pull silk (alternating frames 1 & 2).
 *   - When lurking: gentle 8-bit breathing & weaving idle (frames 0 & 3).
 *   - When climbing: legs climb hand-over-hand back up the thread reeling the silk in!
 * - 100% pixelated rendering with zero blur, zero smoothing, and zero hover effects.
 */
export default function PixelSpiderDescent() {
  const [y, setY] = useState(12); // Drop distance in pixels
  const [frame, setFrame] = useState(0); // Active sprite frame (0, 1, 2, 3)
  const [sway, setSway] = useState(0); // Slight pendulum sway angle
  const animRef = useRef(null);

  useEffect(() => {
    let currentY = 12;
    let targetY = 12;
    let phase = 'rest_top';
    let phaseStartTime = performance.now();
    let lastFrameTime = performance.now();
    let walkStep = 0;

    const maxHang = 100;

    const update = (now) => {
      const elapsedInPhase = (now - phaseStartTime) / 1000;
      const totalElapsed = now / 1000;

      let isMoving = false;

      switch (phase) {
        case 'rest_top':
          targetY = 12;
          isMoving = false;
          if (elapsedInPhase > 2.0) {
            phase = 'descend_1';
            phaseStartTime = now;
          }
          break;

        case 'descend_1':
          targetY = 44;
          isMoving = true;
          if (elapsedInPhase > 0.55) {
            phase = 'pause_1';
            phaseStartTime = now;
          }
          break;

        case 'pause_1':
          targetY = 44;
          isMoving = false;
          if (elapsedInPhase > 0.5) {
            phase = 'descend_2';
            phaseStartTime = now;
          }
          break;

        case 'descend_2':
          targetY = 76;
          isMoving = true;
          if (elapsedInPhase > 0.55) {
            phase = 'pause_2';
            phaseStartTime = now;
          }
          break;

        case 'pause_2':
          targetY = 76;
          isMoving = false;
          if (elapsedInPhase > 0.5) {
            phase = 'descend_3';
            phaseStartTime = now;
          }
          break;

        case 'descend_3':
          targetY = maxHang;
          isMoving = true;
          if (elapsedInPhase > 0.55) {
            phase = 'lurk_weave';
            phaseStartTime = now;
          }
          break;

        case 'lurk_weave':
          // Subtle elastic silk bounce
          targetY = maxHang + Math.sin(totalElapsed * 3) * 2.5;
          isMoving = false;
          if (elapsedInPhase > 5.0) {
            phase = 'climb_1';
            phaseStartTime = now;
          }
          break;

        case 'climb_1':
          targetY = 65;
          isMoving = true;
          if (elapsedInPhase > 0.7) {
            phase = 'climb_pause_1';
            phaseStartTime = now;
          }
          break;

        case 'climb_pause_1':
          targetY = 65;
          isMoving = false;
          if (elapsedInPhase > 0.4) {
            phase = 'climb_2';
            phaseStartTime = now;
          }
          break;

        case 'climb_2':
          targetY = 32;
          isMoving = true;
          if (elapsedInPhase > 0.7) {
            phase = 'climb_pause_2';
            phaseStartTime = now;
          }
          break;

        case 'climb_pause_2':
          targetY = 32;
          isMoving = false;
          if (elapsedInPhase > 0.4) {
            phase = 'climb_3';
            phaseStartTime = now;
          }
          break;

        case 'climb_3':
          targetY = 12;
          isMoving = true;
          if (elapsedInPhase > 0.6) {
            phase = 'rest_top';
            phaseStartTime = now;
          }
          break;

        default:
          phase = 'rest_top';
          phaseStartTime = now;
      }

      // Physics interpolation for natural smooth crawling speed
      const lerpSpeed = isMoving ? 0.16 : 0.22;
      currentY += (targetY - currentY) * lerpSpeed;

      // Authentic 8-bit frame cycling
      if (isMoving) {
        // Fast leg stepping cycle when crawling (every 110ms)
        if (now - lastFrameTime > 110) {
          walkStep = (walkStep + 1) % 2;
          setFrame(walkStep === 0 ? 1 : 2);
          lastFrameTime = now;
        }
      } else {
        // Gentle breathing / weaving idle pulse (every 600ms)
        if (now - lastFrameTime > 600) {
          walkStep = (walkStep + 1) % 2;
          setFrame(walkStep === 0 ? 0 : 3);
          lastFrameTime = now;
        }
      }

      // Micro pendulum sway
      const currentSway = Math.sin(totalElapsed * 2) * (1.8 * Math.min(1, currentY / 50));

      setY(Math.round(currentY));
      setSway(Math.round(currentSway * 10) / 10);

      animRef.current = requestAnimationFrame(update);
    };

    animRef.current = requestAnimationFrame(update);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const webLength = Math.max(0, y);

  return (
    <div
      className="absolute right-1 sm:right-3 top-full z-20 pointer-events-none select-none flex flex-col items-center"
      style={{
        transformOrigin: 'top center',
        transform: `rotate(${sway}deg)`,
      }}
    >
      {/* =========================================================
          RETRO PIXEL GAME WEB ANCHOR & SILK THREAD
          ========================================================= */}
      {/* 1. Retro Pixel Web Struts at the Text Anchor */}
      <svg
        className="w-8 h-3.5 block pointer-events-none"
        viewBox="0 0 32 14"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Top anchor bar right under the letters */}
        <rect x="4" y="0" width="24" height="2" fill="#FFFFFF" />
        <rect x="2" y="1" width="4" height="1" fill="#93C5FD" />
        <rect x="26" y="1" width="4" height="1" fill="#93C5FD" />

        {/* Diagonal pixel web lines converging to central strand */}
        <rect x="6" y="2" width="2" height="2" fill="#FFFFFF" />
        <rect x="8" y="4" width="2" height="2" fill="#93C5FD" />
        <rect x="10" y="6" width="2" height="2" fill="#FFFFFF" />
        <rect x="12" y="8" width="2" height="2" fill="#93C5FD" />
        <rect x="14" y="10" width="2" height="2" fill="#FFFFFF" />

        <rect x="24" y="2" width="2" height="2" fill="#FFFFFF" />
        <rect x="22" y="4" width="2" height="2" fill="#93C5FD" />
        <rect x="20" y="6" width="2" height="2" fill="#FFFFFF" />
        <rect x="18" y="8" width="2" height="2" fill="#93C5FD" />
        <rect x="16" y="10" width="2" height="2" fill="#FFFFFF" />

        {/* Central hub node */}
        <rect x="15" y="12" width="2" height="2" fill="#FFFFFF" />
      </svg>

      {/* 2. Crisp 2px Pixelated Vertical Silk Strand */}
      <div
        className="w-[2px] origin-top -mt-0.5"
        style={{
          height: `${webLength}px`,
          backgroundImage:
            'repeating-linear-gradient(to bottom, #FFFFFF 0px, #FFFFFF 2px, #60A5FA 2px, #60A5FA 4px)',
          imageRendering: 'pixelated',
        }}
      />

      {/* =========================================================
          ANIMATED PIXEL GAME SPIDER SPRITE
          ========================================================= */}
      <div
        className="relative -mt-1"
        style={{
          imageRendering: 'pixelated',
        }}
      >
        <img
          src={`/spider-frame-${frame}.png`}
          alt="Pixel Game Spider"
          className="w-7 sm:w-8 md:w-9 h-auto block"
          style={{
            imageRendering: 'pixelated',
          }}
        />
      </div>
    </div>
  );
}
