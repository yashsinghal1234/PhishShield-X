import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop:
 * Automatically resets the window scroll position to the very top (0, 0)
 * whenever the route changes across the application.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  // Prevent browser's automatic scroll restoration on SPA route pushState
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    // Immediate reset
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;

    // Follow-up microtask & frame to guarantee scroll reset after React DOM layout
    const rafId = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    });

    const timer = setTimeout(() => {
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }, 10);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
