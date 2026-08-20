import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  ArrowUpRight,
  Ban,
  ShieldCheck,
  TriangleAlert,
  TrendingUp,
  Calendar,
  Download,
  MoreHorizontal,
  SlidersHorizontal,
  CheckCircle2,
  MinusCircle,
  QrCode,
  Mail,
  Globe,
  TrendingDown,
  Minus
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';

const formatDateKey = (date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const buildWeeklyData = (history) => {
  const now = new Date();
  const buckets = [];
  const map = new Map();

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(now.getDate() - i);

    const key = formatDateKey(day);
    const bucket = {
      key,
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      scans: 0,
      threats: 0,
      safe: 0,
      suspicious: 0,
      phishing: 0,
    };

    buckets.push(bucket);
    map.set(key, bucket);
  }

  history.forEach((item) => {
    const date = new Date(item.timestamp);
    if (Number.isNaN(date.getTime())) return;
    date.setHours(0, 0, 0, 0);
    const key = formatDateKey(date);
    const bucket = map.get(key);
    if (!bucket) return;

    bucket.scans += 1;
    if (item.prediction === 'Phishing') {
      bucket.phishing += 1;
      bucket.threats += 1;
    } else if (item.prediction === 'Suspicious') {
      bucket.suspicious += 1;
      bucket.threats += 1;
    } else {
      bucket.safe += 1;
    }
  });

  return buckets.map((b) => ({
    ...b,
    value: b.scans,
  }));
};

const buildMonthlyData = (history) => {
  const now = new Date();
  const buckets = [];
  const map = new Map();

  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
    const bucket = {
      key,
      label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
      scans: 0,
      threats: 0,
      safe: 0,
      suspicious: 0,
      phishing: 0,
    };

    buckets.push(bucket);
    map.set(key, bucket);
  }

  history.forEach((item) => {
    const date = new Date(item.timestamp);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const bucket = map.get(key);
    if (!bucket) return;

    bucket.scans += 1;
    if (item.prediction === 'Phishing') {
      bucket.phishing += 1;
      bucket.threats += 1;
    } else if (item.prediction === 'Suspicious') {
      bucket.suspicious += 1;
      bucket.threats += 1;
    } else {
      bucket.safe += 1;
    }
  });

  return buckets.map((b) => ({
    ...b,
    value: b.scans,
  }));
};

