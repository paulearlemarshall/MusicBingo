import fs from 'node:fs';
import path from 'node:path';
import NodeID3 from 'node-id3';

export interface AudioFileMetadata {
    filePath: string;
    artist: string;
    title: string;
    albumArtist?: string;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    fileSize?: number;
}

export class FolderScanner {
    static async scan(folderPath: string): Promise<AudioFileMetadata[]> {
        const results: AudioFileMetadata[] = [];

        if (!fs.existsSync(folderPath)) {
            return [];
        }

        const files = await this.getFilesRecursively(folderPath);
        const audioFiles = files.filter(f => /\.(mp3|wav|ogg)$/i.test(f));

        for (const file of audioFiles) {
            const stats = fs.statSync(file);
            const tags: any = NodeID3.read(file) || {};

            // Fallback if tags are missing
            const filename = path.basename(file, path.extname(file));
            let artist = "Unknown Artist";
            let title = filename;

            if (tags.artist) artist = tags.artist;
            if (tags.title) title = tags.title;
            else {
                // Try filename parsing "Artist - Title"
                if (filename.includes(' - ')) {
                    const parts = filename.split(' - ');
                    artist = parts[0].trim();
                    title = parts.slice(1).join(' - ').trim();
                }
            }

            // Extract Album Artist (performerInfo in node-id3)
            let albumArtist = undefined;
            if (tags.performerInfo) {
                albumArtist = typeof tags.performerInfo === 'string' ? tags.performerInfo : tags.performerInfo.text;
            }

            // Extract technical info manually from MP3 header
            const tech = this.getMp3TechInfo(file);

            results.push({
                filePath: file,
                artist,
                title,
                albumArtist,
                fileSize: stats.size,
                bitrate: tech.bitrate,
                sampleRate: tech.sampleRate,
                channels: tech.channels
            });
        }

        return results;
    }

    /**
     * Attempts to read technical info (bitrate, samplerate, channels) 
     * by parsing the first MPEG frame header found in the file.
     */
    private static getMp3TechInfo(filePath: string): { bitrate?: number, sampleRate?: number, channels?: number } {
        try {
            const buffer = Buffer.alloc(4096);
            const fd = fs.openSync(filePath, 'r');
            fs.readSync(fd, buffer, 0, 4096, 0);
            fs.closeSync(fd);

            // Find sync word (0xFFE or 0xFFF)
            let offset = 0;
            while (offset < buffer.length - 4) {
                if (buffer[offset] === 0xFF && (buffer[offset + 1] & 0xE0) === 0xE0) {
                    const header = buffer.readUInt32BE(offset);
                    
                    // Bitrate Table (Layer 3, Version 1)
                    const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
                    const samplerates = [44100, 48000, 32000, 0];
                    
                    const bitrateIdx = (header >> 12) & 0xF;
                    const samplerateIdx = (header >> 10) & 0x3;
                    const modeIdx = (header >> 6) & 0x3;

                    return {
                        bitrate: bitrates[bitrateIdx] * 1000,
                        sampleRate: samplerates[samplerateIdx],
                        channels: modeIdx === 3 ? 1 : 2 // Mode 3 is Mono
                    };
                }
                offset++;
            }
        } catch (e) {
            console.error(`Failed to parse MP3 header for ${filePath}`, e);
        }
        return {};
    }

    private static async getFilesRecursively(dir: string): Promise<string[]> {
        const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
        const files = await Promise.all(dirents.map((dirent) => {
            const res = path.resolve(dir, dirent.name);
            return dirent.isDirectory() ? this.getFilesRecursively(res) : res;
        }));
        return Array.prototype.concat(...files);
    }
}
