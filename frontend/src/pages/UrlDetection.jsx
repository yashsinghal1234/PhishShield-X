import React, { useState } from 'react';
import axios from 'axios';
import { Link2, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

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
      const response = await axios.post('http://localhost:8000/api/detect/url', { url });
      setResult(response.data);
    } catch (err) {
      setError('Failed to scan URL. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">URL Phishing Detection</h1>
        <p className="text-gray-400">Enter a suspicious URL to analyze its lexical features and domain reputation.</p>
      </div>

      <div className="glass-panel p-8">
        <form onSubmit={handleScan} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Target URL</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Link2 className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-3 border border-dark-700 rounded-xl bg-dark-900/50 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="https://example.com/login"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || !url}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:ring-offset-dark-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Analyze URL'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8 pt-8 border-t border-dark-700 animate-in slide-in-from-bottom-4">
            <div className={`p-6 rounded-2xl border ${
              result.prediction === 'Phishing' ? 'bg-danger/10 border-danger/20' : 
              result.prediction === 'Suspicious' ? 'bg-yellow-500/10 border-yellow-500/20' : 
              'bg-safe/10 border-safe/20'
            }`}>
              <div className="flex items-center space-x-4 mb-4">
                {result.prediction === 'Phishing' ? (
                  <AlertTriangle className="h-8 w-8 text-danger" />
                ) : result.prediction === 'Suspicious' ? (
                  <AlertTriangle className="h-8 w-8 text-yellow-500" />
                ) : (
                  <ShieldCheck className="h-8 w-8 text-safe" />
                )}
                <div>
                  <h3 className={`text-xl font-bold ${
                    result.prediction === 'Phishing' ? 'text-danger' : 
                    result.prediction === 'Suspicious' ? 'text-yellow-500' : 
                    'text-safe'
                  }`}>
                    {result.prediction} Detected
                  </h3>
                  <p className="text-gray-400 text-sm">Confidence Score: {(result.confidence * 100).toFixed(2)}%</p>
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-dark-900/50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-300 mb-1">Analysis Details</h4>
                <p className="text-sm text-gray-400">{result.details}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
