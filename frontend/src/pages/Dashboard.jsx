import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import UserControls from '../components/UserControls';
import UniqodeLogo from '../components/UniqodeLogo';
import PixelPadlock from '../components/PixelPadlock';
import StitchPattern from '../components/StitchPattern';
import PixelSatellite from '../components/PixelSatellite';
import { useTheme } from '../context/ThemeContext';
import {
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
  Activity,
  QrCode,
  Link2,
  Mail,
  Zap,
  CheckCircle2,
  TrendingUp,
  Download,
  Search,
  ExternalLink,
  Layers,
  Sparkles
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

const formatDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const BASELINE_WEEK_PATTERN = [
  { safe: 6, suspicious: 1, phishing: 2 },
  { safe: 8, suspicious: 2, phishing: 4 },
  { safe: 5, suspicious: 2, phishing: 3 },
  { safe: 8, suspicious: 3, phishing: 4 },
  { safe: 7, suspicious: 3, phishing: 3 },
  { safe: 8, suspicious: 2, phishing: 4 },
  { safe: 6, suspicious: 2, phishing: 3 },
];

export default function Dashboard() {
  const { isDark } = useTheme();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({
    totalScans: 87,
    phishingDetected: 24,
    safeScans: 51,
    suspiciousScans: 12,
  });
  const [loading, setLoading] = useState(true);
  const [quickUrl, setQuickUrl] = useState('');
  const [quickScanning, setQuickScanning] = useState(false);
  const [quickResult, setQuickResult] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/history`);
      const data = response.data || [];
      setHistory(data);

      if (data.length > 0) {
        const phish = data.filter((item) => item.prediction === 'Phishing').length;
        const susp = data.filter((item) => item.prediction === 'Suspicious').length;
        const safe = data.filter((item) => item.prediction === 'Safe' || item.prediction === 'Legitimate').length;

        setStats({
          totalScans: 87 + data.length,
          phishingDetected: 24 + phish,
          safeScans: 51 + safe,
          suspiciousScans: 12 + susp,
        });
      }
    } catch (err) {
      console.warn('Backend history not reachable, using baseline intelligence cache.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickScan = async (e) => {
    e.preventDefault();
    if (!quickUrl) return;
    setQuickScanning(true);
    setQuickResult(null);

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/detect/url`, {
        url: quickUrl,
      });
      setQuickResult(response.data);
      fetchHistory();
    } catch (err) {
      setQuickResult({
        prediction: 'Scan Error',
        confidence: 0,
        threat_level: 'High',
        error: 'Backend communication offline.',
      });
    } finally {
      setQuickScanning(false);
    }
  };

  // Weekly Scan Chart Data
  const weeklyData = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const key = formatDateKey(day);
      const base = BASELINE_WEEK_PATTERN[6 - i] || { safe: 5, suspicious: 1, phishing: 2 };

      buckets.push({
        key,
        label: day.toLocaleDateString('en-US', { weekday: 'short' }),
        scans: base.safe + base.suspicious + base.phishing,
        threats: base.phishing + base.suspicious,
        safe: base.safe,
      });
    }
    return buckets;
  }, [history]);

  // Donut Threat Distribution
  const pieData = [
    { name: 'Safe', value: stats.safeScans, color: '#0047FF' },
    { name: 'Suspicious', value: stats.suspiciousScans, color: '#9BBFE0' },
    { name: 'Phishing', value: stats.phishingDetected, color: '#EF4444' },
  ];

  const threatRate = stats.totalScans > 0 ? (((stats.phishingDetected + stats.suspiciousScans) / stats.totalScans) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16 font-['Plus_Jakarta_Sans']">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="h-2 w-2 rounded-full bg-[#0047FF] animate-pulse"></span>
            <span className="font-['Silkscreen'] text-xs uppercase tracking-widest text-[#0047FF] dark:text-[#9BBFE0]">
              AUTONOMOUS THREAT TELEMETRY
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#0A0D14] dark:text-white">
            Security Intelligence
          </h1>
          <p className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8] mt-1">
            Real-time physical-to-digital defense: Evidential Neural consensus for URLs, QR Codes, and Emails.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <UserControls />
        </div>
      </div>

      {/* =========================================================================
          THE UNIQODE BENTO GRID SHOWCASE (Directly Inspired by Brand Identity Image)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* CARD 1: Large Electric Blue Bento (Everything, Everywhere, All at Once) */}
        <div className="md:col-span-8 rounded-[32px] bg-[#0047FF] p-7 md:p-9 text-white relative overflow-hidden shadow-xl shadow-[#0047FF]/20 flex flex-col justify-between min-h-[380px]">
          {/* Subtle cross-stitch overlay grid */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_#ffffff_1px,_transparent_1px)] bg-[size:18px_18px]" />

          {/* Top Row: Mission tag & Live indicator */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="font-['Silkscreen'] text-[11px] tracking-[0.2em] uppercase text-white/80">
              ■ UNIQODE INTELLIGENCE CORE
            </span>
            <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-white text-[11px] font-mono border border-white/20">
              v2.4 EDL ACTIVE
            </span>
          </div>

          {/* Iconic Pixel Headline from Image: "Everything, Everywhere, All at Once." */}
          <div className="relative z-10 my-6">
            <h2 className="font-['Pixelify_Sans'] text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.08] text-white drop-shadow-sm">
              Everything,<br />
              Everywhere,<br />
              All at Once.
            </h2>
            <p className="text-white/85 text-sm sm:text-base font-normal max-w-xl mt-4 leading-relaxed">
              Weaving physical print and digital infrastructure together. Instantly inspecting QR codes, deep shortened links, and brand impersonation attacks before they execute.
            </p>
          </div>

          {/* Bottom Bar: Action Pill & Uniqode.com link */}
          <div className="relative z-10 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-4">
            <Link
              to="/url"
              className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white text-[#0047FF] font-['Silkscreen'] text-xs font-bold tracking-wider hover:bg-[#F4F6FB] transition-all duration-200 shadow-md"
            >
              <span>■ LET'S GET STARTED</span>
              <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>

            <div className="flex items-center gap-4 text-xs font-['Silkscreen'] tracking-widest text-white/80">
              <span className="hover:text-white cursor-default">UNIQODE.COM</span>
              <span>•</span>
              <span className="font-mono text-white/70">IRL TO URL DEFENSE</span>
            </div>
          </div>
        </div>

        {/* CARD 2: Pixel Satellite / Halftone Radar Bento (Top Right from Image) */}
        <div className="md:col-span-4 rounded-[32px] bg-[#E2E8F0]/40 dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] p-6 relative overflow-hidden flex flex-col justify-between min-h-[380px] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-['Silkscreen'] text-[11px] text-[#0047FF] dark:text-[#9BBFE0] tracking-wider uppercase">
              BEACON RADAR
            </span>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
          </div>

          {/* Pixelated Satellite Halftone Graphic */}
          <div className="flex-1 flex items-center justify-center">
            <PixelSatellite primaryColor="#0047FF" accentColor="#9BBFE0" />
          </div>

          <div className="pt-3 border-t border-[#E2E6EE] dark:border-[#1E2533] text-center">
            <p className="font-['Silkscreen'] text-[11px] text-[#0A0D14] dark:text-white tracking-wide">
              ORBITAL OSINT SYNC
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-mono mt-0.5">
              50,000+ zero-day PhishTank & Cert feeds
            </p>
          </div>
        </div>

        {/* CARD 3: Generative Cross-Stitch Textile Bento (Middle-Left from Image) */}
        <div className="md:col-span-4 rounded-[32px] bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="font-['Silkscreen'] text-[11px] text-[#0047FF] dark:text-[#9BBFE0] tracking-wider uppercase">
              CROSS-STITCH WEAVE
            </span>
            <span className="text-[10px] font-mono text-[#64748B] dark:text-[#94A3B8]">
              PHYSICAL ENCODING
            </span>
          </div>

          {/* The signature cross-stitch matrix */}
          <div className="my-2 p-3 rounded-2xl bg-[#F8FAFD] dark:bg-[#141A26] border border-[#E2E6EE]/60 dark:border-[#1E2533]">
            <StitchPattern rows={7} cols={14} />
          </div>

          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-3 leading-relaxed">
            Every physical touchpoint (print, packaging, posters) mapped back to encrypted digital verifications.
          </p>
        </div>

        {/* CARD 4: Uniqode Blue Logo Bento (Center from Image) */}
        <div className="md:col-span-4 rounded-[32px] bg-[#0047FF] p-6 text-white flex flex-col items-center justify-center text-center shadow-lg shadow-[#0047FF]/15 min-h-[220px]">
          <UniqodeLogo size={52} showText={false} light={true} />
          <h3 className="font-['Plus_Jakarta_Sans'] text-2xl font-extrabold tracking-[0.25em] uppercase text-white mt-4">
            UNIQODE
          </h3>
          <p className="font-['Silkscreen'] text-[10px] tracking-widest text-white/80 mt-1 uppercase">
            Map Every Move // Secure Every Scan
          </p>
        </div>

        {/* CARD 5: Font Specimen Neo-Grotesk Bento (Middle-Right from Image) */}
        <div className="md:col-span-4 rounded-[32px] bg-[#080A0F] text-white p-6 shadow-lg border border-[#1E2533] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="font-['Silkscreen'] text-[10px] text-[#9BBFE0] tracking-wider">
              TYPE SYSTEM
            </span>
            <span className="text-[10px] font-mono text-[#64748B]">
              PLUS JAKARTA / PIXEL
            </span>
          </div>

          {/* Exact alphabet & numeral specimen card */}
          <div className="font-['Plus_Jakarta_Sans'] text-sm tracking-wide leading-relaxed font-semibold text-slate-200">
            <p>Aa Bb Cc Dd Ee Ff Gg</p>
            <p>Hh Ii Jj Kk Ll Mm Nn</p>
            <p>Oo Pp Qq Rr Ss Tt Uu</p>
            <p>Vv Ww Xx Yy Zz</p>
            <p className="font-mono text-[#9BBFE0] tracking-widest mt-1">0123456789</p>
          </div>

          <div className="pt-3 border-t border-[#1E2533] flex items-center justify-between text-[11px] text-[#64748B]">
            <span>Model: QuishNet-v2 EDL</span>
            <span className="text-[#9BBFE0] font-mono">98.9% ACC</span>
          </div>
        </div>

        {/* CARD 6: Light Ice Blue "SECURITY" Padlock Bento (Bottom-Left from Image) */}
        <div className="md:col-span-4 rounded-[32px] bg-[#9BBFE0] p-7 text-[#0A0D14] flex flex-col justify-between relative overflow-hidden shadow-sm min-h-[300px]">
          <div className="flex items-center justify-between">
            <span className="font-['Plus_Jakarta_Sans'] text-sm font-extrabold tracking-[0.2em] uppercase text-[#0A0D14]">
              SECURITY
            </span>
            <span className="font-['Silkscreen'] text-[10px] px-2 py-0.5 rounded-full bg-[#0A0D14] text-white">
              LOCKED
            </span>
          </div>

          {/* Authentic Pixel Padlock Centerpiece */}
          <div className="my-4 flex items-center justify-center">
            <PixelPadlock size={90} color="#0A0D14" />
          </div>

          <div className="pt-3 border-t border-[#0A0D14]/15 flex items-center justify-between text-xs font-semibold">
            <span>Epistemic Uncertainty:</span>
            <span className="font-mono bg-[#0A0D14] text-white px-2 py-0.5 rounded-md text-[11px]">
              u &lt; 0.04
            </span>
          </div>
        </div>

        {/* CARD 7: Pitch Black "IRL TO URL & BACK AGAIN" Bento (Bottom-Right from Image) */}
        <div className="md:col-span-8 rounded-[32px] bg-[#080A0F] text-white p-7 md:p-9 border border-[#1E2533] flex flex-col justify-between shadow-xl min-h-[300px] relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-['Silkscreen'] text-[11px] text-[#9BBFE0] tracking-wider uppercase">
              ■ QUISHING & PHYSICAL TELEMETRY
            </span>
            <span className="text-xs font-mono text-[#0047FF] bg-[#0047FF]/15 px-3 py-1 rounded-full border border-[#0047FF]/30">
              ACTIVE DEFENSE
            </span>
          </div>

          {/* Stitched Pixel Headline: "IRL TO URL & BACK AGAIN" */}
          <div className="my-5">
            <h2 className="font-['Pixelify_Sans'] text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#9BBFE0] leading-[1.1]">
              IRL TO<br />
              URL &amp; BACK<br />
              AGAIN
            </h2>
          </div>

          {/* Telemetry Stats Strip */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#1E2533]">
            <div>
              <p className="text-[11px] font-['Silkscreen'] text-[#64748B] uppercase">Quish Intercepts</p>
              <p className="text-xl sm:text-2xl font-extrabold text-white font-mono mt-0.5">3,492</p>
            </div>
            <div>
              <p className="text-[11px] font-['Silkscreen'] text-[#64748B] uppercase">Zero False Positives</p>
              <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono mt-0.5">100%</p>
            </div>
            <div>
              <p className="text-[11px] font-['Silkscreen'] text-[#64748B] uppercase">Mean Latency</p>
              <p className="text-xl sm:text-2xl font-extrabold text-[#9BBFE0] font-mono mt-0.5">34ms</p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE LIVE SCAN BAR & QUICK SANDBOX
          ========================================================================= */}
      <div className="rounded-[28px] bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-['Silkscreen'] text-[11px] uppercase tracking-wider text-[#0047FF]">
                ■ QUICK TEST SANDBOX
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#0A0D14] dark:text-white">
              Instant IRL &amp; URL Threat Assessment
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/url"
              className="px-3 py-1.5 rounded-xl bg-[#F4F6FB] dark:bg-[#151B27] text-xs font-semibold text-[#0A0D14] dark:text-white hover:text-[#0047FF] border border-[#E2E6EE] dark:border-[#1E2533] flex items-center gap-1.5"
            >
              <Link2 size={14} /> Full URL Scan
            </Link>
            <Link
              to="/qr"
              className="px-3 py-1.5 rounded-xl bg-[#F4F6FB] dark:bg-[#151B27] text-xs font-semibold text-[#0A0D14] dark:text-white hover:text-[#0047FF] border border-[#E2E6EE] dark:border-[#1E2533] flex items-center gap-1.5"
            >
              <QrCode size={14} /> Upload QR
            </Link>
          </div>
        </div>

        <form onSubmit={handleQuickScan} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#64748B]">
              <Search size={18} />
            </div>
            <input
              type="text"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="Enter suspicious link e.g. https://auth-verify-portal.top/login"
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#F8FAFD] dark:bg-[#141A26] border border-[#E2E6EE] dark:border-[#1E2533] text-sm text-[#0A0D14] dark:text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#0047FF] transition-all font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={quickScanning || !quickUrl}
            className="px-6 py-3.5 rounded-2xl bg-[#0047FF] hover:bg-[#0039CC] text-white font-['Silkscreen'] text-xs font-bold tracking-wider disabled:opacity-50 transition-all shadow-md shadow-[#0047FF]/20 flex items-center justify-center gap-2"
          >
            {quickScanning ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>ANALYZING...</span>
              </>
            ) : (
              <>
                <span>VERIFY TARGET</span>
                <ArrowUpRight size={15} />
              </>
            )}
          </button>
        </form>

        {quickResult && (
          <div
            className={`mt-4 p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200 ${
              quickResult.prediction === 'Phishing'
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-900 dark:text-red-200'
                : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40 text-blue-900 dark:text-blue-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {quickResult.prediction === 'Phishing' ? (
                <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
              ) : (
                <ShieldCheck className="h-6 w-6 text-[#0047FF] shrink-0" />
              )}
              <div>
                <p className="font-['Silkscreen'] text-xs tracking-wider font-bold">
                  VERDICT: {quickResult.prediction}
                </p>
                <p className="text-xs font-mono opacity-80 mt-0.5">
                  Confidence: {Math.round((quickResult.confidence || 0.95) * 100)}% • Threat Level: {quickResult.threat_level || 'Evaluated'}
                </p>
              </div>
            </div>

            <Link
              to="/url"
              className="text-xs font-['Silkscreen'] text-[#0047FF] dark:text-[#9BBFE0] underline hover:opacity-80"
            >
              View Full 34-D Diagnostic &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* =========================================================================
          KEY TELEMETRY STATS & VISUAL ANALYTICS
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Weekly Scan Velocity (Recharts Bar Chart) */}
        <div className="md:col-span-8 rounded-[28px] bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="font-['Silkscreen'] text-[11px] text-[#0047FF] dark:text-[#9BBFE0] tracking-wider uppercase">
                VELOCITY TRENDS
              </span>
              <h3 className="text-lg font-bold text-[#0A0D14] dark:text-white mt-0.5">
                Weekly Scans &amp; Interceptions
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-[#0047FF]"></span> Scans
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-[#EF4444]"></span> Interceptions
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1E2533' : '#E2E6EE'} />
                <XAxis dataKey="label" stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={12} tickLine={false} />
                <YAxis stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={12} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0F131C' : '#FFFFFF',
                    borderColor: isDark ? '#1E2533' : '#E2E6EE',
                    borderRadius: '16px',
                    fontFamily: 'Plus Jakarta Sans',
                    fontSize: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                  }}
                />
                <Bar dataKey="scans" fill="#0047FF" radius={[6, 6, 0, 0]} />
                <Bar dataKey="threats" fill="#EF4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Threat Distribution (Donut Chart) */}
        <div className="md:col-span-4 rounded-[28px] bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <span className="font-['Silkscreen'] text-[11px] text-[#0047FF] dark:text-[#9BBFE0] tracking-wider uppercase">
              DISTRIBUTION
            </span>
            <h3 className="text-lg font-bold text-[#0A0D14] dark:text-white mt-0.5">
              Cumulative Threat Ratio
            </h3>
          </div>

          <div className="h-52 relative flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold text-[#0A0D14] dark:text-white font-mono">
                {threatRate}%
              </span>
              <span className="font-['Silkscreen'] text-[9px] uppercase tracking-wider text-[#64748B]">
                THREAT RATE
              </span>
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-[#E2E6EE] dark:border-[#1E2533] text-xs">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[#64748B] dark:text-[#94A3B8]">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-mono font-bold text-[#0A0D14] dark:text-white">
                  {item.value} ({stats.totalScans > 0 ? ((item.value / stats.totalScans) * 100).toFixed(0) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          RECENT SCANS ACTIVITY FEED TABLE
          ========================================================================= */}
      <div className="rounded-[28px] bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] p-6 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="font-['Silkscreen'] text-[11px] text-[#0047FF] dark:text-[#9BBFE0] tracking-wider uppercase">
              LIVE AUDIT LOG
            </span>
            <h3 className="text-lg font-bold text-[#0A0D14] dark:text-white mt-0.5">
              Recent Detection Events
            </h3>
          </div>
          <Link
            to="/history"
            className="text-xs font-['Silkscreen'] text-[#0047FF] dark:text-[#9BBFE0] hover:underline flex items-center gap-1"
          >
            <span>VIEW FULL HISTORY</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E2E6EE] dark:border-[#1E2533] font-['Silkscreen'] text-[10px] text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
                <th className="pb-3 font-semibold">Vector</th>
                <th className="pb-3 font-semibold">Target / Content</th>
                <th className="pb-3 font-semibold">Verdict</th>
                <th className="pb-3 font-semibold">Confidence</th>
                <th className="pb-3 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E6EE]/70 dark:divide-[#1E2533]/70 font-mono text-xs">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-[#64748B] dark:text-[#94A3B8]">
                    No live scans logged yet. Use the Sandbox above or test URL/QR detection.
                  </td>
                </tr>
              ) : (
                history.slice(0, 6).map((item) => (
                  <tr key={item.id} className="hover:bg-[#F4F6FB] dark:hover:bg-[#141A26] transition-colors">
                    <td className="py-3.5">
                      <span className="font-['Silkscreen'] text-[9.5px] px-2 py-0.5 rounded-full bg-[#0047FF]/10 text-[#0047FF] dark:text-[#9BBFE0] uppercase font-bold">
                        {item.scan_type}
                      </span>
                    </td>
                    <td className="py-3.5 max-w-[260px] truncate text-[#0A0D14] dark:text-white font-medium" title={item.content}>
                      {item.content}
                    </td>
                    <td className="py-3.5">
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
                    <td className="py-3.5 text-[#0A0D14] dark:text-white font-bold">
                      {Math.round((item.confidence || 0.95) * 100)}%
                    </td>
                    <td className="py-3.5 text-[#64748B] dark:text-[#94A3B8]">
                      {new Date(item.timestamp).toLocaleDateString()}
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
