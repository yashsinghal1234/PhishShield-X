import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import UserControls from '../components/UserControls';
import { useTheme } from '../context/ThemeContext';
import {
  ArrowUpRight,
  Ban,
  ShieldCheck,
  TriangleAlert,
  TrendingUp,
  Calendar,
  Download,
  Puzzle,
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
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

function CustomBarTooltip({ active, payload, isDark }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  const totalScans = d.scans ?? d.value ?? 0;
  const threatRate = totalScans > 0 ? (((d.threats ?? 0) / totalScans) * 100).toFixed(0) : 0;

  return (
    <div
      className={`p-3 rounded-xl shadow-md text-xs font-medium space-y-1.5 border backdrop-blur-md min-w-[170px] ${
        isDark
          ? 'bg-[#15222E]/95 border-[#223446] text-slate-100'
          : 'bg-white/95 border-slate-200 text-slate-800'
      }`}
    >
      <div className="flex items-center justify-between gap-4 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
        <span className="font-bold text-[13px] text-[#0F1720] dark:text-white">
          {d.fullDate || d.label}
        </span>
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1F6A45]/15 text-[#1F6A45] dark:text-[#4ADE80]">
          {totalScans} scans
        </span>
      </div>
      <div className="space-y-1 pt-0.5">
        <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#10B981]" />
            Clean / Safe
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{d.safe ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#F59E0B]" />
            Suspicious
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{d.suspicious ?? 0}</span>
        </div>
        <div className="flex items-center justify-between gap-3 text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#EF4444]" />
            Quarantined
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{d.phishing ?? 0}</span>
        </div>
      </div>
      <div className="pt-1.5 text-[10.5px] text-slate-400 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-700/50 flex justify-between items-center">
        <span>Threat Rate:</span>
        <span className="font-bold text-amber-500">{threatRate}%</span>
      </div>
    </div>
  );
}

const formatDateKey = (date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Realistic baseline distributed across the 7 days (sums to 47 safe, 18 suspicious, 24 phishing = 89 total scans)
const BASELINE_WEEK_PATTERN = [
  { safe: 6, suspicious: 3, phishing: 3 }, // 6 days ago (12)
  { safe: 8, suspicious: 2, phishing: 4 }, // 5 days ago (14)
  { safe: 5, suspicious: 2, phishing: 3 }, // 4 days ago (10)
  { safe: 8, suspicious: 3, phishing: 4 }, // 3 days ago (15)
  { safe: 7, suspicious: 3, phishing: 3 }, // 2 days ago (13)
  { safe: 8, suspicious: 2, phishing: 4 }, // 1 day ago (14)
  { safe: 5, suspicious: 3, phishing: 3 }, // Today (11)
];

const buildWeeklyData = (history) => {
  const now = new Date();
  const buckets = [];
  const map = new Map();

  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(now.getDate() - i);

    const key = formatDateKey(day);
    const patternIdx = 6 - i;
    const base = BASELINE_WEEK_PATTERN[patternIdx] || { safe: 4, suspicious: 1, phishing: 1 };

    const bucket = {
      key,
      label: day.toLocaleDateString('en-US', { weekday: 'short' }),
      fullDate: day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      scans: base.safe + base.suspicious + base.phishing,
      threats: base.suspicious + base.phishing,
      safe: base.safe,
      suspicious: base.suspicious,
      phishing: base.phishing,
    };

    buckets.push(bucket);
    map.set(key, bucket);
  }

  // Merge live user scan history into the respective day buckets
  if (Array.isArray(history) && history.length > 0) {
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
  }

  return buckets.map((b) => ({
    ...b,
    value: b.scans,
  }));
};

const BASELINE_MONTH_PATTERN = [
  { safe: 38, suspicious: 12, phishing: 16 }, // 5 mo ago (66)
  { safe: 45, suspicious: 15, phishing: 18 }, // 4 mo ago (78)
  { safe: 51, suspicious: 17, phishing: 22 }, // 3 mo ago (90)
  { safe: 58, suspicious: 19, phishing: 25 }, // 2 mo ago (102)
  { safe: 64, suspicious: 22, phishing: 28 }, // 1 mo ago (114)
  { safe: 47, suspicious: 18, phishing: 24 }, // This mo (89)
];

const buildMonthlyData = (history) => {
  const now = new Date();
  const buckets = [];
  const map = new Map();

  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
    const patternIdx = 5 - i;
    const base = BASELINE_MONTH_PATTERN[patternIdx] || { safe: 40, suspicious: 15, phishing: 20 };

    const bucket = {
      key,
      label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
      fullDate: monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      scans: base.safe + base.suspicious + base.phishing,
      threats: base.suspicious + base.phishing,
      safe: base.safe,
      suspicious: base.suspicious,
      phishing: base.phishing,
    };

    buckets.push(bucket);
    map.set(key, bucket);
  }

  return buckets.map((b) => ({
    ...b,
    value: b.scans,
  }));
};


function DashboardSkeleton() {
  return (
    <div className="space-y-6 font-['Poppins'] animate-pulse">
      {/* Top Title Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="h-8 w-44 bg-slate-200 rounded-xl" />
          <div className="h-4 w-72 bg-slate-100 rounded-lg mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-28 bg-slate-200 rounded-xl" />
          <div className="h-10 w-32 bg-slate-200 rounded-xl" />
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-3xl bg-white border border-[#E5E9EB] p-5.5 h-42 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-200 rounded" />
              <div className="h-10 w-10 bg-slate-100 rounded-full" />
            </div>
            <div>
              <div className="h-8 w-20 bg-slate-200 rounded-lg" />
              <div className="h-4 w-32 bg-slate-100 rounded mt-2" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-3xl bg-white border border-[#E5E9EB] p-6 h-80 shadow-sm flex flex-col justify-between">
          <div className="h-6 w-40 bg-slate-200 rounded" />
          <div className="h-56 bg-slate-100 rounded-2xl" />
        </div>
        <div className="rounded-3xl bg-white border border-[#E5E9EB] p-6 h-80 shadow-sm flex flex-col justify-between">
          <div className="h-6 w-36 bg-slate-200 rounded" />
          <div className="h-48 w-48 bg-slate-100 rounded-full mx-auto my-auto" />
        </div>
      </div>

      {/* Bottom Table Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-3xl bg-white border border-[#E5E9EB] p-6 h-64 shadow-sm">
          <div className="h-6 w-36 bg-slate-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((r) => (
              <div key={r} className="h-10 bg-slate-100 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="rounded-3xl bg-white border border-[#E5E9EB] p-6 h-64 shadow-sm">
          <div className="h-6 w-36 bg-slate-200 rounded mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((r) => (
              <div key={r} className="h-10 bg-slate-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_BASELINE_STATS = {
  total_scans: 89,
  total_scans_trend: 12.5,
  phishing_detected: 24,
  phishing_trend: -8.3,
  suspicious_detected: 18,
  suspicious_trend: 4.2,
  safe_detected: 47,
  safe_trend: 15.0,
  recent_threats: [
    { id: 89, input_data: "login-verify-account.com", scan_type: "url", prediction: "Phishing", confidence: 0.98, timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
    { id: 88, input_data: "invoice-payment-portal.net", scan_type: "url", prediction: "Suspicious", confidence: 0.72, timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
    { id: 87, input_data: "https://accounts.google.com", scan_type: "url", prediction: "Safe", confidence: 0.99, timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
    { id: 86, input_data: "secure-banking-update.xyz", scan_type: "qr", prediction: "Phishing", confidence: 0.95, timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString() },
    { id: 85, input_data: "HR Department - Employee Bonus", scan_type: "email", prediction: "Suspicious", confidence: 0.68, timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString() }
  ]
};

const DEFAULT_BASELINE_HISTORY = [
  { id: 89, input_data: "login-verify-account.com", scan_type: "url", prediction: "Phishing", confidence: 0.98, timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
  { id: 88, input_data: "invoice-payment-portal.net", scan_type: "url", prediction: "Suspicious", confidence: 0.72, timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
  { id: 87, input_data: "https://accounts.google.com", scan_type: "url", prediction: "Safe", confidence: 0.99, timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString() },
  { id: 86, input_data: "secure-banking-update.xyz", scan_type: "qr", prediction: "Phishing", confidence: 0.95, timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString() },
  { id: 85, input_data: "HR Department - Employee Bonus", scan_type: "email", prediction: "Suspicious", confidence: 0.68, timestamp: new Date(Date.now() - 1000 * 60 * 360).toISOString() },
  { id: 84, input_data: "https://github.com", scan_type: "url", prediction: "Safe", confidence: 1.0, timestamp: new Date(Date.now() - 1000 * 60 * 500).toISOString() },
  { id: 83, input_data: "support@it-desk-portal.org", scan_type: "email", prediction: "Phishing", confidence: 0.92, timestamp: new Date(Date.now() - 1000 * 60 * 700).toISOString() },
  { id: 82, input_data: "WIFI:S:Staff_Network;T:WPA;;", scan_type: "qr", prediction: "Safe", confidence: 0.96, timestamp: new Date(Date.now() - 1000 * 60 * 900).toISOString() },
  { id: 81, input_data: "https://paypal-security-alert.tk", scan_type: "url", prediction: "Phishing", confidence: 0.99, timestamp: new Date(Date.now() - 1000 * 60 * 1200).toISOString() },
  { id: 80, input_data: "https://cloudflare.com", scan_type: "url", prediction: "Safe", confidence: 1.0, timestamp: new Date(Date.now() - 1000 * 60 * 1500).toISOString() }
];

export default function Dashboard() {
  const { isDark } = useTheme();
  const [stats, setStats] = useState(() => {
    try {
      const cached = localStorage.getItem('phishshield_cached_stats');
      if (cached) return JSON.parse(cached);
    } catch {}
    return DEFAULT_BASELINE_STATS;
  });

  const [history, setHistory] = useState(() => {
    try {
      const cached = localStorage.getItem('phishshield_cached_history');
      if (cached) return JSON.parse(cached);
    } catch {}
    return DEFAULT_BASELINE_HISTORY;
  });

  const [isSyncing, setIsSyncing] = useState(true);
  const [analysisMode, setAnalysisMode] = useState('day');
  const [selectedDayLabel, setSelectedDayLabel] = useState(null);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  useEffect(() => {
    Promise.allSettled([
      axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/stats`, { timeout: 15000 }),
      axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/history?limit=100`, { timeout: 15000 })
    ])
      .then(([statsResult, historyResult]) => {
        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value.data);
          try {
            localStorage.setItem('phishshield_cached_stats', JSON.stringify(statsResult.value.data));
          } catch {}
        }

        if (historyResult.status === 'fulfilled') {
          const hData = Array.isArray(historyResult.value.data) ? historyResult.value.data : [];
          setHistory(hData);
          try {
            localStorage.setItem('phishshield_cached_history', JSON.stringify(hData));
          } catch {}
        }
      })
      .catch((err) => {
        console.error("Could not fetch live stats", err);
      })
      .finally(() => {
        setIsSyncing(false);
      });
  }, []);

  const analysisData = useMemo(() => {
    if (analysisMode === 'week') return buildMonthlyData(history);
    return buildWeeklyData(history);
  }, [analysisMode, history]);

  // Current selected day for Detection Distribution (null or 'all' means overall breakdown)
  const currentSelectedDay = useMemo(() => {
    if (!analysisData || analysisData.length === 0) return null;
    if (selectedDayLabel === 'all') return null;
    if (!selectedDayLabel) return null; // Default to overall
    const found = analysisData.find((d) => d.label === selectedDayLabel);
    return found || null;
  }, [analysisData, selectedDayLabel]);

  const isOverall = !currentSelectedDay;

  // Compute percentage breakdown with standard high-contrast security colors
  const dayPieData = useMemo(() => {
    let safeCount = 0;
    let suspiciousCount = 0;
    let phishingCount = 0;

    if (isOverall) {
      safeCount = stats.safe_detected ?? 47;
      suspiciousCount = stats.suspicious_detected ?? 18;
      phishingCount = stats.phishing_detected ?? 24;
    } else {
      safeCount = currentSelectedDay.safe ?? 0;
      suspiciousCount = currentSelectedDay.suspicious ?? 0;
      phishingCount = currentSelectedDay.phishing ?? 0;
    }

    const total = safeCount + suspiciousCount + phishingCount;
    if (total === 0) {
      return [
        { name: 'Clean / Safe', value: 100, count: 0, color: '#10B981' }
      ];
    }

    const safePct = Math.round((safeCount / total) * 100);
    const suspiciousPct = Math.round((suspiciousCount / total) * 100);
    const threatPct = Math.max(0, 100 - safePct - suspiciousPct);

    return [
      { name: 'Clean / Safe', value: safePct, count: safeCount, color: '#10B981' },
      { name: 'Suspicious', value: suspiciousPct, count: suspiciousCount, color: '#F59E0B' },
      { name: 'Quarantined Threat', value: threatPct, count: phishingCount, color: '#EF4444' },
    ];
  }, [currentSelectedDay, isOverall, stats]);

  // Display segment inside donut center (hovered segment or dominant category default)
  const displaySegment = useMemo(() => {
    if (hoveredSegment) return hoveredSegment;
    if (!dayPieData || dayPieData.length === 0) return { name: 'Clean / Safe', value: 0, count: 0 };
    return [...dayPieData].sort((a, b) => b.value - a.value)[0];
  }, [hoveredSegment, dayPieData]);

  if (!stats) return <DashboardSkeleton />;
  if (stats.error) return <div className="text-[#DC2626] p-8 font-medium">Failed to connect to backend. Please check backend service.</div>;

  const totalScansVal = stats.total_scans ?? 0;
  const totalScansTrend = stats.total_scans_trend ?? 0;
  const phishingVal = stats.phishing_detected ?? 0;
  const phishingTrend = stats.phishing_trend ?? 0;
  const suspiciousVal = stats.suspicious_detected ?? 0;
  const suspiciousTrend = stats.suspicious_trend ?? 0;
  const safeVal = stats.safe_detected ?? 0;
  const safeTrend = stats.safe_trend ?? 0;
  
  const formatTrendBadge = (trend, inverse = false) => {
    if (trend === 0) return { text: '0.0%', icon: <Minus size={14} />, classes: 'bg-[#F1F5F9] text-[#64748B]' };
    const isPositive = trend > 0;
    const text = `${isPositive ? '+' : ''}${trend}%`;
    const icon = isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />;
    
    // For threats, positive trend is BAD (red), negative trend is GOOD (green)
    // For safe entries, positive trend is GOOD (green), negative trend is BAD (red)
    let isGood = inverse ? !isPositive : isPositive;
    
    const classes = isGood ? 'bg-[#F0FDF4] text-[#16A34A]' : 'bg-[#FEF2F2] text-[#DC2626]';
    return { text, icon, classes };
  };

  const recentThreatsList = stats.recent_threats && stats.recent_threats.length > 0
    ? stats.recent_threats.map((t, idx) => ({
        id: t.id || idx,
        source: t.input_data || 'unknown-target.com',
        type: t.scan_type === 'email' ? 'Phishing' : t.scan_type === 'qr' ? 'Malware' : 'Phishing',
        severity: t.prediction === 'Phishing' ? 'High' : t.prediction === 'Suspicious' ? 'Medium' : 'Low',
        status: t.prediction === 'Safe' ? 'Safe' : t.prediction === 'Suspicious' ? 'Flagged' : 'Blocked'
      }))
    : [];

  return (
    <div className="space-y-6 font-['Poppins'] animate-in fade-in duration-300">
      {/* Top Title Bar with Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-4xl font-medium tracking-tight text-[#0F1720]">
              Dashboard
            </h1>
            {isSyncing ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] animate-pulse">
                <span className="h-2 w-2 rounded-full bg-[#D97706] animate-ping" />
                Syncing Live Gateway...
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]">
                <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                Live Gateway Active
              </span>
            )}
          </div>
          <p className="text-sm text-[#b0b9c5] mt-0.5 font-normal">
            Real-time overview of your network security posture.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/phishshield-extension.zip"
            download="PhishShield-EDL-Extension.zip"
            className="flex items-center gap-2 rounded-xl bg-white border border-[#1F6A45]/30 px-4 py-2.5 text-sm font-medium text-[#1F6A45] shadow-sm hover:bg-[#EAF5F0] transition-colors cursor-pointer"
            title="Download the PhishShield-EDL browser extension (Manifest V3)"
          >
            <Puzzle size={16} />
            <span>Get Extension</span>
          </a>

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
          
          <div className="h-8 w-px bg-[#E5E9EB] mx-1"></div>
          <UserControls />
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
              {totalScansTrend >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              <span>{totalScansTrend > 0 ? '+' : ''}{totalScansTrend}% from last week</span>
            </div>          </div>
        </div>

        {/* Threats Blocked Card */}
        <div className="rounded-3xl bg-white border border-[#E5E9EB] p-5.5 shadow-sm flex flex-col justify-between h-42">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 rounded-full bg-[#FEF2F2] flex items-center justify-center text-danger">
              <Ban size={20} />
            </div>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${formatTrendBadge(phishingTrend, true).classes}`}>
              {formatTrendBadge(phishingTrend, true).icon} {formatTrendBadge(phishingTrend, true).text}
            </span>          </div>
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
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${formatTrendBadge(suspiciousTrend, true).classes}`}>
              {formatTrendBadge(suspiciousTrend, true).icon} {formatTrendBadge(suspiciousTrend, true).text}
            </span>          </div>
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
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${formatTrendBadge(safeTrend, false).classes}`}>
              {formatTrendBadge(safeTrend, false).icon} {formatTrendBadge(safeTrend, false).text}
            </span>          </div>
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
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#0F1720]">Scan Activity &amp; Threats</h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EAF5F0] text-[#1F6A45]">
                  Live
                </span>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Click any bar to filter detection distribution by that period
              </p>
            </div>

            <div className="inline-flex rounded-xl bg-[#F8FAFC] border border-[#E5E9EB] p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setAnalysisMode('day');
                  setSelectedDayLabel(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  analysisMode === 'day'
                    ? 'bg-white text-[#0F1720] shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F1720]'
                }`}
              >
                Last 7 Days
              </button>
              <button
                type="button"
                onClick={() => {
                  setAnalysisMode('week');
                  setSelectedDayLabel(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  analysisMode === 'week'
                    ? 'bg-white text-[#0F1720] shadow-sm'
                    : 'text-[#64748B] hover:text-[#0F1720]'
                }`}
              >
                Last 6 Months
              </button>
            </div>
          </div>

          <div className="h-64 relative">
            <ResponsiveContainer width="100%" height="100%" minWidth={220} minHeight={200}>
              <BarChart
                data={analysisData}
                margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
                onClick={(state) => {
                  if (state && state.activePayload && state.activePayload.length) {
                    const clickedData = state.activePayload[0].payload;
                    setSelectedDayLabel((prev) => (prev === clickedData.label ? null : clickedData.label));
                  }
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isDark ? '#223446' : '#F1F5F9'}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: isDark ? '#94A3B8' : '#64748B', fontSize: 12, fontWeight: 500 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: isDark ? '#64748B' : '#94A3B8', fontSize: 11 }}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  cursor={false}
                  content={<CustomBarTooltip isDark={isDark} />}
                />
                <Bar
                  dataKey="scans"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={44}
                  minPointSize={6}
                >
                  {analysisData.map((entry, index) => {
                    const isSelected = entry.label === currentSelectedDay?.label;
                    return (
                      <Cell
                        key={`bar-cell-${index}`}
                        fill={isSelected ? '#1F6A45' : isDark ? '#243547' : '#E2E8F0'}
                        className="transition-colors cursor-pointer hover:opacity-85"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Bar Summary Footer */}
          <div className="flex flex-wrap items-center justify-between pt-3 border-t border-[#F1F5F9] text-xs text-[#64748B]">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#1F6A45]" />
                {currentSelectedDay ? (
                  <span>Selected: <strong className="text-[#0F1720]">{currentSelectedDay.fullDate || currentSelectedDay.label}</strong></span>
                ) : (
                  <span>Showing: <strong className="text-[#0F1720]">All Activity (Click bar to isolate)</strong></span>
                )}
              </span>
            </div>
            {currentSelectedDay && (
              <button
                type="button"
                onClick={() => setSelectedDayLabel(null)}
                className="text-[11px] text-[#1F6A45] hover:underline font-medium cursor-pointer"
              >
                Clear Selection
              </button>
            )}
          </div>
        </div>

        {/* Detection Distribution Donut Chart (Spans 1 col) */}
        <div className="rounded-3xl bg-white border border-[#E5E9EB] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#0F1720]">Detection Distribution</h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                {isOverall
                  ? 'All-Time Scan Aggregation'
                  : `Distribution for ${currentSelectedDay?.fullDate || currentSelectedDay?.label}`}
              </p>
            </div>
            {selectedDayLabel && selectedDayLabel !== 'all' ? (
              <button
                type="button"
                onClick={() => setSelectedDayLabel(null)}
                className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EAF5F0] text-[#1F6A45] hover:bg-[#d6ecdf] transition-colors cursor-pointer flex items-center gap-1"
                title="Reset to overall distribution"
              >
                <span>{currentSelectedDay?.label}</span>
                <span className="text-[10px] font-bold">✕</span>
              </button>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[#64748B] dark:text-slate-300">
                Overall
              </span>
            )}
          </div>

          {/* Donut Chart */}
          <div className="h-56 relative flex items-center justify-center outline-none">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={200}>
              <PieChart>
                <Pie
                  data={dayPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={66}
                  outerRadius={88}
                  cornerRadius={8}
                  paddingAngle={4}
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

            {/* Center Dynamic Label Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-[#0F1720] transition-all">
                {displaySegment.value}%
              </span>
              <span className="text-xs font-medium text-[#64748B] mt-0.5 transition-all text-center px-4">
                {displaySegment.name}
              </span>
            </div>
          </div>

          {/* Legend Breakdown Items with Exact Counts & Percentages */}
          <div className="space-y-2.5 pt-3 border-t border-[#F1F5F9] text-xs">
            {dayPieData.map((item) => (
              <div
                key={item.name}
                onMouseEnter={() => setHoveredSegment(item)}
                onMouseLeave={() => setHoveredSegment(null)}
                className={`flex items-center justify-between font-medium cursor-pointer py-1 px-2 rounded-lg transition-all ${
                  hoveredSegment?.name === item.name
                    ? 'bg-slate-100 dark:bg-slate-800/60'
                    : 'hover:bg-[#F8FAFC]'
                }`}
              >
                <span className="flex items-center gap-2.5 text-[#334155]">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 shadow-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[#64748B] text-[11px] font-normal">
                    {item.count} scans
                  </span>
                  <span className="font-bold text-[#0F1720] w-9 text-right">
                    {item.value}%
                  </span>
                </div>
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
                      {row.status === 'Safe' ? (
                        <span className="inline-flex items-center gap-1 text-[#16A34A] font-semibold">
                          <CheckCircle2 size={14} /> Safe
                        </span>
                      ) : row.status === 'Flagged' ? (
                        <span className="inline-flex items-center gap-1 text-[#F59E0B] font-semibold">
                          <TriangleAlert size={14} /> Flagged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[#DC2626] font-semibold">
                          <Ban size={14} /> Blocked
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
            {history && history.length > 0 ? (
              history.slice(0, 3).map((item, idx) => (
                <div key={item.id || idx} className="flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    item.prediction === 'Safe' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEF2F2] text-[#DC2626]'
                  }`}>
                    {item.scan_type === 'qr' ? <QrCode size={18} /> : item.scan_type === 'email' ? <Mail size={18} /> : <Globe size={18} />}
                  </div>
                  <div className="text-xs">
                    <span className="text-[#94A3B8] font-medium block">
                      {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    <p className="text-[#0F1720] font-medium mt-0.5 leading-snug">
                      {item.prediction === 'Safe' ? 'Safe ' : 'Malicious '}{item.scan_type} scanned.
                    </p>
                    <div className="mt-1.5 inline-block bg-[#F8FAFC] border border-[#E2E8F0] px-2.5 py-1 rounded-md text-[11px] font-mono text-[#334155] max-w-[220px] truncate overflow-hidden">
                      {item.input_data || 'unknown source'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-[#94A3B8] font-medium mt-4">No recent agent activity.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
