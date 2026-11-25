import React, { useEffect, useRef, useState } from 'react';

/**
 * HeroStaircaseShooter:
 * Interactive cyber-defender & virus spider descent animation overlay.
 *
 * 1. Spider Cyber-Viruses rappel down on glowing silk threads directly from the headline text.
 * 2. Cyber-Defender hero traverses the 90-degree blue stepped dither staircase:
 *    - Running, leaping across platform elevations (Step 1 -> Step 2 -> Step 3).
 *    - Dynamic aim tracking towards descending threats.
 *    - High-velocity laser / plasma pulse bursts with muzzle flashes.
 * 3. Particle bursts & floating retro combat HUD badges upon threat neutralization.
 * 4. Autonomous AI patrol + user interactive targeting (click to manual shoot / spawn).
 */
export default function HeroStaircaseShooter({ staircaseRef, containerRef }) {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    // Dimensions
    let width = (canvas.width = containerRef.current.clientWidth);
    let height = (canvas.height = containerRef.current.clientHeight);

    // Audio synthesizer for retro arcade laser & blast fx (Web Audio API - polite & low volume)
    let audioCtx = null;
    const playLaserSound = () => {
      if (isMuted) return;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      } catch {
        // AudioContext restricted before gesture
      }
    };

    const playExplosionSound = () => {
      if (isMuted) return;
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
      } catch {
        // AudioContext restricted
      }
    };

    // Calculate ground profile from staircase element
    const getPlatformGeometry = () => {
      if (!staircaseRef.current || !containerRef.current) {
        return { top: height * 0.45, h: height * 0.55 };
      }
      const cRect = containerRef.current.getBoundingClientRect();
      const sRect = staircaseRef.current.getBoundingClientRect();
      return {
        top: Math.max(0, sRect.top - cRect.top),
        h: sRect.height || 420,
      };
    };

    // Step heights matching GnosisSteppedDither clipPath:
    // polygon(0% 38%, 42% 38%, 42% 22%, 63% 22%, 63% 6%, 94% 6%, 94% 13%, 100% 13%, 100% 100%, 0% 100%)
    const getGroundY = (x, geom) => {
      const u = Math.max(0, Math.min(1, x / width));
      let stepRatio;
      if (u < 0.42) {
        stepRatio = 0.38; // Platform 1
      } else if (u < 0.63) {
        stepRatio = 0.22; // Platform 2
      } else if (u < 0.94) {
        stepRatio = 0.06; // Platform 3 (Highest)
      } else {
        stepRatio = 0.13; // Shelf 4
      }
      return geom.top + geom.h * stepRatio;
    };

    // Window resize handler
    const handleResize = () => {
      if (!containerRef.current || !canvas) return;
      width = canvas.width = containerRef.current.clientWidth;
      height = canvas.height = containerRef.current.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Initial platform geometry
    let geom = getPlatformGeometry();

    // -------------------------------------------------------------
    // GAME STATE & ACTORS
    // -------------------------------------------------------------
    const hero = {
      x: width * 0.18,
      y: getGroundY(width * 0.18, geom),
      vx: 0,
      vy: 0,
      width: 26,
      height: 38,
      isGrounded: true,
      facing: 1, // 1: right, -1: left
      aimAngle: -Math.PI / 4,
      targetPlatform: 1,
      patrolTimer: 0,
      recoil: 0,
      muzzleFlash: 0,
      shootCooldown: 0,
      runCycle: 0,
      thrusterSparkTimer: 0,
      heroState: 'patrol', // 'patrol', 'aiming', 'jumping'
    };

    const spiders = [];
    const projectiles = [];
    const particles = [];
    const floatingBadges = [];

    const badgeTexts = [
      'THREAT NEUTRALIZED +100',
      '0-DAY DEFUSED',
      'MALWARE PURGED',
      'EXPLOIT SHIELDED',
      'TROJAN ISOLATED',
      'PHISH QUARANTINED',
    ];

    // Spawn spider virus hanging from text
    const spawnSpider = (customX = null) => {
      const spawnX =
        customX !== null
          ? customX
          : width * (0.08 + Math.random() * 0.82);
      
      const groundAtX = getGroundY(spawnX, geom);
      // Hang down between 25% and 65% of the distance from text to the platform
      const textOriginY = Math.min(65, height * 0.12);
      const targetHangY = textOriginY + 50 + Math.random() * Math.max(40, groundAtX - textOriginY - 90);

      spiders.push({
        id: Math.random(),
        x: spawnX,
        y: textOriginY,
        originY: textOriginY,
        targetY: targetHangY,
        speed: 1.8 + Math.random() * 1.5,
        webLength: 0,
        size: 18 + Math.random() * 8,
        health: 1,
        hitFlash: 0,
        legPhase: Math.random() * Math.PI * 2,
        twitch: 0,
        swaySpeed: 1.2 + Math.random() * 1.4,
        swayAmp: 12 + Math.random() * 15,
        state: 'descending', // 'descending', 'lurking', 'hit'
      });
    };

    // Pre-populate with 3 spiders descending
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        if (canvas) spawnSpider();
      }, i * 600);
    }

    // Auto spider spawner loop
    let lastSpawnTime = Date.now();
    const spawnInterval = 2800; // spawn every ~2.8s

    // Manual click handler for firing towards mouse
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Aim hero towards click
      const gunOriginX = hero.x + (hero.facing === 1 ? 14 : -14);
      const gunOriginY = hero.y - 20;
      const angle = Math.atan2(clickY - gunOriginY, clickX - gunOriginX);
      hero.aimAngle = angle;
      hero.facing = clickX > hero.x ? 1 : -1;

      // Fire burst!
      fireLaser(gunOriginX, gunOriginY, angle);

      // Also spawn a spider if clicking up top in the text area
      if (clickY < 100) {
        spawnSpider(clickX);
      }
    };
    canvas.addEventListener('click', handleClick);

    const fireLaser = (fromX, fromY, angle) => {
      const speed = 19;
      projectiles.push({
        x: fromX,
        y: fromY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        prevX: fromX,
        prevY: fromY,
        life: 0,
        maxLife: 60,
      });

      hero.recoil = 6;
      hero.muzzleFlash = 5;
      playLaserSound();

      // Muzzle sparks
      for (let i = 0; i < 5; i++) {
        const spread = (Math.random() - 0.5) * 0.6;
        const sparkSpeed = 3 + Math.random() * 4;
        particles.push({
          x: fromX,
          y: fromY,
          vx: Math.cos(angle + spread) * sparkSpeed,
          vy: Math.sin(angle + spread) * sparkSpeed,
          life: 1,
          decay: 0.1 + Math.random() * 0.1,
          color: '#00F0FF',
          size: 2.5,
        });
      }
    };

    // -------------------------------------------------------------
    // MAIN ANIMATION LOOP
    // -------------------------------------------------------------
    let lastTime = performance.now();

    const loop = (time) => {
      const dt = Math.min(32, time - lastTime) / 1000;
      lastTime = time;

      geom = getPlatformGeometry();

      // Clear transparent overlay
      ctx.clearRect(0, 0, width, height);

      // Periodically spawn new spiders
      if (Date.now() - lastSpawnTime > spawnInterval && spiders.length < 5) {
        spawnSpider();
        lastSpawnTime = Date.now();
      }

      // -----------------------------------------------------------
      // UPDATE & DRAW SPIDERS
      // -----------------------------------------------------------
      for (let i = spiders.length - 1; i >= 0; i--) {
        const s = spiders[i];

        if (s.state === 'descending') {
          s.y += s.speed;
          if (s.y >= s.targetY) {
            s.y = s.targetY;
            s.state = 'lurking';
          }
        }

        s.legPhase += 0.08;
        s.twitch = Math.sin(time * 0.005 + s.id * 10) * 0.3;

        // Pendulum subtle sway
        const sway = Math.sin(time * 0.002 * s.swaySpeed + s.id) * s.swayAmp;
        const currentX = s.x + sway;

        // Draw glowing silk thread from text top down to spider
        ctx.beginPath();
        ctx.moveTo(s.x, s.originY);
        // Slight curve in thread
        ctx.quadraticCurveTo(s.x + sway * 0.3, (s.originY + s.y) * 0.5, currentX, s.y);
        ctx.strokeStyle = s.hitFlash > 0 ? '#FFFFFF' : 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Thread neon glow aura
        ctx.beginPath();
        ctx.moveTo(s.x, s.originY);
        ctx.quadraticCurveTo(s.x + sway * 0.3, (s.originY + s.y) * 0.5, currentX, s.y);
        ctx.strokeStyle = 'rgba(0, 71, 255, 0.2)';
        ctx.lineWidth = 4;
        ctx.stroke();

        // Save context for spider drawing
        ctx.save();
        ctx.translate(currentX, s.y);

        // Flash white on hit
        if (s.hitFlash > 0) {
          s.hitFlash--;
        }

        // Draw Spider Legs (8 cyber articulated mechanical legs)
        const legCount = 8;
        const radius = s.size * 0.5;

        for (let legIdx = 0; legIdx < legCount; legIdx++) {
          const side = legIdx < 4 ? -1 : 1;
          const legRank = legIdx % 4;
          const baseAngle = (legRank - 1.5) * 0.32;
          const motion = Math.sin(s.legPhase + legRank * 0.9) * 0.25;

          const kneeX = side * (radius + 8 + legRank * 2) + Math.cos(baseAngle + motion) * 6;
          const kneeY = -8 + legRank * 5 + Math.sin(baseAngle + motion) * 4;

          const footX = side * (radius + 16 + legRank * 4);
          const footY = 8 + legRank * 3 + motion * 8;

          ctx.beginPath();
          ctx.moveTo(0, (legRank - 1.5) * 3);
          ctx.lineTo(kneeX, kneeY);
          ctx.lineTo(footX, footY);
          ctx.strokeStyle = s.hitFlash > 0 ? '#FFFFFF' : '#FF0055';
          ctx.lineWidth = 1.8;
          ctx.lineCap = 'round';
          ctx.stroke();

          // Joint node
          ctx.fillStyle = s.hitFlash > 0 ? '#FFF' : '#00F0FF';
          ctx.fillRect(kneeX - 1.5, kneeY - 1.5, 3, 3);
        }

        // Spider Abdomen / Bio-Cyber Core
        const coreGradient = ctx.createRadialGradient(0, 0, 2, 0, 0, radius);
        if (s.hitFlash > 0) {
          coreGradient.addColorStop(0, '#FFFFFF');
          coreGradient.addColorStop(1, '#00F0FF');
        } else {
          coreGradient.addColorStop(0, '#FFFFFF');
          coreGradient.addColorStop(0.3, '#FF0055');
          coreGradient.addColorStop(0.8, '#990022');
          coreGradient.addColorStop(1, '#1A0008');
        }

        // Outer glow pulse
        ctx.shadowColor = '#FF0055';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.9, radius * 1.1, 0, 0, Math.PI * 2);
        ctx.fillStyle = coreGradient;
        ctx.fill();
        ctx.strokeStyle = '#FF3366';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.shadowBlur = 0; // reset shadow

        // Spider Glowing Optic Eyes (3 pairs of blinking red cyber sensors)
        const eyeCount = 3;
        for (let e = 0; e < eyeCount; e++) {
          const eyeY = 2 + e * 3;
          ctx.fillStyle = '#00F0FF';
          ctx.fillRect(-3 - e, eyeY, 2, 2);
          ctx.fillRect(1 + e, eyeY, 2, 2);
        }

        // Malicious Code Sigil / Glitch crosshair in center
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-2, -2, 4, 4);

        ctx.restore();

        // Check if spider is destroyed
        if (s.health <= 0) {
          playExplosionSound();

          // Spawn explosion particles
          for (let p = 0; p < 24; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            particles.push({
              x: currentX,
              y: s.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 1.5,
              life: 1,
              decay: 0.03 + Math.random() * 0.03,
              color: Math.random() > 0.4 ? '#FF0055' : '#00F0FF',
              size: 2 + Math.random() * 4,
            });
          }

          // Spawn floating combat badge
          const text = badgeTexts[Math.floor(Math.random() * badgeTexts.length)];
          floatingBadges.push({
            x: currentX,
            y: s.y - 12,
            text,
            life: 1,
            color: '#00F0FF',
          });

          setScore((prev) => prev + 100);
          spiders.splice(i, 1);
        }
      }

      // -----------------------------------------------------------
      // HERO AI & MOVEMENT LOGIC
      // -----------------------------------------------------------
      hero.patrolTimer += dt;
      hero.recoil = Math.max(0, hero.recoil - 0.4);
      hero.muzzleFlash = Math.max(0, hero.muzzleFlash - 1);
      hero.shootCooldown = Math.max(0, hero.shootCooldown - dt);

      // Locate nearest alive spider
      let nearestSpider = null;
      let minDistance = 999999;
      for (const s of spiders) {
        const d = Math.hypot(s.x - hero.x, s.y - hero.y);
        if (d < minDistance) {
          minDistance = d;
          nearestSpider = s;
        }
      }

      // Target selection & aiming
      if (nearestSpider) {
        const targetX = nearestSpider.x;
        const targetY = nearestSpider.y;
        const gunX = hero.x + (hero.facing === 1 ? 14 : -14);
        const gunY = hero.y - 20;

        hero.aimAngle = Math.atan2(targetY - gunY, targetX - gunX);
        hero.facing = targetX > hero.x ? 1 : -1;

        // Auto-shoot when aimed in range and ready
        if (hero.shootCooldown <= 0 && minDistance < 650) {
          fireLaser(gunX, gunY, hero.aimAngle);
          hero.shootCooldown = 0.32 + Math.random() * 0.2; // rapid bursts
        }

        // Move towards optimal firing platform
        if (hero.isGrounded) {
          const desiredX = Math.max(width * 0.08, Math.min(width * 0.90, targetX));
          const distToDesired = desiredX - hero.x;

          if (Math.abs(distToDesired) > 60) {
            hero.vx = Math.sign(distToDesired) * 2.8;
            hero.runCycle += 0.22;
          } else {
            hero.vx *= 0.8;
          }
        }
      } else {
        // Idle patrol across platforms
        if (hero.isGrounded) {
          if (hero.patrolTimer > 3.0) {
            hero.targetPlatform = ((hero.targetPlatform % 3) + 1);
            hero.patrolTimer = 0;
          }

          let patrolTargetX = width * 0.2;
          if (hero.targetPlatform === 2) patrolTargetX = width * 0.52;
          if (hero.targetPlatform === 3) patrolTargetX = width * 0.78;

          const diff = patrolTargetX - hero.x;
          if (Math.abs(diff) > 20) {
            hero.vx = Math.sign(diff) * 2.2;
            hero.facing = Math.sign(diff);
            hero.runCycle += 0.18;
          } else {
            hero.vx *= 0.8;
          }
        }
      }

      // Dynamic Jump Physics across Stepped Ledges
      const groundAtCurrent = getGroundY(hero.x, geom);
      const groundAhead = getGroundY(hero.x + hero.facing * 35, geom);

      // If approaching an upward step (groundAhead is HIGHER up in screen, i.e. smaller Y)
      if (hero.isGrounded && groundAhead < groundAtCurrent - 25) {
        // Initiate hero jump impulse!
        hero.vy = -10.5;
        hero.isGrounded = false;
        hero.vx = hero.facing * 3.6;

        // Jump launch booster particles
        for (let j = 0; j < 8; j++) {
          particles.push({
            x: hero.x + (Math.random() - 0.5) * 12,
            y: hero.y,
            vx: (Math.random() - 0.5) * 3,
            vy: 2 + Math.random() * 4,
            life: 1,
            decay: 0.08,
            color: '#00F0FF',
            size: 3,
          });
        }
      }

      // Apply horizontal velocity
      hero.x += hero.vx;
      hero.x = Math.max(width * 0.04, Math.min(width * 0.96, hero.x));

      // Gravity & Vertical Physics
      if (!hero.isGrounded) {
        hero.vy += 0.52; // gravity
        hero.y += hero.vy;

        // Thruster sparks during jump
        if (hero.vy < 0) {
          particles.push({
            x: hero.x + (Math.random() - 0.5) * 8,
            y: hero.y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: 1.5 + Math.random() * 2,
            life: 0.6,
            decay: 0.15,
            color: '#38BDF8',
            size: 2,
          });
        }

        const currentFloor = getGroundY(hero.x, geom);
        if (hero.y >= currentFloor && hero.vy > 0) {
          hero.y = currentFloor;
          hero.vy = 0;
          hero.isGrounded = true;

          // Landing dust sparks
          for (let l = 0; l < 6; l++) {
            particles.push({
              x: hero.x + (Math.random() - 0.5) * 16,
              y: hero.y,
              vx: (Math.random() - 0.5) * 4,
              vy: -1 - Math.random() * 2,
              life: 0.7,
              decay: 0.1,
              color: '#0047FF',
              size: 2.5,
            });
          }
        }
      } else {
        // Stick to floor smoothly
        const floorY = getGroundY(hero.x, geom);
        // If walked off a high ledge to a lower ledge:
        if (floorY > hero.y + 15) {
          hero.isGrounded = false;
          hero.vy = 1;
        } else {
          hero.y = floorY;
        }
      }

      // -----------------------------------------------------------
      // DRAW HERO (Futuristic Vector Cyber-Guardian)
      // -----------------------------------------------------------
      ctx.save();
      ctx.translate(hero.x, hero.y);

      // Hero scale & orientation
      const facing = hero.facing;
      const legAnim = Math.sin(hero.runCycle) * 7;

      // 1. Cyber Scarf / Cape (Energy Trail)
      ctx.beginPath();
      const capeWave = Math.sin(time * 0.008) * 4;
      ctx.moveTo(-facing * 4, -26);
      ctx.quadraticCurveTo(-facing * 18 + capeWave, -20, -facing * 26 + capeWave * 1.5, -12);
      ctx.lineTo(-facing * 20 + capeWave, -8);
      ctx.quadraticCurveTo(-facing * 12, -18, -facing * 2, -22);
      ctx.fillStyle = 'rgba(0, 71, 255, 0.85)';
      ctx.fill();
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2. Legs / Boots
      if (!hero.isGrounded) {
        // Jumping / in-air tucked legs with booster flames
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-6, -14, 5, 12);
        ctx.fillRect(2, -16, 5, 14);

        // Cyan boots
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(-8, -3, 8, 4);
        ctx.fillRect(1, -3, 8, 4);

        // Thruster flame glows
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.ellipse(-4, 4, 3, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(5, 4, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Running or standing stride
        // Back leg
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-4 - facing * legAnim * 0.4, -14, 4, 12);
        ctx.fillStyle = '#0047FF';
        ctx.fillRect(-6 - facing * legAnim * 0.4, -3, 7, 4);

        // Front leg
        ctx.fillStyle = '#1E293B';
        ctx.fillRect(2 + facing * legAnim * 0.4, -14, 4, 12);
        ctx.fillStyle = '#00F0FF';
        ctx.fillRect(1 + facing * legAnim * 0.4, -3, 7, 4);
      }

      // 3. Torso / Cyber Armor
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-6, -26, 12, 14);

      // Armor plating
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-5, -25, 10, 10);

      // Arc Reactor / Cyber Core Glow
      ctx.fillStyle = '#00F0FF';
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 8;
      ctx.fillRect(-2, -22, 4, 4);
      ctx.shadowBlur = 0;

      // 4. Helmet & Visor
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, -31, 7, 0, Math.PI * 2);
      ctx.fill();

      // Helmet cyan crest
      ctx.fillStyle = '#0047FF';
      ctx.fillRect(-2, -38, 4, 3);

      // Glowing Neon Visor
      ctx.fillStyle = '#00F0FF';
      ctx.shadowColor = '#00F0FF';
      ctx.shadowBlur = 10;
      if (facing === 1) {
        ctx.fillRect(0, -32, 7, 3);
      } else {
        ctx.fillRect(-7, -32, 7, 3);
      }
      ctx.shadowBlur = 0;

      // 5. Energy Rifle / Railgun (Rotating with aimAngle)
      ctx.save();
      ctx.translate(facing * 4, -20);
      const weaponAngle = facing === 1 ? hero.aimAngle : hero.aimAngle - Math.PI;
      ctx.rotate(weaponAngle);

      // Recoil kickback
      ctx.translate(-hero.recoil, 0);

      // Rifle stock & chassis
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-4, -3, 18, 6);

      // High-tech barrel & neon power conduits
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(10, -2, 10, 4);

      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(2, -1, 14, 2);

      // Muzzle flash when firing
      if (hero.muzzleFlash > 0) {
        ctx.shadowColor = '#FFFFFF';
        ctx.shadowBlur = 16;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(22, 0, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00F0FF';
        ctx.beginPath();
        ctx.arc(22, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore(); // restore weapon angle

      ctx.restore(); // restore hero transform

      // -----------------------------------------------------------
      // UPDATE & DRAW PROJECTILES (Plasma Laser Bolts)
      // -----------------------------------------------------------
      for (let pIdx = projectiles.length - 1; pIdx >= 0; pIdx--) {
        const p = projectiles[pIdx];
        p.prevX = p.x;
        p.prevY = p.y;
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        // Draw laser bolt with neon trail
        ctx.save();
        ctx.shadowColor = '#00F0FF';
        ctx.shadowBlur = 10;

        // Outer cyan glow beam
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Inner hot white laser core
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        // Check collision with spiders
        let collided = false;
        for (const s of spiders) {
          const sway = Math.sin(time * 0.002 * s.swaySpeed + s.id) * s.swayAmp;
          const currentSpiderX = s.x + sway;
          const distToSpider = Math.hypot(p.x - currentSpiderX, p.y - s.y);

          if (distToSpider < s.size * 0.8 + 6) {
            s.health -= 1;
            s.hitFlash = 4;
            collided = true;
            break;
          }
        }

        // Out of bounds or hit
        if (
          collided ||
          p.x < 0 ||
          p.x > width ||
          p.y < 0 ||
          p.y > height ||
          p.life > p.maxLife
        ) {
          // Impact sparks
          for (let sp = 0; sp < 4; sp++) {
            particles.push({
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              life: 0.6,
              decay: 0.1,
              color: '#00F0FF',
              size: 2,
            });
          }
          projectiles.splice(pIdx, 1);
        }
      }

      // -----------------------------------------------------------
      // UPDATE & DRAW PARTICLES (Cyber Shards & Glows)
      // -----------------------------------------------------------
      for (let ptIdx = particles.length - 1; ptIdx >= 0; ptIdx--) {
        const pt = particles[ptIdx];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= pt.decay;

        if (pt.life <= 0) {
          particles.splice(ptIdx, 1);
          continue;
        }

        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.life;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        ctx.globalAlpha = 1.0;
      }

      // -----------------------------------------------------------
      // UPDATE & DRAW FLOATING BADGES (Combat Text)
      // -----------------------------------------------------------
      for (let bIdx = floatingBadges.length - 1; bIdx >= 0; bIdx--) {
        const b = floatingBadges[bIdx];
        b.y -= 0.8;
        b.life -= 0.016;

        if (b.life <= 0) {
          floatingBadges.splice(bIdx, 1);
          continue;
        }

        ctx.save();
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.globalAlpha = b.life;

        // Shadow backing
        ctx.fillStyle = '#080A0F';
        ctx.fillText(b.text, b.x + 1, b.y + 1);

        // Neon cyan text
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 6;
        ctx.fillText(b.text, b.x, b.y);
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('click', handleClick);
    };
  }, [containerRef, staircaseRef, isMuted]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto z-20 cursor-crosshair"
        title="Cyber Defense Active: Spiders descending from threat vector. Click anywhere to manual shoot!"
      />

      {/* Retro Arcade Threat Neutralization HUD */}
      <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-30 pointer-events-auto flex items-center gap-2.5 bg-[#080A0F]/85 backdrop-blur-md border border-[#0047FF]/40 rounded-lg px-3 py-1.5 shadow-lg shadow-[#0047FF]/10 text-xs font-mono select-none">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F0FF] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00F0FF]"></span>
        </span>
        <span className="text-[#94A3B8] hidden sm:inline">CYBER DEFENDER:</span>
        <span className="text-white font-bold tracking-wider">
          <span className="text-[#00F0FF]">{score}</span> XP
        </span>

        {/* Audio Toggle button */}
        <button
          type="button"
          onClick={() => setIsMuted((prev) => !prev)}
          className="ml-1 p-1 hover:text-[#00F0FF] text-[#94A3B8] transition-colors rounded"
          title={isMuted ? 'Unmute 8-bit laser SFX' : 'Mute SFX'}
        >
          {isMuted ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-[#00F0FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
      </div>
    </>
  );
}
