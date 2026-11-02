import React from 'react';
import { Bell, Sun, Moon, Shield, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function UserControls() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-2.5 font-['Plus_Jakarta_Sans']">
      {/* Live System Guard Status Pill */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] shadow-sm text-xs font-semibold">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0047FF] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0047FF]"></span>
        </span>
        <span className="text-[#0A0D14] dark:text-white font-['Silkscreen'] text-[10px] tracking-wider">
          LIVE SHIELD
        </span>
      </div>

      {/* Theme Switcher Button */}
      <button
        type="button"
        onClick={toggleTheme}
        className="relative flex items-center justify-center h-10 w-10 rounded-full bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] text-[#0A0D14] dark:text-white hover:border-[#0047FF] hover:text-[#0047FF] shadow-sm transition-all duration-200 cursor-pointer"
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun size={17} className="text-amber-400 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon size={17} className="text-[#0A0D14] transition-transform duration-300 hover:-rotate-12" />
        )}
      </button>

      {/* Notifications */}
      <button
        type="button"
        className="relative flex items-center justify-center h-10 w-10 rounded-full bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] text-[#0A0D14] dark:text-white hover:border-[#0047FF] hover:text-[#0047FF] shadow-sm transition-all duration-200 cursor-pointer"
        title="Security Notifications"
      >
        <Bell size={17} />
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#0047FF] ring-2 ring-white dark:ring-[#0F131C]" />
      </button>

      {/* Uniqode Verified Badge Profile */}
      <div className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white dark:bg-[#0F131C] border border-[#E2E6EE] dark:border-[#1E2533] shadow-sm">
        <div className="h-7 w-7 rounded-full bg-[#0047FF] text-white flex items-center justify-center font-extrabold text-[11px] shadow-inner font-['Silkscreen']">
          UQ
        </div>
        <div className="hidden md:flex flex-col text-left">
          <span className="text-[11px] font-bold text-[#0A0D14] dark:text-white leading-tight">
            SecOps
          </span>
          <span className="text-[9px] font-mono text-[#0047FF] dark:text-[#9BBFE0] leading-none">
            EDL v2.4
          </span>
        </div>
      </div>
    </div>
  );
}
