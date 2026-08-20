import React, { useState } from 'react';
import axios from 'axios';
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
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">URL Phishing Detection</h1>
        <p className="text-gray-400">Enter a suspicious URL to analyze its lexical features and domain reputation.</p>
      </div>

      <div className="bg-[#2B2B2B] rounded-2xl p-6 border border-dark-700 shadow-lg">
        <form onSubmit={handleScan} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Target URL</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Link2 className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="text"
                className="block w-full pl-12 pr-4 py-4 rounded-xl bg-[#1A1A1A] border-none text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all text-lg"
                placeholder="https://example.com/login"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || !url}
            className="w-full flex justify-center py-4 px-4 rounded-xl shadow-sm font-medium text-white bg-[#5D5D5D] hover:bg-[#6D6D6D] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:ring-offset-dark-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
          >
            {loading ? <Loader2 className="animate-spin h-6 w-6" /> : 'Analyze URL'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm flex items-center gap-2">
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
            <div className={`p-6 rounded-2xl border flex items-center gap-4 ${
              result.prediction === 'Phishing' ? 'bg-[#3A1D1D] border-[#5A2D2D]' : 
              result.prediction === 'Suspicious' ? 'bg-[#3A321D] border-[#5A4D2D]' : 
              'bg-[#1D3A2D] border-[#2D5A4D]'
            }`}>
              <div className={`p-3 rounded-full flex shrink-0 ${
                result.prediction === 'Phishing' ? 'bg-danger/20' : 
                result.prediction === 'Suspicious' ? 'bg-yellow-500/20' : 
                'bg-safe/20'
              }`}>
                {result.prediction === 'Phishing' ? (
                  <AlertTriangle className="h-8 w-8 text-danger" />
                ) : result.prediction === 'Suspicious' ? (
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                ) : (
                  <ShieldCheck className="h-8 w-8 text-safe" />
                )}
              </div>
              <div>
                <h3 className={`text-2xl font-bold ${
                  result.prediction === 'Phishing' ? 'text-danger' : 
                  result.prediction === 'Suspicious' ? 'text-yellow-500' : 
                  'text-safe'
                }`}>
                  {result.prediction} Detected
                </h3>
                <p className="text-gray-300">
                  Confidence Score: <span className="font-semibold text-white">{(result.confidence * 100).toFixed(1)}%</span>
                </p>
              </div>
            </div>

            {/* Scan Results Details */}
            <div className="glass-panel p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Info className="h-5 w-5 text-primary-500" /> Scan Results
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <span className="text-sm text-gray-500 block mb-1">Source URL:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white break-all">{url}</span>
                    <button onClick={() => copyToClipboard(url)} className="text-gray-500 hover:text-white transition-colors shrink-0">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-500 block mb-1">TLD:</span>
                  <span className="text-white font-medium">{result.tld || '--'}</span>
                </div>

                <div>
                  <span className="text-sm text-gray-500 block mb-1">IP Address:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#3B82F6] font-medium">{result.ip_address || '--'}</span>
                    {result.ip_address && (
                       <button onClick={() => copyToClipboard(result.ip_address)} className="text-gray-500 hover:text-white transition-colors shrink-0">
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-500 block mb-1">Location:</span>
                  <div className="flex items-center gap-2 text-white">
                    <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                    {result.location || '--'}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-500 block mb-1">Hosting Provider:</span>
                  <div className="flex items-center gap-2 text-white">
                    <Database className="h-4 w-4 text-gray-400 shrink-0" />
                    {result.hosting_provider || '--'}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-500 block mb-1">ASN:</span>
                  <div className="flex items-center gap-2 text-white">
                    <Network className="h-4 w-4 text-gray-400 shrink-0" />
                    {result.asn || '--'}
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-500 block mb-1">Detection Date:</span>
                  <div className="flex items-center gap-2 text-white">
                    <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                    {new Date().toLocaleString()}
                  </div>
                </div>
                
                <div className="md:col-span-2">
                  <span className="text-sm text-gray-500 block mb-1">Analysis Details:</span>
                  <div className="bg-dark-900/50 p-4 rounded-xl border border-dark-700 text-gray-300 text-sm leading-relaxed">
                    {result.details}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side Panels */}
          <div className="space-y-6">
            
            {/* Screenshot Panel */}
            <div className="glass-panel p-6 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Camera className="h-5 w-5 text-primary-500" /> Screenshot
                </h2>
                <a href={url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
                  Open Site <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              
              <div className="flex-1 bg-[#1A1A1A] rounded-xl overflow-hidden border border-dark-700 relative group flex items-center justify-center min-h-[250px]">
                {result.screenshot_url ? (
                  <img 
                    src={result.screenshot_url} 
                    alt="Website Screenshot" 
                    className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : (
                  <div className="text-gray-500 text-sm flex flex-col items-center gap-2">
                    <Camera className="h-8 w-8 opacity-50" />
                    Screenshot unavailable
                  </div>
                )}
                <div className="hidden absolute inset-0 text-gray-500 text-sm flex-col items-center justify-center gap-2 bg-[#1A1A1A]">
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
