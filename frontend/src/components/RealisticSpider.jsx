import React, { useEffect, useRef, useState } from 'react';

/**
 * RealisticSpider:
 * A realistic arachnid that descends down on a silk thread directly from
 * the "Evidential neural detection for URLs" text.
 *
 * Features:
 * - Natural spider anatomy: Cephalothorax, abdomen, pedipalps, and 8 articulated multi-segment legs.
 * - Physics-based silk descent: Drops down, bobs on the elastic thread, and sways gently.
 * - Organic idle behaviors: Realistic leg twitches, posture shifts, and thread climbing.
 * - Interactive: Hovering or clicking causes the spider to scurry up its thread in retreat,
 *   pausing before cautiously rappelling back down.
 */
export default function RealisticSpider() {
  const [threadLength, setThreadLength] = useState(85);
  const [swayAngle, setSwayAngle] = useState(0);
  const [legPhase, setLegPhase] = useState(0);
  const [isScared, setIsScared] = useState(false);
  const animRef = useRef(null);
  const stateRef = useRef({
    currentY: 15,
    targetY: 95,
    vy: 0,
    sway: 0,
    time: 0,
    scaredTimer: 0,
    twitchTimer: 0,
    twitchOffsets: [0, 0, 0, 0, 0, 0, 0, 0],
  });

  useEffect(() => {
    let lastTime = performance.now();

    const loop = (now) => {
      const dt = Math.min(32, now - lastTime) / 1000;
      lastTime = now;
      const s = stateRef.current;
      s.time += dt;

      // Handle scared reaction (retreat up thread when disturbed)
      if (s.scaredTimer > 0) {
        s.scaredTimer -= dt;
        s.targetY = 12; // scurry back up near the text
        if (s.scaredTimer <= 0) {
          setIsScared(false);
          s.targetY = 80 + Math.random() * 35; // descend back down
        }
      } else {
        // Natural periodic descent and minor repositioning
        if (Math.sin(s.time * 0.15) > 0.98 && Math.random() < 0.02) {
          s.targetY = 65 + Math.random() * 55;
        }
      }

      // Spring & dampening physics for vertical descent
      const dy = s.targetY - s.currentY;
      const springK = s.scaredTimer > 0 ? 12 : 5.5;
      const damping = 0.88;

      s.vy += dy * springK * dt;
      s.vy *= Math.pow(damping, dt * 60);
      s.currentY += s.vy * dt;

      // Pendulum pendulum sway on the silk thread
      const swayFrequency = 1.4;
      const swayAmplitude = s.scaredTimer > 0 ? 0.04 : 0.08;
      s.sway = Math.sin(s.time * swayFrequency) * swayAmplitude;

      // Periodic natural leg twitches
      s.twitchTimer += dt;
      if (s.twitchTimer > 1.8 + Math.random() * 2.5) {
        s.twitchTimer = 0;
        const activeLeg = Math.floor(Math.random() * 8);
        s.twitchOffsets[activeLeg] = (Math.random() - 0.5) * 4;
        setTimeout(() => {
          if (stateRef.current) stateRef.current.twitchOffsets[activeLeg] = 0;
        }, 300);
      }

      setThreadLength(s.currentY);
      setSwayAngle(s.sway);
      setLegPhase(s.time * (s.scaredTimer > 0 ? 14 : 2.5));

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const handleDisturb = () => {
    stateRef.current.scaredTimer = 3.5; // retreat up for 3.5 seconds
    setIsScared(true);
  };

  // Realistic 8-legged spider geometry
  // Legs: 4 on left (-1), 4 on right (+1)
  // Leg 1: Front reachers (longest)
  // Leg 2: Forward-side feelers
  // Leg 3: Lateral support
  // Leg 4: Rear thread-grippers
  const renderLegs = () => {
    const legs = [];
    const s = stateRef.current;

    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        const legIdx = (side === -1 ? 0 : 4) + i;
        const twitch = s.twitchOffsets[legIdx] || 0;
        const crawl = Math.sin(legPhase + i * 0.85 + side * 0.5) * (isScared ? 3.5 : 1.2);

        // Attachment point on cephalothorax
        const startX = side * 3.5;
        const startY = -4 + i * 2.6;

        let kneeX, kneeY, footX, footY;

        if (i === 0) {
          // Front leg (extends forward and outward)
          kneeX = startX + side * (9 + crawl * 0.5);
          kneeY = startY - (11 + crawl);
          footX = kneeX + side * (7 + twitch);
          footY = kneeY + (12 + crawl * 0.8);
        } else if (i === 1) {
          // Second leg (forward-lateral)
          kneeX = startX + side * (13 + crawl * 0.4);
          kneeY = startY - (6 + crawl);
          footX = kneeX + side * (7 + twitch);
          footY = kneeY + (13 + crawl * 0.6);
        } else if (i === 2) {
          // Third leg (lateral-rear, shorter)
          kneeX = startX + side * (12 - crawl * 0.3);
          kneeY = startY + (3 + crawl * 0.5);
          footX = kneeX + side * (5 + twitch);
          footY = kneeY + (11 - crawl * 0.4);
        } else {
          // Fourth leg (rear, grips / curls towards the silk thread)
          kneeX = startX + side * (7 - crawl * 0.4);
          kneeY = startY + (9 + crawl * 0.6);
          footX = kneeX + side * (4 + twitch * 0.5);
          footY = kneeY + (13 + crawl * 0.5);
        }

        legs.push(
          <g key={`leg-${side}-${i}`}>
            {/* Femur (base to knee) */}
            <line
              x1={startX}
              y1={startY}
              x2={kneeX}
              y2={kneeY}
              stroke="#1C2128"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Tibia & Tarsus (knee to tip) */}
            <line
              x1={kneeX}
              y1={kneeY}
              x2={footX}
              y2={footY}
              stroke="#2D333B"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            {/* Fine leg tip highlight */}
            <circle cx={footX} cy={footY} r="0.75" fill="#444C56" />
          </g>
        );
      }
    }
    return legs;
  };

  return (
    <div
      className="absolute left-1/2 top-full -translate-x-1/2 pointer-events-auto select-none z-30"
      style={{
        width: '60px',
        height: `${Math.max(120, threadLength + 40)}px`,
      }}
      onMouseEnter={handleDisturb}
      onClick={handleDisturb}
      title="A realistic spider descending on a silk thread. Hover or click to disturb!"
    >
      <svg
        className="w-full h-full overflow-visible"
        viewBox={`-30 0 60 ${Math.max(120, threadLength + 40)}`}
      >
        <defs>
          {/* Subtle silk gradient */}
          <linearGradient id="spiderSilk" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.7)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.45)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.3)" />
          </linearGradient>

          {/* Realistic spider body shading */}
          <radialGradient id="abdomenGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#2D333B" />
            <stop offset="45%" stopColor="#1C2128" />
            <stop offset="100%" stopColor="#0D1117" />
          </radialGradient>

          <radialGradient id="cephalothoraxGrad" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#373E47" />
            <stop offset="70%" stopColor="#1C2128" />
            <stop offset="100%" stopColor="#0B0E14" />
          </radialGradient>
        </defs>

        {/* 1. Fine Spider Silk Thread descending straight from the text */}
        <line
          x1="0"
          y1="0"
          x2={Math.sin(swayAngle) * threadLength * 0.25}
          y2={threadLength}
          stroke="url(#spiderSilk)"
          strokeWidth="0.85"
          strokeOpacity="0.8"
        />

        {/* 2. Spider Body Group positioned at the end of the silk thread */}
        <g
          transform={`translate(${Math.sin(swayAngle) * threadLength * 0.25}, ${threadLength}) rotate(${swayAngle * (180 / Math.PI) * 1.5})`}
          className="cursor-pointer"
        >
          {/* 8 Articulated Organic Legs */}
          {renderLegs()}

          {/* Pedipalps (front sensory feelers) */}
          <line x1="-1.5" y1="-8" x2="-3" y2="-12" stroke="#2D333B" strokeWidth="1.1" strokeLinecap="round" />
          <line x1="1.5" y1="-8" x2="3" y2="-12" stroke="#2D333B" strokeWidth="1.1" strokeLinecap="round" />

          {/* Abdomen (Opisthosoma) - Upper teardrop body */}
          <ellipse
            cx="0"
            cy="7"
            rx="5.2"
            ry="7.5"
            fill="url(#abdomenGrad)"
            stroke="#1C2128"
            strokeWidth="0.6"
          />

          {/* Natural subtle dorsal marking on abdomen */}
          <path
            d="M 0,2 Q -1.5,5 0,9 Q 1.5,5 0,2"
            fill="#373E47"
            opacity="0.65"
          />

          {/* Spinnerets (tip of abdomen holding the silk) */}
          <circle cx="0" cy="14.8" r="0.9" fill="#1C2128" />

          {/* Cephalothorax (Prosoma) - Head & Thorax */}
          <ellipse
            cx="0"
            cy="-3.5"
            rx="4.2"
            ry="4.8"
            fill="url(#cephalothoraxGrad)"
            stroke="#1C2128"
            strokeWidth="0.6"
          />

          {/* Realistic tiny spider eye cluster (8 micro eyes reflecting subtle light) */}
          <circle cx="-1.2" cy="-6.5" r="0.5" fill="#58A6FF" opacity="0.8" />
          <circle cx="1.2" cy="-6.5" r="0.5" fill="#58A6FF" opacity="0.8" />
          <circle cx="-2.2" cy="-5.8" r="0.4" fill="#58A6FF" opacity="0.6" />
          <circle cx="2.2" cy="-5.8" r="0.4" fill="#58A6FF" opacity="0.6" />
          <circle cx="-0.6" cy="-5.2" r="0.35" fill="#FFFFFF" opacity="0.5" />
          <circle cx="0.6" cy="-5.2" r="0.35" fill="#FFFFFF" opacity="0.5" />
        </g>
      </svg>
    </div>
  );
}
