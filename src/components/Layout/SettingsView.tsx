import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Play, Square } from 'lucide-react';

const EffectPreview: React.FC<{ filePath: string }> = ({ filePath }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [exists, setExists] = useState<boolean | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const checkFile = async () => {
            if (!filePath) {
                setExists(null);
                return;
            }
            try {
                // @ts-ignore
                const result = await window.ipcRenderer.invoke('file:exists', filePath);
                setExists(result);
            } catch (e) {
                setExists(false);
            }
        };
        checkFile();
    }, [filePath]);

    const normalizedPath = filePath.replace(/\\/g, '/');
    const mediaUrl = `media://local/${encodeURIComponent(normalizedPath)}`;

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        } else {
            audioRef.current.play().catch(e => console.error("Playback failed", e));
            setIsPlaying(true);
        }
    };

    return (
        <div className="flex items-center gap-3">
            <span className={`text-sm ${exists === true ? 'text-emerald-500' : exists === false ? 'text-rose-500' : 'text-slate-500'}`}>
                {exists === true ? '✔️' : exists === false ? '❌' : ''}
            </span>
            <audio
                ref={audioRef}
                src={mediaUrl}
                onEnded={() => setIsPlaying(false)}
            />
            {exists && (
                <button
                    onClick={togglePlay}
                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isPlaying
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                        }`}
                    title={isPlaying ? "Stop" : "Play Preview"}
                >
                    {isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                </button>
            )}
        </div>
    );
};

export const SettingsView: React.FC = () => {
    const {
        effects, updateEffects
    } = useGame();

    const [saving, setSaving] = useState(false);

    const handleFileSelect = async (type: 'win' | 'lose' | 'link' | 'suspense' | 'airhorn') => {
        try {
            // @ts-ignore
            const result = await window.ipcRenderer.invoke('dialog:openFile');
            if (result && result.length > 0) {
                const path = result[0];
                updateEffects({ [type]: path });
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // @ts-ignore
            await window.ipcRenderer.invoke('settings:save', {
                effects
            });
            // Show some visual feedback or temporary notification if possible
            setTimeout(() => setSaving(false), 1000);
        } catch (e) {
            console.error(e);
            setSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 h-full overflow-y-auto">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent">Application Settings</h2>
                    <p className="text-slate-400">Configure your session preferences and assets (Saved to settings.ini)</p>
                </div>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-8"
                >
                    {saving ? 'Saving...' : '💾 Save Settings'}
                </Button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                <Card title="Sound Effects (Audio Assets)">
                    <div className="space-y-4">
                        {[
                            { key: 'suspense', label: 'Suspense Effect', icon: '⏳' },
                            { key: 'win', label: 'Win Effect', icon: '🏆' },
                            { key: 'lose', label: 'Lose Effect', icon: '❌' },
                            { key: 'airhorn', label: 'Air Horn Effect', icon: '📢' },
                            { key: 'link', label: 'Link Effect', icon: '🔗' },
                        ].map(item => {
                            const filePath = effects[item.key as keyof typeof effects];
                            return (
                                <div key={item.key} className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-slate-200 font-bold">{item.icon} {item.label}</span>
                                            {filePath && <EffectPreview filePath={filePath} />}
                                        </div>
                                        <Button variant="secondary" size="sm" onClick={() => handleFileSelect(item.key as any)}>Load</Button>
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate font-mono bg-slate-950 p-2 rounded">
                                        {filePath || 'No file selected (using default silence)'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>
        </div>
    );
};

