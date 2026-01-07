import { analyze } from 'web-audio-beat-detector';

export async function analyzeBPM(filePath: string): Promise<{ bpm: number; duration: number }> {
    console.log(`[AudioAnalysis] Starting analysis for: ${filePath}`);

    try {
        const mediaUrl = `media://local/${encodeURIComponent(filePath)}`;
        console.log(`[AudioAnalysis] Fetching URL: ${mediaUrl}`);

        const response = await fetch(mediaUrl);
        if (!response.ok) {
            const err = `Fetch failed: ${response.statusText} (${response.status})`;
            console.error(`[AudioAnalysis] ERROR for ${filePath}: ${err}`);
            throw new Error(err);
        }

        const buffer = await response.arrayBuffer();
        console.log(`[AudioAnalysis] Received ${buffer.byteLength} bytes. Starting decode with OfflineAudioContext...`);

        // We decode once to get metadata, then analyze. 
        // Using a temporary OfflineAudioContext is safer for background decoding 
        // as it avoids interfering with the main hardware audio context.
        const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

        const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Audio decoding timed out after 30 seconds"));
            }, 30000);

            tempCtx.decodeAudioData(buffer,
                (decoded) => {
                    clearTimeout(timeout);
                    resolve(decoded);
                },
                (err) => {
                    clearTimeout(timeout);
                    reject(err || new Error("Unknown decoding error"));
                }
            );
        });

        // Close the temporary context immediately to free up hardware resources
        await tempCtx.close();

        console.log(`[AudioAnalysis] Decode SUCCESS. Duration: ${audioBuffer.duration.toFixed(2)}s. Running BPM detector...`);
        const bpm = await analyze(audioBuffer);

        console.log(`[AudioAnalysis] FINISHED ${filePath}: ${Math.round(bpm)} BPM`);

        return {
            bpm: Math.round(bpm),
            duration: audioBuffer.duration
        };
    } catch (e) {
        console.error(`[AudioAnalysis] FAILED for ${filePath}:`, e);
        return { bpm: 0, duration: 0 };
    }
}
