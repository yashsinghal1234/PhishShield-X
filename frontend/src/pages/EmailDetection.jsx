import React, { useState } from 'react';
import axios from 'axios';
import { Mail, AlertTriangle, ShieldCheck, Loader2, UploadCloud } from 'lucide-react';

export default function EmailDetection() {
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!content && !file) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else if (content) {
        formData.append('content', content);
      }
      
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/detect/email`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setResult(response.data);
    } catch (err) {
      setError('Failed to scan Email. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Email Phishing Detection</h1>
        <p className="text-gray-400">Upload a .eml file to check for spoofing (SPF/DKIM/DMARC), or paste the contents of a suspicious email to analyze intent and urgency.</p>
      </div>

      <div className="glass-panel p-8">
        <form onSubmit={handleScan} className="space-y-6">
          <div className="space-y-6">
              <div className="border-2 border-dashed border-dark-700 rounded-xl p-8 text-center hover:border-primary-500 transition-colors">
                  <input
                      type="file"
                      id="eml-upload"
                      className="hidden"
                      accept=".eml,.msg"
                      onChange={(e) => {
                          setFile(e.target.files[0]);
                          setContent(''); // Clear content if file uploaded
                      }}
                  />
                  <label htmlFor="eml-upload" className="cursor-pointer flex flex-col items-center">
                      <UploadCloud className="h-12 w-12 text-primary-500 mb-4" />
                      <span className="text-gray-300 font-medium mb-1">
                          {file ? file.name : 'Upload .eml file (Recommended)'}
                      </span>
                      <span className="text-gray-500 text-sm">
                          Allows analysis of hidden SPF/DKIM/DMARC headers to catch spoofing.
                      </span>
                  </label>
                  {file && (
                      <button type="button" onClick={() => setFile(null)} className="mt-4 text-sm text-danger hover:text-danger-400">
                          Remove file
                      </button>
                  )}
              </div>

              <div className="flex items-center">
                  <div className="flex-1 border-t border-dark-700"></div>
                  <span className="px-4 text-gray-500 text-sm">OR PASTE RAW TEXT</span>
                  <div className="flex-1 border-t border-dark-700"></div>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Email Body Text</label>
                  <textarea
                      className="block w-full p-4 border border-dark-700 rounded-xl bg-dark-900/50 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all min-h-[150px] disabled:opacity-50"
                      placeholder="Dear customer, your account has been suspended..."
                      value={content}
                      disabled={!!file}
                      onChange={(e) => setContent(e.target.value)}
                  />
              </div>
          </div>
          
          <button
            type="submit"
            disabled={loading || (!content && !file)}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:ring-offset-dark-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : <Mail className="h-5 w-5 mr-2" />}
            Analyze Email Content
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8 pt-8 border-t border-dark-700 animate-in slide-in-from-bottom-4">
            <div className={`p-6 rounded-2xl border ${result.prediction === 'Phishing' ? 'bg-danger/10 border-danger/20' : 'bg-safe/10 border-safe/20'}`}>
              <div className="flex items-center space-x-4 mb-4">
                {result.prediction === 'Phishing' ? (
                  <AlertTriangle className="h-8 w-8 text-danger" />
                ) : (
                  <ShieldCheck className="h-8 w-8 text-safe" />
                )}
                <div>
                  <h3 className={`text-xl font-bold ${result.prediction === 'Phishing' ? 'text-danger' : 'text-safe'}`}>
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
