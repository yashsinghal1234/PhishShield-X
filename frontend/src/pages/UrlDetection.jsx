import React, { useState } from 'react';
import axios from 'axios';
import UserControls from '../components/UserControls';
import { Link2, AlertTriangle, ShieldCheck, Loader2, Globe, Server, MapPin, Calendar, Camera, Info, Copy, ExternalLink, Network, Database, Fingerprint } from 'lucide-react';

export default function UrlDetection() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!url) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/detect/url`, { url });
      setResult(response.data);
    } catch (err) {
      setError('Failed to scan URL. Is the backend running?');
    } finally {
      setLoading(false);
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
                <p className="text-[#64748B] font-medium mt-1">
                  Confidence Score: <span className="font-bold text-[#0F1720]">{(result.confidence * 100).toFixed(1)}%</span>
                </p>
              </div>
            </div>

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
                  <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase block mb-1.5">Brand</span>
                  <div className="flex items-center gap-2 text-[#0F1720] font-medium">
                    <Fingerprint className="h-4 w-4 text-[#94A3B8] shrink-0" />
                    {result.brand || '--'}
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
                <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold flex items-center gap-1 text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
                  Open Site <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              
              <div className="flex-1 bg-[#F8FAFC] rounded-2xl overflow-hidden border border-[#E2E8F0] relative group flex items-center justify-center">
                {result.screenshot_url ? (
                  <img 
                    src={result.screenshot_url} 
                    alt="Website Screenshot" 
                    className="w-full h-full object-cover object-top"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : (
                  <div className="text-[#94A3B8] font-medium text-sm flex flex-col items-center gap-2">
                    <Camera className="h-8 w-8 opacity-50" />
                    Screenshot unavailable
                  </div>
                )}
                <div className="hidden absolute inset-0 text-[#94A3B8] font-medium text-sm flex-col items-center justify-center gap-2 bg-[#F8FAFC]">
                  <Camera className="h-8 w-8 opacity-50" />
                  Screenshot unavailable
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
