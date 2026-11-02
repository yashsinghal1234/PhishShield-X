import React from 'react';

/**
 * PixelPadlock matches the exact "SECURITY" card from Uniqode's brand moodboard:
 * An authentic pixel/cross-stitch padlock in pitch black.
 */
export default function PixelPadlock({ size = 100, className = '', color = '#0A0D14' }) {
  return (
    <svg
      width={size}
      height={size * 1.35}
      viewBox="0 0 24 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pixel-art ${className}`}
      shapeRendering="crispEdges"
    >
      {/* Padlock Shackle */}
      <rect x="7" y="2" width="10" height="3" fill={color} />
      <rect x="5" y="5" width="4" height="3" fill={color} />
      <rect x="15" y="5" width="4" height="3" fill={color} />
      <rect x="4" y="8" width="4" height="6" fill={color} />
      <rect x="16" y="8" width="4" height="6" fill={color} />

      {/* Main Lock Body */}
      <rect x="2" y="14" width="20" height="17" rx="1.5" fill={color} />

      {/* Cross-stitch texture / highlights */}
      <rect x="4" y="16" width="2" height="2" fill="#FFFFFF" opacity="0.3" />
      <rect x="8" y="16" width="2" height="2" fill="#FFFFFF" opacity="0.15" />
      <rect x="14" y="16" width="2" height="2" fill="#FFFFFF" opacity="0.15" />
      <rect x="18" y="16" width="2" height="2" fill="#FFFFFF" opacity="0.25" />

      {/* Keyhole (Pixelated slot) */}
      <rect x="11" y="19" width="2" height="4" fill="#9BBFE0" />
      <rect x="10" y="23" width="4" height="4" fill="#9BBFE0" />
    </svg>
  );
}
