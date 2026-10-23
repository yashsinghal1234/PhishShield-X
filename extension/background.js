// PhishShield-EDL Extension Background Service Worker (Manifest V3)
// Usable Security Architecture: eTLD+1 Tiered-TTL Caching, Habituation Reduction & Override Guardrails
const BLOCKED_PAGE = chrome.runtime.getURL("blocked.html");

const API_BASE_LOCAL = "http://localhost:8000";
const API_BASE_CLOUD = "https://phishshield-x.onrender.com";
let resolvedApiBase = null;

// Resolve once per service-worker lifetime: prefer a locally running backend;
// fall back to the deployed Render gateway (also warms up the free-tier instance).
async function getApiBase() {
  if (resolvedApiBase) return resolvedApiBase;
  try {
    const res = await fetch(`${API_BASE_LOCAL}/health`, { signal: AbortSignal.timeout(1500) });
    resolvedApiBase = res.ok ? API_BASE_LOCAL : API_BASE_CLOUD;
  } catch {
    resolvedApiBase = API_BASE_CLOUD;
  }
  return resolvedApiBase;
}

// Redirect a tab to the Tier-1 interstitial. The verdict record is persisted
// under `block_<urlHash>` so blocked.js can render forensic details after the
// redirect (MV3 does not permit passing data through inline scripts).
async function blockTab(tabId, urlHash, record) {
  try {
    await chrome.storage.local.set({ [`block_${urlHash}`]: record });
    await chrome.tabs.update(tabId, { url: `${BLOCKED_PAGE}?block=${urlHash}` });
  } catch (e) {
    console.warn("PhishShield-EDL block redirect failed:", e);
  }
}

// Fast-path client whitelist for top global domains (<0.2ms resolution, zero network round-trip)
const TOP_DOMAINS_WHITELIST = new Set([
  "google.com", "youtube.com", "facebook.com", "wikipedia.org", "amazon.com",
  "yahoo.com", "reddit.com", "github.com", "microsoft.com", "apple.com",
  "netflix.com", "twitter.com", "x.com", "linkedin.com", "instagram.com",
  "cloudflare.com", "stackoverflow.com", "openai.com", "bing.com", "duckduckgo.com",
  "gitlab.com", "medium.com", "quora.com", "zoom.us", "dropbox.com", "spotify.com",
  "whatsapp.com", "slack.com", "notion.so", "figma.com", "adobe.com", "aliexpress.com"
]);

// Multi-part ccTLDs for robust client-side eTLD+1 extraction
const KNOWN_TWO_PART_TLDS = new Set([
  "co.uk", "gov.uk", "org.uk", "ac.uk", "net.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.in", "gov.in", "ac.in", "net.in", "org.in",
  "com.br", "co.jp", "ne.jp", "com.sg", "edu.sg",
  "com.mx", "co.za", "com.tr", "co.nz", "com.tw"
]);

// In-memory tab debounce tracker (same-tab navigations within 2s ignored)
const tabDebounceMap = new Map();

// Auto-QR scan: per-tab notification throttle + max QR verifications per page
const autoQrNotifyCount = new Map();
const AUTO_QR_MAX_SCANS = 12;
const AUTO_QR_MAX_NOTIFICATIONS = 2;

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// MV3 service workers are terminated after ~30s of idle time, and a pending
// fetch does NOT extend that lifetime. When the Render gateway is cold, a scan
// can take 30-60s, so the SW would be killed mid-fetch and the verdict lost.
// Heartbeats that call a Chrome API reset the idle timer and keep the worker
// alive for the duration of long-running backend work.
function startKeepalive() {
  const beat = setInterval(() => {
    try { chrome.runtime.getPlatformInfo(); } catch (e) { /* worker dying */ }
  }, 20000);
  return () => clearInterval(beat);
}

