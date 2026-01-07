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
- **Song selection with checkboxes** - select subsets of your library for different game scenarios

### 2. Multi-Preset System (NEW!)
- **Save multiple game configurations** per music folder
- Each preset stores:
  - Selected song subset (which songs to use)
  - Generated tickets and boards
  - Grid size (3x3, 4x4, 5x5)
  - PDF settings (header, footer, logo)
- **Preset management UI** with dropdown selector
- Create, load, update, and delete presets
- **Example use cases:**
  - "80s Night" - 30 selected songs, 10 tickets
  - "Rock Classics" - 50 different songs, 20 tickets
  - "Kids Party" - family-friendly subset, 15 tickets
  - "Full Library" - all songs, 50 tickets
- **File storage:** `boards_presetname.ini`, `tickets_presetname.ini`
- Preset names are URL-encoded (e.g., "80s Night" → `boards_80s%20night.ini`)

### 3. Bingo Ticket Generation
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
| `presets:list` | List available presets in folder | `PresetInfo[]` |
| `presets:save` | Save preset (boards + tickets) | `boolean` |
| `presets:load` | Load preset configuration | `object \| null` |
| `presets:delete` | Delete preset files | `boolean` |

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
- `selectedSongIds: Set<string>` - Song IDs selected for current preset
- `activePreset: string | null` - Currently loaded preset name
- `availablePresets: PresetInfo[]` - List of available presets in folder

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

### tickets_[presetname].ini (per-folder, per-preset)
```ini
; Ticket Configuration for Preset

[settings]
header=Musical Bingo
footer=Have Fun!
logo=C:\path\to\logo.png
gridSize=5

[selectedSongs]
uuid-of-song-1
uuid-of-song-2
uuid-of-song-3
```

**Note:** Preset names are URL-encoded in filenames (e.g., "80s Night" → `tickets_80s%20night.ini`)

### boards_[presetname].ini (per-folder, per-preset)
```ini
; Generated Bingo Boards and Catalog for Preset

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

## Git Best Practices for This Project

### Commit Frequency
**Commit often, push when stable.** As a general rule:
- Commit after completing a logical unit of work (a feature, a bug fix, a refactor)
- Commit when your code is in a working state (builds and runs)
- Commit before starting something risky or experimental
- Commit at the end of each work session

**Good times to commit:**
- ✅ "Added volume control slider to MediaControl component"
- ✅ "Fixed bug where songs wouldn't load from folders with spaces"
- ✅ "Refactored ticket generation to handle edge cases"
- ✅ "Updated README with installation instructions"

**Too small (avoid these):**
- ❌ "Fixed typo" (unless it's a critical bug)
- ❌ "Changed variable name"
- ❌ "Added semicolon"

**Too large (break these up):**
- ❌ "Worked on the app" (what specifically?)
- ❌ "Various fixes and improvements" (be specific)

### Commit Messages

Use clear, descriptive commit messages that explain **what** and **why**:

```bash
# Good format:
git commit -m "Add BPM detection to audio analysis

- Integrate web-audio-beat-detector library
- Display BPM in library manager UI
- Cache BPM results to avoid re-calculation

This helps users select energetic songs for the game."
```

**Message Structure:**
1. **First line**: Short summary (50 chars or less) in imperative mood
   - "Add feature" not "Added feature"
   - "Fix bug" not "Fixed bug"
2. **Blank line**
3. **Body** (optional): Explain what and why, not how
   - What changed?
   - Why was this change necessary?
   - Any side effects or considerations?

**Examples:**
```bash
# Feature
git commit -m "Add keyboard shortcuts for media controls"

# Bug fix
git commit -m "Fix audio playback stopping when navigating between tabs"

# Refactoring
git commit -m "Extract PDF generation logic into separate utility class"

# Documentation
git commit -m "Update claude.md with git workflow documentation"
```

### What NOT to Commit

The `.gitignore` is already configured, but be aware of what's excluded:

**Never commit:**
- ❌ `node_modules/` - Always reinstall with `npm install`
- ❌ Build outputs (`dist/`, `dist-electron/`, `dist-app/`)
- ❌ User music files (`Music/`, `*.mp3`, `*.wav`, `*.ogg`)
- ❌ Effect sound files if copyrighted
- ❌ `settings.ini` - Contains user-specific file paths
- ❌ `cue.ini`, `tickets.ini`, `boards.ini` - User-generated data
- ❌ API keys, passwords, secrets
- ❌ Personal test data

**Always commit:**
- ✅ Source code (`src/`, `electron/`)
- ✅ Configuration files (`package.json`, `tsconfig.json`, `vite.config.ts`)
- ✅ Documentation (`claude.md`, `README.md`)
- ✅ `.gitignore` itself

### Checking Before You Commit

Always review what you're committing:

```bash
# See what files have changed
git status

# See the actual changes in detail
git diff

# See what's staged for commit
git diff --cached

# Review and stage selectively
git add -p    # Interactive staging - very useful!
```

### Basic Workflow

```bash
# 1. Check current status
git status

# 2. Stage specific files
git add src/components/NewFeature.tsx
git add src/utils/helper.ts

# Or stage everything (be careful!)
git add .

