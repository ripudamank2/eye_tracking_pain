// Standalone desktop eye widget.
//
// Behaves like a desktop widget (Conky / Rainmeter / plasmoid) rather than an app:
// a small dock-type window with no chrome, no taskbar entry, never focusable, and
// permanently click-through. Cursor position comes from the OS, so the eyes follow
// the pointer across every other app without ever intercepting input.

const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Backend selection on Linux.
//
// XWayland (default here) is what makes screen.getCursorScreenPoint() able to read
// the GLOBAL pointer - native Wayland deliberately refuses that. The catch is that
// GNOME's compositor may decline to MAP a borderless always-on-top XWayland window,
// which shows up as 'XGetWindowAttributes failed' and an invisible widget.
//
// EYE_WIDGET_WAYLAND=1 switches to the native Wayland backend: the window then
// displays reliably, but the eyes can only track the pointer while it is over the
// widget itself, because the compositor will not report the global cursor.
if (process.platform === 'linux') {
  if (process.env.EYE_WIDGET_WAYLAND) {
    app.commandLine.appendSwitch('ozone-platform', 'wayland');
    app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
  } else {
    process.env.GDK_BACKEND = 'x11';
    delete process.env.WAYLAND_DISPLAY;

    app.commandLine.appendSwitch('ozone-platform', 'x11');
    app.commandLine.appendSwitch('ozone-platform-hint', 'x11');
  }
}

app.commandLine.appendSwitch('enable-transparent-visuals');

// Transparent XWayland windows crash the GPU process on many Mesa/NVIDIA setups
// (segfault, then 'XGetWindowAttributes failed'). The widget draws two small eyes,
// so compositing on the CPU costs nothing and is far more portable.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('use-gl', 'swiftshader');
  app.commandLine.appendSwitch('disable-gpu-compositing');
}

const WIDGET_WIDTH = 84;
const WIDGET_HEIGHT = 34;

const THEMES = ['cute', 'natural', 'cyberpunk', 'cat', 'googly', 'pixel', 'robot'];
const CORNERS = ['top_right', 'top_left', 'bottom_right', 'bottom_left'];

let widgetWindow = null;
let tray = null;
let cursorPollTimer = null;

const settingsFile = path.join(app.getPath('userData'), 'widget-settings.json');

let settings = {
  theme: 'cute',
  eyeCount: 2,
  radius: 12,
  corner: 'top_right',
  offsetX: 12,
  offsetY: 6,
};

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsFile, 'utf8');
    settings = { ...settings, ...JSON.parse(raw) };
  } catch {
    /* first run - defaults are fine */
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  } catch {
    /* non-fatal: the widget still works, it just will not remember */
  }
}

// Place the widget against one corner of the work area (the screen minus panels),
// so it tucks beside the system tray instead of overlapping it.
function computePosition() {
  const display = screen.getPrimaryDisplay();
  const wa = display.workArea;
  const { corner, offsetX, offsetY } = settings;

  const left = wa.x + offsetX;
  const right = wa.x + wa.width - WIDGET_WIDTH - offsetX;
  const top = wa.y + offsetY;
  const bottom = wa.y + wa.height - WIDGET_HEIGHT - offsetY;

  switch (corner) {
    case 'top_left':
      return { x: left, y: top };
    case 'bottom_right':
      return { x: right, y: bottom };
    case 'bottom_left':
      return { x: left, y: bottom };
    case 'top_right':
    default:
      return { x: right, y: top };
  }
}

function applyPosition() {
  if (!widgetWindow) return;
  const pos = computePosition();
  widgetWindow.setBounds({ ...pos, width: WIDGET_WIDTH, height: WIDGET_HEIGHT });
  widgetWindow.webContents.send('widget-origin', pos);
}