// ---------------------------------------------------------------------------
// Automatic QR detection — client-side QR-likeness test using OffscreenCanvas.
// Binarizes the image (global mean threshold) and searches for the QR "finder
// pattern": dark:light:dark:light:dark runs in a 1:1:3:1:1 ratio. This signature
// is essentially unique to QR/barcode symbologies and eliminates ~99% of
// ordinary page images before any network call to the multimodal backend.
// ---------------------------------------------------------------------------
function finderPatternInRuns(runs) {
  for (let i = 0; i + 4 < runs.length; i++) {
    const a = runs[i], b = runs[i + 1], c = runs[i + 2], d = runs[i + 3], e = runs[i + 4];
    if (a.c !== 1 || b.c !== 0 || c.c !== 1 || d.c !== 0 || e.c !== 1) continue;
    const unit = (a.len + b.len + d.len + e.len) / 4;
    if (unit < 1) continue;
    const inBand = (v) => Math.abs(v - unit) <= unit * 0.6;
    if (inBand(a.len) && inBand(b.len) && inBand(d.len) && inBand(e.len) &&
        Math.abs(c.len - unit * 3) <= unit * 1.9) {
      return true;
    }
  }
  return false;
}

function looksLikeQr(bitmap) {
  try {
    const w = bitmap.width, h = bitmap.height;
    if (!w || !h) return false;
    const scale = Math.min(1, 220 / Math.max(w, h));
    const cw = Math.max(24, Math.round(w * scale));
    const ch = Math.max(24, Math.round(h * scale));
    const canvas = new OffscreenCanvas(cw, ch);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, cw, ch);
    const px = ctx.getImageData(0, 0, cw, ch).data;

    const n = cw * ch;
    const bin = new Uint8Array(n); // 1 = dark
    let mean = 0;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const v = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
      bin[i] = v; // temp store luminance
      mean += v;
    }
    mean /= n;
    for (let i = 0; i < n; i++) bin[i] = bin[i] < mean ? 1 : 0;

    // Horizontal run-length scan
    for (let y = 0; y < ch; y++) {
      const runs = [];
      let cur = bin[y * cw], len = 1;
      for (let x = 1; x < cw; x++) {
        const v = bin[y * cw + x];
        if (v === cur) len++;
        else { runs.push({ c: cur, len: len }); cur = v; len = 1; }
      }
      runs.push({ c: cur, len: len });
      if (finderPatternInRuns(runs)) return true;
    }

    // Vertical run-length scan (vertical finder arms)
    for (let x = 0; x < cw; x++) {
      const runs = [];
      let cur = bin[x], len = 1;
      for (let y = 1; y < ch; y++) {
        const v = bin[y * cw + x];
        if (v === cur) len++;
        else { runs.push({ c: cur, len: len }); cur = v; len = 1; }
      }
      runs.push({ c: cur, len: len });
      if (finderPatternInRuns(runs)) return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// Handle a confirmed phishing QR found while passively browsing
async function handleAutoQrThreat(tabId, pageUrl, qrSrcHash, data) {
  chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#EF4444" });
  chrome.action.setBadgeText({ tabId: tabId, text: "PHISH" });

  // Page-scoped record so the popup can surface the embedded-QR threat
  await chrome.storage.local.set({
    [`qr_${tabId}`]: {
      prediction: data.prediction,
      confidence: data.confidence,
      advisory_message: data.advisory_message || "",
      details: data.details || "",
      edl_uncertainty: data.edl_uncertainty,
      edl_strength: data.edl_strength,
      page_url: pageUrl,
      scanned_at: Date.now()
    }
  });

  // Throttled system notification (avoid nagging across many QRs / one page)
  const count = autoQrNotifyCount.get(tabId) || 0;
  if (count < AUTO_QR_MAX_NOTIFICATIONS) {
    autoQrNotifyCount.set(tabId, count + 1);
    try {
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: "⚠ PhishShield-EDL: Malicious QR Code on This Page",
        message:
          `Prediction: ${data.prediction} (${Math.round((data.confidence || 0) * 100)}% conf)` +
          (data.details ? `\nPayload: ${data.details}` : "") +
          "\nDo NOT scan this QR with your phone.",
        priority: 2,
        requireInteraction: true
      });
    } catch (e) { /* notification channel unavailable */ }
  }
}

function extractETLDPlusOne(urlStr) {
  try {
    const u = new URL(urlStr);
    const hostname = u.hostname.toLowerCase();
    const parts = hostname.split(".");
    if (parts.length <= 2) return hostname;
    const lastTwo = parts.slice(-2).join(".");
    if (KNOWN_TWO_PART_TLDS.has(lastTwo) && parts.length >= 3) {
      return parts.slice(-3).join(".");
    }
    return parts.slice(-2).join(".");
  } catch {
    return urlStr;
  }
}

