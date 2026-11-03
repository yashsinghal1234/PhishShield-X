import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * KeyValuesAndPerformanceSection:
 * Exact architectural brutalist recreation of the two-part section from reference image:
 * Part 1: [ N.01/11 ] > KEY VALUE
 *   - Bold slash headline: "/ Less manual work. More intelligent execution. /"
 *   - 3-column feature grid with isometric wireframe icons:
 *       1. Smart Processing (Isometric cylindrical wireframe)
 *       2. Adaptive Workflows (Isometric 3D electric blue voxel staircase)
 *       3. Better Results (Isometric 3D wireframe star)
 * Part 2: [ N.02/11 ] > PERFORMANCE
 *   - Slash headline: "/ Real-time intelligence. Zero unnecessary work. /"
 *   - 2x2 performance metric grid (<120ms, 10x, ~94%, 99.82%)
 *   - High-density dual-zone comparative histogram telemetry bar chart
 */
export default function KeyValuesAndPerformanceSection() {
  const navigate = useNavigate();
  const [sliderPos, setSliderPos] = useState(46); // Percentage threshold for comparator

  const handleGetStarted = () => {
    navigate('/url');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Pre-generate 220 deterministic high-density histogram bar heights
  const totalBars = 220;
  const splitIndex = Math.round(totalBars * 0.46); // ~101
  const barHeights = React.useMemo(() => {
    const bars = [];
    for (let i = 0; i < totalBars; i++) {
      if (i < splitIndex) {
        // Baseline / Without PhishShield (noisy, lower heights: 16% - 46%)
        const wave = Math.sin(i * 0.14) * 10 + Math.cos(i * 0.32) * 8;
        const jitter = ((i * 37) % 17) - 8;
        bars.push(Math.max(14, Math.min(48, Math.round(28 + wave + jitter))));
      } else {
        // With PhishShield (dense, high performance: 62% - 98%)
        const wave = Math.sin((i - splitIndex) * 0.09) * 12 + Math.cos((i - splitIndex) * 0.22) * 10;
        const ramp = ((i - splitIndex) / (totalBars - splitIndex)) * 22;
        const jitter = ((i * 43) % 21) - 10;
        bars.push(Math.max(54, Math.min(98, Math.round(62 + ramp + wave + jitter))));
      }
    }
    return bars;
  }, []);

  return (
    <section className="w-full space-y-16 sm:space-y-24 py-10 sm:py-16 select-none font-['Plus_Jakarta_Sans'] text-[#0A0D14] dark:text-white">
      
      {/* =========================================================================
          BLOCK 1: [ N.01/11 ] > KEY VALUE
          ========================================================================= */}
      <div className="space-y-8 sm:space-y-10">
        
        {/* Top Header Row */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          
          <div className="space-y-3">
            {/* Monospace Kicker */}
            <div className="flex items-center gap-3 text-[11px] font-['Silkscreen'] tracking-[0.16em] uppercase text-[#64748B] dark:text-[#94A3B8]">
              <span className="text-[#0047FF] dark:text-[#38BDF8]">[ N.01/11 ]</span>
              <span>&gt; KEY VALUE</span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">--------------------------------</span>
            </div>

            {/* Editorial Slash Headline */}
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-normal tracking-tight leading-[1.15]">
              <span className="text-[#0047FF] font-light mr-1">/</span>
              <span>Less manual work.</span><br />
              <span>More intelligent execution.</span>
              <span className="text-[#0047FF] font-light ml-1.5">/</span>
            </h2>
          </div>

          {/* Action Button */}
          <div>
            <button
              type="button"
              onClick={handleGetStarted}
              className="inline-flex items-center gap-2.5 px-6 py-3 bg-[#0A0D14] dark:bg-white text-white dark:text-[#0A0D14] font-['Silkscreen'] text-xs font-bold tracking-[0.14em] uppercase transition-all hover:bg-[#0047FF] dark:hover:bg-[#0047FF] dark:hover:text-white cursor-pointer shadow-md"
            >
              <span>■</span>
              <span>GET STARTED</span>
            </button>
          </div>

        </div>

        {/* 3-Column Architecture Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-[#1E2533] border border-slate-200 dark:border-[#1E2533] bg-white dark:bg-[#0A0D14] shadow-sm">
          
          {/* Card 1: Smart Processing */}
          <div className="p-7 sm:p-9 flex flex-col justify-between min-h-[380px] sm:min-h-[420px] group transition-colors hover:bg-slate-50/50 dark:hover:bg-[#0E121B]/50">
            <div>
              {/* Top Row: Icon + Index */}
              <div className="flex items-start justify-between mb-8">
                {/* Isometric 3D Wireframe Torus/Cylinder Icon */}
                <div className="w-16 h-16 relative text-[#0A0D14] dark:text-white">
                  <svg viewBox="0 0 72 72" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.3">
                    <ellipse cx="44" cy="36" rx="20" ry="14" />
                    <ellipse cx="44" cy="46" rx="20" ry="14" />
                    <line x1="24" y1="36" x2="24" y2="46" />
                    <line x1="64" y1="36" x2="64" y2="46" />
                    {/* Outer handle ring arc */}
                    <path d="M 28 28 C 18 30 18 48 28 52" strokeWidth="1.3" />
                    <path d="M 24 24 C 12 28 12 52 24 56" strokeWidth="1.3" />
                  </svg>
                </div>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-600 tracking-wider">
                  // 001
                </span>
              </div>

              {/* Title & Copy */}
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
                Smart Processing
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
                Autonomous lexical decomposition of high-entropy URLs, Punycode homoglyphs, and obfuscated subdomains before DOM execution.
              </p>
            </div>

            {/* Bottom Kicker Tag */}
            <div className="pt-8 border-t border-slate-100 dark:border-[#1E2533]/50">
              <span className="font-['Silkscreen'] text-[10px] tracking-[0.14em] uppercase text-slate-400 dark:text-slate-500">
                LESS WORK, MORE OUTPUT
              </span>
            </div>
          </div>

          {/* Card 2: Adaptive Workflows (Electric Blue Highlight) */}
          <div className="p-7 sm:p-9 flex flex-col justify-between min-h-[380px] sm:min-h-[420px] group transition-colors hover:bg-slate-50/50 dark:hover:bg-[#0E121B]/50">
            <div>
              {/* Top Row: 3D Voxel Isometric Stepped Pyramid Icon + Index */}
              <div className="flex items-start justify-between mb-8">
                {/* Isometric Stepped Blue Voxel Icon */}
                <div className="w-16 h-16 relative">
                  <svg viewBox="0 0 72 72" className="w-full h-full">
                    {/* Stepped isometric voxels in Electric Blue */}
                    <g transform="translate(12, 10)">
                      {/* Base layer */}
                      {Array.from({ length: 4 }).map((_, row) =>
                        Array.from({ length: 5 }).map((_, col) => {
                          const x = (col - row) * 6 + 24;
                          const y = (col + row) * 3.4 + 14;
                          const shade = row % 2 === 0 ? '#0047FF' : '#38BDF8';
                          return (
                            <polygon
                              key={`v-${row}-${col}`}
                              points={`${x},${y} ${x+6},${y-3.4} ${x+12},${y} ${x+6},${y+3.4}`}
                              fill={shade}
                              stroke="#0033CC"
                              strokeWidth="0.5"
                            />
                          );
                        })
                      )}
                      {/* Raised layer */}
                      {Array.from({ length: 3 }).map((_, row) =>
                        Array.from({ length: 3 }).map((_, col) => {
                          const x = (col - row) * 6 + 24;
                          const y = (col + row) * 3.4 + 4;
                          return (
                            <polygon
                              key={`top-${row}-${col}`}
                              points={`${x},${y} ${x+6},${y-3.4} ${x+12},${y} ${x+6},${y+3.4}`}
                              fill="#60A5FA"
                              stroke="#0047FF"
                              strokeWidth="0.5"
                            />
                          );
                        })
                      )}
                    </g>
                  </svg>
                </div>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-600 tracking-wider">
                  // 002
                </span>
              </div>

              {/* Title & Copy */}
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0047FF] dark:text-[#38BDF8] mb-3">
                Adaptive Workflows
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
                Vision-Transformer patch embeddings extract and verify physical QR quishing barcodes dynamically across diverse document payloads.
              </p>
            </div>

            {/* Bottom Kicker Tag */}
            <div className="pt-8 border-t border-slate-100 dark:border-[#1E2533]/50">
              <span className="font-['Silkscreen'] text-[10px] tracking-[0.14em] uppercase text-slate-400 dark:text-slate-500">
                AI HANDLES THE HEAVY LIFTING
              </span>
            </div>
          </div>

          {/* Card 3: Better Results */}
          <div className="p-7 sm:p-9 flex flex-col justify-between min-h-[380px] sm:min-h-[420px] group transition-colors hover:bg-slate-50/50 dark:hover:bg-[#0E121B]/50">
            <div>
              {/* Top Row: 3D Wireframe Star Icon + Index */}
              <div className="flex items-start justify-between mb-8">
                {/* Isometric 3D Wireframe Star */}
                <div className="w-16 h-16 relative text-[#0A0D14] dark:text-white">
                  <svg viewBox="0 0 72 72" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.3">
                    {/* Front 5-point Star */}
                    <polygon points="36,10 42,26 58,26 45,36 50,52 36,42 22,52 27,36 14,26 30,26" />
                    {/* Extruded Depth Star Lines */}
                    <line x1="36" y1="10" x2="42" y2="16" />
                    <line x1="58" y1="26" x2="64" y2="32" />
                    <line x1="50" y1="52" x2="56" y2="58" />
                    <line x1="22" y1="52" x2="28" y2="58" />
                    <line x1="14" y1="26" x2="20" y2="32" />
                  </svg>
                </div>
                <span className="font-mono text-xs text-slate-400 dark:text-slate-600 tracking-wider">
                  // 003
                </span>
              </div>

              {/* Title & Copy */}
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-3">
                Better Results
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-normal leading-relaxed">
                Dirichlet Evidential Deep Learning quantifies epistemic uncertainty, eliminating false positive alerts and blind security decisions.
              </p>
            </div>

            {/* Bottom Kicker Tag */}
            <div className="pt-8 border-t border-slate-100 dark:border-[#1E2533]/50">
              <span className="font-['Silkscreen'] text-[10px] tracking-[0.14em] uppercase text-slate-400 dark:text-slate-500">
                PLUG IN, GET RESULTS
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* =========================================================================
          BLOCK 2: [ N.02/11 ] > PERFORMANCE
          ========================================================================= */}
      <div className="space-y-8 sm:space-y-10 pt-8 sm:pt-12">
        
        {/* Top Header & 2x2 Metric Matrix Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Title & CTA */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-3 text-[11px] font-['Silkscreen'] tracking-[0.16em] uppercase text-[#64748B] dark:text-[#94A3B8]">
              <span className="text-[#0047FF] dark:text-[#38BDF8]">[ N.02/11 ]</span>
              <span>&gt; PERFORMANCE</span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">--------------------------------</span>
            </div>

            <h2 className="text-2xl sm:text-4xl md:text-5xl font-normal tracking-tight leading-[1.15]">
              <span className="text-[#0047FF] font-light mr-1">/</span>
              <span>Real-time intelligence.</span><br />
              <span>Zero unnecessary work.</span>
              <span className="text-[#0047FF] font-light ml-1.5">/</span>
            </h2>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleGetStarted}
                className="inline-flex items-center gap-2.5 px-6 py-3 bg-[#0A0D14] dark:bg-white text-white dark:text-[#0A0D14] font-['Silkscreen'] text-xs font-bold tracking-[0.14em] uppercase transition-all hover:bg-[#0047FF] dark:hover:bg-[#0047FF] dark:hover:text-white cursor-pointer shadow-md"
              >
                <span>■</span>
                <span>GET STARTED</span>
              </button>
            </div>
          </div>

          {/* Right 2x2 Metric Grid */}
          <div className="lg:col-span-5 grid grid-cols-2 divide-x divide-y divide-slate-200 dark:divide-[#1E2533] border border-slate-200 dark:border-[#1E2533] bg-white dark:bg-[#0A0D14]">
            
            {/* Metric 1 */}
            <div className="p-5 sm:p-6 flex flex-col justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono">
                &lt; 120ms
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                Inference Latency
              </span>
            </div>

            {/* Metric 2 */}
            <div className="p-5 sm:p-6 flex flex-col justify-center border-t-0">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono">
                10x
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                Faster Execution
              </span>
            </div>

            {/* Metric 3 */}
            <div className="p-5 sm:p-6 flex flex-col justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono">
                ~ 94%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                False Positive Drop
              </span>
            </div>

            {/* Metric 4 */}
            <div className="p-5 sm:p-6 flex flex-col justify-center">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight font-mono text-[#0047FF] dark:text-[#38BDF8]">
                99.82%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                Output Consistency
              </span>
            </div>

          </div>

        </div>

        {/* =========================================================================
            HIGH DENSITY TELEMETRY HISTOGRAM BAR CHART
            ========================================================================= */}
        <div className="border border-slate-200 dark:border-[#1E2533] bg-white dark:bg-[#07090E] p-6 sm:p-8 pt-8 sm:pt-10 relative overflow-hidden shadow-sm">
          
          {/* Subtle dotted grid texture in background */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(circle_at_center,_#0047FF_1px,_transparent_1px)] bg-[size:12px_12px]" />

          {/* Histogram Bar Display Container with Y-Axis Guidelines */}
          <div className="relative w-full h-[180px] sm:h-[220px] flex items-end justify-between gap-[1px] sm:gap-[2px]">
            
            {/* Background Y-Axis Horizontal Guide Reference Lines */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-30 text-[9px] font-mono text-slate-400 dark:text-slate-600">
              <div className="border-b border-dashed border-slate-300 dark:border-slate-800 w-full flex justify-end pr-1">
                <span>100% Certainty</span>
              </div>
              <div className="border-b border-dashed border-slate-300 dark:border-slate-800 w-full flex justify-end pr-1">
                <span>50% Threshold (u &gt; 0.35)</span>
              </div>
              <div className="border-b border-slate-300 dark:border-slate-800 w-full flex justify-end pr-1">
                <span>0% Blind Baseline</span>
              </div>
            </div>

            {/* The 220 Individual Telemetry Bars */}
            {barHeights.map((h, idx) => {
              const isPhishShield = idx >= splitIndex;
              return (
                <div
                  key={`bar-${idx}`}
                  className="flex-1 flex items-end h-full group/bar relative z-10"
                >
                  <div
                    style={{ height: `${h}%` }}
                    className={`w-full transition-all duration-300 ${
                      isPhishShield
                        ? 'bg-[#0047FF] hover:bg-[#38BDF8]'
                        : 'bg-slate-200 dark:bg-slate-800/80 hover:bg-slate-300'
                    }`}
                  />
                </div>
              );
            })}

            {/* Central Dividing Slider Pin & Badge */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none flex flex-col items-center z-20"
              style={{ left: `${sliderPos}%` }}
            >
              {/* Vertical Laser Divider Line */}
              <div className="w-[1.5px] h-full bg-[#0047FF] shadow-[0_0_8px_#0047FF]" />

              {/* The Floating Center Badge Tag */}
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center bg-white dark:bg-[#0A0D14] border border-[#0047FF] text-[#0A0D14] dark:text-white rounded-md shadow-xl text-[8px] sm:text-[10px] font-['Silkscreen'] tracking-wider uppercase px-1.5 sm:px-2 py-0.5 sm:py-1 gap-1.5 sm:gap-2 whitespace-nowrap">
                <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">WITHOUT &lt;</span>
                <span className="text-slate-400 dark:text-slate-500 inline sm:hidden">&lt;</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#0047FF] animate-pulse" />
                <span className="text-[#0047FF] dark:text-[#38BDF8] hidden sm:inline">&gt; WITH PHISHSHIELD</span>
                <span className="text-[#0047FF] dark:text-[#38BDF8] inline sm:hidden">&gt; WITH</span>
              </div>
            </div>

          </div>

          {/* Bottom X-Axis Tick Labels */}
          <div className="flex justify-between pt-4 mt-2 border-t border-slate-100 dark:border-[#1E2533] text-[10px] font-mono text-slate-400 dark:text-slate-600">
            <span>0</span>
            <span>100</span>
            <span>200</span>
            <span>400</span>
            <span>500</span>
            <span>600</span>
            <span>700</span>
            <span>800</span>
          </div>

        </div>

      </div>

    </section>
  );
}

