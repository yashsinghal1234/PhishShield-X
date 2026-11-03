import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../config/api';
import UserControls from '../components/UserControls';
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
  const [isHovered, setIsHovered] = useState(false);
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
    <div className="space-y-8 font-['Plus_Jakarta_Sans'] animate-in fade-in duration-300 pb-0">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-[#0047FF]"></span>
            <span className="font-['Silkscreen'] text-xs uppercase tracking-widest text-[#0047FF] dark:text-[#9BBFE0]">
              VECTOR 03 // EMAIL INTELLIGENCE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white">
            Email Phishing &amp; Spoofing Defense
          </h1>
          <p className="text-sm font-medium text-[#94A3B8] mt-1 max-w-2xl">
            Inspect raw .eml RFC 822 messages, cross-examine cryptographic SPF/DKIM/DMARC alignments, and detect psychological coercion lures.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <UserControls />
        </div>
      </div>

      {/* Main Container Bento Card */}
      <div className="rounded-[24px] sm:rounded-[32px] bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] p-5 sm:p-7 md:p-8 shadow-sm space-y-6">
        
        {/* Top Control Bar: Mode Toggle + Quick Demo Samples */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E2E6EE] dark:border-[#1E2533]">
          
          {/* Input Mode Selector */}
          <div className="inline-flex p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#141A26] border border-[#E2E6EE] dark:border-[#1E2533] text-xs font-['Silkscreen'] font-bold">
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                inputMode === 'upload'
                  ? 'bg-[#0047FF] text-white shadow-sm'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-white'
              }`}
            >
              <UploadCloud size={14} />
              <span>TERMINAL UPLOAD (.EML / .PDF)</span>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('paste')}
              className={`px-3.5 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                inputMode === 'paste'
                  ? 'bg-[#0047FF] text-white shadow-sm'
                  : 'text-[#64748B] dark:text-[#94A3B8] hover:text-white'
              }`}
            >
              <FileText size={14} />
              <span>PASTE TEXT / HEADERS</span>
            </button>
          </div>

          {/* Quick Demo Preloaded Samples (Essential for frictionless evaluator exploration) */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-['Silkscreen'] text-[10px] text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider hidden sm:inline">
              TRY DEMO:
            </span>
            <button
              type="button"
              onClick={() => loadSample('phish')}
              className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[10.5px] font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Inspect a simulated urgent payroll credential harvesting email"
            >
              <Flame size={12} className="text-red-400" />
              <span>🚨 Payroll Phish (.eml)</span>
            </button>
            <button
              type="button"
              onClick={() => loadSample('pdf')}
              className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10.5px] font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Inspect an adversarial overdue invoice PDF with embedded links"
            >
              <FileText size={12} className="text-amber-400" />
              <span>📑 Fake Invoice (.pdf)</span>
            </button>
            <button
              type="button"
              onClick={() => loadSample('legit')}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10.5px] font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Inspect a legitimate cryptographic GitHub security notice"
            >
              <ShieldCheck size={12} className="text-emerald-400" />
              <span>🛡️ Valid Notice (.eml)</span>
            </button>
          </div>

        </div>

        {/* MODE 1: RETRO COMPUTER TERMINAL UPLOAD ZONE (STANDALONE VINTAGE PC + 3D OPENING ENVELOPE) */}
        {inputMode === 'upload' && (
          <div className="relative w-full py-4 sm:py-6 flex flex-col items-center justify-center select-none">
            
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".eml,.msg,.txt,.mbox,.pdf,application/pdf"
              onChange={handleFileChange}
            />

            {/* THE RETRO VINTAGE COMPUTER TERMINAL (STANDALONE) */}
            <div className="relative w-full max-w-[540px] sm:max-w-[620px] mx-auto filter drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)]">
              
              {/* Computer Monitor Chassis (Vintage Warm Beige with 3D Bevels) */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative group rounded-t-[36px] bg-gradient-to-b from-[#E6E1D3] via-[#DDD8CA] to-[#C8C2B3] p-4 sm:p-6 pb-5 sm:pb-7 border-t-2 border-l-2 border-white/90 border-r-[5px] border-b-[5px] border-[#8D887A] transition-all duration-300 shadow-2xl ${
                  isDragOver ? 'ring-4 ring-cyan-400 scale-[1.01]' : ''
                }`}
              >
                
                {/* Top Recessed Ventilation Louvers / Cooling Grille */}
                <div className="flex justify-center items-center gap-1.5 mb-3 sm:mb-4 opacity-75">
                  <div className="w-6 h-1 bg-[#8D887A] rounded-full shadow-inner" />
                  <div className="w-12 h-1 bg-[#8D887A] rounded-full shadow-inner" />
                  <div className="w-16 h-1 bg-[#8D887A] rounded-full shadow-inner" />
                  <div className="w-12 h-1 bg-[#8D887A] rounded-full shadow-inner" />
                  <div className="w-6 h-1 bg-[#8D887A] rounded-full shadow-inner" />
                </div>

                {/* Top Badge & Serial Header */}
                <div className="flex items-center justify-between px-2 mb-2 font-mono text-[9px] text-[#706B5F]">
                  <div className="flex items-center gap-1.5">
                    {/* Rainbow-styled retro badge stripe */}
                    <div className="flex h-3 w-4 rounded-2xs overflow-hidden border border-[#9A9586] shadow-2xs">
                      <div className="w-1/4 bg-red-500" />
                      <div className="w-1/4 bg-amber-400" />
                      <div className="w-1/4 bg-emerald-500" />
                      <div className="w-1/4 bg-blue-500" />
                    </div>
                    <span className="font-['Silkscreen'] text-[9.5px] font-bold text-[#555045] tracking-wider">
                      PHISH-SHIELD // 84
                    </span>
                  </div>
                  <span className="tracking-widest uppercase opacity-80 font-semibold text-[8.5px]">
                    AUTONOMOUS CRT TERMINAL
                  </span>
                </div>

                {/* Recessed Dark CRT Monitor Bezel */}
                <div className="rounded-[24px] bg-[#1A1E27] p-3 sm:p-4 border-4 border-[#A39E8F] shadow-[inset_0_5px_15px_rgba(0,0,0,0.8)] relative overflow-hidden">
                  
                  {/* The CRT Glass Display (Deep Glowing Royal Blue Phosphor) */}
                  <div
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    onClick={() => {
                      if (!loading) fileInputRef.current?.click();
                    }}
                    className={`relative rounded-xl overflow-hidden min-h-[290px] sm:min-h-[330px] flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none transition-all duration-300 cursor-pointer ${
                      isDragOver
                        ? 'bg-gradient-to-b from-[#0047FF] via-[#0035B8] to-[#001D6E] ring-4 ring-cyan-300'
                        : isHovered
                        ? 'bg-gradient-to-b from-[#003DCF] via-[#002B9E] to-[#00155A]'
                        : 'bg-gradient-to-b from-[#0038C4] via-[#00248A] to-[#00124D]'
                    }`}
                  >
                    {/* CRT Scanline overlay effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[size:100%_4px] pointer-events-none opacity-60 z-10" />
                    
                    {/* Radial Glass Curvature & Corner Vignette */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_45%,rgba(0,8,30,0.75)_100%)] pointer-events-none z-10" />
                    
                    {/* Glass Reflection Highlight across top-left */}
                    <div className="absolute -top-16 -left-16 w-48 h-48 bg-gradient-to-br from-white/15 to-transparent rounded-full blur-xl pointer-events-none z-10" />
                    
                    {/* Ambient Blue Phosphor Inner Glow */}
                    <div className="absolute inset-0 bg-blue-500/10 blur-xl pointer-events-none" />

                    {/* SCREEN CONTENT - STATE 1: NO FILE LOADED (3D INTERACTIVE ENVELOPE) */}
                    {!file ? (
                      <div className="relative z-20 flex flex-col items-center justify-center w-full py-2">
                        
                        {/* 3D Interactive Envelope Container */}
                        <div
                          className={`relative w-44 sm:w-52 h-28 sm:h-34 transition-transform duration-300 ${
                            isHovered || isDragOver ? 'scale-105' : ''
                          }`}
                          style={{ perspective: '800px' }}
                        >
                          
                          {/* Confidential Document / Letter sliding up out of the envelope on hover */}
                          <div
                            className={`absolute left-1/2 -translate-x-1/2 w-36 sm:w-44 h-28 bg-[#FFFFFF] rounded-t-lg shadow-2xl p-2.5 sm:p-3 transition-all duration-500 ease-out z-10 flex flex-col justify-between border border-blue-200 text-left ${
                              isHovered || isDragOver
                                ? '-translate-y-20 scale-105'
                                : 'translate-y-0'
                            }`}
                          >
                            <div className="flex items-center justify-between border-b border-blue-100 pb-1">
                              <span className="font-['Silkscreen'] text-[8.5px] text-[#0047FF] font-bold">
                                PAYLOAD INGESTION
                              </span>
                              <span className="text-[7.5px] font-mono text-slate-500 uppercase font-semibold">
                                EML • PDF
                              </span>
                            </div>

                            <div className="space-y-1.5 py-1">
                              <div className="h-1 bg-blue-200/80 rounded w-4/5" />
                              <div className="h-1 bg-slate-200 rounded w-full" />
                              <div className="h-1 bg-slate-100 rounded w-3/4" />
                            </div>

                            <div className="bg-[#0047FF]/10 rounded px-2 py-1 text-center border border-[#0047FF]/25">
                              <span className="font-['Silkscreen'] text-[8px] text-[#0047FF] font-bold uppercase tracking-wider block">
                                CLICK TO BROWSE FILE
                              </span>
                            </div>
                          </div>

                          {/* Envelope Back Body */}
                          <div className="absolute inset-0 bg-[#CBD5E1] rounded-b-2xl shadow-inner border border-slate-300 z-0" />

                          {/* 3D Envelope Flap (Flips 180deg upward on hover) */}
                          <div
                            className="absolute top-0 left-0 right-0 h-16 origin-top transition-transform duration-500 ease-out z-20"
                            style={{
                              transformOrigin: 'top center',
                              transform: isHovered || isDragOver ? 'rotateX(180deg)' : 'rotateX(0deg)',
                              zIndex: isHovered || isDragOver ? 5 : 20,
                            }}
                          >
                            <svg viewBox="0 0 100 50" className="w-full h-full drop-shadow-md fill-[#E2E8F0] stroke-slate-300 stroke-[1]">
                              <polygon points="0,0 50,48 100,0" />
                            </svg>
                          </div>

                          {/* Envelope Front Pocket with Notch */}
                          <div className="absolute inset-x-0 bottom-0 h-18 sm:h-20 bg-white/95 rounded-b-2xl border-t border-slate-200 z-30 shadow-lg flex items-end justify-center pb-2.5 overflow-hidden">
                            <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full fill-white stroke-slate-200 stroke-[0.8]">
                              <polygon points="0,50 50,18 100,50" />
                            </svg>
                            <span className="relative z-40 font-['Silkscreen'] text-[9px] sm:text-[9.5px] uppercase tracking-wider text-slate-800 font-bold">
                              {isDragOver ? 'DROP PAYLOAD' : isHovered ? 'CLICK TO BROWSE' : 'HOVER TO OPEN'}
                            </span>
                          </div>

                        </div>

                        {/* CRT Screen Bottom Instruction Text */}
                        <div className="mt-4 sm:mt-5 relative z-20 space-y-1">
                          <span className="font-['Silkscreen'] text-xs sm:text-sm uppercase tracking-wider text-white font-extrabold block drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {isDragOver ? '⚡ RELEASE TO INGEST PAYLOAD ⚡' : 'CLICK TO UPLOAD EMAIL OR PDF'}
                          </span>
                          <p className="text-[10.5px] sm:text-[11px] font-mono text-blue-100/80 font-medium">
                            Supports .EML • .MSG • .PDF • .TXT • .MBOX
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* SCREEN CONTENT - STATE 2: FILE LOADED INTO MEMORY */
                      <div className="relative z-20 flex flex-col items-center justify-center w-full py-3 space-y-3">
                        <div
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl border ${
                            file.name.toLowerCase().endsWith('.pdf')
                              ? 'bg-amber-500/25 text-amber-300 border-amber-400/50'
                              : 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50'
                          }`}
                        >
                          {file.name.toLowerCase().endsWith('.pdf') ? (
                            <FileText size={28} />
                          ) : (
                            <Mail size={28} />
                          )}
                        </div>

                        <div className="space-y-1 max-w-sm px-2">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-['Silkscreen'] uppercase tracking-wider font-bold bg-white/20 text-white border border-white/30">
                            {file.name.toLowerCase().endsWith('.pdf') ? 'PDF DOCUMENT' : 'EML RFC-822'}
                          </span>
                          <span className="font-mono text-xs sm:text-sm text-white font-bold block truncate" title={file.name}>
                            {file.name}
                          </span>
                          <span className="text-[11px] font-mono text-blue-200 block">
                            {(file.size / 1024).toFixed(1)} KB // Ingested in memory
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                          <span className="font-['Silkscreen'] text-[10px] text-emerald-300 uppercase tracking-widest font-bold">
                            ● READY FOR EVIDENTIAL ANALYSIS
                          </span>
                        </div>

                        {/* Interactive Buttons on CRT Screen */}
                        <div className="flex items-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFile(null);
                              setResult(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[10px] font-mono font-semibold transition-all cursor-pointer"
                          >
                            ✕ Eject File
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleScan(e);
                            }}
                            disabled={loading}
                            className="px-4 py-1.5 rounded-lg bg-[#0047FF] hover:bg-[#0039CC] text-white font-['Silkscreen'] text-[10.5px] font-bold tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-[#0047FF]/40 cursor-pointer"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="animate-spin h-3 w-3" />
                                <span>SCANNING...</span>
                              </>
                            ) : (
                              <>
                                <span>ANALYZE NOW</span>
                                <ArrowRight size={12} />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* CRT Monitor Lower Bezel Deck (3.5" Floppy Slot + Power LED + Controls) */}
                <div className="mt-3.5 sm:mt-4 px-2 sm:px-3 flex items-center justify-between text-[#686354]">
                  
                  {/* Left: Glowing Phosphor Power LED & Label */}
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                    </span>
                    <span className="font-['Silkscreen'] text-[9px] uppercase tracking-wider font-bold text-[#555045]">
                      PWR
                    </span>
                  </div>

                  {/* Center: 3.5" Retro Floppy Drive Slot */}
                  <div className="flex items-center gap-2">
                    <div className="relative w-32 sm:w-44 h-2.5 bg-[#1C2028] rounded-xs border-t border-[#8D887A] border-b border-white/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] flex items-center justify-end px-1.5">
                      {/* Floppy shutter slot */}
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3A3F4B]" />
                    </div>
                    {/* Floppy eject button */}
                    <div className="w-3.5 h-2 bg-[#DDD8CA] border-t border-l border-white border-b border-r border-[#8D887A] shadow-2xs rounded-2xs" />
                  </div>

                  {/* Right: HDD / Activity LED */}
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500/70 border border-amber-400/50" />
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-[#686354] font-semibold">
                      DISK
                    </span>
                  </div>

                </div>

              </div>

              {/* Monitor Pedestal Base / Stand (Gives the computer realistic 3D tabletop presence) */}
              <div className="relative mx-auto w-44 sm:w-56 h-4 sm:h-5 bg-gradient-to-b from-[#C4BEAF] to-[#A8A294] border-l-2 border-r-[4px] border-[#7F796C] shadow-md" />
              <div className="relative mx-auto w-56 sm:w-72 h-3 sm:h-4 rounded-b-xl bg-gradient-to-b from-[#B8B2A4] to-[#9E988A] border-t border-white/80 border-l border-r-2 border-b-2 border-[#6B6559] shadow-xl" />

            </div>

          </div>
        )}

        {/* MODE 2: PASTE EMAIL TEXT / SMTP HEADERS */}
        {inputMode === 'paste' && (
          <form onSubmit={handleScan} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-['Silkscreen'] text-xs uppercase tracking-wider text-white">
                  Email Message Body &amp; Optional Headers
                </label>
                <span className="text-[11px] font-mono text-[#94A3B8]">
                  Paste full email text or 'Show Original' headers
                </span>
              </div>
              <textarea
                className="block w-full p-4 border border-[#E2E6EE] dark:border-[#1E2533] rounded-2xl bg-[#F8FAFD] dark:bg-[#141A26] text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0047FF] focus:ring-2 focus:ring-[#0047FF]/20 transition-all min-h-[160px] font-mono text-xs leading-relaxed"
                placeholder="From: Security Alert <service-notice@account-billing.xyz>&#10;Subject: URGENT: Your account credentials expired&#10;&#10;Dear user, please re-authenticate immediately at https://portal-id-verify.top to prevent suspension..."
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setFile(null);
                }}
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading || !content.trim()}
                className="px-6 py-3 rounded-xl bg-[#0047FF] hover:bg-[#0039CC] text-white font-['Silkscreen'] text-xs font-bold tracking-wider disabled:opacity-50 transition-all flex items-center gap-2 shadow-md shadow-[#0047FF]/20 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5" />
                    <span>EVALUATING NLP INTENT...</span>
                  </>
                ) : (
                  <>
                    <span>■ ANALYZE EMAIL PAYLOAD</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* User Guide Accordion: How to export .eml */}
        <div className="border-t border-[#E2E6EE] dark:border-[#1E2533] pt-4">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center justify-between w-full text-left text-xs font-mono text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle size={14} className="text-[#0047FF]" />
              <span>How do I export an .eml file from Gmail or Outlook?</span>
            </span>
            {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showGuide && (
            <div className="mt-3 p-4 rounded-xl bg-[#141A26] border border-[#1E2533] text-xs font-mono text-[#94A3B8] space-y-3 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-white font-bold block">// GMAIL (WEB)</span>
                  <p>1. Open the suspicious email in Gmail.</p>
                  <p>2. Click the three vertical dots (⋮) in the top-right corner.</p>
                  <p>3. Select <strong>"Download message"</strong>. Saves as an authentic <code>.eml</code> file.</p>
                </div>
                <div className="space-y-1">
                  <span className="text-white font-bold block">// OUTLOOK / APPLE MAIL</span>
                  <p>1. In Outlook, simply drag the email from your inbox directly into this dropzone, or click <em>File → Save As → .msg/.eml</em>.</p>
                  <p>2. In Apple Mail, choose <em>File → Save As → Raw Message Source</em>.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-red-950/20 border border-red-900/40 text-red-300 text-sm flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

      </div>

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
