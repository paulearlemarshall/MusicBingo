import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Howl } from 'howler';
import { useGame } from '../../context/GameContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { BingoGameLogic } from '../../utils/BingoLogic';

const log = (message: string, ...args: any[]) => {
    console.log(`[${new Date().toISOString()}] [GameControl] ${message}`, ...args);
};

export const GameControl: React.FC = () => {
    const {
        currentSong, isPlaying, initializeGame, playNext, replayPrevious, togglePause,
        volume, setVolume, tickets, playedSongs, songs, gameCatalog, songHistory, historyIndex,
        linkEffectEnabled, setLinkEffectEnabled, effects, resetGame,
        overlapSeconds, setOverlapSeconds, autoFade, setAutoFade,
        activeEffect, setActiveEffect
    } = useGame();

    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isInitialized, setIsInitialized] = useState(false);

    const soundRef = useRef<Howl | null>(null);
        const effectRef = useRef<Howl | null>(null);
        const animationFrameId = useRef<number>();
        const isTransitioningRef = useRef(false);
        const isSeekingRef = useRef(false);
    
            // Refs for values accessed inside callbacks/effects to avoid dependency churn
            const autoFadeRef = useRef(autoFade);
            const overlapSecondsRef = useRef(overlapSeconds);
            const volumeRef = useRef(volume);
            const currentSongRef = useRef(currentSong);
        
            useEffect(() => {
                autoFadeRef.current = autoFade;
                overlapSecondsRef.current = overlapSeconds;
                volumeRef.current = volume;
                currentSongRef.current = currentSong;
            }, [autoFade, overlapSeconds, volume, currentSong]);

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
                    volume: volumeRef.current,
                    onend: () => setActiveEffect(null),
                    onstop: () => setActiveEffect(null),
                    onloaderror: () => setActiveEffect(null),
                    onplayerror: () => setActiveEffect(null)
                });
                
                effectRef.current = effect;
                effect.play();
                return effect;
            }, [effects, setActiveEffect]);
        
            // ======== STABLE CALLBACKS (Locked against rapid clicks) ======== 
        
                    const handleAdvance = useCallback(() => {
                        if (isTransitioningRef.current) {
                            log('handleAdvance called while a transition is locked. Aborting.');
                            return;
                        }
                
                        // Check if there's actually a next song to go to
                        const hasNextInHistory = historyIndex < songHistory.length - 1;
                        const hasUnplayed = songs.some(s => !playedSongs.has(s.id));
                        
                        if (!hasNextInHistory && !hasUnplayed) {
                            log('No more songs to advance to. Stopping game.');
                            if (soundRef.current) {
                                soundRef.current.stop();
                            }
                            togglePause(); // This will set isPlaying to false
                            return;
                        }
                
                        log('handleAdvance triggered. Locking transition.');
                        isTransitioningRef.current = true;
                
                        const currentAutoFade = autoFadeRef.current;
                        const currentOverlap = overlapSecondsRef.current;
                        const currentVolume = volumeRef.current;
                        const isLinkEnabled = linkEffectEnabled; // Check if Link SFX is enabled
                
                        // Helper to perform the actual song change
                        const executeAdvance = () => {
                            log('Calling playNext().');
                            playNext();
                            setTimeout(() => { log('Unlocking transition.'); isTransitioningRef.current = false; }, 500);
                        };
                
                        if (isLinkEnabled && effects.link) {
                            log('Link SFX enabled. Playing link effect before advancing.');
                            if (soundRef.current) soundRef.current.stop();
                            const effect = playEffect('link');
                            
                            // If we have an effect, wait for it to finish or a fixed duration before advancing
                            if (effect) {
                                effect.once('end', () => {
                                    log('Link effect finished. Advancing song.');
                                    executeAdvance();
                                });
                            } else {
                                executeAdvance();
                            }
                        } else if (currentAutoFade && soundRef.current && currentOverlap > 0) {
                            const fadeDuration = (currentOverlap > 0 ? currentOverlap : 0.5) * 1000;
                            log(`Fade Advance: Fading out current track over ${fadeDuration}ms.`);
                            soundRef.current.fade(currentVolume, 0, fadeDuration);
                            setTimeout(() => {
                                log('Fade out complete.');
                                executeAdvance();
                            }, fadeDuration);
                        } else {
                            log('Advancing immediately.');
                            if (soundRef.current) soundRef.current.stop();
                            executeAdvance();
                        }
                    }, [playNext, togglePause, songs, playedSongs, songHistory, historyIndex, linkEffectEnabled, effects.link, playEffect]);            const handleReplay = useCallback(() => {
                if (isTransitioningRef.current) {
                    log('handleReplay called while a transition is locked. Aborting.');
                    return;
                }
                log('handleReplay triggered. Locking transition.');
                isTransitioningRef.current = true;
                
                const currentAutoFade = autoFadeRef.current;
                const currentOverlap = overlapSecondsRef.current;
                const currentVolume = volumeRef.current;
                const fadeDuration = (currentOverlap > 0 ? currentOverlap : 0.5) * 1000;
        
                if (currentAutoFade && soundRef.current && currentOverlap > 0) {
                    log(`Fade Replay: Fading out current track over ${fadeDuration}ms.`);
                    soundRef.current.fade(currentVolume, 0, fadeDuration);
                    setTimeout(() => {
                        log('Fade out complete, calling replayPrevious().');
                        replayPrevious();
                        setTimeout(() => { log('Unlocking transition.'); isTransitioningRef.current = false; }, 500);
                    }, fadeDuration);
                } else {
                    log('Replaying immediately (no fade).');
                    replayPrevious();
                    setTimeout(() => { log('Unlocking transition.'); isTransitioningRef.current = false; }, 500);
                }
            }, [replayPrevious]);
        
        
                const step = useCallback(() => {
                    const sound = soundRef.current;
                    if (sound && sound.playing() && !isSeekingRef.current) {
                        const currentPos = sound.seek() as number;
                        setProgress(currentPos);
            
                        // Check if we passed the End Cue (or Fade Out Start)
                        const song = currentSongRef.current;
                        if (song && song.endTime) {
                            // If autoFade is enabled, we start the transition early so the fade completes AT the end time
                            const overlap = overlapSecondsRef.current;
                            const isAutoFade = autoFadeRef.current;
                            const triggerTime = isAutoFade ? Math.max((song.startTime || 0), song.endTime - overlap) : song.endTime;
            
                            if (currentPos >= triggerTime) {
                                // If we hit the trigger point, treat it as finishing the track.
                                if (!isTransitioningRef.current) {
                                    log(`End Cue reached (Trigger: ${triggerTime.toFixed(2)}s). Advancing.`);
                                    handleAdvance();
                                }
                            }
                        }
                    }
                    animationFrameId.current = requestAnimationFrame(step);
                }, [handleAdvance]);        
        
            // ======== EFFECTS ========    
        // Effect for controlling the animation loop.
        useEffect(() => {
            if (isPlaying) {
                animationFrameId.current = requestAnimationFrame(step);
            }
            else {
                if (animationFrameId.current) {
                    cancelAnimationFrame(animationFrameId.current);
                }
            }
            return () => {
                if (animationFrameId.current) {
                    cancelAnimationFrame(animationFrameId.current);
                }
            };
        }, [isPlaying, step]);
    
        // Effect to create and play the new sound
        useEffect(() => {
            if (!currentSong) return;
    
            log(`New song detected: "${currentSong.artist} - ${currentSong.title}"`);
    
            setProgress(0);
            setDuration(0);
    
            // Capture current values for the closure
            const initialAutoFade = autoFadeRef.current;
            const initialVolume = volumeRef.current;
    
            const newSound = new Howl({
                src: [`media://local/${encodeURIComponent(currentSong.filePath.replace(/\\/g, '/'))}`],
                html5: true,
                // If autoFade is on, start silent and fade in
                volume: initialAutoFade ? 0 : initialVolume,
                onplay: () => {
                    setDuration(newSound.duration());
                    // Use refs inside callback to get latest values at play time (though usually immediate)
                    if (autoFadeRef.current) {
                        const fadeDuration = (overlapSecondsRef.current > 0 ? overlapSecondsRef.current : 0.5) * 1000;
                        log(`Fading IN new track over ${fadeDuration}ms`);
                        newSound.fade(0, volumeRef.current, fadeDuration);
                    }
                },
                onload: () => {
                    setDuration(newSound.duration());
                    if (currentSong.startTime) {
                        log(`Seeking to start cue point: ${currentSong.startTime}s`);
                        newSound.seek(currentSong.startTime);
                    }
                },
                onend: () => {
                    log('Howl "onend" event triggered for song.');
                    // Here we call the locked advance handler
                    handleAdvance();
                }
            });
            
        soundRef.current = newSound;

        // Auto-play if the global state is playing
        if (isPlaying) {
            newSound.play();
        }

        // Cleanup function to unload sound when song changes
        return () => {
            if (soundRef.current) {
                soundRef.current.unload();
            }
        };

        // Removed isPlaying from deps to prevent reloading on pause/play toggle
    }, [currentSong]); // Only re-run when the song changes
    

    // Effect for handling manual play/pause
    useEffect(() => {
        if (!soundRef.current) return;
        if (isPlaying && !soundRef.current.playing()) {
            soundRef.current.play();
        } else if (!isPlaying && soundRef.current.playing()) {
            soundRef.current.pause();
        }
    }, [isPlaying]);

    // Effect for changing volume
    useEffect(() => {
        if (soundRef.current && soundRef.current.volume() > 0) {
            soundRef.current.volume(volume);
        }
    }, [volume]);

    // Track initialization state based on currentSong
    useEffect(() => {
        log(`[DEBUG] isInitialized useEffect triggered - currentSong: ${currentSong ? 'EXISTS' : 'NULL'}, isInitialized: ${isInitialized}`);

        if (currentSong && !isInitialized) {
            log('[DEBUG] Setting isInitialized to TRUE');
            setIsInitialized(true);
        } else if (!currentSong && isInitialized) {
            // Reset to uninitialized when currentSong is cleared (e.g., preset load, reset)
            log('[DEBUG] Setting isInitialized to FALSE (currentSong cleared)');
            setIsInitialized(false);
        } else {
            log('[DEBUG] No state change needed');
        }
    }, [currentSong, isInitialized]);


    // ======== UTILITY & SFX FUNCTIONS ======== 
    const handleFadeToggle = useCallback(() => {
        if (!soundRef.current) return;
        
        const toggleFadeDuration = 2000;
        const currentVolume = volumeRef.current; // Use ref for stable value

        if (isPlaying) {
            log(`Fade Pause: Fading out to 0 over ${toggleFadeDuration}ms`);
            soundRef.current.fade(currentVolume, 0, toggleFadeDuration);
            
            setTimeout(() => {
                log('Fade Pause complete. Toggling pause state.');
                togglePause();
                // Restore volume internally for next play? 
                // It's safer to ensure volume is correct when we resume.
            }, toggleFadeDuration);
        } else {
            log(`Fade Resume: Fading in to ${currentVolume} over ${toggleFadeDuration}ms`);
            
            // Set volume to 0 immediately before resuming
            soundRef.current.volume(0);
            
            // Start playing (Resume)
            togglePause(); 
            
            // Fade to target volume
            soundRef.current.fade(0, currentVolume, toggleFadeDuration);
        }
    }, [isPlaying, togglePause]); // Removed volume dependency


    const formatTime = (secs: number) => {
        if (!secs || isNaN(secs)) return '0:00';
        const minutes = Math.floor(secs / 60);
        const seconds = Math.floor(secs % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const handleSeek = (val: number) => {
        setProgress(val);
        if (soundRef.current) soundRef.current.seek(val);
    };

    // ======== MEMOIZED CALCULATIONS ======== 
    
    const totalTimeRemaining = useMemo(() => {
        const DEFAULT_DURATION = 30; 
        const catalogToUse = gameCatalog.length > 0 ? gameCatalog : songs;
        
        const getCuedTime = (s: any) => {
            const libMatch = songs.find(ls => ls.id === s.id);
            const start = libMatch?.startTime || s.startTime || 0;
            const end = libMatch?.endTime || s.endTime || libMatch?.duration || s.duration || DEFAULT_DURATION;
            return Math.max(0, end - start);
        };

        // 1. Total duration of every track expected in this game
        const totalMatchDuration = catalogToUse.reduce((acc, s) => acc + getCuedTime(s), 0);

        // 2. Duration of tracks that have been fully completed in the current sequence
        let completedDuration = 0;
        for (let i = 0; i < historyIndex; i++) {
            const songId = songHistory[i];
            const song = catalogToUse.find(s => s.id === songId);
            if (song) completedDuration += getCuedTime(song);
        }

        // 3. Time already spent in the current song (relative to its start cue)
        const currentSongStart = songs.find(ls => ls.id === currentSong?.id)?.startTime || currentSong?.startTime || 0;
        const currentElapsed = currentSong ? Math.max(0, progress - currentSongStart) : 0;

        const totalRemaining = totalMatchDuration - completedDuration - currentElapsed;
        return Math.max(0, totalRemaining);
    }, [songs, gameCatalog, songHistory, historyIndex, currentSong, progress]);

    const isPreciseTime = useMemo(() => {
        const catalogToUse = gameCatalog.length > 0 ? gameCatalog : songs;
        return !catalogToUse.some(s => !s.duration && !songs.find(ls => ls.id === s.id)?.duration);
    }, [songs, gameCatalog]);

    const formatTotalTime = (secs: number) => {
        if (!secs || isNaN(secs) || secs < 0) return '00:00:00';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
    };

    const winners = useMemo(() => {
        const result: Record<string, string[]> = { '1_LINE': [], '2_LINES': [], 'FOUR_CORNERS': [], 'FULL_HOUSE': [] };
        if (tickets.size === 0 || playedSongs.size === 0) return result;
        tickets.forEach((ticket, id) => {
            const ticketWins = BingoGameLogic.checkWins(ticket, playedSongs);
            ticketWins.forEach(win => {
                if (win && result[win]) result[win].push(id);
            });
        });
        return result;
    }, [tickets, playedSongs]);

    const clipTimeRemaining = useMemo(() => {
        if (!currentSong || !currentSong.endTime || progress < (currentSong.startTime || 0)) return null;
        const remaining = currentSong.endTime - progress;
        return remaining > 0 ? remaining : 0;
    }, [currentSong, progress]);

    // ======== RENDER LOGIC ======== 
    if (tickets.size === 0) {
        return (
            <div className="p-8 h-full flex items-center justify-center">
                <Card className="max-w-md text-center py-12">
                    <div className="text-4xl mb-4">🎟️</div>
                    <h3 className="text-xl font-bold text-white mb-2">No Active Game</h3>
                    <p className="text-slate-400">Please go to <span className="text-purple-400 font-bold">Ticket Management</span> to generate tickets first.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8 h-full overflow-y-auto">
            <header className="flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Game Control</h2>
                    <p className="text-slate-400 mt-1">DJ Booth & Playlist Management</p>
                </div>
                <div className="flex gap-6 items-start">
                    <Button
                        variant="secondary"
                        onClick={() => {
                            log(`[DEBUG] Button clicked - isInitialized BEFORE: ${isInitialized}`);
                            if (!isInitialized) {
                                log('Initialize Game clicked. Loading first song without auto-play.');
                                log(`[DEBUG] About to call initializeGame()`);
                                initializeGame();
                            } else {
                                log('Manual "Reset Game" clicked. Confirming...');
                                if (window.confirm("Are you sure you want to reset the current game? This will clear all play history, stats, and the current sequence.")) {
                                    log('Reset Game confirmed. Calling resetGame().');
                                    log(`[DEBUG] About to call resetGame() and setIsInitialized(false)`);
                                    resetGame();
                                    setIsInitialized(false);
                                } else {
                                    log('Reset Game cancelled.');
                                }
                            }
                        }}
                        className={`transition-all flex items-center gap-2 ${
                            !isInitialized
                                ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50'
                                : 'border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50'
                        }`}
                    >
                        <span>{!isInitialized ? '🎬' : '🔄'}</span>
                        <span>{!isInitialized ? 'Initialize Game' : 'Reset Game'}</span>
                    </Button>
                    <div className="text-right">
                        <div className="text-xs uppercase tracking-widest text-slate-500 font-bold mb-1">Session Progress</div>
                        <div className="flex items-center gap-3 justify-end">
                            <span className="text-sm font-mono text-indigo-400 font-bold border border-indigo-500/30 px-2 py-0.5 rounded bg-indigo-500/10">
                                {playedSongs.size} / {gameCatalog.length > 0 ? gameCatalog.length : songs.length}
                            </span>
                            <div className="flex items-center gap-2 border-l border-slate-700 pl-3">
                                <div className={`w-3 h-3 rounded-full animate-pulse ${isPlaying ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-slate-600'}`} />
                                <span className="text-sm font-mono text-slate-300">{isPlaying ? 'LIVE' : 'PAUSED'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <div className="relative p-[2px] rounded-[1.1rem] overflow-hidden bg-slate-800">
                        {/* Chasing Border Animation Element */}
                        <div className="absolute inset-[-100%] bg-[conic-gradient(from_0deg,#3b82f6,#ec4899,#3b82f6)] animate-[chase-spin_4s_linear_infinite]" />
                        
                        <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-transparent relative overflow-hidden group z-10 rounded-xl min-h-[300px] flex flex-col justify-center">
                            <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                            {(currentSong || !isInitialized) ? (
                                <div className="text-center py-12 relative z-10">
                                    <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-200 text-sm font-black mb-6 tracking-wide uppercase border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                        {isPlaying ? "Now Playing" : "Up First"}: {currentSong ? historyIndex + 1 : 1} of {gameCatalog.length > 0 ? gameCatalog.length : songs.length}
                                    </span>
                                    <h3 className="text-2xl md:text-3xl font-black text-white mb-1 tracking-tight drop-shadow-lg lg:px-12 leading-tight truncate uppercase">
                                        {currentSong ? currentSong.artist : 'Artist'}
                                    </h3>
                                    <div className="text-lg md:text-xl font-bold text-indigo-400 tracking-wide truncate uppercase italic">
                                        {currentSong ? currentSong.title : 'Title'}
                                    </div>
                                    <div className="mt-12 relative group/shuttle mx-auto max-w-2xl h-6 flex items-center px-4">
                                        <div className="absolute inset-x-4 bg-slate-950/50 rounded-full h-3 overflow-hidden shadow-inner border border-slate-700/30">
                                            <div
                                                className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-full shadow-[0_0_15px_rgba(168,85,247,0.5)]"
                                                style={{ width: `${duration > 0 ? Math.min(100, (progress / duration) * 100) : 0}%` }}
                                            />
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max={duration || 0}
                                            step="0.1"
                                            value={progress}
                                            onInput={(e) => { isSeekingRef.current = true; handleSeek(parseFloat(e.currentTarget.value)); }}
                                            onChange={() => { isSeekingRef.current = false; }}
                                            className="absolute inset-x-4 w-[calc(100%-2rem)] h-6 opacity-0 cursor-pointer z-20"
                                        />
                                    </div>
                                    <div className="flex justify-around max-w-2xl mx-auto mt-8 text-[10px] text-slate-500 font-mono">
                                        <span className="bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700/30">{currentSong ? formatTime(progress) : '0:00'}</span>
                                        {currentSong && clipTimeRemaining !== null && (
                                            <span className="bg-amber-800/50 px-3 py-0.5 rounded-full border border-amber-700/30 text-amber-300 animate-pulse">
                                                CLIP ENDS IN: {formatTime(clipTimeRemaining)}
                                            </span>
                                        )}
                                        <span className="bg-slate-900/50 px-2 py-0.5 rounded border border-slate-700/30">{currentSong ? formatTime(duration) : '0:00'}</span>
                                    </div>

                                    {/* Inline Start Button - Shows when song loaded but not playing */}
                                    <div className={`mt-10 transition-all duration-700 ${(currentSong && !isPlaying && playedSongs.size >= 1)
                                        ? 'opacity-100 translate-y-0'
                                        : 'opacity-0 pointer-events-none translate-y-4'}`}
                                    >
                                        <Button
                                            onClick={() => {
                                                log('Start Game button clicked. Beginning playback.');
                                                togglePause();
                                            }}
                                            className="px-16 py-5 text-xl rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.4)] transform hover:scale-105 transition-all"
                                        >
                                            Start Game ▶️
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-24 text-slate-500">
                                    <div className="text-8xl mb-6 opacity-10 animate-pulse">🎵</div>
                                    <div className="text-3xl font-light tracking-wide text-slate-400 text-center">Ready to start the session</div>
                                    <div className="mt-3 text-lg font-mono text-indigo-400/60">{gameCatalog.length > 0 ? gameCatalog.length : songs.length} tracks in game catalog</div>
                                </div>
                            )}
                        </Card>
                    </div>

                    <Card title="Playback Controls" className="mt-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Button
                                onClick={() => { log('Manual "Replay Previous" clicked.'); handleReplay(); }}
                                disabled={historyIndex <= 0}
                                className={`py-4 flex flex-col items-center gap-1 group ${isPlaying ? 'bg-amber-600 hover:bg-amber-700 border-amber-500' : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500'}`}
                            >
                                <span className="text-xl group-hover:-translate-x-1 transition-transform">⏮️</span>
                                <span className="text-xs uppercase font-bold">Replay Previous</span>
                            </Button>

                            <Button
                                onClick={() => { log(`Manual "Play/Pause" clicked. Current isPlaying: ${isPlaying}, toggling to ${!isPlaying}`); togglePause(); }}
                                disabled={!currentSong}
                                className={`py-4 flex flex-col items-center gap-1 ${isPlaying ? 'bg-amber-600 hover:bg-amber-700 border-amber-500' : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500'}`}
                            >
                                <span className="text-xl">{isPlaying ? '⏸️' : '▶️'}</span>
                                <span className="text-xs uppercase font-bold">{isPlaying ? 'Pause' : 'Resume'}</span>
                            </Button>

                            <Button
                                onClick={() => { log('Manual "Advance Song" clicked.'); handleAdvance(); }}
                                disabled={!currentSong && historyIndex >= 0}
                                className={`py-4 flex flex-col items-center gap-1 group ${isPlaying ? 'bg-amber-600 hover:bg-amber-700 border-amber-500' : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500'}`}
                            >
                                <span className="text-xl group-hover:translate-x-1 transition-transform">⏭️</span>
                                <span className="text-xs uppercase font-bold text-center">Advance<br />Song</span>
                            </Button>

                            <Button
                                onClick={handleFadeToggle}
                                disabled={!currentSong}
                                className={`py-4 flex flex-col items-center gap-1 transition-all duration-500 ${isPlaying ? 'bg-amber-600 hover:bg-amber-700 border-amber-500' : 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500'}`}
                            >
                                <span className="text-xl">{isPlaying ? '↘️' : '↗️'}</span>
                                <span className="text-xs uppercase font-bold text-center">Fade<br />Play/Pause</span>
                            </Button>

                            <div className="flex flex-col border border-slate-700/50 rounded-md overflow-hidden bg-slate-800/50">
                                <Button
                                    variant="secondary"
                                    onClick={() => { const newState = !autoFade; log(`Toggling autoFade to ${newState}`); setAutoFade(newState); if (newState) setLinkEffectEnabled(false); }}
                                    className={`flex-1 py-2 flex flex-col items-center justify-center gap-1 group transition-all duration-500 rounded-none border-0 ${autoFade ? 'bg-indigo-600 border-indigo-500 text-white shadow-[inset_0_0_15px_rgba(99,102,241,0.3)]' : 'bg-slate-800 text-slate-400'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`text-lg transition-transform ${autoFade ? 'scale-110' : 'grayscale opacity-50'}`}>🔀</span>
                                        <span className="text-[10px] uppercase font-bold">Fade Advance</span>
                                    </div>
                                </Button>
                                <div
                                    className={`h-8 flex items-center justify-between px-2 border-t border-slate-700/50 transition-colors ${autoFade ? 'bg-indigo-900/60' : 'bg-slate-700/30'}`}
                                >
                                    <button 
                                        onClick={() => { const val = Math.max(0, overlapSeconds - 0.5); log(`Decreasing fade duration to ${val}`); setOverlapSeconds(val); }}
                                        className="text-slate-400 hover:text-white px-1 focus:outline-none"
                                    >▼</button>
                                    <span className="text-xs font-mono text-white select-none">{overlapSeconds.toFixed(1)}s</span>
                                    <button 
                                        onClick={() => { const val = overlapSeconds + 0.5; log(`Increasing fade duration to ${val}`); setOverlapSeconds(val); }}
                                        className="text-slate-400 hover:text-white px-1 focus:outline-none"
                                    >▲</button>
                                </div>
                            </div>

                            <Button
                                variant="secondary"
                                onClick={() => { const newState = !linkEffectEnabled; log(`Toggling linkEffectEnabled to ${newState}`); setLinkEffectEnabled(newState); if (newState) setAutoFade(false); }}
                                className={`py-4 flex flex-col items-center gap-1 transition-all duration-500 ${linkEffectEnabled ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' : 'text-slate-400'}`}
                            >
                                <span className={`text-xl transition-transform ${linkEffectEnabled ? 'scale-125' : ''}`}>🔗</span>
                                <span className="text-xs uppercase font-bold text-center">Link SFX<br /><span className="text-[10px] font-normal">{linkEffectEnabled ? 'ON' : 'OFF'}</span></span>
                            </Button>

                            {/* Empty placeholders to fill the second row (cols 3 & 4) */}
                            <div className="hidden md:block" />
                            <div className="hidden md:block" />

                            <Button
                                variant="secondary"
                                onClick={() => { log('Suspense SFX clicked.'); playEffect('suspense'); }}
                                disabled={!effects.suspense}
                                className={`py-4 flex flex-col items-center gap-1 transition-all duration-300 ${
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
                                onClick={() => { log('Win SFX clicked.'); playEffect('win'); }}
                                disabled={!effects.win}
                                className={`py-4 flex flex-col items-center gap-1 transition-all duration-300 ${
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
                                onClick={() => { log('Lose SFX clicked.'); playEffect('lose'); }}
                                disabled={!effects.lose}
                                className={`py-4 flex flex-col items-center gap-1 transition-all duration-300 ${
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
                                onClick={() => { log('Air Horn SFX clicked.'); playEffect('airhorn'); }}
                                disabled={!effects.airhorn}
                                className={`py-4 flex flex-col items-center gap-1 transition-all duration-300 ${
                                    activeEffect === 'airhorn' 
                                    ? 'border-blue-400 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.5)] ring-2 ring-blue-400' 
                                    : 'hover:bg-blue-500/10 border-blue-500/30'
                                }`}
                            >
                                <span className="text-xl">📢</span>
                                <span className="text-xs uppercase font-bold">Air Horn SFX</span>
                            </Button>

                            <div className="md:col-span-4 mt-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-700/50 shadow-inner">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-slate-400 text-xs uppercase font-black tracking-widest flex items-center gap-2">
                                        <span>🔉 Master Volume</span>
                                    </label>
                                    <span className="text-purple-400 font-mono font-bold">{Math.round(volume * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={volume}
                                    onChange={(e) => { const newVolume = parseFloat(e.target.value); log(`Master Volume changed to ${newVolume}`); setVolume(newVolume); }}
                                    className="w-full h-3 bg-slate-800 rounded-full appearance-none cursor-pointer accent-purple-500"
                                />
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-8">
                    <Card title="📊 Game Stats" className="h-full bg-slate-800/50 border-slate-700/50">
                        <div className="space-y-6">
                            <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                                <div className="text-xs uppercase font-black text-slate-500 mb-2 tracking-wider">Estimated Time Remaining</div>
                                <div className="text-3xl font-mono font-bold text-indigo-300">
                                    {formatTotalTime(totalTimeRemaining)}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                    <span className={isPreciseTime ? "text-green-500" : "text-amber-500"}>
                                        {isPreciseTime ? "● Precise" : "● Estimate"}
                                    </span>
                                    (based on cue points)
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs uppercase font-bold text-slate-400 pb-2 border-b border-slate-700/50">
                                    <span>Winning Pattern</span>
                                    <span>Tickets</span>
                                </div>
                                
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center p-2 rounded bg-slate-700/20">
                                        <span className="text-sm font-bold text-slate-300">1 Line</span>
                                        <span className={`font-mono font-bold ${winners['1_LINE'].length > 0 ? 'text-green-400' : 'text-slate-600'}`}>
                                            {winners['1_LINE'].length}
                                        </span>
                                    </div>
                                    {winners['1_LINE'].length > 0 && (
                                        <div className="px-2 py-1 flex flex-wrap gap-1.5">
                                            {winners['1_LINE'].map(id => (
                                                <span key={id} className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded bg-slate-700/40 border border-slate-600/50 text-[10px] font-mono text-green-400 font-bold shadow-sm">
                                                    {id}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center p-2 rounded bg-slate-700/20">
                                        <span className="text-sm font-bold text-slate-300">2 Lines</span>
                                        <span className={`font-mono font-bold ${winners['2_LINES'].length > 0 ? 'text-cyan-400' : 'text-slate-600'}`}>
                                            {winners['2_LINES'].length}
                                        </span>
                                    </div>
                                    {winners['2_LINES'].length > 0 && (
                                        <div className="px-2 py-1 flex flex-wrap gap-1.5">
                                            {winners['2_LINES'].map(id => (
                                                <span key={id} className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded bg-slate-700/40 border border-slate-600/50 text-[10px] font-mono text-cyan-400 font-bold shadow-sm">
                                                    {id}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center p-2 rounded bg-slate-700/20">
                                        <span className="text-sm font-bold text-slate-300">Four Corners</span>
                                        <span className={`font-mono font-bold ${winners['FOUR_CORNERS'].length > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                                            {winners['FOUR_CORNERS'].length}
                                        </span>
                                    </div>
                                    {winners['FOUR_CORNERS'].length > 0 && (
                                        <div className="px-2 py-1 flex flex-wrap gap-1.5">
                                            {winners['FOUR_CORNERS'].map(id => (
                                                <span key={id} className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded bg-slate-700/40 border border-slate-600/50 text-[10px] font-mono text-amber-400 font-bold shadow-sm">
                                                    {id}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <div className="flex justify-between items-center p-2 rounded bg-purple-500/10 border border-purple-500/20">
                                        <span className="text-sm font-bold text-purple-300">Full House</span>
                                        <span className={`font-mono font-bold ${winners['FULL_HOUSE'].length > 0 ? 'text-purple-400 animate-pulse' : 'text-slate-600'}`}>
                                            {winners['FULL_HOUSE'].length}
                                        </span>
                                    </div>
                                    {winners['FULL_HOUSE'].length > 0 && (
                                        <div className="px-2 py-1 flex flex-wrap gap-1.5">
                                            {winners['FULL_HOUSE'].map(id => (
                                                <span key={id} className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-md bg-purple-500/30 border border-purple-400/50 text-[10px] font-mono text-purple-300 font-black shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                                                    {id}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {winners['FULL_HOUSE'].length > 0 && (
                                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-3 text-center animate-bounce shadow-[0_0_20px_rgba(147,51,234,0.3)]">
                                    <div className="text-xs uppercase font-black text-white/70 mb-1">Winner Found!</div>
                                    <div className="font-bold text-white">Ticket #{winners['FULL_HOUSE'][0]}</div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                <Card title="🎵 Played History" className="lg:col-span-3">
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-700 pt-2 px-1">
                        {songHistory.slice().reverse().map((songId, idx) => {
                            const song = songs.find(s => s.id === songId);
                            const realIdx = songHistory.length - 1 - idx;
                            const isCurrentlyPlaying = realIdx === historyIndex;

                            if (!song) return null;
                            return (
                                <div
                                    key={`${songId}-${idx}`}
                                    className={`flex-shrink-0 w-56 p-4 rounded-xl border transition-all duration-300 ${isCurrentlyPlaying
                                        ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)] ring-1 ring-purple-500'
                                        : 'bg-slate-800 border-slate-700 opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-tighter self-start">
                                            #{realIdx + 1}
                                        </div>
                                        {isCurrentlyPlaying && (
                                            <div className="flex gap-0.5 h-3 items-end">
                                                <div className="w-1 bg-purple-400 animate-[music-bar_0.5s_ease-in-out_infinite]" />
                                                <div className="w-1 bg-purple-400 animate-[music-bar_0.7s_ease-in-out_infinite]" />
                                                <div className="w-1 bg-purple-400 animate-[music-bar_0.6s_ease-in-out_infinite]" />
                                            </div>
                                        )}
                                    </div>
                                    <div className={`font-bold truncate ${isCurrentlyPlaying ? 'text-purple-300' : 'text-slate-200'}`}>{song.artist}</div>
                                    <div className="text-xs text-slate-400 truncate mt-0.5">{song.title}</div>
                                </div>
                            );
                        })}
                        {songHistory.length === 0 && (
                            <div className="text-slate-600 italic py-8 text-center w-full">No songs played in this session yet.</div>
                        )}
                    </div>
                </Card>
            </div >

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes music-bar {
                    0%, 100% { height: 4px; }
                    50% { height: 12px; }
                }
                @keyframes chase-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}}
            />
        </div >
    );
};