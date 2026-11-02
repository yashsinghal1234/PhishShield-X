import React, { useState } from 'react';
import {
  BookOpen,
  Terminal,
  ShieldAlert,
  Cpu,
  Layers,
  Code2,
  FileText,
  ExternalLink,
  CheckCircle2,
  Zap,
  Globe,
  QrCode,
  Mail,
  Copy,
  Check
} from 'lucide-react';

export default function Documentation() {
  const [activeTab, setActiveTab] = useState('architecture');
  const [copiedCode, setCopiedCode] = useState(null);

  const copySnippet = (id, code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const sections = [
    { id: 'architecture', label: 'Architecture & EDL', icon: Cpu },
    { id: 'url', label: 'URL Lexical Engine', icon: Globe },
    { id: 'quishing', label: 'Vision QR Engine', icon: QrCode },
    { id: 'email', label: 'Email NLP Engine', icon: Mail },
    { id: 'api', label: 'REST API & Endpoints', icon: Terminal },
  ];

  return (
    <div className="space-y-12 py-6 select-none animate-in fade-in duration-300">
      
      {/* Editorial Header */}
      <div className="space-y-4 border-b border-[#1E2533] pb-8">
        <div className="flex items-center gap-3 text-[11px] font-['Silkscreen'] tracking-[0.16em] uppercase text-[#38BDF8]">
          <span>[ DOCS.01/05 ]</span>
          <span>&gt; TECHNICAL SPECIFICATION &amp; API MANUAL</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
          System Documentation.
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-2xl font-normal leading-relaxed">
          Comprehensive reference for the PhishShield multi-modal Dirichlet Evidential Deep Learning architecture, real-time telemetry pipelines, and external client integrations.
        </p>

        {/* Quick External Links */}
        <div className="pt-2 flex flex-wrap gap-3">
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0047FF]/15 border border-[#0047FF]/40 text-[#38BDF8] text-xs font-mono font-medium hover:bg-[#0047FF]/25 transition-all"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>FastAPI Swagger UI</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <a
            href="http://localhost:8000/redoc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-300 text-xs font-mono font-medium hover:bg-slate-800 transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ReDoc Specification</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>

      {/* Main Documentation Layout: Left Sticky Navigation + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side Tab Navigation */}
        <div className="lg:col-span-4 sticky top-28 space-y-2 bg-[#0E121B] border border-[#1E2533] p-3 rounded-2xl">
          <div className="px-3 py-2 text-[10px] font-['Silkscreen'] text-slate-500 uppercase tracking-widest border-b border-[#1E2533]/80 mb-1">
            Documentation Modules
          </div>
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = activeTab === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0047FF] text-white shadow-lg shadow-[#0047FF]/20 font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span className="flex-1">{s.label}</span>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </button>
            );
          })}
        </div>

        {/* Right Content Panel */}
        <div className="lg:col-span-8 bg-[#0E121B] border border-[#1E2533] p-6 sm:p-10 rounded-2xl space-y-8 min-h-[580px]">
          
          {/* TAB 1: ARCHITECTURE & EDL */}
          {activeTab === 'architecture' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-2">
                <span className="font-['Silkscreen'] text-xs text-[#38BDF8] tracking-wider uppercase">01 // FOUNDATION</span>
                <h2 className="text-2xl font-bold text-white tracking-tight">Dirichlet Evidential Deep Learning (EDL)</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Conventional softmax classifiers suffer from overconfidence when processing Out-of-Distribution (OOD) adversarial payloads. PhishShield models class probabilities as a higher-order Dirichlet distribution parameterized by evidence vectors <span className="font-mono text-[#38BDF8]">e_k ≥ 0</span>.
              </p>

              {/* Mathematical Formulation Card */}
              <div className="bg-[#07090E] border border-[#1E2533] p-5 rounded-xl space-y-4 font-mono text-xs">
                <div className="text-[10px] font-['Silkscreen'] text-slate-500 uppercase tracking-widest">
                  // Mathematical Proofs &amp; Equations
                </div>
                <div className="space-y-2 text-slate-300">
                  <p className="text-slate-400">// Total Dirichlet Evidence Strength (S):</p>
                  <p className="bg-slate-900/80 p-2.5 rounded border border-slate-800 text-white font-bold">
                    S = ∑(k=1 to K) (e_k + 1) = ∑(k=1 to K) α_k
                  </p>
                  <p className="text-slate-400">// Epistemic Uncertainty (u):</p>
                  <p className="bg-slate-900/80 p-2.5 rounded border border-slate-800 text-[#38BDF8] font-bold">
                    u = K / S   (where K = 2 classes: Safe vs Malicious)
                  </p>
                  <p className="text-slate-400">// Expected Class Probability (p_k):</p>
                  <p className="bg-slate-900/80 p-2.5 rounded border border-slate-800 text-white font-bold">
                    p_k = α_k / S
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-base font-semibold text-white">Three-Tiered Autonomous Decision Gates</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                    <span className="text-[10px] font-['Silkscreen'] text-emerald-400">CERTAINTY: SAFE</span>
                    <p className="text-xs text-slate-300 mt-1 font-mono">u &lt; 0.25, p_safe &gt; 0.85</p>
                    <p className="text-[11px] text-slate-400 mt-1">Autonomous pass without alert.</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                    <span className="text-[10px] font-['Silkscreen'] text-amber-400">HIGH UNCERTAINTY</span>
                    <p className="text-xs text-slate-300 mt-1 font-mono">u ≥ 0.35 (OOD payload)</p>
                    <p className="text-[11px] text-slate-400 mt-1">Deflect to isolated sandbox inspection.</p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5">
                    <span className="text-[10px] font-['Silkscreen'] text-red-400">CONFIRMED THREAT</span>
                    <p className="text-xs text-slate-300 mt-1 font-mono">u &lt; 0.25, p_phish &gt; 0.80</p>
                    <p className="text-[11px] text-slate-400 mt-1">Immediate domain quarantine.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: URL ENGINE */}
          {activeTab === 'url' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-2">
                <span className="font-['Silkscreen'] text-xs text-[#38BDF8] tracking-wider uppercase">02 // INGESTION</span>
                <h2 className="text-2xl font-bold text-white tracking-tight">34-Dimensional Lexical &amp; Host Engine</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                The URL scanner extracts 34 handcrafted mathematical and structural features before applying deep semantic tokenization:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-4 bg-[#07090E] border border-[#1E2533] rounded-xl space-y-2">
                  <span className="text-[10px] font-['Silkscreen'] text-[#38BDF8]">STRUCTURAL TELEMETRY</span>
                  <ul className="space-y-1.5 text-slate-300">
                    <li>• Shannon Token Entropy (H)</li>
                    <li>• Levenshtein Distance to Top 10K Brands</li>
                    <li>• Subdomain Depth &amp; Path Depth</li>
                    <li>• Hyphen &amp; Delimiter Ratio</li>
                    <li>• Punycode &amp; Homoglyph Flagging</li>
                  </ul>
                </div>
                <div className="p-4 bg-[#07090E] border border-[#1E2533] rounded-xl space-y-2">
                  <span className="text-[10px] font-['Silkscreen'] text-[#38BDF8]">HOST REPUTATION</span>
                  <ul className="space-y-1.5 text-slate-300">
                    <li>• Domain Registration Age (WHOIS)</li>
                    <li>• ASN &amp; Cloudflare Tunnel Detection</li>
                    <li>• SSL Issuer &amp; SAN Mismatch Rate</li>
                    <li>• Fast-Flux DNS Volatility</li>
                    <li>• Open Redirection Discrepancies</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: QUISHING ENGINE */}
          {activeTab === 'quishing' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-2">
                <span className="font-['Silkscreen'] text-xs text-[#38BDF8] tracking-wider uppercase">03 // VISION SCAN</span>
                <h2 className="text-2xl font-bold text-white tracking-tight">Vision-Transformer QR Quishing Defense</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Attackers use QR codes embedded in PDFs, invoices, and physical flyers to bypass traditional secure email gateways. PhishShield combines high-contrast multi-pass ZBar decoding with Vision-Transformer patch analysis.
              </p>

              <div className="bg-[#07090E] border border-[#1E2533] p-4 rounded-xl space-y-3 font-mono text-xs">
                <div className="text-[10px] font-['Silkscreen'] text-slate-500">
                  // Supported Ingestion Payloads
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300">
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-center">PNG / JPEG</div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-center">WebP / SVG</div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-center">Multi-Page PDF</div>
                  <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-center">Camera Stream</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EMAIL ENGINE */}
          {activeTab === 'email' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-2">
                <span className="font-['Silkscreen'] text-xs text-[#38BDF8] tracking-wider uppercase">04 // LINGUISTICS</span>
                <h2 className="text-2xl font-bold text-white tracking-tight">NLP Linguistic &amp; Header Engine</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                Analyzes raw RFC 822 email headers alongside full-body text tokens. Computes Dirichlet epistemic uncertainty across urgent urgency vectors, credential harvesting cues, and spoofed SPF/DKIM authentication failures.
              </p>
            </div>
          )}

          {/* TAB 5: REST API */}
          {activeTab === 'api' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="space-y-2">
                <span className="font-['Silkscreen'] text-xs text-[#38BDF8] tracking-wider uppercase">05 // API SPEC</span>
                <h2 className="text-2xl font-bold text-white tracking-tight">RESTful Endpoints &amp; cURL Examples</h2>
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                The PhishShield daemon exposes high-throughput endpoints on <span className="font-mono text-[#38BDF8]">http://localhost:8000</span>:
              </p>

              {/* cURL Example Snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>POST /api/detect/url</span>
                  <button
                    onClick={() =>
                      copySnippet(
                        'curl-url',
                        `curl -X POST "http://localhost:8000/api/detect/url" \\\n  -H "Content-Type: application/json" \\\n  -d '{"url": "https://secure-login-account-update.xyz/verify"}'`
                      )
                    }
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedCode === 'curl-url' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy cURL</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="bg-[#07090E] border border-[#1E2533] p-4 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto">
{`curl -X POST "http://localhost:8000/api/detect/url" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://secure-login-account-update.xyz/verify"}'`}
                </pre>
              </div>

              {/* JSON Response Sample */}
              <div className="space-y-2">
                <span className="text-xs font-mono text-slate-400">Response Payload (200 OK)</span>
                <pre className="bg-[#07090E] border border-[#1E2533] p-4 rounded-xl text-xs font-mono text-slate-200 overflow-x-auto">
{`{
  "prediction": "phishing",
  "confidence": 0.964,
  "edl_uncertainty": 0.082,
  "edl_strength": 24.39,
  "risk_score": 96.4,
  "features": {
    "url_length": 52,
    "shannon_entropy": 4.12,
    "has_https": true,
    "typosquat_risk": "high"
  }
}`}
                </pre>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}

