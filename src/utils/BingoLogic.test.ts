import { expect, test, describe } from 'vitest';
import { BingoGameLogic, Song } from './BingoLogic';

// Mock Songs (need 20)
const mockSongs: Song[] = Array.from({ length: 25 }, (_, i) => ({
    id: `song-${i}`,
    artist: `Artist ${i}`,
    title: `Title ${i}`,
    filePath: `/path/to/song-${i}.mp3`
}));

describe('BingoGameLogic', () => {
    test('generateTicket creates valid 5x5 grid', () => {
        const ticket = BingoGameLogic.generateTicket(mockSongs, 5);
        expect(ticket.grid.length).toBe(5);
        expect(ticket.grid[0].length).toBe(5);

        // Flatten grid to check uniqueness
        const allSongIds = ticket.grid.flat().map(c => c.song.id);
        const uniqueIds = new Set(allSongIds);
        expect(uniqueIds.size).toBe(25);
    });

    test('checkWins detects 1 Line (Horizontal)', () => {
        const ticket = BingoGameLogic.generateTicket(mockSongs, 5);
        const played = new Set<string>();

        // Mark first row
        ticket.grid[0].forEach(cell => played.add(cell.song.id));

        const result = BingoGameLogic.checkWins(ticket, played);
        expect(result).toContain('1_LINE');
    });

    test('checkWins detects 1 Line (Vertical)', () => {
        const ticket = BingoGameLogic.generateTicket(mockSongs, 5);
        const played = new Set<string>();

        // Mark first column
        for (let r = 0; r < 5; r++) {
            played.add(ticket.grid[r][0].song.id);
        }

        const result = BingoGameLogic.checkWins(ticket, played);
        expect(result).toContain('1_LINE');
    });

    test('checkWins detects 2 Lines (Horizontal)', () => {
        const ticket = BingoGameLogic.generateTicket(mockSongs, 5);
        const played = new Set<string>();

        // Mark row 0 and row 1
        ticket.grid[0].forEach(cell => played.add(cell.song.id));
        ticket.grid[1].forEach(cell => played.add(cell.song.id));

        const result = BingoGameLogic.checkWins(ticket, played);
        expect(result).toContain('2_LINES');
        expect(result).toContain('1_LINE');
    });

    test('checkWins detects Full House', () => {
        const ticket = BingoGameLogic.generateTicket(mockSongs, 5);
        const played = new Set<string>();

        // Mark all
        ticket.grid.flat().forEach(cell => played.add(cell.song.id));

        const result = BingoGameLogic.checkWins(ticket, played);
        expect(result).toContain('FULL_HOUSE');
    });
});
