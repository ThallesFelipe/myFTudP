/**
 * @file main.js
 * @description Processo principal do Electron para a aplicação myFTudP.
 * Este arquivo é responsável por gerenciar o ciclo de vida da aplicação,
 * criar a janela principal, configurar IPC handlers e fazer a ponte
 * entre o renderer process (interface) e o cliente FTP.
 * 
 * Responsabilidades:
 * - Gerenciamento da janela principal do Electron
 * - Configuração de segurança (contextIsolation, preload)
 * - IPC handlers para comunicação com renderer
 * - Integração com cliente FTP backend
 * - Diálogos de sistema (abrir/salvar arquivos)
 * 
 * @author Thalles Felipe
 * @version 1.0.0
 * @since 2025-01-23
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const myFTudPClient = require('./client');

/** @type {BrowserWindow|null} mainWindow - Referência para a janela principal */
let mainWindow;

/** @type {myFTudPClient|null} ftpClient - Instância do cliente FTP */
let ftpClient;

/**
 * Cria a janela principal da aplicação
 * 
 * Configura uma janela Electron com segurança adequada, carrega
 * a interface HTML e estabelece configurações de desenvolvimento.
 * 
 * @function createWindow
 */
function createWindow() {
    // Configurações da janela principal
    mainWindow = new BrowserWindow({
        width: 1200,                    // Largura inicial
        height: 800,                    // Altura inicial
        minWidth: 800,                  // Largura mínima
        minHeight: 600,                 // Altura mínima
        webPreferences: {
            nodeIntegration: false,     // Desabilita integração Node.js por segurança
            contextIsolation: true,     // Habilita isolamento de contexto
            preload: path.join(__dirname, 'preload.js') // Script de preload para API bridge
        },
        icon: path.join(__dirname, '../../assets/images/logo.png'), // Ícone da aplicação
        title: 'myFTudP - Cliente FTP com UDP',                     // Título da janela
        autoHideMenuBar: true          // Oculta barra de menu automaticamente
    });

    // Remove menu padrão do Electron
    mainWindow.setMenu(null);

    // Carrega a interface HTML
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

    // Abre DevTools em modo desenvolvimento
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // Cleanup quando janela é fechada
    mainWindow.on('closed', () => {
        mainWindow = null;
        if (ftpClient) {
            ftpClient.disconnect();
        }
    });
}

// Eventos do ciclo de vida da aplicação Electron

/**
 * Inicializa a aplicação quando Electron está pronto
 * Cria a janela principal após a inicialização completa do framework
 */
app.whenReady().then(createWindow);

/**
 * Encerra a aplicação quando todas as janelas são fechadas
 * No macOS, aplicações continuam rodando mesmo sem janelas abertas
 */
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

/**
 * Recria janela quando aplicação é ativada (apenas macOS)
 * No macOS, é comum recriar janela quando ícone no dock é clicado
 */
app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

ipcMain.handle('ftp-connect', async (event, { address, port }) => {
    try {
        ftpClient = new myFTudPClient();
        
        ftpClient.on('connected', () => {
            mainWindow.webContents.send('ftp-connected');
        });

        ftpClient.on('disconnected', () => {
            mainWindow.webContents.send('ftp-disconnected');
        });

        ftpClient.on('authenticated', () => {
            mainWindow.webContents.send('ftp-authenticated');
        });

        ftpClient.on('uploadProgress', (data) => {
            mainWindow.webContents.send('upload-progress', data);
        });

        ftpClient.on('downloadProgress', (data) => {
            mainWindow.webContents.send('download-progress', data);
        });

        ftpClient.on('downloadStart', (data) => {
            mainWindow.webContents.send('download-start', data);
        });

        ftpClient.on('downloadComplete', (data) => {
            mainWindow.webContents.send('download-complete', data);
        });

        ftpClient.on('error', (error) => {
            mainWindow.webContents.send('ftp-error', error.message);
        });

        await ftpClient.connect(address, port);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('ftp-disconnect', async () => {
    if (ftpClient) {
        ftpClient.disconnect();
        ftpClient = null;
    }
    return { success: true };
});

ipcMain.handle('ftp-login', async (event, { username, password }) => {
    if (!ftpClient) {
        return { success: false, error: 'Não conectado ao servidor' };
    }

    try {
        const result = await ftpClient.login(username, password);
        return { success: true, message: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('ftp-ls', async () => {
    if (!ftpClient) {
        return { success: false, error: 'Não conectado ao servidor' };
    }

    try {
        const result = await ftpClient.ls();
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('ftp-cd', async (event, dirName) => {
    if (!ftpClient) {
        return { success: false, error: 'Não conectado ao servidor' };
    }

    try {
        const result = await ftpClient.cd(dirName);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('ftp-mkdir', async (event, dirName) => {
    if (!ftpClient) {
        return { success: false, error: 'Não conectado ao servidor' };
    }

    try {
        const result = await ftpClient.mkdir(dirName);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('ftp-rmdir', async (event, dirName) => {
    if (!ftpClient) {
        return { success: false, error: 'Não conectado ao servidor' };
    }

    try {
        const result = await ftpClient.rmdir(dirName);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('ftp-put', async (event, { localPath, remoteName }) => {
    if (!ftpClient) {
        return { success: false, error: 'Não conectado ao servidor' };
    }

    try {
        const result = await ftpClient.put(localPath, remoteName);
        return { success: true, message: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('ftp-get', async (event, { remoteName, localPath }) => {
    if (!ftpClient) {
        return { success: false, error: 'Não conectado ao servidor' };
    }

    try {
        const result = await ftpClient.get(remoteName, localPath);
        return { success: true, message: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Todos os arquivos', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, filePath: result.filePaths[0] };
    }
    
    return { success: false };
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, dirPath: result.filePaths[0] };
    }
    
    return { success: false };
});

ipcMain.handle('save-file-dialog', async (event, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName,
        filters: [
            { name: 'Todos os arquivos', extensions: ['*'] }
        ]
    });

    if (!result.canceled) {
        return { success: true, filePath: result.filePath };
    }
    
    return { success: false };
});

ipcMain.handle('read-local-directory', async (event, dirPath) => {
    try {
        const items = await fs.readdir(dirPath);
        const fileList = [];
        
        for (const item of items) {
            try {
                const itemPath = path.join(dirPath, item);
                const stats = await fs.stat(itemPath);
                
                fileList.push({
                    name: item,
                    type: stats.isDirectory() ? 'directory' : 'file',
                    size: stats.isDirectory() ? 0 : stats.size,
                    modified: stats.mtime,
                    path: itemPath
                });
            } catch (err) {
            }
        }
        
        return { success: true, files: fileList };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-user-home', () => {
    return require('os').homedir();
});

ipcMain.handle('join-path', (event, ...paths) => {
    return path.join(...paths);
});