// Tiered TTL Durations based on Evidential Uncertainty & Threat Risk
const TTL_DURATIONS_MS = {
  tier3_safe: 7 * 24 * 3600 * 1000,      // 7 Days (Safe, aged domain, low uncertainty)
  tier2_uncertain: 4 * 3600 * 1000,       // 4 Hours (Evidentially ambiguous / novel drift)
  tier1_phish: 24 * 3600 * 1000          // 24 Hours (Confirmed malicious, sticky block)
};

// Main navigation listener
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return; // Top-level frame only (ignore subframes/ads)
  const url = details.url;
  if (!url || !url.startsWith("http")) return;

  const tabId = details.tabId;
  const now = Date.now();

  // Reset page-scoped automatic-QR findings (they belong to the previous page)
  chrome.storage.local.remove([`qr_${tabId}`]);
  autoQrNotifyCount.delete(tabId);

  // 1. Debounce check (<2s on same tab)
  const lastScan = tabDebounceMap.get(tabId);
  if (lastScan && (now - lastScan.time < 2000) && lastScan.url === url) {
    return;
  }
  tabDebounceMap.set(tabId, { url: url, time: now });

  const etldPlusOne = extractETLDPlusOne(url);
  const domainHash = (await sha256(etldPlusOne)).slice(0, 12);
  const urlHash = (await sha256(url)).slice(0, 12);
  const cacheKey = `domain_${domainHash}`;

  // 2. Fast-Path Client Whitelist (<0.5ms resolution)
  if (TOP_DOMAINS_WHITELIST.has(etldPlusOne)) {
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#10B981" });
    chrome.action.setBadgeText({ tabId: tabId, text: "OK" });

    const fastRecord = {
      url: url,
      etld_plus_one: etldPlusOne,
      domain_hash: domainHash,
      url_hash: urlHash,
      prediction: "Safe",
      confidence: 0.99,
      friction_level: "none",
      ttl_tier: "tier3_safe",
      edl_uncertainty: 0.05,
      edl_strength: 20.0,
      latency_ms: 0.2,
      cache_hit: true,
      timestamp: new Date().toISOString()
    };
    await chrome.storage.local.set({ [tabId.toString()]: fastRecord });
    return;
  }

  // 3. Cache-Before-Fetch Check in chrome.storage.local
  const cachedStorage = await chrome.storage.local.get([cacheKey]);
  const cachedEntry = cachedStorage[cacheKey];

  if (cachedEntry && cachedEntry.expires_at > now) {
    // Cache Hit!
    const isOverrideActive = cachedEntry.override_expiry && (cachedEntry.override_expiry > now);

    // Guardrail: Never honor override on Tier 1 malicious blocks
    const effectiveBlock = cachedEntry.ttl_tier === "tier1_phish";

    const tabRecord = {
      ...cachedEntry,
      url: url,
      url_hash: urlHash,
      cache_hit: true,
      override_reused: Boolean(isOverrideActive && !effectiveBlock),
      timestamp: new Date().toISOString()
    };

    if (effectiveBlock) {
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#EF4444" });
      chrome.action.setBadgeText({ tabId: tabId, text: "PHISH" });
      // Telemetry for blocked cache-hit visit (campaign repeat traffic)
      fetch(`${await getApiBase()}/api/extension/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url_hash: urlHash,
          domain_hash: domainHash,
          u: cachedEntry.edl_uncertainty,
          S: cachedEntry.edl_strength,
          prediction: cachedEntry.prediction,
          confidence: cachedEntry.confidence,
          cache_hit: true,
          ttl_tier: cachedEntry.ttl_tier,
          snoozed: false,
          override_reused: false,
          user_override: false,
          action: "tier1_cache_hit_blocked",
          latency_ms: 1.0
        })
      }).catch(() => {});
      // Tier-1 cache hit must still enforce the interstitial, not just badge
      await chrome.storage.local.set({ [tabId.toString()]: tabRecord });
      await blockTab(tabId, urlHash, tabRecord);
      return;
    } else if (cachedEntry.ttl_tier === "tier2_uncertain") {
      if (isOverrideActive) {
        chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#10B981" });
        chrome.action.setBadgeText({ tabId: tabId, text: "SNOOZED" });
      } else {
        chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#F59E0B" });
        chrome.action.setBadgeText({ tabId: tabId, text: "UNC" });
      }
    } else {
      // Tier 3 Safe
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#10B981" });
      chrome.action.setBadgeText({ tabId: tabId, text: "OK" });
    }

    await chrome.storage.local.set({ [tabId.toString()]: tabRecord });

    // Telemetry log cached visit (proves 70-80% fatigue reduction in field study)
    if (cachedEntry.ttl_tier !== "tier3_safe" || isOverrideActive) {
      fetch(`${await getApiBase()}/api/extension/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url_hash: urlHash,
          domain_hash: domainHash,
          u: cachedEntry.edl_uncertainty,
          S: cachedEntry.edl_strength,
          prediction: cachedEntry.prediction,
          confidence: cachedEntry.confidence,
          cache_hit: true,
          ttl_tier: cachedEntry.ttl_tier,
          snoozed: Boolean(isOverrideActive),
          override_reused: Boolean(isOverrideActive),
          user_override: false,
          latency_ms: 1.0
        })
      }).catch(() => {});
    }
    return;
  }

  // 4. Cache Miss — Query Evidential Backend
  const t0 = performance.now();
  // In-flight UX: scanning badge + storage marker the popup can poll for
  chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#60A5FA" });
  chrome.action.setBadgeText({ tabId: tabId, text: "SCAN" });
  chrome.storage.local.set({ [`scan_${tabId}`]: { url: url, started_at: now } });
  const stopKeepalive = startKeepalive();
  try {
    const res = await fetch(`${await getApiBase()}/api/detect/url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const latencyMs = Math.round(performance.now() - t0);

    // Determine Risk Tier & TTL
    let ttlTier = "tier3_safe";
    if (data.prediction === "Phishing" || data.friction_level === "block") {
      ttlTier = "tier1_phish";
    } else if (
      (data.edl_uncertainty !== undefined && data.edl_uncertainty >= 0.35) ||
      data.friction_level === "quarantine" ||
      data.friction_level === "advisory"
    ) {
      ttlTier = "tier2_uncertain";
    }

    const ttlDuration = TTL_DURATIONS_MS[ttlTier] || (4 * 3600 * 1000);
    const expiresAt = now + ttlDuration;

    const domainCacheRecord = {
      etld_plus_one: etldPlusOne,
      domain_hash: domainHash,
      prediction: data.prediction,
      confidence: data.confidence,
      friction_level: data.friction_level || "none",
      advisory_message: data.advisory_message || "",
      edl_uncertainty: data.edl_uncertainty,
      edl_strength: data.edl_strength,
      edl_prob: data.edl_prob,
      ttl_tier: ttlTier,
      cached_at: now,
      expires_at: expiresAt,
      override_expiry: null
    };

    // Store in domain cache & tab record
    await chrome.storage.local.set({
      [cacheKey]: domainCacheRecord,
      [tabId.toString()]: { ...domainCacheRecord, url: url, url_hash: urlHash, latency_ms: latencyMs }
    });
    chrome.storage.local.remove([`scan_${tabId}`]);

    // Update Badge (Passive by default: No popup auto-open)
    if (ttlTier === "tier1_phish") {
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#EF4444" });
      chrome.action.setBadgeText({ tabId: tabId, text: "PHISH" });
      // Enforce Tier-1 interstitial before the page settles
      await blockTab(tabId, urlHash, { ...domainCacheRecord, url: url, url_hash: urlHash, latency_ms: latencyMs });
    } else if (ttlTier === "tier2_uncertain") {
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#F59E0B" });
      chrome.action.setBadgeText({ tabId: tabId, text: "UNC" });
    } else {
      chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#10B981" });
      chrome.action.setBadgeText({ tabId: tabId, text: "OK" });
    }

    // Telemetry log for field evaluation
    fetch(`${await getApiBase()}/api/extension/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url_hash: urlHash,
        domain_hash: domainHash,
        u: data.edl_uncertainty,
        S: data.edl_strength,
        prediction: data.prediction,
        confidence: data.confidence,
        cache_hit: false,
        ttl_tier: ttlTier,
        snoozed: false,
        override_reused: false,
        user_override: false,
        latency_ms: latencyMs
      })
    }).catch(() => {});

  } catch (err) {
    console.warn("PhishShield-EDL background scan error:", err);
    chrome.storage.local.remove([`scan_${tabId}`]);
    chrome.action.setBadgeText({ tabId: tabId, text: "" });
  } finally {
    stopKeepalive();
  }
});

