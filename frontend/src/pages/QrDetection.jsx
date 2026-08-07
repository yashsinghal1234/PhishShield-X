import React, { useState, useRef } from 'react';
import axios from 'axios';
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
      const response = await axios.post('http://localhost:8000/api/detect/qr', formData, {
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
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">QR Phishing (Quishing) Detection</h1>
        <p className="text-gray-400">Upload a QR code to extract its contents and analyze for malicious intent.</p>
      </div>

      <div className="glass-panel p-8">
        <form onSubmit={handleScan} className="space-y-6">
          <div 
            className="border-2 border-dashed border-dark-700 rounded-2xl p-12 text-center cursor-pointer hover:border-primary-500 transition-colors bg-dark-900/50"
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
                <img src={preview} alt="QR Preview" className="h-48 w-48 object-contain mb-4 rounded-lg" />
                <span className="text-primary-400 text-sm font-medium">Click to change image</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="p-4 bg-primary-500/10 rounded-full mb-4">
                  <Upload className="h-8 w-8 text-primary-500" />
                </div>
                <p className="text-gray-300 font-medium mb-1">Click to upload QR code</p>
                <p className="text-gray-500 text-sm">PNG, JPG up to 10MB</p>
              </div>
            )}
          </div>
          
          <button
            type="submit"
            disabled={loading || !file}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 focus:ring-offset-dark-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Analyze QR Code'}
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
