// PhishShield-EDL Block Page Logic (MV3 CSP compliant — no inline scripts)
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const blockId = params.get("block");
  const btnBack = document.getElementById("btn-back");
  const btnReport = document.getElementById("btn-report");
  const blockedUrl = document.getElementById("blocked-url");

  let record = null;

  if (blockId) {
    const blockKey = `block_${blockId}`;
    chrome.storage.local.get([blockKey], (result) => {
      record = result[blockKey];
      render(record);
    });
  } else {
    render(null);
  }

  function render(rec) {
    if (!rec) {
      blockedUrl.innerText = "Details unavailable (record expired).";
      return;
    }
    blockedUrl.innerText = rec.url || rec.etld_plus_one || "Unknown destination";
    if (rec.advisory_message) {
      document.getElementById("advisory").innerText = rec.advisory_message;
    }
    document.getElementById("m-conf").innerText =
      rec.confidence != null ? `${Math.round(rec.confidence * 100)}%` : "--";
    document.getElementById("m-u").innerText =
      rec.edl_uncertainty != null ? Number(rec.edl_uncertainty).toFixed(4) : "--";
    document.getElementById("m-s").innerText =
      rec.edl_strength != null ? Number(rec.edl_strength).toFixed(2) : "--";
  }

  btnBack.addEventListener("click", () => {
    // Try to return to the previous safe page; fall back to a blank new tab.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "about:blank";
    }
  });

  btnReport.addEventListener("click", () => {
    if (!record) return;
    btnReport.innerText = "Logging report…";
    btnReport.disabled = true;
    chrome.runtime.sendMessage({
      action: "REPORT_FALSE_POSITIVE",
      url_hash: record.url_hash || "unknown",
      domain_hash: record.domain_hash,
      u: record.edl_uncertainty,
      S: record.edl_strength,
      prediction: record.prediction,
      confidence: record.confidence,
      ttl_tier: record.ttl_tier
    }, (resp) => {
      if (chrome.runtime.lastError) {
        btnReport.innerText = "Report failed — try again";
        btnReport.disabled = false;
        return;
      }
      if (resp && resp.status === "logged") {
        btnReport.innerText = "Reported ✓ (Feedback logged)";
      } else {
        btnReport.innerText = "Report failed — try again";
        btnReport.disabled = false;
      }
    });
  });
});
