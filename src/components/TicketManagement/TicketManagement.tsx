import React, { useState, useEffect, useMemo } from 'react';
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
        selectedSongIds,
        activeFolder,
        loadTicketsFromBoards,
        clearTickets,
        gridSize,
        setGridSize,
        // Preset management
        activePreset,
        availablePresets,
        loadPresets,
        loadPreset,
        savePreset,
        deletePreset,
        setActivePreset
    } = useGame();

    // Local state for settings form
    const [header, setHeader] = useState(pdfConfig.headerText);
    const [footer, setFooter] = useState(pdfConfig.footerText);
    const [logo, setLogo] = useState(pdfConfig.logoUrl || '');
    const [ticketCountToGen, setTicketCountToGen] = useState(30);
    const [showCatalogModal, setShowCatalogModal] = useState(false);

    // Preset management state
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [presetNameInput, setPresetNameInput] = useState('');

    const requiredSongs = gridSize * gridSize;

    // Only count selected song IDs that actually exist in current library
    const validSelectedSongIds = useMemo(() => {
        const songIds = new Set(songs.map(s => s.id));
        return Array.from(selectedSongIds).filter(id => songIds.has(id));
    }, [selectedSongIds, songs]);

    const songsForGeneration = validSelectedSongIds.length > 0 ? validSelectedSongIds.length : songs.length;
    const safeMax = BingoGameLogic.calculateSafeMax(songsForGeneration, gridSize);

    // Validation for saving presets
    const canSavePreset = tickets.size > 0 && header.trim() !== '' && footer.trim() !== '';

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


    const handleLogoSelect = async () => {
        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('dialog:openImage');
            if (result) {
                setLogo(result);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleGenerate = async () => {
        generateTickets(ticketCountToGen);
    };

    const handleExportPDF = async () => {
        if (tickets.size === 0) return;

        // Convert logo file path to data URL if it exists
        let logoDataUrl = pdfConfig.logoUrl;
        if (pdfConfig.logoUrl && !pdfConfig.logoUrl.startsWith('data:')) {
            try {
                // @ts-ignore
                logoDataUrl = await window.ipcRenderer.invoke('file:readImageAsDataUrl', pdfConfig.logoUrl);
                if (!logoDataUrl) {
                    console.warn('Failed to convert logo to data URL, generating PDF without logo');
                    logoDataUrl = undefined;
                }
            } catch (e) {
                console.error('Error converting logo to data URL:', e);
                logoDataUrl = undefined;
            }
        }

        // Generate PDF with data URL logo
        PDFGenerator.generateTicketsPDF(Array.from(tickets.values()), {
            ...pdfConfig,
            logoUrl: logoDataUrl
        });
    };

    // Load presets when folder changes
    useEffect(() => {
        if (activeFolder) {
            loadPresets(activeFolder);
        }
    }, [activeFolder, loadPresets]);

    // Preset handlers
    const handlePresetChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const presetName = e.target.value;
        if (!presetName) {
            setActivePreset(null);
            return;
        }

        if (tickets.size > 0) {
            if (confirm(`Switching to preset "${presetName}" will clear current tickets. Continue?`)) {
                await loadPreset(presetName);
            }
        } else {
            await loadPreset(presetName);
        }
    };

    const handleSavePresetClick = () => {
        // Validate before proceeding
        if (!canSavePreset) {
            const issues = [];
            if (tickets.size === 0) issues.push("- Generate tickets");
            if (header.trim() === '') issues.push("- Enter header text");
            if (footer.trim() === '') issues.push("- Enter footer text");
            alert(`Cannot save preset. Please:\n${issues.join('\n')}`);
            return;
        }

        if (activePreset) {
            // Update existing preset
            if (confirm(`Update preset "${activePreset}"?`)) {
                handleSavePresetConfirm(activePreset);
            }
        } else {
            // Save as new - show modal
            setPresetNameInput('');
            setShowSaveModal(true);
        }
    };

    const handleSavePresetConfirm = async (name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            alert("Please enter a preset name");
            return;
        }

        // Check if preset already exists (for save-as)
        if (!activePreset && availablePresets.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
            if (!confirm(`Preset "${trimmedName}" already exists. Overwrite?`)) {
                return;
            }
        }

        // Create updated config with current local state
        const updatedConfig = {
            headerText: header,
            footerText: footer,
            logoUrl: logo || undefined
        };

        // Update context state for consistency
        setPdfConfig(updatedConfig);

        // Save with the updated config directly (don't rely on state update timing)
        const success = await savePreset(trimmedName, updatedConfig);
        if (success) {
            setShowSaveModal(false);
            alert(`Preset "${trimmedName}" saved successfully!`);
        } else {
            alert("Failed to save preset");
        }
    };

    const handleDeletePreset = async () => {
        if (!activePreset) return;

        if (confirm(`Delete preset "${activePreset}"? This cannot be undone.`)) {
            const success = await deletePreset(activePreset);
            if (success) {
                alert(`Preset "${activePreset}" deleted`);
            } else {
                alert("Failed to delete preset");
            }
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-6 h-full overflow-y-auto">
            <header>
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent">Ticket Management</h2>
                    <p className="text-slate-400 mt-1">Configure customized PDF tickets and manage game generations.</p>
                </div>
            </header>

            {/* Preset Management Section */}
            <Card title="🎯 Preset Management">
                <div className="space-y-4">
                    <div className="flex gap-4 items-start">
                        <div className="flex-1">
                            <label className="block text-slate-400 mb-2 text-sm">Select Preset</label>
                            <select
                                value={activePreset || ''}
                                onChange={handlePresetChange}
                                className="w-full bg-slate-700 text-white rounded p-3 border border-slate-600 focus:border-emerald-500 outline-none transition-colors"
                            >
                                <option value="">-- New Preset --</option>
                                {availablePresets.map(preset => (
                                    <option key={preset.encodedName} value={preset.name}>
                                        {preset.name} {preset.hasBoards ? `(saved)` : '(incomplete)'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2 pt-7">
                            <Button
                                onClick={handleSavePresetClick}
                                variant="primary"
                                className="bg-emerald-600 hover:bg-emerald-500"
                                disabled={!canSavePreset}
                            >
                                {activePreset ? '💾 Update' : '💾 Save As...'}
                            </Button>
                            {activePreset && (
                                <Button
                                    onClick={handleDeletePreset}
                                    variant="danger"
                                >
                                    🗑️ Delete
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Preset Info Display */}
                    {activePreset && (
                        <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="text-sm space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400">Preset:</span>
                                    <span className="text-emerald-400 font-semibold">{activePreset}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400">Selected Songs:</span>
                                    <span className="text-white">{validSelectedSongIds.length} of {songs.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400">Grid Size:</span>
                                    <span className="text-white">{gridSize}x{gridSize}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-400">Tickets:</span>
                                    <span className="text-white">{tickets.size}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Validation messages */}
                    {!canSavePreset && (
                        <div className="text-sm text-amber-400 p-3 bg-amber-500/10 rounded border border-amber-500/30">
                            ⚠️ To save a preset, you must:
                            <ul className="ml-6 mt-2 list-disc space-y-1">
                                {tickets.size === 0 && <li>Generate tickets (currently {tickets.size} tickets)</li>}
                                {header.trim() === '' && <li>Enter a header text</li>}
                                {footer.trim() === '' && <li>Enter a footer text</li>}
                            </ul>
                        </div>
                    )}

                    {!activePreset && validSelectedSongIds.length === 0 && canSavePreset && (
                        <div className="text-sm text-slate-400 p-3 bg-slate-800/30 rounded">
                            💡 Tip: Select songs in Media Control, generate tickets, then save as a preset.
                        </div>
                    )}
                </div>
            </Card>

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
                                            For <span className="text-pink-400 font-bold">{songsForGeneration}</span> {validSelectedSongIds.length > 0 ? 'songs selected' : 'songs'} (from {songs.length} in library), max <span className="text-pink-400 font-bold">{safeMax.toLocaleString()}</span> unique tickets can be produced for a <span className="text-pink-400 font-bold">{gridSize}x{gridSize}</span> grid ({requiredSongs} songs/ticket).
                                        </p>
                                    </div>
                                    <Button
                                        onClick={handleGenerate}
                                        variant="primary"
                                        disabled={songsForGeneration < requiredSongs || tickets.size > 0}
                                        className="ml-auto"
                                    >
                                        Generate
                                    </Button>
                                </div>
                                {songsForGeneration < requiredSongs && (
                                    <p className="text-sm text-amber-500 mt-2">
                                        {validSelectedSongIds.length > 0
                                            ? `Select at least ${requiredSongs} songs in Media Control to generate tickets (${gridSize}x${gridSize} grid). Currently ${songsForGeneration} selected.`
                                            : `Add at least ${requiredSongs} songs to the library to generate tickets (${gridSize}x${gridSize} grid).`
                                        }
                                    </p>
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

            {/* Save Preset Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <Card title="💾 Save Preset" className="w-full max-w-md">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-400 mb-2 text-sm">
                                    Preset Name
                                </label>
                                <input
                                    type="text"
                                    value={presetNameInput}
                                    onChange={(e) => setPresetNameInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSavePresetConfirm(presetNameInput);
                                        } else if (e.key === 'Escape') {
                                            setShowSaveModal(false);
                                        }
                                    }}
                                    placeholder="e.g., 80s Night, Rock Classics, Kids Party"
                                    className="w-full bg-slate-700 text-white rounded p-3 border border-slate-600 focus:border-emerald-500 outline-none transition-colors"
                                    autoFocus
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Use letters, numbers, spaces, hyphens, and underscores
                                </p>
                            </div>

                            <div className="text-sm text-slate-400 p-3 bg-slate-800/50 rounded">
                                <strong>This preset will save:</strong>
                                <ul className="mt-2 space-y-1 ml-4 list-disc">
                                    <li>{validSelectedSongIds.length} selected songs</li>
                                    <li>{tickets.size} generated tickets</li>
                                    <li>Grid size: {gridSize}x{gridSize}</li>
                                    <li>PDF settings (header, footer, logo)</li>
                                </ul>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={() => handleSavePresetConfirm(presetNameInput)}
                                    variant="primary"
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                                >
                                    Save Preset
                                </Button>
                                <Button
                                    onClick={() => setShowSaveModal(false)}
                                    variant="secondary"
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
