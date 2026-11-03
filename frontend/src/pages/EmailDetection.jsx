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
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      setResult(response.data);

      setTimeout(() => {
        if (resultsRef.current) {
          resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to scan email. Verify backend server is running on port 8000.');
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
      <div className="text-center space-y-2.5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0047FF]/10 border border-[#0047FF]/25 text-[#0047FF] dark:text-[#9BBFE0] text-xs font-['Silkscreen'] uppercase tracking-wider">
          <Mail size={13} />
          <span>Vector 03 // Email &amp; Document Intelligence</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
          Email &amp; PDF Threat Ingestion
        </h1>
        <p className="text-[#94A3B8] text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
          Ingest raw RFC-822 (.eml, .msg) messages or PDF documents to inspect cryptographic SPF/DKIM/DMARC signatures, malicious links, and hidden embedded payloads.
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
          className={`relative group rounded-t-[32px] bg-[#DDD9C8] p-4 sm:p-7 border-t-2 border-l-2 border-[#FFFFFF] border-r-4 border-b-4 border-[#8B8676] shadow-2xl transition-all duration-300 ${
            !file && !loading ? 'cursor-pointer hover:shadow-blue-900/30' : ''
          } ${isDragOver ? 'ring-4 ring-cyan-400 scale-[1.01]' : ''}`}
        >
          {/* Top Cooling Ventilation Louvers */}
          <div className="flex justify-center gap-2 mb-3.5 opacity-60">
            <div className="w-10 h-1 bg-[#8B8676] rounded-full"></div>
            <div className="w-16 h-1 bg-[#8B8676] rounded-full"></div>
            <div className="w-16 h-1 bg-[#8B8676] rounded-full"></div>
            <div className="w-10 h-1 bg-[#8B8676] rounded-full"></div>
          </div>

          {/* Recessed Dark CRT Monitor Bezel */}
          <div className="rounded-[22px] bg-[#161B26] p-3 sm:p-5 border-4 border-[#9E9988] shadow-[inset_0_4px_16px_rgba(0,0,0,0.85)] relative overflow-hidden">
            
            {/* The CRT Glass Screen Display */}
            <div
              className={`relative rounded-xl overflow-hidden min-h-[290px] sm:min-h-[330px] flex flex-col items-center justify-center p-4 sm:p-6 text-center transition-all duration-300 ${
                isDragOver
                  ? 'bg-gradient-to-b from-[#003BCC] via-[#0047FF] to-[#002FA8] ring-4 ring-cyan-300'
                  : 'bg-gradient-to-b from-[#002FA8] via-[#00227D] to-[#00144D]'
              }`}
            >
              {/* CRT Scanline & Curved Vignette Effects */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%)] bg-[size:100%_4px] pointer-events-none opacity-60 z-10" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,10,35,0.75)_100%)] pointer-events-none z-10" />
              <div className="absolute inset-0 bg-blue-500/10 blur-xl pointer-events-none" />

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
                /* CASE 2: IDLE STATE -> ICONIC RETRO WHITE ENVELOPE (Matches Reference Artwork) */
                <div className="relative z-20 flex flex-col items-center justify-center w-full py-2">
                  
                  {/* Interactive Envelope Housing */}
                  <div className="relative w-48 sm:w-56 h-32 sm:h-36 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                    
                    {/* Emerging Document/Payload (Slides up from inside envelope on hover) */}
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 w-40 sm:w-48 bg-white rounded-xl shadow-2xl p-2.5 border border-blue-200 transition-all duration-500 ease-out z-10 flex flex-col justify-between text-left pointer-events-none ${
                        isDragOver
                          ? '-translate-y-16 scale-105 opacity-100 shadow-cyan-500/30'
                          : 'translate-y-2 opacity-0 group-hover:-translate-y-14 group-hover:opacity-100'
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

                      <div className="bg-[#0047FF] rounded-md px-2 py-1 text-center shadow-xs">
                        <span className="font-['Silkscreen'] text-[8px] text-white font-bold uppercase tracking-wider block">
                          CLICK TO CHOOSE FILE
                        </span>
                      </div>
                    </div>

                    {/* The Iconic Bold White Envelope Icon (Direct Recreation of Reference Artwork) */}
                    <div className="relative z-20 w-40 sm:w-48 h-26 sm:h-32 transition-all duration-300">
                      <svg
                        viewBox="0 0 160 110"
                        className="w-full h-full filter drop-shadow-[0_6px_16px_rgba(0,0,0,0.5)]"
                      >
                        {/* Envelope Body Outline (Deep Blue fill, Thick White Border) */}
                        <rect
                          x="7"
                          y="8"
                          width="146"
                          height="94"
                          rx="16"
                          fill="#002B9E"
                          stroke="#FFFFFF"
                          strokeWidth="8.5"
                          strokeLinejoin="round"
                        />

                        {/* Top 'V' Flap (Folds open upwards on hover) */}
                        <g
                          className="transition-transform duration-500 ease-out"
                          style={{
                            transformOrigin: '80px 12px',
                            transform: isDragOver ? 'scaleY(-1)' : undefined,
                          }}
                        >
                          <path
                            d="M 11 12 L 80 66 L 149 12"
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth="8.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="transition-transform duration-500 ease-out group-hover:scale-y-[-1]"
                            style={{ transformOrigin: '80px 12px' }}
                          />
                        </g>

                        {/* Front Pocket Cutout (Prevents letter from spilling over bottom border) */}
                        <path
                          d="M 11 100 L 58 58 M 149 100 L 102 58"
                          stroke="#FFFFFF"
                          strokeWidth="6"
                          strokeLinecap="round"
                          opacity="0.3"
                        />
                      </svg>
                    </div>

                    {/* Pixel Pointer Hand from Reference Image */}
                    <div className="absolute -right-2 -bottom-2 z-30 pointer-events-none transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1">
                      <div className="relative">
                        <svg
                          width="38"
                          height="38"
                          viewBox="0 0 24 24"
                          fill="none"
                          className="filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
                        >
                          <path
                            d="M9 2v9l-2-2-1.5 1.5 4.5 4.5h5l2.5-5v-5h-2v3h-1.5v-5h-2v5h-1.5v-7h-2z"
                            fill="#FFFFFF"
                            stroke="#000000"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="absolute -top-1 -right-1 text-yellow-300 text-[10px] animate-ping font-bold">✦</span>
                      </div>
                    </div>

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
            <div className="mt-3 p-4 rounded-xl bg-[#0F131C] border border-[#1E2533] text-xs font-mono text-[#94A3B8] text-left space-y-3 animate-in fade-in max-w-xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-white font-bold block">// GMAIL (WEB)</span>
                  <p>1. Open the suspicious email.</p>
                  <p>2. Click the three dots (⋮) top-right.</p>
                  <p>3. Click <strong>"Download message"</strong> (.eml).</p>
                </div>
                <div className="space-y-1">
                  <span className="text-white font-bold block">// OUTLOOK / APPLE MAIL</span>
                  <p>1. Drag email directly from your inbox into the computer screen above.</p>
                  <p>2. Or click <em>File → Save As → .eml/.msg</em>.</p>
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
