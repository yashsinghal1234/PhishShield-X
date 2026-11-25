import React, { useEffect, useRef, useState } from 'react';

/**
 * CyberHeroVsSpider:
 * 1. Friendly pixel-art Spidey descends from the text and crawls on the blue box.
 * 2. Cyber Hero Avatar built from scratch:
 *    - Humanoid cyber-guardian with glowing cyan visor, nano-armor plates, fluttering energy scarf, and booster boots.
 *    - Dual-hand futuristic laser railgun/blaster that dynamically aims at the spider.
 *    - Fires rapid glowing cyan & hot-white plasma laser pulses with muzzle flashes and weapon recoil.
 *    - Spidey dodges and reacts ("WHOA!", "THWIP!", jump flips) on laser impact.
 *    - Hero patrols, runs, and leaps across the stepped blue box platforms.
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

  // Hero Avatar State
  const [heroPos, setHeroPos] = useState({ x: 450, y: 150 });
  const [heroFacing, setHeroFacing] = useState(-1);
  const [heroAimAngle, setHeroAimAngle] = useState(Math.PI);
  const [heroMuzzleFlash, setHeroMuzzleFlash] = useState(0);
  const [heroRecoil, setHeroRecoil] = useState(0);
  const [heroWalkFrame, setHeroWalkFrame] = useState(0);
  const [heroIsJumping, setHeroIsJumping] = useState(false);

  // Lasers & Hit Particles
  const [lasers, setLasers] = useState([]);
  const [hitParticles, setHitParticles] = useState([]);

  const stateRef = useRef({
    // Spider state
    spiderPhase: 'RAPPEL', // 'RAPPEL', 'ON_BOX', 'LEAPING', 'DODGE'
    sx: 200,
    sy: 40,
    svx: 0,
    svy: 0,
    sFacing: 1,
    sFrame: 0,
    sFrameTimer: 0,
    sPatrolDir: 1,
    sReactTimer: 0,

    // Hero state
    hx: 460,
    hy: 150,
    hvx: 0,
    hvy: 0,
    hFacing: -1,
    hAim: Math.PI,
    hWalkCycle: 0,
    hShootCooldown: 0,
    hRecoil: 0,
    hMuzzle: 0,
    hIsJumping: false,

    // Projectiles & FX
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
      stateRef.current.hx = initGeom.boxWidth * 0.60;
      stateRef.current.hy = getGroundY(initGeom.boxWidth * 0.60, initGeom);
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

          // Boundary turn around
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

        // Only airborne during laser DODGE reaction
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
      // 2. HERO AVATAR: STEADY PATH PATROL (NO UNNECESSARY JUMPING)
      // Follows the blue stepped staircase path smoothly and steadily
      // =============================================================
      s.hRecoil = Math.max(0, s.hRecoil - dt * 25);
      s.hMuzzle = Math.max(0, s.hMuzzle - dt * 10);
      s.hShootCooldown = Math.max(0, s.hShootCooldown - dt);

      // Hero aims futuristic railgun directly at the spider
      const gunMouthX = s.hx + s.hFacing * 18;
      const gunMouthY = s.hy - 18;
      const aimAngle = Math.atan2(s.sy - gunMouthY, s.sx - gunMouthX);
      s.hAim = aimAngle;
      s.hFacing = s.sx > s.hx ? 1 : -1;

      // Steady, disciplined path patrol along the blue stepped staircase
      // Patrols smoothly from Platform 1 (0.08) -> Platform 2 (0.50) -> Platform 3 (0.86)
      const walkSpeed = 44; // smooth, steady walking speed (px/sec)
      s.hvx = s.patrolDir * walkSpeed;
      s.hx += s.hvx * dt;
      s.hWalkCycle += dt * 7;

      // Turn around smoothly at the patrol ends of the blue box
      if (s.hx >= geom.boxWidth * 0.88 && s.patrolDir === 1) {
        s.patrolDir = -1;
      } else if (s.hx <= geom.boxWidth * 0.08 && s.patrolDir === -1) {
        s.patrolDir = 1;
      }

      // Smooth grounded surface tracking (no bouncy jumping)
      // Character's feet smoothly climb/glide along the exact step profile
      const targetFloor = getGroundY(s.hx, geom);
      s.hy += (targetFloor - s.hy) * Math.min(1, 16 * dt);
      s.hIsJumping = false; // Strictly grounded on path

      // -------------------------------------------------------------
      // 3. SHOOTING FUTURISTIC LASER BULLETS
      // -------------------------------------------------------------
      // Fire every ~0.8s when spider is in range
      if (s.hShootCooldown <= 0 && distToSpider < 480) {
        s.hShootCooldown = 0.75 + Math.random() * 0.35;
        s.hRecoil = 5.5;
        s.hMuzzle = 1.0;

        const laserSpeed = 440;
        s.projectiles.push({
          id: Math.random(),
          x: gunMouthX,
          y: gunMouthY,
          vx: Math.cos(aimAngle) * laserSpeed,
          vy: Math.sin(aimAngle) * laserSpeed,
          angle: aimAngle,
          life: 0,
        });
      }

      // Update Laser Projectiles
      for (let pIdx = s.projectiles.length - 1; pIdx >= 0; pIdx--) {
        const p = s.projectiles[pIdx];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life += dt;

        // Collision check with Spider
        const distToSpiderHit = Math.hypot(p.x - s.sx, p.y - s.sy);
        if (distToSpiderHit < 22) {
          // SPIDER GETS HIT! Spidey dodges and flips backwards!
          s.spiderPhase = 'DODGE';
          s.svy = -190;
          s.svx = -s.hFacing * 110;
          s.sPatrolDir = -s.hFacing;
          setSpiderReaction(Math.random() > 0.5 ? 'WHOA!' : 'THWIP!');
          s.sReactTimer = 1.8;

          // Spawn laser hit spark particles
          for (let k = 0; k < 8; k++) {
            const sparkAngle = Math.random() * Math.PI * 2;
            const sparkSpeed = 60 + Math.random() * 120;
            s.sparks.push({
              id: Math.random(),
              x: p.x,
              y: p.y,
              vx: Math.cos(sparkAngle) * sparkSpeed,
              vy: Math.sin(sparkAngle) * sparkSpeed,
              life: 1.0,
            });
          }

          s.projectiles.splice(pIdx, 1);
          continue;
        }

        // Out of bounds
        if (p.life > 1.8 || p.x < 0 || p.x > geom.sectionWidth || p.y < 0 || p.y > geom.sectionHeight) {
          s.projectiles.splice(pIdx, 1);
        }
      }

      // Update Spark Particles
      for (let spIdx = s.sparks.length - 1; spIdx >= 0; spIdx--) {
        const sp = s.sparks[spIdx];
        sp.x += sp.vx * dt;
        sp.y += sp.vy * dt;
        sp.life -= dt * 2.8;
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

      setHeroPos({ x: Math.round(s.hx), y: Math.round(s.hy) });
      setHeroFacing(s.hFacing);
      setHeroAimAngle(s.hAim);
      setHeroMuzzleFlash(s.hMuzzle);
      setHeroRecoil(s.hRecoil);
      setHeroWalkFrame(Math.floor(s.hWalkCycle) % 4);
      setHeroIsJumping(s.hIsJumping);

      setLasers([...s.projectiles]);
      setHitParticles([...s.sparks]);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [sectionRef, textAnchorRef, boxRef]);

  // Click interaction: commands hero to immediately rapid-fire!
  const handleHeroShoot = () => {
    const s = stateRef.current;
    s.hShootCooldown = 0;
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
  // CYBER HERO AVATAR BUILT FROM SCRATCH
  // Humanoid Cyber Defender with Glowing Cyan Visor, Scarf, and Plasma Cannon
  // -----------------------------------------------------------------
  const renderHeroAvatar = () => {
    const f = heroFacing;
    const legCycle = Math.sin(heroWalkFrame * 1.5) * 4;
    const gunRot = f === 1 ? heroAimAngle : heroAimAngle - Math.PI;

    return (
      <g transform={`scale(${f}, 1)`} className="cursor-pointer">
        {/* 1. Fluttering Energy Scarf / Cape behind Hero */}
        <path
          d={`M -4 -22 Q -14 -18 -22 -12 Q -16 -8 -2 -18`}
          fill="rgba(0, 71, 255, 0.85)"
          stroke="#00F0FF"
          strokeWidth="1.0"
        />

        {/* 2. Legs / Robotic Thruster Boots */}
        {heroIsJumping ? (
          // In-air tucked legs with rocket thruster sparks
          <>
            <rect x="-6" y="-12" width="4.5" height="10" rx="1.5" fill="#0F172A" />
            <rect x="1" y="-14" width="4.5" height="12" rx="1.5" fill="#1E293B" />
            {/* Cyan Thruster Boots */}
            <rect x="-7" y="-3" width="6.5" height="4" rx="1" fill="#00F0FF" />
            <rect x="0" y="-3" width="6.5" height="4" rx="1" fill="#00F0FF" />
            {/* Thruster Flames */}
            <polygon points="-4,1 -6,6 -2,6" fill="#38BDF8" />
            <polygon points="3,1 1,6 5,6" fill="#38BDF8" />
          </>
        ) : (
          // Running / Stride Legs
          <>
            {/* Back Leg */}
            <rect x={-4 - legCycle * 0.4} y="-13" width="4.5" height="11" rx="1.5" fill="#0F172A" />
            <rect x={-5 - legCycle * 0.4} y="-3" width="6" height="4" rx="1" fill="#0047FF" />
            {/* Front Leg */}
            <rect x={2 + legCycle * 0.4} y="-13" width="4.5" height="11" rx="1.5" fill="#1E293B" />
            <rect x={1 + legCycle * 0.4} y="-3" width="6" height="4" rx="1" fill="#00F0FF" />
          </>
        )}

        {/* 3. Hero Torso & Cyber Nano-Armor */}
        <rect x="-6" y="-24" width="12" height="13" rx="2" fill="#0F172A" />
        <rect x="-5" y="-23" width="10" height="9" rx="1" fill="#1E293B" />
        {/* Glowing Arc Reactor Chest Core */}
        <circle cx="0" cy="-19" r="2.2" fill="#00F0FF" />

        {/* 4. Helmet & Glowing Visor */}
        <ellipse cx="0" cy="-29" rx="7" ry="7.5" fill="#0F172A" stroke="#334155" strokeWidth="0.8" />
        <rect x="-2" y="-37" width="4" height="3" fill="#0047FF" rx="0.5" /> {/* Helmet crest */}
        
        {/* Futuristic Glowing Cyan Visor */}
        <rect x="-1" y="-31" width="7.5" height="3.2" rx="1" fill="#00F0FF" />
        <rect x="1" y="-30" width="4.5" height="1.2" fill="#FFFFFF" />

        {/* -------------------------------------------------------------
            5. DUAL-HAND FUTURISTIC RAILGUN / LASER BLASTER
            Pivots smoothly to aim directly at the spider!
            ------------------------------------------------------------- */}
        <g
          transform={`translate(4, -18) rotate(${(gunRot * 180) / Math.PI}) translate(${-heroRecoil}, 0)`}
        >
          {/* Back Glove holding rifle grip */}
          <circle cx="-3" cy="2" r="2.5" fill="#334155" />

          {/* Gun Stock & Battery Chassis */}
          <rect x="-8" y="-3.5" width="10" height="7" rx="1.5" fill="#0F172A" stroke="#0047FF" strokeWidth="0.8" />
          <circle cx="-3" cy="0" r="1.6" fill="#00F0FF" />

          {/* Heavy Railgun Barrel */}
          <rect x="2" y="-2.5" width="16" height="5" rx="1" fill="#1E293B" />
          {/* Glowing Energy Power Conduits along barrel */}
          <line x1="3" y1="-1" x2="16" y2="-1" stroke="#00F0FF" strokeWidth="1.2" />
          <line x1="3" y1="1" x2="16" y2="1" stroke="#00F0FF" strokeWidth="1.2" />
          <rect x="16" y="-3" width="2.5" height="6" rx="0.5" fill="#E2E8F0" />

          {/* Front Glove supporting barrel */}
          <circle cx="6" cy="3" r="2.2" fill="#00F0FF" />

          {/* Muzzle Flash FX when shooting */}
          {heroMuzzleFlash > 0.1 && (
            <g transform="translate(21, 0)">
              <polygon
                points="0,-7 3,-2 9,0 3,2 0,7 -3,2 -9,0 -3,-2"
                fill="#FFFFFF"
              />
              <circle cx="0" cy="0" r="5.5" fill="#00F0FF" opacity="0.85" />
            </g>
          )}
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

          {/* Glowing Laser Bullet Beam Gradient */}
          <linearGradient id="laserBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0047FF" stopOpacity="0.2" />
            <stop offset="60%" stopColor="#00F0FF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="1.0" />
          </linearGradient>
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

        {/* 2. GLOWING LASER BULLETS */}
        {lasers.map((p) => {
          const tailLen = 14;
          const tailX = p.x - Math.cos(p.angle) * tailLen;
          const tailY = p.y - Math.sin(p.angle) * tailLen;

          return (
            <g key={p.id}>
              {/* Outer Cyan Glow Beam */}
              <line
                x1={tailX}
                y1={tailY}
                x2={p.x}
                y2={p.y}
                stroke="#00F0FF"
                strokeWidth="3.5"
                strokeLinecap="round"
                opacity="0.85"
              />
              {/* Hot White Laser Core */}
              <line
                x1={tailX + 4}
                y1={tailY + 4}
                x2={p.x}
                y2={p.y}
                stroke="#FFFFFF"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx={p.x} cy={p.y} r="2.2" fill="#FFFFFF" />
            </g>
          );
        })}

        {/* 3. IMPACT SPARK PARTICLES */}
        {hitParticles.map((sp) => (
          <circle
            key={sp.id}
            cx={sp.x}
            cy={sp.y}
            r={1.6}
            fill="#00F0FF"
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

        {/* 5. CYBER HERO AVATAR WITH FUTURISTIC LASER CANNON */}
        <g
          transform={`translate(${heroPos.x}, ${heroPos.y})`}
          className="pointer-events-auto cursor-pointer"
          onClick={handleHeroShoot}
          title="Cyber Hero Defender! Click to rapid-fire laser pulses!"
        >
          {renderHeroAvatar()}
        </g>
      </svg>
    </div>
  );
}
