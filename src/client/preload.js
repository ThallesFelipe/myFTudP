const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ftpAPI', {

    connect: (address, port) => ipcRenderer.invoke('ftp-connect', { address, port }),

    disconnect: () => ipcRenderer.invoke('ftp-disconnect'),


    login: (username, password) => ipcRenderer.invoke('ftp-login', { username, password }),


    ls: () => ipcRenderer.invoke('ftp-ls'),


    cd: (dirName) => ipcRenderer.invoke('ftp-cd', dirName),


    mkdir: (dirName) => ipcRenderer.invoke('ftp-mkdir', dirName),


    rmdir: (dirName) => ipcRenderer.invoke('ftp-rmdir', dirName),


    put: (localPath, remoteName) => ipcRenderer.invoke('ftp-put', { localPath, remoteName }),


    get: (remoteName, localPath) => ipcRenderer.invoke('ftp-get', { remoteName, localPath }),


    onConnected: (callback) => ipcRenderer.on('ftp-connected', callback),


    onDisconnected: (callback) => ipcRenderer.on('ftp-disconnected', callback),


    onAuthenticated: (callback) => ipcRenderer.on('ftp-authenticated', callback),


    onError: (callback) => ipcRenderer.on('ftp-error', callback),


    onUploadProgress: (callback) => ipcRenderer.on('upload-progress', callback),


    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),


    onDownloadStart: (callback) => ipcRenderer.on('download-start', callback),


    onDownloadComplete: (callback) => ipcRenderer.on('download-complete', callback),


    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});


contextBridge.exposeInMainWorld('fileAPI', {

    selectFile: () => ipcRenderer.invoke('select-file'),


    selectDirectory: () => ipcRenderer.invoke('select-directory'),


    saveFileDialog: (defaultName) => ipcRenderer.invoke('save-file-dialog', defaultName),


    readLocalDirectory: (dirPath) => ipcRenderer.invoke('read-local-directory', dirPath),


    getUserHome: () => ipcRenderer.invoke('get-user-home'),


    joinPath: (...paths) => ipcRenderer.invoke('join-path', ...paths)
});
