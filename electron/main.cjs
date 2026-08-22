const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const http = require('http');

// Enable True Transparency & Hardware GPU Acceleration on Linux X11/Wayland
app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('force_high_performance_gpu');

let mainWindow = null;
let tray = null;
let isWidgetMode = true;

function createSvgTrayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg));
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.bounds;

  // 100% True Transparent Frameless Always-On-Top Window
  mainWindow = new BrowserWindow({
    width: width,
    height: 54,
    x: 0,
    y: 0,
    title: 'Eye Tracker Studio',
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const distPath = path.join(__dirname, '../dist/index.html');

  // Check if dev server is active on 5173, otherwise load bundled dist/index.html offline
  const req = http.get('http://localhost:5173', (res) => {
    if (res.statusCode === 200) {
      mainWindow.loadURL('http://localhost:5173');
    } else {
      mainWindow.loadFile(distPath);
    }
  });

  req.on('error', () => {
    mainWindow.loadFile(distPath);
  });

  // System Tray Icon on OS Status Bar
  try {
    const icon = createSvgTrayIcon();
    tray = new Tray(icon);
    const contextMenu = Menu.buildFromTemplate([
      { label: '👁️ Eye Tracker Status Bar Widget', enabled: false },
      { type: 'separator' },
      { label: '📌 Compact Top Bar Widget Mode', click: () => toggleWidgetMode(true) },
      { label: '🖥️ Full Studio Window Mode', click: () => toggleWidgetMode(false) },
      { type: 'separator' },
      { label: 'Show/Hide', click: () => (mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()) },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setToolTip('Eye Tracker Studio - OS Top Panel Widget');
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
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setSkipTaskbar(true);
    mainWindow.setBounds({ x: 0, y: 0, width: width, height: 54 });
    mainWindow.setResizable(false);
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setSkipTaskbar(false);
    mainWindow.setResizable(true);
    mainWindow.setBounds({ x: 100, y: 100, width: 1200, height: 800 });
  }

  mainWindow.webContents.send('widget-mode-changed', isWidgetMode);
}

// IPC Listeners for Mode Toggle & Window Resizing from UI
ipcMain.on('toggle-widget-mode', (event, enable) => {
  toggleWidgetMode(enable);
});

// IPC Listener to expand height when right-click menu opens
ipcMain.on('expand-window-for-menu', (event, expand) => {
  if (!mainWindow || !isWidgetMode) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  if (expand) {
    mainWindow.setBounds({ x: 0, y: 0, width: width, height: height });
  } else {
    mainWindow.setBounds({ x: 0, y: 0, width: width, height: 54 });
  }
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
