import { app, BrowserWindow, shell, ipcMain, dialog, protocol, net } from 'electron'
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'path'
import NodeID3 from 'node-id3';
import { FolderScanner } from './FolderScanner';

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let ipcRegistrationComplete = false;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// Register custom protocol as privileged
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'media',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            stream: true,
            bypassCSP: true
        }
    }
]);

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
        if (!ipcRegistrationComplete) {
            console.error("[Main] IPC Registration was NOT complete when window loaded!");
        }
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
        win.webContents.openDevTools()
    } else {
        win.loadFile(path.join(process.env.DIST, 'index.html'))
    }
}

const fileLocks = new Map<string, Promise<void>>();

async function withLock(filePath: string, fn: () => Promise<any>) {
    while (fileLocks.has(filePath)) {
        await fileLocks.get(filePath);
    }
    const promise = fn();
    fileLocks.set(filePath, promise);
    try {
        return await promise;
    } finally {
        fileLocks.delete(filePath);
    }
}

function registerIpcHandlers() {
    console.log("[Main] Starting IPC Handler Registration...");
    ipcRegistrationComplete = false;

    const handlers = [
        {
            name: 'dialog:openFile',
            handler: async () => {
                console.log("[IPC] dialog:openFile CALLED");
                try {
                    const { canceled, filePaths } = await dialog.showOpenDialog({
                        properties: ['openFile', 'multiSelections'],
                        filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'ogg'] }]
                    })
                    return canceled ? [] : filePaths;
                } catch (e) {
                    console.error("[IPC] dialog:openFile ERROR:", e);
                    throw e;
                }
            }
        },
        {
            name: 'dialog:openFolder',
            handler: async () => {
                console.log("[IPC] dialog:openFolder CALLED");
                try {
                    const { canceled, filePaths } = await dialog.showOpenDialog({
                        properties: ['openDirectory']
                    })
                    return canceled ? null : filePaths[0];
                } catch (e) {
                    console.error("[IPC] dialog:openFolder ERROR:", e);
                    throw e;
                }
            }
        },
        {
            name: 'library:scanFolder',
            handler: async (_event: any, folderPath: string) => {
                console.log(`[IPC] library:scanFolder CALLED for ${folderPath}`);
                try {
                    const results = await FolderScanner.scan(folderPath);
                    return results;
                } catch (e) {
                    console.error(`[IPC] library:scanFolder ERROR for ${folderPath}:`, e);
                    return [];
                }
            }
        },
        {
            name: 'settings:save',
            handler: async (_event: any, settings: any) => {
                console.log("[IPC] settings:save CALLED");
                try {
                    const settingsPath = path.join(process.cwd(), 'settings.ini');
                    let content = "; Music Bingo Settings\n\n";
                    content += "[assets]\n";
                    content += `suspense=${settings.effects?.suspense || ''}\n`;
                    content += `win=${settings.effects?.win || ''}\n`;
                    content += `lose=${settings.effects?.lose || ''}\n`;
                    content += `airhorn=${settings.effects?.airhorn || ''}\n`;
                    content += `link=${settings.effects?.link || ''}\n`;
                    fs.writeFileSync(settingsPath, content, 'utf-8');
                    return true;
                } catch (e) {
                    console.error("[IPC] settings:save ERROR:", e);
                    return false;
                }
            }
        },
        {
            name: 'settings:load',
            handler: async () => {
                console.log("[IPC] settings:load CALLED");
                try {
                    const settingsPath = path.join(process.cwd(), 'settings.ini');
                    if (!fs.existsSync(settingsPath)) return null;
                    const content = fs.readFileSync(settingsPath, 'utf-8');
                    const lines = content.split(/\r?\n/);
                    const settings: any = { audio: {}, assets: {} };
                    let currentSection = '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(';')) continue;
                        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                            currentSection = trimmed.slice(1, -1);
                            continue;
                        }
                        const [key, ...valParts] = trimmed.split('=');
                        const val = valParts.join('=').trim();
                        if (currentSection === 'assets') {
                            if (!settings.effects) settings.effects = {};
                            settings.effects[key] = val;
                        }
                    }
                    return settings;
                } catch (e) {
                    console.error("[IPC] settings:load ERROR:", e);
                    return null;
                }
            }
        },
        {
            name: 'file:exists',
            handler: async (_event: any, filePath: string) => {
                if (!filePath) return false;
                try { return fs.existsSync(filePath); } catch (e) { return false; }
            }
        },
        {
            name: 'cues:load',
            handler: async (_event: any, folderPath: string) => {
                console.log(`[IPC] cues:load CALLED for ${folderPath}`);
                if (!folderPath) return {};
                const cuePath = path.join(folderPath, 'cue.ini');
                return withLock(cuePath, async () => {
                    try {
                        if (!fs.existsSync(cuePath)) return {};
                        const content = fs.readFileSync(cuePath, 'utf-8');
                        const lines = content.split(/\r?\n/);
                        const cues: any = {};
                        let currentFile = '';
                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || trimmed.startsWith(';')) continue;
                            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                                currentFile = trimmed.slice(1, -1);
                                cues[currentFile] = {};
                                continue;
                            }
                            if (currentFile) {
                                const [key, val] = trimmed.split('=').map(s => s.trim());
                                if (key === 'start') cues[currentFile].startTime = parseFloat(val);
                                if (key === 'end') cues[currentFile].endTime = parseFloat(val);
                            }
                        }
                        return cues;
                    } catch (e) {
                        console.error("[IPC] cues:load ERROR:", e);
                        return {};
                    }
                });
            }
        },
        {
            name: 'tickets:save',
            handler: async (_event: any, args: any) => {
                console.log(`[IPC] tickets:save CALLED with args:`, JSON.stringify(args));
                const { folderPath, config, gridSize } = args || {};
                if (!folderPath) {
                    console.error("[IPC] tickets:save ERROR: No folderPath provided");
                    return false;
                }
                const ticketPath = path.join(folderPath, 'tickets.ini');
                try {
                    let content = "; Ticket Configuration\n\n";
                    content += "[settings]\n";
                    content += `header=${config?.headerText || ''}\n`;
                    content += `footer=${config?.footerText || ''}\n`;
                    content += `logo=${config?.logoUrl || ''}\n`;
                    content += `gridSize=${gridSize || 5}\n`;
                    fs.writeFileSync(ticketPath, content, 'utf-8');
                    console.log(`[IPC] tickets:save SUCCESS: ${ticketPath}`);
                    return true;
                } catch (e) {
                    console.error("[IPC] tickets:save ERROR:", e);
                    return false;
                }
            }
        },
        {
            name: 'tickets:load',
            handler: async (_event: any, folderPath: string) => {
                console.log(`[IPC] tickets:load CALLED for ${folderPath}`);
                if (!folderPath) return null;
                const ticketPath = path.join(folderPath, 'tickets.ini');
                try {
                    if (!fs.existsSync(ticketPath)) return null;
                    const content = fs.readFileSync(ticketPath, 'utf-8');
                    const lines = content.split(/\r?\n/);
                    const config: any = {};
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('[')) continue;
                        const [key, ...valParts] = trimmed.split('=');
                        const val = valParts.join('=').trim();
                        if (key === 'header') config.headerText = val;
                        if (key === 'footer') config.footerText = val;
                        if (key === 'logo') config.logoUrl = val;
                        if (key === 'gridSize') config.gridSize = parseInt(val);
                    }
                    return config;
                } catch (e) {
                    console.error("[IPC] tickets:load ERROR:", e);
                    return null;
                }
            }
        },
        {
            name: 'boards:save',
            handler: async (_event: any, { folderPath, tickets, catalog }: any) => {
                console.log(`[IPC] boards:save CALLED for ${folderPath}`);
                if (!folderPath) return false;
                const boardsPath = path.join(folderPath, 'boards.ini');
                try {
                    let content = "; Generated Bingo Boards and Catalog\n\n";
                    
                    // Save Catalog first
                    if (catalog && Array.isArray(catalog)) {
                        content += "[catalog]\n";
                        catalog.forEach((song: any) => {
                            // Using pipe as a delimiter for artist/title metadata
                            content += `${song.id}=${song.artist}|${song.title}\n`;
                        });
                        content += "\n";
                    }

                    tickets.forEach((ticket: any) => {
                        content += `[${ticket.id}]\n`;
                        ticket.grid.forEach((row: any[], rowIndex: number) => {
                            row.forEach((cell: any, colIndex: number) => {
                                if (cell) {
                                    content += `${rowIndex},${colIndex}=${cell.song.id}\n`;
                                }
                            });
                        });
                        content += "\n";
                    });
                    fs.writeFileSync(boardsPath, content, 'utf-8');
                    return true;
                } catch (e) {
                    console.error("[IPC] boards:save ERROR:", e);
                    return false;
                }
            }
        },
        {
            name: 'boards:load',
            handler: async (_event: any, folderPath: string) => {
                console.log(`[IPC] boards:load CALLED for ${folderPath}`);
                if (!folderPath) return null;
                const boardsPath = path.join(folderPath, 'boards.ini');
                try {
                    if (!fs.existsSync(boardsPath)) return null;
                    const content = fs.readFileSync(boardsPath, 'utf-8');
                    const lines = content.split(/\r?\n/);
                    const boards: any[] = [];
                    const catalog: any[] = [];
                    let currentBoard: any = null;
                    let inCatalog = false;
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith(';')) continue;
                        
                        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                            const section = trimmed.slice(1, -1);
                            if (section === 'catalog') {
                                inCatalog = true;
                                currentBoard = null;
                            } else {
                                inCatalog = false;
                                if (currentBoard) boards.push(currentBoard);
                                currentBoard = { id: section, cells: [] };
                            }
                            continue;
                        }
                        
                        if (inCatalog) {
                            const [id, meta] = trimmed.split('=');
                            const [artist, title] = (meta || '').split('|');
                            catalog.push({ id, artist, title, filePath: id });
                        } else if (currentBoard) {
                            const [pos, songId] = trimmed.split('=').map(s => s.trim());
                            const [row, col] = pos.split(',').map(n => parseInt(n));
                            currentBoard.cells.push({ row, col, songId });
                        }
                    }
                    if (currentBoard) boards.push(currentBoard);
                    return { boards, catalog };
                } catch (e) {
                    console.error("[IPC] boards:load ERROR:", e);
                    return null;
                }
            }
        },
        {
            name: 'cues:save',
            handler: async (_event: any, { folderPath, cues }: { folderPath: string, cues: any }) => {
                console.log(`[IPC] cues:save CALLED for ${folderPath}`);
                if (!folderPath) return false;
                const cuePath = path.join(folderPath, 'cue.ini');
                return withLock(cuePath, async () => {
                    try {
                        let content = "; Music Bingo Cue Points\n\n";
                        for (const fileName in cues) {
                            content += `[${fileName}]\n`;
                            if (cues[fileName].startTime !== undefined) content += `start=${cues[fileName].startTime}\n`;
                            if (cues[fileName].endTime !== undefined) content += `end=${cues[fileName].endTime}\n`;
                            content += "\n";
                        }
                        fs.writeFileSync(cuePath, content, 'utf-8');
                        return true;
                    } catch (e) {
                        console.error("[IPC] cues:save ERROR:", e);
                        return false;
                    }
                });
            }
        },
        {
            name: 'tags:read',
            handler: async (_event: any, filePath: string) => {
                console.log(`[IPC] tags:read CALLED for ${filePath}`);
                try {
                    const tags = NodeID3.read(filePath);
                    return tags;
                } catch (e) {
                    console.error("[IPC] tags:read ERROR:", e);
                    return null;
                }
            }
        },
        {
            name: 'tags:save',
            handler: async (_event: any, { filePath, tags }: { filePath: string, tags: any }) => {
                console.log(`[IPC] tags:save CALLED for ${filePath}`);
                try {
                    const success = NodeID3.update(tags, filePath);
                    return success;
                } catch (e) {
                    console.error("[IPC] tags:save ERROR:", e);
                    return false;
                }
            }
        }
    ];

    handlers.forEach(({ name, handler }) => {
        try {
            ipcMain.removeHandler(name);
            ipcMain.handle(name, handler);
            console.log(`[Main] Registered IPC handler: ${name}`);
        } catch (e) {
            console.error(`[Main] Failed to register IPC handler: ${name}`, e);
        }
    });

    ipcRegistrationComplete = true;
    console.log("[Main] IPC Registration complete.");
}

