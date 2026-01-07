# Music Bingo - Claude Code Documentation

## Project Overview

Music Bingo is an Electron-based desktop application for managing and hosting music bingo games. The application allows users to create bingo tickets from their music library, play songs with custom cue points, and manage the game flow with built-in sound effects.

## Technology Stack

### Frontend
- **React 18.2** with TypeScript
- **Vite 5.0** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library
- **Howler.js** - Audio playback engine

### Backend/Desktop
- **Electron 28** - Desktop application framework
- **Node.js** - Runtime environment
- **TypeScript** - Type-safe JavaScript

### Audio Processing
- **node-id3** - Read/write MP3 ID3 tags
- **web-audio-beat-detector** - Audio analysis
- **lamejs** - MP3 encoding

### PDF Generation
- **jsPDF** - PDF document generation
- **jspdf-autotable** - Table generation for bingo tickets

## Project Structure

```
MusicBingo/
├── electron/                 # Electron main process
│   ├── main.ts              # Main process entry point
│   ├── preload.ts           # Preload script for IPC bridge
│   ├── FolderScanner.ts     # Music library scanner
│   └── tsconfig.json        # TypeScript config for Electron
├── src/                     # React application source
│   ├── components/          # React components
│   │   ├── GameControl/     # Game state controls
│   │   ├── Layout/          # App layout components
│   │   ├── MediaControl/    # Audio player controls
│   │   ├── TicketCheck/     # Ticket verification
│   │   ├── TicketManagement/# Ticket generation/management
│   │   └── ui/              # Reusable UI components
│   ├── context/             # React Context
│   │   └── GameContext.tsx  # Global game state management
│   ├── utils/               # Utility modules
│   │   ├── AudioAnalysis.ts # Audio processing utilities
│   │   ├── BingoLogic.ts    # Ticket generation logic
│   │   └── PDFGenerator.ts  # PDF export for tickets
│   ├── App.tsx              # Root React component
│   ├── main.tsx             # React entry point
│   └── index.css            # Global styles
├── dist/                    # Vite build output
├── dist-electron/           # Compiled Electron files
├── dist-app/                # Final packaged application
├── Effects/                 # Sound effect files
│   ├── Airhorn/
│   ├── Link/
│   ├── Lose/
│   ├── Suspense/
│   └── Win/
├── Music/                   # User music library (not in repo)
├── settings.ini             # Application settings (Windows paths)
├── cue.ini                  # Song cue points per folder
├── tickets.ini              # Ticket configuration per folder
├── boards.ini               # Generated tickets per folder
├── package.json             # Dependencies and scripts
├── vite.config.ts           # Vite configuration
└── tsconfig.json            # TypeScript configuration
```

## Key Features

### 1. Music Library Management
- Recursive folder scanning for audio files (MP3, WAV, OGG)
- ID3 tag reading and writing
- Artist/Title metadata extraction
- Technical audio info parsing (bitrate, sample rate, channels)
- Custom cue point management (start/end times)

### 2. Bingo Ticket Generation
- Configurable grid sizes (typically 5x5)
- Ensures unique tickets across all players
- Calculates maximum safe ticket count
- Prevents duplicate song combinations
- PDF export with custom headers/footers/logos

### 3. Game Flow Management
- Song history tracking with forward/backward navigation
- Play/pause controls
- Song catalog management (subset of library for active game)
- Ticket marking and verification
- Win/lose detection

### 4. Audio Playback
- Custom media:// protocol for streaming local files
- Range request support for seeking
- Volume control
- Auto-fade between songs
- Configurable overlap timing
- Effect sounds (suspense, win, lose, airhorn, link)

### 5. Data Persistence
- Settings stored in `settings.ini`
- Cue points stored in folder-specific `cue.ini`
- Ticket configuration in `tickets.ini`
- Generated boards in `boards.ini`
- All use Windows-style paths with backslashes

## Windows-Specific Considerations

### File Paths
- All file paths use Windows backslash separators: `C:\Users\...`
- Path normalization converts backslashes to forward slashes for comparison
- File protocol uses custom `media://local/` scheme

