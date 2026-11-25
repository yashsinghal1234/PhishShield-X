import React, { useEffect, useRef, useState } from 'react';

/**
 * MascotDuel:
 * Features:
 * 1. Friendly pixel-art Spidey descending from "Evidential neural detection for URLs"
 *    and crawling across the blue stepped box.
 * 2. ShadowLens Logo Cat Avatar:
 *    - Patrols and prowls along the blue stepped staircase.
 *    - Stalks the spider with a wiggling tail and crouch animation.
 *    - Pounces through the air and SWATS at Spidey with an animated paw swipe (*SWAT!*)!
 *    - Spidey reacts dynamically: jumping back, startling, and shouting "THWIP!" or "WHOA!".
 *    - Both characters jump across the stepped elevation levels of the blue box.
 */
export default function RealisticSpider({ sectionRef, textAnchorRef, boxRef }) {
  // Spider State
  const [spiderPos, setSpiderPos] = useState({ x: 200, y: 50 });
  const [spiderFacing, setSpiderFacing] = useState(1);
  const [crawlFrame, setCrawlFrame] = useState(0);
  const [isHanging, setIsHanging] = useState(true);
  const [spiderReaction, setSpiderReaction] = useState(null); // 'WHOA!', 'THWIP!', null

  // Web State
  const [webOrigin, setWebOrigin] = useState({ x: 200, y: 40 });
  const [webSlack, setWebSlack] = useState(0);

  // Logo Cat Avatar State
  const [catPos, setCatPos] = useState({ x: 450, y: 150 });
  const [catFacing, setCatFacing] = useState(-1);
  const [catAction, setCatAction] = useState('WALK'); // 'WALK', 'CROUCH', 'POUNCE', 'SWAT', 'PROUD'
  const [catSwatFx, setCatSwatFx] = useState(false);
  const [catTailAngle, setCatTailAngle] = useState(0);

  const stateRef = useRef({
    // Spider physics & state
    spiderPhase: 'RAPPEL', // 'RAPPEL', 'ON_BOX', 'LEAPING', 'FLEE'
    sx: 200,
    sy: 40,
    svx: 0,
    svy: 0,
    sFacing: 1,
    sFrame: 0,
    sFrameTimer: 0,
    sPatrolDir: 1,
    sReactTimer: 0,

    // Cat physics & state
    catPhase: 'PATROL', // 'PATROL', 'STALK', 'POUNCE', 'SWAT', 'PAUSE'
    cx: 480,
    cy: 150,
    cvx: 0,
    cvy: 0,
    cFacing: -1,
    cStateTimer: 0,
    cWalkCycle: 0,
    cTailWiggle: 0,

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
      // Cat begins on step 2/3 of the blue box
      stateRef.current.cx = initGeom.boxWidth * 0.58;
      stateRef.current.cy = getGroundY(initGeom.boxWidth * 0.58, initGeom);
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
      } else if (s.spiderPhase === 'ON_BOX' || s.spiderPhase === 'LEAPING' || s.spiderPhase === 'FLEE') {
        const currentFloor = getGroundY(s.sx, geom);

        if (s.spiderPhase === 'ON_BOX') {
          const speed = 46;
          s.svx = s.sPatrolDir * speed;
          s.sFacing = s.sPatrolDir;

          s.sFrameTimer += dt;
          if (s.sFrameTimer > 0.12) {
            s.sFrameTimer = 0;
            s.sFrame = (s.sFrame + 1) % 4;
          }

          // Step elevation detection
          const lookAheadX = s.sx + s.sPatrolDir * 26;
          const floorAhead = getGroundY(lookAheadX, geom);

          if (floorAhead < currentFloor - 20) {
            s.spiderPhase = 'LEAPING';
            s.svy = -180;
            s.svx = s.sPatrolDir * 75;
          } else if (floorAhead > currentFloor + 20) {
            s.spiderPhase = 'LEAPING';
            s.svy = -40;
            s.svx = s.sPatrolDir * 55;
          }

          // Boundary bounce
          if (s.sx > geom.boxWidth * 0.88 && s.sPatrolDir === 1) {
            s.sPatrolDir = -1;
          } else if (s.sx < geom.boxWidth * 0.06 && s.sPatrolDir === -1) {
            s.sPatrolDir = 1;
          }
        }

        s.sx += s.svx * dt;

        if (s.spiderPhase === 'LEAPING' || s.spiderPhase === 'FLEE') {
          s.svy += 500 * dt; // gravity
          s.sy += s.svy * dt;

          const landFloor = getGroundY(s.sx, geom);
          if (s.sy >= landFloor - 6 && s.svy > 0) {
            s.sy = landFloor - 6;
            s.svy = 0;
            s.spiderPhase = 'ON_BOX';
          }
        } else {
          s.sy = currentFloor - 6;
        }
      }

      // =============================================================
      // 2. SHADOWLENS LOGO CAT AVATAR AI & ATTACK LOGIC
      // =============================================================
      s.cStateTimer += dt;
      const catFloor = getGroundY(s.cx, geom);
      const distToSpider = Math.hypot(s.sx - s.cx, s.sy - s.cy);
      const spiderIsOnBox = s.spiderPhase !== 'RAPPEL';

      // Tail swish / wiggle animation
      s.cTailWiggle = Math.sin(s.time * (s.catPhase === 'STALK' ? 16 : 4)) * (s.catPhase === 'STALK' ? 18 : 8);

      if (s.catPhase === 'PATROL') {
        setCatAction('WALK');
        setCatSwatFx(false);

        // If spider is on the box, begin stalking!
        if (spiderIsOnBox && distToSpider < 350) {
          s.catPhase = 'STALK';
          s.cStateTimer = 0;
        } else {
          // Patrol calmly along the box
          s.cvx = s.cFacing * 42;
          s.cWalkCycle += dt * 8;

          // Leap up / down steps
          const catLookX = s.cx + s.cFacing * 28;
          const catFloorAhead = getGroundY(catLookX, geom);
          if (catFloorAhead < catFloor - 20) {
            s.cvy = -170;
            s.cvx = s.cFacing * 70;
          } else if (catFloorAhead > catFloor + 20) {
            s.cvy = -40;
            s.cvx = s.cFacing * 50;
          }

          if (s.cx > geom.boxWidth * 0.92) s.cFacing = -1;
          if (s.cx < geom.boxWidth * 0.12) s.cFacing = 1;
        }
      } else if (s.catPhase === 'STALK') {
        // Face the spider
        s.cFacing = s.sx > s.cx ? 1 : -1;

        // If close enough: crouch, wiggle tail, and prepare to pounce!
        if (distToSpider < 100) {
          setCatAction('CROUCH');
          s.cvx *= 0.6;

          // After crouching for ~0.8s: LAUNCH POUNCE!
          if (s.cStateTimer > 0.8) {
            s.catPhase = 'POUNCE';
            s.cStateTimer = 0;
            s.cvy = -160; // pounce leap
            s.cvx = s.cFacing * 160;
            setCatAction('POUNCE');
          }
        } else {
          // Creep closer stealthily
          setCatAction('WALK');
          s.cvx = s.cFacing * 55;
          s.cWalkCycle += dt * 6;
        }
      } else if (s.catPhase === 'POUNCE') {
        setCatAction('POUNCE');
        s.cvy += 460 * dt; // gravity

        // Check if cat reached spider distance for SWAT!
        if (distToSpider < 38) {
          s.catPhase = 'SWAT';
          s.cStateTimer = 0;
          setCatAction('SWAT');
          setCatSwatFx(true);

          // SPIDER GETS ATTACKED!
          s.spiderPhase = 'FLEE';
          s.svy = -190; // Spidey leaps up backwards in surprise!
          s.svx = -s.cFacing * 110;
          s.sPatrolDir = -s.cFacing;
          s.sFacing = s.cFacing; // Spidey looks at cat in shock
          setSpiderReaction(Math.random() > 0.5 ? 'WHOA!' : 'THWIP!');
          s.sReactTimer = 2.0;
        }

        // Land on ground
        if (s.cy >= catFloor && s.cvy > 0) {
          s.cy = catFloor;
          s.cvy = 0;
          s.catPhase = 'PROUD';
          s.cStateTimer = 0;
          setCatAction('PROUD');
        }
      } else if (s.catPhase === 'SWAT') {
        if (s.cStateTimer > 0.45) {
          s.catPhase = 'PROUD';
          s.cStateTimer = 0;
          setCatAction('PROUD');
          setCatSwatFx(false);
        }
      } else if (s.catPhase === 'PROUD') {
        setCatAction('PROUD');
        s.cvx *= 0.8;
        // Pause proudly for ~1.5 seconds, then resume patrol/stalking
        if (s.cStateTimer > 1.6) {
          s.catPhase = 'PATROL';
          s.cStateTimer = 0;
          s.cFacing = -s.cFacing; // turn around
        }
      }

      // Apply cat movement
      s.cx += s.cvx * dt;
      if (s.catPhase === 'POUNCE' || s.cvy < 0) {
        s.cvy += 460 * dt;
        s.cy += s.cvy * dt;
        if (s.cy >= catFloor && s.cvy > 0) {
          s.cy = catFloor;
          s.cvy = 0;
        }
      } else {
        s.cy = catFloor;
      }

      // Update state for render
      setSpiderPos({ x: Math.round(s.sx), y: Math.round(s.sy) });
      setSpiderFacing(s.sFacing);
      setCrawlFrame(s.sFrame);
      setIsHanging(s.spiderPhase === 'RAPPEL');
      setWebOrigin({ x: Math.round(s.webX), y: Math.round(s.webY) });
      setWebSlack(Math.sin(s.time * 2) * 4);

      setCatPos({ x: Math.round(s.cx), y: Math.round(s.cy) });
      setCatFacing(s.cFacing);
      setCatTailAngle(s.cTailWiggle);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [sectionRef, textAnchorRef, boxRef]);

  // Click interaction: commands cat to pounce!
  const handleCatInteract = () => {
    const s = stateRef.current;
    s.catPhase = 'POUNCE';
    s.cStateTimer = 0;
    s.cvy = -180;
    s.cvx = s.cFacing * 160;
    setCatAction('POUNCE');
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
  // SPIDEY SPRITE (Horizontal Crawl or Inverted Hang)
  // -----------------------------------------------------------------
  const renderBoxCrawler = () => {
    const stepA = crawlFrame === 0 || crawlFrame === 2 ? 1 : -1;
    const stepB = crawlFrame === 1 || crawlFrame === 3 ? 1 : -1;

    return (
      <g transform={`scale(${spiderFacing}, 1)`}>
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

        {/* Torso */}
        <Pixel x={-6} y={-3} w={3} h={4} color="#0047FF" />
        <Pixel x={-3} y={-4} w={5} h={5} color="#EF4444" />
        <Pixel x={-1} y={-3} w={2} h={3} color="#0F172A" />
        <Pixel x={2} y={-3} w={2} h={4} color="#0047FF" />

        {/* Mask */}
        <Pixel x={4} y={-4} w={4} h={5} color="#EF4444" />
        <Pixel x={5} y={-3} w={3} h={3} color="#DC2626" />
        {/* White Eye */}
        <Pixel x={5} y={-3} color="#000000" />
        <Pixel x={6} y={-3} w={2} h={2} color="#FFFFFF" />
        <Pixel x={8} y={-2} color="#000000" />

        {/* Front Legs */}
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
  // SHADOWLENS LOGO CAT AVATAR
  // Features the iconic shadowlens mascot logo head with animated body,
  // paws, swishing tail, and combat swat claws!
  // -----------------------------------------------------------------
  const renderLogoCat = () => {
    const isCrouching = catAction === 'CROUCH';
    const isPouncing = catAction === 'POUNCE' || catAction === 'SWAT';
    const isProud = catAction === 'PROUD';

    return (
      <g transform={`scale(${catFacing}, 1)`} className="cursor-pointer">
        {/* Animated Sinuous Tail */}
        <path
          d={`M -14 -12 Q -22 ${-18 + catTailAngle * 0.4} ${-24 + catTailAngle * 0.3} ${-28 + catTailAngle}`}
          stroke="#E2E8F0"
          strokeWidth="3.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Rear Legs / Paws */}
        <ellipse
          cx="-11"
          cy={isCrouching ? "-3" : isPouncing ? "-8" : "-4"}
          rx="5.5"
          ry={isCrouching ? "4" : "7"}
          fill="#1E2533"
        />
        <circle cx="-11" cy="-1" r="3.2" fill="#FFFFFF" />

        {/* Cat Sleek Body (White & Dark Slate Coat) */}
        <ellipse
          cx="-3"
          cy={isCrouching ? "-8" : isPouncing ? "-12" : "-10"}
          rx={isPouncing ? "15" : "13"}
          ry={isCrouching ? "7" : "9"}
          fill="#F8FAFC"
          stroke="#1E2533"
          strokeWidth="1.2"
        />

        {/* Front Legs / Paws */}
        <ellipse
          cx={isPouncing ? "8" : "4"}
          cy={isCrouching ? "-3" : isPouncing ? "-10" : "-4"}
          rx="4.8"
          ry={isCrouching ? "4" : "6.5"}
          fill="#1E2533"
        />
        {/* Swatting Paw Extension */}
        <circle
          cx={catAction === 'SWAT' ? "18" : isPouncing ? "12" : "5"}
          cy={catAction === 'SWAT' ? "-15" : "-1"}
          r={catAction === 'SWAT' ? "4.2" : "3.4"}
          fill="#FFFFFF"
          stroke="#00F0FF"
          strokeWidth={catAction === 'SWAT' ? "1.5" : "0"}
        />

        {/* OFFICIAL SHADOWLENS MASCOT LOGO (Cat Face Avatar) */}
        <g transform={`translate(${isPouncing ? "6" : "2"}, ${isCrouching ? "-16" : isPouncing ? "-22" : "-19"})`}>
          <image
            href="/shadowlens-logo.png"
            x="-16"
            y="-16"
            width="32"
            height="32"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>

        {/* SWAT IMPACT SLASH FX */}
        {catSwatFx && (
          <g transform="translate(22, -18)">
            {/* Energy claw slash lines */}
            <path
              d="M -4 -8 L 12 -2 M -6 -2 L 14 4 M -4 4 L 10 10"
              stroke="#00F0FF"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Impact star */}
            <polygon
              points="14,-2 18,2 22,-2 18,-6"
              fill="#FFFFFF"
            />
            {/* Comic SWAT Text */}
            <text
              x="18"
              y="-12"
              fill="#00F0FF"
              fontSize="9"
              fontWeight="900"
              fontFamily="monospace"
              stroke="#080A0F"
              strokeWidth="0.6"
            >
              *SWAT!*
            </text>
          </g>
        )}

        {/* Proud / Purring Mood Emoji */}
        {isProud && (
          <g transform="translate(0, -32)" className="animate-bounce">
            <text
              x="0"
              y="0"
              fontSize="12"
              textAnchor="middle"
            >
              😼✨
            </text>
          </g>
        )}
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

        {/* 2. SPIDEY ACTOR */}
        <g
          transform={`translate(${spiderPos.x}, ${spiderPos.y})`}
          className="pointer-events-auto cursor-pointer"
          title="Spidey on the blue box!"
        >
          {isHanging ? renderHangingSpider() : renderBoxCrawler()}

          {/* Spider Reaction Comic Bubble when attacked */}
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

        {/* 3. SHADOWLENS LOGO CAT AVATAR */}
        <g
          transform={`translate(${catPos.x}, ${catPos.y})`}
          className="pointer-events-auto cursor-pointer"
          onClick={handleCatInteract}
          title="ShadowLens Logo Cat! Click to make it pounce!"
        >
          {renderLogoCat()}
        </g>
      </svg>
    </div>
  );
}
