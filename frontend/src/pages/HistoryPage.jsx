import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UserControls from '../components/UserControls';
import { History as HistoryIcon, Search } from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/history`);
      setHistory(response.data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-['Poppins'] animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#0F1720] mb-2">Detection History</h1>
          <p className="text-[#64748B] font-medium">Review past scans and threat analysis logs.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchHistory}
            className="px-4 py-2 bg-white border border-[#E5E9EB] hover:bg-[#F8FAFC] text-[#0F1720] rounded-xl transition-colors flex items-center font-semibold shadow-sm"
          >
            <HistoryIcon size={18} className="mr-2 text-[#1F6A45]" />
            Refresh
          </button>
          <UserControls />
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-[#E5E9EB] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[#E5E9EB] flex items-center bg-[#F8FAFC]">
          <Search className="text-[#94A3B8] mr-3" size={20} />
          <input 
            type="text" 
            placeholder="Search history..." 
            className="bg-transparent border-none focus:ring-0 text-[#0F1720] w-full placeholder-[#94A3B8] outline-none font-medium"
          />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8FAFC] text-[#64748B] text-xs uppercase tracking-wider border-b border-[#E5E9EB]">
                <th className="p-4 font-bold">Type</th>
                <th className="p-4 font-bold">Target / Content</th>
                <th className="p-4 font-bold">Prediction</th>
                <th className="p-4 font-bold">Confidence</th>
                <th className="p-4 font-bold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E9EB]">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#94A3B8] font-medium">Loading history...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#94A3B8] font-medium">No scans found.</td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="p-4">
                      <span className="text-xs px-2.5 py-1 bg-[#E2E8F0] text-[#475569] rounded-md uppercase font-bold">
                        {item.scan_type}
                      </span>
                    </td>
                    <td className="p-4 text-[#0F1720] font-medium max-w-md truncate">
                      {item.input_data}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        item.prediction === 'Phishing' ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]' : 
                        item.prediction === 'Suspicious' ? 'bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]' : 
                        'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                      }`}>
                        {item.prediction}
                      </span>
                    </td>
                    <td className="p-4 text-[#334155] font-semibold">
                      {(item.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="p-4 text-[#64748B] text-sm font-medium">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