### Settings File Format
The `settings.ini` file stores Windows paths to effect files:
```ini
; Music Bingo Settings

[assets]
suspense=C:\Users\paule\OneDrive\code\MusicBingo\Effects\Suspense\mixkit-game-show-suspense-waiting-667.wav
win=C:\Users\paule\OneDrive\code\MusicBingo\Effects\Win\marble-it-up-ultra-soccer-win-sound-418896.mp3
lose=C:\Users\paule\OneDrive\code\MusicBingo\Effects\Lose\falled-sound-effect-278635.mp3
airhorn=C:\Users\paule\OneDrive\code\MusicBingo\Effects\Airhorn\dj-airhorn-sound-39405.mp3
link=C:\Users\paule\OneDrive\code\MusicBingo\Effects\Link\dj-scratch-pattern-4-452583.mp3
```

### Line Endings
- The code handles both Windows (`\r\n`) and Unix (`\n`) line endings when parsing .ini files
- Uses regex pattern: `/\r?\n/`

## IPC Communication

The Electron app uses IPC (Inter-Process Communication) for renderer ↔ main process communication:

### Available IPC Channels

| Channel | Purpose | Returns |
|---------|---------|---------|
| `dialog:openFile` | Open file picker for audio files | `string[]` |
| `dialog:openFolder` | Open folder picker | `string \| null` |
| `library:scanFolder` | Scan folder for audio files | `AudioFileMetadata[]` |
| `settings:save` | Save app settings | `boolean` |
| `settings:load` | Load app settings | `object \| null` |
| `file:exists` | Check if file exists | `boolean` |
| `cues:load` | Load cue points from folder | `object` |
| `cues:save` | Save cue points to folder | `boolean` |
| `tickets:save` | Save ticket config | `boolean` |
| `tickets:load` | Load ticket config | `object \| null` |
| `boards:save` | Save generated boards | `boolean` |
| `boards:load` | Load generated boards | `object \| null` |
| `tags:read` | Read ID3 tags from file | `object \| null` |
| `tags:save` | Write ID3 tags to file | `boolean` |

## Development

### Running the App
```bash
npm run dev          # Start dev server with hot reload
npm run dev:react    # Start Vite dev server only
npm run dev:electron # Start Electron in dev mode
```

### Building
```bash
npm run build        # Build React + Electron + package app
```

### Testing
```bash
npm run preview      # Preview production build
```

## Game State Management

The application uses React Context (`GameContext`) for global state:

### Core State
- `songs: Song[]` - Full music library
- `gameCatalog: Song[]` - Songs used in current game
- `tickets: Map<string, BingoTicket>` - Generated tickets
- `currentSong: Song | null` - Currently playing/queued song
- `playedSongs: Set<string>` - All songs played (unique IDs)
- `songHistory: string[]` - Ordered history of played songs
- `historyIndex: number` - Current position in history
- `isPlaying: boolean` - Playback state
- `volume: number` - Audio volume (0-1)

### Settings State
- `pdfConfig: PDFConfig` - PDF header/footer/logo settings
- `gridSize: number` - Bingo grid dimensions (default: 5)
- `autoFade: boolean` - Enable auto-fade between songs
- `overlapSeconds: number` - Overlap duration for transitions
- `linkEffectEnabled: boolean` - Enable link effect between songs
- `effects: GameEffects` - Paths to effect sound files
- `activeFolder: string | null` - Currently loaded music folder
- `activeEffect: keyof GameEffects | null` - Currently playing effect

## Audio Architecture

### Custom Protocol Handler
The app registers a `media://` protocol for streaming local audio files:
- Supports HTTP range requests for seeking
- Returns proper headers for audio streaming
- Handles file paths with special characters (URL encoding)

### Audio Flow
1. User selects music folder
2. FolderScanner reads all audio files recursively
3. ID3 tags extracted or parsed from filename
4. Songs loaded into library with metadata
5. User generates bingo tickets from library
6. Game selects random unplayed songs from catalog
7. Howler.js plays songs via `media://` protocol
8. Tickets marked as songs are identified

## Ticket Generation Logic

