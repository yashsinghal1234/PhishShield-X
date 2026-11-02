import React, { useState, useEffect } from 'react';
import { Globe, Shield, Lock } from 'lucide-react';

// Crisp, authentic inline SVG logos for top phished & web brands
const BRAND_LOGOS = {
  paypal: {
    name: 'PayPal',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#003087" d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.789.789 0 0 1 .78-.663h6.738c3.273 0 5.617 1.637 5.093 5.348-.37 2.628-2.19 4.316-4.912 4.316H9.362a.789.789 0 0 0-.78.663l-1.506 7.953z" />
        <path fill="#0079C1" d="M8.766 14.385l1.084-5.72a.789.789 0 0 1 .78-.663h4.636c2.72 0 4.542-1.688 4.912-4.316.524-3.71-1.82-5.348-5.093-5.348H8.347a.789.789 0 0 0-.78.663L4.46 20.597a.641.641 0 0 0 .633.74h4.606l1.325-6.952h-2.258z" />
        <path fill="#00457C" d="M7.567 8.002h4.636c2.72 0 4.542-1.688 4.912-4.316.096-.68.083-1.284-.04-1.802A7.17 7.17 0 0 0 15.265 1.5H8.347a.789.789 0 0 0-.78.663L4.46 20.597a.641.641 0 0 0 .633.74h4.606l1.506-7.953a.789.789 0 0 1 .78-.663h3.282c2.722 0 4.543-1.688 4.912-4.316.326-2.31-.693-3.837-2.612-4.403z" />
      </svg>
    ),
  },
  google: {
    name: 'Google',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
      </svg>
    ),
  },
  apple: {
    name: 'Apple',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#111827">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.61 1.34-.55.63-1.03 1.68-.9 2.71 1 .08 2.01-.52 2.59-1.2z" />
      </svg>
    ),
  },
  microsoft: {
    name: 'Microsoft',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <rect x="1" y="1" width="10" height="10" fill="#F25022" />
        <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
        <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
        <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
      </svg>
    ),
  },
  netflix: {
    name: 'Netflix',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#E50914" d="M4 0h3.5v24H4z" />
        <path fill="#E50914" d="M16.5 0H20v24h-3.5z" />
        <path fill="#B20710" d="M4 0h3.8l8.7 24h-3.8z" />
      </svg>
    ),
  },
  amazon: {
    name: 'Amazon',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#FF9900" d="M15.8 15.6c-2.3 1.7-5.7 2.6-8.6 2.6-4.1 0-7.7-1.5-10.5-4.1-.2-.2 0-.5.2-.4 3 1.7 6.6 2.7 10.3 2.7 2.6 0 5.4-.6 7.9-1.9.4-.2.7.2.3.5l.4.6z" />
        <path fill="#FF9900" d="M16.8 14.3c-.3-.4-1.9-.2-2.6-.1-.2 0-.3-.2-.1-.3 1.1-.8 2.8-.6 3.1-.2.3.4-.1 2.2-1.1 3-.1.1-.3 0-.3-.1.2-.7.9-2 .6-2.3z" />
        <path fill="#111827" d="M13.2 12.3v-5c0-1.2-.4-2.1-1.3-2.6-.9-.6-2.1-.6-3.3-.3-1 .2-1.9.8-2.3 1.5-.1.2 0 .4.2.5l1.3.8c.2.1.4 0 .5-.2.2-.4.6-.7 1.1-.8.5-.1 1.1 0 1.4.3.3.3.4.7.4 1.2v.3c-1.3.1-2.9.3-4.2.9-1.3.6-2 1.6-2 2.9 0 1.8 1.4 2.8 3.1 2.8 1.3 0 2.4-.6 3-1.6v1.4c0 .2.2.3.4.3h1.8c.2 0 .4-.1.4-.3v-1.8zm-2.4-.7c-.3.7-1 1.2-1.8 1.2-.7 0-1.2-.4-1.2-1.1 0-.9.7-1.4 1.8-1.5l1.2-.1v1.5z" />
      </svg>
    ),
  },
  github: {
    name: 'GitHub',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#111827">
        <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  meta: {
    name: 'Meta',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#0866FF" d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.78-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.45 2.9h-2.33v7a10 10 0 0 0 8.44-9.9c0-5.53-4.5-10.02-10-10.02z" />
      </svg>
    ),
  },
  facebook: {
    name: 'Facebook',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  instagram: {
    name: 'Instagram',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#E4405F" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  twitter: {
    name: 'X / Twitter',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#111827">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  x: {
    name: 'X',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#111827">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  discord: {
    name: 'Discord',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#5865F2" d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
  spotify: {
    name: 'Spotify',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#1ED760" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.306a.75.75 0 0 1-1.031.25c-2.825-1.728-6.381-2.119-10.569-1.162a.75.75 0 1 1-.334-1.463c4.581-1.047 8.528-.606 11.684 1.344a.75.75 0 0 1 .25 1.031zm1.472-3.272a.938.938 0 0 1-1.288.312c-3.234-1.99-8.163-2.566-11.988-1.406a.938.938 0 1 1-.553-1.791c4.375-1.328 9.813-.688 13.516 1.597a.938.938 0 0 1 .313 1.288zm.131-3.41c-3.875-2.303-10.272-2.516-13.988-1.391a1.125 1.125 0 1 1-.65-2.156c4.25-1.291 11.313-1.041 15.781 1.616a1.125 1.125 0 0 1-1.144 1.931h.001z" />
      </svg>
    ),
  },
  chase: {
    name: 'Chase',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#117ACA">
        <path d="M12 0L0 12l4 4 8-8 8 8 4-4L12 0zm-8 16l8 8 12-12-4-4-8 8-8-8z" />
      </svg>
    ),
  },
  binance: {
    name: 'Binance',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <path fill="#F3BA2F" d="M12 0l-4.5 4.5 4.5 4.5 4.5-4.5L12 0zm-7.5 7.5L0 12l4.5 4.5 4.5-4.5-4.5-4.5zm15 0L15 12l4.5 4.5 4.5-4.5-4.5-4.5zM12 15l-4.5 4.5 4.5 4.5 4.5-4.5L12 15zm0-4.5l-1.5 1.5 1.5 1.5 1.5-1.5-1.5-1.5z" />
      </svg>
    ),
  },
  steam: {
    name: 'Steam',
    svg: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#171A21">
        <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.005.105.005.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 12-5.373 12-12s-5.373-12-12-12z" />
      </svg>
    ),
  },
};

