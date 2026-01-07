import { v4 as uuidv4 } from 'uuid';

export interface Song {
    id: string;
    artist: string;
    title: string;
    filePath: string;
    duration?: number;
    startTime?: number; // Cues
    endTime?: number;   // Cues
    albumArtist?: string;
    bitrate?: number;
    channels?: number;
    sampleRate?: number;
}

export interface BingoGridCell {
    song: Song;
    marked: boolean;
}

export interface BingoTicket {
    id: string; // Unique Ticket ID
    grid: BingoGridCell[][]; // 5 rows x 5 columns
}

export type WinType = '1_LINE' | '2_LINES' | 'FOUR_CORNERS' | 'FULL_HOUSE' | null;

export class BingoGameLogic {
    // ... (rest of the class)


    /**
     * Calculates "n choose r" (nCr) - how many combinations of r items can be chosen from a set of n.
     * This is optimized to avoid large intermediate numbers from factorials.
     */
    private static combinations(n: number, r: number): number {
        if (r < 0 || r > n) {
            return 0;
        }
        if (r === 0 || r === n) {
            return 1;
        }
        // symmetry: C(n, k) === C(n, n-k)
        if (r > n / 2) {
            r = n - r;
        }
    
        let res = 1;
        for (let i = 1; i <= r; i++) {
            // (n - i + 1) is equivalent to (n-k+1)...(n) in the formula
            res = res * (n - i + 1) / i;

            // Safety cap for huge numbers that might break UI
            if (res > 1_000_000) return 1_000_000;
        }
        return Math.floor(res);
    }

    static generateTicket(catalog: Song[], gridSize: number, id?: string): BingoTicket {
        const requiredSongs = gridSize * gridSize;
        if (catalog.length < requiredSongs) {
            throw new Error(`Catalog must have at least ${requiredSongs} songs to generate a ${gridSize}x${gridSize} ticket.`);
        }

        // Shuffle catalog
        const shuffled = [...catalog].sort(() => 0.5 - Math.random());
        const selectedSongs = shuffled.slice(0, requiredSongs);

        const grid: BingoGridCell[][] = [];
        let songIndex = 0;

        for (let r = 0; r < gridSize; r++) {
            const row: BingoGridCell[] = [];
            for (let c = 0; c < gridSize; c++) {
                row.push({
                    song: selectedSongs[songIndex],
                    marked: false
                });
                songIndex++;
            }
            grid.push(row);
        }

        return {
            id: id || uuidv4(),
            grid
        };
    }

    static checkWins(ticket: BingoTicket, playedSongIds: Set<string>): WinType[] {
        const wins: WinType[] = [];
        const grid = ticket.grid;
        if (!grid || grid.length === 0) return wins;
        
        const rows = grid.length;
        const cols = grid[0].length;

        // Check Rows
        let horizontalLines = 0;
        for (let r = 0; r < rows; r++) {
            if (grid[r].every(cell => playedSongIds.has(cell.song.id))) {
                horizontalLines++;
            }
        }

        // Check Columns
        let verticalLines = 0;
        for (let c = 0; c < cols; c++) {
            let colComplete = true;
            for (let r = 0; r < rows; r++) {
                if (!playedSongIds.has(grid[r][c].song.id)) {
                    colComplete = false;
                    break;
                }
            }
            if (colComplete) verticalLines++;
        }

        // Diagonals - only for square grids
        let diagonalLines = 0;
        if (rows === cols) {
            // Top-left to bottom-right
            let diag1Complete = true;
            for(let i = 0; i < rows; i++) {
                if(!playedSongIds.has(grid[i][i].song.id)) {
                    diag1Complete = false;
                    break;
                }
            }
            if(diag1Complete) diagonalLines++;

            // Top-right to bottom-left
            let diag2Complete = true;
            for(let i = 0; i < rows; i++) {
                if(!playedSongIds.has(grid[i][rows - 1 - i].song.id)) {
                    diag2Complete = false;
                    break;
                }
            }
            if(diag2Complete) diagonalLines++;
        }

        const totalLines = horizontalLines + verticalLines + diagonalLines;

        // Check Four Corners
        let fourCorners = false;
        if (rows >= 2 && cols >= 2) {
            const topLeft = grid[0][0].song.id;
            const topRight = grid[0][cols - 1].song.id;
            const bottomLeft = grid[rows - 1][0].song.id;
            const bottomRight = grid[rows - 1][cols - 1].song.id;

            if (playedSongIds.has(topLeft) && 
                playedSongIds.has(topRight) && 
                playedSongIds.has(bottomLeft) && 
                playedSongIds.has(bottomRight)) {
                fourCorners = true;
            }
        }

        // Check Full House
        const allMarked = grid.every(row => row.every(cell => playedSongIds.has(cell.song.id)));

        // Add to array - preserve all met conditions
        if (totalLines >= 1) wins.push('1_LINE');
        if (totalLines >= 2) wins.push('2_LINES');
        if (fourCorners) wins.push('FOUR_CORNERS');
        if (allMarked) wins.push('FULL_HOUSE');

        return wins;
    }

    /**
     * Calculates the maximum number of unique tickets 
     * possible from a given catalog size using combinations (nCr).
     */
    static calculateSafeMax(catalogSize: number, gridSize: number): number {
        const requiredSongs = gridSize * gridSize;
        if (catalogSize < requiredSongs) return 0;
        
        return BingoGameLogic.combinations(catalogSize, requiredSongs);
    }
}
