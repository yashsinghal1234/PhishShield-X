import React, { useEffect, useRef, useState } from 'react';

/**
 * RealisticPixelSpider:
 * A refined, authentic pixel-art spider descending head-first on a fine silk thread
 * directly from "Evidential neural detection for URLs".
 *
 * Anatomical & Visual Refinements:
 * - Proper inverted hanging posture: Bulbous abdomen at top anchored to the silk thread,
 *   head pointing downwards with chelicerae fangs and glowing red micro-eyes.
 * - Long, gracefully arched arachnid legs with high knee joints and slender reaching tarsi.
 * - Rear legs curl upward to grip the silk thread; front legs reach downward to probe the air.
 * - Natural chitin palette (deep charcoal, obsidian, and subtle slate edge highlights)
 *   without artificial neon dots.
 * - Multi-frame subtle leg crawling / probing micro-motions.
 * - Interactive: Hover or click startles the spider, causing it to scurry up its silk line.
 */
export default function RealisticSpider() {
  const [threadLength, setThreadLength] = useState(90);
  const [swayX, setSwayX] = useState(0);
  const [animTime, setAnimTime] = useState(0);
  const [isScared, setIsScared] = useState(false);

  const stateRef = useRef({
    currentY: 20,
    targetY: 92,
    vy: 0,
    time: 0,
    scaredTimer: 0,
    twitchTimer: 0,
    twitchOffset: 0,
  });

  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min(32, now - lastTime) / 1000;
      lastTime = now;
      const s = stateRef.current;
      s.time += dt;

      // Handle scared state
      if (s.scaredTimer > 0) {
        s.scaredTimer -= dt;
        s.targetY = 14; // scurry back up near the text
        if (s.scaredTimer <= 0) {
          setIsScared(false);
          s.targetY = 78 + Math.random() * 30; // descend back down
        }
      } else {
        // Natural subtle bobbing / repositioning
        if (Math.sin(s.time * 0.18) > 0.985 && Math.random() < 0.02) {
          s.targetY = 70 + Math.random() * 45;
        }
      }

      // Physics for silk descent
      const dy = s.targetY - s.currentY;
      const springK = s.scaredTimer > 0 ? 12 : 5;
      const damping = 0.88;

      s.vy += dy * springK * dt;
      s.vy *= Math.pow(damping, dt * 60);
      s.currentY += s.vy * dt;

      // Discrete pixel-snapped pendulum sway
      const rawSway = Math.sin(s.time * 1.3) * 6;
      const pixelSway = Math.round(rawSway / 2) * 2;
      setSwayX(pixelSway);

      // Periodic natural leg twitch
      s.twitchTimer += dt;
      if (s.twitchTimer > 2.2 + Math.random() * 2.0) {
        s.twitchTimer = 0;
        s.twitchOffset = (Math.random() - 0.5) * 2;
        setTimeout(() => {
          if (stateRef.current) stateRef.current.twitchOffset = 0;
        }, 260);
      }

      setThreadLength(Math.round(s.currentY));
      setAnimTime(s.time * (s.scaredTimer > 0 ? 9 : 2.0));

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  const handleDisturb = () => {
    stateRef.current.scaredTimer = 3.5;
    setIsScared(true);
  };

  // Pixel unit scale: 2px per pixel unit for crisp definition
  const P = 2.0;

  // Single square pixel helper
  const Pixel = ({ x, y, w = 1, h = 1, color = '#121721' }) => (
    <rect
      x={x * P}
      y={y * P}
      width={w * P}
      height={h * P}
      fill={color}
    />
  );

  // Generate 8 gracefully arched, long spider legs
  const renderArchedLegs = () => {
    const legs = [];
    const t = animTime;
    const twitch = stateRef.current.twitchOffset || 0;

    for (let side = -1; side <= 1; side += 2) {
      const s = side;

      // Leg motion oscillations
      const m1 = Math.sin(t + s * 0.4) * 1.5 + twitch;
      const m2 = Math.cos(t * 0.9 + s * 0.3) * 1.2;
      const m3 = Math.sin(t * 1.1 + s * 0.5) * 1.2;
      const m4 = Math.cos(t * 0.8 + s * 0.2) * 1.4;

      // -------------------------------------------------------------
      // LEG 4 (REAR - arches UP towards the silk line, holding it)
      // -------------------------------------------------------------
      legs.push(
        <React.Fragment key={`leg4-${s}`}>
          {/* Coxa & Trochanter */}
          <Pixel x={s * 2} y={-4} color="#161C26" />
          <Pixel x={s * 3} y={-5} color="#242E3D" />
          {/* Femur (reaching up-out to knee) */}
          <Pixel x={s * 4} y={-6} color="#161C26" />
          <Pixel x={s * 5} y={-7 + Math.round(m4 * 0.5)} color="#242E3D" />
          <Pixel x={s * 6} y={-8 + Math.round(m4 * 0.5)} color="#161C26" />
          <Pixel x={s * 7} y={-9 + Math.round(m4)} color="#323F52" /> {/* Knee */}
          {/* Tibia & Tarsus (curling back inward to touch the silk thread) */}
          <Pixel x={s * 6} y={-10 + Math.round(m4)} color="#242E3D" />
          <Pixel x={s * 4} y={-11 + Math.round(m4 * 0.8)} color="#161C26" />
          <Pixel x={s * 2} y={-11 + Math.round(m4 * 0.6)} color="#242E3D" />
          <Pixel x={s * 1} y={-10 + Math.round(m4 * 0.4)} color="#3D4B61" /> {/* Claws */}
        </React.Fragment>
      );

      // -------------------------------------------------------------
      // LEG 3 (UPPER-MID - wide lateral arch)
      // -------------------------------------------------------------
      legs.push(
        <React.Fragment key={`leg3-${s}`}>
          <Pixel x={s * 3} y={-2} color="#161C26" />
          <Pixel x={s * 5} y={-3} color="#242E3D" />
          <Pixel x={s * 7} y={-4 + Math.round(m3 * 0.5)} color="#161C26" />
          <Pixel x={s * 9} y={-4 + Math.round(m3 * 0.8)} color="#242E3D" />
          <Pixel x={s * 11} y={-3 + Math.round(m3)} color="#323F52" /> {/* Knee */}
          {/* Downward drop */}
          <Pixel x={s * 12} y={-1 + Math.round(m3)} color="#161C26" />
          <Pixel x={s * 12} y={1 + Math.round(m3 * 0.8)} color="#242E3D" />
          <Pixel x={s * 11} y={3 + Math.round(m3 * 0.6)} color="#161C26" />
          <Pixel x={s * 10} y={5 + Math.round(m3 * 0.4)} color="#3D4B61" />
        </React.Fragment>
      );

      // -------------------------------------------------------------
      // LEG 2 (LOWER-MID - wide spread with high knee and drop)
      // -------------------------------------------------------------
      legs.push(
        <React.Fragment key={`leg2-${s}`}>
          <Pixel x={s * 3} y={0} color="#161C26" />
          <Pixel x={s * 5} y={1} color="#242E3D" />
          <Pixel x={s * 7} y={2 + Math.round(m2 * 0.5)} color="#161C26" />
          <Pixel x={s * 9} y={3 + Math.round(m2 * 0.8)} color="#242E3D" />
          <Pixel x={s * 11} y={5 + Math.round(m2)} color="#323F52" /> {/* Knee */}
          {/* Calf / Foot */}
          <Pixel x={s * 11} y={7 + Math.round(m2)} color="#161C26" />
          <Pixel x={s * 10} y={9 + Math.round(m2 * 0.8)} color="#242E3D" />
          <Pixel x={s * 9} y={11 + Math.round(m2 * 0.6)} color="#161C26" />
          <Pixel x={s * 8} y={13 + Math.round(m2 * 0.4)} color="#3D4B61" />
        </React.Fragment>
      );

      // -------------------------------------------------------------
      // LEG 1 (FRONT - Longest hunting reach, extending downward)
      // -------------------------------------------------------------
      legs.push(
        <React.Fragment key={`leg1-${s}`}>
          <Pixel x={s * 2} y={1} color="#161C26" />
          <Pixel x={s * 4} y={3} color="#242E3D" />
          <Pixel x={s * 6} y={5 + Math.round(m1 * 0.5)} color="#161C26" />
          <Pixel x={s * 8} y={7 + Math.round(m1 * 0.8)} color="#242E3D" />
          <Pixel x={s * 9} y={9 + Math.round(m1)} color="#323F52" /> {/* High Knee */}
          {/* Long reaching tibia & tarsus */}
          <Pixel x={s * 9} y={11 + Math.round(m1)} color="#161C26" />
          <Pixel x={s * 8} y={13 + Math.round(m1 * 0.9)} color="#242E3D" />
          <Pixel x={s * 7} y={15 + Math.round(m1 * 0.8)} color="#161C26" />
          <Pixel x={s * 6} y={17 + Math.round(m1 * 0.6)} color="#242E3D" />
          <Pixel x={s * 5} y={19 + Math.round(m1 * 0.4)} color="#3D4B61" /> {/* Tip */}
        </React.Fragment>
      );
    }

    return legs;
  };

  // Fine stippled silk thread (single crisp pixel wide)
  const threadElements = [];
  const spacing = 4;
  for (let y = 0; y < threadLength - 8; y += spacing) {
    const progress = y / threadLength;
    const curX = swayX * progress;
    threadElements.push(
      <rect
        key={`silk-${y}`}
        x={curX - 0.5}
        y={y}
        width={1}
        height={2.5}
        fill="#94A3B8"
        opacity={0.65}
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
      onMouseEnter={handleDisturb}
      onClick={handleDisturb}
      title="A realistic pixel-art spider rappelling head-down on silk. Hover or click to startle!"
    >
      <svg
        className="w-full h-full overflow-visible"
        shapeRendering="crispEdges"
        viewBox={`-32 0 64 ${Math.max(120, threadLength + 50)}`}
      >
        {/* 1. Fine Stippled Silk Thread */}
        {threadElements}

        {/* 2. Spider Body (Inverted Hanging Posture) */}
        <g transform={`translate(${swayX}, ${threadLength})`}>
          {/* Arched Multi-Joint Legs */}
          {renderArchedLegs()}

          {/* -------------------------------------------------------
              ABDOMEN (At top, anchored directly to the silk thread)
              ------------------------------------------------------- */}
          {/* Spinneret Anchor Point */}
          <Pixel x={0} y={-8} color="#94A3B8" />

          {/* Abdomen body rows (bulbous teardrop shape) */}
          <Pixel x={-1} y={-7} w={3} h={1} color="#0D1117" />
          <Pixel x={-2} y={-6} w={5} h={1} color="#161C26" />
          <Pixel x={-3} y={-5} w={7} h={1} color="#0D1117" />
          <Pixel x={-3} y={-4} w={7} h={1} color="#161C26" />
          <Pixel x={-3} y={-3} w={7} h={1} color="#0D1117" />
          <Pixel x={-2} y={-2} w={5} h={1} color="#161C26" />

          {/* Natural Dorsal Folium / Marking on Abdomen */}
          <Pixel x={0} y={-6} color="#242E3D" />
          <Pixel x={-1} y={-5} w={3} h={1} color="#323F52" />
          <Pixel x={0} y={-4} color="#242E3D" />
          <Pixel x={0} y={-3} color="#323F52" />

          {/* Narrow Waist (Pedicel) */}
          <Pixel x={-1} y={-1} w={3} h={1} color="#080B10" />

          {/* -------------------------------------------------------
              CEPHALOTHORAX / HEAD (Pointing down toward ground)
              ------------------------------------------------------- */}
          <Pixel x={-2} y={0} w={5} h={1} color="#161C26" />
          <Pixel x={-2} y={1} w={5} h={1} color="#0D1117" />
          <Pixel x={-1} y={2} w={3} h={1} color="#161C26" />

          {/* Natural Spider Eye Cluster (4 subtle, sinister crimson micro-eyes) */}
          <Pixel x={-1} y={1} color="#FF1744" />
          <Pixel x={1} y={1} color="#FF1744" />
          <Pixel x={-2} y={2} color="#B71C1C" />
          <Pixel x={2} y={2} color="#B71C1C" />

          {/* Chelicerae & Fangs (pointing downwards) */}
          <Pixel x={-1} y={3} color="#242E3D" />
          <Pixel x={1} y={3} color="#242E3D" />
          <Pixel x={-1} y={4} color="#080B10" />
          <Pixel x={1} y={4} color="#080B10" />

          {/* Pedipalps (Front feelers) */}
          <Pixel x={-2} y={3} color="#161C26" />
          <Pixel x={2} y={3} color="#161C26" />
        </g>
      </svg>
    </span>
  );
}
