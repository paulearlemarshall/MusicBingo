import React, { useEffect, useRef, useState } from 'react';
import { Howl } from 'howler';
import { useGame } from '../../context/GameContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TicketChecker } from '../TicketCheck/TicketChecker';

export const GameControlPanel: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { currentSong, isPlaying, playNext, replayPrevious, togglePause, volume, setVolume, historyIndex } = useGame();
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const soundRef = useRef<Howl | null>(null);
    const [showTicketChecker, setShowTicketChecker] = useState(false);

    useEffect(() => {
        if (currentSong) {
            if (soundRef.current) {
                soundRef.current.unload();
            }

            const normalizedPath = currentSong.filePath.replace(/\\/g, '/');
            const mediaUrl = `media://local/${encodeURIComponent(normalizedPath)}`;

            const sound = new Howl({
                src: [mediaUrl], // Howler handles file paths in Electron if allowed
                html5: true, // Force HTML5 Audio to stream huge files
                format: ['mp3', 'wav', 'ogg'],
                volume: volume,
                onplay: () => {
                    setDuration(sound.duration());
                    requestAnimationFrame(step);
                },
                onend: () => {
                    // Auto play next? Or stop?
                    // Usually Bingo pauses.
                }
            });

            soundRef.current = sound;
            if (isPlaying) {
                sound.play();
            }
        }

        return () => {
            soundRef.current?.unload();
        };
    }, [currentSong]);

    useEffect(() => {
        if (soundRef.current) {
            if (isPlaying && !soundRef.current.playing()) {
                soundRef.current.play();
            } else if (!isPlaying && soundRef.current.playing()) {
                soundRef.current.pause();
            }
        }
    }, [isPlaying]);

    useEffect(() => {
        if (soundRef.current) {
            soundRef.current.volume(volume);
        }
    }, [volume]);

    const step = () => {
        if (soundRef.current && soundRef.current.playing()) {
            setProgress(soundRef.current.seek());
            requestAnimationFrame(step);
        }
    };

    const handleFadeOut = () => {
        soundRef.current?.fade(volume, 0, 2000);
        setTimeout(() => togglePause(), 2000);
    };

    const formatTime = (secs: number) => {
        const minutes = Math.floor(secs / 60);
        const seconds = Math.floor(secs % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <Button variant="secondary" size="sm" onClick={onBack}>Back to Dashboard</Button>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">DJ Booth</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card title="Now Playing">
                    {currentSong ? (
                        <div className="text-center py-8">
                            <h3 className="text-3xl font-bold text-white mb-2">{currentSong.title}</h3>
                            <p className="text-xl text-purple-400">{currentSong.artist}</p>

                            <div className="mt-8 bg-slate-700/50 rounded-full h-2 overflow-hidden mx-auto max-w-md relative">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-100 ease-linear"
                                    style={{ width: `${(progress / duration) * 100}%` }}
                                />
                            </div>
                            <div className="flex justify-between max-w-md mx-auto mt-2 text-sm text-slate-400">
                                <span>{formatTime(progress)}</span>
                                <span>{formatTime(duration)}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500">
                            Waiting for next song...
                        </div>
                    )}
                </Card>

                <Card title="Controls">
                    <div className="grid grid-cols-2 gap-4">
                        <Button onClick={playNext} className="col-span-2 text-lg">
                            {currentSong ? `Next Song (#${historyIndex + 2})` : 'Start Playing'}
                        </Button>

                        <Button variant="secondary" onClick={togglePause} disabled={!currentSong}>
                            {isPlaying ? 'Pause' : 'Resume'}
                        </Button>

                        <Button variant="secondary" onClick={replayPrevious} disabled={historyIndex <= 0}>
                            Replay Previous
                        </Button>

                        <Button variant="danger" onClick={handleFadeOut} disabled={!currentSong} className="col-span-2">
                            Fade Out
                        </Button>

                        <div className="col-span-2 mt-4 bg-slate-700/30 p-4 rounded-xl">
                            <label className="text-slate-400 text-sm mb-2 block font-bold">Volume: {Math.round(volume * 100)}%</label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={volume}
                                onChange={(e) => setVolume(parseFloat(e.target.value))}
                                className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>

                        <Button variant="primary" className="col-span-2 mt-2" onClick={() => setShowTicketChecker(true)}>
                            Manual Ticket Check 🔍
                        </Button>
                    </div>
                </Card>
            </div>

            {showTicketChecker && (
                <TicketChecker onClose={() => setShowTicketChecker(false)} />
            )}
        </div>
    );
};
