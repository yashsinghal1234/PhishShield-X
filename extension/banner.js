// PhishShield-EDL On-Page Warning Banner (Usable Security: Habituation-Aware Friction)
(function () {
  "use strict";
  if (window !== window.top) return; // Top frame only — ignore ads/iframes

  chrome.runtime.sendMessage({ action: "GET_TAB_RECORD" }, (rec) => {
    if (chrome.runtime.lastError || !rec) return;

    const snoozed =
      rec.override_reused ||
      (rec.override_expiry && rec.override_expiry > Date.now());

    if (rec.ttl_tier === "tier1_phish") {
      showBanner(rec, "danger", snoozed);
    } else if (rec.ttl_tier === "tier2_uncertain" && !snoozed) {
      showBanner(rec, "warn", false);
    }
  });

  function showBanner(rec, kind, snoozed) {
    if (document.getElementById("ps-edl-banner")) return;

    const isDanger = kind === "danger";
    const banner = document.createElement("div");
    banner.id = "ps-edl-banner";

    const bg = isDanger
      ? "linear-gradient(90deg, #7f1d1d, #450a0a)"
      : "linear-gradient(90deg, #78350f, #45230a)";
    const accent = isDanger ? "#ef4444" : "#f59e0b";

    banner.style.cssText = [
      "position: fixed",
      "top: 0",
      "left: 0",
      "right: 0",
      "z-index: 2147483647",
      `background: ${bg}`,
      "color: #f8fafc",
      "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      "font-size: 12px",
      "padding: 9px 16px",
      "box-shadow: 0 2px 14px rgba(0,0,0,0.45)",
      "display: flex",
      "align-items: center",
      "gap: 12px"
    ].join(";");

    const icon = document.createElement("span");
    icon.style.cssText = `font-size:16px; flex-shrink:0; filter: drop-shadow(0 0 6px ${accent});`;
    icon.innerText = isDanger ? "🛡" : "⚠";

    const text = document.createElement("div");
    text.style.cssText = "flex:1; min-width:0; line-height:1.35;";
    const title = document.createElement("div");
    title.style.cssText = "font-weight:700; letter-spacing:0.3px;";
    title.innerText = isDanger
      ? "PhishShield-EDL: CONFIRMED PHISHING THREAT"
      : "PhishShield-EDL: Suspicious / Evidentially Uncertain Site";
    const meta = document.createElement("div");
    meta.style.cssText = "opacity:0.85; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;";
    const u = typeof rec.edl_uncertainty === "number" ? rec.edl_uncertainty.toFixed(2) : "--";
    meta.innerText =
      (rec.advisory_message || (isDanger ? "High-confidence phishing verdict." : "Proceed with caution — never enter credentials or payment details.")) +
      `  |  u = ${u}`;
    text.appendChild(title);
    text.appendChild(meta);

    banner.appendChild(icon);
    banner.appendChild(text);

    // Snooze button only for Tier-2 uncertainty (Tier-1 is non-overridable)
    if (!isDanger && !snoozed) {
      const snoozeBtn = document.createElement("button");
      snoozeBtn.innerText = "Snooze 24h";
      snoozeBtn.style.cssText = [
        "flex-shrink:0",
        "padding: 5px 12px",
        "border-radius: 6px",
        "border: 1px solid rgba(255,255,255,0.35)",
        "background: rgba(255,255,255,0.12)",
        "color: #fff",
        "font-size: 11px",
        "font-weight: 600",
        "cursor: pointer"
      ].join(";");

      snoozeBtn.addEventListener("click", () => {
        snoozeBtn.innerText = "Applying…";
        snoozeBtn.disabled = true;
        chrome.runtime.sendMessage({
          action: "USER_OVERRIDE",
          url_hash: rec.url_hash,
          domain_hash: rec.domain_hash,
          u: rec.edl_uncertainty,
          S: rec.edl_strength,
          edl_uncertainty: rec.edl_uncertainty,
          edl_strength: rec.edl_strength,
          prediction: rec.prediction,
          confidence: rec.confidence
        }, (resp) => {
          if (resp && resp.status === "snoozed_24h") {
            title.innerText = "PhishShield-EDL: Warnings Snoozed for 24h";
            meta.innerText = `Trust override active until ${new Date(resp.expiry).toLocaleTimeString()} on this domain.`;
            snoozeBtn.remove();
            setTimeout(() => banner.remove(), 4000);
          } else {
            snoozeBtn.innerText = "Retry";
            snoozeBtn.disabled = false;
          }
        });
      });
      banner.appendChild(snoozeBtn);
    }

    // Dismiss (per-page-view only — does not weaken the domain cache guardrail)
    const dismiss = document.createElement("button");
    dismiss.innerText = "✕";
    dismiss.style.cssText = [
      "flex-shrink:0",
      "background: transparent",
      "border: none",
      "color: rgba(255,255,255,0.6)",
      "font-size: 13px",
      "cursor: pointer",
      "padding: 4px 6px"
    ].join(";");
    dismiss.addEventListener("click", () => banner.remove());
    banner.appendChild(dismiss);

    document.documentElement.appendChild(banner);
  }
})();
