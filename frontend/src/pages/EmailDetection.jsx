import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../config/api';
import {
  Mail,
  AlertTriangle,
  ShieldCheck,
  Loader2,
  UploadCloud,
  FileText,
  Shield,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Paperclip,
  Flame,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';

// Curated realistic sample emails for instant zero-friction demonstration
const SAMPLE_PHISHING_EML = `From: "Corporate Payroll Department" <payroll-update@secure-internal-hr-portal.net>
To: target-employee@company.corp
Subject: URGENT: Mandatory Direct Deposit Suspension Notice - Immediate Action Required
Date: Tue, 03 Nov 2026 09:14:22 +0000
Message-ID: <payroll-20261103-091422@secure-internal-hr-portal.net>
Return-Path: <bounce-daemon@adversarial-spoof-relay.xyz>
Authentication-Results: mx.company.corp;
 dkim=fail (signature verification failed or missing);
 spf=fail (sender IP 198.51.100.44 is not designated by domain secure-internal-hr-portal.net);
 dmarc=fail action=quarantine header.from=secure-internal-hr-portal.net
Content-Type: text/html; charset="UTF-8"

<!DOCTYPE html>
<html>
<body>
<p><strong>ATTENTION EMPLOYEE:</strong></p>
<p>Your scheduled salary disbursement for this pay cycle has been automatically <strong>SUSPENDED</strong> due to an unverified tax discrepancy and missing 2FA identity confirmation.</p>
<p>To prevent indefinite deposit cancellation, you must confirm your credentials within 24 hours:</p>
<p><a href="https://secure-login-account-update.xyz/verify-payroll-id">Click Here to Re-Authenticate &amp; Verify Payroll Deposit</a></p>
<p>Failure to respond immediately will result in payroll escalation to accounting disciplinary oversight.</p>
<p><em>Security ID: HR-PAY-99201-REV</em></p>
</body>
</html>`;

const SAMPLE_LEGIT_EML = `From: "GitHub Security Team" <support@github.com>
To: developer@company.corp
Subject: [GitHub] Security advisory: New SSH key added to your account
Date: Tue, 03 Nov 2026 14:20:10 +0000
Message-ID: <github-sec-adv-20261103@github.com>
Return-Path: <support@github.com>
Authentication-Results: mx.company.corp;
 dkim=pass header.i=@github.com header.s=s202611;
 spf=pass (sender IP 192.30.252.204 designated as permitted sender) smtp.mailfrom=support@github.com;
 dmarc=pass (p=reject sp=reject dis=none) header.from=github.com
Content-Type: text/html; charset="UTF-8"

<!DOCTYPE html>
<html>
<body>
<p>Hello developer,</p>
<p>A new SSH public key (SHA256:d8a9b2... ed25519) was successfully linked to your GitHub account.</p>
<p>If you performed this action, no further steps are necessary.</p>
<p>If you did not authorize this, review your account credentials immediately at <a href="https://github.com/settings/keys">https://github.com/settings/keys</a>.</p>
</body>
</html>`;

export default function EmailDetection() {
  const navigate = useNavigate();
  const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'paste'
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [isCursorInside, setIsCursorInside] = useState(false);
  const fileInputRef = useRef(null);
  const resultsRef = useRef(null);

  const handleScan = async (e, customFile = null, customContent = null) => {
    if (e && e.preventDefault) e.preventDefault();

    const activeFile = customFile || file;
    const activeContent = customContent !== null ? customContent : content;

    if (!activeFile && !activeContent) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      if (activeFile) {
        formData.append('file', activeFile);
      } else if (activeContent) {
        formData.append('content', activeContent);
      }

      const response = await axios.post(
        `${getApiBaseUrl()}/api/detect/email`,
        formData,
        {
          timeout: 60000,
        }
      );
      setResult(response.data);

      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      console.error('Email scan error:', err);
      const serverMsg = err.response?.data?.detail;
      setError(
        serverMsg ||
        (err.code === 'ECONNABORTED'
          ? 'Scan request timed out. The cloud server may be waking up—please try again in a few seconds.'
          : 'Failed to scan document. Please check the file format or try again.')
      );
    } finally {
      setLoading(false);
    }
  };

  const loadSample = async (sampleType) => {
    if (sampleType === 'pdf') {
      try {
        const response = await fetch('/samples/overdue_invoice_fraud.pdf');
        if (response.ok) {
          const blob = await response.blob();
          const sampleFile = new File([blob], 'urgent_invoice_fraud.pdf', { type: 'application/pdf' });
          setFile(sampleFile);
          setContent('');
          setInputMode('upload');
          handleScan(null, sampleFile, null);
          return;
        }
      } catch (err) {
        console.error('Failed to load sample PDF:', err);
      }
    }

    const rawText = sampleType === 'phish' ? SAMPLE_PHISHING_EML : SAMPLE_LEGIT_EML;
    const fileName = sampleType === 'phish' ? 'payroll_urgent_suspension.eml' : 'github_security_notice.eml';
    const sampleFile = new File([rawText], fileName, { type: 'message/rfc822' });

    setFile(sampleFile);
    setContent('');
    setInputMode('upload');
    handleScan(null, sampleFile, null);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setContent('');
      handleScan(null, droppedFile, null);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setContent('');
      handleScan(null, selected, null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navigateToUrlScanner = (targetUrl) => {
    navigate('/url');
    // Pre-populate URL in URL scanner by saving to session storage
    try {
      sessionStorage.setItem('phishshield_prefill_url', targetUrl);
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-10 space-y-8 font-['Plus_Jakarta_Sans'] animate-in fade-in duration-300 pb-12">
      
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".eml,.msg,.txt,.mbox,.pdf,application/pdf"
        onChange={handleFileChange}
      />

      {/* Clean Minimal Header */}
      <div className="text-center space-y-1.5">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
          Email &amp; PDF Threat Scanner
        </h1>
        <p className="text-xs sm:text-[13px] text-[#94A3B8] max-w-full mx-auto sm:whitespace-nowrap">
          Upload an email (.eml, .msg) or document (.pdf) to instantly detect spoofed senders, fake invoices, and phishing links.
        </p>
      </div>

      {/* =========================================================================
          THE VINTAGE CRT COMPUTER TERMINAL (CENTERPIECE)
          ========================================================================= */}
      <div className="w-full max-w-[580px] mx-auto select-none">
        
        {/* Outer Beige Monitor Case */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!file && !loading) fileInputRef.current?.click();
          }}
          style={{ cursor: 'none' }}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setCursorPos({
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
          }}
          onMouseEnter={() => setIsCursorInside(true)}
          onMouseLeave={() => setIsCursorInside(false)}
          className={`relative group rounded-t-[32px] bg-[#DDD9C8] p-4 sm:p-6 border-t-2 border-l-2 border-[#FFFFFF] border-r-4 border-b-4 border-[#8B8676] shadow-2xl transition-all duration-300 overflow-hidden cursor-none [&_*]:!cursor-none ${
            !file && !loading ? 'hover:shadow-blue-900/30' : ''
          } ${isDragOver ? 'ring-4 ring-cyan-400 scale-[1.01]' : ''}`}
        >
          {/* Top Cooling Ventilation Louvers */}
          <div className="flex justify-center gap-2 mb-3 opacity-60">
            <div className="w-10 h-1 bg-[#8B8676] rounded-full"></div>
            <div className="w-16 h-1 bg-[#8B8676] rounded-full"></div>
            <div className="w-16 h-1 bg-[#8B8676] rounded-full"></div>
            <div className="w-10 h-1 bg-[#8B8676] rounded-full"></div>
          </div>

          {/* Recessed CRT Monitor Bezel (Trimmed Black Margin, Maximized Screen Area) */}
          <div className="rounded-[20px] bg-[#0A1020] p-1.5 sm:p-2 border-2 border-[#8B8676] shadow-[inset_0_2px_10px_rgba(0,0,0,0.7)] relative overflow-hidden">
            
            {/* The CRT Glass Screen Display (Rich Luminous Blue Screen) */}
            <div
              className={`relative rounded-xl overflow-hidden min-h-[300px] sm:min-h-[340px] flex flex-col items-center justify-center p-4 sm:p-6 text-center transition-all duration-300 ${
                isDragOver
                  ? 'bg-gradient-to-b from-[#0055FF] via-[#0040E0] to-[#0028A8] ring-4 ring-cyan-300'
                  : 'bg-gradient-to-b from-[#0040E0] via-[#002D9C] to-[#001D78] shadow-[inset_0_0_45px_rgba(0,71,255,0.35)]'
              }`}
            >
              {/* CRT Scanline & Curved Vignette Effects */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[size:100%_4px] pointer-events-none opacity-50 z-10" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,71,255,0.15),rgba(0,20,70,0.45)_100%)] pointer-events-none z-10" />
              <div className="absolute inset-0 bg-blue-500/15 blur-xl pointer-events-none" />

              {/* Glass Diagonal Sheen Reflection */}
              <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/5 rounded-full blur-2xl pointer-events-none" />

              {/* CASE 1: LOADING / SCANNING STATE */}
              {loading ? (
                <div className="relative z-20 flex flex-col items-center justify-center w-full py-6 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-400/20 border border-cyan-300/40 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <Loader2 className="h-6 w-6 text-cyan-300 animate-spin" />
                  </div>
                  <div className="space-y-1.5 font-mono text-left max-w-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
                      <span className="text-[11px] font-['Silkscreen'] text-cyan-300 uppercase font-bold tracking-wider">
                        EVALUATING ARTIFACT...
                      </span>
                    </div>
                    <p className="text-[10px] text-blue-200">
                      &gt; Ingesting MIME headers &amp; payloads
                    </p>
                    <p className="text-[10px] text-blue-300">
                      &gt; Auditing SPF, DKIM &amp; DMARC records
                    </p>
                    <p className="text-[10px] text-cyan-200">
                      &gt; Computing Evidential Dirichlet density
                    </p>
                  </div>
                  {/* Segmented CRT Progress Bar */}
                  <div className="w-48 h-2 bg-blue-950/80 rounded-full overflow-hidden border border-cyan-400/30 p-0.5">
                    <div className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-300 rounded-full animate-pulse w-4/5"></div>
                  </div>
                </div>
              ) : !file ? (
                /* CASE 2: IDLE STATE -> AUTHENTIC 3D OPENING RETRO ENVELOPE (FIGMA VECTOR GRADE) */
                <div className="relative z-20 flex flex-col items-center justify-center w-full py-2">
                  
                  {/* Interactive Envelope Housing */}
                  <div
                    className="relative w-52 sm:w-60 h-34 sm:h-38 flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.03]"
                    style={{ perspective: '1000px' }}
                  >
                    {/* 1. Envelope Interior / Back Base */}
                    <div className="absolute inset-0 bg-[#00227D] rounded-[22px] border-[4px] border-white box-border z-0 shadow-2xl overflow-hidden" />

                    {/* 2. Top Flap that rotates up 180° into the blue screen */}
                    <div
                      className={`absolute inset-0 w-full h-full origin-top transition-all duration-500 ease-in-out z-30 ${
                        isDragOver
                          ? '[transform:rotateX(180deg)] !z-0'
                          : 'group-hover:[transform:rotateX(180deg)] group-hover:!z-0'
                      }`}
                      style={{
                        transformOrigin: 'top center',
                        transformStyle: 'preserve-3d',
                      }}
                    >
                      {/* Flap Front (facing user when envelope is closed) */}
                      <svg
                        viewBox="0 0 210 135"
                        className="w-full h-full block overflow-visible [backface-visibility:hidden]"
                      >
                        <polygon
                          points="4,2 105,74 206,2"
                          fill="#002D9C"
                          stroke="#FFFFFF"
                          strokeWidth="4"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </svg>

                      {/* Flap Back (faces user when folded up - vibrant blue interior lining) */}
                      <svg
                        viewBox="0 0 210 135"
                        className="w-full h-full block overflow-visible absolute inset-0 [transform:rotateX(180deg)] [backface-visibility:hidden]"
                      >
                        <polygon
                          points="4,133 105,61 206,133"
                          fill="#00227D"
                          stroke="#FFFFFF"
                          strokeWidth="4"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    {/* 3. Emerging Document/Payload (Figma-type card nested inside envelope) */}
                    <div
                      className={`absolute left-0 right-0 mx-auto w-[82%] h-[116px] bottom-1.5 bg-white rounded-xl shadow-2xl p-2.5 transition-all duration-500 ease-out z-10 flex flex-col justify-between text-left pointer-events-none border border-blue-200/90 ${
                        isDragOver
                          ? '-translate-y-[56px] opacity-100 shadow-cyan-500/30'
                          : 'translate-y-4 opacity-0 group-hover:-translate-y-[54px] group-hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-blue-100 pb-1">
                        <span className="font-['Silkscreen'] text-[8px] text-[#0047FF] font-bold">
                          INGESTION.PAYLOAD
                        </span>
                        <span className="text-[7.5px] font-mono text-slate-600 uppercase font-bold">
                          .EML • .PDF
                        </span>
                      </div>

                      <div className="space-y-1 py-1">
                        <div className="h-1 bg-blue-100 rounded w-4/5"></div>
                        <div className="h-1 bg-slate-200 rounded w-full"></div>
                        <div className="h-1 bg-slate-100 rounded w-2/3"></div>
                      </div>

                      <div className="bg-[#0047FF] rounded-md py-1 px-2 text-center shadow-xs">
                        <span className="font-['Silkscreen'] text-[7.5px] text-white font-bold uppercase tracking-wider block">
                          CLICK TO CHOOSE FILE
                        </span>
                      </div>
                    </div>

                    {/* 4. Front Pocket SVG (Covers lower half of the emerging letter) */}
                    <svg
                      className="absolute inset-0 w-full h-full z-20 pointer-events-none overflow-visible"
                      viewBox="0 0 210 135"
                    >
                      <path
                        d="M 4 2 L 4 116 A 16 16 0 0 0 20 132 L 190 132 A 16 16 0 0 0 206 116 L 206 2 L 105 74 Z"
                        fill="#0035A8"
                        stroke="#FFFFFF"
                        strokeWidth="4"
                        strokeLinejoin="round"
                      />
                      <line
                        x1="4"
                        y1="126"
                        x2="80"
                        y2="76"
                        stroke="#FFFFFF"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        opacity="0.35"
                      />
                      <line
                        x1="206"
                        y1="126"
                        x2="130"
                        y2="76"
                        stroke="#FFFFFF"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        opacity="0.35"
                      />
                    </svg>

                  </div>

                  {/* Monospace Screen Prompt */}
                  <div className="mt-4 relative z-20 space-y-1">
                    <span className="font-['Silkscreen'] text-xs sm:text-sm uppercase tracking-wider text-white font-extrabold block drop-shadow-md">
                      {isDragOver ? '⚡ RELEASE TO SCAN PAYLOAD ⚡' : 'CLICK ENVELOPE OR DROP FILE'}
                    </span>
                    <p className="text-[11px] font-mono text-blue-100/90 font-medium">
                      Supports: .EML • .MSG • .PDF • .TXT • .MBOX
                    </p>
                  </div>
                </div>
              ) : (
                /* CASE 3: FILE LOADED STATE */
                <div className="relative z-20 flex flex-col items-center justify-center w-full py-4 space-y-3.5">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg border ${
                      file.name.toLowerCase().endsWith('.pdf')
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 shadow-amber-500/20'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-emerald-500/20'
                    }`}
                  >
                    {file.name.toLowerCase().endsWith('.pdf') ? (
                      <FileText size={28} />
                    ) : (
                      <Mail size={28} />
                    )}
                  </div>

                  <div className="space-y-1 max-w-xs">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-['Silkscreen'] uppercase tracking-wider font-bold bg-white/20 text-white border border-white/30">
                      {file.name.toLowerCase().endsWith('.pdf') ? 'PDF DOCUMENT' : 'EML RFC-822'}
                    </span>
                    <span className="font-mono text-xs sm:text-sm text-white font-bold block truncate" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-[11px] font-mono text-blue-200 block">
                      {(file.size / 1024).toFixed(1)} KB // Ready for evidential triage
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScan(e);
                      }}
                      className="px-5 py-2 rounded-xl bg-[#0047FF] hover:bg-[#0039CC] text-white font-['Silkscreen'] text-xs font-bold tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-[#0047FF]/40 cursor-pointer border border-blue-400/40"
                    >
                      <span>ANALYZE PAYLOAD NOW</span>
                      <ArrowRight size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setResult(null);
                      }}
                      className="px-3 py-1.5 text-[11px] font-mono text-blue-200/80 hover:text-white underline cursor-pointer"
                    >
                      ✕ Change file
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* CRT Monitor Bottom Controls (Power LED, Floppy Slot, Model Badge) */}
          <div className="mt-3.5 flex items-center justify-between px-2 text-[#686354]">
            
            {/* Power LED Indicator */}
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 border border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse"></span>
              <span className="font-['Silkscreen'] text-[9px] uppercase tracking-wider font-bold">POWER</span>
            </div>

            {/* Simulated 3.5" Floppy Slot */}
            <div className="flex items-center gap-2 bg-[#C8C3B2] px-2.5 py-1 rounded-sm border border-[#9E9886] shadow-inner">
              <div className="w-16 h-1 bg-[#4A463B] rounded-2xs"></div>
              <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500 animate-ping' : 'bg-emerald-600'}`}></div>
              <span className="text-[8px] font-mono uppercase text-[#4A463B] font-bold">3.5" DISK</span>
            </div>

            {/* Model Badge */}
            <span className="font-mono text-[9px] tracking-widest uppercase opacity-75 font-semibold">
              PHISHSHIELD // CRT-84
            </span>
          </div>

          {/* Figma Live Multiplayer Cursor Overlay */}
          {isCursorInside && (
            <div
              className="absolute pointer-events-none z-50 select-none transition-transform duration-75 ease-out"
              style={{
                left: cursorPos.x,
                top: cursorPos.y,
              }}
            >
              {/* Figma Vector Selection Arrow */}
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                className="filter drop-shadow-[0_2px_5px_rgba(0,0,0,0.6)]"
              >
                <path
                  d="M4 2L18.5 11L12 13L9 19.5L4 2Z"
                  fill="#0047FF"
                  stroke="#FFFFFF"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>

              {/* Figma User Tag Badge */}
              <div className="absolute left-3.5 top-3.5 px-2 py-0.5 rounded-md bg-[#0047FF] text-white text-[10.5px] font-['Plus_Jakarta_Sans'] font-bold tracking-tight shadow-xl shadow-[#0047FF]/50 border border-white/30 whitespace-nowrap">
                <span>Yash Singhal</span>
              </div>
            </div>
          )}

        </div>

        {/* Angled Beige Keyboard Base */}
        <div className="relative rounded-b-[24px] bg-[#C6C1B0] p-3 sm:p-4 border-t border-[#FFFFFF] border-r-4 border-b-4 border-[#7A7565] shadow-xl">
          
          {/* Keyboard Deck Grill & Keys Grid Texture */}
          <div className="grid grid-cols-12 gap-1 px-2 py-1.5 bg-[#B5B09E] rounded-xl border border-[#9E9886] shadow-inner mb-2">
            {Array.from({ length: 24 }).map((_, i) => (
              <div
                key={i}
                className="h-3 sm:h-3.5 bg-[#DCD8CA] rounded-xs border-t border-l border-white border-b border-r border-[#8E8876] shadow-xs"
              />
            ))}
          </div>

          {/* Keyboard Spacebar & Indicator Labels */}
          <div className="flex items-center justify-between px-3 text-[9px] font-mono text-[#635E4E]">
            <span>[ CTRL • ALT • INGEST ]</span>
            <div className="h-2 w-28 bg-[#DCD8CA] rounded-sm border-t border-l border-white border-b border-r border-[#8E8876]"></div>
            <span>[ VERIFIED HOST ]</span>
          </div>
        </div>

      </div>

      {/* =========================================================================
          RAW INPUT EXPANDER & USER GUIDE
          ========================================================================= */}
      <div className="max-w-xl mx-auto space-y-3 text-center">
        
        {/* Minimal Collapsible Toggle for Raw Text / SMTP Headers */}
        <div>
          <button
            type="button"
            onClick={() => setInputMode(inputMode === 'paste' ? 'upload' : 'paste')}
            className="text-xs font-mono text-[#94A3B8] hover:text-white transition-colors underline decoration-dotted underline-offset-4 cursor-pointer inline-flex items-center gap-1.5"
          >
            <FileText size={13} />
            <span>
              {inputMode === 'paste'
                ? '▲ Hide raw text / headers form'
                : 'Need to paste raw text or SMTP headers instead?'}
            </span>
          </button>
        </div>

        {/* Collapsed Raw Text / Headers Area */}
        {inputMode === 'paste' && (
          <form onSubmit={handleScan} className="space-y-3 pt-2 text-left animate-in fade-in">
            <textarea
              className="block w-full p-4 border border-[#E2E6EE] dark:border-[#1E2533] rounded-2xl bg-[#0F131C] text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/20 transition-all min-h-[140px] font-mono text-xs leading-relaxed"
              placeholder="From: Security Alert <service-notice@account-billing.xyz>&#10;Subject: URGENT: Your account credentials expired&#10;&#10;Paste raw email body or RFC-822 headers here..."
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setFile(null);
              }}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !content.trim()}
                className="px-5 py-2.5 rounded-xl bg-[#0047FF] hover:bg-[#0039CC] text-white font-['Silkscreen'] text-xs font-bold tracking-wider disabled:opacity-50 transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                {loading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : <ArrowRight size={13} />}
                <span>ANALYZE TEXT PAYLOAD</span>
              </button>
            </div>
          </form>
        )}

        {/* User Guide Accordion: How to export .eml */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#94A3B8]/80 hover:text-white transition-colors cursor-pointer"
          >
            <HelpCircle size={13} className="text-[#0047FF]" />
            <span>How to export .eml from Gmail / Outlook</span>
            {showGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showGuide && (
            <div className="mt-4 p-5 sm:p-6 rounded-2xl bg-[#0F131C] border border-[#1E2533] text-left animate-in fade-in duration-200 max-w-2xl mx-auto shadow-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                
                {/* Gmail Guide Card */}
                <div className="space-y-3 bg-[#141A26] p-4 rounded-xl border border-[#1E2533]">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-['Silkscreen'] font-bold flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>GMAIL (WEB)</span>
                    </span>
                  </div>
                  <ol className="space-y-2.5 text-xs text-[#94A3B8]">
                    <li className="flex items-start gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#1E2533] text-[#CBD5E1] text-[10px] font-bold flex items-center justify-center">1</span>
                      <span className="leading-snug pt-0.5">Open the suspicious email.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#1E2533] text-[#CBD5E1] text-[10px] font-bold flex items-center justify-center">2</span>
                      <span className="leading-snug pt-0.5">Click the more options menu <strong className="text-white">(⋮)</strong> in the top-right corner.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#1E2533] text-[#CBD5E1] text-[10px] font-bold flex items-center justify-center">3</span>
                      <span className="leading-snug pt-0.5">Select <strong className="text-white">"Download message"</strong> to save the <code className="text-[#38BDF8] bg-blue-500/10 px-1 py-0.5 rounded font-mono text-[10.5px]">.eml</code> file.</span>
                    </li>
                  </ol>
                </div>

                {/* Outlook / Apple Mail Guide Card */}
                <div className="space-y-3 bg-[#141A26] p-4 rounded-xl border border-[#1E2533]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-1 rounded-md bg-blue-500/10 text-[#38BDF8] border border-blue-500/20 text-[10px] font-['Silkscreen'] font-bold flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 shrink-0 fill-current text-white/90" viewBox="0 0 170 170">
                        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.03-7.61-7.77-11.73-14.21-6.1-9.5-10.8-20.08-14.12-31.75-3.32-11.67-4.98-22.61-4.98-32.81 0-14.28 3.59-26.06 10.78-35.34 7.18-9.28 16.2-13.98 27.05-14.1 5.34 0 11.23 1.5 17.67 4.5 6.43 3.01 10.42 4.56 11.96 4.56 1.3 0 5.41-1.63 12.33-4.88 6.92-3.26 12.72-4.73 17.41-4.41 12.87.87 23.01 5.63 30.41 14.29-11.36 6.84-16.92 16.39-16.69 28.66.23 9.77 3.99 17.9 11.28 24.39 7.3 6.49 16.03 10.1 26.2 10.85-2.28 7.07-5.22 14.46-8.81 22.18zm-29.61-105.8c0-7.23 2.61-13.88 7.84-19.95 5.23-6.07 11.75-9.67 19.57-10.8 1.08 7.35-1.4 14.19-7.44 20.52-6.04 6.33-12.69 9.74-19.97 10.23z"/>
                      </svg>
                      <span>APPLE MAIL</span>
                    </span>
                    <span className="px-2 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-['Silkscreen'] font-bold flex items-center gap-1.5">
                      <svg className="w-3 h-3 shrink-0" viewBox="0 0 21 21">
                        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                      </svg>
                      <span>OUTLOOK</span>
                    </span>
                  </div>
                  <ol className="space-y-2.5 text-xs text-[#94A3B8]">
                    <li className="flex items-start gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#1E2533] text-[#CBD5E1] text-[10px] font-bold flex items-center justify-center">1</span>
                      <span className="leading-snug pt-0.5">Drag the email directly from your inbox into the computer screen above.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#1E2533] text-[#CBD5E1] text-[10px] font-bold flex items-center justify-center">2</span>
                      <span className="leading-snug pt-0.5">Or choose <strong className="text-white">File &rarr; Save As</strong> and pick <code className="text-[#38BDF8] bg-blue-500/10 px-1 py-0.5 rounded font-mono text-[10.5px]">.eml</code> or <code className="text-[#38BDF8] bg-blue-500/10 px-1 py-0.5 rounded font-mono text-[10.5px]">.msg</code> format.</span>
                    </li>
                  </ol>
                </div>

              </div>
            </div>
          )}
        </div>

      </div>

      {/* Error Alert */}
      {error && (
        <div className="max-w-xl mx-auto p-4 rounded-2xl bg-red-950/20 border border-red-900/40 text-red-300 text-sm flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* =========================================================================
          DETECTION VERDICT & FORENSIC INVESTIGATION BENTO
          ========================================================================= */}
      {result && (
        <div ref={resultsRef} className="space-y-6 animate-in slide-in-from-bottom-4 scroll-mt-24">
          
          {/* Main Verdict Card */}
          <div
            className={`rounded-[32px] p-7 sm:p-9 text-white relative overflow-hidden shadow-2xl ${
              result.prediction === 'Phishing'
                ? 'bg-gradient-to-br from-[#1A0A0E] via-[#240A10] to-[#0A0D14] border border-red-900/60'
                : result.prediction === 'Suspicious'
                ? 'bg-gradient-to-br from-[#1C1608] via-[#261E0A] to-[#0A0D14] border border-amber-900/60'
                : 'bg-gradient-to-br from-[#0047FF] to-[#002FA8] border border-[#0047FF]'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start gap-4 sm:gap-5">
                <div
                  className={`p-3.5 rounded-2xl shrink-0 flex items-center justify-center ${
                    result.prediction === 'Phishing'
                      ? 'bg-red-600/30 text-red-400 border border-red-500/30'
                      : result.prediction === 'Suspicious'
                      ? 'bg-amber-600/30 text-amber-400 border border-amber-500/30'
                      : 'bg-white/20 text-white border border-white/30'
                  }`}
                >
                  {result.prediction === 'Phishing' ? (
                    <AlertTriangle className="h-8 w-8" />
                  ) : result.prediction === 'Suspicious' ? (
                    <AlertTriangle className="h-8 w-8 text-amber-400" />
                  ) : (
                    <ShieldCheck className="h-8 w-8" />
                  )}
                </div>

                <div>
                  <span className="font-['Silkscreen'] text-xs tracking-widest uppercase opacity-80 mb-1 block">
                    ■ EVIDENTIAL EMAIL VERDICT
                  </span>
                  <h2 className="font-['Pixelify_Sans'] text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
                    {result.prediction === 'Phishing'
                      ? 'SPOOFED PHISHING PAYLOAD DETECTED'
                      : result.prediction === 'Suspicious'
                      ? 'SUSPICIOUS EMAIL WITH ANOMALOUS ROUTING'
                      : 'CLEAN AUTHENTIC EMAIL VERIFIED'}
                  </h2>
                  <p className="text-sm font-medium opacity-85 mt-2 max-w-2xl leading-relaxed">
                    {result.details ||
                      (result.prediction === 'Phishing'
                        ? 'Severe cryptographic authentication failures and coercive psychological phrasing discovered.'
                        : 'Envelope headers and transport security pass standard organizational consensus.')}
                  </p>
                </div>
              </div>

              {/* Confidence Pill */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-white/10 shrink-0 text-center min-w-[160px]">
                <span className="font-['Silkscreen'] text-[10px] tracking-wider uppercase text-white/70 block mb-1">
                  CONFIDENCE
                </span>
                <span className="text-4xl font-extrabold font-mono text-white">
                  {Math.round((result.confidence || 0.94) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* Envelope Reconnaissance & Header Details */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Column 1 (Cols 1-7): Header Reconnaissance */}
            <div className="md:col-span-7 rounded-[28px] bg-[#0F141F] border border-[#1E2533] p-6 sm:p-7 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E2533] pb-3">
                <span className="font-['Silkscreen'] text-xs uppercase tracking-wider text-[#0047FF] dark:text-[#9BBFE0]">
                  ■ ENVELOPE &amp; HEADER TELEMETRY
                </span>
                <span className="font-mono text-[10px] text-[#94A3B8]">RFC 822 PARSED</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-[10px] font-['Silkscreen'] text-[#94A3B8] uppercase block mb-0.5">
                    Sender (From)
                  </span>
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#141A26] border border-[#1E2533]">
                    <span className="text-white truncate font-bold" title={result.email_sender}>
                      {result.email_sender || 'Header Absent'}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.email_sender)}
                      className="text-[#94A3B8] hover:text-white transition-colors"
                      title="Copy sender"
                    >
                      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-['Silkscreen'] text-[#94A3B8] uppercase block mb-0.5">
                      Recipient (To)
                    </span>
                    <div className="p-2 rounded-lg bg-[#141A26] border border-[#1E2533] text-white truncate">
                      {result.email_recipient || 'Header Absent'}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-['Silkscreen'] text-[#94A3B8] uppercase block mb-0.5">
                      Return-Path
                    </span>
                    <div className="p-2 rounded-lg bg-[#141A26] border border-[#1E2533] text-white truncate">
                      {result.email_return_path || 'None'}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-['Silkscreen'] text-[#94A3B8] uppercase block mb-0.5">
                    Subject Line
                  </span>
                  <div className="p-2 rounded-lg bg-[#141A26] border border-[#1E2533] text-white font-sans font-medium text-sm">
                    {result.email_subject || 'No Subject'}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#94A3B8] pt-1">
                  <span>Date: {result.email_date || 'Current Session'}</span>
                  <span>Domain Alignment: <strong className={result.domain_alignment?.includes('MISMATCH') ? 'text-red-400' : 'text-emerald-400'}>{result.domain_alignment || 'Evaluated'}</strong></span>
                </div>
              </div>
            </div>

            {/* Column 2 (Cols 8-12): Cryptographic Authentication Consensus */}
            <div className="md:col-span-5 rounded-[28px] bg-[#0F141F] border border-[#1E2533] p-6 sm:p-7 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[#1E2533] pb-3 mb-4">
                  <span className="font-['Silkscreen'] text-xs uppercase tracking-wider text-[#0047FF] dark:text-[#9BBFE0]">
                    ■ AUTHENTICATION CONSENSUS
                  </span>
                  <Shield size={14} className="text-[#0047FF]" />
                </div>

                <div className="space-y-3">
                  {/* SPF Status */}
                  <div className="p-3 rounded-xl bg-[#141A26] border border-[#1E2533] flex items-center justify-between">
                    <div>
                      <span className="font-['Silkscreen'] text-[10px] uppercase text-[#94A3B8] block">
                        SPF ALIGNMENT
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        {result.spf_status || 'NOT AVAILABLE'}
                      </span>
                    </div>
                    {result.spf_status === 'PASS' ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : result.spf_status === 'FAIL' || result.spf_status === 'SOFTFAIL' ? (
                      <XCircle size={18} className="text-red-400" />
                    ) : (
                      <HelpCircle size={18} className="text-slate-500" />
                    )}
                  </div>

                  {/* DKIM Status */}
                  <div className="p-3 rounded-xl bg-[#141A26] border border-[#1E2533] flex items-center justify-between">
                    <div>
                      <span className="font-['Silkscreen'] text-[10px] uppercase text-[#94A3B8] block">
                        DKIM SIGNATURE
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        {result.dkim_status || 'NOT AVAILABLE'}
                      </span>
                    </div>
                    {result.dkim_status === 'PASS' ? (
                      <CheckCircle2 size={18} className="text-emerald-500" />
                    ) : result.dkim_status === 'FAIL' ? (
                      <XCircle size={18} className="text-red-400" />
                    ) : (
                      <HelpCircle size={18} className="text-slate-500" />
                    )}
                  </div>

                  {/* DMARC Status */}
                  <div className="p-3 rounded-xl bg-[#141A26] border border-[#1E2533] flex items-center justify-between">
                    <div>
                      <span className="font-['Silkscreen'] text-[10px] uppercase text-[#94A3B8] block">
                        DMARC ENFORCEMENT
                      </span>
                      <span className="font-mono text-xs font-bold text-white">
                        {result.dmarc_status || 'NOT AVAILABLE'}
                      </span>
                    </div>
                    {result.dmarc_status === 'PASS' ? (
                      <ShieldCheck size={18} className="text-emerald-500" />
                    ) : result.dmarc_status === 'FAIL' ? (
                      <XCircle size={18} className="text-red-400" />
                    ) : (
                      <HelpCircle size={18} className="text-slate-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Psychological Coercion Badges */}
              {result.coercion_tactics && result.coercion_tactics.length > 0 && (
                <div className="pt-2">
                  <span className="font-['Silkscreen'] text-[10px] text-[#94A3B8] uppercase block mb-1.5">
                    DETECTED COERCION TACTICS:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {result.coercion_tactics.map((tactic, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[10px]"
                      >
                        ⚠️ {tactic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Embedded URLs Extraction & Threat Pivot */}
          {result.extracted_urls && result.extracted_urls.length > 0 && (
            <div className="rounded-[28px] bg-[#0F141F] border border-[#1E2533] p-6 sm:p-7 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E2533] pb-3">
                <span className="font-['Silkscreen'] text-xs uppercase tracking-wider text-[#0047FF] dark:text-[#9BBFE0]">
                  ■ EXTRACTED EMBEDDED URLS ({result.extracted_urls.length})
                </span>
                <span className="text-[11px] font-mono text-[#94A3B8]">
                  Pivot directly to URL Scanner
                </span>
              </div>

              <div className="space-y-2.5">
                {result.extracted_urls.map((targetUrl, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#141A26] border border-[#1E2533] flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-[#0047FF] font-bold">[{idx + 1}]</span>
                      <span className="text-white truncate max-w-lg" title={targetUrl}>
                        {targetUrl}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(targetUrl)}
                        className="p-1.5 rounded-lg bg-[#0F141F] hover:bg-[#1E2533] text-[#94A3B8] hover:text-white transition-colors"
                        title="Copy URL"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToUrlScanner(targetUrl)}
                        className="px-3 py-1.5 rounded-lg bg-[#0047FF] hover:bg-[#0039CC] text-white font-['Silkscreen'] text-[10px] tracking-wider uppercase flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <span>SCAN IN RADAR</span>
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments Radar */}
          {result.attachments && result.attachments.length > 0 && (
            <div className="rounded-[28px] bg-[#0F141F] border border-[#1E2533] p-6 sm:p-7 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#1E2533] pb-3">
                <span className="font-['Silkscreen'] text-xs uppercase tracking-wider text-[#0047FF] dark:text-[#9BBFE0]">
                  ■ ATTACHED MEDIA &amp; SCRIPTS ({result.attachments.length})
                </span>
                <Paperclip size={14} className="text-[#94A3B8]" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
                {result.attachments.map((att, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      att.is_risky
                        ? 'bg-red-950/20 border-red-900/40 text-red-300'
                        : 'bg-[#141A26] border-[#1E2533] text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip size={14} className={att.is_risky ? 'text-red-400' : 'text-[#94A3B8]'} />
                      <span className="truncate font-bold" title={att.filename}>{att.filename}</span>
                    </div>
                    <span className="font-['Silkscreen'] text-[9px] uppercase px-2 py-0.5 rounded bg-black/40">
                      {att.is_risky ? '⚠️ HAZARDOUS' : 'CLEAN'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
