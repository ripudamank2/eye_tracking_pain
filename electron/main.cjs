const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const http = require('http');
const { exec } = require('child_process');

// Enable True Transparency & Hardware GPU Acceleration on Linux X11/Wayland
app.commandLine.appendSwitch('enable-transparent-visuals');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('force_high_performance_gpu');
app.commandLine.appendSwitch('ozone-platform-hint', 'x11');

let mainWindow = null;
let tray = null;
let isWidgetMode = true;
let cursorPollTimer = null;

function createSvgTrayIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg));
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  // 100% True Transparent Frameless Always-On-Top Fullscreen Window
  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    center: false,
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

  // Force snap to top-left (0, 0) on Linux GNOME / X11 / Wayland
  mainWindow.setPosition(0, 0);

  // Permanently click-through: the overlay never swallows a click, so the desktop
  // underneath stays fully usable. Cursor position comes from the OS instead of
  // from DOM mouse events, so we never need to toggle this back off.
  mainWindow.setIgnoreMouseEvents(true, { forward: false });

  mainWindow.webContents.on('did-finish-load', () => {
    startCursorPolling();
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

  // Tray Menu Setup
  tray = new Tray(createSvgTrayIcon());
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Toggle OS Status Bar Mode',
      type: 'checkbox',
      checked: true,
      click: () => toggleWidgetMode(!isWidgetMode),
    },
    { type: 'separator' },
    {
      label: 'Lock OS Screen Now',
      click: () => lockOsScreen(),
    },
    { type: 'separator' },
    {
      label: 'Quit Eye Tracker Studio',
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip('Eye Tracker Studio');
  tray.setContextMenu(contextMenu);
}

// Poll the OS-level cursor position and stream it to the renderer.
// This is what lets the eyes follow the pointer across the whole desktop while
// the window itself ignores all mouse input.
function startCursorPolling() {
  stopCursorPolling();

  const winBounds = mainWindow.getBounds();
  let lastX = -1;
  let lastY = -1;

  cursorPollTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const pt = screen.getCursorScreenPoint();

    // Translate desktop coordinates into window-relative canvas coordinates.
    const x = pt.x - winBounds.x;
    const y = pt.y - winBounds.y;

    if (x === lastX && y === lastY) return;
    lastX = x;
    lastY = y;

    mainWindow.webContents.send('cursor-position', { x, y });
  }, 16);
}

function stopCursorPolling() {
  if (cursorPollTimer) {
    clearInterval(cursorPollTimer);
    cursorPollTimer = null;
  }
}

function toggleWidgetMode(enableWidget) {
  if (!mainWindow) return;

  isWidgetMode = enableWidget;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  if (enableWidget) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setSkipTaskbar(true);
    mainWindow.setBounds({ x: 0, y: 0, width: width, height: height });
    mainWindow.setPosition(0, 0);
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setSkipTaskbar(false);
    mainWindow.setResizable(true);
    mainWindow.setBounds({ x: 100, y: 100, width: 1200, height: 800 });
  }

  mainWindow.webContents.send('widget-mode-changed', isWidgetMode);

  // Window moved/resized: restart polling so coordinates stay correct.
  startCursorPolling();
}

function lockOsScreen() {
  if (process.platform === 'linux') {
    exec('loginctl lock-session || xdg-screensaver lock || gnome-screensaver-command -l');
  } else if (process.platform === 'win32') {
    exec('rundll32.exe user32.dll,LockWorkStation');
  } else if (process.platform === 'darwin') {
    exec('pmset displaysleepnow');
  }
}

// IPC Listeners for Mode Toggle & Window Resizing from UI
ipcMain.on('toggle-widget-mode', (event, enable) => {
  toggleWidgetMode(enable);
});

ipcMain.on('expand-window-for-menu', () => {
  if (!mainWindow || !isWidgetMode) return;
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  mainWindow.setBounds({ x: 0, y: 0, width: width, height: height });
  mainWindow.setPosition(0, 0);
});

// IPC Listener to Lock OS Desktop Workstation Screen
ipcMain.on('lock-os-screen', () => {
  lockOsScreen();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  stopCursorPolling();
});

app.on('window-all-closed', () => {
  stopCursorPolling();
  if (process.platform !== 'darwin') app.quit();
});
