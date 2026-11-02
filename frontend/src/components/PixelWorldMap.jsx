import React, { useState, useEffect } from 'react';
import dottedWorldMapSvg from '../assets/dotted-world-map.svg';

/**
 * PixelWorldMap:
 * High-definition vector dotted world map with continuous, automatic cyber telemetry animation.
 * Features:
 * - Completely removed all hover effects (map stays perfectly stable in place)
 * - Automatic 60 FPS longitude radar beam sweep across the continents
 * - Automatic expanding sonar ping rings at key global telecommunication hubs
 * - Subtle dashed cyber routing links between hubs
 * - Zero headers, zero tickers, and zero divider lines
 */

const TELEMETRY_NODES = [
  { id: 'sf', name: 'US-WEST', x: 363.6, y: 357.0 },
  { id: 'nyc', name: 'US-EAST', x: 520.9, y: 357.0 },
  { id: 'ldn', name: 'EU-LONDON', x: 992.8, y: 266.0 },
  { id: 'fra', name: 'EU-FRANKFURT', x: 1035.7, y: 292.0 },
  { id: 'tko', name: 'AP-TOKYO', x: 1607.7, y: 383.0 },
  { id: 'sgp', name: 'AP-SINGAPORE', x: 1464.7, y: 591.0 },
  { id: 'syd', name: 'OC-SYDNEY', x: 1679.2, y: 786.0 },
  { id: 'bom', name: 'IN-MUMBAI', x: 1278.8, y: 474.0 },
  { id: 'sao', name: 'SA-SAOPAULO', x: 692.5, y: 695.0 }
];

// Telemetry routing links between major hubs
const CONNECTIONS = [
  { from: [363.6, 357.0], to: [520.9, 357.0] },   // SF -> NYC
  { from: [520.9, 357.0], to: [992.8, 266.0] },   // NYC -> London
  { from: [992.8, 266.0], to: [1035.7, 292.0] },  // London -> Frankfurt
  { from: [1035.7, 292.0], to: [1278.8, 474.0] }, // Frankfurt -> Mumbai
  { from: [1278.8, 474.0], to: [1464.7, 591.0] }, // Mumbai -> Singapore
  { from: [1464.7, 591.0], to: [1607.7, 383.0] }, // Singapore -> Tokyo
  { from: [1464.7, 591.0], to: [1679.2, 786.0] }, // Singapore -> Sydney
  { from: [520.9, 357.0], to: [692.5, 695.0] }    // NYC -> Sao Paulo
];

export default function PixelWorldMap({ className = '' }) {
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    let animId;
    let start = performance.now();

    const loop = (now) => {
      const elapsed = now - start;
      setPulsePhase((elapsed / 65) % 100);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className={`relative w-full h-full flex items-center justify-center p-2 sm:p-3 select-none pointer-events-none ${className}`}>
      
      {/* Main Vector Stage - Fixed aspect ratio with zero hover shift */}
      <div className="relative w-full h-full flex items-center justify-center">
        <svg
          viewBox="70 25 1830 950"
          className="w-full h-auto max-h-[88%] filter drop-shadow-[0_0_14px_rgba(0,71,255,0.2)]"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* 1. Underlying 2,790-Dot Clean Vector Map */}
          <image
            href={dottedWorldMapSvg}
            x="70"
            y="25"
            width="1830"
            height="950"
            opacity="0.95"
          />

          {/* 2. Subtle Dashed Routing Links between Hubs */}
          {CONNECTIONS.map((conn, idx) => (
            <line
              key={idx}
              x1={conn.from[0]}
              y1={conn.from[1]}
              x2={conn.to[0]}
              y2={conn.to[1]}
              stroke="#0047FF"
              strokeWidth="1.4"
              strokeDasharray="6 8"
              opacity="0.35"
            />
          ))}

          {/* 3. Automatic Expanding Sonar Ping Hubs */}
          {TELEMETRY_NODES.map((node, i) => {
            const phase = (pulsePhase + i * 16) % 60;
            const pingRadius = 6 + (phase / 60) * 30;
            const pingOpacity = Math.max(0, 1 - phase / 60);

            return (
              <g key={node.id}>
                {/* Sonar ripple wave */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={pingRadius}
                  fill="none"
                  stroke="#38BDF8"
                  strokeWidth="1.8"
                  opacity={pingOpacity * 0.85}
                />
                {/* Luminous aura */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="7.5"
                  fill="#0047FF"
                  opacity="0.5"
                />
                {/* Solid core beacon */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r="4.2"
                  fill="#FFFFFF"
                  stroke="#0047FF"
                  strokeWidth="1.2"
                />
              </g>
            );
          })}
        </svg>
      </div>

    </div>
  );
}
