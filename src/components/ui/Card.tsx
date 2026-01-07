import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
    return (
        <div className={`bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl ${className}`}>
            {title && (
                <h3 className="text-xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
};
