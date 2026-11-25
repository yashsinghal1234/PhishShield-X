import React, { useEffect, useRef, useState } from 'react';

/**
 * SpideyFriendlySpider:
 * A friendly, iconic retro pixel-art spider styled after Spider-Man!
 *
 * Features:
 * - Iconic Spidey Palette: Vibrant Spidey Red (#EF4444) & Electric Cobalt Blue (#0047FF)
 * - Large, expressive white comic-book mask eyes with crisp black borders
 * - Friendly hanging pose: Hanging upside-down on a silvery web line
 * - Alternating Red & Blue limbs with classic suit patterning
 * - Interactive: Hovering or clicking triggers a playful web-bounce and a cute "THWIP!" web pulse!
 */
export default function RealisticSpider() {
  const [threadLength, setThreadLength] = useState(88);
  const [swayX, setSwayX] = useState(0);
  const [animTime, setAnimTime] = useState(0);
  const [isWaving, setIsWaving] = useState(false);
  const [showThwip, setShowThwip] = useState(false);

  const stateRef = useRef({
    currentY: 20,
    targetY: 90,
    vy: 0,
    time: 0,
    bounceTimer: 0,
    waveTimer: 0,
  });

  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min(32, now - lastTime) / 1000;
      lastTime = now;
      const s = stateRef.current;
      s.time += dt;

      // Playful bounce on the elastic web line
      if (s.bounceTimer > 0) {
        s.bounceTimer -= dt;
        s.targetY = 45; // pull up playfully
        if (s.bounceTimer <= 0) {
          setIsWaving(false);
          setShowThwip(false);
          s.targetY = 82 + Math.random() * 20; // descend back down
        }
      } else {
        // Gentle periodic ambient floating
        if (Math.sin(s.time * 0.22) > 0.985 && Math.random() < 0.02) {
          s.targetY = 75 + Math.random() * 30;
        }
      }

      // Spring physics for web elasticity
      const dy = s.targetY - s.currentY;
      const springK = s.bounceTimer > 0 ? 14 : 5.5;
      const damping = 0.86;

      s.vy += dy * springK * dt;
      s.vy *= Math.pow(damping, dt * 60);
      s.currentY += s.vy * dt;

      // Friendly rhythmic pendulum sway
      const rawSway = Math.sin(s.time * 1.6) * 7;
      const pixelSway = Math.round(rawSway / 2) * 2;
      setSwayX(pixelSway);

      setThreadLength(Math.round(s.currentY));
      setAnimTime(s.time * (s.bounceTimer > 0 ? 10 : 2.5));

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  const handleInteract = () => {
    stateRef.current.bounceTimer = 2.8;
    setIsWaving(true);
    setShowThwip(true);
  };

  // Pixel unit scale: 2.2px for crisp retro arcade proportions
  const P = 2.2;

  // Single pixel rectangle helper
  const Pixel = ({ x, y, w = 1, h = 1, color = '#EF4444' }) => (
    <rect
      x={x * P}
      y={y * P}
      width={w * P}
      height={h * P}
      fill={color}
    />
  );

  // Friendly Spidey legs in classic Red & Blue suit colors
  const renderSpideyLegs = () => {
    const legs = [];
    const t = animTime;

    for (let side = -1; side <= 1; side += 2) {
      const s = side;

      // Leg motion waves
      const m1 = Math.sin(t + s * 0.4) * 1.5;
      const m2 = Math.cos(t * 0.9 + s * 0.3) * 1.2;
      const m3 = Math.sin(t * 1.1 + s * 0.5) * 1.2;
      const m4 = Math.cos(t * 0.8 + s * 0.2) * 1.4;

      // Wave arm when disturbed (friendly Spidey wave on front right leg)
      const waveArm = (s === 1 && isWaving) ? Math.sin(t * 2.5) * 5 : 0;

      // -------------------------------------------------------------
      // LEG 4 (REAR - Blue & Red holding the web thread at top)
      // -------------------------------------------------------------
      legs.push(
        <React.Fragment key={`leg4-${s}`}>
          {/* Base Red */}
          <Pixel x={s * 2} y={-4} color="#EF4444" />
          <Pixel x={s * 3} y={-5} color="#DC2626" />
          {/* Blue Upper Thigh */}
          <Pixel x={s * 4} y={-6} color="#0047FF" />
          <Pixel x={s * 5} y={-7 + Math.round(m4 * 0.5)} color="#2563EB" />
          <Pixel x={s * 6} y={-8 + Math.round(m4 * 0.5)} color="#0047FF" />
          <Pixel x={s * 7} y={-9 + Math.round(m4)} color="#EF4444" /> {/* Red Knee */}
          {/* Red Boot curling around the web */}
          <Pixel x={s * 6} y={-10 + Math.round(m4)} color="#EF4444" />
          <Pixel x={s * 4} y={-11 + Math.round(m4 * 0.8)} color="#DC2626" />
          <Pixel x={s * 2} y={-11 + Math.round(m4 * 0.6)} color="#EF4444" />
          <Pixel x={s * 1} y={-10 + Math.round(m4 * 0.4)} color="#FFFFFF" /> {/* Web Grip */}
        </React.Fragment>
      );

      // -------------------------------------------------------------
      // LEG 3 (UPPER-MID - Spidey Blue with Red knee)
      // -------------------------------------------------------------
      legs.push(
        <React.Fragment key={`leg3-${s}`}>
          <Pixel x={s * 3} y={-2} color="#EF4444" />
          <Pixel x={s * 5} y={-3} color="#0047FF" />
          <Pixel x={s * 7} y={-4 + Math.round(m3 * 0.5)} color="#2563EB" />
          <Pixel x={s * 9} y={-4 + Math.round(m3 * 0.8)} color="#0047FF" />
          <Pixel x={s * 11} y={-3 + Math.round(m3)} color="#EF4444" /> {/* Red Knee */}
          {/* Red Boot tip */}
          <Pixel x={s * 11} y={-1 + Math.round(m3)} color="#EF4444" />
          <Pixel x={s * 11} y={1 + Math.round(m3 * 0.8)} color="#DC2626" />
          <Pixel x={s * 10} y={3 + Math.round(m3 * 0.6)} color="#EF4444" />
        </React.Fragment>
      );

      // -------------------------------------------------------------
      // LEG 2 (LOWER-MID - Blue with Red Boots)
      // -------------------------------------------------------------
      legs.push(
        <React.Fragment key={`leg2-${s}`}>
          <Pixel x={s * 3} y={0} color="#EF4444" />
          <Pixel x={s * 5} y={1} color="#0047FF" />
          <Pixel x={s * 7} y={2 + Math.round(m2 * 0.5)} color="#2563EB" />
          <Pixel x={s * 9} y={3 + Math.round(m2 * 0.8)} color="#0047FF" />
          <Pixel x={s * 10} y={5 + Math.round(m2)} color="#EF4444" /> {/* Red Knee */}
          {/* Lower boot */}
          <Pixel x={s * 10} y={7 + Math.round(m2)} color="#EF4444" />
          <Pixel x={s * 9} y={9 + Math.round(m2 * 0.8)} color="#DC2626" />
          <Pixel x={s * 8} y={11 + Math.round(m2 * 0.6)} color="#EF4444" />
        </React.Fragment>
      );

      // -------------------------------------------------------------
      // LEG 1 (FRONT - Friendly Reaching / Waving Limb)
      // -------------------------------------------------------------
      legs.push(
        <React.Fragment key={`leg1-${s}`}>
          <Pixel x={s * 2} y={1} color="#EF4444" />
          <Pixel x={s * 4} y={3} color="#0047FF" />
          <Pixel x={s * 6} y={4 + Math.round(m1 * 0.5) - waveArm} color="#2563EB" />
          <Pixel x={s * 7} y={6 + Math.round(m1 * 0.8) - waveArm} color="#0047FF" />
          <Pixel x={s * 8} y={8 + Math.round(m1) - waveArm} color="#EF4444" /> {/* Red Glove */}
          {/* Hand / Foot */}
          <Pixel x={s * 8} y={10 + Math.round(m1) - waveArm} color="#EF4444" />
          <Pixel x={s * 7} y={12 + Math.round(m1 * 0.9) - waveArm} color="#DC2626" />
          <Pixel x={s * 6} y={14 + Math.round(m1 * 0.8) - waveArm} color="#EF4444" />
        </React.Fragment>
      );
    }

    return legs;
  };

  // Silvery white spider web line with dashed pixel dots
  const webDots = [];
  const spacing = 4;
  for (let y = 0; y < threadLength - 8; y += spacing) {
    const progress = y / threadLength;
    const curX = swayX * progress;
    webDots.push(
      <rect
        key={`web-${y}`}
        x={curX - 0.6}
        y={y}
        width={1.2}
        height={2.6}
        fill="#FFFFFF"
        opacity={0.8}
      />
    );
  }

  return (
    <span
      className="absolute left-1/2 top-full -translate-x-1/2 pointer-events-auto select-none z-30 block"
      style={{
        width: '64px',
        height: `${Math.max(120, threadLength + 50)}px`,
      }}
      onMouseEnter={handleInteract}
      onClick={handleInteract}
      title="Friendly Spidey spider! Click or hover to say hi!"
    >
      <svg
        className="w-full h-full overflow-visible cursor-pointer"
        shapeRendering="crispEdges"
        viewBox={`-32 0 64 ${Math.max(120, threadLength + 50)}`}
      >
        {/* 1. Silvery Web Thread */}
        {webDots}

        {/* 2. Spidey Spider Body Group */}
        <g transform={`translate(${swayX}, ${threadLength})`}>
          {/* Animated Friendly Spidey Limbs */}
          {renderSpideyLegs()}

          {/* -------------------------------------------------------
              ABDOMEN (At top, anchored to web line - Blue & Red suit)
              ------------------------------------------------------- */}
          {/* Web Anchor Point */}
          <Pixel x={0} y={-8} color="#FFFFFF" />

          {/* Abdomen upper curve */}
          <Pixel x={-1} y={-7} w={3} h={1} color="#EF4444" />
          
          {/* Abdomen body - Cobalt Blue flanks with Crimson Red center */}
          <Pixel x={-2} y={-6} w={1} h={1} color="#0047FF" />
          <Pixel x={-1} y={-6} w={3} h={1} color="#EF4444" />
          <Pixel x={2} y={-6} w={1} h={1} color="#0047FF" />

          <Pixel x={-3} y={-5} w={2} h={1} color="#0047FF" />
          <Pixel x={-1} y={-5} w={3} h={1} color="#EF4444" />
          <Pixel x={2} y={-5} w={2} h={1} color="#0047FF" />

          {/* Center Black Spider Emblem on Red Core */}
          <Pixel x={-3} y={-4} w={2} h={1} color="#0047FF" />
          <Pixel x={-1} y={-4} color="#EF4444" />
          <Pixel x={0} y={-4} color="#0F172A" /> {/* Spider Icon */}
          <Pixel x={1} y={-4} color="#EF4444" />
          <Pixel x={2} y={-4} w={2} h={1} color="#0047FF" />

          <Pixel x={-3} y={-3} w={2} h={1} color="#0047FF" />
          <Pixel x={-1} y={-3} w={3} h={1} color="#EF4444" />
          <Pixel x={2} y={-3} w={2} h={1} color="#0047FF" />

          <Pixel x={-2} y={-2} w={1} h={1} color="#0047FF" />
          <Pixel x={-1} y={-2} w={3} h={1} color="#EF4444" />
          <Pixel x={2} y={-2} w={1} h={1} color="#0047FF" />

          {/* Waist (Belt detail) */}
          <Pixel x={-1} y={-1} w={3} h={1} color="#0F172A" />

          {/* -------------------------------------------------------
              HEAD / MASK (Pointing down - Iconic Spidey Mask & Big White Eyes)
              ------------------------------------------------------- */}
          {/* Mask Crown */}
          <Pixel x={-2} y={0} w={5} h={1} color="#EF4444" />
          <Pixel x={0} y={0} color="#0F172A" /> {/* Webbing line */}

          {/* Eye Rows with crisp black rims and friendly large white lenses */}
          <Pixel x={-3} y={1} w={7} h={1} color="#EF4444" />
          {/* Black eye border */}
          <Pixel x={-2} y={1} color="#000000" />
          <Pixel x={2} y={1} color="#000000" />

          <Pixel x={-3} y={2} w={7} h={1} color="#EF4444" />
          {/* Left Eye: Big White Comic Lens */}
          <Pixel x={-2} y={2} color="#000000" />
          <Pixel x={-1} y={2} color="#FFFFFF" />
          {/* Mask Center Webbing */}
          <Pixel x={0} y={2} color="#0F172A" />
          {/* Right Eye: Big White Comic Lens */}
          <Pixel x={1} y={2} color="#FFFFFF" />
          <Pixel x={2} y={2} color="#000000" />

          {/* Eye Bottom & Chin */}
          <Pixel x={-2} y={3} w={5} h={1} color="#EF4444" />
          <Pixel x={-1} y={3} color="#000000" />
          <Pixel x={1} y={3} color="#000000" />

          {/* Friendly Rounded Mask Chin */}
          <Pixel x={-1} y={4} w={3} h={1} color="#DC2626" />
          <Pixel x={0} y={5} w={1} h={1} color="#EF4444" />

          {/* -------------------------------------------------------
              INTERACTIVE "THWIP!" SPEECH BUBBLE ON CLICK/HOVER
              ------------------------------------------------------- */}
          {showThwip && (
            <g transform="translate(18, -4)" className="animate-bounce">
              <rect
                x="-2"
                y="-14"
                width="42"
                height="15"
                rx="3"
                fill="#080A0F"
                stroke="#00F0FF"
                strokeWidth="1.2"
              />
              <text
                x="19"
                y="-4"
                fill="#FFFFFF"
                fontSize="8.5"
                fontWeight="bold"
                fontFamily="monospace"
                textAnchor="middle"
              >
                THWIP!
              </text>
            </g>
          )}
        </g>
      </svg>
    </span>
  );
}