function createWidget() {
  const pos = computePosition();
  const plain = Boolean(process.env.EYE_WIDGET_PLAIN);

  widgetWindow = new BrowserWindow({
    ...pos,
    // In the control test make it big and central so it cannot be missed.
    ...(plain ? { x: 400, y: 300 } : {}),
    width: plain ? 400 : WIDGET_WIDTH,
    height: plain ? 200 : WIDGET_HEIGHT,
    // 'dock' asks the window manager to treat this as desktop furniture rather
    // than an application window: no titlebar, no alt-tab, no taskbar entry.
    // EYE_WIDGET_NO_DOCK=1 disables the dock hint, for window managers that
    // refuse to map dock-type windows. EYE_WIDGET_PLAIN=1 additionally makes this
    // an ordinary focusable, decorated window - a control test for "does ANY
    // window from this process appear?".
    type:
      process.platform === 'linux' && !process.env.EYE_WIDGET_NO_DOCK && !process.env.EYE_WIDGET_PLAIN
        ? 'dock'
        : undefined,
    frame: Boolean(process.env.EYE_WIDGET_PLAIN),
    // Transparent windows do not composite reliably under software-rendered
    // XWayland: the window maps and the renderer runs, but nothing it paints is
    // ever shown. Opaque is the dependable default; EYE_WIDGET_TRANSPARENT=1
    // opts back in on setups where compositing works.
    transparent: Boolean(process.env.EYE_WIDGET_TRANSPARENT),
    backgroundColor: process.env.EYE_WIDGET_TRANSPARENT ? '#00000000' : '#0f172a',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: !process.env.EYE_WIDGET_PLAIN,
    focusable: Boolean(process.env.EYE_WIDGET_PLAIN),
    alwaysOnTop: true,
    acceptFirstMouse: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Diagnostics: report what the window manager actually did with our request.
  widgetWindow.webContents.on('did-finish-load', () => {
    const b = widgetWindow.getBounds();
    console.log(`[eye-widget] loaded. visible=${widgetWindow.isVisible()} bounds=${b.x},${b.y} ${b.width}x${b.height}`);
  });

  widgetWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer] ${message}` + (sourceId ? ` (${sourceId}:${line})` : ''));
  });

  widgetWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[eye-widget] FAILED TO LOAD (${code}) ${desc} :: ${url}`);
  });

  widgetWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[eye-widget] renderer gone:', JSON.stringify(details));
  });

  // Some window managers refuse to map a dock-type window that was never shown
  // explicitly. Force it, then confirm.
  widgetWindow.once('ready-to-show', () => {
    if (plain) {
      widgetWindow.show();
      widgetWindow.focus();
      console.log('[eye-widget] PLAIN mode: show() called, visible =', widgetWindow.isVisible());
    } else {
      widgetWindow.showInactive();
      console.log('[eye-widget] showInactive() called, visible =', widgetWindow.isVisible());
    }
  });

  // Float above normal windows without stealing focus or joining the window stack.
  if (!plain) {
    widgetWindow.setAlwaysOnTop(true, 'screen-saver');
    widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  // Never intercept input. This is what keeps it from disturbing other apps.
  if (!plain) {
    widgetWindow.setIgnoreMouseEvents(true, { forward: false });
  }

  // EYE_WIDGET_DEBUG=1 paints the canvas solid magenta, which distinguishes
  // "nothing is drawing" from "drawing, but the window is not visible".
  if (process.env.EYE_WIDGET_DEBUG) {
    widgetWindow.webContents.on('did-finish-load', () => {
      widgetWindow.webContents.executeJavaScript('window.__EYE_DEBUG__ = true;');
    });
  }

  loadWidgetContent();

  widgetWindow.on('closed', () => {
    widgetWindow = null;
  });
}

// Serve dist/ over a loopback HTTP server instead of loading it from file://.
// Vite always stamps `crossorigin` on its module script tags, and under file://
// that fails the CORS check so the bundle never executes - a blank window with
// no error. Serving over http:// makes the module load normally.
function startLocalServer(rootDir) {
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
  };

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const rel = urlPath === '/' ? '/widget.html' : urlPath;
      const filePath = path.join(rootDir, path.normalize(rel));

      // Refuse to serve anything outside dist/.
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403).end('forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404).end('not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
        res.end(data);
      });
    });

    server.on('error', reject);
    // Port 0 = let the OS pick a free port.
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function loadWidgetContent() {
  const distDir = path.join(__dirname, '../dist');

  try {
    const port = await startLocalServer(distDir);
    await widgetWindow.loadURL(`http://127.0.0.1:${port}/widget.html`);
    console.log(`[eye-widget] serving dist/ on 127.0.0.1:${port}`);
  } catch (err) {
    console.error('[eye-widget] local server failed, falling back to file://', err.message);
    widgetWindow.loadFile(path.join(distDir, 'widget.html'));
  }
}

