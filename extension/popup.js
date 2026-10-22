// PhishShield-EDL Popup Script (Usable Security & Guardrailed Snooze Edition)
document.addEventListener("DOMContentLoaded", async () => {
  const urlText = document.getElementById("url-text");
  const verdictBox = document.getElementById("verdict-box");
  const verdictTitle = document.getElementById("verdict-title");
  const verdictSubtitle = document.getElementById("verdict-subtitle");
  const valConf = document.getElementById("val-conf");
  const valLat = document.getElementById("val-lat");
  const valU = document.getElementById("val-u");
  const valS = document.getElementById("val-s");
  const uBar = document.getElementById("u-bar");
  const btnOverride = document.getElementById("btn-override");

  let activeRecord = null;

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) {
    urlText.innerText = "No active web page detected.";
    return;
  }

  urlText.innerText = tab.url;

  // Retrieve cached scan + automatic-QR findings for this tab
  const qrKey = `qr_${tab.id}`;
  chrome.storage.local.get([tab.id.toString(), qrKey], (result) => {
    const qrData = result[qrKey];
    if (qrData && qrData.prediction === "Phishing") {
      const qrAlert = document.getElementById("qr-alert");
      qrAlert.style.display = "block";
      document.getElementById("qr-alert-text").innerText =
        `Auto-verify: embedded QR is PHISHING (${Math.round((qrData.confidence || 0) * 100)}%). ${qrData.details || qrData.advisory_message || "Do not scan it with your phone."}`;
    }

    const data = result[tab.id.toString()];
    if (!data) {
      verdictTitle.innerText = "QUEUED / UNPROTECTED";
      verdictSubtitle.innerText = "Navigate to a URL or reload page to scan.";
      btnOverride.style.display = "none";
      return;
    }

    activeRecord = data;

    // Render Verdict Box
    const isPhish = data.prediction === "Phishing" || data.ttl_tier === "tier1_phish";
    const isUncertain = data.ttl_tier === "tier2_uncertain" || (data.edl_uncertainty && data.edl_uncertainty >= 0.35);
    const boxClass = isPhish ? "phishing" : isUncertain ? "suspicious" : "safe";

    verdictBox.className = `verdict-box ${boxClass}`;
    verdictTitle.innerText = (data.prediction || "UNKNOWN").toUpperCase();

    // Cache info in subtitle
    let cacheInfo = "";
    if (data.cache_hit) {
      cacheInfo = data.ttl_tier === "tier3_safe" ? " [Cached: 7d TTL]" : " [Cached eTLD+1]";
    } else {
      cacheInfo = " [Live Neural Inferred]";
    }

    verdictSubtitle.innerText = (data.advisory_message || (isPhish ? "Critical threat detected!" : "Legitimate domain structure")) + cacheInfo;

    valConf.innerText = `${Math.round((data.confidence || 0) * 100)}%`;
    valLat.innerText = `${data.latency_ms !== undefined ? data.latency_ms : 0} ms`;

    // Render EDL Uncertainty
    const u = typeof data.edl_uncertainty === "number" ? data.edl_uncertainty : 0.0;
    const s = typeof data.edl_strength === "number" ? data.edl_strength : 2.0;

    valU.innerText = u.toFixed(4);
    valS.innerText = s.toFixed(2);
    uBar.style.width = `${Math.min(100, Math.max(5, u * 100))}%`;

    if (u >= 0.70) {
      valU.style.color = "#a855f7"; // Purple for zero-day alert
    } else if (u >= 0.35) {
      valU.style.color = "#f59e0b"; // Amber for drift
    } else {
      valU.style.color = "#10b981"; // Emerald for safe
    }

    // Guardrail Button State
    if (isPhish) {
      // Tier 1 Block: Never allow override
      btnOverride.innerText = "Strict Block: Non-Overridable (Tier 1 Phish)";
      btnOverride.disabled = true;
      btnOverride.style.opacity = "0.5";
      btnOverride.style.cursor = "not-allowed";
      btnOverride.style.borderColor = "#ef4444";
      btnOverride.style.color = "#ef4444";
    } else if (isUncertain) {
      if (data.override_reused || (data.override_expiry && data.override_expiry > Date.now())) {
        btnOverride.innerText = "Warnings Snoozed for 24h (Active)";
        btnOverride.disabled = true;
        btnOverride.style.borderColor = "#10b981";
        btnOverride.style.color = "#10b981";
      } else {
        btnOverride.innerText = "Snooze Warnings for 24h (Proceed)";
        btnOverride.disabled = false;
        btnOverride.style.borderColor = "#f59e0b";
        btnOverride.style.color = "#f59e0b";
      }
    } else {
      // Tier 3 Safe
      btnOverride.innerText = "Report Anomaly / Misclassification";
      btnOverride.disabled = false;
    }
  });

  // Handle user override action
  btnOverride.addEventListener("click", () => {
    if (!activeRecord) return;
    btnOverride.innerText = "Applying 24h Snooze...";
    btnOverride.disabled = true;

    chrome.runtime.sendMessage({
      action: "USER_OVERRIDE",
      url_hash: activeRecord.url_hash,
      domain_hash: activeRecord.domain_hash,
      u: activeRecord.edl_uncertainty,
      S: activeRecord.edl_strength,
      edl_uncertainty: activeRecord.edl_uncertainty,
      edl_strength: activeRecord.edl_strength,
      latency_ms: activeRecord.latency_ms,
      prediction: activeRecord.prediction,
      confidence: activeRecord.confidence
    }, (resp) => {
      if (resp && resp.status === "snoozed_24h") {
        btnOverride.innerText = "Snoozed for 24h (Active)";
        btnOverride.style.borderColor = "#10b981";
        btnOverride.style.color = "#10b981";
      } else if (resp && resp.status === "rejected") {
        btnOverride.innerText = "Rejected: " + resp.reason;
        btnOverride.style.borderColor = "#ef4444";
        btnOverride.style.color = "#ef4444";
      } else {
        btnOverride.innerText = "Feedback Logged";
        btnOverride.style.borderColor = "#10b981";
        btnOverride.style.color = "#10b981";
      }
    });
  });
});
