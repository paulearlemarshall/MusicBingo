import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Song, BingoTicket, BingoGameLogic, BingoGridCell } from '../utils/BingoLogic';
import { PDFConfig } from '../utils/PDFGenerator';

interface GameEffects {
    suspense?: string;
    win?: string;
    lose?: string;
    airhorn?: string;
    link?: string;
}

interface PresetInfo {
    name: string;
    encodedName: string;
    hasBoards: boolean;
    hasTickets: boolean;
}

interface GameState {
    songs: Song[];
    gameCatalog: Song[]; // Subset of songs used for the active tickets
    isPlaying: boolean;
    currentSong: Song | null;
    playedSongs: Set<string>; // IDs of all unique songs played so far
    songHistory: string[]; // Order of song IDs played
    historyIndex: number; // Current position in history
    tickets: Map<string, BingoTicket>;
    volume: number;
    pdfConfig: PDFConfig;
    gridSize: number;
    // New Settings
    autoFade: boolean;
    overlapSeconds: number;
    linkEffectEnabled: boolean;
    effects: GameEffects;
    activeFolder: string | null;
    activeEffect: keyof GameEffects | null;
    // Preset management
    activePreset: string | null;
    availablePresets: PresetInfo[];
    selectedSongIds: Set<string>;
}

interface GameContextType extends GameState {
    addSongs: (newSongs: Song[]) => void;
    removeSong: (id: string) => void;
    updateSong: (id: string, updates: Partial<Song>) => void;
    batchUpdateSongs: (updates: Map<string, Partial<Song>>) => void;
    setSongs: (songs: Song[]) => void;
    generateTickets: (count: number) => void;
    startGame: () => void;
    playNext: () => void;
    replayPrevious: () => void;
    togglePause: () => void;
    setVolume: (vol: number) => void;
    resetGame: () => void;
    setPdfConfig: (config: PDFConfig) => void;
    setGridSize: (size: number) => void;
    // Setters for new settings
    setAutoFade: (enabled: boolean) => void;
    setOverlapSeconds: (seconds: number) => void;
    setLinkEffectEnabled: (enabled: boolean) => void;
    updateEffects: (updates: Partial<GameEffects>) => void;
    setActiveEffect: (effect: keyof GameEffects | null | ((prev: keyof GameEffects | null) => keyof GameEffects | null)) => void;
    updateSongCues: (song: Song, startTime?: number, endTime?: number) => void;
    setActiveFolder: (folder: string | null) => void;
    clearLibrary: () => void;
    clearTickets: (folderPath: string | null) => void;
    loadTicketsFromBoards: (boards: any[], catalog?: Song[]) => void;
    // Preset management
    loadPresets: (folderPath: string) => Promise<void>;
    loadPreset: (presetName: string) => Promise<void>;
    savePreset: (presetName: string) => Promise<boolean>;
    deletePreset: (presetName: string) => Promise<boolean>;
    setActivePreset: (name: string | null) => void;
    // Song selection for presets
    toggleSongSelection: (songId: string) => void;
    selectAllSongs: () => void;
    deselectAllSongs: () => void;
    setSelectedSongIds: (ids: Set<string>) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const log = (message: string, ...args: any[]) => {
    console.log(`[${new Date().toISOString()}] [GameContext] ${message}`, ...args);
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [songs, setSongs] = useState<Song[]>([]);
    const [gameCatalog, setGameCatalog] = useState<Song[]>([]);
    const [tickets, setTickets] = useState<Map<string, BingoTicket>>(new Map());
    const [playedSongs, setPlayedSongs] = useState<Set<string>>(new Set());
    const [songHistory, setSongHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState<number>(-1);
    const [currentSong, setCurrentSong] = useState<Song | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const [pdfConfig, setPdfConfig] = useState<PDFConfig>({
        headerText: "Musical Bingo",
        footerText: "Have Fun!",
        logoUrl: undefined
    });
    const [gridSize, setGridSize] = useState(5);

    const [autoFade, setAutoFade] = useState(true);
    const [overlapSeconds, setOverlapSeconds] = useState(3);
    const [linkEffectEnabled, setLinkEffectEnabled] = useState(false);
    const [effects, setEffects] = useState<GameEffects>({});
    const [activeFolder, setActiveFolder] = useState<string | null>(null);
    const [activeEffect, setActiveEffect] = useState<keyof GameEffects | null>(null);

    // Preset management state
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const [availablePresets, setAvailablePresets] = useState<PresetInfo[]>([]);
    const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());

    // Automatically cue the first song when tickets are ready but no song is playing
    React.useEffect(() => {
        if (tickets.size > 0 && !currentSong && playedSongs.size === 0) {
            log("[GameContext] Game ready. Cueing first song...");
            const catalogToUse = gameCatalog.length > 0 ? gameCatalog : songs;
            if (catalogToUse.length > 0) {
                const first = catalogToUse[Math.floor(Math.random() * catalogToUse.length)];
                // Sync with latest library metadata
                const libMatch = songs.find(s => s.id === first.id || s.filePath.toLowerCase().replace(/\\/g, '/') === first.filePath.toLowerCase().replace(/\\/g, '/'));
                const syncedFirst = libMatch ? { ...first, startTime: libMatch.startTime, endTime: libMatch.endTime, duration: libMatch.duration } : first;
                
                setCurrentSong(syncedFirst);
                setPlayedSongs(new Set([syncedFirst.id]));
                setSongHistory([syncedFirst.id]);
                setHistoryIndex(0);
                setIsPlaying(false); // Ensure it doesn't start playing automatically
            }
        }
    }, [tickets.size, currentSong, playedSongs.size, gameCatalog, songs]);

    const updateEffects = (updates: Partial<GameEffects>) => {
        setEffects(prev => ({ ...prev, ...updates }));
    };

    // Load settings from file on mount
    React.useEffect(() => {
        const loadSavedSettings = async () => {
            try {
                // @ts-ignore
                const saved = await window.ipcRenderer.invoke('settings:load');
                if (saved) {
                    if (saved.autoFade !== undefined) setAutoFade(saved.autoFade);
                    if (saved.overlapSeconds !== undefined) setOverlapSeconds(saved.overlapSeconds);
                    if (saved.effects) updateEffects(saved.effects);
                }
            } catch (e) {
                console.error("Failed to load settings", e);
            }
        };
        loadSavedSettings();
    }, []);

    const addSongs = (newSongs: Song[]) => {
        console.log(`[GameContext] addSongs: Adding ${newSongs.length} songs`);
        setSongs(prev => [...prev, ...newSongs]);
    };

    const removeSong = (id: string) => {
        console.log(`[GameContext] removeSong: Removing song ID ${id}`);
        setSongs(prev => prev.filter(s => s.id !== id));
    };

    const updateSong = (id: string, updates: Partial<Song>) => {
        console.log(`[GameContext] updateSong: Updating song ${id}:`, updates);
        setSongs(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
    };

    const batchUpdateSongs = (updates: Map<string, Partial<Song>>) => {
        console.log(`[GameContext] batchUpdateSongs: Updating ${updates.size} songs`);
        setSongs(prev => prev.map(s => {
            const update = updates.get(s.id);
            if (update) {
                console.log(`[GameContext] Updating song ${s.id} (${s.title}):`, update);
            }
            return update ? { ...s, ...update } : s;
        }));
    };

    const generateTickets = (count: number) => {
        // Use selected songs if any are selected, otherwise use all songs
        const songsToUse = selectedSongIds.size > 0
            ? songs.filter(s => selectedSongIds.has(s.id))
            : songs;

        if (songsToUse.length === 0) {
            alert("No songs available for ticket generation. Please select songs or load a music folder.");
            return;
        }

        const safeMax = BingoGameLogic.calculateSafeMax(songsToUse.length, gridSize);
        if (count > safeMax && safeMax > 0) {
            alert(`You requested ${count} tickets, but only ${safeMax} unique tickets can be generated with ${songsToUse.length} selected songs and grid size ${gridSize}. Please request ${safeMax} or fewer.`);
            return;
        }

        const newTickets = new Map<string, BingoTicket>();
        const generatedSets = new Set<string>();

        for (let i = 0; i < count; i++) {
            let ticket: BingoTicket | null = null;
            let attempts = 0;
            const maxAttempts = 200; // Increased attempts for high-collision scenarios

            while (attempts < maxAttempts) {
                try {
                    const ticketId = (i + 1).toString();
                    ticket = BingoGameLogic.generateTicket(songsToUse, gridSize, ticketId);

                    // Create a unique key for this set of songs (order independent)
                    const songIds = ticket.grid.flat().map(c => c.song.id).sort().join(',');

                    if (!generatedSets.has(songIds)) {
                        generatedSets.add(songIds);
                        newTickets.set(ticket.id, ticket);
                        break; // Found a unique one, exit while loop
                    }
                    attempts++;
                } catch (e) {
                    if (e instanceof Error) {
                        console.error("Failed to generate ticket", e);
                        alert(e.message);
                    } else {
                        alert("An unknown error occurred during ticket generation.");
                    }
                    return; // Exit generation entirely on error
                }
            }

            if (attempts === maxAttempts) {
                // This is hit if we couldn't find a unique ticket in a reasonable number of tries.
                alert(`Could not generate the requested number of unique tickets due to high chance of duplicates. ${newTickets.size} were created successfully.`);
                break; 
            }
        }
        setTickets(newTickets);
        setGameCatalog([...songsToUse]); // The selected songs make up the catalog for these tickets
    };

    // Reconstruct tickets from loaded board data
    const loadTicketsFromBoards = useCallback((boards: any[], catalog?: Song[]) => {
        const reconstructedTickets = new Map<string, BingoTicket>();
        let detectedGridSize = 5; // Fallback

        // Set the game catalog from the loaded file or fallback to current library
        if (catalog && catalog.length > 0) {
            log(`[GameContext] Loading saved catalog with ${catalog.length} songs. Syncing cues...`);
            const syncedCatalog = catalog.map(catSong => {
                const libMatch = songs.find(s => s.id === catSong.id || s.filePath.toLowerCase().replace(/\\/g, '/') === catSong.filePath.toLowerCase().replace(/\\/g, '/'));
                if (libMatch) {
                    return { ...catSong, startTime: libMatch.startTime, endTime: libMatch.endTime, duration: libMatch.duration };
                }
                return catSong;
            });
            setGameCatalog(syncedCatalog);
        } else {
            log(`[GameContext] No saved catalog found in boards.ini. Falling back to current library (${songs.length} songs).`);
            setGameCatalog([...songs]);
        }

        boards.forEach(board => {
            // Determine grid size from max row/col in this board
            const boardMaxRow = Math.max(...board.cells.map((c: any) => c.row), 0);
            const boardMaxCol = Math.max(...board.cells.map((c: any) => c.col), 0);
            const size = Math.max(boardMaxRow, boardMaxCol) + 1;
            detectedGridSize = size; 

            // Initialize grid with placeholders based on detected size
            const grid: BingoGridCell[][] = Array(size).fill(null).map(() => 
                Array(size).fill(null).map(() => ({ 
                    song: { id: '', title: 'Unknown', artist: 'Unknown', filePath: '' } as Song, 
                    marked: false 
                }))
            );
            
            board.cells.forEach((cell: any) => {
                // Robust matching to find the song in the current library
                const song = songs.find(s => {
                    // 1. Exact ID match (most common for fresh generations)
                    if (s.id === cell.songId) return true;

                    // 2. Normalized path match (handles slash differences)
                    const normS = s.filePath.toLowerCase().replace(/\\/g, '/');
                    const normC = cell.songId.toLowerCase().replace(/\\/g, '/');
                    if (normS === normC) return true;

                    // 3. Filename match (fallback for moved folders or relative paths)
                    const fileS = normS.split('/').pop();
                    const fileC = normC.split('/').pop();
                    if (fileS && fileS === fileC) return true;

                    return false;
                });

                if (song) {
                    grid[cell.row][cell.col] = { song, marked: false };
                } else {
                    log(`[WARN] loadTicketsFromBoards: Could not find song match for "${cell.songId}" on board ${board.id}`);
                }
            });
            
            reconstructedTickets.set(board.id, {
                id: board.id,
                grid
            });
        });
        
        setTickets(reconstructedTickets);
        setGridSize(detectedGridSize);
        log(`[GameContext] Reconstructed ${reconstructedTickets.size} tickets with grid size ${detectedGridSize}`);
    }, [songs]);

    const startGame = () => {
        console.log("[GameContext] startGame: Initializing game state");
        setPlayedSongs(new Set());
        setSongHistory([]);
        setHistoryIndex(-1);
        setCurrentSong(null);
        setIsPlaying(false);
    };

    const playNext = () => {
        log(`playNext called. History Index: ${historyIndex}, History Length: ${songHistory.length}`);
        
        // If we are currently behind the end of history, just move forward
        if (historyIndex < songHistory.length - 1) {
            const nextIndex = historyIndex + 1;
            const nextSongId = songHistory[nextIndex];
            const nextSongBase = songs.find(s => s.id === nextSongId);
            if (nextSongBase) {
                // Sync with latest metadata
                const libMatch = songs.find(s => s.id === nextSongBase.id || s.filePath.toLowerCase().replace(/\\/g, '/') === nextSongBase.filePath.toLowerCase().replace(/\\/g, '/'));
                const nextSong = libMatch ? { ...nextSongBase, startTime: libMatch.startTime, endTime: libMatch.endTime, duration: libMatch.duration } : nextSongBase;

                log(`playNext: Moving forward in history to index ${nextIndex}. Song: "${nextSong.title}"`);
                setHistoryIndex(nextIndex);
                setCurrentSong(nextSong);
                setIsPlaying(true);
                return;
            }
        }

        // Otherwise, pick a random song from the game catalog that hasn't been played AT ALL yet
        const catalogToUse = gameCatalog.length > 0 ? gameCatalog : songs;
        const unplayed = catalogToUse.filter(s => !playedSongs.has(s.id));
        log(`playNext: ${unplayed.length} unplayed songs remaining in catalog.`);

        if (unplayed.length === 0) {
            log("[WARN] playNext: No more unplayed songs in catalog! Stopping game.");
            setIsPlaying(false);
            return;
        }

        const nextFromCatalog = unplayed[Math.floor(Math.random() * unplayed.length)];
        
        // Sync with latest library metadata (cues, etc)
        const libMatch = songs.find(s => s.id === nextFromCatalog.id || s.filePath.toLowerCase().replace(/\\/g, '/') === nextFromCatalog.filePath.toLowerCase().replace(/\\/g, '/'));
        const next = libMatch ? { ...nextFromCatalog, startTime: libMatch.startTime, endTime: libMatch.endTime, duration: libMatch.duration } : nextFromCatalog;

        log(`playNext: Starting song: "${next.title}"`);

        setCurrentSong(next);
        setPlayedSongs(prev => {
            const nextSet = new Set(prev);
            nextSet.add(next.id);
            return nextSet;
        });
        setSongHistory(prev => [...prev, next.id]);
        setHistoryIndex(prev => prev + 1);
        setIsPlaying(true);
    };

    const replayPrevious = () => {
        log(`replayPrevious called. Current historyIndex: ${historyIndex}`);
        if (historyIndex > 0) {
            const prevIndex = historyIndex - 1;
            const prevSongId = songHistory[prevIndex];
            const prevSongBase = songs.find(s => s.id === prevSongId);
            if (prevSongBase) {
                // Sync with latest metadata
                const libMatch = songs.find(s => s.id === prevSongBase.id || s.filePath.toLowerCase().replace(/\\/g, '/') === prevSongBase.filePath.toLowerCase().replace(/\\/g, '/'));
                const prevSong = libMatch ? { ...prevSongBase, startTime: libMatch.startTime, endTime: libMatch.endTime, duration: libMatch.duration } : prevSongBase;

                log(`replayPrevious: Moving back to index ${prevIndex}. Song: "${prevSong.title}"`);
                setHistoryIndex(prevIndex);
                setCurrentSong(prevSong);
                setIsPlaying(true);
            }
        } else if (historyIndex === 0) {
            log("replayPrevious: Restarting first song.");
            const current = currentSong;
            setCurrentSong(null);
            setTimeout(() => {
                log("replayPrevious: Re-setting first song to force restart.");
                setCurrentSong(current);
            }, 10);
        }
    };

    const togglePause = () => {
        log(`togglePause called. Setting isPlaying to: ${!isPlaying}`);
        setIsPlaying(!isPlaying);
    }

    const updateSongCues = async (song: Song, startTime?: number, endTime?: number) => {
        // Update local state
        setSongs(prev => prev.map(s =>
            s.id === song.id ? { ...s, startTime, endTime } : s
        ));

        // Persist to cue.ini
        try {
            const folderPath = song.filePath.substring(0, song.filePath.lastIndexOf('\\'));
            const fileName = song.filePath.split('\\').pop() || '';

            // @ts-ignore
            const existingCues = await window.ipcRenderer.invoke('cues:load', folderPath);
            existingCues[fileName] = { startTime, endTime };

            // @ts-ignore
            await window.ipcRenderer.invoke('cues:save', { folderPath, cues: existingCues });
        } catch (e) {
            console.error("Failed to persist cues", e);
        }
    };

    const clearLibrary = useCallback(() => {
        console.log("[GameContext] clearLibrary: Resetting entire library and state");
        setSongs([]);
        setGameCatalog([]);
        setActiveFolder(null);
        setTickets(new Map());
        setPlayedSongs(new Set());
        setSongHistory([]);
        setHistoryIndex(-1);
        setCurrentSong(null);
        setIsPlaying(false);
        setSelectedSongIds(new Set());
        setActivePreset(null);
        setAvailablePresets([]);
    }, []);

    const clearTickets = useCallback(async (folderPath: string | null) => {
        console.log("[GameContext] clearTickets: Clearing all generated tickets from memory and disk.");
        setTickets(new Map());
        setGameCatalog([]);
    
        if (folderPath) {
            try {
                // @ts-ignore
                await window.ipcRenderer.invoke('boards:save', {
                    folderPath: folderPath,
                    tickets: []
                });
                console.log("[GameContext] Cleared boards.ini");
            } catch (e) {
                console.error("[GameContext] Failed to clear boards.ini", e);
            }
        }
    }, []);

    const resetGame = () => {
        console.log("[GameContext] resetGame: Clearing all game progress");
        setPlayedSongs(new Set());
        setSongHistory([]);
        setHistoryIndex(-1);
        setCurrentSong(null);
        setIsPlaying(false);
    }

    // Preset management functions
    const loadPresets = useCallback(async (folderPath: string) => {
        if (!folderPath) return;
        try {
            // @ts-ignore
            const presets = await window.ipcRenderer.invoke('presets:list', folderPath);
            setAvailablePresets(presets || []);
            log(`[loadPresets] Found ${presets?.length || 0} presets`);
        } catch (e) {
            console.error("[GameContext] loadPresets ERROR:", e);
            setAvailablePresets([]);
        }
    }, []);

    const loadPreset = useCallback(async (presetName: string) => {
        if (!activeFolder || !presetName) return;
        try {
            log(`[loadPreset] Loading preset "${presetName}"`);
            // @ts-ignore
            const data = await window.ipcRenderer.invoke('presets:load', { folderPath: activeFolder, presetName });

            if (!data) {
                console.error("[GameContext] loadPreset: No data returned");
                return;
            }

            // Load the preset data into state
            if (data.boards && data.boards.length > 0) {
                loadTicketsFromBoards(data.boards, data.catalog);
            }

            if (data.pdfConfig) {
                setPdfConfig(data.pdfConfig);
            }

            if (data.gridSize) {
                setGridSize(data.gridSize);
            }

            if (data.selectedSongIds) {
                setSelectedSongIds(new Set(data.selectedSongIds));
            }

            setActivePreset(presetName);
            log(`[loadPreset] Successfully loaded preset "${presetName}"`);
        } catch (e) {
            console.error("[GameContext] loadPreset ERROR:", e);
        }
    }, [activeFolder, loadTicketsFromBoards]);

    const savePreset = useCallback(async (presetName: string): Promise<boolean> => {
        if (!activeFolder || !presetName) {
            console.error("[GameContext] savePreset: Missing activeFolder or presetName");
            return false;
        }

        try {
            log(`[savePreset] Saving preset "${presetName}"`);

            // Get selected songs for the catalog
            const catalog = songs.filter(s => selectedSongIds.has(s.id));

            // @ts-ignore
            const success = await window.ipcRenderer.invoke('presets:save', {
                folderPath: activeFolder,
                presetName,
                tickets: Array.from(tickets.values()),
                catalog,
                gridSize,
                pdfConfig,
                selectedSongIds: Array.from(selectedSongIds)
            });

            if (success) {
                setActivePreset(presetName);
                await loadPresets(activeFolder); // Refresh preset list
                log(`[savePreset] Successfully saved preset "${presetName}"`);
            }

            return success;
        } catch (e) {
            console.error("[GameContext] savePreset ERROR:", e);
            return false;
        }
    }, [activeFolder, songs, tickets, gridSize, pdfConfig, selectedSongIds, loadPresets]);

    const deletePreset = useCallback(async (presetName: string): Promise<boolean> => {
        if (!activeFolder || !presetName) {
            console.error("[GameContext] deletePreset: Missing activeFolder or presetName");
            return false;
        }

        try {
            log(`[deletePreset] Deleting preset "${presetName}"`);
            // @ts-ignore
            const success = await window.ipcRenderer.invoke('presets:delete', { folderPath: activeFolder, presetName });

            if (success) {
                if (activePreset === presetName) {
                    setActivePreset(null);
                    setTickets(new Map());
                    setGameCatalog([]);
                    setSelectedSongIds(new Set());
                }
                await loadPresets(activeFolder); // Refresh preset list
                log(`[deletePreset] Successfully deleted preset "${presetName}"`);
            }

            return success;
        } catch (e) {
            console.error("[GameContext] deletePreset ERROR:", e);
            return false;
        }
    }, [activeFolder, activePreset, loadPresets]);

    // Song selection functions for presets
    const toggleSongSelection = useCallback((songId: string) => {
        setSelectedSongIds(prev => {
            const updated = new Set(prev);
            if (updated.has(songId)) {
                updated.delete(songId);
            } else {
                updated.add(songId);
            }
            return updated;
        });
    }, []);

    const selectAllSongs = useCallback(() => {
        setSelectedSongIds(new Set(songs.map(s => s.id)));
    }, [songs]);

    const deselectAllSongs = useCallback(() => {
        setSelectedSongIds(new Set());
    }, []);

    return (
        <GameContext.Provider value={{
            songs,
            gameCatalog,
            isPlaying,
            currentSong,
            playedSongs,
            songHistory,
            historyIndex,
            tickets,
            volume,
            pdfConfig,
            gridSize,
            autoFade,
            overlapSeconds,
            linkEffectEnabled,
            effects,
            activeFolder,
            activeEffect,
            activePreset,
            availablePresets,
            selectedSongIds,
            addSongs,
            removeSong,
            updateSong,
            batchUpdateSongs,
            setSongs,
            generateTickets,
            startGame,
            playNext,
            replayPrevious,
            togglePause,
            setVolume,
            resetGame,
            setPdfConfig,
            setGridSize,
            setAutoFade,
            setOverlapSeconds,
            setLinkEffectEnabled,
            updateEffects,
            setActiveEffect,
            updateSongCues,
            setActiveFolder,
            clearLibrary,
            clearTickets,
            loadTicketsFromBoards,
            loadPresets,
            loadPreset,
            savePreset,
            deletePreset,
            setActivePreset,
            toggleSongSelection,
            selectAllSongs,
            deselectAllSongs,
            setSelectedSongIds
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) throw new Error('useGame must be used within a GameProvider');
    return context;
};