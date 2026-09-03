const { app, BrowserWindow, dialog, Menu, net, protocol, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { APP_URL, CSP, assetPath } = require('./paths.cjs');

// Fixed application identity + origin keep presets across restarts and upgrades.
// A separate profile is used by source-tree development and smoke tests.
app.setName('NestCut');
if (!app.isPackaged) {
  app.setPath('userData', process.env.NESTCUT_TEST_USER_DATA || path.join(app.getPath('appData'), 'NestCut-dev'));
} else {
  app.setPath('userData', path.join(app.getPath('appData'), 'NestCut'));
}
protocol.registerSchemesAsPrivileged([{
  scheme: 'nestcut',
  privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true },
}]);

let mainWindow;
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.show();
    mainWindow?.focus();
  });

  app.whenReady().then(() => {
    const root = path.join(app.getAppPath(), 'dist');
    protocol.handle('nestcut', async request => {
      const target = assetPath(request.url, root);
      if (!target || request.method !== 'GET') return new Response('Forbidden', { status: 403 });
      try {
        const response = await net.fetch(pathToFileURL(target).toString());
        const headers = new Headers(response.headers);
        headers.set('Content-Security-Policy', CSP);
        headers.set('X-Content-Type-Options', 'nosniff');
        return new Response(response.body, { status: response.status, headers });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    });

    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.on('will-download', (_event, item) => {
      // Electron's native Save As dialog lets the user choose the output location.
      item.setSaveDialogOptions({
        title: 'Save NestCut PDF',
        defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())),
        filters: [{ name: 'PDF document', extensions: ['pdf'] }],
      });
      item.once('done', (_event, state) => {
        if (state === 'interrupted') dialog.showErrorBox('PDF not saved', 'The download could not be completed. Please export again and choose a writable folder.');
      });
    });

    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: 'File', submenu: [{ role: 'quit' }] },
      { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: 'View', submenu: [{ role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])] },
    ]));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(error => {
    dialog.showErrorBox('NestCut could not start', error.message);
    app.quit();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'NestCut', width: 1440, height: 1000, minWidth: 1100, minHeight: 780,
    backgroundColor: '#121617', show: false, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadURL(APP_URL).catch(error => dialog.showErrorBox('NestCut could not load', error.message));
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (app.isReady()) session.defaultSession.flushStorageData(); });