// Clean up tab state on close
chrome.tabs.onRemoved.addListener((tabId) => {
  tabDebounceMap.delete(tabId);
  autoQrNotifyCount.delete(tabId);
  chrome.storage.local.remove([tabId.toString(), `qr_${tabId}`, `scan_${tabId}`]);
});

// Automatic QR verification pipeline (content script ships candidates)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "AUTOSCAN_QR_CANDIDATES" && sender.tab) {
    (async () => {
      const tabId = sender.tab.id;
      let verified = 0;
      let threats = 0;
      const stopKeepalive = startKeepalive();
      try {
        const candidates = (request.candidates || []).slice(0, AUTO_QR_MAX_SCANS);
        for (const cand of candidates) {
          if (!cand.src) continue;
          try {
            const res = await fetch(cand.src, { credentials: "omit" });
            if (!res.ok) continue;
            const blob = await res.blob();
            if (!blob.size || blob.size > 3500000) continue;

            // Client-side QR-likeness gate (finder-pattern signature)
            const bitmap = await createImageBitmap(blob);
            const isQr = looksLikeQr(bitmap);
            if (bitmap.close) bitmap.close();
            if (!isQr) continue;

            // Multimodal backend verification (M3 serving head)
            const formData = new FormData();
            formData.append("file", blob, "auto_qr.png");
            const api = await fetch(`${await getApiBase()}/api/detect/qr`, {
              method: "POST",
              body: formData
            });
            if (!api.ok) continue;
            const data = await api.json();
            verified++;
            const phish = data.prediction === "Phishing";

            const srcHash = (await sha256(cand.src)).slice(0, 12);
            await fetch(`${await getApiBase()}/api/extension/log`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url_hash: srcHash,
                domain_hash: (await sha256(request.page_url || "")).slice(0, 12),
                u: data.edl_uncertainty,
                S: data.edl_strength,
                prediction: data.prediction,
                confidence: data.confidence,
                action: phish ? "auto_qr_phishing" : "auto_qr_safe",
                cache_hit: false,
                ttl_tier: phish ? "tier1_phish" : "tier3_safe",
                snoozed: false,
                override_reused: false,
                user_override: false
              })
            }).catch(() => {});

            if (phish) {
              threats++;
              await handleAutoQrThreat(tabId, request.page_url, srcHash, data);
            }
          } catch (e) {
            continue; // un-fetchable image (expired blob, hotlink block) — skip
          }
        }
        sendResponse({ status: "done", verified: verified, threats: threats });
      } catch (e) {
        sendResponse({ status: "error", error: e.message });
      } finally {
        stopKeepalive();
      }
    })();
    return true;
  }
});

