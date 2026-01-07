import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { MediaControl } from '../MediaControl/MediaControl';
import { TicketManagement } from '../TicketManagement/TicketManagement';
import { GameControl } from '../GameControl/GameControl';
import { TicketCheck } from '../TicketCheck/TicketCheck';

import { SettingsView } from './SettingsView';

export const MainLayout: React.FC = () => {
    const [activeTab, setActiveTab] = useState('media');

    return (
        <div className="flex h-screen bg-slate-900 text-white overflow-hidden">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

            <main className="flex-1 overflow-auto bg-slate-900 relative">
                <div className={`h-full w-full absolute inset-0 transition-opacity duration-300 ${activeTab === 'media' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <MediaControl />
                </div>
                <div className={`h-full w-full absolute inset-0 transition-opacity duration-300 ${activeTab === 'tickets' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <TicketManagement />
                </div>
                <div className={`h-full w-full absolute inset-0 transition-opacity duration-300 ${activeTab === 'game' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <GameControl />
                </div>
                <div className={`h-full w-full absolute inset-0 transition-opacity duration-300 ${activeTab === 'check' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <TicketCheck activeTab={activeTab} />
                </div>
                <div className={`h-full w-full absolute inset-0 transition-opacity duration-300 ${activeTab === 'settings' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                    <SettingsView />
                </div>
            </main>
        </div>
    );
};