// Stream the OS cursor to the renderer. Deduped, so a still pointer costs nothing.
function startCursorPolling() {
  stopCursorPolling();

  let lastX = -1;
  let lastY = -1;

  cursorPollTimer = setInterval(() => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;

    const pt = screen.getCursorScreenPoint();
    if (pt.x === lastX && pt.y === lastY) return;
    lastX = pt.x;
    lastY = pt.y;

    widgetWindow.webContents.send('cursor-position', pt);
  }, 16);
}

function stopCursorPolling() {
  if (cursorPollTimer) {
    clearInterval(cursorPollTimer);
    cursorPollTimer = null;
  }
}

function pushSettings() {
  if (!widgetWindow || widgetWindow.isDestroyed()) return;
  widgetWindow.webContents.send('widget-settings', settings);
}

function updateSetting(patch) {
  settings = { ...settings, ...patch };
  saveSettings();
  pushSettings();
  applyPosition();
  buildTrayMenu();
}

function createTrayIcon() {
  // Use the real bundled PNG. nativeImage cannot decode raw SVG markup, so the
  // previous createFromBuffer(svg) approach produced an empty image.
  const iconPath = path.join(__dirname, '../public/icon.png');
  try {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      return img.resize({ width: 22, height: 22 });
    }
  } catch {
    /* fall through */
  }
  return nativeImage.createEmpty();
}

function buildTrayMenu() {
  if (!tray) return;

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Eye Theme',
        submenu: THEMES.map((t) => ({
          label: t.charAt(0).toUpperCase() + t.slice(1),
          type: 'radio',
          checked: settings.theme === t,
          click: () => updateSetting({ theme: t }),
        })),
      },
      {
        label: 'Position',
        submenu: CORNERS.map((c) => ({
          label: c.replace('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
          type: 'radio',
          checked: settings.corner === c,
          click: () => updateSetting({ corner: c }),
        })),
      },
      {
        label: 'Eyes',
        submenu: [1, 2, 3].map((n) => ({
          label: `${n}`,
          type: 'radio',
          checked: settings.eyeCount === n,
          click: () => updateSetting({ eyeCount: n }),
        })),
      },
      {
        label: 'Size',
        submenu: [
          { label: 'Small', value: 9 },
          { label: 'Medium', value: 12 },
          { label: 'Large', value: 15 },
        ].map((s) => ({
          label: s.label,
          type: 'radio',
          checked: settings.radius === s.value,
          click: () => updateSetting({ radius: s.value }),
        })),
      },
      { type: 'separator' },
      {
        label: 'Start on Login',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: 'separator' },
      { label: 'Quit Eye Widget', click: () => app.quit() },
    ])
  );
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Eye Widget');
  buildTrayMenu();
}

// The renderer tells us when it is mounted, so the first settings/origin push
// cannot race the page load.
ipcMain.on('widget-ready', () => {
  pushSettings();
  applyPosition();
  startCursorPolling();
});

// Keep the widget glued to its corner when the display layout changes.
function watchDisplays() {
  screen.on('display-metrics-changed', applyPosition);
  screen.on('display-added', applyPosition);
  screen.on('display-removed', applyPosition);
}

app.whenReady().then(() => {
  loadSettings();
  createWidget();
  createTray();
  watchDisplays();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWidget();
  });
});

app.on('before-quit', stopCursorPolling);

// A widget has no window to close, so closing must not quit the app.
app.on('window-all-closed', () => {
  /* keep running in the tray */
});
