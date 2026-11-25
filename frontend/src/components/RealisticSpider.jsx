import React, { useEffect, useRef, useState } from 'react';

/**
 * SorceressVsSpider:
 * 1. Friendly pixel-art Spidey descends from the text and crawls on the blue box.
 * 2. Anime Pixel-Art Pyromancer Sorceress Avatar (from user design):
 *    - Red coat with fur collar, auburn hair with bangs & ponytail.
 *    - Open palm conjuring live, swirling blue and dark blue magical flames!
 *    - Fires fireballs of vibrant cobalt blue (#0047FF), dark blue (#1D4ED8), and cyan (#00F0FF)!
 *    - Smoothly follows the blue stepped staircase path without unnecessary jumping.
 *    - Spidey dodges and reacts on fireball impact with blue flame sparks.
 */
export default function RealisticSpider({ sectionRef, textAnchorRef, boxRef }) {
  // Spider State
  const [spiderPos, setSpiderPos] = useState({ x: 200, y: 50 });
  const [spiderFacing, setSpiderFacing] = useState(1);
  const [crawlFrame, setCrawlFrame] = useState(0);
  const [isHanging, setIsHanging] = useState(true);
  const [spiderReaction, setSpiderReaction] = useState(null);

  // Web State
  const [webOrigin, setWebOrigin] = useState({ x: 200, y: 40 });
  const [webSlack, setWebSlack] = useState(0);

  // Sorceress Avatar State
  const [magePos, setMagePos] = useState({ x: 450, y: 150 });
  const [mageFacing, setMageFacing] = useState(-1);
  const [handFlamePhase, setHandFlamePhase] = useState(0);

  // Blue Fireballs & Flame Particles
  const [fireballs, setFireballs] = useState([]);
  const [flameSparks, setFlameSparks] = useState([]);

  const stateRef = useRef({
    // Spider state
    spiderPhase: 'RAPPEL', // 'RAPPEL', 'ON_BOX', 'DODGE'
    sx: 200,
    sy: 40,
    svx: 0,
    svy: 0,
    sFacing: 1,
    sFrame: 0,
    sFrameTimer: 0,
    sPatrolDir: 1,
    sReactTimer: 0,

    // Sorceress state
    mx: 460,
    my: 150,
    mvx: 0,
    mFacing: -1,
    mShootCooldown: 0,
    patrolDir: -1,
    walkCycle: 0,

    // Blue Fire Projectiles & Sparks
    projectiles: [],
    sparks: [],

    time: 0,
    webX: 200,
    webY: 40,
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

      const boxTop = bRect ? bRect.top - sRect.top : 90;
      const boxHeight = bRect ? bRect.height : 420;
      const boxWidth = bRect ? bRect.width : sRect.width;

      return {
        sectionWidth: sRect.width,
        sectionHeight: sRect.height,
        webOriginX,
        webOriginY,
        boxTop,
        boxHeight,
        boxWidth,
      };
    };

    // Calculate surface height of the blue stepped box at any horizontal coordinate X
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

    // Initialize positions
    const initGeom = getGeometry();
    if (initGeom) {
      stateRef.current.sx = initGeom.webOriginX;
      stateRef.current.webX = initGeom.webOriginX;
      stateRef.current.webY = initGeom.webOriginY;
      stateRef.current.sy = initGeom.webOriginY + 10;
      stateRef.current.mx = initGeom.boxWidth * 0.62;
      stateRef.current.my = getGroundY(initGeom.boxWidth * 0.62, initGeom);
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

      // Handle Spider reaction bubble timer
      if (s.sReactTimer > 0) {
        s.sReactTimer -= dt;
        if (s.sReactTimer <= 0) setSpiderReaction(null);
      }

      // =============================================================
      // 1. SPIDEY PHYSICS & BEHAVIOR
      // =============================================================
      if (s.spiderPhase === 'RAPPEL') {
        const floorY = getGroundY(s.sx, geom);
        const targetRappelY = floorY - 10;
        const dy = targetRappelY - s.sy;

        s.svy += dy * 6.5 * dt;
        s.svy *= Math.pow(0.85, dt * 60);
        s.sy += s.svy * dt;
        s.sx = s.webX + Math.sin(s.time * 2.2) * 5;

        // Land on the blue box
        if (s.sy >= targetRappelY - 4) {
          s.sy = floorY - 6;
          s.svy = 0;
          s.spiderPhase = 'ON_BOX';
          s.sPatrolDir = 1;
          s.sFacing = 1;
        }
      } else if (s.spiderPhase === 'ON_BOX' || s.spiderPhase === 'DODGE') {
        if (s.spiderPhase === 'ON_BOX') {
          const speed = 40;
          s.svx = s.sPatrolDir * speed;
          s.sFacing = s.sPatrolDir;

          s.sFrameTimer += dt;
          if (s.sFrameTimer > 0.12) {
            s.sFrameTimer = 0;
            s.sFrame = (s.sFrame + 1) % 4;
          }

          // Boundary bounce
          if (s.sx > geom.boxWidth * 0.88 && s.sPatrolDir === 1) {
            s.sPatrolDir = -1;
          } else if (s.sx < geom.boxWidth * 0.06 && s.sPatrolDir === -1) {
            s.sPatrolDir = 1;
          }

          // Smoothly crawl along the stepped surface
          const currentFloor = getGroundY(s.sx, geom);
          s.sy += (currentFloor - 6 - s.sy) * Math.min(1, 16 * dt);
        }

        s.sx += s.svx * dt;

        // Airborne only during DODGE jump
        if (s.spiderPhase === 'DODGE') {
          s.svy += 500 * dt;
          s.sy += s.svy * dt;

          const landFloor = getGroundY(s.sx, geom);
          if (s.sy >= landFloor - 6 && s.svy > 0) {
            s.sy = landFloor - 6;
            s.svy = 0;
            s.spiderPhase = 'ON_BOX';
          }
        }
      }

      // =============================================================
      // 2. SORCERESS AVATAR: DISCIPLINED PATH PATROL (NO UNNECESSARY JUMPING)
      // Follows the blue stepped staircase path smoothly
      // =============================================================
      s.mShootCooldown = Math.max(0, s.mShootCooldown - dt);

      // Sorceress turns to face the spider when in range
      s.mFacing = s.sx > s.mx ? 1 : -1;

      // Steady, smooth walking speed along the staircase surface
      const walkSpeed = 38;
      s.mvx = s.patrolDir * walkSpeed;
      s.mx += s.mvx * dt;
      s.walkCycle += dt * 6;

      // Turn around smoothly at the patrol ends of the blue box
      if (s.mx >= geom.boxWidth * 0.88 && s.patrolDir === 1) {
        s.patrolDir = -1;
      } else if (s.mx <= geom.boxWidth * 0.08 && s.patrolDir === -1) {
        s.patrolDir = 1;
      }

      // Smooth surface tracking along the exact stepped profile (no jumping!)
      const targetFloor = getGroundY(s.mx, geom);
      s.my += (targetFloor - s.my) * Math.min(1, 16 * dt);

      // =============================================================
      // 3. CASTING BLUE & DARK BLUE FIREBALLS
      // =============================================================
      // Hand flame position: x is +13px when facing right, -13px when facing left, y is -52px
      const handFlameX = s.mx + s.mFacing * 13;
      const handFlameY = s.my - 52;
      const distToSpider = Math.hypot(s.sx - s.mx, s.sy - s.my);

      // Fire blue fireball every ~0.9s
      if (s.mShootCooldown <= 0 && distToSpider < 500) {
        s.mShootCooldown = 0.85 + Math.random() * 0.35;

        const aimAngle = Math.atan2(s.sy - handFlameY, s.sx - handFlameX);
        const fireballSpeed = 380;

        s.projectiles.push({
          id: Math.random(),
          x: handFlameX,
          y: handFlameY,
          vx: Math.cos(aimAngle) * fireballSpeed,
          vy: Math.sin(aimAngle) * fireballSpeed,
          angle: aimAngle,
          life: 0,
          tail: [],
        });
      }

      // Update Blue Fireballs
      for (let pIdx = s.projectiles.length - 1; pIdx >= 0; pIdx--) {
        const p = s.projectiles[pIdx];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life += dt;

        // Add flame tail trail
        if (Math.random() < 0.7) {
          p.tail.unshift({
            x: p.x - (p.vx * dt * 0.5) + (Math.random() - 0.5) * 4,
            y: p.y - (p.vy * dt * 0.5) + (Math.random() - 0.5) * 4,
            size: 4 + Math.random() * 5,
            color: Math.random() > 0.45 ? '#0047FF' : '#1D4ED8',
            opacity: 0.85,
          });
        }
        if (p.tail.length > 8) p.tail.pop();
        p.tail.forEach((t) => (t.opacity -= dt * 2.2));

        // Collision check with Spider
        const distToSpiderHit = Math.hypot(p.x - s.sx, p.y - s.sy);
        if (distToSpiderHit < 24) {
          // SPIDER GETS HIT BY BLUE FIREBALL!
          s.spiderPhase = 'DODGE';
          s.svy = -190;
          s.svx = -s.mFacing * 110;
          s.sPatrolDir = -s.mFacing;
          setSpiderReaction(Math.random() > 0.5 ? 'WHOA!' : 'THWIP!');
          s.sReactTimer = 1.8;

          // Spawn blue & dark blue flame explosion sparks
          for (let k = 0; k < 12; k++) {
            const sparkAngle = Math.random() * Math.PI * 2;
            const sparkSpeed = 50 + Math.random() * 110;
            s.sparks.push({
              id: Math.random(),
              x: p.x,
              y: p.y,
              vx: Math.cos(sparkAngle) * sparkSpeed,
              vy: Math.sin(sparkAngle) * sparkSpeed - 20,
              size: 2 + Math.random() * 4,
              color: Math.random() > 0.5 ? '#0047FF' : Math.random() > 0.3 ? '#1D4ED8' : '#00F0FF',
              life: 1.0,
            });
          }

          s.projectiles.splice(pIdx, 1);
          continue;
        }

        // Out of bounds
        if (p.life > 2.0 || p.x < 0 || p.x > geom.sectionWidth || p.y < 0 || p.y > geom.sectionHeight) {
          s.projectiles.splice(pIdx, 1);
        }
      }

      // Update Blue Fire Sparks
      for (let spIdx = s.sparks.length - 1; spIdx >= 0; spIdx--) {
        const sp = s.sparks[spIdx];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.life -= dt * 2.5;
        if (sp.life <= 0) {
          s.sparks.splice(spIdx, 1);
        }
      }

      // Update React state
      setSpiderPos({ x: Math.round(s.sx), y: Math.round(s.sy) });
      setSpiderFacing(s.sFacing);
      setCrawlFrame(s.sFrame);
      setIsHanging(s.spiderPhase === 'RAPPEL');
      setWebOrigin({ x: Math.round(s.webX), y: Math.round(s.webY) });
      setWebSlack(Math.sin(s.time * 2) * 4);

      setMagePos({ x: Math.round(s.mx), y: Math.round(s.my) });
      setMageFacing(s.mFacing);
      setHandFlamePhase(s.time * 8);

      setFireballs([...s.projectiles]);
      setFlameSparks([...s.sparks]);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [sectionRef, textAnchorRef, boxRef]);

  // Click interaction: commands sorceress to instantly cast a blue fireball!
  const handleCastFireball = () => {
    const s = stateRef.current;
    s.mShootCooldown = 0;
  };

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
  // SPIDEY SPRITE
  // -----------------------------------------------------------------
  const renderBoxCrawler = () => {
    const stepA = crawlFrame === 0 || crawlFrame === 2 ? 1 : -1;
    const stepB = crawlFrame === 1 || crawlFrame === 3 ? 1 : -1;

    return (
      <g transform={`scale(${spiderFacing}, 1)`}>
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

        <Pixel x={-6} y={-3} w={3} h={4} color="#0047FF" />
        <Pixel x={-3} y={-4} w={5} h={5} color="#EF4444" />
        <Pixel x={-1} y={-3} w={2} h={3} color="#0F172A" />
        <Pixel x={2} y={-3} w={2} h={4} color="#0047FF" />

        <Pixel x={4} y={-4} w={4} h={5} color="#EF4444" />
        <Pixel x={5} y={-3} w={3} h={3} color="#DC2626" />
        <Pixel x={5} y={-3} color="#000000" />
        <Pixel x={6} y={-3} w={2} h={2} color="#FFFFFF" />
        <Pixel x={8} y={-2} color="#000000" />

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

  const renderHangingSpider = () => (
    <g>
      <Pixel x={-4} y={-8} color="#0047FF" />
      <Pixel x={-6} y={-10} color="#EF4444" />
      <Pixel x={-2} y={-11} color="#EF4444" />
      <Pixel x={4} y={-8} color="#0047FF" />
      <Pixel x={6} y={-10} color="#EF4444" />
      <Pixel x={2} y={-11} color="#EF4444" />

      <Pixel x={-6} y={-4} color="#0047FF" />
      <Pixel x={-9} y={-4} color="#EF4444" />
      <Pixel x={-10} y={-1} color="#EF4444" />
      <Pixel x={6} y={-4} color="#0047FF" />
      <Pixel x={9} y={-4} color="#EF4444" />
      <Pixel x={10} y={-1} color="#EF4444" />

      <Pixel x={-5} y={1} color="#0047FF" />
      <Pixel x={-8} y={3} color="#EF4444" />
      <Pixel x={-7} y={7} color="#DC2626" />
      <Pixel x={5} y={1} color="#0047FF" />
      <Pixel x={8} y={3} color="#EF4444" />
      <Pixel x={7} y={7} color="#DC2626" />

      <Pixel x={-3} y={-6} w={6} h={5} color="#EF4444" />
      <Pixel x={-4} y={-5} w={2} h={4} color="#0047FF" />
      <Pixel x={2} y={-5} w={2} h={4} color="#0047FF" />
      <Pixel x={0} y={-4} color="#0F172A" />

      <Pixel x={-3} y={0} w={6} h={5} color="#EF4444" />
      <Pixel x={-2} y={1} color="#000000" />
      <Pixel x={-1} y={1} w={2} h={2} color="#FFFFFF" />
      <Pixel x={1} y={1} w={2} h={2} color="#FFFFFF" />
      <Pixel x={3} y={1} color="#000000" />
    </g>
  );

  // -----------------------------------------------------------------
  // ANIME PYROMANCER SORCERESS AVATAR WITH BLUE & DARK BLUE FLAME
  // Rendered with pixelated clarity directly from user's design!
  // -----------------------------------------------------------------
  const renderSorceress = () => {
    const f = mageFacing;
    const spriteW = 42;
    const spriteH = 70;

    // Dancing flame flicker offsets on her raised hand
    const flicker1 = Math.sin(handFlamePhase) * 2;
    const flicker2 = Math.cos(handFlamePhase * 1.3) * 2.5;

    return (
      <g transform={`scale(${f}, 1)`} className="cursor-pointer">
        {/* Pixel-Art Character Sprite */}
        <image
          href="/sorceress-blueflame.png"
          x={-spriteW / 2}
          y={-spriteH}
          width={spriteW}
          height={spriteH}
          preserveAspectRatio="xMidYMid meet"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* -----------------------------------------------------------
            LIVE DYNAMIC BLUE & DARK BLUE HAND FLAME AURA
            Right above her raised palm at (13px, -52px)
            ----------------------------------------------------------- */}
        <g transform="translate(13, -52)">
          {/* Outer Deep Dark Blue Corona */}
          <ellipse
            cx={0}
            cy={-2 + flicker1 * 0.4}
            rx={9 + flicker1 * 0.5}
            ry={12 + flicker2 * 0.5}
            fill="#1D4ED8"
            opacity="0.55"
          />
          {/* Mid Cobalt Blue Flame */}
          <ellipse
            cx={flicker2 * 0.3}
            cy={-1 + flicker1 * 0.5}
            rx={6.5 + flicker2 * 0.3}
            ry={9 + flicker1 * 0.4}
            fill="#0047FF"
            opacity="0.85"
          />
          {/* Inner Cyan Hot Flame */}
          <ellipse
            cx={flicker1 * 0.2}
            cy={0 + flicker2 * 0.3}
            rx={4 + flicker1 * 0.2}
            ry={6 + flicker2 * 0.2}
            fill="#00F0FF"
            opacity="0.9"
          />
          {/* Core White Spark */}
          <circle cx={0} cy={1} r={2} fill="#FFFFFF" />

          {/* Floating rising blue flame ember dots */}
          <rect x={-2 + flicker1} y={-14 + flicker2} width="2" height="2" fill="#00F0FF" />
          <rect x={3 - flicker2} y={-16 - flicker1} width="2" height="2" fill="#0047FF" />
          <rect x={-4 + flicker2} y={-10 + flicker1} width="2" height="2" fill="#1D4ED8" />
        </g>
      </g>
    );
  };

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

          {/* Blue & Dark Blue Fireball Gradient */}
          <radialGradient id="blueFireballGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#00F0FF" />
            <stop offset="70%" stopColor="#0047FF" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </radialGradient>
        </defs>

        {/* 1. Silvery Web Line - only visible while descending from text */}
        {isHanging && (
          <>
            <path
              d={`M ${webOrigin.x} ${webOrigin.y} Q ${
                (webOrigin.x + spiderPos.x) / 2 + webSlack
              } ${(webOrigin.y + spiderPos.y) / 2} ${spiderPos.x} ${spiderPos.y - 12}`}
              stroke="url(#spideyWebGrad)"
              strokeWidth="1.2"
              strokeDasharray="4 2"
              fill="none"
            />
            <circle cx={webOrigin.x} cy={webOrigin.y} r="1.5" fill="#FFFFFF" />
          </>
        )}

        {/* 2. BLUE & DARK BLUE FIREBALL PROJECTILES */}
        {fireballs.map((fb) => (
          <g key={fb.id}>
            {/* Trailing blue & dark blue flame ember tail */}
            {fb.tail.map((t, idx) => (
              <circle
                key={idx}
                cx={t.x}
                cy={t.y}
                r={t.size}
                fill={t.color}
                opacity={t.opacity}
              />
            ))}

            {/* Outer Dark Blue Corona */}
            <circle cx={fb.x} cy={fb.y} r="8.5" fill="#1D4ED8" opacity="0.6" />

            {/* Glowing Core Fireball */}
            <circle cx={fb.x} cy={fb.y} r="6" fill="url(#blueFireballGrad)" />
            <circle cx={fb.x} cy={fb.y} r="2.5" fill="#FFFFFF" />
          </g>
        ))}

        {/* 3. BLUE & DARK BLUE FLAME IMPACT SPARKS */}
        {flameSparks.map((sp) => (
          <circle
            key={sp.id}
            cx={sp.x}
            cy={sp.y}
            r={sp.size}
            fill={sp.color}
            opacity={sp.life}
          />
        ))}

        {/* 4. SPIDEY ACTOR */}
        <g
          transform={`translate(${spiderPos.x}, ${spiderPos.y})`}
          className="pointer-events-auto cursor-pointer"
          title="Spidey on the blue box!"
        >
          {isHanging ? renderHangingSpider() : renderBoxCrawler()}

          {/* Spider Reaction Bubble when targeted/hit */}
          {spiderReaction && (
            <g transform="translate(14, -22)" className="animate-bounce">
              <rect
                x="-2"
                y="-13"
                width="40"
                height="15"
                rx="3"
                fill="#EF4444"
                stroke="#FFFFFF"
                strokeWidth="1.2"
              />
              <text
                x="18"
                y="-3"
                fill="#FFFFFF"
                fontSize="8.5"
                fontWeight="900"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {spiderReaction}
              </text>
            </g>
          )}
        </g>

        {/* 5. ANIME SORCERESS AVATAR CASTING BLUE & DARK BLUE FLAMES */}
        <g
          transform={`translate(${magePos.x}, ${magePos.y})`}
          className="pointer-events-auto cursor-pointer"
          onClick={handleCastFireball}
          title="Blue Flame Sorceress! Click to cast a blue fireball!"
        >
          {renderSorceress()}
        </g>
      </svg>
    </div>
  );
}