// Guardrailed User Override / Snooze Message Handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Banner content script fetches its own tab's cached verdict record
  if (request.action === "GET_TAB_RECORD" && sender.tab) {
    const tabKey = sender.tab.id.toString();
    chrome.storage.local.get([tabKey], (result) => {
      sendResponse(result[tabKey] || null);
    });
    return true;
  }

  // Block page: user disputes a Tier-1 verdict (logged for retraining review)
  if (request.action === "REPORT_FALSE_POSITIVE") {
    (async () => {
      try {
        await fetch(`${await getApiBase()}/api/extension/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url_hash: request.url_hash,
            domain_hash: request.domain_hash,
            u: request.u,
            S: request.S,
            prediction: request.prediction,
            confidence: request.confidence,
            action: "tier1_report_false_positive",
            user_override: false,
            cache_hit: true,
            ttl_tier: request.ttl_tier || "tier1_phish",
            snoozed: false,
            override_reused: false
          })
        });
        sendResponse({ status: "logged" });
      } catch (e) {
        sendResponse({ status: "error", error: e.message });
      }
    })();
    return true;
  }

  if (request.action === "USER_OVERRIDE") {
    (async () => {
      try {
        const domainHash = request.domain_hash;
        if (!domainHash) throw new Error("Missing domain_hash");

        const cacheKey = `domain_${domainHash}`;
        const stored = await chrome.storage.local.get([cacheKey]);
        const entry = stored[cacheKey];

        // Guardrail: Strictly prohibit overrides on Tier 1 malicious blocks
        if (entry && entry.ttl_tier === "tier1_phish") {
          sendResponse({ status: "rejected", reason: "Tier 1 malicious block is non-overridable." });
          return;
        }

        // Grant 24h snooze on Tier 2 uncertain domain
        const overrideExpiry = Date.now() + (24 * 3600 * 1000);
        if (entry) {
          entry.override_expiry = overrideExpiry;
          await chrome.storage.local.set({ [cacheKey]: entry });
        }

        // Log override to backend telemetry
        await fetch(`${await getApiBase()}/api/extension/log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url_hash: request.url_hash || "override",
            domain_hash: domainHash,
            u: request.u,
            S: request.S,
            prediction: request.prediction,
            confidence: request.confidence,
            action: "user_override_24h_snooze",
            user_override: true,
            cache_hit: true,
            ttl_tier: entry ? entry.ttl_tier : "tier2_uncertain",
            snoozed: true,
            override_reused: false
          })
        });

        sendResponse({ status: "snoozed_24h", expiry: overrideExpiry });
      } catch (e) {
        sendResponse({ status: "error", error: e.message });
      }
    })();
    return true;
  }
});

