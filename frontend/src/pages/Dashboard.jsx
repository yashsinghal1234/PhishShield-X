import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ShieldAlert, ShieldCheck, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Fetch actual data
    axios.get('http://localhost:8000/api/stats')
      .then(res => setStats(res.data))
      .catch(err => {
        console.error("Could not fetch stats", err);
        setStats({ error: true });
      });
  }, []);

  if (!stats) return <div className="text-gray-400">Loading...</div>;
  if (stats.error) return <div className="text-red-500">Failed to load live data from backend. Please ensure the backend is running.</div>;

  const chartData = [
    { name: 'Phishing', value: stats.phishing_detected, color: '#ef4444' },
    { name: 'Safe', value: stats.safe_detected, color: '#10b981' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Threat Overview</h1>
        <p className="text-gray-400">Real-time analysis of multi-modal phishing threats.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-4 bg-primary-500/20 rounded-xl">
            <Activity className="text-primary-500" size={24} />
          </div>
          <div>
            <p className="text-gray-400 text-sm">Total Scans</p>
            <p className="text-2xl font-bold text-white">{stats.total_scans}</p>
          </div>
        </div>
        
        <div className="glass-panel p-6 flex items-center space-x-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-danger/0 to-danger/10 group-hover:to-danger/20 transition-all" />
          <div className="p-4 bg-danger/20 rounded-xl relative z-10">
            <ShieldAlert className="text-danger" size={24} />
          </div>
          <div className="relative z-10">
            <p className="text-gray-400 text-sm">Threats Blocked</p>
            <p className="text-2xl font-bold text-white">{stats.phishing_detected}</p>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center space-x-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-safe/0 to-safe/10 group-hover:to-safe/20 transition-all" />
          <div className="p-4 bg-safe/20 rounded-xl relative z-10">
            <ShieldCheck className="text-safe" size={24} />
          </div>
          <div className="relative z-10">
            <p className="text-gray-400 text-sm">Safe Entries</p>
            <p className="text-2xl font-bold text-white">{stats.safe_detected}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Detection Distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-6">
          <h2 className="text-xl font-semibold text-white mb-6">Recent Threats</h2>
          <div className="space-y-4">
            {stats.recent_threats.length === 0 ? (
              <p className="text-gray-400">No threats detected recently.</p>
            ) : (
              stats.recent_threats.map((threat, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-dark-900/50 rounded-lg border border-dark-700">
                  <div className="truncate max-w-[200px] text-gray-300">
                    <span className="text-xs px-2 py-1 bg-dark-700 rounded mr-2 uppercase">{threat.scan_type}</span>
                    {threat.input_data.substring(0, 30)}...
                  </div>
                  <div className="text-danger font-medium text-sm">
                    {(threat.confidence * 100).toFixed(1)}% Risk
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
