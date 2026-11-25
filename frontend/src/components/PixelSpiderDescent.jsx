import React, { useState, useEffect } from 'react';

/**
 * PixelSpiderDescent:
 * Features the custom pixel-art jumping spider rappelling down directly from the headline text.
 * - Anchored directly to the headline text "Intelligence".
 * - Small, cute, compact pixel sprite (~32-36px).
 * - Glowing silk web thread attached to the bottom edge of the text.
 * - Natural physics sway and bobbing rappel animation.
 * - Interactive: reacts to hover and click (spooked jump / climb).
 */
export default function PixelSpiderDescent() {
  const [isSpooked, setIsSpooked] = useState(false);
  const [rappelOffset, setRappelOffset] = useState(0);
  const [descended, setDescended] = useState(false);

  useEffect(() => {
    // Initial descent entrance animation
    const timer = setTimeout(() => {
      setDescended(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = (e) => {
    e.stopPropagation();
    setIsSpooked(true);
    setRappelOffset((prev) => (prev === 0 ? -35 : 0));
    setTimeout(() => setIsSpooked(false), 800);
  };

  // Base hang distance below the text
  const baseDrop = 75;
  const currentDrop = baseDrop + rappelOffset;

  return (
    <div
      className="absolute right-1 sm:right-3 top-full z-20 pointer-events-auto select-none flex flex-col items-center"
      style={{
        transform: descended ? 'translateY(0px)' : 'translateY(-60px)',
        opacity: descended ? 1 : 0,
        transition: 'transform 1.2s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.4s ease-out',
      }}
    >
      {/* Spider Container with natural pendulum swing & bob */}
      <div
        onClick={handleClick}
        className="group relative cursor-pointer flex flex-col items-center"
        title="Cyber Virus Spider (Click me!)"
      >
        {/* Glowing Silk Web Thread extending directly from the text */}
        <div
          className="w-[1px] bg-gradient-to-b from-[#00F0FF] via-white/90 to-[#0047FF] shadow-[0_0_4px_rgba(0,240,255,0.9)] origin-top"
          style={{
            height: `${currentDrop}px`,
            transition: 'height 0.8s cubic-bezier(0.34, 1.3, 0.64, 1)',
          }}
        />

        {/* Spider Body with continuous subtle idle sway & hover reaction */}
        <div
          className={`relative transition-transform duration-300 ease-out ${
            isSpooked ? 'scale-115 -translate-y-2' : 'group-hover:scale-110'
          }`}
          style={{
            animation: 'spiderSway 3.2s ease-in-out infinite alternate',
          }}
        >
          {/* Subtle neon back-glow */}
          <div className="absolute inset-0 bg-[#0047FF]/40 blur-[6px] rounded-full pointer-events-none transform scale-90" />

          {/* The Compact Pixel Spider Sprite */}
          <img
            src="/pixel-spider.png"
            alt="Cyber Virus Spider"
            className="relative w-8 sm:w-9 md:w-10 h-auto drop-shadow-[0_2px_8px_rgba(0,71,255,0.5)] pointer-events-none"
            style={{
              imageRendering: 'pixelated',
            }}
          />

          {/* Tooltip on hover */}
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-[#080A0F]/95 border border-[#0047FF]/70 text-[9px] font-mono px-1.5 py-0.2 rounded text-[#00F0FF] shadow-lg">
            [SPIDER_VIRUS]
          </div>
        </div>
      </div>

      {/* Keyframe animation for organic silk swaying */}
      <style>{`
        @keyframes spiderSway {
          0% {
            transform: rotate(-3deg) translateY(0px);
          }
          50% {
            transform: rotate(0deg) translateY(3px);
          }
          100% {
            transform: rotate(3deg) translateY(0px);
          }
        }
      `}</style>
    </div>
  );
}