app.whenReady().then(() => {
    try {
        registerIpcHandlers();
    } catch (e) {
        console.error("[Main] FATAL ERROR: Failed to register IPC handlers:", e);
    }

    protocol.handle('media', async (request) => {
        try {
            const prefix = 'media://local/';
            const rawPath = request.url.startsWith(prefix)
                ? request.url.slice(prefix.length)
                : request.url.replace('media://', '');
            const decodedPath = decodeURIComponent(rawPath);

            // Get file stats
            const stats = fs.statSync(decodedPath);
            const fileSize = stats.size;

            // Check for Range header
            const rangeHeader = request.headers.get('Range');

            if (rangeHeader) {
                const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
                if (match) {
                    const start = parseInt(match[1], 10);
                    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
                    const chunkSize = end - start + 1;

                    // Read the specific range into a buffer
                    const fd = fs.openSync(decodedPath, 'r');
                    const buffer = Buffer.alloc(chunkSize);
                    fs.readSync(fd, buffer, 0, chunkSize, start);
                    fs.closeSync(fd);

                    return new Response(buffer, {
                        status: 206,
                        headers: {
                            'Content-Type': 'audio/mpeg',
                            'Content-Length': String(chunkSize),
                            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                            'Accept-Ranges': 'bytes',
                        }
                    });
                }
            }

            // No range - return full file as buffer
            const buffer = fs.readFileSync(decodedPath);
            return new Response(buffer, {
                status: 200,
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Content-Length': String(fileSize),
                    'Accept-Ranges': 'bytes',
                }
            });
        } catch (e) {
            console.error(`[Protocol:media] ERROR:`, e);
            return new Response("Internal Error", { status: 500 });
        }
    });

    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
