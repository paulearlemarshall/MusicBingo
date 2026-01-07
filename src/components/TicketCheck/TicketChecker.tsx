import React, { useState } from 'react';
import { useGame } from '../../context/GameContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { BingoGameLogic } from '../../utils/BingoLogic';

export const TicketChecker: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { tickets, playedSongs } = useGame();
    const [ticketId, setTicketId] = useState('');

    const ticket = tickets.get(ticketId);

    const winStatuses = ticket ? BingoGameLogic.checkWins(ticket, playedSongs) : [];

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center index-50 p-4">
            <Card title="Ticket Checker" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Enter Sheet Number (e.g. 1)"
                            value={ticketId}
                            onChange={(e) => setTicketId(e.target.value)}
                            className="bg-slate-700 text-white px-4 py-2 rounded-lg flex-1 outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            inputMode="numeric"
                            pattern="[0-9]*"
                        />
                    </div>

                    {ticket ? (
                        <div className="bg-slate-800 p-4 rounded-xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-lg text-slate-300">Sheet #{ticket.id}</h3>
                                <div className="flex flex-wrap gap-2">
                                    {winStatuses.map(win => win && (
                                        <div key={win} className="bg-green-500 text-white px-3 py-1 rounded-full font-bold animate-pulse text-xs">
                                            WINNER: {win.replace('_', ' ')}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div 
                                className="grid gap-1 md:gap-2"
                                style={{ gridTemplateColumns: `repeat(${ticket.grid[0].length}, minmax(0, 1fr))` }}
                            >
                                {/* Header Row B I N G O - Only for 5x5 */}
                                {ticket.grid[0].length === 5 && ['B', 'I', 'N', 'G', 'O'].map(l => (
                                    <div key={l} className="text-center font-bold text-slate-500 pb-2">{l}</div>
                                ))}

                                {ticket.grid.flat().map((cell, idx) => {
                                    const isPlayed = playedSongs.has(cell.song.id);
                                    return (
                                        <div
                                            key={`${cell.song.id}-${idx}`}
                                            className={`
                                                aspect-square flex items-center justify-center p-1 text-xs text-center rounded
                                                ${isPlayed
                                                    ? 'bg-green-600 text-white shadow-lg scale-105 border-2 border-green-400'
                                                    : 'bg-slate-700 text-slate-400'}
                                                transition-all
                                            `}
                                        >
                                            <div className="overflow-hidden">
                                                <div className="font-bold truncate">{cell.song.artist}</div>
                                                <div className="truncate text-[10px] opacity-80">{cell.song.title}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        ticketId && (
                            <div className="text-center py-8 text-slate-500">
                                Sheet #{ticketId} not found in current game.
                            </div>
                        )
                    )}

                    <div className="flex justify-end pt-4 border-t border-slate-700">
                        <Button variant="secondary" onClick={onClose}>Close</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
