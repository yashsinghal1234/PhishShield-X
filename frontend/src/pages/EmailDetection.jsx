import React, { useState } from 'react';
import axios from 'axios';
import UserControls from '../components/UserControls';
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
    <div className="space-y-6 font-['Poppins'] animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#0F1720] mb-2">
            Email Phishing Detection
          </h1>
          <p className="text-[#64748B] font-medium">
            Upload a .eml file to check for spoofing (SPF/DKIM/DMARC), or paste the contents of a suspicious email to analyze intent and urgency.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <UserControls />
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-[#E5E9EB] p-6 shadow-sm">
        <form onSubmit={handleScan} className="space-y-6">
          <div className="space-y-6">
              <div className="border-2 border-dashed border-[#E2E8F0] rounded-2xl p-8 text-center bg-[#F8FAFC] hover:border-[#1F6A45]/50 transition-colors">
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
                      <UploadCloud className="h-12 w-12 text-[#1F6A45] mb-4" />
                      <span className="text-[#0F1720] font-semibold mb-1">
                          {file ? file.name : 'Upload .eml file (Recommended)'}
                      </span>
                      <span className="text-[#64748B] text-sm font-medium">
                          Allows analysis of hidden SPF/DKIM/DMARC headers to catch spoofing.
                      </span>
                  </label>
                  {file && (
                      <button type="button" onClick={() => setFile(null)} className="mt-4 text-sm font-semibold text-[#DC2626] hover:text-[#B91C1C]">
                          Remove file
                      </button>
                  )}
              </div>

              <div className="flex items-center">
                  <div className="flex-1 border-t border-[#E5E9EB]"></div>
                  <span className="px-4 text-[#94A3B8] font-semibold tracking-wider text-xs uppercase">OR PASTE RAW TEXT</span>
                  <div className="flex-1 border-t border-[#E5E9EB]"></div>
              </div>

              <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-2">Email Body Text</label>
                  <textarea
                      className="block w-full p-4 border border-[#E2E8F0] rounded-2xl bg-[#F8FAFC] text-[#0F1720] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1F6A45]/20 focus:border-[#1F6A45] transition-all min-h-[150px] disabled:opacity-50 font-medium"
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
            className="w-full flex items-center justify-center gap-2 py-3.5 px-8 rounded-2xl font-semibold text-white bg-[#1F6A45] hover:bg-[#185336] focus:outline-none focus:ring-4 focus:ring-[#1F6A45]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Mail className="h-5 w-5" />}
            Analyze Email Content
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-2xl text-[#DC2626] text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8 pt-8 border-t border-[#E5E9EB] animate-in slide-in-from-bottom-4">
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
              
              <div className="flex-1">
                <h3 className={`text-2xl font-bold tracking-tight mb-1 ${
                  result.prediction === 'Phishing' ? 'text-[#DC2626]' : 
                  result.prediction === 'Suspicious' ? 'text-[#D97706]' : 
                  'text-[#16A34A]'
                }`}>
                  {result.prediction} Detected
                </h3>
                <p className="text-[#64748B] font-medium mb-3">Confidence Score: {(result.confidence * 100).toFixed(2)}%</p>
                
                <div className="p-4 bg-white/60 border border-[#E5E9EB] rounded-2xl">
                  <h4 className="text-sm font-bold text-[#334155] mb-1.5 uppercase tracking-wider">Analysis Details</h4>
                  <p className="text-[#475569] font-medium leading-relaxed">{result.details}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
