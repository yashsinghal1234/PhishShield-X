import React from 'react';

/**
 * LinguisticLimitsSection:
 * An open, architectural editorial spread (NOT A CARD) bridging:
 * 1. The Ludwig Wittgenstein block-highlight typographic manifesto:
 *    "[The] limits of [my] [language mean the] limits [of] [my] [world.]"
 * 2. The authentic surreal engraved cross-hatched hand artwork with 8-bit blue hazard signs.
 */
export default function LinguisticLimitsSection() {
  return (
    <section className="relative w-full py-10 sm:py-14 md:py-16 select-none overflow-hidden">
      
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#0047FF]/6 dark:bg-[#0047FF]/12 blur-[140px] rounded-full pointer-events-none -z-10" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        
        {/* =========================================================================
            COLUMN 1 (Cols 1-7): THE MONUMENTAL BLOCK-HIGHLIGHT TYPOGRAPHY
            ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6 sm:space-y-7 z-10">

          {/* The Block-Highlighted Typography Headline */}
          <div className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-4xl md:text-5xl lg:text-[62px] font-extrabold tracking-tight leading-[1.3] sm:leading-[1.2] text-[#0A0D14] dark:text-white">
            
            {/* Line 1: [The] limits of [your] */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2.5 sm:mb-3.5">
              <span className="inline-block bg-[#0047FF] text-white px-2.5 sm:px-4 py-0.5 sm:py-1 shadow-sm transition-transform hover:-translate-y-0.5">
                The
              </span>
              <span className="tracking-tight">limits of</span>
              <span className="inline-block bg-[#0047FF] text-white px-2.5 sm:px-4 py-0.5 sm:py-1 shadow-sm transition-transform hover:-translate-y-0.5">
                your
              </span>
            </div>

            {/* Line 2: [detection mean the] */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2.5 sm:mb-3.5">
              <span className="inline-block bg-[#0A0D14] dark:bg-white text-white dark:text-[#0A0D14] px-3 sm:px-5 py-0.5 sm:py-1 shadow-sm transition-transform hover:-translate-y-0.5">
                detection mean the
              </span>
            </div>

            {/* Line 3: limits [of] [your] [defense.] */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="tracking-tight">limits</span>
              <span className="inline-block bg-[#0047FF] text-white px-2 sm:px-3 py-0.5 sm:py-1 shadow-sm transition-transform hover:-translate-y-0.5">
                of
              </span>
              <span className="inline-block bg-[#CBD5E1] dark:bg-[#334155] text-[#0A0D14] dark:text-white px-2.5 sm:px-3.5 py-0.5 sm:py-1 shadow-sm transition-transform hover:-translate-y-0.5">
                your
              </span>
              <span className="inline-block bg-[#0A0D14] dark:bg-white text-white dark:text-[#0A0D14] px-3 sm:px-5 py-0.5 sm:py-1 shadow-sm transition-transform hover:-translate-y-0.5">
                defense.
              </span>
            </div>

          </div>

          {/* Bridging Philosophy to PhishShield's Multi-Modal Defense */}
          <p className="text-sm sm:text-base text-[#475569] dark:text-[#94A3B8] font-normal leading-[1.7] max-w-xl">
            Adversarial exploits thrive in the blind spots of conventional heuristics. When attackers bypass keyword filters with homoglyphic Unicode, cloaked redirect chains, and poisoned QR matrices, they exploit the critical limits of single-vector systems. PhishShield expands resilience beyond lexical boundaries through Evidential Deep Learning and real-time multimodal consensus.
          </p>

        </div>

        {/* =========================================================================
            COLUMN 2 (Cols 8-12): THE AUTHENTIC ENGRAVED ARTWORK IMAGE
            ========================================================================= */}
        <div className="lg:col-span-5 relative flex items-center justify-center py-4">
          
          <div className="relative w-full max-w-[420px] aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl transition-transform duration-500 hover:scale-[1.01]">
            <img
              src="/warning-hand.jpg?v=2"
              alt="Digital Warning Hand Art"
              className="w-full h-full object-cover"
            />
          </div>

        </div>

      </div>

    </section>
  );
}
