import React, { useState } from 'react';
import axios from 'axios';
import UserControls from '../components/UserControls';
import { Link2, AlertTriangle, ShieldCheck, Loader2, Globe, Server, MapPin, Calendar, Camera, Info, Copy, ExternalLink, Network, Database, Fingerprint, Activity, Zap } from 'lucide-react';

export default function UrlDetection() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [screenshotState, setScreenshotState] = useState('idle');
  const [scanStage, setScanStage] = useState(0);
  const [scanDuration, setScanDuration] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!url) return;
    
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
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/detect/url`, { url });
      const elapsed = Math.round(performance.now() - t0);
      setScanDuration(elapsed);
      setResult(response.data);
      setScreenshotState(response.data?.screenshot_url ? 'loading' : 'error');
    } catch (err) {
      setError('Failed to scan URL. Is the backend running?');
    } finally {
      clearTimeout(t1Timer);
      clearTimeout(t2Timer);
      setLoading(false);
      setScanStage(0);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6 font-['Poppins'] animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#0F1720] mb-2">
            URL Phishing Detection
          </h1>
          <p className="text-[#64748B] font-medium">
            Enter a suspicious URL to analyze its lexical features and domain reputation.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <UserControls />
        </div>
      </div>

      {/* Input Panel */}
      <div className="rounded-3xl bg-white border border-[#E5E9EB] p-6 shadow-sm">
        <form onSubmit={handleScan} className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Link2 className="h-5 w-5 text-[#94A3B8]" />
            </div>
            <input
              type="text"
              className="block w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F1720] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1F6A45]/20 focus:border-[#1F6A45] transition-all font-medium"
              placeholder="https://example.com/login"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url}
            className="flex items-center justify-center gap-2 py-3.5 px-8 rounded-2xl font-semibold text-white bg-[#1F6A45] hover:bg-[#185336] focus:outline-none focus:ring-4 focus:ring-[#1F6A45]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Analyze URL'}
          </button>
        </form>

        {loading && (
          <div className="mt-4 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs font-semibold text-[#64748B]">
              <div className="flex items-center gap-2 text-[#0F1720]">
                <Loader2 className="animate-spin h-4 w-4 text-[#1F6A45]" />
                <span>
                  {scanStage === 1 && "Stage 1: Extracting 34-D lexical & structural features..."}
                  {scanStage === 2 && "Stage 2: JIT Deep PhishNet neural & random forest inference..."}
                  {scanStage >= 3 && "Stage 3: Parallel threat intelligence & OSINT consensus..."}
                </span>
              </div>
              <span className="text-[#1F6A45] font-mono font-bold flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" /> Fast-Cap Serving
              </span>
            </div>
            <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#1F6A45] h-full rounded-full transition-all duration-150 ease-out"
                style={{ width: scanStage === 1 ? '35%' : scanStage === 2 ? '70%' : '95%' }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl text-[#DC2626] text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        )}
      </div>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-4">
          
          {/* Main Details Panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Verdict Banner */}
            <div className={`p-6 rounded-3xl border flex items-center gap-5 shadow-sm ${
              result.prediction === 'Phishing' ? 'bg-[#FEF2F2] border-[#FECACA]' : 
              result.prediction === 'Suspicious' ? 'bg-[#FFFBEB] border-[#FDE68A]' : 
              'bg-[#F0FDF4] border-[#BBF7D0]'
            }`}>
              <div className={`p-4 rounded-full flex shrink-0 ${
                result.prediction === 'Phishing' ? 'bg-[#FEE2E2] text-[#DC2626]' : 
                result.prediction === 'Suspicious' ? 'bg-[#FEF3C7] text-[#F59E0B]' : 
                'bg-[#DCFCE7] text-[#16A34A]'
              }`}>
                {result.prediction === 'Phishing' ? (
                  <AlertTriangle className="h-8 w-8" />
                ) : result.prediction === 'Suspicious' ? (
                  <AlertTriangle className="h-8 w-8" />
                ) : (
                  <ShieldCheck className="h-8 w-8" />
                )}
              </div>
              <div>
                <h3 className={`text-2xl font-bold tracking-tight ${
                  result.prediction === 'Phishing' ? 'text-[#DC2626]' : 
                  result.prediction === 'Suspicious' ? 'text-[#D97706]' : 
                  'text-[#16A34A]'
                }`}>
                  {result.prediction} Detected
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <p className="text-[#64748B] font-medium">
                    Confidence Score: <span className="font-bold text-[#0F1720]">{(result.confidence * 100).toFixed(1)}%</span>
                  </p>
                  {scanDuration !== null && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                      <Zap className="h-3 w-3" /> {scanDuration}ms
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Graduated Friction & Security Advisory Banner */}
            {result.advisory_message && (
              <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-sm ${
                result.friction_level === 'advisory' ? 'bg-amber-50/80 border-amber-200/80 text-amber-900' :
                result.friction_level === 'quarantine' ? 'bg-orange-50/80 border-orange-200/80 text-orange-900' :
                result.friction_level === 'block' ? 'bg-rose-50/80 border-rose-200/80 text-rose-900' :
                'bg-blue-50/80 border-blue-200/80 text-blue-900'
              }`}>
                <Info className={`h-5 w-5 shrink-0 mt-0.5 ${
                  result.friction_level === 'advisory' ? 'text-amber-600' :
                  result.friction_level === 'quarantine' ? 'text-orange-600' :
                  result.friction_level === 'block' ? 'text-rose-600' :
                  'text-blue-600'
                }`} />
                <div>
                  <h4 className="text-sm font-bold tracking-tight">
                    {result.friction_level === 'advisory' ? 'Security Advisory Notice' :
                     result.friction_level === 'quarantine' ? 'Tier 2 Human-in-the-Loop Quarantine' :
                     result.friction_level === 'block' ? 'Tier 1 Automated Defense Action' :
                     'System Notice'}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                    {result.advisory_message}
                  </p>
                </div>
              </div>
            )}

            {/* Evidential Deep Learning (EDL) Telemetry Card */}
            {(result.edl_uncertainty !== undefined && result.edl_uncertainty !== null) && (
              <div className="rounded-3xl bg-[#0F1720] text-white p-6 shadow-md border border-[#1E293B]">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                      <Activity className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                        Evidential Deep Learning Telemetry
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          PhishShield-EDL U6
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Second-order Dirichlet epistemic uncertainty & Dirichlet strength estimation
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full font-semibold uppercase tracking-wider ${
                    result.edl_uncertainty < 0.35 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                    result.edl_uncertainty <= 0.70 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    {result.edl_uncertainty < 0.35 ? 'In-Distribution (Familiar)' :
                     result.edl_uncertainty <= 0.70 ? 'Distributional Drift' :
                     'Zero-Day Epistemic Alert'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div className="bg-[#1E293B]/60 rounded-2xl p-4 border border-[#334155]/40">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase block mb-1">
                      Epistemic Uncertainty (u = 2/S)
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-bold font-mono ${
                        result.edl_uncertainty < 0.35 ? 'text-emerald-400' :
                        result.edl_uncertainty <= 0.70 ? 'text-amber-400' :
                        'text-purple-400'
                      }`}>
                        {result.edl_uncertainty.toFixed(4)}
                      </span>
                      <span className="text-xs text-slate-400">/ 1.000</span>
                    </div>
                    <div className="w-full bg-slate-800/80 rounded-full h-1.5 mt-2.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          result.edl_uncertainty < 0.35 ? 'bg-emerald-400' :
                          result.edl_uncertainty <= 0.70 ? 'bg-amber-400' :
                          'bg-purple-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, result.edl_uncertainty * 100))}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-[#1E293B]/60 rounded-2xl p-4 border border-[#334155]/40">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase block mb-1">
                      Dirichlet Strength (S = Σ αₖ)
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-cyan-400">
                        {result.edl_strength ? result.edl_strength.toFixed(2) : '--'}
                      </span>
                      <span className="text-xs text-slate-400">evidence units</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 leading-tight">
                      {result.edl_strength && result.edl_strength > 5.0 ? 'Strong empirical evidence base (S ≫ 2.0)' :
                       result.edl_strength && result.edl_strength > 2.5 ? 'Moderate empirical support' :
                       'Uninformative prior boundary (S ≈ 2.0)'}
                    </p>
                  </div>

                  <div className="bg-[#1E293B]/60 rounded-2xl p-4 border border-[#334155]/40">
                    <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase block mb-1">
                      Cosine EDL Risk (p_edl)
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold font-mono text-indigo-300">
                        {result.edl_prob !== undefined && result.edl_prob !== null ? `${(result.edl_prob * 100).toFixed(1)}%` : '--'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2 leading-tight">
                      Cosine margin head with Outlier Exposure
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Scan Results Details */}
            <div className="rounded-3xl bg-white border border-[#E5E9EB] p-6 shadow-sm">
              <h2 className="text-xl font-bold text-[#0F1720] mb-6 flex items-center gap-2">
                <Info className="h-5 w-5 text-[#64748B]" /> Scan Results
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                
                <div>
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-1.5">Source URL</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#0F1720] font-medium break-all">{url}</span>
                    <button onClick={() => copyToClipboard(url)} className="text-[#94A3B8] hover:text-[#0F1720] transition-colors shrink-0">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-1.5">TLD</span>
                  <span className="text-[#0F1720] font-medium">{result.tld || '--'}</span>
                </div>

                <div>
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-1.5">Target Brand</span>
                  <div className="flex items-center gap-2 text-[#0F1720] font-medium">
                    <Fingerprint className="h-4 w-4 text-[#94A3B8] shrink-0" />
                    {result.brand || 'None (Generic Domain)'}
                  </div>
                </div>

                <div>
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-1.5">SSL Issuer / CA</span>
                  <div className="flex items-center gap-2 text-[#0F1720] font-medium">
                    <ShieldCheck className="h-4 w-4 text-[#94A3B8] shrink-0" />
                    {result.ssl_issuer || '--'}
                  </div>
                </div>

                <div>
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-1.5">IP Address</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#2563EB] font-medium">{result.ip_address || '--'}</span>
                    {result.ip_address && (
                       <button onClick={() => copyToClipboard(result.ip_address)} className="text-[#94A3B8] hover:text-[#0F1720] transition-colors shrink-0">
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-1.5">Location</span>
                  <div className="flex items-center gap-2 text-[#0F1720] font-medium">
                    <MapPin className="h-4 w-4 text-[#94A3B8] shrink-0" />
                    {result.location || '--'}
                  </div>
                </div>

                <div>
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-1.5">Hosting Provider</span>
                  <div className="flex items-center gap-2 text-[#0F1720] font-medium">
                    <Database className="h-4 w-4 text-[#94A3B8] shrink-0" />
                    {result.hosting_provider || '--'}
                  </div>
                </div>

                <div>
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-1.5">ASN</span>
                  <div className="flex items-center gap-2 text-[#0F1720] font-medium">
                    <Network className="h-4 w-4 text-[#94A3B8] shrink-0" />
                    {result.asn || '--'}
                  </div>
                </div>

                <div>
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-1.5">Detection Date</span>
                  <div className="flex items-center gap-2 text-[#0F1720] font-medium">
                    <Calendar className="h-4 w-4 text-[#94A3B8] shrink-0" />
                    {new Date().toLocaleString()}
                  </div>
                </div>

                <div className="md:col-span-2 mt-2">
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-2">Certificate Details</span>
                  <div className="text-[#334155] text-sm font-medium leading-relaxed">
                    {result.certificate_details || '--'}
                  </div>
                </div>
                
                <div className="md:col-span-2 mt-2">
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-2">Analysis Details</span>
                  <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0] text-[#334155] text-sm font-medium leading-relaxed">
                    {result.details}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right Side Panels */}
          <div className="space-y-6">
            
            {/* Screenshot Panel */}
            <div className="rounded-3xl bg-white border border-[#E5E9EB] p-6 shadow-sm flex flex-col min-h-[320px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-[#0F1720] flex items-center gap-2">
                  <Camera className="h-5 w-5 text-[#64748B]" /> Screenshot
                </h2>
                {result.friction_level !== 'quarantine' || !result.advisory_message?.includes('URL does not exist') ? (
                  <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold flex items-center gap-1 text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                    Open Site <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-sm font-semibold text-[#DC2626] flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Site does not exist
                  </span>
                )}
              </div>
              
              <div className="flex-1 bg-[#F8FAFC] rounded-2xl overflow-hidden border border-[#E2E8F0] relative group flex items-center justify-center min-h-[220px]">
                {result.screenshot_url && screenshotState !== 'error' ? (
                  <>
                    {screenshotState !== 'loaded' && (
                      <div className="absolute inset-0 text-[#94A3B8] font-medium text-sm flex flex-col items-center justify-center gap-2 bg-[#F8FAFC]">
                        <Loader2 className="h-8 w-8 animate-spin opacity-70" />
                        Capturing page...
                      </div>
                    )}
                    <img
                      src={result.screenshot_url.startsWith('http') ? result.screenshot_url : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${result.screenshot_url.startsWith('/') ? '' : '/'}${result.screenshot_url}`}
                      alt="Website Screenshot"
                      className={`w-full h-full object-cover object-top ${screenshotState === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
                      onLoad={() => setScreenshotState('loaded')}
                      onError={() => setScreenshotState('error')}
                    />
                  </>
                ) : (
                  <div className="text-[#94A3B8] font-medium text-sm flex flex-col items-center gap-2">
                    <Camera className="h-8 w-8 opacity-50" />
                    Screenshot unavailable
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