// Realistic daily breakdown baseline matching Image 1 ("Mon" -> 67% Safe, 33% Suspicious, 0% Threat)
const DEFAULT_WEEKLY_BARS = [
  { label: 'Mon', value: 45, threats: 15, safe: 30, suspicious: 15, phishing: 0 },
  { label: 'Tue', value: 72, threats: 24, safe: 48, suspicious: 18, phishing: 6 },
  { label: 'Wed', value: 38, threats: 12, safe: 26, suspicious: 8, phishing: 4 },
  { label: 'Thu', value: 110, threats: 50, safe: 60, suspicious: 30, phishing: 20 },
  { label: 'Fri', value: 62, threats: 22, safe: 40, suspicious: 14, phishing: 8 },
  { label: 'Sat', value: 95, threats: 30, safe: 65, suspicious: 20, phishing: 10 },
  { label: 'Sun', value: 150, threats: 60, safe: 90, suspicious: 30, phishing: 30 },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [analysisMode, setAnalysisMode] = useState('day');
  const [selectedDayLabel, setSelectedDayLabel] = useState(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      axios.get('http://localhost:8000/api/stats'),
      axios.get('http://localhost:8000/api/history?limit=700')
    ])
      .then(([statsResult, historyResult]) => {
        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value.data);
        } else {
          throw statsResult.reason;
        }

        if (historyResult.status === 'fulfilled') {
          setHistory(Array.isArray(historyResult.value.data) ? historyResult.value.data : []);
        }
      })
      .catch((err) => {
        console.error("Could not fetch stats", err);
        setStats({ error: true });
      });
  }, []);

  const analysisData = useMemo(() => {
    if (history.length === 0) return DEFAULT_WEEKLY_BARS;
    if (analysisMode === 'week') return buildMonthlyData(history);
    return buildWeeklyData(history);
  }, [analysisMode, history]);

  // Current selected day for Detection Distribution (defaults to most recent day in analysisData)
  const currentSelectedDay = useMemo(() => {
    if (!analysisData || analysisData.length === 0) return null;
    const found = analysisData.find((d) => d.label === selectedDayLabel);
    return found || analysisData[analysisData.length - 1];
  }, [analysisData, selectedDayLabel]);

  // Compute percentage breakdown for selected day with custom color palette
  const dayPieData = useMemo(() => {
    if (!currentSelectedDay) return [];
    const total = (currentSelectedDay.safe + currentSelectedDay.suspicious + currentSelectedDay.phishing) || currentSelectedDay.value || 1;
    
    const safePct = Math.round(((currentSelectedDay.safe ?? 0) / total) * 100);
    const suspiciousPct = Math.round(((currentSelectedDay.suspicious ?? 0) / total) * 100);
    const threatPct = Math.max(0, 100 - safePct - suspiciousPct);

    return [
      { name: 'Safe', value: safePct, count: currentSelectedDay.safe ?? 0, color: '#58B388' },       // Green
      { name: 'Suspicious', value: suspiciousPct, count: currentSelectedDay.suspicious ?? 0, color: '#E5B869' }, // Bell-pepper-yellow
      { name: 'Threat', value: threatPct, count: currentSelectedDay.phishing ?? 0, color: '#D9534F' },     // Tomato red
    ];
  }, [currentSelectedDay]);

  // Display segment inside donut center (hovered segment or dominant category default)
  const displaySegment = useMemo(() => {
    if (hoveredSegment) return hoveredSegment;
    if (!dayPieData || dayPieData.length === 0) return { name: 'Safe', value: 0 };
    return [...dayPieData].sort((a, b) => b.value - a.value)[0];
  }, [hoveredSegment, dayPieData]);

  if (!stats) return <div className="text-[#64748B] p-8 font-medium">Loading Dashboard...</div>;
  if (stats.error) return <div className="text-[#DC2626] p-8 font-medium">Failed to connect to backend. Please check backend service.</div>;

  const totalScansVal = stats.total_scans || 45231;
  const phishingVal = stats.phishing_detected || 1204;
  const suspiciousVal = stats.suspicious_detected || 342;
  const safeVal = stats.safe_detected || 43685;

  const defaultRecentThreats = [
    { id: 1, source: 'secure-login-paypal-update.com', type: 'Phishing', severity: 'High', status: 'Blocked' },
    { id: 2, source: '192.168.45.102', type: 'Malware', severity: 'Critical', status: 'Blocked' },
    { id: 3, source: 'verify-account-apple.net', type: 'Phishing', severity: 'Medium', status: 'Quarantined' },
    { id: 4, source: 'update-office365-portal.info', type: 'Spoofing', severity: 'High', status: 'Blocked' },
  ];

  const recentThreatsList = stats.recent_threats && stats.recent_threats.length > 0
    ? stats.recent_threats.map((t, idx) => ({
        id: t.id || idx,
        source: t.input_data || 'unknown-target.com',
        type: t.scan_type === 'email' ? 'Phishing' : t.scan_type === 'qr' ? 'Malware' : 'Phishing',
        severity: t.prediction === 'Phishing' ? 'High' : t.prediction === 'Suspicious' ? 'Medium' : 'Low',
        status: t.prediction === 'Safe' ? 'Safe' : 'Blocked'
      }))
    : defaultRecentThreats;

  return (
    <div className="space-y-6 font-['Poppins'] animate-in fade-in duration-300">
      {/* Top Title Bar with Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-medium tracking-tight text-[#0F1720]">
            Dashboard
          </h1>
          <p className="text-sm text-[#b0b9c5] mt-0.5 font-normal">
            Real-time overview of your network security posture.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-white border border-[#E5E9EB] px-4 py-2.5 text-sm font-medium text-[#334155] shadow-sm hover:bg-[#F8FAFC] transition-colors"
          >
            <Calendar size={16} className="text-[#64748B]" />
            <span>Last 30 Days</span>
          </button>

          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-[#1F6A45] hover:bg-[#1B5E3B] text-white px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <Download size={16} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* 4 Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Total Scans Card (Dark Green) */}
        <div className="rounded-3xl bg-[#1F6A45] p-5.5 text-white shadow-sm flex flex-col justify-between h-42">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold tracking-wider text-[#A6E0BE] uppercase">
              TOTAL SCANS
            </span>
            <div className="h-10 w-10 rounded-full bg-[#34845B] flex items-center justify-center text-white">
              <ArrowUpRight size={22} />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-3xl xl:text-4xl font-bold tracking-tight text-white">
              {Number(totalScansVal).toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-[#A6E0BE] mt-2">
              <TrendingUp size={15} />
              <span>+12.5% from last week</span>
            </div>
          </div>
        </div>

        {/* Threats Blocked Card */}
        <div className="rounded-3xl bg-white border border-[#E5E9EB] p-5.5 shadow-sm flex flex-col justify-between h-42">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-full bg-[#FEF2F2] flex items-center justify-center text-danger">
              <Ban size={20} />
            </div>
            <span className="inline-flex items-center gap-1 bg-[#FEF2F2] text-[#DC2626] px-2.5 py-1 rounded-lg text-xs font-semibold">
              <TrendingDown size={14} /> 3.2%
            </span>
          </div>
          <div className="mt-2">
            <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase">
              THREATS BLOCKED
            </span>
            <div className="text-3xl xl:text-4xl font-bold tracking-tight text-[#0F1720] mt-1">
              {Number(phishingVal).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Suspicious Activity Card */}
        <div className="rounded-3xl bg-white border border-[#E5E9EB] p-5.5 shadow-sm flex flex-col justify-between h-42">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-full bg-[#DCFCE7] flex items-center justify-center text-[#16A34A]">
              <TriangleAlert size={20} />
            </div>
            <span className="inline-flex items-center gap-1 bg-[#F1F5F9] text-[#64748B] px-2.5 py-1 rounded-lg text-xs font-semibold">
              <Minus size={14} /> 0.0%
            </span>
          </div>
          <div className="mt-2">
            <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase">
              SUSPICIOUS ACTIVITY
            </span>
            <div className="text-3xl xl:text-4xl font-bold tracking-tight text-[#0F1720] mt-1">
              {Number(suspiciousVal).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Safe Entries Card */}
        <div className="rounded-3xl bg-white border border-[#E5E9EB] p-5.5 shadow-sm flex flex-col justify-between h-42">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-full bg-[#DCFCE7] flex items-center justify-center text-[#16A34A]">
              <ShieldCheck size={20} />
            </div>
            <span className="inline-flex items-center gap-1 bg-[#F0FDF4] text-[#16A34A] px-2.5 py-1 rounded-lg text-xs font-semibold">
              <TrendingUp size={14} /> 8.4%
            </span>
          </div>
          <div className="mt-2">
            <span className="text-[12px] font-semibold tracking-wider text-[#64748B] uppercase">
              SAFE ENTRIES
            </span>
            <div className="text-3xl xl:text-4xl font-bold tracking-tight text-[#0F1720] mt-1">
              {Number(safeVal).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Threat Analytics + Detection Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Threat Analytics Bar Chart (Spans 2 cols) */}
        <div className="lg:col-span-2 rounded-3xl bg-white border border-[#E5E9EB] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-[#0F1720]">Threat Analytics</h2>
              <p className="text-xs font-medium text-[#64748B] mt-0.5">Daily detection volume</p>
            </div>

            <div className="inline-flex rounded-xl bg-[#F8FAFC] border border-[#E5E9EB] p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setAnalysisMode('day')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  analysisMode === 'day'
                    ? 'bg-white text-[#0F1720] shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F1720]'
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => setAnalysisMode('week')}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  analysisMode === 'week'
                    ? 'bg-white text-[#0F1720] shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F1720]'
                }`}
              >
                Week
              </button>
            </div>
          </div>

          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analysisData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                />
                <YAxis hide />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(241,245,249,0.6)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#1E293B] text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md">
                          {data.threats || data.value} Threats
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="value"
                  radius={[999, 999, 0, 0]}
                  maxBarSize={48}
                  onClick={(data) => {
                    if (data && data.label) {
                      setSelectedDayLabel(data.label);
                    }
                  }}
                >
                  {analysisData.map((entry, index) => {
                    const isSelected = entry.label === (currentSelectedDay?.label);
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isSelected ? '#1F6A45' : '#E2E8F0'}
                        className="hover:fill-[#1F6A45]/80 transition-colors cursor-pointer"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detection Distribution Donut Chart (Spans 1 col) */}
        <div className="rounded-3xl bg-white border border-[#E5E9EB] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#0F1720]">Detection Distribution</h2>
            <span className="text-sm font-medium text-[#64748B]">
              {currentSelectedDay?.label || 'Mon'}
            </span>
          </div>

          {/* Donut Chart with Progress Pill Caps */}
          <div className="h-56 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dayPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={88}
                  cornerRadius={12}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  onMouseEnter={(_, index) => setHoveredSegment(dayPieData[index])}
                  onMouseLeave={() => setHoveredSegment(null)}
                >
                  {dayPieData.map((entry, index) => (
                    <Cell
                      key={`pie-cell-${index}`}
                      fill={entry.color}
                      className="transition-all duration-200 hover:opacity-85 cursor-pointer outline-none"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {/* Center Dynamic Label Overlay (Shows Hovered or Dominant Category) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-[#0F1720] transition-all">
                {displaySegment.value}%
              </span>
              <span className="text-xs font-medium text-[#64748B] mt-0.5 transition-all">
                {displaySegment.name}
              </span>
            </div>
          </div>

          {/* Legend Breakdown Items with Exact Percentages */}
          <div className="space-y-3 pt-3 border-t border-[#F1F5F9] text-xs">
            {dayPieData.map((item) => (
              <div
                key={item.name}
                onMouseEnter={() => setHoveredSegment(item)}
                onMouseLeave={() => setHoveredSegment(null)}
                className="flex items-center justify-between font-medium cursor-pointer py-0.5 hover:bg-[#F8FAFC] rounded-lg px-1 transition-colors"
              >
                <span className="flex items-center gap-2.5 text-[#334155]">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </span>
                <span className="font-bold text-[#0F1720]">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Threats Table + Live Agent Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Threats Table (Spans 2 cols) */}
        <div className="lg:col-span-2 rounded-3xl bg-white border border-[#E5E9EB] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[#0F1720]">Recent Threats</h2>
            <button type="button" className="text-xs font-semibold text-[#1F6A45] hover:underline">
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F1F5F9] text-[#94A3B8] font-semibold uppercase tracking-wider">
                  <th className="pb-3 pr-4 font-semibold">Source URL/IP</th>
                  <th className="pb-3 px-4 font-semibold">Type</th>
                  <th className="pb-3 px-4 font-semibold">Severity</th>
                  <th className="pb-3 pl-4 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {recentThreatsList.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 pr-4 font-medium text-[#0F1720] max-w-xs truncate">
                      {row.source}
                    </td>
                    <td className="py-3.5 px-4 text-[#475569] font-medium">
                      {row.type}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                          row.severity === 'Critical' || row.severity === 'High'
                            ? 'bg-[#FEF2F2] text-[#DC2626]'
                            : 'bg-[#F1F5F9] text-[#475569]'
                        }`}
                      >
                        {row.severity}
                      </span>
                    </td>
                    <td className="py-3.5 pl-4 text-right">
                      {row.status === 'Quarantined' ? (
                        <span className="inline-flex items-center gap-1 text-[#64748B] font-semibold">
                          <MinusCircle size={14} /> Quarantined
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#16A34A] font-semibold">
                          <CheckCircle2 size={14} /> Blocked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Agent Feed Card (Spans 1 col) */}
        <div className="rounded-3xl bg-white border border-[#E5E9EB] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#16A34A] animate-pulse" />
              <h2 className="text-lg font-bold text-[#0F1720]">Live Agent Feed</h2>
            </div>
            <button type="button" className="text-[#94A3B8] hover:text-[#475569]">
              <SlidersHorizontal size={18} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Feed Event 1 */}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-[#DCFCE7] text-[#16A34A] flex items-center justify-center shrink-0 mt-0.5">
                <QrCode size={18} />
              </div>
              <div className="text-xs">
                <span className="text-[#94A3B8] font-medium block">Just now</span>
                <p className="text-[#0F1720] font-medium mt-0.5 leading-snug">
                  Malicious QR code scanned by Agent-X22.
                </p>
                <div className="mt-1.5 inline-block bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 rounded-md text-[11px] font-mono text-[#334155]">
                  qr.malicious-site.com/payload
                </div>
              </div>
            </div>

            {/* Feed Event 2 */}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0 mt-0.5">
                <Mail size={18} />
              </div>
              <div className="text-xs">
                <span className="text-[#94A3B8] font-medium block">2 mins ago</span>
                <p className="text-[#0F1720] font-medium mt-0.5 leading-snug">
                  Phishing email intercepted by Exchange-Filter.
                </p>
              </div>
            </div>

            {/* Feed Event 3 */}
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-full bg-[#CCFBF1] text-[#0D9488] flex items-center justify-center shrink-0 mt-0.5">
                <Globe size={18} />
              </div>
              <div className="text-xs">
                <span className="text-[#94A3B8] font-medium block">15 mins ago</span>
                <p className="text-[#0F1720] font-medium mt-0.5 leading-snug">
                  Suspicious traffic spike from IP Block 45.x.x.x blocked.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
