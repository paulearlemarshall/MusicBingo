import React, { useState, useEffect } from 'react';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { MiniPlayer } from './MiniPlayer';
import { Loader2, Tag as TagIcon, Save, X } from 'lucide-react';
import { Song } from '../../utils/BingoLogic';

const TagEditor: React.FC<{ song: Song; onClose: () => void; onSave: (updatedSong: Partial<Song>) => void }> = ({ song, onClose, onSave }) => {
    const [tags, setTags] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const loadTags = async () => {
            try {
                console.log(`[TagEditor] Loading tags for: ${song.filePath}`);
                // @ts-ignore
                const result = await window.ipcRenderer.invoke('tags:read', song.filePath);
                console.log("[TagEditor] Received tags:", result);
                setTags(result || {});
            } catch (e) {
                console.error("Failed to load tags", e);
                setTags({});
            } finally {
                setLoading(false);
            }
        };
        loadTags();
    }, [song.filePath]);

    const handleSave = async () => {
        setSaving(true);
        try {
            // @ts-ignore
            const success = await window.ipcRenderer.invoke('tags:save', { 
                filePath: song.filePath, 
                tags: tags 
            });

            if (success) {
                // Determine what to update in our internal list
                onSave({
                    title: typeof tags.title === 'string' ? tags.title : song.title,
                    artist: typeof tags.artist === 'string' ? tags.artist : song.artist,
                    albumArtist: typeof tags.performerInfo === 'string' ? tags.performerInfo : 
                                (typeof tags.performerInfo === 'object' ? tags.performerInfo.text : undefined)
                });
                onClose();
            } else {
                alert("Failed to save tags to file.");
            }
        } catch (e) {
            console.error("Save tags error", e);
            alert("An error occurred while saving tags.");
        } finally {
            setSaving(false);
        }
    };

    const getDisplayValue = (key: string) => {
        const val = tags[key];
        if (val === undefined || val === null) return '';
        if (typeof val === 'object') {
            // node-id3 often puts strings inside { text: "..." } for comments/etc
            if (val.text !== undefined) return val.text;
            return JSON.stringify(val);
        }
        return String(val);
    };

    const handleValueChange = (key: string, value: string) => {
        const currentVal = tags[key];
        if (typeof currentVal === 'object' && currentVal !== null && currentVal.text !== undefined) {
            setTags({
                ...tags,
                [key]: { ...currentVal, text: value }
            });
        } else {
            setTags({ ...tags, [key]: value });
        }
    };

    if (loading) return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center">
            <Card className="p-12 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-pink-500" size={48} />
                <div className="text-slate-400 font-bold animate-pulse">Reading ID3 Data...</div>
            </Card>
        </div>
    );

    // Standard keys we always want to show
    const standardKeys = ['title', 'artist', 'performerInfo', 'album', 'year', 'genre', 'comment'];
    
    // Found keys from the file (filtered)
    const foundKeys = Object.keys(tags || {})
        .filter(k => !['raw', 'image', 'fileUrl', 'userDefinedText', 'chapter', 'tableOfContents'].includes(k));

    // Merge them together ensuring uniqueness
    const allKeys = Array.from(new Set([...standardKeys, ...foundKeys]))
        .sort((a, b) => {
            // Prioritize common tags
            const priority = { title: 1, artist: 2, performerInfo: 3, album: 4, year: 5, genre: 6, comment: 7 };
            const pA = priority[a as keyof typeof priority] || 99;
            const pB = priority[b as keyof typeof priority] || 99;
            if (pA !== pB) return pA - pB;
            return a.localeCompare(b);
        });

    const getFieldLabel = (key: string) => {
        if (key === 'performerInfo') return 'Album Artist';
        return key.charAt(0).toUpperCase() + key.slice(1);
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <Card className="w-full max-w-2xl shadow-2xl border-slate-700 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6 border-b border-slate-700 p-6">
                    <div className="flex items-center gap-2">
                        <TagIcon className="text-pink-500" size={24} />
                        <h3 className="text-2xl font-bold text-white">Advanced Tag Editor</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={28} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-700 pb-6">
                    <div className="text-[10px] font-mono text-slate-500 break-all bg-slate-900 p-3 rounded-lg border border-slate-800">
                        <span className="text-pink-500 font-bold mr-2">SOURCE:</span> {song.filePath}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {allKeys.length > 0 ? allKeys.map(key => (
                            <div key={key} className={`space-y-1 ${['title', 'artist', 'performerInfo', 'album', 'comment'].includes(key) ? 'md:col-span-2' : ''}`}>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
                                    {getFieldLabel(key)}
                                </label>
                                <input
                                    type="text"
                                    value={getDisplayValue(key)}
                                    onChange={e => handleValueChange(key, e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-pink-500/50 outline-none transition-all hover:border-slate-600"
                                    placeholder={`Value for ${key}...`}
                                />
                            </div>
                        )) : (
                            <div className="md:col-span-2 py-12 text-center text-slate-500 italic">
                                No editable tags found in this file.
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex gap-4 p-6 border-t border-slate-700 bg-slate-900/50">
                    <Button variant="secondary" onClick={onClose} className="flex-1" disabled={saving}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave} className="flex-1 flex items-center justify-center gap-2" disabled={saving}>
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {saving ? 'Saving...' : 'Write to File'}
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export const MediaControl: React.FC = () => {
    const { songs, addSongs, removeSong, updateSong, activeFolder, setActiveFolder, clearLibrary } = useGame();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [editingSong, setEditingSong] = useState<Song | null>(null);

    const handleClearLibrary = () => {
        if (confirm("Are you sure you want to clear the entire library? This will also reset the active folder and any generated tickets.")) {
            clearLibrary();
        }
    };

    const getAudioTechInfo = (filePath: string): Promise<{ duration: number, sampleRate: number, channels: number }> => {
        return new Promise((resolve) => {
            const sound = new Howl({
                src: [`media://local/${encodeURIComponent(filePath.replace(/\\/g, '/'))}`],
                html5: true, // Use HTML5 to avoid full decode just for headers
                onload: () => {
                    // @ts-ignore - reaching into Howler internals or using Web Audio if available
                    const node = sound._sounds[0]?._node;
                    const sampleRate = node?.context?.sampleRate || 44100;
                    const channels = node?.channelCount || 2;
                    const duration = sound.duration();
                    sound.unload();
                    resolve({ duration, sampleRate, channels });
                },
                onloaderror: () => {
                    resolve({ duration: 0, sampleRate: 0, channels: 0 });
                }
            });
        });
    };

    const processPaths = async (scannedFiles: any[]) => {
        console.log(`[MediaControl] Processing ${scannedFiles.length} files...`);
        setIsAnalyzing(true);

        const folderCuesCache: Record<string, any> = {};

        const newSongs = await Promise.all(scannedFiles.map(async (file: any) => {
            const path = typeof file === 'string' ? file : file.filePath;
            const filename = path.split('\\').pop()?.split('/').pop() || '';
            const namePart = filename.replace(/\.[^/.]+$/, "");

            let artist = typeof file === 'object' ? file.artist : "Unknown Artist";
            let title = typeof file === 'object' ? file.title : namePart;

            if (typeof file === 'string') {
                if (namePart.includes(' - ')) {
                    let parts = namePart.split(' - ');

                    // If the first part is just a track number (e.g. "36 - ..."), discard it
                    if (parts.length >= 2 && /^\d+$/.test(parts[0].trim())) {
                        parts = parts.slice(1);
                    }

                    if (parts.length >= 2) {
                        artist = parts[0].replace(/^\d+[\s.-]+/, "").trim() || "Unknown Artist";
                        title = parts.slice(1).join(' - ').replace(/^\d+[\s.-]+/, "").trim();
                    } else {
                        artist = "Unknown Artist";
                        title = parts[0].replace(/^\d+[\s.-]+/, "").trim();
                    }
                } else {
                    title = namePart.replace(/^\d+[\s.-]+/, "").trim();
                }
            }

            // Load cues for this file
            const songFolder = path.substring(0, path.lastIndexOf('\\'));
            if (!folderCuesCache[songFolder]) {
                try {
                    // @ts-ignore
                    folderCuesCache[songFolder] = await window.ipcRenderer.invoke('cues:load', songFolder);
                } catch {
                    folderCuesCache[songFolder] = {};
                }
            }
            const cue = folderCuesCache[songFolder][filename] || {};

            // Fetch technical info using Howler
            const tech = await getAudioTechInfo(path);
            
            // Estimate bitrate: (bytes * 8) / duration
            let bitrate = undefined;
            if (tech.duration > 0 && file.fileSize) {
                bitrate = Math.round((file.fileSize * 8) / tech.duration);
            }

            return {
                id: path, // Stable ID based on file path
                filePath: path,
                artist: artist,
                title: title,
                startTime: cue.startTime,
                endTime: cue.endTime,
                duration: tech.duration || cue.duration,
                albumArtist: typeof file === 'object' ? file.albumArtist : undefined,
                bitrate: bitrate,
                sampleRate: tech.sampleRate,
                channels: tech.channels
            };
        }));

        if (newSongs.length > 0) {
            console.log(`[MediaControl] Adding ${newSongs.length} songs to library`);
            addSongs(newSongs);
            console.log("[MediaControl] Success adding to library. Cues loaded.");
        }
        setIsAnalyzing(false);
    };

    const handleSaveAllCues = async () => {
        setIsAnalyzing(true);
        try {
            // Group songs by folder
            const folders: Record<string, any[]> = {};
            songs.forEach(song => {
                const folderPath = song.filePath.substring(0, song.filePath.lastIndexOf('\\'));
                if (!folders[folderPath]) folders[folderPath] = [];
                folders[folderPath].push(song);
            });

            // Save each folder's cues
            for (const folderPath in folders) {
                const folderSongs = folders[folderPath];

                // Load existing cues to merge (optional, but safer)
                // @ts-ignore
                const existingCues = await window.ipcRenderer.invoke('cues:load', folderPath);

                folderSongs.forEach(song => {
                    const fileName = song.filePath.split('\\').pop() || '';
                    existingCues[fileName] = {
                        startTime: song.startTime,
                        endTime: song.endTime
                    };
                });

                // @ts-ignore
                await window.ipcRenderer.invoke('cues:save', { folderPath, cues: existingCues });
            }
            alert("All cue points have been saved successfully!");
        } catch (e) {
            console.error("[MediaControl] handleSaveAllCues ERROR:", e);
            alert("Failed to save all cues.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleImportFolder = async () => {
        console.log("[MediaControl] handleImportFolder clicked");
        try {
            // @ts-ignore
            const folderPath = await window.ipcRenderer.invoke('dialog:openFolder');
            console.log(`[MediaControl] IPC dialog:openFolder returned: ${folderPath}`);
            if (folderPath) {
                // @ts-ignore
                const scannedSongs = await window.ipcRenderer.invoke('library:scanFolder', folderPath);
                console.log(`[MediaControl] IPC library:scanFolder found ${scannedSongs?.length || 0} songs`);

                if (scannedSongs && scannedSongs.length > 0) {
                    await processPaths(scannedSongs);
                    console.log("[MediaControl] Folder Import Success.");
                    setActiveFolder(folderPath);
                } else {
                    console.warn("[MediaControl] No songs discovered in selected folder.");
                    alert("No MP3/WAV/OGG files found in that folder.");
                }
            }
        } catch (e) {
            console.error("[MediaControl] handleImportFolder ERROR:", e);
            alert("Failed to import folder");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6 h-full overflow-y-auto">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Media Control</h2>
                    <p className="text-slate-400 mt-1">Manage your music library and analyze tracks.</p>
                </div>
                {isAnalyzing && (
                    <div className="flex items-center gap-2 text-blue-400 text-sm font-medium animate-pulse">
                        <Loader2 className="animate-spin" size={16} />
                        Analyzing metadata...
                    </div>
                )}
            </header>

            <Card>
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-slate-400 font-medium mb-1">{songs.length} songs in library</div>
                            <div className="text-sm font-medium">
                                <span className="text-slate-500">Active Folder:</span>
                                <span className="text-slate-200 font-mono ml-2 px-2 py-0.5 bg-slate-800 rounded border border-slate-700">{activeFolder || '(default) none'}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={handleSaveAllCues}
                            disabled={songs.length === 0 || isAnalyzing}
                            className="bg-emerald-600 hover:bg-emerald-700 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        >
                            💾 Save All Cues
                        </Button>
                        <Button onClick={handleImportFolder} disabled={isAnalyzing}>Set Game Folder and Import</Button>
                        <Button variant="danger" onClick={handleClearLibrary} disabled={songs.length === 0 || isAnalyzing}>Clear Library</Button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-700/50">
                    <table className="w-full text-left text-slate-300 relative">
                        <thead className="text-xs uppercase bg-slate-800 text-slate-400 sticky top-0 z-10 shadow-lg">
                            <tr>
                                <th className="px-6 py-4">Track Information & Cue Controls</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50 bg-slate-800/20">
                            {songs.map(song => (
                                <tr key={song.id} className="hover:bg-slate-700/10 transition-colors">
                                    <td className="px-6 py-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <div className="font-bold text-lg text-white">{song.title}</div>
                                                <div className="flex items-center gap-3 text-sm text-slate-400">
                                                    <span className="font-medium text-slate-300">{song.artist}</span>
                                                    {song.albumArtist && (
                                                        <span className="text-[10px] bg-slate-700/50 px-1.5 py-0.5 rounded border border-slate-600 italic">
                                                            AA: {song.albumArtist}
                                                        </span>
                                                    )}
                                                    <div className="flex items-center gap-2 ml-4 text-[10px] font-mono text-slate-500 bg-slate-950/50 px-2 py-0.5 rounded">
                                                        {song.bitrate && <span>{Math.round(song.bitrate / 1000)}kbps</span>}
                                                        {song.sampleRate && <span>{song.sampleRate / 1000}kHz</span>}
                                                        {song.channels && <span>{song.channels === 2 ? 'Stereo' : song.channels === 1 ? 'Mono' : song.channels + 'ch'}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <MiniPlayer song={song} />
                                    </td>
                                    <td className="px-6 py-6 text-right align-top">
                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => setEditingSong(song)}
                                                className="text-indigo-400 hover:text-indigo-300 text-sm font-bold bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1 rounded transition-all"
                                            >
                                                Tag
                                            </button>
                                            <button
                                                onClick={() => removeSong(song.id)}
                                                className="text-rose-400 hover:text-rose-300 text-sm font-bold bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1 rounded transition-all"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {songs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        No songs in library. Click "Import Folder" to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {editingSong && (
                <TagEditor 
                    song={editingSong} 
                    onClose={() => setEditingSong(null)} 
                    onSave={(updates) => updateSong(editingSong.id, updates)} 
                />
            )}
        </div>
    );
};