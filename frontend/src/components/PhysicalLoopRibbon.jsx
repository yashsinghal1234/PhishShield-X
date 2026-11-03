import React from 'react';

/**
 * PhysicalLoopRibbon:
 * Authentic recreation of the 27flows horizontal telemetry blue strip & 3D silicone loop:
 * 1. Full-bleed 100vw electric blue strip spanning edge-to-edge across the screen.
 * 2. 100% complete continuous 3D silicone loop:
 *    - Layer 1 (z-0): Complete closed 3D ellipse loop. The top arches 68px into clear air above the strip.
 *    - Layer 2 (z-10): Full-bleed electric blue telemetry strip covering the back strand.
 *    - Layer 3 (z-20): Front strand looping in front of the blue strip with realistic drop shadow.
 *    - Text: Centered, upright, crisp monospace text along the front band.
 */
export default function PhysicalLoopRibbon({ className = '' }) {
  const streamLines = [
    '[SYS.01 // URL_LEXICAL_EDL]         DIRICHLET DENSITY α_k         UNCERTAINTY u < 0.041         ZERO-DAY ISOLATION: ACTIVE         [SYS.01 // URL_LEXICAL_EDL]         DIRICHLET DENSITY α_k         UNCERTAINTY u < 0.041         ZERO-DAY ISOLATION: ACTIVE',
    '[SYS.02 // PYRAMID_VISION_VIT]      QUISHING MATRIX 12-PT         MICRO-DOT RECOVERY            CONSENSUS: 99.2% VALID            [SYS.02 // PYRAMID_VISION_VIT]      QUISHING MATRIX 12-PT         MICRO-DOT RECOVERY            CONSENSUS: 99.2% VALID',
    '[SYS.03 // EMAIL_HEADER_PARSER]     SPF / DKIM / DMARC            DECEPTION DETECTOR            AUTH_SCORE: NOMINAL               [SYS.03 // EMAIL_HEADER_PARSER]     SPF / DKIM / DMARC            DECEPTION DETECTOR            AUTH_SCORE: NOMINAL',
    '[SYS.04 // EVIDENTIAL_SYNAPSE]      CROSS-VECTOR FUSION           INFERENCE LATENCY: 28ms       TELEMETRY: ONLINE                 [SYS.04 // EVIDENTIAL_SYNAPSE]      CROSS-VECTOR FUSION           INFERENCE LATENCY: 28ms       TELEMETRY: ONLINE'
  ];

  return (
    <div className={`relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] select-none py-4 sm:py-6 overflow-x-hidden ${className}`}>
      
      {/* =========================================================================
          THE FULL-BLEED STRIP & 3D CONTINUOUS LOOP CONTAINER
          Spans 100vw from the extreme left border to the extreme right border
          ========================================================================= */}
      <div className="relative w-full h-[280px] sm:h-[320px] md:h-[350px] flex items-center justify-center my-1 overflow-visible">

        {/* =========================================================================
            LAYER 1 (z-0): The COMPLETE Closed 3D Silicone Loop
            Renders the entire continuous ellipse loop.
            The upper half arches high into the dark air above the strip (y < 120).
            The lower half loops down into the dark air below the strip (y > 230).
            ========================================================================= */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <svg
            width="900"
            height="350"
            viewBox="0 0 900 350"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full max-w-[390px] sm:max-w-[700px] md:max-w-[900px] h-full overflow-visible"
          >
            <defs>
              {/* Unified 3D matte white silicone gradient */}
              <linearGradient id="ringSiliconeMatte" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="30%" stopColor="#F8FAFC" />
                <stop offset="65%" stopColor="#E2E8F0" />
                <stop offset="100%" stopColor="#CBD5E1" />
              </linearGradient>
            </defs>

            {/* Complete continuous closed ellipse centered at (450, 175), tilted -36 degrees */}
            <g transform="translate(450, 175) rotate(-36)">
              {/* Main silicone band */}
              <ellipse cx="0" cy="0" rx="160" ry="68" stroke="url(#ringSiliconeMatte)" strokeWidth="28" fill="none" />
              {/* Outer specular rim highlight */}
              <ellipse cx="0" cy="0" rx="175" ry="74" stroke="#FFFFFF" strokeWidth="2.5" fill="none" opacity="0.95" />
              {/* Inner shadow crease */}
              <ellipse cx="0" cy="0" rx="145" ry="62" stroke="#94A3B8" strokeWidth="2" fill="none" opacity="0.4" />
            </g>
          </svg>
        </div>

        {/* =========================================================================
            LAYER 2 (z-10): The Electric Blue Full-Bleed Strip (Edge-to-Edge 100vw)
            Passes ON TOP of Layer 1 (occluding the back strand between y=120 and y=230).
            ========================================================================= */}
        <div className="relative z-10 w-full bg-[#0047FF] text-white py-4 sm:py-5 shadow-xl shadow-[#0047FF]/25 overflow-hidden">
          {/* Subtle dot matrix texture */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[radial-gradient(circle_at_center,_#ffffff_1px,_transparent_1px)] bg-[size:12px_12px]" />

          {/* 4 airy, curated monospace telemetry lines */}
          <div className="w-full font-mono text-[10.5px] sm:text-[11.5px] md:text-[12.5px] font-semibold tracking-wider sm:tracking-widest leading-[1.42] whitespace-nowrap overflow-hidden flex flex-col justify-center px-4">
            {streamLines.map((line, idx) => (
              <div key={idx} className="w-full flex items-center justify-start overflow-hidden opacity-95">
                <span className="shrink-0">{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* =========================================================================
            LAYER 3 (z-20): The Front Strand (Loops IN FRONT of the blue strip)
            Runs along the front lower arc (positive y) with soft drop shadow.
            Text is centered, upright, and clearly legible along the white band.
            ========================================================================= */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <svg
            width="900"
            height="350"
            viewBox="0 0 900 350"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            xmlnsXlink="http://www.w3.org/1999/xlink"
            className="w-full max-w-[390px] sm:max-w-[700px] md:max-w-[900px] h-full overflow-visible"
          >
            <defs>
              {/* Soft drop shadow cast onto the blue strip and text beneath */}
              <filter id="loopFrontShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="-3" dy="12" stdDeviation="7" floodColor="#000000" floodOpacity="0.55" />
              </filter>

              {/* Front text path along the lower arc from (-160, 0) to (160, 0) through positive y */}
              <path
                id="frontArcTextPath"
                d="M -160 0 A 160 68 0 0 0 160 0"
                fill="none"
                stroke="none"
              />
            </defs>

            {/* Front arc passing in front of the blue banner with drop-shadow */}
            <g transform="translate(450, 175) rotate(-36)">
              <g filter="url(#loopFrontShadow)">
                {/* Main silicone band (front half) */}
                <path
                  d="M -160 0 A 160 68 0 0 0 160 0"
                  stroke="url(#ringSiliconeMatte)"
                  strokeWidth="28"
                  fill="none"
                />
                {/* Outer specular rim */}
                <path
                  d="M -175 0 A 175 74 0 0 0 175 0"
                  stroke="#FFFFFF"
                  strokeWidth="2.5"
                  fill="none"
                  opacity="0.95"
                />
                {/* Inner crease */}
                <path
                  d="M -145 0 A 145 62 0 0 0 145 0"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  fill="none"
                  opacity="0.45"
                />
              </g>

              {/* Front text centered and upright on the front silicone band */}
              <text
                fill="#0A0D14"
                fontSize="8"
                fontFamily="'Space Mono', monospace"
                fontWeight="700"
                letterSpacing="0.14em"
                dominantBaseline="central"
              >
                <textPath
                  href="#frontArcTextPath"
                  xlinkHref="#frontArcTextPath"
                  startOffset="50%"
                  textAnchor="middle"
                >
                  * PHISHSHIELD // THREAT INTELLIGENCE *
                </textPath>
              </text>
            </g>
          </svg>
        </div>

      </div>

    </div>
  );
}
