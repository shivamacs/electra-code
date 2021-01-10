const { app, BrowserWindow , nativeImage, Menu } = require("electron");
const reload = require('electron-reload');
const path = require('path');

function createWindow() {
    var logo = nativeImage.createFromPath(__dirname + '/icons/logo/electra.png'); 
    logo.setTemplateImage(true);

    const win = new BrowserWindow ({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
            nodeIntegration: true
        },
        icon: logo,
    });

    win.loadFile('index.html').then(function() {
        win.maximize();
        win.show();
        // win.webContents.openDevTools();
    });

    const isMac = process.platform === 'darwin';
    const template = [
        {
        label: 'File',
        submenu: [
            { label: 'New File', accelerator: 'CommandOrControl+N', role: 'new-file', click() { win.webContents.send('create-new-file'); } },
            { label: 'New Folder', role: 'new-folder', click() { win.webContents.send('create-new-folder'); }},
            { type: 'separator' },
            { label: 'New Window', accelerator: 'CommandOrControl+Shift+N', role: 'new-window', click() { createWindow(); }},
            { type: 'separator' },
            { label: 'Open File...', accelerator: 'CommandOrControl+O', role: 'open-file', click() { win.webContents.send('open-file'); } },
            { label: 'Open Folder...', accelerator: 'CommandOrControl+S', role: 'open-folder', click() { win.webContents.send('open-folder'); }},
            { type: 'separator' },
            { label: 'Save...', role: 'save', click() { win.webContents.send('save-file'); }},
            { type: 'separator' },
            isMac ? {label: 'Close', role: 'close' } : {label: 'Exit', role: 'quit' }
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
            { type: 'separator' },
            { role: 'selectAll' }
        ]
        },
        {
        label: 'View',
        submenu: [
            { label: 'Show Minimap', role: 'show-minimap', type: 'checkbox', checked: 'true' },
        ]
        },
    ,
        {
        role: 'help',
        submenu: [
            {
            label: 'Toggle Developer Tools',
            role: 'toggledevtools'
            },
            { type: 'separator' },
            {
                label: 'About',
                role: 'about'
            }
        ]
        }
    ]

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

reload(__dirname, {
    electron: path.join(__dirname, 'node_modules/.bin/electron.cmd')
});

app.allowRendererProcessReuse = false;
app.whenReady().then(createWindow);