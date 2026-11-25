import React, { useEffect, useRef, useState } from 'react';

/**
 * SpideyOnBox:
 * A friendly retro pixel-art Spider-Man that:
 * 1. Descends from "Evidential neural detection for URLs" on a silvery web line.
 * 2. Lands right onto the top surface of the blue stepped box (GnosisSteppedDither).
 * 3. Crawls, patrols, and jumps across the steps of the blue box!
 * 4. Interactive: Hover or click makes Spidey wave, jump, and say "THWIP!".
 */
export default function RealisticSpider({ sectionRef, textAnchorRef, boxRef }) {
  const [spiderPos, setSpiderPos] = useState({ x: 200, y: 50 });
  const [webOrigin, setWebOrigin] = useState({ x: 200, y: 40 });
  const [facing, setFacing] = useState(1);
  const [crawlFrame, setCrawlFrame] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [isHanging, setIsHanging] = useState(true);
  const [showThwip, setShowThwip] = useState(false);
  const [webSlack, setWebSlack] = useState(0);

  const stateRef = useRef({
    phase: 'RAPPEL', // 'RAPPEL', 'ON_BOX', 'LEAPING'
    x: 200,
    y: 40,
    vx: 0,
    vy: 0,
    facing: 1, // 1: right, -1: left
    crawlFrame: 0,
    frameTimer: 0,
    patrolDir: 1,
    time: 0,
    webX: 200,
    webY: 40,
    pauseTimer: 0,
    thwipTimer: 0,
  });

  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    const getGeometry = () => {
      if (!sectionRef?.current) return null;
      const sRect = sectionRef.current.getBoundingClientRect();
      const tRect = textAnchorRef?.current ? textAnchorRef.current.getBoundingClientRect() : null;
      const bRect = boxRef?.current ? boxRef.current.getBoundingClientRect() : null;

      const webOriginX = tRect ? tRect.left - sRect.left + tRect.width * 0.45 : sRect.width * 0.25;
      const webOriginY = tRect ? tRect.bottom - sRect.top : 40;

      const boxTop = bRect ? bRect.top - sRect.left : 90;
      const boxActualTop = bRect ? bRect.top - sRect.top : 90;
      const boxHeight = bRect ? bRect.height : 420;
      const boxWidth = bRect ? bRect.width : sRect.width;

      return {
        sectionWidth: sRect.width,
        sectionHeight: sRect.height,
        webOriginX,
        webOriginY,
        boxTop: boxActualTop,
        boxHeight,
        boxWidth,
      };
    };

    // Calculate surface height of the blue stepped box at any horizontal coordinate X
    // Matches GnosisSteppedDither polygon:
    // 0% -> 42%: 38% height
    // 42% -> 63%: 22% height
    // 63% -> 94%: 6% height
    // 94% -> 100%: 13% height
    const getGroundY = (x, geom) => {
      const u = Math.max(0, Math.min(1, x / geom.boxWidth));
      let stepRatio = 0.38;
      if (u < 0.42) {
        stepRatio = 0.38;
      } else if (u < 0.63) {
        stepRatio = 0.22;
      } else if (u < 0.94) {
        stepRatio = 0.06;
      } else {
        stepRatio = 0.13;
      }
      return geom.boxTop + geom.boxHeight * stepRatio;
    };

    // Initialize position directly under the text
    const initGeom = getGeometry();
    if (initGeom) {
      stateRef.current.x = initGeom.webOriginX;
      stateRef.current.webX = initGeom.webOriginX;
      stateRef.current.webY = initGeom.webOriginY;
      stateRef.current.y = initGeom.webOriginY + 10;
    }

    const loop = (now) => {
      const dt = Math.min(32, now - lastTime) / 1000;
      lastTime = now;
      const s = stateRef.current;
      s.time += dt;

      const geom = getGeometry();
      if (!geom) {
        animId = requestAnimationFrame(loop);
        return;
      }

      s.webX = geom.webOriginX;
      s.webY = geom.webOriginY;

      // Handle THWIP speech bubble timer
      if (s.thwipTimer > 0) {
        s.thwipTimer -= dt;
        if (s.thwipTimer <= 0) setShowThwip(false);
      }

      // -------------------------------------------------------------
      // PHASE 1: RAPPEL DOWN FROM TEXT TO THE BLUE BOX
      // -------------------------------------------------------------
      if (s.phase === 'RAPPEL') {
        const floorY = getGroundY(s.x, geom);
        const targetRappelY = floorY - 12; // reach the surface of the blue box
        const dy = targetRappelY - s.y;

        s.vy += dy * 6.5 * dt;
        s.vy *= Math.pow(0.85, dt * 60);
        s.y += s.vy * dt;

        // Subtle pendulum sway during descent
        s.x = s.webX + Math.sin(s.time * 2.2) * 6;

        // Touch the blue box!
        if (s.y >= targetRappelY - 4) {
          s.y = floorY - 6;
          s.vy = 0;
          s.phase = 'ON_BOX';
          s.patrolDir = 1;
          s.facing = 1;
        }
      }

      // -------------------------------------------------------------
      // PHASE 2: CRAWLING & JUMPING ACROSS THE BLUE STEPPED BOX
      // -------------------------------------------------------------
      else if (s.phase === 'ON_BOX' || s.phase === 'LEAPING') {
        const currentFloor = getGroundY(s.x, geom);

        // Pause occasionally to look around
        if (s.pauseTimer > 0) {
          s.pauseTimer -= dt;
        } else {
          // Crawl along the surface
          if (s.phase === 'ON_BOX') {
            const speed = 48; // px per second
            s.vx = s.patrolDir * speed;
            s.facing = s.patrolDir;

            // Animate 8-bit crawling legs
            s.frameTimer += dt;
            if (s.frameTimer > 0.12) {
              s.frameTimer = 0;
              s.crawlFrame = (s.crawlFrame + 1) % 4;
            }

            // Check upcoming floor ahead (detect step ledges)
            const lookAheadX = s.x + s.patrolDir * 28;
            const floorAhead = getGroundY(lookAheadX, geom);

            // If approaching an upward step (floorAhead is HIGHER up, so smaller Y):
            if (floorAhead < currentFloor - 20) {
              // Execute a Spidey leap up to the next step!
              s.phase = 'LEAPING';
              s.vy = -180; // upward jump impulse
              s.vx = s.patrolDir * 75;
            }
            // If approaching a downward ledge drop:
            else if (floorAhead > currentFloor + 20) {
              // Hop down to the lower platform
              s.phase = 'LEAPING';
              s.vy = -40;
              s.vx = s.patrolDir * 55;
            }

            // Check patrol boundaries (turn around near edges of the box)
            if (s.x > geom.boxWidth * 0.90 && s.patrolDir === 1) {
              s.patrolDir = -1;
              s.pauseTimer = 1.2;
            } else if (s.x < geom.boxWidth * 0.05 && s.patrolDir === -1) {
              s.patrolDir = 1;
              s.pauseTimer = 1.2;
            }

            // Random chance to pause and look around
            if (Math.random() < 0.003) {
              s.pauseTimer = 1.6;
            }
          }
        }

        // Apply velocities
        s.x += s.vx * dt;

        // Leaping / airborne physics
        if (s.phase === 'LEAPING') {
          s.vy += 480 * dt; // gravity
          s.y += s.vy * dt;

          const landFloor = getGroundY(s.x, geom);
          if (s.y >= landFloor - 6 && s.vy > 0) {
            s.y = landFloor - 6;
            s.vy = 0;
            s.phase = 'ON_BOX';
          }
        } else {
          // Stay snapped smoothly to the top edge of the blue box
          s.y = currentFloor - 6;
        }
      }

      setSpiderPos({ x: Math.round(s.x), y: Math.round(s.y) });
      setWebOrigin({ x: Math.round(s.webX), y: Math.round(s.webY) });
      setFacing(s.facing);
      setCrawlFrame(s.crawlFrame);
      setIsJumping(s.phase === 'LEAPING');
      setIsHanging(s.phase === 'RAPPEL');
      setWebSlack(Math.sin(s.time * 2) * 4);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [sectionRef, textAnchorRef, boxRef]);

  const handleInteract = () => {
    const s = stateRef.current;
    s.vy = -120; // playful hop
    s.phase = 'LEAPING';
    s.thwipTimer = 2.2;
    setShowThwip(true);
  };

  // Pixel unit scale: 2.2px for crisp retro arcade proportions
  const P = 2.2;

  const Pixel = ({ x, y, w = 1, h = 1, color = '#EF4444' }) => (
    <rect
      x={x * P}
      y={y * P}
      width={w * P}
      height={h * P}
      fill={color}
    />
  );

  // -----------------------------------------------------------------
  // SPIDEY ON THE BLUE BOX (Horizontal Crawling & Leaping Stance)
  // -----------------------------------------------------------------
  const renderBoxCrawler = () => {
    const frame = crawlFrame;
    const f = facing; // 1: facing right, -1: facing left

    // Leg stepping cycle when crawling along the blue surface
    const stepA = frame === 0 || frame === 2 ? 1 : -1;
    const stepB = frame === 1 || frame === 3 ? 1 : -1;

    return (
      <g transform={`scale(${f}, 1)`}>
        {/* Legs behind body */}
        <Pixel x={-6} y={-4 + stepA} color="#0047FF" />
        <Pixel x={-8} y={-6 + stepA} color="#EF4444" />
        <Pixel x={-9} y={-2 + stepA} color="#EF4444" />

        <Pixel x={-3} y={-5 - stepB} color="#0047FF" />
        <Pixel x={-4} y={-8 - stepB} color="#EF4444" />
        <Pixel x={-5} y={-3 - stepB} color="#EF4444" />

        <Pixel x={2} y={-5 + stepA} color="#0047FF" />
        <Pixel x={3} y={-8 + stepA} color="#EF4444" />
        <Pixel x={4} y={-3 + stepA} color="#EF4444" />

        <Pixel x={6} y={-4 - stepB} color="#0047FF" />
        <Pixel x={8} y={-6 - stepB} color="#EF4444" />
        <Pixel x={9} y={-2 - stepB} color="#EF4444" />

        {/* Spidey Body / Torso (Cobalt Blue sides with Red Center & Emblem) */}
        <Pixel x={-6} y={-3} w={3} h={4} color="#0047FF" />
        <Pixel x={-3} y={-4} w={5} h={5} color="#EF4444" />
        <Pixel x={-1} y={-3} w={2} h={3} color="#0F172A" /> {/* Black Spider Emblem */}
        <Pixel x={2} y={-3} w={2} h={4} color="#0047FF" />

        {/* Head / Mask (Facing forward) */}
        <Pixel x={4} y={-4} w={4} h={5} color="#EF4444" />
        <Pixel x={5} y={-3} w={3} h={3} color="#DC2626" />

        {/* Iconic White Spider-Man Mask Eye */}
        <Pixel x={5} y={-3} color="#000000" />
        <Pixel x={6} y={-3} w={2} h={2} color="#FFFFFF" />
        <Pixel x={8} y={-2} color="#000000" />

        {/* Front Legs (in front of body) */}
        <Pixel x={-5} y={-1 - stepA} color="#0047FF" />
        <Pixel x={-7} y={2 - stepA} color="#EF4444" />
        <Pixel x={-8} y={4} color="#DC2626" />

        <Pixel x={-1} y={-1 + stepB} color="#0047FF" />
        <Pixel x={-2} y={3 + stepB} color="#EF4444" />
        <Pixel x={-2} y={5} color="#DC2626" />

        <Pixel x={3} y={-1 - stepA} color="#0047FF" />
        <Pixel x={4} y={3 - stepA} color="#EF4444" />
        <Pixel x={5} y={5} color="#DC2626" />

        <Pixel x={6} y={-1 + stepB} color="#0047FF" />
        <Pixel x={8} y={2 + stepB} color="#EF4444" />
        <Pixel x={9} y={4} color="#DC2626" />
      </g>
    );
  };

  // -----------------------------------------------------------------
  // SPIDEY HANGING UPSIDE-DOWN (Rappelling down from the text)
  // -----------------------------------------------------------------
  const renderHangingSpider = () => (
    <g>
      {/* Rear legs holding the web line */}
      <Pixel x={-4} y={-8} color="#0047FF" />
      <Pixel x={-6} y={-10} color="#EF4444" />
      <Pixel x={-2} y={-11} color="#EF4444" />

      <Pixel x={4} y={-8} color="#0047FF" />
      <Pixel x={6} y={-10} color="#EF4444" />
      <Pixel x={2} y={-11} color="#EF4444" />

      {/* Mid legs arched outward */}
      <Pixel x={-6} y={-4} color="#0047FF" />
      <Pixel x={-9} y={-4} color="#EF4444" />
      <Pixel x={-10} y={-1} color="#EF4444" />

      <Pixel x={6} y={-4} color="#0047FF" />
      <Pixel x={9} y={-4} color="#EF4444" />
      <Pixel x={10} y={-1} color="#EF4444" />

      {/* Front legs reaching downward */}
      <Pixel x={-5} y={1} color="#0047FF" />
      <Pixel x={-8} y={3} color="#EF4444" />
      <Pixel x={-7} y={7} color="#DC2626" />

      <Pixel x={5} y={1} color="#0047FF" />
      <Pixel x={8} y={3} color="#EF4444" />
      <Pixel x={7} y={7} color="#DC2626" />

      {/* Abdomen (At top, blue flanks & red center) */}
      <Pixel x={-3} y={-6} w={6} h={5} color="#EF4444" />
      <Pixel x={-4} y={-5} w={2} h={4} color="#0047FF" />
      <Pixel x={2} y={-5} w={2} h={4} color="#0047FF" />
      <Pixel x={0} y={-4} color="#0F172A" /> {/* Spider Emblem */}

      {/* Head / Mask (Pointing down, big white comic eyes) */}
      <Pixel x={-3} y={0} w={6} h={5} color="#EF4444" />
      {/* Left Eye */}
      <Pixel x={-2} y={1} color="#000000" />
      <Pixel x={-1} y={1} w={2} h={2} color="#FFFFFF" />
      {/* Right Eye */}
      <Pixel x={1} y={1} w={2} h={2} color="#FFFFFF" />
      <Pixel x={3} y={1} color="#000000" />
    </g>
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none z-30"
      style={{ width: '100%', height: '100%' }}
    >
      <svg
        className="w-full h-full overflow-visible"
        shapeRendering="crispEdges"
      >
        <defs>
          <linearGradient id="spideyWebGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#94A3B8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* 1. Silvery Web Line connected from text down to Spidey */}
        <path
          d={`M ${webOrigin.x} ${webOrigin.y} Q ${
            (webOrigin.x + spiderPos.x) / 2 + (isHanging ? webSlack : 0)
          } ${(webOrigin.y + spiderPos.y) / 2} ${spiderPos.x} ${
            isHanging ? spiderPos.y - 12 : spiderPos.y - 4
          }`}
          stroke="url(#spideyWebGrad)"
          strokeWidth="1.2"
          strokeDasharray="4 2"
          fill="none"
        />

        {/* Web origin anchor node at the text */}
        <circle cx={webOrigin.x} cy={webOrigin.y} r="1.5" fill="#FFFFFF" />

        {/* 2. Spidey Actor (Either Rappelling or Crawling on the Blue Box) */}
        <g
          transform={`translate(${spiderPos.x}, ${spiderPos.y})`}
          className="pointer-events-auto cursor-pointer"
          onClick={handleInteract}
          onMouseEnter={handleInteract}
          title="Spidey crawling on the blue box! Click to make him jump & THWIP!"
        >
          {isHanging ? renderHangingSpider() : renderBoxCrawler()}

          {/* Interactive "THWIP!" Speech Bubble */}
          {showThwip && (
            <g transform="translate(14, -24)" className="animate-bounce">
              <rect
                x="-2"
                y="-13"
                width="42"
                height="15"
                rx="3"
                fill="#080A0F"
                stroke="#00F0FF"
                strokeWidth="1.2"
              />
              <text
                x="19"
                y="-3"
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
    </div>
  );
}
