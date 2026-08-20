import React, { useState, useRef } from 'react';
import axios from 'axios';
import UserControls from '../components/UserControls';
import { Upload, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

export default function QrDetection() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!file) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/detect/qr`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to scan QR code.');
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
            QR Phishing (Quishing) Detection
          </h1>
          <p className="text-[#64748B] font-medium">
            Upload a QR code to extract its contents and analyze for malicious intent.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <UserControls />
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-[#E5E9EB] p-6 shadow-sm">
        <form onSubmit={handleScan} className="space-y-6">
          <div 
            className="border-2 border-dashed border-[#E2E8F0] rounded-2xl p-12 text-center cursor-pointer hover:border-[#1F6A45]/50 transition-colors bg-[#F8FAFC]"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            {preview ? (
              <div className="flex flex-col items-center">
                <img src={preview} alt="QR Preview" className="h-48 w-48 object-contain mb-4 rounded-xl border border-[#E5E9EB] bg-white p-2 shadow-sm" />
                <span className="text-[#1F6A45] text-sm font-semibold hover:text-[#185336] transition-colors">Click to change image</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="p-4 bg-[#F0FDF4] rounded-full mb-4">
                  <Upload className="h-8 w-8 text-[#16A34A]" />
                </div>
                <p className="text-[#0F1720] font-semibold mb-1">Click to upload QR code</p>
                <p className="text-[#64748B] text-sm font-medium">PNG, JPG up to 10MB</p>
              </div>
            )}
          </div>
          
          <button
            type="submit"
            disabled={loading || !file}
            className="w-full flex justify-center py-3.5 px-4 rounded-2xl shadow-sm font-semibold text-white bg-[#1F6A45] hover:bg-[#185336] focus:outline-none focus:ring-4 focus:ring-[#1F6A45]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Analyze QR Code'}
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
