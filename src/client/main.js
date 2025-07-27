const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs-extra");
const myFTudPClient = require("./client");

let mainWindow;

let ftpClient;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
        },
        icon: path.join(__dirname, "../../assets/images/logo.png"),
        title: "myFTudP - Cliente FTP com UDP",
        autoHideMenuBar: true,
    });

    mainWindow.setMenu(null);

    mainWindow.loadFile(path.join(__dirname, "renderer/index.html"));

    if (process.env.NODE_ENV === "development") {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on("closed", () => {
        mainWindow = null;
        if (ftpClient) {
            ftpClient.disconnect();
        }
    });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});

ipcMain.handle("ftp-connect", async (event, { address, port }) => {
    try {
        ftpClient = new myFTudPClient();

        ftpClient.on("connected", () => {
            mainWindow.webContents.send("ftp-connected");
        });

        ftpClient.on("disconnected", () => {
            mainWindow.webContents.send("ftp-disconnected");
        });

        ftpClient.on("authenticated", () => {
            mainWindow.webContents.send("ftp-authenticated");
        });

        ftpClient.on("uploadProgress", (data) => {
            mainWindow.webContents.send("upload-progress", data);
        });

        ftpClient.on("downloadProgress", (data) => {
            mainWindow.webContents.send("download-progress", data);
        });

        ftpClient.on("downloadStart", (data) => {
            mainWindow.webContents.send("download-start", data);
        });

        ftpClient.on("downloadComplete", (data) => {
            mainWindow.webContents.send("download-complete", data);
        });

        ftpClient.on("error", (error) => {
            mainWindow.webContents.send("ftp-error", error.message);
        });

        await ftpClient.connect(address, port);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("ftp-disconnect", async () => {
    if (ftpClient) {
        ftpClient.disconnect();
        ftpClient = null;
    }
    return { success: true };
});

ipcMain.handle("ftp-login", async (event, { username, password }) => {
    if (!ftpClient) {
        return { success: false, error: "Não conectado ao servidor" };
    }

    try {
        const result = await ftpClient.login(username, password);
        return { success: true, message: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("ftp-ls", async () => {
    if (!ftpClient) {
        return { success: false, error: "Não conectado ao servidor" };
    }

    try {
        const result = await ftpClient.ls();
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("ftp-cd", async (event, dirName) => {
    if (!ftpClient) {
        return { success: false, error: "Não conectado ao servidor" };
    }

    try {
        const result = await ftpClient.cd(dirName);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("ftp-mkdir", async (event, dirName) => {
    if (!ftpClient) {
        return { success: false, error: "Não conectado ao servidor" };
    }

    try {
        const result = await ftpClient.mkdir(dirName);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("ftp-rmdir", async (event, dirName) => {
    if (!ftpClient) {
        return { success: false, error: "Não conectado ao servidor" };
    }

    try {
        const result = await ftpClient.rmdir(dirName);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("ftp-put", async (event, { localPath, remoteName }) => {
    if (!ftpClient) {
        return { success: false, error: "Não conectado ao servidor" };
    }

    try {
        const result = await ftpClient.put(localPath, remoteName);
        return { success: true, message: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("ftp-get", async (event, { remoteName, localPath }) => {
    if (!ftpClient) {
        return { success: false, error: "Não conectado ao servidor" };
    }

    try {
        const result = await ftpClient.get(remoteName, localPath);
        return { success: true, message: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("select-file", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [{ name: "Todos os arquivos", extensions: ["*"] }],
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, filePath: result.filePaths[0] };
    }

    return { success: false };
});

ipcMain.handle("select-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, dirPath: result.filePaths[0] };
    }

    return { success: false };
});

ipcMain.handle("save-file-dialog", async (event, defaultName) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName,
        filters: [{ name: "Todos os arquivos", extensions: ["*"] }],
    });

    if (!result.canceled) {
        return { success: true, filePath: result.filePath };
    }

    return { success: false };
});

ipcMain.handle("read-local-directory", async (event, dirPath) => {
    try {
        const items = await fs.readdir(dirPath);
        const fileList = [];

        for (const item of items) {
            try {
                const itemPath = path.join(dirPath, item);
                const stats = await fs.stat(itemPath);

                fileList.push({
                    name: item,
                    type: stats.isDirectory() ? "directory" : "file",
                    size: stats.isDirectory() ? 0 : stats.size,
                    modified: stats.mtime,
                    path: itemPath,
                });
            } catch (err) { }
        }

        return { success: true, files: fileList };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle("get-user-home", () => {
    return require("os").homedir();
});

ipcMain.handle("join-path", (event, ...paths) => {
    return path.join(...paths);
});
