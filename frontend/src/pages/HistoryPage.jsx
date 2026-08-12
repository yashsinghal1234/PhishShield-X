import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { History as HistoryIcon, Search } from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/history');
      setHistory(response.data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Detection History</h1>
          <p className="text-gray-400">Review past scans and threat analysis logs.</p>
        </div>
        <button 
          onClick={fetchHistory}
          className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-gray-200 rounded-lg transition-colors flex items-center"
        >
          <HistoryIcon size={18} className="mr-2" />
          Refresh
        </button>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="p-4 border-b border-dark-700 flex items-center bg-dark-900/50">
          <Search className="text-gray-500 mr-3" size={20} />
          <input 
            type="text" 
            placeholder="Search history..." 
            className="bg-transparent border-none focus:ring-0 text-gray-200 w-full placeholder-gray-500 outline-none"
          />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-dark-800/50 text-gray-400 text-sm uppercase tracking-wider">
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Target / Content</th>
                <th className="p-4 font-medium">Prediction</th>
                <th className="p-4 font-medium">Confidence</th>
                <th className="p-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">Loading history...</td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">No scans found.</td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-dark-800/30 transition-colors">
                    <td className="p-4">
                      <span className="text-xs px-2 py-1 bg-dark-700 text-gray-300 rounded uppercase font-semibold">
                        {item.scan_type}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300 max-w-md truncate">
                      {item.input_data}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.prediction === 'Phishing' ? 'bg-danger/10 text-danger' : item.prediction === 'Suspicious' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-safe/10 text-safe'
                      }`}>
                        {item.prediction}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300">
                      {(item.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="p-4 text-gray-400 text-sm">
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
