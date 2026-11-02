import React from 'react';

export default function UniqodeLogo({ size = 32, showText = true, className = '', textColor = 'currentColor', light = false }) {
  return (
    <div className={`inline-flex items-center gap-2.5 font-['Plus_Jakarta_Sans'] ${className}`}>
      {/* Geometric Stitched Loop Flower Logo */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-300 hover:rotate-45"
      >
        {/* Central overlapping petal loops formed by continuous stitch threads */}
        <g stroke={light ? '#FFFFFF' : '#0047FF'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          {/* Top & Bottom Petal */}
          <path d="M50 15 C38 15 32 30 50 50 C68 30 62 15 50 15 Z" fill="none" opacity="0.9" />
          <path d="M50 85 C38 85 32 70 50 50 C68 70 62 85 50 85 Z" fill="none" opacity="0.9" />
          {/* Left & Right Petal */}
          <path d="M15 50 C15 38 30 32 50 50 C30 68 15 62 15 50 Z" fill="none" opacity="0.9" />
          <path d="M85 50 C85 38 70 32 50 50 C70 68 85 62 85 50 Z" fill="none" opacity="0.9" />
          {/* Diagonal Petals */}
          <path d="M25 25 C17 33 28 44 50 50 C44 28 33 17 25 25 Z" fill="none" opacity="0.8" />
          <path d="M75 75 C83 67 72 56 50 50 C56 72 67 83 75 75 Z" fill="none" opacity="0.8" />
          <path d="M75 25 C67 17 56 28 50 50 C72 44 83 33 75 25 Z" fill="none" opacity="0.8" />
          <path d="M25 75 C33 83 44 72 50 50 C28 56 17 67 25 75 Z" fill="none" opacity="0.8" />
          {/* Center stitch dot */}
          <circle cx="50" cy="50" r="3.5" fill={light ? '#FFFFFF' : '#0047FF'} />
        </g>
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span
              className="text-lg md:text-xl font-extrabold tracking-[0.22em] uppercase"
              style={{ color: textColor }}
            >
              UNIQODE
            </span>
          </div>
          <span className="text-[9.5px] font-['Silkscreen'] tracking-[0.18em] text-[#0047FF] dark:text-[#9BBFE0] mt-0.5">
            ■ PHISHSHIELD-X
          </span>
        </div>
      )}
    </div>
  );
}

