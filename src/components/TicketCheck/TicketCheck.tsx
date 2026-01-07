
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Howl } from 'howler';
import { useGame } from '../../context/GameContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { BingoGameLogic } from '../../utils/BingoLogic';

interface TicketCheckProps {
    activeTab?: string;
}

export const TicketCheck: React.FC<TicketCheckProps> = ({ activeTab }) => {
    const { 
        tickets, playedSongs, loadTicketsFromBoards, 
        activeFolder, songs, effects,
        activeEffect, setActiveEffect 
    } = useGame();
    const [ticketId, setTicketId] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const effectRef = useRef<Howl | null>(null);

    // Keep focus on the input field
    useEffect(() => {
        if (activeTab === 'check' || !activeTab) {
            // Use a small timeout to ensure the tab transition doesn't interfere with focus
            const timer = setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    // Select text so user can just start typing a new number
                    inputRef.current.select();
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [activeTab, tickets.size]);

    const playEffect = useCallback((type: keyof typeof effects) => {
        const path = effects[type];
        if (!path) return;
        
        if (effectRef.current) {
            effectRef.current.unload();
        }

        setActiveEffect(type);

        const effect = new Howl({ 
            src: [`media://local/${encodeURIComponent(path.replace(/\\/g, '/'))}`], 
            html5: true, 
            volume: 0.8,
            onend: () => setActiveEffect(null),
            onstop: () => setActiveEffect(null),
            onloaderror: () => setActiveEffect(null),
            onplayerror: () => setActiveEffect(null)
        });

        effectRef.current = effect;
        effect.play();
        return effect;
    }, [effects, setActiveEffect]);

    const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Only allow numbers
        const val = e.target.value.replace(/\D/g, '');
        setTicketId(val);
    };

    const handleLoadBoards = async () => {
        if (!activeFolder) return;
        try {
            // @ts-ignore
            const boards = await window.ipcRenderer.invoke('boards:load', activeFolder);
            if (boards && boards.length > 0) {
                loadTicketsFromBoards(boards);
            }
        } catch (e) {
            console.error("Failed to load boards", e);
        }
    };

    const ticket = tickets.get(ticketId);
    const activeWins = ticket ? BingoGameLogic.checkWins(ticket, playedSongs) : [];

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6 h-full overflow-y-auto" onClick={() => inputRef.current?.focus()}>
            <header>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Ticket Check</h2>
                <p className="text-slate-400 mt-1">Validate winning tickets.</p>
            </header>

            <div className="max-w-xl mx-auto">
                {tickets.size === 0 ? (
                    <div className="text-center py-20 bg-slate-800/30 rounded-3xl border-2 border-slate-700 border-dashed">
                        <div className="text-6xl mb-6 opacity-20">🎟️</div>
                        <h3 className="text-xl font-bold text-slate-300 mb-2">No tickets loaded</h3>
                        <p className="text-slate-500 mb-8 max-w-xs mx-auto">Generate tickets or load existing boards from your current music folder.</p>
                        <Button 
                            onClick={handleLoadBoards} 
                            disabled={!activeFolder || songs.length === 0}
                            variant="primary"
                            className="bg-emerald-600 hover:bg-emerald-500 px-8"
                        >
                            Load Boards from Folder
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="mb-8">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Enter Ticket # (e.g. 1)"
                                value={ticketId}
                                onChange={handleIdChange}
                                className="w-full text-center text-4xl font-bold bg-slate-800 text-white px-6 py-6 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/50 border-2 border-slate-700 placeholder:text-slate-600 transition-all font-mono shadow-xl"
                                autoFocus
                            />
                        </div>

                                        {ticket ? (
                                            <div className="space-y-4">
                                                                        {/* Win Status Horizontal Bar */}
                                                                        <div className="bg-slate-800/50 rounded-2xl p-2 border border-slate-700/50 flex flex-nowrap items-center justify-around gap-2 shadow-lg overflow-x-auto scrollbar-none">
                                                                            {[
                                                                                { id: '1_LINE', label: '1 Line' },
                                                                                { id: '2_LINES', label: '2 Lines' },
                                                                                { id: 'FOUR_CORNERS', label: '4 Corners' },
                                                                                { id: 'FULL_HOUSE', label: 'Full House' }
                                                                            ].map(condition => {
                                                                                const isMet = activeWins.includes(condition.id as any);
                                                                                return (
                                                                                    <div key={condition.id} className="flex items-center gap-2 px-2 py-1 rounded-full transition-all shrink-0">
                                                                                        <span className={`text-[10px] font-black uppercase tracking-tight ${isMet ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                                                            {condition.label}
                                                                                        </span>
                                                                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                                                            isMet 
                                                                                                ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                                                                                                : 'bg-slate-900 border-slate-700'
                                                                                        }`}>
                                                                                            {isMet && <span className="text-white text-[8px] font-black">✓</span>}
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>                        
                                                <Card className="border-emerald-500/30 overflow-hidden relative">
                                                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                                                    <div className="flex justify-between items-center mb-6">
                                                        <h3 className="font-bold text-2xl text-white">Ticket #{ticket.id}</h3>
                                                    </div>                                <div 
                                    className="grid gap-2 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50"
                                    style={{ gridTemplateColumns: `repeat(${ticket.grid[0].length}, minmax(0, 1fr))` }}
                                >
                                    {/* Header Row B I N G O - Only for 5x5 */}
                                    {ticket.grid[0].length === 5 && ['B', 'I', 'N', 'G', 'O'].map(l => (
                                        <div key={l} className="text-center font-black text-slate-600 text-xl py-2">{l}</div>
                                    ))}

                                    {/* Grid */}
                                    {ticket.grid.flat().map((cell, idx) => {
                                        const isPlayed = playedSongs.has(cell.song.id);
                                        return (
                                            <div
                                                key={`${cell.song.id}-${idx}`}
                                                className={`
                                                    aspect-square flex flex-col items-center justify-center p-1 text-center rounded-lg transition-all duration-300 relative overflow-hidden group
                                                    ${isPlayed
                                                        ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg scale-100 ring-2 ring-emerald-400/50 z-10'
                                                        : 'bg-slate-800 text-slate-500 hover:bg-slate-750'}
                                                `}
                                            >
                                                {isPlayed && (
                                                    <div className="absolute inset-0 bg-white/10 animate-pulse-slow pointer-events-none"></div>
                                                )}

                                                <div className="relative z-10 w-full px-1">
                                                    <div className={`font-bold truncate text-[10px] sm:text-xs leading-tight mb-0.5 ${isPlayed ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                                                        {cell.song.artist}
                                                    </div>
                                                    <div className={`truncate text-[9px] sm:text-[10px] ${isPlayed ? 'text-emerald-100' : 'text-slate-600 group-hover:text-slate-500'}`}>
                                                        {cell.song.title}
                                                    </div>
                                                </div>

                                                {/* Checkmark overlay for played songs */}
                                                {isPlayed && (
                                                    <div className="absolute -bottom-2 -right-2 text-emerald-950/20 text-4xl leading-none">✓</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        </div>
                        ) : (
                            ticketId && (
                                <div className="text-center py-12 bg-slate-800/50 rounded-2xl border border-slate-700 border-dashed">
                                    <div className="text-4xl mb-2 opacity-30">🔍</div>
                                    <div className="text-slate-500 font-medium">Ticket #{ticketId} not found in current game session.</div>
                                </div>
                            )
                        )}
                    </>
                )}

                {tickets.size > 0 && (
                    <div className="flex gap-4 pt-8 border-t border-slate-700/50 mt-8">
                        <Button
                            variant="secondary"
                            onClick={() => playEffect('suspense')}
                            disabled={!effects.suspense}
                            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all duration-300 ${
                                activeEffect === 'suspense' 
                                ? 'border-slate-400 bg-slate-500/20 shadow-[0_0_15px_rgba(148,163,184,0.5)] ring-2 ring-slate-400' 
                                : 'hover:bg-slate-500/10 border-slate-500/30'
                            }`}
                        >
                            <span className="text-xl">⏳</span>
                            <span className="text-xs uppercase font-bold">Suspense SFX</span>
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={() => playEffect('win')}
                            disabled={!effects.win}
                            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all duration-300 ${
                                activeEffect === 'win' 
                                ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.5)] ring-2 ring-amber-400' 
                                : 'hover:bg-amber-500/10 border-amber-500/30'
                            }`}
                        >
                            <span className="text-xl">🏆</span>
                            <span className="text-xs uppercase font-bold">Win SFX</span>
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={() => playEffect('lose')}
                            disabled={!effects.lose}
                            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all duration-300 ${
                                activeEffect === 'lose' 
                                ? 'border-rose-400 bg-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.5)] ring-2 ring-rose-400' 
                                : 'hover:bg-rose-500/10 border-rose-500/30'
                            }`}
                        >
                            <span className="text-xl">❌</span>
                            <span className="text-xs uppercase font-bold">Lose SFX</span>
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={() => playEffect('airhorn')}
                            disabled={!effects.airhorn}
                            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-all duration-300 ${
                                activeEffect === 'airhorn' 
                                ? 'border-blue-400 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.5)] ring-2 ring-blue-400' 
                                : 'hover:bg-blue-500/10 border-blue-500/30'
                            }`}
                        >
                            <span className="text-xl">📢</span>
                            <span className="text-xs uppercase font-bold">Air Horn SFX</span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