### Algorithm
1. Validate library size vs requested tickets
2. Calculate safe maximum: `safeMax = calculateSafeMax(songCount, gridSize)`
3. For each ticket:
   - Generate random grid of songs
   - Create unique signature (sorted song IDs)
   - Check for duplicates in generated set
   - Retry up to 200 times if duplicate
4. Store tickets in Map with unique IDs

### Grid Structure
```typescript
interface BingoGridCell {
  song: Song;
  marked: boolean;
}

interface BingoTicket {
  id: string;
  grid: BingoGridCell[][];
}
```

## Data File Formats

### cue.ini (per-folder)
```ini
; Music Bingo Cue Points

[Song Filename.mp3]
start=5.2
end=35.7

[Another Song.mp3]
start=10.0
end=40.5
```

### tickets.ini (per-folder)
```ini
; Ticket Configuration

[settings]
header=Musical Bingo
footer=Have Fun!
logo=C:\path\to\logo.png
gridSize=5
```

### boards.ini (per-folder)
```ini
; Generated Bingo Boards and Catalog

[catalog]
C:\Music\Song1.mp3=Artist Name|Song Title
C:\Music\Song2.mp3=Another Artist|Another Song

[1]
0,0=C:\Music\Song1.mp3
0,1=C:\Music\Song2.mp3
...

[2]
0,0=C:\Music\Song3.mp3
...
```

## Common Tasks

### Adding a New Effect Sound
1. Add file to `Effects/` folder
2. Update `GameEffects` interface in GameContext.tsx
3. Add setting to UI
4. Save path to settings.ini
5. Trigger effect at appropriate game event

### Modifying Ticket Layout
1. Update grid generation in `BingoLogic.ts`
2. Adjust PDF layout in `PDFGenerator.ts`
3. Update ticket rendering components
4. Test with various grid sizes

### Adding New Audio Formats
1. Add extension to filter in `FolderScanner.ts` (line 25)
2. Add extension to dialog filter in `main.ts` (line 85)
3. Update content-type in protocol handler if needed
4. Test Howler.js compatibility

## Troubleshooting

### Songs Not Playing
- Check that `media://` protocol is registered
- Verify file paths use correct Windows format
- Check Electron console for protocol errors
- Ensure file permissions allow reading

### Tickets Not Generating
- Verify library has enough songs for grid size
- Check console for "safeMax" calculation
- Ensure no duplicate songs in library
- Try smaller ticket count

### Settings Not Persisting
- Check that `process.cwd()` points to correct directory
- Verify file write permissions
- Ensure .ini file format is correct
- Check for IPC errors in console

### Audio Seeking Issues
- Verify range request headers in network tab
- Check file is not corrupted
- Ensure buffer size is adequate
- Test with different audio formats

## Future Enhancements

Potential areas for improvement:
- Multi-language support
- Cloud sync for game state
- Real-time multiplayer mode
- Advanced audio effects (EQ, reverb)
- Playlist import/export
- Automatic BPM detection integration
- Theme customization
- Remote control via mobile app
- Statistics and analytics
- Backup/restore functionality

## Dependencies Update Notes

When updating dependencies, pay special attention to:
- Electron version (affects Node.js APIs)
- Howler.js (audio playback compatibility)
- jsPDF (PDF generation API changes)
- node-id3 (tag reading/writing compatibility)
- React 18 concurrent features

## Security Considerations

- Context isolation is enabled in BrowserWindow
- Node integration is disabled
- Preload script bridges IPC safely
- File access is limited to user-selected folders
- No remote code execution
- Custom protocol prevents web access to local files

## Performance Notes

- FolderScanner processes files synchronously (consider async for large libraries)
- Ticket generation uses retry logic (may slow with high collision rates)
- Audio streaming uses chunked reads (efficient memory usage)
- PDF generation is synchronous (may block UI for large ticket counts)
- File locks prevent concurrent cue.ini writes

## Build Configuration

### electron-builder
- App ID: `com.musicbingo.app`
- Product Name: `Music Bingo`
- Output: `dist-app/`
- Includes: `dist/` and `dist-electron/`

### Vite
- Base path: `./` (required for Electron)
- React plugin with Fast Refresh
- TypeScript support

## License

Not specified in package.json (consider adding)

## Author

User (per package.json)