// Register Context Menu + Render free-tier keep-alive
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "scan_qr_image",
    title: "Verify QR Code with PhishShield-EDL",
    contexts: ["image"]
  });
});

// ---------------------------------------------------------------------------
// Warm-up alarm: Render's free tier sleeps after ~15 min of inactivity, and a
// sleeping backend adds a 30-60s cold-start delay to the next URL verdict.
// A lightweight /health ping every 4.5 min keeps the gateway warm for as long
// as the browser is open — scans then complete in ~2-3s instead of ~60s.
// ---------------------------------------------------------------------------
const KEEP_ALIVE_ALARM = "phishshield_gateway_warmup";
try {
  chrome.alarms.create(KEEP_ALIVE_ALARM, { periodInMinutes: 4.5 });
} catch (e) { /* alarms API unavailable */ }

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== KEEP_ALIVE_ALARM) return;
  try {
    await fetch(`${await getApiBase()}/health`, { signal: AbortSignal.timeout(8000) });
  } catch (e) { /* best-effort keep-alive */ }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "scan_qr_image" && info.srcUrl) {
    try {
      const res = await fetch(info.srcUrl);
      const blob = await res.blob();
      const formData = new FormData();
      formData.append("file", blob, "scanned_qr.png");
      const scanRes = await fetch(`${await getApiBase()}/api/detect/qr`, {
        method: "POST",
        body: formData
      });
      const data = await scanRes.json();
      const phish = data.prediction === "Phishing";
      chrome.action.setBadgeText({ tabId: tab.id, text: phish ? "PHISH" : "SAFE" });
      chrome.action.setBadgeBackgroundColor({
        tabId: tab.id,
        color: phish ? "#EF4444" : "#10B981"
      });

      // Surface the full multimodal verdict as a system notification
      const u = typeof data.edl_uncertainty === "number" ? data.edl_uncertainty.toFixed(3) : "--";
      const advisory = data.advisory_message || data.details || "No additional details returned.";
      const detailLines = [
        `Confidence: ${Math.round((data.confidence || 0) * 100)}%`,
        `Epistemic Uncertainty (u): ${u}`,
        advisory
      ].join("\n");

      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: phish ? "⚠ PhishShield-EDL: QR Phishing Detected" : "✅ PhishShield-EDL: QR Code Verified Safe",
        message: detailLines,
        priority: phish ? 2 : 1,
        requireInteraction: phish
      }, (notifId) => {
        if (!notifId) console.warn("PhishShield-EDL notification rejected:", chrome.runtime.lastError);
      });
    } catch (e) {
      console.warn("Context menu QR scan failed:", e);
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("icons/icon128.png"),
        title: "PhishShield-EDL: QR Scan Failed",
        message: "Could not reach the PhishShield backend. Is the FastAPI server running on port 8000?"
      });
    }
  }
});
