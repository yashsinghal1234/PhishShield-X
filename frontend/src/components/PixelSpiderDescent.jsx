import React, { useEffect, useRef, useState } from 'react';

/**
 * PixelSpiderDescent:
 * Realistic pixel-art spider behavior:
 * - Rappels down from headline text in natural episodic drops while spinning/extruding its silk thread.
 * - Hangs, bobs, and sways with subtle physical elastic silk bounce.
 * - Climbs back up the silk web towards the text, reeling in the thread.
 * - 100% pixelated aesthetic: no blurry glows, no hover tooltips, authentic 2px pixelated silk thread.
 */
export default function PixelSpiderDescent() {
  const [y, setY] = useState(8); // Current drop distance in pixels
  const [sway, setSway] = useState(0); // Subtle rotation angle in degrees
  const animRef = useRef(null);

  useEffect(() => {
    let startTime = performance.now();
    let currentY = 8;
    let targetY = 8;
    let phase = 'wait_top'; // 'wait_top', 'drop_1', 'pause_1', 'drop_2', 'pause_2', 'drop_3', 'lurk', 'climb_1', 'climb_pause_1', 'climb_2', 'climb_pause_2', 'climb_3'
    let phaseStartTime = performance.now();

    const maxHang = 105; // Full hanging depth

    const update = (now) => {
      const elapsedInPhase = (now - phaseStartTime) / 1000;
      const totalElapsed = (now - startTime) / 1000;

      switch (phase) {
        case 'wait_top':
          targetY = 8;
          if (elapsedInPhase > 2.2) {
            phase = 'drop_1';
            phaseStartTime = now;
          }
          break;

        case 'drop_1':
          // Fast drop with elastic settle
          targetY = 42;
          if (elapsedInPhase > 0.45) {
            phase = 'pause_1';
            phaseStartTime = now;
          }
          break;

        case 'pause_1':
          targetY = 42;
          if (elapsedInPhase > 0.6) {
            phase = 'drop_2';
            phaseStartTime = now;
          }
          break;

        case 'drop_2':
          targetY = 80;
          if (elapsedInPhase > 0.45) {
            phase = 'pause_2';
            phaseStartTime = now;
          }
          break;

        case 'pause_2':
          targetY = 80;
          if (elapsedInPhase > 0.5) {
            phase = 'drop_3';
            phaseStartTime = now;
          }
          break;

        case 'drop_3':
          targetY = maxHang;
          if (elapsedInPhase > 0.5) {
            phase = 'lurk';
            phaseStartTime = now;
          }
          break;

        case 'lurk':
          // Gentle elastic bobbing at the bottom of the silk
          targetY = maxHang + Math.sin(totalElapsed * 2.8) * 3;
          if (elapsedInPhase > 5.5) {
            phase = 'climb_1';
            phaseStartTime = now;
          }
          break;

        case 'climb_1':
          // Climbing up step 1
          targetY = 72;
          if (elapsedInPhase > 0.8) {
            phase = 'climb_pause_1';
            phaseStartTime = now;
          }
          break;

        case 'climb_pause_1':
          targetY = 72;
          if (elapsedInPhase > 0.5) {
            phase = 'climb_2';
            phaseStartTime = now;
          }
          break;

        case 'climb_2':
          // Climbing up step 2
          targetY = 38;
          if (elapsedInPhase > 0.8) {
            phase = 'climb_pause_2';
            phaseStartTime = now;
          }
          break;

        case 'climb_pause_2':
          targetY = 38;
          if (elapsedInPhase > 0.5) {
            phase = 'climb_3';
            phaseStartTime = now;
          }
          break;

        case 'climb_3':
          // Climbing all the way up to text
          targetY = 8;
          if (elapsedInPhase > 0.8) {
            phase = 'wait_top';
            phaseStartTime = now;
          }
          break;

        default:
          phase = 'wait_top';
          phaseStartTime = now;
      }

      // Smooth physics interpolation towards targetY
      const isDropping = phase.startsWith('drop');
      const lerpSpeed = isDropping ? 0.22 : 0.12;
      currentY += (targetY - currentY) * lerpSpeed;

      // Realistic subtle micro-sway angle on the thread
      const currentSway = Math.sin(totalElapsed * 1.8) * (2.2 * Math.min(1, currentY / 60));

      setY(Math.round(currentY * 10) / 10);
      setSway(Math.round(currentSway * 10) / 10);

      animRef.current = requestAnimationFrame(update);
    };

    animRef.current = requestAnimationFrame(update);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Web thread height in pixels
  const webLength = Math.max(0, y);

  return (
    <div
      className="absolute right-1 sm:right-2.5 top-full z-20 pointer-events-none select-none flex flex-col items-center"
      style={{
        transformOrigin: 'top center',
        transform: `rotate(${sway}deg)`,
      }}
    >
      {/* 2px Crisp Pixelated Silk Web Thread */}
      <div
        className="w-[2px] origin-top"
        style={{
          height: `${webLength}px`,
          backgroundImage:
            'repeating-linear-gradient(to bottom, #FFFFFF 0px, #FFFFFF 2px, #60A5FA 2px, #60A5FA 4px)',
          imageRendering: 'pixelated',
        }}
      />

      {/* The Pixel Spider */}
      <div
        className="relative"
        style={{
          transform: 'translateY(-2px)', // Align with the bottom of the silk thread
        }}
      >
        <img
          src="/pixel-spider.png"
          alt="Pixel Spider"
          className="w-7 sm:w-8 md:w-9 h-auto block"
          style={{
            imageRendering: 'pixelated',
          }}
        />
      </div>
    </div>
  );
}
