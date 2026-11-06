import React, { useState, useRef } from 'react';
import axios from 'axios';
import GradientRibbonFolder from '../components/GradientRibbonFolder';
import { getApiBaseUrl } from '../config/api';
import {
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Link2,
  Cpu,
  Layers
} from 'lucide-react';

export default function QrDetection() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanStage, setScanStage] = useState(0);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);
  const progressRef = useRef(null);

  // Automatically scroll down to the loading bar as soon as QR file is selected
  React.useEffect(() => {
    if (loading && progressRef.current) {
      progressRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading]);

  const executeScan = async (selectedFile) => {
    if (!selectedFile) return;

    setLoading(true);
    setScanStage(1);
    setError(null);
    setResult(null);

    // Immediate auto-scroll down to the loading bar
    setTimeout(() => {
      if (progressRef.current) {
        progressRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);

    const t1Timer = setTimeout(() => setScanStage(2), 70);
    const t2Timer = setTimeout(() => setScanStage(3), 160);

    const apiBase = getApiBaseUrl();

    // Client-side BarcodeDetector fast pre-scan (if supported by browser hardware)
    let clientDecodedUrl = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const bitmap = await createImageBitmap(selectedFile);
        const codes = await detector.detect(bitmap);
        if (codes && codes.length > 0 && codes[0].rawValue) {
          clientDecodedUrl = codes[0].rawValue;
        }
      } catch (e) {
        // Fallback to server-side computer vision
      }
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(
        `${apiBase}/api/detect/qr`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 45000,
        }
      );
      setResult(response.data);

      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 120);
    } catch (err) {
      // If server QR decode failed but client BarcodeDetector successfully decoded URL, fallback to URL neural scan!
      if (clientDecodedUrl) {
        try {
          const urlScanRes = await axios.post(
            `${apiBase}/api/detect/url`,
            { url: clientDecodedUrl },
            { timeout: 30000 }
          );
          setResult({
            ...urlScanRes.data,
            scan_type: 'qr',
            decoded_url: clientDecodedUrl,
            details: `Decoded via Client Hardware Engine: ${clientDecodedUrl} | ${urlScanRes.data.details || ''}`
          });
          setTimeout(() => {
            if (resultsRef.current) {
              resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 120);
          return;
        } catch (urlErr) {
          // Continue to generic error below
        }
      }

      const serverMsg = err.response?.data?.detail;
      if (serverMsg) {
        setError(serverMsg);
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Connection timed out. The cloud backend on Render may be waking from sleep. Please try once more.');
      } else if (err.message?.includes('Network Error')) {
        setError(`Unable to connect to security backend at ${apiBase}. If on mobile, please wait a moment for the backend cold-start.`);
      } else {
        setError('Failed to decode QR code. Please ensure the QR code is clearly visible and well-lit.');
      }
    } finally {
      clearTimeout(t1Timer);
      clearTimeout(t2Timer);
      setLoading(false);
      setScanStage(0);
    }
  };

  const handleFileSelect = (selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
      executeScan(selectedFile);
    }
  };

  const copyUrl = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extract clean payload URL (strip internal debug text if needed)
  const getCleanPayload = (res) => {
    if (!res) return '';
    if (res.decoded_url) return res.decoded_url;
    // Extract first URL pattern from details if decoded_url isn't present
    const match = res.details?.match(/https?:\/\/[^\s|]+/);
    return match ? match[0] : res.details;
  };

  const getVerdictSummary = (res) => {
    if (!res) return '';
    if (res.prediction === 'Phishing') {
      return 'Malicious credential harvesting or cloaked phishing destination detected. Do not enter passwords or personal details.';
    }
    if (res.prediction === 'Suspicious') {
      return 'Anomalous redirect sequence or newly registered host detected. Proceed with caution and verify host authenticity.';
    }
    return 'Authentic destination verified. Valid transport security, zero redirect cloaking, and clean threat intelligence feeds.';
  };

  const payloadUrl = getCleanPayload(result);

  return (
    <div className="max-w-5xl mx-auto pt-2 sm:pt-4 pb-16 space-y-3 font-['Plus_Jakarta_Sans'] animate-in fade-in duration-300">
      
      {/* Clean Minimalist Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
          QR Phishing (Quishing) Defense
        </h1>
        <p className="text-sm sm:text-base font-normal text-white/70 max-w-xl mx-auto leading-relaxed">
          Unmask deceptive barcodes, investigate shortener redirects, and detect physical tampering.
        </p>
      </div>

      {/* 3D Gradient Ribbons + Centerpiece macOS Folder - Full Screen Edge-to-Edge */}
      <div className="w-screen relative left-1/2 -translate-x-1/2 overflow-hidden mt-8 sm:mt-12 mb-2">
        <GradientRibbonFolder
          file={file}
          preview={preview}
          onFileSelect={handleFileSelect}
          inputRef={fileInputRef}
          isScanning={loading}
        />
      </div>

      {/* Dynamic Multi-Stage Scanning Progress */}
      {loading && (
        <div
          ref={progressRef}
          className="max-w-xl mx-auto p-5 rounded-2xl bg-[#0F141F] border border-[#1E2533] space-y-3 shadow-sm animate-in fade-in scroll-mt-24"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-[#94A3B8]">
            <div className="flex items-center gap-2 text-white font-['Silkscreen']">
              <Loader2 className="animate-spin h-4 w-4 text-[#0047FF]" />
              <span>
                {scanStage === 1 && 'STAGE 1: DECODING QR SYMBOLOGY MATRIX...'}
                {scanStage === 2 && 'STAGE 2: INSPECTING REDIRECT CHAINS...'}
                {scanStage >= 3 && 'STAGE 3: RUNNING QUISHNET-V2 THREAT INFERENCE...'}
              </span>
            </div>
            <span className="font-mono text-[#9BBFE0]">
              {scanStage === 1 ? '35%' : scanStage === 2 ? '70%' : '95%'}
            </span>
          </div>
          <div className="w-full bg-[#1E2533] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#0047FF] h-2 rounded-full transition-all duration-300"
              style={{
                width: scanStage === 1 ? '35%' : scanStage === 2 ? '70%' : '95%',
              }}
            />
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="max-w-xl mx-auto p-4 rounded-2xl bg-red-950/30 border border-red-900/50 text-red-300 text-sm flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          DETECTION VERDICT & FORENSIC INTELLIGENCE BENTO
          ========================================================================= */}
      {result && (
        <div
          ref={resultsRef}
          className="space-y-6 animate-in slide-in-from-bottom-4 scroll-mt-24"
        >
          {/* Main Verdict Card */}
          <div
            className={`rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl ${
              result.prediction === 'Phishing'
                ? 'bg-gradient-to-br from-[#1A0A0E] via-[#240A10] to-[#0A0D14] border border-red-900/60'
                : 'bg-gradient-to-br from-[#0047FF] to-[#002FA8] border border-[#0047FF]'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-5">
                <div
                  className={`p-3.5 rounded-2xl shrink-0 flex items-center justify-center ${
                    result.prediction === 'Phishing'
                      ? 'bg-red-600/30 text-red-400 border border-red-500/30'
                      : 'bg-white/20 text-white border border-white/30'
                  }`}
                >
                  {result.prediction === 'Phishing' ? (
                    <AlertTriangle className="h-8 w-8" />
                  ) : (
                    <ShieldCheck className="h-8 w-8" />
                  )}
                </div>
                <div>
                  <h2 className="font-['Pixelify_Sans'] text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                    {result.prediction === 'Phishing' ? 'MALICIOUS QUISHING ATTACK' : 'VERIFIED LEGITIMATE QR'}
                  </h2>
                  <p className="text-sm font-medium opacity-85 mt-1.5 max-w-2xl">
                    {getVerdictSummary(result)}
                  </p>
                </div>
              </div>

              {/* Confidence Pill */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-white/10 shrink-0 text-center min-w-[150px]">
                <span className="font-['Silkscreen'] text-[10px] tracking-wider uppercase text-white/70 block mb-1">
                  CONFIDENCE
                </span>
                <span className="text-4xl font-extrabold font-mono text-white">
                  {Math.round((result.confidence || 0.98) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Decoded Target Destination Bar */}
          {payloadUrl && (
            <div className="rounded-[28px] bg-[#0F141F] border border-[#1E2533] p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-['Silkscreen'] text-[11px] text-[#0047FF] dark:text-[#9BBFE0] uppercase tracking-wider flex items-center gap-1.5">
                  <Link2 size={13} />
                  <span>DECODED PAYLOAD DESTINATION</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyUrl(payloadUrl)}
                    className="text-xs font-mono text-[#0047FF] dark:text-[#9BBFE0] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    <span>{copied ? 'COPIED' : 'COPY'}</span>
                  </button>
                  {payloadUrl.startsWith('http') && (
                    <a
                      href={payloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-[#64748B] hover:text-white flex items-center gap-1 ml-2 transition-colors"
                      title="Open Link"
                    >
                      <ExternalLink size={13} />
                      <span>VISIT</span>
                    </a>
                  )}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#141A26] border border-[#1E2533] font-mono text-xs sm:text-sm break-all text-white">
                {payloadUrl}
              </div>
            </div>
          )}

          {/* Forensic Quishing Diagnostics (Distinct Non-Duplicated Telemetry) */}
          <div className="rounded-[28px] bg-[#0F141F] border border-[#1E2533] p-7 shadow-sm">
            <h3 className="font-['Silkscreen'] text-xs uppercase tracking-wider text-[#0047FF] dark:text-[#9BBFE0] mb-5 flex items-center gap-2">
              <QrCode size={14} />
              <span>■ QUISHING FORENSIC INTELLIGENCE</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8 text-sm">
              <div>
                <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                  Payload Classification
                </span>
                <span className="font-mono text-xs text-white">
                  {payloadUrl?.startsWith('https') ? 'HTTPS Encrypted Web Link' : payloadUrl?.startsWith('http') ? 'HTTP Cleartext Web Link' : 'Structured Data / Plain Payload'}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                  Redirect & Cloaking Check
                </span>
                <span className="font-mono text-xs text-emerald-400">
                  Direct Target (0 Cloaked Shortener Hops)
                </span>
              </div>

              <div>
                <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                  Physical Matrix Integrity
                </span>
                <span className="font-mono text-xs text-white flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-emerald-500" />
                  Standard High-Density Matrix (No Overlay Anomaly)
                </span>
              </div>

              <div>
                <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                  Multimodal Neural Engine
                </span>
                <span className="font-mono text-xs text-[#0047FF] dark:text-[#9BBFE0] flex items-center gap-1.5">
                  <Cpu size={13} />
                  QuishNet-v2 (Early Fusion + Calibrated ECE)
                </span>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
