const electron = require('electron');

// Safety guard: If accidentally executed via standard Node.js (e.g. cloud host), delegate to server
if (!electron || typeof electron === 'string' || !electron.app) {
  console.log('Detected standard Node.js runtime instead of Electron. Starting AVK Workspace server...');
  import('../server/server.js');
  return;
}

const { app, BrowserWindow, shell, ipcMain, Menu, Tray } = electron;
const path = require('path');
const fs = require('fs');

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let tray = null;

const configPath = path.join(app.getPath('userData'), 'sct-config.json');

function getSavedServerUrl() {
  if (process.env.SCT_SERVER_URL) {
    return process.env.SCT_SERVER_URL;
  }
  try {
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data && data.serverUrl) return data.serverUrl;
    }
  } catch (err) {
    console.error('Error reading config:', err);
  }
  // Default to live cloud URL so desktop app works anywhere in the world without local server
  return 'https://sct-slack.onrender.com';
}

function saveServerUrl(url) {
  try {
    fs.writeFileSync(configPath, JSON.stringify({ serverUrl: url }, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 560,
    title: 'AVK Workspace',
    backgroundColor: '#1A1D21',
    icon: iconPath,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: true
    }
  });

  const serverUrl = getSavedServerUrl();

  // Load the cloud-synced web app
  mainWindow.loadURL(serverUrl).catch((err) => {
    console.log('Initial connection failed, loading offline screen:', err.message);
    mainWindow.loadFile(path.join(__dirname, 'offline.html'));
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // If page fails to load (e.g. server down), show offline page
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -3) return; // Ignore aborted loads
    console.log(`Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    mainWindow.loadFile(path.join(__dirname, 'offline.html'));
  });

  // Handle external links (open in user's default browser)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      // If external domain, open in browser
      const parsed = new URL(url);
      const isInternal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.port === '5000' || parsed.port === '5173';
      if (!isInternal && !url.includes('/api/')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });

  mainWindow.on('close', (event) => {
    // Standard window close
    mainWindow = null;
  });

  // Setup Application Menu with reload and shortcuts
  const template = [
    {
      label: 'AVK Workspace',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.reload()
        },
        {
          label: 'Hard Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow && mainWindow.webContents.reloadIgnoringCache()
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'F11',
          click: () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen())
        },
        { type: 'separator' },
        {
          label: 'Quit AVK Workspace',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Setup System Tray
  try {
    tray = new Tray(iconPath);
    const trayMenu = Menu.buildFromTemplate([
      {
        label: 'Open AVK Workspace',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        }
      },
      {
        label: 'Reload',
        click: () => mainWindow && mainWindow.reload()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setToolTip('AVK Workspace');
    tray.setContextMenu(trayMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.log('System tray not initialized:', err.message);
  }
}

// Focus existing instance if secondary instance launched
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for custom controls
ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow && mainWindow.close());
