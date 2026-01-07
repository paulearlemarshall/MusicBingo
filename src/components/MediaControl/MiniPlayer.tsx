import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { Song } from '../../utils/BingoLogic';
import { useGame } from '../../context/GameContext';

interface MiniPlayerProps {
    song: Song;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ song }) => {
    const { updateSongCues } = useGame();
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const railRef = useRef<HTMLDivElement | null>(null);
    const isSeeking = useRef(false);

    // Local state for text inputs
    const [startInput, setStartInput] = useState('0');
    const [endInput, setEndInput] = useState('0');

    // Compute effective start/end times
    const startTime = song.startTime ?? 0;
    const endTime = song.endTime ?? duration;

    // Sync local input state when song cues change
    useEffect(() => {
        setStartInput(startTime.toFixed(1));
    }, [startTime]);

    useEffect(() => {
        if (duration > 0) {
            setEndInput((song.endTime ?? duration).toFixed(1));
        }
    }, [song.endTime, duration]);

    const normalizedPath = song.filePath.replace(/\\/g, '/');
    const mediaUrl = `media://local/${encodeURIComponent(normalizedPath)}`;

    // Ref to store pending seek position when play starts
    const pendingSeek = useRef<number | null>(null);
    const seekCompleteTime = useRef<number>(0);

    const handlePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            // Read start time directly from song prop
            const targetTime = song.startTime ?? 0;
            console.log('[MiniPlayer] Play clicked, target:', targetTime);

            pendingSeek.current = targetTime;
            isSeeking.current = true;
            setProgress(targetTime);

            // Function to force seek with retries
            const forceSeek = (retries: number) => {
                if (!audio || retries <= 0) {
                    isSeeking.current = false;
                    pendingSeek.current = null;
                    return;
                }

                audio.currentTime = targetTime;
                console.log('[MiniPlayer] Set currentTime to:', targetTime, 'actual:', audio.currentTime);

                // Check if it worked after a short delay
                setTimeout(() => {
                    if (Math.abs(audio.currentTime - targetTime) > 0.5) {
                        console.log('[MiniPlayer] Seek failed, retrying... actual:', audio.currentTime);
                        forceSeek(retries - 1);
                    } else {
                        console.log('[MiniPlayer] Seek successful at:', audio.currentTime);
                        setProgress(audio.currentTime);
                        pendingSeek.current = null;
                        setTimeout(() => {
                            isSeeking.current = false;
                        }, 200);
                    }
                }, 100);
            };

            // Start playback
            audio.play().then(() => {
                setIsPlaying(true);
                // Try to seek with retries
                forceSeek(5);
            }).catch(err => {
                console.error('[MiniPlayer] Play error:', err);
                isSeeking.current = false;
                pendingSeek.current = null;
            });
        }
    };

    // Called when seek operation completes
    const handleSeeked = () => {
        const audio = audioRef.current;
        if (!audio) return;

        // If this was our pending seek, clear it and update progress
        if (pendingSeek.current !== null) {
            setProgress(audio.currentTime);
            pendingSeek.current = null;
            seekCompleteTime.current = Date.now();

            // Release seeking lock after a delay
            setTimeout(() => {
                isSeeking.current = false;
            }, 200);
        } else {
            // Normal user-initiated seek
            setProgress(audio.currentTime);
            seekCompleteTime.current = Date.now();
            setTimeout(() => {
                isSeeking.current = false;
            }, 100);
        }
    };

    const handleTimeUpdate = () => {
        const audio = audioRef.current;
        if (!audio) return;

        // Skip if we're seeking or just completed a seek
        if (isSeeking.current) return;
        if (Date.now() - seekCompleteTime.current < 300) return;

        const current = audio.currentTime;
        setProgress(current);

        // Auto-stop at endTime
        if (isPlaying && endTime > 0 && current >= endTime) {
            audio.pause();
            setIsPlaying(false);
        }
    };

    const handleLoadedMetadata = () => {
        const audio = audioRef.current;
        if (audio) {
            setDuration(audio.duration);
        }
    };

    // Click on the rail to preview a position
    const handleRailClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        const rail = railRef.current;
        if (!audio || !rail || !duration) return;

        // Prevent default and stop propagation
        e.preventDefault();
        e.stopPropagation();

        // Calculate click position
        const rect = rail.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const clickTime = Math.max(0, Math.min(percent * duration, duration));

        // Set seeking flag
        isSeeking.current = true;

        // Seek the audio
        audio.currentTime = clickTime;
        setProgress(clickTime);

        // Clear seeking flag after a short delay
        setTimeout(() => {
            isSeeking.current = false;
        }, 100);
    };

    // Commit start time from text input
    const commitStartTime = () => {
        const val = parseFloat(startInput);
        if (isNaN(val)) {
            setStartInput(startTime.toFixed(1));
            return;
        }
        const newStart = Math.max(0, Math.min(val, endTime - 0.1));
        updateSongCues(song, newStart, song.endTime ?? duration);
    };

    // Commit end time from text input
    const commitEndTime = () => {
        const val = parseFloat(endInput);
        if (isNaN(val)) {
            setEndInput(endTime.toFixed(1));
            return;
        }
        const newEnd = Math.max(startTime + 0.1, Math.min(val, duration));
        updateSongCues(song, song.startTime ?? 0, newEnd);
    };


    const formatTime = (time: number) => {
        if (isNaN(time) || time < 0) return "0:00.0";
        const mins = Math.floor(time / 60);
        const secs = Math.floor(time % 60);
        const ms = Math.floor((time % 1) * 10);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
    };

    return (
        <div className="flex flex-col gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-700/30 w-full">
            <audio
                ref={audioRef}
                src={mediaUrl}
                preload="auto"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onSeeked={handleSeeked}
                onEnded={() => setIsPlaying(false)}
            />

            {/* Main Player Controls */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handlePlay}
                    className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/20"
                    title={`Play from ${formatTime(startTime)} to ${formatTime(endTime)}`}
                >
                    {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                </button>

                {/* Progress Rail */}
                <div
                    ref={railRef}
                    className="flex-1 h-10 relative cursor-pointer group select-none"
                    onMouseDown={handleRailClick}
                >
                    {/* Background */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 bg-slate-800 rounded-full border border-slate-700/50" />

                    {/* Active Cue Range Highlight */}
                    {duration > 0 && (
                        <div
                            className="absolute top-1/2 -translate-y-1/2 h-3 bg-emerald-500/30 rounded-full pointer-events-none"
                            style={{
                                left: `${(startTime / duration) * 100}%`,
                                width: `${(((endTime || duration) - startTime) / duration) * 100}%`
                            }}
                        />
                    )}

                    {/* Progress Fill */}
                    {duration > 0 && (
                        <div
                            className="absolute top-1/2 -translate-y-1/2 h-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full pointer-events-none shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                            style={{ width: `${(progress / duration) * 100}%` }}
                        />
                    )}

                    {/* Start Marker */}
                    {duration > 0 && (
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-7 bg-emerald-400 rounded pointer-events-none shadow"
                            style={{ left: `calc(${(startTime / duration) * 100}% - 3px)` }}
                        />
                    )}

                    {/* End Marker */}
                    {duration > 0 && (
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-7 bg-rose-400 rounded pointer-events-none shadow"
                            style={{ left: `calc(${((endTime || duration) / duration) * 100}% - 3px)` }}
                        />
                    )}

                    {/* Playhead */}
                    {duration > 0 && (
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none border-2 border-indigo-500"
                            style={{ left: `calc(${(progress / duration) * 100}% - 8px)` }}
                        />
                    )}

                    {/* Time Display */}
                    <div className="absolute -bottom-5 left-0 text-xs text-slate-500 font-mono">
                        {formatTime(progress)}
                    </div>
                    <div className="absolute -bottom-5 right-0 text-xs text-slate-500 font-mono">
                        {formatTime(duration)}
                    </div>
                </div>
            </div>

            {/* Cue Point Controls */}
            <div className="mt-4 pt-4 border-t border-slate-700/50">
                <div className="flex justify-between items-center mb-3">
                    <div className="text-xs text-slate-500 uppercase font-bold">Cue Point Markers</div>
                </div>

                <div className="flex gap-8">
                    {/* Start Marker Control */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-4 h-4 bg-emerald-500 rounded-sm border border-white shadow" />
                            <span className="text-sm font-bold text-emerald-400">START @ {formatTime(startTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max={duration || 100}
                                step="0.1"
                                value={startTime}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const newStart = Math.min(val, endTime - 0.1);
                                    updateSongCues(song, newStart, song.endTime ?? duration);
                                }}
                                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <input
                                type="text"
                                value={startInput}
                                onChange={(e) => setStartInput(e.target.value)}
                                onBlur={commitStartTime}
                                onKeyDown={(e) => e.key === 'Enter' && commitStartTime()}
                                className="w-20 bg-slate-800 text-emerald-400 border border-slate-700 rounded px-2 py-1 text-center text-sm font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    {/* End Marker Control */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-4 h-4 bg-rose-500 rounded-sm border border-white shadow" />
                            <span className="text-sm font-bold text-rose-400">STOP @ {formatTime(endTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="0"
                                max={duration || 100}
                                step="0.1"
                                value={endTime}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    const newEnd = Math.max(val, startTime + 0.1);
                                    updateSongCues(song, song.startTime ?? 0, newEnd);
                                }}
                                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                            />
                            <input
                                type="text"
                                value={endInput}
                                onChange={(e) => setEndInput(e.target.value)}
                                onBlur={commitEndTime}
                                onKeyDown={(e) => e.key === 'Enter' && commitEndTime()}
                                className="w-20 bg-slate-800 text-rose-400 border border-slate-700 rounded px-2 py-1 text-center text-sm font-mono outline-none focus:ring-1 focus:ring-rose-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Segment Info */}
                <div className="mt-4 flex justify-center">
                    <span className="text-indigo-300 font-bold bg-indigo-500/20 px-4 py-2 rounded-lg border border-indigo-500/20">
                        Playing Segment: {formatTime(endTime - startTime)}
                    </span>
                </div>
            </div>
        </div>
    );
};