# 3. Commit with a message
git commit -m "Add new feature description"

# 4. Push to remote (if you have one set up)
git push
```

### Branching Strategy (Simple Approach)

For solo development or small teams:

```bash
# Main branch for stable code
master (or main)

# Create feature branches for new work
git checkout -b feature/audio-visualizer
# ... work on feature ...
git add .
git commit -m "Add audio visualizer component"

# Merge back when done
git checkout master
git merge feature/audio-visualizer
git branch -d feature/audio-visualizer  # Delete merged branch
```

**Branch naming conventions:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code improvements
- `docs/description` - Documentation updates

**When to branch:**
- Working on a new feature that might take multiple commits
- Experimenting with something that might not work
- Collaborating with others on the same project
- Want to keep master stable while trying new things

**When to stay on master:**
- Quick fixes or small changes
- Solo development and you're confident
- Prototyping and not worried about stability

### Undoing Mistakes

**Undo last commit (keep changes):**
```bash
git reset --soft HEAD~1
# Your changes are still staged, you can recommit
```

**Undo last commit (discard changes) - CAREFUL:**
```bash
git reset --hard HEAD~1
# Changes are GONE forever!
```

**Unstage a file:**
```bash
git reset HEAD src/components/File.tsx
```

**Discard changes in a file - CAREFUL:**
```bash
git checkout -- src/components/File.tsx
# This throws away all unsaved changes!
```

**Revert a commit (safe way):**
```bash
git revert abc123
# Creates a new commit that undoes the old one
```

### Working with Remote Repositories

**First time setup with GitHub:**
```bash
# Create repo on GitHub first, then:
git remote add origin https://github.com/username/MusicBingo.git
git branch -M main
git push -u origin main
```

**Daily workflow with remote:**
```bash
# Start your day - get latest changes
git pull

# ... do your work, commit locally ...

# End of day - share your work
git push

# If push fails (someone else pushed first)
git pull --rebase
git push
```

### Viewing History

```bash
# Simple log
git log --oneline

# Detailed log with diffs
git log -p

# Visual graph (for branches)
git log --oneline --graph --all

# See what changed in a specific commit
git show abc123

# See all changes to a specific file
git log -p src/components/MediaControl.tsx
```

### Project-Specific Tips

**For Music Bingo development:**

1. **Test before committing**: Run `npm run dev` to ensure app starts
2. **Build test occasionally**: Run `npm run build` to catch TypeScript errors
3. **Keep settings.ini out**: Never commit your personal paths
4. **Document new IPC channels**: Update claude.md when adding IPC handlers
5. **Commit both sides**: When changing IPC, commit both renderer and main process code together

**Commit examples for this project:**
```bash
# Good
git commit -m "Add shuffle mode to ticket generation"
git commit -m "Fix cue points not saving on Windows paths"
git commit -m "Refactor FolderScanner to use async/await"

# Not as good
git commit -m "Updates"
git commit -m "WIP" (work in progress - only use temporarily)
git commit -m "asdfasdf" (never do this!)
```

### Commit Checklist

Before each commit, ask yourself:
- [ ] Does the code run without errors?
- [ ] Did I remove console.logs added for debugging?
- [ ] Did I update documentation if needed?
- [ ] Is this a logical, complete change?
- [ ] Would my commit message help me in 6 months?
- [ ] Am I committing only relevant files?
- [ ] Did I accidentally include personal settings/data?

### Quick Reference

```bash
# Common commands you'll use daily
git status              # What's changed?
git add <file>          # Stage a file
git add .               # Stage everything
git commit -m "msg"     # Commit staged changes
git push                # Send to remote
git pull                # Get from remote
git log --oneline       # View history

# Useful but less frequent
git diff                # See unstaged changes
git diff --cached       # See staged changes
git checkout -b <name>  # Create new branch
git checkout <name>     # Switch branch
git branch              # List branches
git merge <branch>      # Merge branch into current

# "Oh no!" commands
git reset --soft HEAD~1 # Undo last commit, keep changes
git checkout -- <file>  # Discard changes (CAREFUL!)
git stash               # Temporarily save changes
git stash pop           # Restore stashed changes
```

### Learning Resources

- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- [Oh Sh*t, Git!?!](https://ohshitgit.com/) - Fixes for common mistakes
- [GitHub Desktop](https://desktop.github.com/) - GUI if you prefer visual tools
- `git help <command>` - Built-in help

### Git Aliases (Shortcuts Configured for This Project)

This project has custom git aliases set up to make common operations faster. See `GIT_COMMANDS.md` for the complete reference.

**Most Useful Shortcuts:**
```bash
git st              # Status (what changed?)
git lg              # Visual history graph
git cm "message"    # Quick commit
git aa              # Add all files
git save            # Quick WIP save point
git undo            # Undo last commit (keep changes)
git sync            # Pull and push in one command
```

**Example workflow:**
```bash
git st              # Check status
git aa              # Stage everything
git cm "Add volume slider to media controls"
git push            # Push to GitHub
```

**View all aliases:**
```bash
git config --get-regexp alias
```

**See also:** `GIT_COMMANDS.md` for detailed workflows and examples

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
