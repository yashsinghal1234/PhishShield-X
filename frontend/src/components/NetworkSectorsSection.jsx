import React, { useState, useEffect } from 'react';

/**
 * NetworkSectorsSection:
 * Editorial dual-card radar telemetry system recreating the reference visual:
 * - Card 1 (Left): "One network, defending diverse sectors" + dark polar radar grid with colored square nodes (- Banking, - SaaS, - Healthcare, etc.)
 * - Card 2 (Right): Top-right radiating threat hub + targeting bracket nodes ([ 0-DAY ], [ ViT-16 ], [ SPF/DKIM ], etc.) + "Enterprise Real-Time Evidential Phishing Defense Infrastructure"
 */

// Card 1 nodes
const SECTOR_NODES = [
  { id: 'bank', name: '- Banking', x: 120, y: 380, color: '#38BDF8', size: 12 },
  { id: 'agent', name: '- Agent', x: 160, y: 440, color: '#FFFFFF', size: 14 },
  { id: 'multi', name: '- Multifinance', x: 155, y: 320, color: '#22C55E', size: 13 },
  { id: 'left_edge', name: '', x: 60, y: 290, color: '#FFFFFF', size: 12 },
  { id: 'left_corner', name: '', x: 60, y: 220, color: '#FFFFFF', size: 10 },
  { id: 'mid_blue1', name: '', x: 130, y: 200, color: '#0047FF', size: 12 },
  { id: 'mid_blue2', name: '', x: 190, y: 220, color: '#38BDF8', size: 14 },
  { id: 'mid_blue3', name: '', x: 195, y: 260, color: '#38BDF8', size: 12 },
  { id: 'ewallet', name: '- E-Commerce', x: 215, y: 295, color: '#FFFFFF', size: 13 },
  { id: 'telco', name: '- Cloud / SaaS', x: 210, y: 360, color: '#0047FF', size: 12 },
  { id: 'hub_green1', name: '', x: 270, y: 175, color: '#22C55E', size: 14 },
  { id: 'hub_green2', name: '', x: 275, y: 235, color: '#22C55E', size: 13 },
  { id: 'infra', name: '- Critical Infra', x: 290, y: 335, color: '#38BDF8', size: 12 },
  { id: 'bottom_green', name: '', x: 285, y: 415, color: '#22C55E', size: 15 },
  { id: 'bottom_cyan', name: '', x: 240, y: 460, color: '#38BDF8', size: 12 },
  { id: 'top_white', name: '', x: 335, y: 180, color: '#FFFFFF', size: 14 },
  { id: 'mid_white', name: '', x: 340, y: 240, color: '#FFFFFF', size: 12 },
  { id: 'gateway', name: '- API Gateway', x: 345, y: 435, color: '#FFFFFF', size: 14 },
  { id: 'supply', name: '- Supply Chain', x: 360, y: 300, color: '#0047FF', size: 12 },
  { id: 'edge_right', name: '', x: 395, y: 410, color: '#FFFFFF', size: 10 },
];

const SECTOR_EDGES = [
  ['left_corner', 'left_edge'],
  ['left_edge', 'agent'],
  ['agent', 'bank'],
  ['bank', 'bottom_cyan'],
  ['bottom_cyan', 'bottom_green'],
  ['bottom_green', 'gateway'],
  ['gateway', 'edge_right'],
  ['left_edge', 'multi'],
  ['multi', 'mid_blue3'],
  ['left_corner', 'mid_blue1'],
  ['mid_blue1', 'mid_blue2'],
  ['mid_blue2', 'mid_blue3'],
  ['mid_blue3', 'ewallet'],
  ['ewallet', 'telco'],
  ['telco', 'bottom_green'],
  ['mid_blue2', 'hub_green1'],
  ['hub_green1', 'top_white'],
  ['top_white', 'mid_white'],
  ['hub_green1', 'hub_green2'],
  ['hub_green2', 'infra'],
  ['infra', 'bottom_green'],
  ['mid_white', 'supply'],
  ['top_white', 'edge_right'],
];