/**
 * Detect brand keyword from URL (e.g. 'paypal', 'netflix', 'apple', 'chase')
 */
function detectBrandFromUrl(rawUrl) {
  if (!rawUrl) return null;
  const lower = rawUrl.toLowerCase().trim();

  // Check known brands
  for (const key of Object.keys(BRAND_LOGOS)) {
    if (lower.includes(key)) {
      return { key, ...BRAND_LOGOS[key] };
    }
  }
  return null;
}

function extractCleanDomain(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) return '';
  let str = rawUrl.trim();
  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    str = 'https://' + str;
  }
  try {
    const parsed = new URL(str);
    const host = parsed.hostname.replace(/^www\./, '');
    return host.includes('.') ? host : '';
  } catch {
    const match = str.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
    return match ? match[1] : '';
  }
}

/**
 * UrlBrandBadge:
 * Displays the authentic brand logo, live web favicon, or stylized cyber domain monogram.
 * Never fails or shows a blank square.
 */
export default function UrlBrandBadge({ url }) {
  const [providerIndex, setProviderIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const cleanDomain = extractCleanDomain(url);
  const detectedBrand = detectBrandFromUrl(url);

  // Multi-provider fallback list for live domains
  const faviconProviders = cleanDomain
    ? [
        `https://unavatar.io/${cleanDomain}?fallback=false`,
        `https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`,
        `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`,
      ]
    : [];

  // Reset state on input change
  useEffect(() => {
    setProviderIndex(0);
    setImgLoaded(false);
    setImgFailed(false);
  }, [cleanDomain, detectedBrand?.key]);

  const handleImgError = () => {
    if (providerIndex + 1 < faviconProviders.length) {
      setProviderIndex((prev) => prev + 1);
    } else {
      setImgFailed(true);
    }
  };

  // 1. If Brand Keyword Detected -> Show High-Res Authentic Brand Vector
  if (detectedBrand) {
    return (
      <div
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden shrink-0 border border-slate-200/60 bg-white flex items-center justify-center shadow-md shadow-black/5"
        title={`Identified Brand Target: ${detectedBrand.name}`}
      >
        {detectedBrand.svg}
      </div>
    );
  }

  // 2. If Real Domain Present and Favicon Providers Not Exhausted -> Try Live Favicon
  if (cleanDomain && !imgFailed && faviconProviders.length > 0) {
    return (
      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden shrink-0 border border-slate-200/60 bg-white flex items-center justify-center shadow-md shadow-black/5 relative">
        <img
          key={faviconProviders[providerIndex]}
          src={faviconProviders[providerIndex]}
          alt={cleanDomain}
          className={`w-5 h-5 sm:w-5.5 sm:h-5.5 object-contain transition-opacity duration-200 ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setImgLoaded(true)}
          onError={handleImgError}
        />
        {/* Placeholder while loading provider */}
        {!imgLoaded && (
          <div className="absolute inset-0 bg-slate-100 animate-pulse flex items-center justify-center text-[11px] font-bold text-slate-500 uppercase">
            {cleanDomain.charAt(0)}
          </div>
        )}
      </div>
    );
  }

  // 3. Fallback for custom / unindexed / phishing domains -> Sleek Cyber Monogram Badge
  if (cleanDomain) {
    const initial = cleanDomain.charAt(0).toUpperCase();
    return (
      <div
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden shrink-0 border border-blue-400/40 bg-gradient-to-tr from-[#0047FF] to-[#00A1DE] flex items-center justify-center shadow-md shadow-[#0047FF]/20 text-white font-mono font-bold text-xs sm:text-sm tracking-wider"
        title={`Target Domain: ${cleanDomain}`}
      >
        {initial}
      </div>
    );
  }

  // 4. Empty State -> High-Tech Global Threat Radar Icon
  return (
    <div
      className="h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden shrink-0 border border-blue-200/60 bg-blue-50/90 flex items-center justify-center text-[#0047FF] shadow-inner"
      title="Global Threat Scanner Ready"
    >
      <Globe className="w-4 h-4 animate-[spin_10s_linear_infinite]" />
    </div>
  );
}

