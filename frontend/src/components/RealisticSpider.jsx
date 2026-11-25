import React, { useEffect, useRef, useState } from 'react';

/**
 * PixelSpider:
 * An authentic 8-bit / 16-bit retro pixel-art spider descending on a
 * stippled pixel-silk thread directly from "Evidential neural detection for URLs".
 *
 * Features:
 * - Crisp square pixel grid (shape-rendering: crispEdges)
 * - 8 articulated pixel legs with classic frame-stepped crawl animations
 * - Glowing crimson pixel eyes & dithered abdomen
 * - Stippled pixel thread matching the Gnosis dither aesthetic
 * - Interactive: hover or click makes the spider scurry up in retro arcade steps
 */
export default function RealisticSpider() {
  const [threadLength, setThreadLength] = useState(85);
  const [walkFrame, setWalkFrame] = useState(0);
  const [isScared, setIsScared] = useState(false);
  const [swayX, setSwayX] = useState(0);

  const stateRef = useRef({
    currentY: 15,
    targetY: 90,
    vy: 0,
    time: 0,
    scaredTimer: 0,
    frameTimer: 0,
    walkFrame: 0,
  });

  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min(32, now - lastTime) / 1000;
      lastTime = now;
      const s = stateRef.current;
      s.time += dt;

      // Handle scared state (retreat to text)
      if (s.scaredTimer > 0) {
        s.scaredTimer -= dt;
        s.targetY = 12; // scurry back up
        if (s.scaredTimer <= 0) {
          setIsScared(false);
          s.targetY = 75 + Math.random() * 40;
        }
      } else {
        // Subtle periodic depth change
        if (Math.sin(s.time * 0.2) > 0.985 && Math.random() < 0.03) {
          s.targetY = 65 + Math.random() * 50;
        }
      }

      // Vertical descent physics (quantized to pixel-feel)
      const dy = s.targetY - s.currentY;
      const springK = s.scaredTimer > 0 ? 14 : 6;
      const damping = 0.86;

      s.vy += dy * springK * dt;
      s.vy *= Math.pow(damping, dt * 60);
      s.currentY += s.vy * dt;

      // Gentle discrete pendulum sway
      const rawSway = Math.sin(s.time * 1.5) * 8;
      // Snap to 2px pixel grid for authentic retro feel
      const pixelSway = Math.round(rawSway / 2) * 2;
      setSwayX(pixelSway);

      // Pixel leg stepping animation frames (0, 1, 2)
      s.frameTimer += dt;
      const frameSpeed = s.scaredTimer > 0 ? 0.07 : 0.22;
      if (s.frameTimer > frameSpeed) {
        s.frameTimer = 0;
        s.walkFrame = (s.walkFrame + 1) % 3;
        setWalkFrame(s.walkFrame);
      }

      setThreadLength(Math.round(s.currentY));

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  const handleDisturb = () => {
    stateRef.current.scaredTimer = 3.2;
    setIsScared(true);
  };

  // Pixel unit scale: 2.5px per grid pixel
  const P = 2.5;

  // Helper to render a pixel rectangle on the grid
  const Pixel = ({ x, y, w = 1, h = 1, color = '#111827' }) => (
    <rect
      x={x * P}
      y={y * P}
      width={w * P}
      height={h * P}
      fill={color}
    />
  );

  // Pixel-art Leg Definitions across 3 animation frames
  const renderPixelLegs = () => {
    const legs = [];

    // Left and right side (-1, 1)
    for (let side = -1; side <= 1; side += 2) {
      const s = side;

      // Leg 1 (Front Left / Right)
      if (walkFrame === 0) {
        legs.push(
          <React.Fragment key={`l1-${s}`}>
            <Pixel x={s * 2} y={-3} color="#1F2937" />
            <Pixel x={s * 3} y={-4} color="#374151" />
            <Pixel x={s * 4} y={-5} color="#1F2937" />
            <Pixel x={s * 5} y={-5} color="#374151" />
            <Pixel x={s * 6} y={-4} color="#111827" />
            <Pixel x={s * 7} y={-3} color="#1F2937" />
            <Pixel x={s * 7} y={-2} color="#111827" />
            <Pixel x={s * 8} y={-1} color="#00F0FF" /> {/* Leg tip highlight */}
          </React.Fragment>
        );
      } else if (walkFrame === 1) {
        legs.push(
          <React.Fragment key={`l1-${s}`}>
            <Pixel x={s * 2} y={-3} color="#1F2937" />
            <Pixel x={s * 3} y={-5} color="#374151" />
            <Pixel x={s * 4} y={-6} color="#1F2937" />
            <Pixel x={s * 5} y={-6} color="#374151" />
            <Pixel x={s * 6} y={-5} color="#111827" />
            <Pixel x={s * 7} y={-4} color="#1F2937" />
            <Pixel x={s * 8} y={-3} color="#00F0FF" />
          </React.Fragment>
        );
      } else {
        legs.push(
          <React.Fragment key={`l1-${s}`}>
            <Pixel x={s * 2} y={-3} color="#1F2937" />
            <Pixel x={s * 3} y={-4} color="#374151" />
            <Pixel x={s * 4} y={-4} color="#1F2937" />
            <Pixel x={s * 5} y={-3} color="#374151" />
            <Pixel x={s * 6} y={-2} color="#111827" />
            <Pixel x={s * 7} y={-1} color="#00F0FF" />
          </React.Fragment>
        );
      }

      // Leg 2 (Upper-Mid Left / Right)
      if (walkFrame === 1) {
        legs.push(
          <React.Fragment key={`l2-${s}`}>
            <Pixel x={s * 2} y={-1} color="#1F2937" />
            <Pixel x={s * 4} y={-2} color="#374151" />
            <Pixel x={s * 5} y={-3} color="#1F2937" />
            <Pixel x={s * 7} y={-3} color="#374151" />
            <Pixel x={s * 8} y={-2} color="#111827" />
            <Pixel x={s * 9} y={-1} color="#1F2937" />
            <Pixel x={s * 9} y={0} color="#00F0FF" />
          </React.Fragment>
        );
      } else {
        legs.push(
          <React.Fragment key={`l2-${s}`}>
            <Pixel x={s * 2} y={-1} color="#1F2937" />
            <Pixel x={s * 4} y={-1} color="#374151" />
            <Pixel x={s * 6} y={-2} color="#1F2937" />
            <Pixel x={s * 7} y={-2} color="#374151" />
            <Pixel x={s * 8} y={-1} color="#111827" />
            <Pixel x={s * 8} y={0} color="#1F2937" />
            <Pixel x={s * 9} y={1} color="#00F0FF" />
          </React.Fragment>
        );
      }

      // Leg 3 (Lower-Mid Left / Right)
      if (walkFrame === 2) {
        legs.push(
          <React.Fragment key={`l3-${s}`}>
            <Pixel x={s * 2} y={1} color="#1F2937" />
            <Pixel x={s * 4} y={1} color="#374151" />
            <Pixel x={s * 6} y={2} color="#1F2937" />
            <Pixel x={s * 7} y={3} color="#374151" />
            <Pixel x={s * 8} y={4} color="#111827" />
            <Pixel x={s * 8} y={6} color="#1F2937" />
            <Pixel x={s * 7} y={7} color="#00F0FF" />
          </React.Fragment>
        );
      } else {
        legs.push(
          <React.Fragment key={`l3-${s}`}>
            <Pixel x={s * 2} y={1} color="#1F2937" />
            <Pixel x={s * 4} y={2} color="#374151" />
            <Pixel x={s * 6} y={3} color="#1F2937" />
            <Pixel x={s * 7} y={4} color="#374151" />
            <Pixel x={s * 8} y={5} color="#111827" />
            <Pixel x={s * 8} y={7} color="#00F0FF" />
          </React.Fragment>
        );
      }

      // Leg 4 (Rear Grippers Left / Right - reaches towards silk)
      if (walkFrame === 0) {
        legs.push(
          <React.Fragment key={`l4-${s}`}>
            <Pixel x={s * 2} y={3} color="#1F2937" />
            <Pixel x={s * 3} y={5} color="#374151" />
            <Pixel x={s * 4} y={7} color="#1F2937" />
            <Pixel x={s * 5} y={9} color="#374151" />
            <Pixel x={s * 4} y={11} color="#111827" />
            <Pixel x={s * 3} y={12} color="#1F2937" />
            <Pixel x={s * 2} y={13} color="#00F0FF" />
          </React.Fragment>
        );
      } else {
        legs.push(
          <React.Fragment key={`l4-${s}`}>
            <Pixel x={s * 2} y={3} color="#1F2937" />
            <Pixel x={s * 4} y={5} color="#374151" />
            <Pixel x={s * 5} y={7} color="#1F2937" />
            <Pixel x={s * 5} y={9} color="#374151" />
            <Pixel x={s * 4} y={10} color="#111827" />
            <Pixel x={s * 3} y={11} color="#00F0FF" />
          </React.Fragment>
        );
      }
    }

    return legs;
  };

  // Generate dotted pixel silk thread (1-pixel dots every 4px)
  const threadDots = [];
  const dotSpacing = 5;
  for (let y = 0; y < threadLength; y += dotSpacing) {
    const progress = y / threadLength;
    const curX = swayX * progress;
    threadDots.push(
      <rect
        key={`dot-${y}`}
        x={curX - 0.75}
        y={y}
        width={1.5}
        height={3}
        fill="#94A3B8"
        opacity={0.8}
      />
    );
  }

  return (
    <span
      className="absolute left-1/2 top-full -translate-x-1/2 pointer-events-auto select-none z-30 block"
      style={{
        width: '64px',
        height: `${Math.max(120, threadLength + 45)}px`,
      }}
      onMouseEnter={handleDisturb}
      onClick={handleDisturb}
      title="Retro 8-bit pixel spider. Hover or click to startle!"
    >
      <svg
        className="w-full h-full overflow-visible"
        shapeRendering="crispEdges"
        viewBox={`-32 0 64 ${Math.max(120, threadLength + 45)}`}
      >
        {/* 1. Dotted Retro Pixel Silk Thread */}
        {threadDots}

        {/* 2. Pixel Spider Body Group */}
        <g transform={`translate(${swayX}, ${threadLength})`}>
          {/* Animated 8-Bit Pixel Legs */}
          {renderPixelLegs()}

          {/* Pedipalps (Front mouth feelers) */}
          <Pixel x={-1} y={-5} color="#374151" />
          <Pixel x={-1} y={-6} color="#1F2937" />
          <Pixel x={1} y={-5} color="#374151" />
          <Pixel x={1} y={-6} color="#1F2937" />

          {/* Cephalothorax (Head/Chest) */}
          <Pixel x={-1} y={-4} w={3} h={1} color="#111827" />
          <Pixel x={-2} y={-3} w={5} h={1} color="#1F2937" />
          <Pixel x={-2} y={-2} w={5} h={1} color="#111827" />
          <Pixel x={-1} y={-1} w={3} h={1} color="#1F2937" />

          {/* Glowing Crimson Cyber/Bio Pixel Eyes */}
          <Pixel x={-1} y={-3} color="#FF0055" />
          <Pixel x={1} y={-3} color="#FF0055" />
          {/* Secondary mini eyes */}
          <Pixel x={-2} y={-2} color="#FF3366" />
          <Pixel x={2} y={-2} color="#FF3366" />

          {/* Narrow Waist (Pedicel) */}
          <Pixel x={0} y={0} color="#0B0E14" />

          {/* Abdomen (Teardrop pixel block) */}
          <Pixel x={-2} y={1} w={5} h={1} color="#1F2937" />
          <Pixel x={-3} y={2} w={7} h={1} color="#111827" />
          <Pixel x={-3} y={3} w={7} h={1} color="#1F2937" />
          <Pixel x={-3} y={4} w={7} h={1} color="#111827" />
          <Pixel x={-2} y={5} w={5} h={1} color="#1F2937" />
          <Pixel x={-1} y={6} w={3} h={1} color="#111827" />
          <Pixel x={0} y={7} w={1} h={1} color="#1F2937" />

          {/* Dithered Cross Pattern on Back (Retro skull/cross marking) */}
          <Pixel x={0} y={2} color="#374151" />
          <Pixel x={-1} y={3} w={3} h={1} color="#4B5563" />
          <Pixel x={0} y={4} color="#374151" />
          <Pixel x={0} y={5} color="#4B5563" />

          {/* Rear Spinneret (Silk emitter connecting to thread) */}
          <Pixel x={0} y={8} color="#94A3B8" />
        </g>
      </svg>
    </span>
  );
}
