import React, { useState, useEffect } from 'react';

/**
 * PixelSpiderDescent:
 * Features the custom pixel-art jumping spider rappelling down from the headline text.
 * - Silk web thread anchored to the headline text.
 * - Natural physics sway and bobbing rappel animation.
 * - Interactive: reacts to hover and click (spooked jump / climb).
 * - Rendered with pixelated crispness matching the retro dither aesthetic.
 */
export default function PixelSpiderDescent() {
  const [isSpooked, setIsSpooked] = useState(false);
  const [rappelOffset, setRappelOffset] = useState(0);
  const [descended, setDescended] = useState(false);

  useEffect(() => {
    // Initial descent entrance animation
    const timer = setTimeout(() => {
      setDescended(true);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    setIsSpooked(true);
    setRappelOffset((prev) => (prev === 0 ? -45 : 0));
    setTimeout(() => setIsSpooked(false), 900);
  };

  return (
    <div
      className="absolute top-0 right-[8%] sm:right-[14%] md:right-[20%] z-20 pointer-events-auto select-none"
      style={{
        transition: 'transform 1.6s cubic-bezier(0.34, 1.3, 0.64, 1)',
        transform: descended
          ? `translateY(${110 + rappelOffset}px)`
          : 'translateY(-120px)',
      }}
    >
      {/* Spider Container with natural pendulum swing & bob */}
      <div
        onClick={handleClick}
        className="group relative cursor-pointer flex flex-col items-center"
        title="Cyber Virus Spider (Click me!)"
      >
        {/* Glowing Silk Web Thread extending up to the text */}
        <div
          className="w-[1.5px] bg-gradient-to-b from-[#00F0FF]/80 via-white/70 to-[#0047FF]/60 shadow-[0_0_6px_rgba(0,240,255,0.8)]"
          style={{
            height: `${140 - rappelOffset}px`,
            transition: 'height 1.6s cubic-bezier(0.34, 1.3, 0.64, 1)',
          }}
        />

        {/* Spider Body with continuous subtle idle sway & hover reaction */}
        <div
          className={`relative transition-transform duration-300 ease-out ${
            isSpooked ? 'scale-110 -rotate-6' : 'group-hover:scale-105'
          }`}
          style={{
            animation: 'spiderSway 3.6s ease-in-out infinite alternate',
          }}
        >
          {/* Subtle neon back-glow */}
          <div className="absolute inset-0 bg-[#0047FF]/30 blur-md rounded-full pointer-events-none transform scale-90" />

          {/* The Pixel Spider Sprite */}
          <img
            src="/pixel-spider.png"
            alt="Cyber Virus Spider"
            className="relative w-16 sm:w-20 md:w-22 h-auto drop-shadow-[0_4px_12px_rgba(0,71,255,0.4)] pointer-events-none"
            style={{
              imageRendering: 'pixelated',
            }}
          />

          {/* Interactive alert tooltip on hover */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-[#080A0F]/90 border border-[#0047FF]/60 text-[10px] font-mono px-2 py-0.5 rounded text-[#00F0FF] shadow-lg">
            [SPIDER_VIRUS.EXE]
          </div>
        </div>
      </div>

      {/* Keyframe animation for organic silk swaying */}
      <style>{`
        @keyframes spiderSway {
          0% {
            transform: rotate(-3.5deg) translateY(0px);
          }
          50% {
            transform: rotate(0deg) translateY(5px);
          }
          100% {
            transform: rotate(3.5deg) translateY(0px);
          }
        }
      `}</style>
    </div>
  );
}
