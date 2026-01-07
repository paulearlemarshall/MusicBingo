
import React from 'react';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
    const navItems = [
        { id: 'media', label: 'Media Control', icon: '🎵' },
        { id: 'tickets', label: 'Ticket Management', icon: '🎫' },
        { id: 'game', label: 'Game Control', icon: '🎮' },
        { id: 'check', label: 'Ticket Check', icon: '✅' },
        { id: 'settings', label: 'Settings', icon: '⚙️' },
    ];

    return (
        <div className="w-64 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
            <div className="p-6 border-b border-slate-700">
                <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                    Music Bingo
                </h1>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === item.id
                            ? 'bg-purple-600/20 text-purple-300 ring-1 ring-purple-500/50'
                            : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
                            }`}
                    >
                        <span className="text-xl">{item.icon}</span>
                        <span className="font-medium">{item.label}</span>
                    </button>
                ))}
            </nav>
            <div className="p-4 border-t border-slate-700">
                <div className="text-xs text-slate-500 text-center">
                    v1.0.0
                </div>
            </div>
        </div>
    );
};
