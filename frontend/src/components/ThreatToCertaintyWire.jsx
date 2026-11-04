import React, { useState } from 'react';

/**
 * ThreatToCertaintyWire:
 * Curated editorial process artwork replacing the old telemetry strip & 3D silicone loop.
 * Inspired by the iconic non-linear design journey scribble ("Idea -> [Chaos/Tangle] -> Product"):
 * - Frameless & borderless (floats seamlessly on the page's dark background).
 * - Left: "Threat" origin node (the raw, deceptive adversarial signal).
 * - Middle: Tangled, non-linear exploratory scribble wire knotted with curated evidential badges:
 *   [Homoglyph], [Cloaked Redir], [QR Matrix], [Obfuscation], [Heuristics], 
 *   [Dirichlet Prior], [Entropy Loss], [Uncertainty (u)], [Evidential Loss], [Consensus].
 * - Right: Untangles into a clean, decisive line docking into the large "Verdict" pill.
 * - Bottom: Elegant editorial caption "Converting adversarial deception into mathematical certainty".
 */
export default function ThreatToCertaintyWire({ className = '' }) {
  const [hoveredBadgeId, setHoveredBadgeId] = useState(null);

  // The 10 curated cybersecurity & evidential deep learning badges
  const badges = [
    { id: 'homoglyph', label: 'Homoglyph', x: 235, y: 170, w: 110, h: 38 },
    { id: 'heuristics', label: 'Heuristics', x: 205, y: 300, w: 104, h: 38 },
    { id: 'redir', label: 'Cloaked Redir', x: 335, y: 95, w: 124, h: 38 },
    { id: 'obfuscation', label: 'Obfuscation', x: 470, y: 65, w: 116, h: 38 },
    { id: 'qrmatrix', label: 'QR Matrix', x: 360, y: 195, w: 102, h: 38 },
    { id: 'dirichlet', label: 'Dirichlet Prior', x: 385, y: 285, w: 126, h: 38 },
    { id: 'entropy', label: 'Entropy Loss', x: 345, y: 385, w: 116, h: 38 },
    { id: 'edl', label: 'Evidential Loss', x: 535, y: 175, w: 124, h: 38 },
    { id: 'uncertainty', label: 'Uncertainty (u)', x: 485, y: 340, w: 132, h: 38 },
    { id: 'consensus', label: 'Consensus', x: 650, y: 220, w: 106, h: 38 },
  ];

  // Intricate, organic multi-loop scribble wire closely matching the reference tangle
  // Starts at Threat (180, 240) -> dense coils & knots -> straightens through Consensus -> Verdict (890, 240)
  const wirePath = `
    M 180 240 
    C 215 240, 235 248, 240 285
    C 248 335, 205 385, 255 385
    C 300 385, 310 325, 305 255
    C 300 175, 335 115, 390 115
    C 445 115, 425 210, 375 255
    C 325 300, 335 395, 405 395
    C 455 395, 440 330, 410 270
    C 380 210, 400 150, 445 150
    C 485 150, 475 230, 440 285
    C 410 335, 435 390, 485 390
    C 545 390, 520 280, 485 210
    C 450 140, 500 78, 550 78
    C 595 78, 575 160, 535 220
    C 490 285, 480 375, 545 395
    C 605 410, 620 325, 605 245
    C 590 160, 670 135, 685 210
    C 700 285, 640 335, 690 345
    C 740 355, 720 230, 770 238
    C 795 240, 830 240, 890 240
  `;

  return (
    <div className={`relative w-full max-w-6xl mx-auto my-4 sm:my-8 select-none ${className}`}>
      
      {/* =========================================================================
          SVG PROCESS WIRE ENGINE (Frameless, floats directly on page background)
          ========================================================================= */}
      <div className="w-full relative aspect-[2.3/1] min-h-[280px] sm:min-h-[360px] md:min-h-[420px] overflow-visible">
        <svg
          viewBox="0 0 1100 480"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full overflow-visible"
        >
          <defs>
            {/* Electric Wire Glow Filter */}
            <filter id="wireGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="glow" />
              <feComposite in="SourceGraphic" in2="glow" operator="over" />
            </filter>

            {/* Pill Drop Shadow */}
            <filter id="wirePillShadow" x="-30%" y="-30%" width="160%" height="170%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.85" />
            </filter>
          </defs>

          {/* ---------------------------------------------------------------------
              THE TANGLED PROCESS WIRE (Continuous White Scribble Stroke)
              --------------------------------------------------------------------- */}
          {/* Background wire depth shadow */}
          <path
            d={wirePath}
            stroke="#000000"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.9"
          />

          {/* Main Crisp White Wire (Identical to reference illustration) */}
          <path
            d={wirePath}
            stroke="#FFFFFF"
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.95"
          />

          {/* Traveling Laser Pulse (Continuous cybersecurity telemetry animation) */}
          <path
            d={wirePath}
            stroke="#00E5FF"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="40 460"
            fill="none"
            filter="url(#wireGlow)"
            style={{
              strokeDashoffset: '0',
              animation: 'wireTravel 8s linear infinite'
            }}
          />

          {/* ---------------------------------------------------------------------
              INTERACTIVE WIRE PILL BADGES (Positioned over loop intersections)
              --------------------------------------------------------------------- */}
          {badges.map((badge) => {
            const isHovered = hoveredBadgeId === badge.id;
            return (
              <g
                key={badge.id}
                transform={`translate(${badge.x}, ${badge.y})`}
                className="cursor-pointer transition-transform duration-200"
                onMouseEnter={() => setHoveredBadgeId(badge.id)}
                onMouseLeave={() => setHoveredBadgeId(null)}
              >
                {/* Badge Capsule */}
                <rect
                  x="0"
                  y="0"
                  width={badge.w}
                  height={badge.h}
                  rx="19"
                  ry="19"
                  fill={isHovered ? '#101726' : '#080A0F'}
                  stroke={isHovered ? '#38BDF8' : '#FFFFFF'}
                  strokeWidth={isHovered ? '2' : '1.75'}
                  filter="url(#wirePillShadow)"
                  className="transition-all duration-200"
                />
                
                {/* Badge Label */}
                <text
                  x={badge.w / 2}
                  y={badge.h / 2 + 5}
                  textAnchor="middle"
                  fontFamily="'Plus Jakarta Sans', -apple-system, sans-serif"
                  fontSize="14"
                  fontWeight="700"
                  fill={isHovered ? '#38BDF8' : '#FFFFFF'}
                  letterSpacing="-0.01em"
                  className="transition-colors duration-200 pointer-events-none select-none"
                >
                  {badge.label}
                </text>
              </g>
            );
          })}

          {/* ---------------------------------------------------------------------
              LEFT ORIGIN CARD: "Threat" (Matching bold white card in reference)
              --------------------------------------------------------------------- */}
          <g filter="url(#wirePillShadow)" className="cursor-default">
            {/* White Squircle Container */}
            <rect
              x="35"
              y="195"
              width="145"
              height="90"
              rx="16"
              ry="16"
              fill="#FFFFFF"
            />
            
            {/* Bold Black "Threat" Typography */}
            <text
              x="107"
              y="253"
              textAnchor="middle"
              fontFamily="'Plus Jakarta Sans', -apple-system, sans-serif"
              fontSize="38"
              fontWeight="800"
              fill="#000000"
              letterSpacing="-0.03em"
            >
              Threat
            </text>
          </g>

          {/* ---------------------------------------------------------------------
              RIGHT DESTINATION PILL: "Verdict" (Matching large capsule in reference)
              --------------------------------------------------------------------- */}
          <g filter="url(#wirePillShadow)" className="cursor-default">
            {/* Large White Pill Container */}
            <rect
              x="890"
              y="185"
              width="180"
              height="110"
              rx="55"
              ry="55"
              fill="#FFFFFF"
            />
            
            {/* Bold Black "Verdict" Typography */}
            <text
              x="980"
              y="254"
              textAnchor="middle"
              fontFamily="'Plus Jakarta Sans', -apple-system, sans-serif"
              fontSize="40"
              fontWeight="800"
              fill="#000000"
              letterSpacing="-0.03em"
            >
              Verdict
            </text>
          </g>

        </svg>
      </div>

      {/* =========================================================================
          EDITORIAL CAPTION (Faithfully matching caption below reference illustration)
          ========================================================================= */}
      <div className="mt-4 sm:mt-6 text-center px-4">
        <p className="text-lg sm:text-2xl md:text-[26px] font-medium tracking-tight text-white/90">
          Converting adversarial deception into mathematical certainty
        </p>
        <p className="mt-1.5 text-xs sm:text-sm font-normal text-white/50 tracking-normal max-w-xl mx-auto">
          PhishShield resolves deceptive URLs, poisoned QR matrices, and header anomalies through evidential consensus.
        </p>
      </div>

      {/* Embedded CSS for smooth infinite pulse along wire */}
      <style>{`
        @keyframes wireTravel {
          from {
            stroke-dashoffset: 1000;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>

    </div>
  );
}
