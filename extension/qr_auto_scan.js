// PhishShield-EDL Automatic QR Harvester (Passive Quishing Defense — Core USP)
// Scans every page the user browses for QR-like images and ships candidates to
// the background worker for photo-level verification BEFORE the user scans
// them with a phone. QR phishing lives in email bodies opened in the browser
// (the exact attack gap your research targets), so this runs top-frame on all
// http(s) pages including webmail.
(function () {
  "use strict";
  if (window !== window.top) return; // top frame only

  const MIN_SIZE = 90;  // rendered QRs below ~90px are virtually unscannable
  const MAX_SIZE = 900;
  const MAX_CANDIDATES = 25; // cap list size sent to background

  const seenSrcs = new Set();

  function candidateFromImg(img) {
    if (!img.complete || !img.naturalWidth || !img.naturalHeight) return null;
    const w = img.naturalWidth, h = img.naturalHeight;
    const ratio = w / h;
    if (ratio < 0.7 || ratio > 1.45) return null;      // QRs are square-ish
    if (w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) return null;
    const visible = img.getClientRects().length > 0;   // skip hidden/retired nodes
    if (!visible) return null;
    const raw = img.currentSrc || img.src;
    if (!raw || raw.startsWith("blob:")) return null;
    let src;
    try { src = new URL(raw, location.href).href; } catch { return null; }
    if (seenSrcs.has(src)) return null;
    seenSrcs.add(src);
    return { src: src, w: w, h: h };
  }

  function candidateFromCanvas(cv) {
    try {
      if (!cv.width || !cv.height) return null;
      const w = cv.width, h = cv.height;
      const ratio = w / h;
      if (ratio < 0.7 || ratio > 1.45) return null;
      if (w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE) return null;
      if (cv.getClientRects().length === 0) return null;
      const url = cv.toDataURL("image/png"); // throws on tainted canvas — caught below
      if (seenSrcs.has(url)) return null;
      seenSrcs.add(url);
      return { src: url, w: w, h: h };
    } catch {
      return null; // cross-origin tainted canvas — background can still fetch via img src if any
    }
  }

  function collectAndSend() {
    const candidates = [];
    try {
      document.querySelectorAll("img").forEach((img) => {
        const c = candidateFromImg(img);
        if (c && candidates.length < MAX_CANDIDATES) candidates.push(c);
      });
      document.querySelectorAll("canvas").forEach((cv) => {
        const c = candidateFromCanvas(cv);
        if (c && candidates.length < MAX_CANDIDATES) candidates.push(c);
      });
    } catch (e) {
      return;
    }
    if (!candidates.length) return;
    try {
      chrome.runtime.sendMessage({
        action: "AUTOSCAN_QR_CANDIDATES",
        candidates: candidates,
        page_url: location.href
      }, () => void chrome.runtime.lastError); // swallow closed-port errors
    } catch {
      /* extension context invalidated during navigation — ignore */
    }
  }

  // Pass 1: idle DOM. Pass 2: delayed (webmail lazy-loads remote images).
  if (document.readyState !== "loading") {
    collectAndSend();
    setTimeout(collectAndSend, 2500);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      collectAndSend();
      setTimeout(collectAndSend, 2500);
    });
  }
})();
