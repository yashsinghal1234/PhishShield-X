import React from 'react';
import { Bell } from 'lucide-react';

export default function UserControls() {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="relative flex items-center justify-center h-10 w-10 rounded-full bg-white border border-[#E5E9EB] text-[#475569] hover:bg-[#F8FAFC] shadow-sm transition-colors"
      >
        <Bell size={18} />
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#DC2626] ring-2 ring-white" />
      </button>

      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#1F6A45] to-[#34845B] text-white flex items-center justify-center font-bold text-xs shadow-sm border border-[#E5E9EB]">
        YS
      </div>
    </div>
  );
}
