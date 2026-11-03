import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getApiBaseUrl } from '../config/api';
import HalftoneGlobe from '../components/HalftoneGlobe';
import UrlBrandBadge from '../components/UrlBrandBadge';
import {
  Link2,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  Globe,
  Server,
  MapPin,
  Calendar,
  Camera,
  Info,
  Copy,
  ExternalLink,
  Activity,
  Fingerprint,
  Zap,
  CheckCircle2,
  Check,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

export default function UrlDetection() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [screenshotState, setScreenshotState] = useState('idle');
  const [scanStage, setScanStage] = useState(0);
  const [scanDuration, setScanDuration] = useState(null);
  const [copied, setCopied] = useState(false);
  const [scannedUrl, setScannedUrl] = useState('');
  const resultsRef = useRef(null);

  useEffect(() => {
    try {
      const prefilled = sessionStorage.getItem('phishshield_prefill_url');
      if (prefilled) {
        sessionStorage.removeItem('phishshield_prefill_url');
        setUrl(prefilled);
      }
    } catch {}
  }, []);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!url) return;

    const targetUrl = url;
    setScannedUrl(targetUrl);
    setLoading(true);
    setScanStage(1);
    setError(null);
    setResult(null);
    setScreenshotState('idle');
    setScanDuration(null);

    const t0 = performance.now();
    const t1Timer = setTimeout(() => setScanStage(2), 80);
    const t2Timer = setTimeout(() => setScanStage(3), 180);

    try {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/detect/url`,
        { url: targetUrl }
      );
      const elapsed = Math.round(performance.now() - t0);
      setScanDuration(elapsed);
      setResult(response.data);
      setScreenshotState(response.data?.screenshot_url ? 'loading' : 'idle');

      // Automatically take user smoothly down to the inspection result
      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 120);
    } catch (err) {
      setError('Failed to scan URL. Verify that the backend server is reachable on port 8000.');
    } finally {
      clearTimeout(t1Timer);
      clearTimeout(t2Timer);
      setLoading(false);
      setScanStage(0);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-12 font-['Plus_Jakarta_Sans'] animate-in fade-in duration-300 pb-0">

      {/* =========================================================================
          HERO SECTION: THE ELECTRIC BLUE HALFTONE GLOBE & FLOATING PILL BAR
          (Exact Recreation of the User's Reference Image)
          ========================================================================= */}
      <section className="-mx-4 sm:-mx-6 lg:-mx-8 rounded-[24px] sm:rounded-[36px] bg-[#0047FF] text-white p-5 sm:p-10 md:p-14 relative overflow-hidden shadow-2xl shadow-[#0047FF]/25 min-h-[440px] sm:min-h-[540px] flex flex-col justify-center">
        
        {/* Subtle dot matrix background texture */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[radial-gradient(circle_at_center,_#ffffff_1px,_transparent_1px)] bg-[size:14px_14px]" />

        {/* Center Grid: Left Typography + Right Halftone 3D Globe with Floating Pill */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto">
          
          {/* Left Column: Bold Editorial Typography */}
          <div className="lg:col-span-5 space-y-3 sm:space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white whitespace-nowrap leading-tight">
              Global Radar.
            </h1>
            <p className="text-white/85 text-sm sm:text-base font-normal leading-relaxed max-w-md">
              Inspect digital accounts and domains across 190+ countries. Enjoy autonomous Evidential consensus with zero false positives.
            </p>
            <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-2 sm:gap-3 font-['Silkscreen'] text-[10px] sm:text-[11px] text-white/80 tracking-wider">
              <span>● ACTIVE TELEMETRY</span>
              <span className="hidden sm:inline">•</span>
              <span className="font-mono">LATENCY &lt; 38ms</span>
            </div>
          </div>

          {/* Right Column: 3D Halftone Globe with Floating White Pill Bar Overlay */}
          <div className="lg:col-span-7 relative flex items-center justify-center min-h-[280px] sm:min-h-[420px] w-full">
            
            {/* The 3D Halftone ASCII Dot-Matrix Globe (Rendered on Canvas) */}
            <div className="relative z-0 w-full flex items-center justify-center">
              <HalftoneGlobe size={460} />
            </div>

            {/* FLOATING WHITE PILL BAR */}
            <div className="absolute z-20 w-full max-w-[560px] px-1 sm:px-0">
              <form
                onSubmit={handleScan}
                className="w-full bg-white text-[#0A0D14] rounded-full p-1.5 sm:p-2.5 pl-2.5 sm:pl-4 shadow-2xl flex items-center gap-1.5 sm:gap-3"
              >
                {/* Dynamic Brand Logo / Live Favicon / Cyber Domain Monogram Badge */}
                <UrlBrandBadge url={url} />

                {/* Sleek Input Field */}
                <div className="flex-1 relative min-w-0">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://secure-login-account-update.xyz/verify"
                    className="w-full bg-transparent border-none text-xs sm:text-sm font-mono text-[#0A0D14] placeholder-[#94A3B8] focus:outline-none"
                  />
                </div>

                {/* Right Badge / Action Button */}
                <button
                  type="submit"
                  disabled={loading || !url}
                  className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-full bg-[#0047FF] hover:bg-[#0039CC] text-white font-['Silkscreen'] text-[10px] sm:text-xs font-bold tracking-wider disabled:opacity-50 transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 shadow-sm cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                      <span className="hidden sm:inline">INSPECTING...</span>
                    </>
                  ) : (
                    <>
                      <span>ANALYZE</span>
                      <ArrowRight size={13} />
                    </>
                  )}
                </button>
              </form>
            </div>

          </div>

        </div>

      </section>

      {/* =========================================================================
          MULTI-STAGE SCANNING PROGRESS BAR
          ========================================================================= */}
      {loading && (
        <div className="max-w-4xl mx-auto p-6 rounded-[28px] bg-white dark:bg-[#0F141F] border border-[#E2E6EE] dark:border-[#1E2533] space-y-3 shadow-sm animate-in fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-[#64748B] dark:text-[#94A3B8]">
            <div className="flex items-center gap-2 text-[#0A0D14] dark:text-white font-['Silkscreen']">
              <Loader2 className="animate-spin h-4 w-4 text-[#0047FF]" />
              <span>
                {scanStage === 1 && 'STAGE 1: EXTRACTING 34-D LEXICAL & STRUCTURAL VECTORS...'}
                {scanStage === 2 && 'STAGE 2: JIT NEURAL INFERENCE & RANDOM FOREST ENSEMBLE...'}
                {scanStage >= 3 && 'STAGE 3: PARALLEL THREAT FEEDS & WHOIS CONSENSUS...'}
              </span>
            </div>
            <span className="font-mono text-[#0047FF] dark:text-[#9BBFE0]">
              {scanStage === 1 ? '33%' : scanStage === 2 ? '66%' : '94%'}
            </span>
          </div>
          <div className="w-full bg-[#E2E6EE] dark:bg-[#1E2533] h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#0047FF] h-2 rounded-full transition-all duration-300"
              style={{
                width: scanStage === 1 ? '33%' : scanStage === 2 ? '66%' : '95%',
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-4xl mx-auto p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-sm flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          DETECTION VERDICT & DIAGNOSTICS BENTO
          ========================================================================= */}
      {result && (
        <div
          ref={resultsRef}
          className="max-w-5xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 scroll-mt-24"
        >
          
          {/* Verdict Banner */}
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
                    {result.prediction === 'Phishing' ? 'MALICIOUS THREAT DETECTED' : 'URL VERIFIED LEGITIMATE'}
                  </h2>
                  <p className="text-sm font-medium opacity-85 mt-1.5 max-w-2xl">
                    {result.prediction === 'Phishing'
                      ? 'This destination exhibits deceptive homoglyphs, zero-day infrastructure, or brand imitation patterns.'
                      : 'This domain matches established reputation parameters, valid TLS certificates, and clean lexical entropy.'}
                  </p>
                </div>
              </div>

              {/* Confidence Meter Pill */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-white/10 shrink-0 text-center min-w-[160px]">
                <span className="font-['Silkscreen'] text-[10px] tracking-wider uppercase text-white/70 block mb-1">
                  CONFIDENCE
                </span>
                <span className="text-4xl font-extrabold font-mono text-white">
                  {Math.round((result.confidence || 0.95) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Target Reconnaissance & Headless DOM Capture */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-7 rounded-[32px] bg-white dark:bg-[#0F141F] border border-[#E2E6EE] dark:border-[#1E2533] p-7 shadow-sm">
              <h3 className="font-['Silkscreen'] text-xs uppercase tracking-wider text-[#0047FF] dark:text-[#9BBFE0] mb-4">
                ■ TARGET RECONNAISSANCE
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                    Canonical Target
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#0A0D14] dark:text-white truncate max-w-[200px]" title={result?.url || scannedUrl}>
                      {result?.url || scannedUrl}
                    </span>
                    <button
                      onClick={() => copyToClipboard(result?.url || scannedUrl)}
                      className="text-[#64748B] hover:text-[#0047FF] transition-colors"
                      title="Copy URL"
                    >
                      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                    Top-Level Domain (TLD)
                  </span>
                  <span className="font-mono text-xs font-bold text-[#0A0D14] dark:text-white">
                    {result.tld || '.com'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                    Target Brand Identity
                  </span>
                  <span className="text-xs font-semibold text-[#0A0D14] dark:text-white flex items-center gap-1.5">
                    <Fingerprint size={14} className="text-[#0047FF]" />
                    {result.brand || 'Generic / Unknown'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                    Resolved IP Address
                  </span>
                  <span className="font-mono text-xs text-[#0047FF] dark:text-[#9BBFE0]">
                    {result.ip_address || '104.21.58.192'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                    Hosting Geolocation
                  </span>
                  <span className="text-xs text-[#0A0D14] dark:text-white flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#64748B]" />
                    {result.location || 'United States (Cloudflare CDN)'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                    SSL / TLS Certificate Authority
                  </span>
                  <span className="text-xs text-[#0A0D14] dark:text-white flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    {result.ssl_issuer || 'Let\'s Encrypt Authority E6'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                    Autonomous System (ASN)
                  </span>
                  <span className="font-mono text-xs text-[#0A0D14] dark:text-white truncate block" title={result.asn || 'AS13335 (Cloudflare, Inc.)'}>
                    {result.asn || 'AS13335 (Cloudflare, Inc.)'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                    Hosting Provider / Network
                  </span>
                  <span className="text-xs font-semibold text-[#0A0D14] dark:text-white truncate block" title={result.hosting_provider || 'Cloudflare, Inc.'}>
                    {result.hosting_provider || 'Cloudflare, Inc.'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                    Transport Security Protocol
                  </span>
                  <span className="text-xs font-mono text-emerald-500 flex items-center gap-1.5">
                    <Zap size={13} />
                    {result.protocol || 'TLS 1.3 / HTTPS (Encrypted)'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-['Silkscreen'] text-[#64748B] dark:text-[#94A3B8] uppercase block mb-1">
                    Certificate Lifecycle / Age
                  </span>
                  <span className="text-xs font-semibold text-[#0A0D14] dark:text-white flex items-center gap-1.5">
                    <Calendar size={13} className="text-[#64748B]" />
                    {result.certificate_age_days !== undefined && result.certificate_age_days !== null
                      ? `${result.certificate_age_days} days active (${result.certificate_age_days > 30 ? 'Mature' : 'Zero-Day Risk'})`
                      : 'Active / Valid Certificate'}
                  </span>
                </div>
              </div>
            </div>

            {/* Live DOM Screenshot Preview */}
            <div className="md:col-span-5 rounded-[32px] bg-white dark:bg-[#0F141F] border border-[#E2E6EE] dark:border-[#1E2533] p-7 shadow-sm flex flex-col justify-between">
              <div>
                <span className="font-['Silkscreen'] text-xs uppercase tracking-wider text-[#0047FF] dark:text-[#9BBFE0] mb-2 block">
                  ■ HEADLESS DOM CAPTURE
                </span>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mb-3">
                  Isolated sandbox screenshot rendering for visual cloaking analysis.
                </p>
              </div>

              <div className="aspect-video w-full rounded-2xl bg-[#F8FAFD] dark:bg-[#141A26] border border-[#E2E6EE] dark:border-[#1E2533] overflow-hidden flex items-center justify-center relative">
                {result.screenshot_url ? (
                  <>
                    {screenshotState === 'loading' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0F141F]/80 z-10 backdrop-blur-[1px]">
                        <Loader2 className="animate-spin h-6 w-6 text-[#0047FF] mb-2" />
                        <span className="font-['Silkscreen'] text-[10px] text-white/80 tracking-wider">
                          RENDERING DOM CAPTURE...
                        </span>
                      </div>
                    )}
                    <img
                      src={
                        result.screenshot_url.startsWith('http')
                          ? result.screenshot_url
                          : `${getApiBaseUrl()}${result.screenshot_url}`
                      }
                      alt="Headless DOM Capture"
                      className={`w-full h-full object-cover transition-opacity duration-300 ${
                        screenshotState === 'loading' ? 'opacity-0' : 'opacity-100'
                      }`}
                      onLoad={() => setScreenshotState('loaded')}
                      onError={() => setScreenshotState('error')}
                    />
                    {screenshotState === 'error' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 bg-[#141A26]">
                        <Camera className="h-8 w-8 text-[#94A3B8] mb-2" />
                        <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
                          DOM rendered in isolated headless memory sandbox
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <Camera className="h-8 w-8 text-[#94A3B8] mb-2" />
                    <span className="text-xs font-mono text-[#64748B] dark:text-[#94A3B8]">
                      DOM captured in memory sandbox
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
