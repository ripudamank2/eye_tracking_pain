const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isWidgetMode = false;

function createSvgTrayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg));
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 48,
    title: 'Eye Tracker Studio',
    transparent: false,
    frame: true,
    alwaysOnTop: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // System Tray Icon on OS Status Bar
  try {
    const icon = createSvgTrayIcon();
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: '👁️ Eye Tracker Panel Widget', enabled: false },
      { type: 'separator' },
      { label: '📌 Switch to Top Status-Bar Widget', click: () => toggleWidgetMode(true) },
      { label: '🖥️ Switch to Full Studio Window', click: () => toggleWidgetMode(false) },
      { type: 'separator' },
      { label: 'Show/Hide', click: () => (mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()) },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setToolTip('Eye Tracker Studio - Top Status Bar Widget');
    tray.setContextMenu(contextMenu);
  } catch (e) {
    console.log('Tray creation notice:', e.message);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function toggleWidgetMode(enableWidget) {
  if (!mainWindow) return;

  isWidgetMode = enableWidget;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.bounds;

  if (enableWidget) {
    // Top Status-Bar Overlay Widget Mode (Frameless, Always on Top, 48px Height)
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setSkipTaskbar(true);
    mainWindow.setBounds({ x: 0, y: 0, width: width, height: 54 });
    mainWindow.setResizable(false);
  } else {
    // Normal Windowed Studio Mode
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setSkipTaskbar(false);
    mainWindow.setResizable(true);
    mainWindow.setBounds({ x: 100, y: 100, width: 1200, height: 800 });
  }

  mainWindow.webContents.send('widget-mode-changed', isWidgetMode);
}

// IPC Listeners for Mode Toggle from UI
ipcMain.on('toggle-widget-mode', (event, enable) => {
  toggleWidgetMode(enable);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
