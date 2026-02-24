import React from 'react';
import { Command } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-[#050505] text-white p-4 flex items-center justify-between border-b border-white/10">
      <div className="flex items-center space-x-3">
        <div className="bg-white/5 p-2 rounded-lg border border-white/10">
          <Command className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">JUXA</span>
          </h1>
        </div>
      </div>
      <div className="flex items-center space-x-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-xs font-bold shadow-lg shadow-blue-900/20">
            AD
          </div>
      </div>
    </header>
  );
};