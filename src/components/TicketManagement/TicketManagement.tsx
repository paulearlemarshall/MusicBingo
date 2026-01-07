import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { PDFGenerator } from '../../utils/PDFGenerator';
import { BingoGameLogic } from '../../utils/BingoLogic';

export const TicketManagement: React.FC = () => {
    const { 
        tickets, 
        generateTickets, 
        pdfConfig, 
        setPdfConfig, 
        songs, 
        gameCatalog,
        activeFolder, 
        loadTicketsFromBoards, 
        clearTickets,
        gridSize,
        setGridSize
    } = useGame();

    // Local state for settings form
    const [header, setHeader] = useState(pdfConfig.headerText);
    const [footer, setFooter] = useState(pdfConfig.footerText);
    const [logo, setLogo] = useState(pdfConfig.logoUrl || '');
    const [ticketCountToGen, setTicketCountToGen] = useState(30);
    const [showCatalogModal, setShowCatalogModal] = useState(false);

    const requiredSongs = gridSize * gridSize;
    const safeMax = BingoGameLogic.calculateSafeMax(songs.length, gridSize);

    const handleGridSizeChange = (newSize: number) => {
        if (gridSize === newSize) return;

        if (tickets.size > 0) {
            if (confirm("Changing the grid size will erase all existing tickets. Are you sure?")) {
                clearTickets(activeFolder);
                setGridSize(newSize);
            }
        } else {
            setGridSize(newSize);
        }
    };

    // Check for tickets.ini and boards.ini on mount or activeFolder change
    useEffect(() => {
        const checkFiles = async () => {
            if (activeFolder && songs.length > 0) {
                try {
                    // Load ticket config
                    // @ts-ignore
                    const config = await window.ipcRenderer.invoke('tickets:load', activeFolder);
                    if (config) {
                        setHeader(config.headerText || '');
                        setFooter(config.footerText || '');
                        setLogo(config.logoUrl || '');
                        if (config.gridSize) setGridSize(config.gridSize);
                        setPdfConfig({
                            headerText: config.headerText || '',
                            footerText: config.footerText || '',
                            logoUrl: config.logoUrl || undefined
                        });
                        console.log("[TicketManagement] Loaded tickets.ini configuration");
                    }

                    // Load boards
                    // @ts-ignore
                    const result = await window.ipcRenderer.invoke('boards:load', activeFolder);
                    if (result && result.boards && result.boards.length > 0) {
                        loadTicketsFromBoards(result.boards, result.catalog);
                        console.log(`[TicketManagement] Loaded ${result.boards.length} boards and ${result.catalog?.length || 0} catalog items`);
                    }
                } catch (e) {
                    console.error("[TicketManagement] Failed to load folder configuration", e);
                }
            }
        };
        checkFiles();
    }, [activeFolder, songs.length]);

    // Sync local state when context changes
    useEffect(() => {
        setHeader(pdfConfig.headerText);
        setFooter(pdfConfig.footerText);
        setLogo(pdfConfig.logoUrl || '');
    }, [pdfConfig]);


    const handleSaveSettings = async () => {
        setPdfConfig({
            headerText: header,
            footerText: footer,
            logoUrl: logo || undefined
        });

        if (activeFolder) {
            try {
                // @ts-ignore
                await window.ipcRenderer.invoke('tickets:save', {
                    folderPath: activeFolder,
                    config: {
                        headerText: header,
                        footerText: footer,
                        logoUrl: logo || ''
                    },
                    gridSize: gridSize
                });
                console.log("[TicketManagement] Saved tickets.ini");
                if (tickets.size > 0) {
                    const ticketsArray = Array.from(tickets.values());
                    // @ts-ignore
                    await window.ipcRenderer.invoke('boards:save', {
                        folderPath: activeFolder,
                        tickets: ticketsArray,
                        catalog: songs // Save current songs as the game catalog
                    });
                    console.log("[TicketManagement] Saved boards.ini with catalog");
                }
            } catch (e) {
                console.error("[TicketManagement] Failed to save tickets.ini", e);
            }
        }
    };

    const handleLogoSelect = async () => {
        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('dialog:openFile');
            if (result && result.length > 0) {
                setLogo(result[0]);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleGenerate = async () => {
        generateTickets(ticketCountToGen);
    };

    const handleExportPDF = () => {
        if (tickets.size === 0) return;
        PDFGenerator.generateTicketsPDF(Array.from(tickets.values()), pdfConfig);
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 h-full overflow-y-auto">
            <header className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">Ticket Management</h2>
                    <p className="text-slate-400 mt-1">Configure customized PDF tickets and manage game generations.</p>
                </div>
                <Button 
                    onClick={handleSaveSettings} 
                    variant="primary" 
                    className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                >
                    💾 Save PDF and Game Board Settings
                </Button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* PDF Settings - Now on the left */}
                <Card title="PDF Configuration">
                    <div className="space-y-5">
                        <div>
                            <label className="block text-slate-400 mb-2 text-sm">Header Text</label>
                            <input
                                type="text"
                                value={header}
                                onChange={e => setHeader(e.target.value)}
                                className="w-full bg-slate-700 text-white rounded p-3 border border-slate-600 focus:border-pink-500 outline-none transition-colors"
                                placeholder="e.g. Christmas Party Bingo"
                            />
                        </div>
                        <div>
                            <label className="block text-slate-400 mb-2 text-sm">Footer Text</label>
                            <input
                                type="text"
                                value={footer}
                                onChange={e => setFooter(e.target.value)}
                                className="w-full bg-slate-700 text-white rounded p-3 border border-slate-600 focus:border-pink-500 outline-none transition-colors"
                                placeholder="e.g. Good Luck!"
                            />
                        </div>

                        <div>
                            <label className="block text-slate-400 mb-2 text-sm">Custom Logo</label>
                            <div className="flex gap-4 items-start">
                                <Button variant="secondary" onClick={handleLogoSelect} size="sm">Choose Image...</Button>
                                {logo && (
                                    <div className="relative group">
                                        <div className="w-20 h-20 bg-white rounded flex items-center justify-center p-1 overflow-hidden">
                                            <img src={`media://local/${encodeURIComponent(logo.replace(/\\/g, '/'))}`} alt="Logo" className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <button
                                            onClick={() => setLogo('')}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            ×
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Generation & Export - Now on the right */}
                <div className="space-y-6">
                <Card title="Game Generation">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-400 mb-2 text-sm">Grid Size</label>
                                <div className="flex gap-2">
                                    {[3, 4, 5].map(size => (
                                        <Button
                                            key={size}
                                            variant={gridSize === size ? 'primary' : 'secondary'}
                                            onClick={() => handleGridSizeChange(size)}
                                            className="px-4 py-2"
                                        >
                                            {size}x{size}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 mb-2 text-sm">Number of Tickets</label>
                                <div className="flex items-center gap-4 flex-wrap">
                                    <input
                                        type="number"
                                        min="1"
                                        max={safeMax > 0 ? safeMax : 1000}
                                        value={ticketCountToGen}
                                        onChange={(e) => {
                                            let val = parseInt(e.target.value) || 0;
                                            if (safeMax > 0 && val > safeMax) {
                                                val = safeMax;
                                            }
                                            if (val < 1) val = 1;
                                            setTicketCountToGen(val)
                                        }}
                                        className="bg-slate-700 text-white rounded px-4 py-2 w-32 outline-none focus:ring-2 focus:ring-pink-500"
                                    />
                                    <div className="flex-1 min-w-[300px] px-4 py-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            For <span className="text-pink-400 font-bold">{songs.length}</span> songs, max <span className="text-pink-400 font-bold">{safeMax.toLocaleString()}</span> unique tickets can be produced for a <span className="text-pink-400 font-bold">{gridSize}x{gridSize}</span> grid ({requiredSongs} songs/ticket).
                                        </p>
                                    </div>
                                    <Button 
                                        onClick={handleGenerate} 
                                        variant="primary" 
                                        disabled={songs.length < requiredSongs || tickets.size > 0} 
                                        className="ml-auto"
                                    >
                                        Generate
                                    </Button>
                                </div>
                                {songs.length < requiredSongs && (
                                    <p className="text-sm text-amber-500 mt-2">Add at least {requiredSongs} songs to the library to generate tickets ({gridSize}x{gridSize} grid).</p>
                                )}
                                {ticketCountToGen > safeMax && safeMax > 0 && (
                                    <p className="text-[10px] text-amber-500 mt-2 bg-amber-500/10 p-2 rounded">⚠️ You are requesting more tickets <b>({ticketCountToGen})</b> than there are unique combinations <b>({safeMax})</b>. Some duplicates will be generated.</p>
                                )}
                            </div>

                            {tickets.size > 0 && (
                                <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-green-400 font-bold text-lg">
                                                {tickets.size} Tickets Ready 
                                                {gameCatalog.length > 0 && (
                                                    <span className="text-xs text-slate-400 font-normal ml-2 tracking-tight">
                                                        (built from {gameCatalog.length} songs)
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">Ready to play or export</div>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            {gameCatalog.length > 0 && (
                                                <Button variant="secondary" size="sm" onClick={() => setShowCatalogModal(true)}>View Game Songs</Button>
                                            )}
                                            <Button variant="danger" size="sm" onClick={() => {
                                                if (confirm("Are you sure you want to delete all generated tickets? This cannot be undone.")) {
                                                    clearTickets(activeFolder);
                                                }
                                            }}>Clear Tickets</Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                    <Card title="Export">
                        <div className="text-slate-400 mb-4">Export the generated tickets to a print-ready PDF file.</div>
                        <Button
                            className={`w-full py-4 text-lg transition-all ${tickets.size > 0 ? 'bg-gradient-to-r from-pink-600 to-rose-600 shadow-lg shadow-pink-500/10' : ''}`}
                            onClick={handleExportPDF}
                            disabled={tickets.size === 0}
                        >
                            {tickets.size > 0 ? 'Download PDF Ticket Booklet' : 'Generate Tickets to Download'}
                        </Button>
                    </Card>
                </div>
            </div>

            {showCatalogModal && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <Card className="w-full max-w-2xl shadow-2xl border-slate-700 flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-700 p-6">
                            <div>
                                <h3 className="text-xl font-bold text-white">View Game Songs</h3>
                                <p className="text-xs text-slate-500 mt-1">These {gameCatalog.length} songs are the only ones used in the current tickets.</p>
                            </div>
                            <button onClick={() => setShowCatalogModal(false)} className="text-slate-400 hover:text-white transition-colors">
                                <span className="text-2xl">×</span>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 pb-6 scrollbar-thin scrollbar-thumb-slate-700">
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="text-[10px] uppercase text-slate-500 sticky top-0 bg-slate-900 z-10">
                                    <tr>
                                        <th className="pb-3 pr-4">#</th>
                                        <th className="pb-3 pr-4">Artist</th>
                                        <th className="pb-3">Title</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {gameCatalog.map((song, idx) => (
                                        <tr key={song.id} className="group">
                                            <td className="py-2 text-[10px] font-mono text-slate-600">{idx + 1}</td>
                                            <td className="py-2 pr-4 font-bold text-slate-200 group-hover:text-pink-400 transition-colors">{song.artist}</td>
                                            <td className="py-2 italic text-slate-400">{song.title}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 border-t border-slate-700 bg-slate-900/50">
                            <Button variant="secondary" onClick={() => setShowCatalogModal(false)} className="w-full">
                                Close
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
