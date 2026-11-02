import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UserControls from '../components/UserControls';
import {
  History as HistoryIcon,
  Search,
  Download,
  Filter,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/history`
      );
      setHistory(response.data || []);
    } catch (err) {
      console.warn('Failed to fetch history from backend, showing empty state.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const exportHistory = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(history, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', 'uniqode_phishshield_audit_history.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredHistory = history.filter((item) => {
    const matchesSearch =
      (item.content || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.prediction || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterType === 'ALL' ||
      (item.scan_type || '').toUpperCase() === filterType.toUpperCase();
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 font-['Plus_Jakarta_Sans'] animate-in fade-in duration-300 pb-0">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-[#0047FF]"></span>
            <span className="font-['Silkscreen'] text-xs uppercase tracking-widest text-[#0047FF] dark:text-[#9BBFE0]">
              AUDIT ARCHIVE // LOGS
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#0A0D14] dark:text-white">
            Detection History &amp; Audit
          </h1>
          <p className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8] mt-1">
            Comprehensive audit ledger of scanned URLs, quishing payloads, and analyzed email communications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportHistory}
            disabled={history.length === 0}
            className="px-4 py-2.5 bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] hover:border-[#0047FF] text-[#0A0D14] dark:text-white rounded-2xl transition-all flex items-center gap-2 font-['Silkscreen'] text-xs font-bold shadow-sm disabled:opacity-50 cursor-pointer"
          >
            <Download size={15} className="text-[#0047FF]" />
            <span>EXPORT JSON</span>
          </button>

          <button
            onClick={fetchHistory}
            className="px-4 py-2.5 bg-[#0047FF] hover:bg-[#0039CC] text-white rounded-2xl transition-all flex items-center gap-2 font-['Silkscreen'] text-xs font-bold shadow-sm shadow-[#0047FF]/20 cursor-pointer"
          >
            <HistoryIcon size={15} />
            <span>REFRESH</span>
          </button>

          <UserControls />
        </div>
      </div>

      {/* Main Table Bento Card */}
      <div className="rounded-[32px] bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] shadow-sm overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-5 border-b border-[#E2E6EE] dark:border-[#1E2533] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F8FAFD] dark:bg-[#141A26]">
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" size={17} />
            <input
              type="text"
              placeholder="Search by target domain, payload or prediction..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] text-xs font-mono text-[#0A0D14] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0047FF] transition-all"
            />
          </div>

          <div className="flex items-center gap-2 font-['Silkscreen'] text-[10px]">
            {['ALL', 'URL', 'QR', 'EMAIL'].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-xl transition-all uppercase font-bold cursor-pointer ${
                  filterType === type
                    ? 'bg-[#0047FF] text-white shadow-sm'
                    : 'bg-white dark:bg-[#0F131C] text-[#64748B] dark:text-[#94A3B8] border border-[#E2E6EE] dark:border-[#1E2533] hover:text-[#0047FF]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E2E6EE] dark:border-[#1E2533] font-['Silkscreen'] text-[10px] text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider bg-white dark:bg-[#0F131C]">
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Target / Content Payload</th>
                <th className="p-4 font-semibold">Verdict</th>
                <th className="p-4 font-semibold">Confidence</th>
                <th className="p-4 font-semibold">Logged Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6EE]/70 dark:divide-[#1E2533]/70 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-[#64748B] dark:text-[#94A3B8]">
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-10 text-center text-[#64748B] dark:text-[#94A3B8]">
                    No matching audit records discovered.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#F8FAFD] dark:hover:bg-[#141A26] transition-colors"
                  >
                    <td className="p-4">
                      <span className="font-['Silkscreen'] text-[9.5px] px-2 py-0.5 rounded-full bg-[#0047FF]/10 text-[#0047FF] dark:text-[#9BBFE0] uppercase font-bold">
                        {item.scan_type}
                      </span>
                    </td>
                    <td className="p-4 max-w-[340px] truncate text-[#0A0D14] dark:text-white font-medium" title={item.content}>
                      {item.content}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 font-['Silkscreen'] text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                          item.prediction === 'Phishing'
                            ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400'
                            : item.prediction === 'Suspicious'
                            ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                            : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        ■ {item.prediction}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-[#0A0D14] dark:text-white">
                      {Math.round((item.confidence || 0.95) * 100)}%
                    </td>
                    <td className="p-4 text-[#64748B] dark:text-[#94A3B8]">
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
