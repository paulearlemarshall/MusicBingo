import React from 'react';
import { useGame } from '../../context/GameContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { v4 as uuidv4 } from 'uuid';

export const LibraryManager: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const {
        songs,
        addSongs,
        removeSong,
        clearLibrary,
        selectedSongIds,
        toggleSongSelection,
        selectAllSongs,
        deselectAllSongs
    } = useGame();

    const allSelected = songs.length > 0 && selectedSongIds.size === songs.length;
    const someSelected = selectedSongIds.size > 0 && selectedSongIds.size < songs.length;

    const handleToggleAll = () => {
        if (allSelected || someSelected) {
            deselectAllSongs();
        } else {
            selectAllSongs();
        }
    };

    const processPaths = (paths: string[]) => {
        const newSongs = paths.map((path: string) => {
            const filename = path.split('\\').pop()?.split('/').pop() || '';
            const namePart = filename.replace(/\.[^/.]+$/, "");

            let artist = "Unknown Artist";
            let title = namePart;

            if (namePart.includes(' - ')) {
                const parts = namePart.split(' - ');
                artist = parts[0];
                title = parts.slice(1).join(' - ');
            }

            return {
                id: uuidv4(),
                filePath: path,
                artist: artist,
                title: title
            };
        });

        if (newSongs.length > 0) {
            addSongs(newSongs);
        }
    };



    const handleGenerateDummy = async () => {
        try {
            // @ts-ignore
            const filePaths = await window.ipcRenderer.invoke('debug:generateDummyFiles');
            if (filePaths && filePaths.length > 0) {
                processPaths(filePaths);
                alert(`Generated and imported ${filePaths.length} dummy songs!`);
            }
        } catch (e) {
            console.error("Failed to generate dummy files", e);
            alert("Failed to generate dummy files");
        }
    };

    const handleImportFolder = async () => {
        try {
            // @ts-ignore
            const folderPath = await window.ipcRenderer.invoke('dialog:openFolder');
            if (folderPath) {
                // @ts-ignore
                const scannedSongs = await window.ipcRenderer.invoke('library:scanFolder', folderPath);

                const newSongs = scannedSongs.map((s: any) => ({
                    id: uuidv4(),
                    filePath: s.filePath,
                    artist: s.artist,
                    title: s.title
                }));

                if (newSongs.length > 0) {
                    addSongs(newSongs);
                    alert(`Imported ${newSongs.length} songs from folder!`);
                } else {
                    alert("No MP3/WAV/OGG files found in that folder.");
                }
            }
        } catch (e) {
            console.error("Failed to import folder", e);
            alert("Failed to import folder");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-white">Music Library</h2>
                <Button variant="secondary" size="sm" onClick={onBack}>Back to Dashboard</Button>
            </div>

            <Card>
                <div className="flex justify-between items-center mb-6">
                    <div className="text-slate-400">
                        {songs.length} songs in library
                        {selectedSongIds.size > 0 && (
                            <span className="ml-4 text-emerald-400 font-semibold">
                                {selectedSongIds.size} selected
                            </span>
                        )}
                    </div>
                    <div className="space-x-4">
                        <Button variant="secondary" onClick={handleGenerateDummy}>Debug: Gen 60 Dummy Songs</Button>
                        <Button onClick={handleImportFolder}>Import Folder</Button>
                        <Button variant="danger" onClick={() => {
                            if (confirm("Clear all songs and tickets?")) clearLibrary();
                        }}>Clear All</Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-slate-300">
                        <thead className="text-xs uppercase bg-slate-700/50 text-slate-400">
                            <tr>
                                <th className="px-4 py-3 w-12">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        ref={input => {
                                            if (input) input.indeterminate = someSelected;
                                        }}
                                        onChange={handleToggleAll}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                                    />
                                </th>
                                <th className="px-6 py-3">Artist</th>
                                <th className="px-6 py-3">Title</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {songs.map(song => (
                                <tr key={song.id} className="hover:bg-slate-700/30">
                                    <td className="px-4 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedSongIds.has(song.id)}
                                            onChange={() => toggleSongSelection(song.id)}
                                            className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium text-white">{song.artist}</td>
                                    <td className="px-6 py-4">{song.title}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => removeSong(song.id)}
                                            className="text-red-400 hover:text-red-300 text-sm font-semibold"
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {songs.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                        No songs in library. Click "Add Songs" to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};
