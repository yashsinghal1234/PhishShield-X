import React from 'react';
import { Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function UserControls() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center gap-2.5">
      {/* Theme Switcher Button */}
      <button
        type="button"
        onClick={toggleTheme}
        className="relative flex items-center justify-center h-10 w-10 rounded-full bg-white border border-[#E5E9EB] text-[#475569] hover:bg-[#F8FAFC] shadow-sm transition-colors cursor-pointer"
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? (
          <Sun size={18} className="text-amber-400 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon size={18} className="text-[#475569] transition-transform duration-300 hover:-rotate-12" />
        )}
      </button>

      {/* Notifications */}
      <button
        type="button"
        className="relative flex items-center justify-center h-10 w-10 rounded-full bg-white border border-[#E5E9EB] text-[#475569] hover:bg-[#F8FAFC] shadow-sm transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#DC2626] ring-2 ring-white" />
      </button>

      {/* Profile Avatar */}
      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#1F6A45] to-[#34845B] text-white flex items-center justify-center font-bold text-xs shadow-sm border border-[#E5E9EB]">
        YS
      </div>
    </div>
  );
}