// Card 2 Radar Rays & Target Nodes
const RADAR_TARGETS = [
  { id: 't1', code: '0-DAY', label: 'u < 0.041', x: 120, y: 110, color: '#22C55E' },
  { id: 't2', code: 'ViT-16', label: '99.8% CONF', x: 80, y: 190, color: '#22C55E' },
  { id: 't3', code: 'EDL', label: '24ms LATENCY', x: 120, y: 240, color: '#22C55E' },
  { id: 't4', code: 'SYNAPSE', label: 'FUSION-ACTIVE', x: 180, y: 285, color: '#FFFFFF' },
  { id: 't5', code: 'DNS-SEC', label: 'AUTH-VERIFIED', x: 140, y: 330, color: '#FFFFFF' },
  { id: 't6', code: 'SPF/DKIM', label: 'PASS 100%', x: 235, y: 165, color: '#FFFFFF' },
  { id: 't7', code: 'TOKEN', label: 'DENSITY α_k', x: 240, y: 220, color: '#22C55E' },
  { id: 't8', code: 'QUISH', label: 'OPTICAL CLEAR', x: 300, y: 300, color: '#22C55E' },
  { id: 't9', code: 'ISOLATE', label: 'ENCLAVE', x: 290, y: 135, color: '#0047FF' },
  { id: 't10', code: 'NLP-VEC', label: 'COSINE 0.99', x: 340, y: 175, color: '#0047FF' },
];

export default function NetworkSectorsSection() {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulse((p) => (p + 1) % 60);
    }, 90);
    return () => clearInterval(timer);
  }, []);

  // Ray origin at top right of Card 2
  const originX = 420;
  const originY = 25;

  return (
    <section className="relative w-full my-12 font-['Plus_Jakarta_Sans'] select-none">
      
      {/* Background ambient radiance */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#0047FF]/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        
        {/* =========================================================================
            CARD 1 (LEFT): "One network, defending diverse sectors"
            ========================================================================= */}
        <div className="rounded-[28px] bg-[#0A0D14] border border-[#1A1E29] p-7 sm:p-9 text-white flex flex-col justify-between min-h-[500px] sm:min-h-[540px] md:min-h-[580px] shadow-xl relative overflow-hidden group">
          
          {/* Top Title */}
          <div className="relative z-10">
            <h3 className="font-['Pixelify_Sans'] text-3xl sm:text-4xl md:text-[40px] font-bold text-white tracking-tight leading-[1.12]">
              One network, <span className="text-[#22C55E]">defending</span><br />
              diverse sectors
            </h3>
          </div>

          {/* SVG Radar Polar Grid & Sector Constellation */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg
              viewBox="0 0 500 520"
              className="w-full h-full object-cover"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Connecting Mesh Vectors */}
              {SECTOR_EDGES.map(([startId, endId], i) => {
                const n1 = SECTOR_NODES.find((n) => n.id === startId);
                const n2 = SECTOR_NODES.find((n) => n.id === endId);
                if (!n1 || !n2) return null;

                return (
                  <line
                    key={i}
                    x1={n1.x}
                    y1={n1.y}
                    x2={n2.x}
                    y2={n2.y}
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth="1.2"
                  />
                );
              })}

              {/* Constellation Square Nodes */}
              {SECTOR_NODES.map((node) => {
                const half = node.size / 2;
                return (
                  <g key={node.id}>
                    {/* Square Node */}
                    <rect
                      x={node.x - half}
                      y={node.y - half}
                      width={node.size}
                      height={node.size}
                      fill={node.color}
                      className="transition-transform duration-200"
                      style={{
                        filter: `drop-shadow(0 0 6px ${node.color}80)`,
                      }}
                    />

                    {/* Monospace Label */}
                    {node.name && (
                      <text
                        x={node.x + half + 6}
                        y={node.y + 4}
                        fill="rgba(255,255,255,0.78)"
                        fontFamily="'Silkscreen', monospace"
                        fontSize="9.5"
                        letterSpacing="0.08em"
                      >
                        {node.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Bottom Telemetry Chip */}
          <div className="relative z-10 flex items-center justify-between text-[10px] font-['Silkscreen'] tracking-[0.14em] uppercase text-white/50 pt-2 border-t border-white/[0.08]">
            <span className="text-[#22C55E]">● CONSTELLATION MESH: ONLINE</span>
            <span className="text-white/40">7 SECTOR CLUSTERS</span>
          </div>

        </div>

        {/* =========================================================================
            CARD 2 (RIGHT): "Enterprise Real-Time Evidential Defense Infrastructure"
            ========================================================================= */}
        <div className="rounded-[28px] bg-[#0A0D14] border border-[#1A1E29] p-7 sm:p-9 text-white flex flex-col justify-between min-h-[500px] sm:min-h-[540px] md:min-h-[580px] shadow-xl relative overflow-hidden group">
          
          {/* Top Ray Emitter Badge */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-[10px] font-['Silkscreen'] tracking-[0.16em] uppercase text-[#38BDF8]">
              ● RADAR SYNAPSE // HUB.01
            </span>
            <div className="px-2.5 py-1 rounded bg-[#0047FF] text-white font-['Silkscreen'] text-[10.5px] font-bold tracking-wider">
              DEF
            </div>
          </div>

          {/* SVG Radiating Radar Field */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg
              viewBox="0 0 500 520"
              className="w-full h-full object-cover"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Radiating Laser Lines from Origin to Targets */}
              {RADAR_TARGETS.map((t) => (
                <line
                  key={`ray-${t.id}`}
                  x1={originX}
                  y1={originY}
                  x2={t.x}
                  y2={t.y}
                  stroke="rgba(56,189,248,0.3)"
                  strokeWidth="1.2"
                />
              ))}

              {/* Hub Emitter Glow */}
              <circle cx={originX} cy={originY} r="16" fill="rgba(0,71,255,0.4)" />
              <circle cx={originX} cy={originY} r="6" fill="#38BDF8" />

              {/* Target Reticle Nodes */}
              {RADAR_TARGETS.map((t, idx) => {
                const boxW = 44;
                const boxH = 26;
                const isGreen = t.color === '#22C55E';
                const isBlue = t.color === '#0047FF';

                return (
                  <g key={t.id}>
                    {/* Targeting Corner Brackets */}
                    <path
                      d={`M ${t.x - boxW/2 - 3} ${t.y - boxH/2 + 4} L ${t.x - boxW/2 - 3} ${t.y - boxH/2 - 3} L ${t.x - boxW/2 + 4} ${t.y - boxH/2 - 3}`}
                      fill="none"
                      stroke={t.color}
                      strokeWidth="1.2"
                    />
                    <path
                      d={`M ${t.x + boxW/2 + 3} ${t.y - boxH/2 + 4} L ${t.x + boxW/2 + 3} ${t.y - boxH/2 - 3} L ${t.x + boxW/2 - 4} ${t.y - boxH/2 - 3}`}
                      fill="none"
                      stroke={t.color}
                      strokeWidth="1.2"
                    />
                    <path
                      d={`M ${t.x - boxW/2 - 3} ${t.y + boxH/2 - 4} L ${t.x - boxW/2 - 3} ${t.y + boxH/2 + 3} L ${t.x - boxW/2 + 4} ${t.y + boxH/2 + 3}`}
                      fill="none"
                      stroke={t.color}
                      strokeWidth="1.2"
                    />
                    <path
                      d={`M ${t.x + boxW/2 + 3} ${t.y + boxH/2 - 4} L ${t.x + boxW/2 + 3} ${t.y + boxH/2 + 3} L ${t.x + boxW/2 - 4} ${t.y + boxH/2 + 3}`}
                      fill="none"
                      stroke={t.color}
                      strokeWidth="1.2"
                    />

                    {/* Target Box Body */}
                    <rect
                      x={t.x - boxW/2}
                      y={t.y - boxH/2}
                      width={boxW}
                      height={boxH}
                      fill={isGreen ? '#22C55E' : isBlue ? '#0047FF' : '#151A24'}
                      stroke={isGreen || isBlue ? 'none' : 'rgba(255,255,255,0.3)'}
                      strokeWidth="1"
                      rx="3"
                      style={{
                        filter: isGreen
                          ? 'drop-shadow(0 0 8px rgba(34,197,94,0.4))'
                          : isBlue
                          ? 'drop-shadow(0 0 8px rgba(0,71,255,0.4))'
                          : 'none',
                      }}
                    />

                    {/* Code inside Box */}
                    <text
                      x={t.x}
                      y={t.y + 4}
                      fill={isGreen || isBlue ? '#FFFFFF' : '#F1F5F9'}
                      fontFamily="'Silkscreen', monospace"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {t.code}
                    </text>

                    {/* Micro Metric Label below box */}
                    <text
                      x={t.x}
                      y={t.y + boxH/2 + 11}
                      fill="rgba(255,255,255,0.55)"
                      fontFamily="'Silkscreen', monospace"
                      fontSize="7.5"
                      textAnchor="middle"
                    >
                      {t.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Bottom Title */}
          <div className="relative z-10 pt-4">
            <h3 className="font-['Pixelify_Sans'] text-2xl sm:text-3xl md:text-[34px] font-bold text-white tracking-tight leading-[1.14]">
              Enterprise Real-Time Evidential<br />
              Phishing Defense Infrastructure
            </h3>
            <p className="text-xs sm:text-sm text-white/50 font-normal mt-2">
              Autonomous multimodal sensor mesh covering 100% of attack surfaces
            </p>
          </div>

        </div>

      </div>

    </section>
  );
}

