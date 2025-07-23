/**
 * @file app.js
 * @description Controlador principal da interface de usuário da aplicação myFTudP.
 * Esta classe gerencia toda a lógica da interface, incluindo navegação entre telas,
 * manipulação de eventos, comunicação com APIs do Electron e atualização dinâmica
 * da interface conforme as operações FTP são executadas.
 * 
 * Responsabilidades:
 * - Gerenciamento de estado da aplicação (conexão, autenticação, navegação)
 * - Controle de telas (conexão, interface principal)
 * - Manipulação de eventos de interface (cliques, drag & drop, teclado)
 * - Comunicação com APIs FTP através do preload script
 * - Atualização dinâmica de listas de arquivos
 * - Gerenciamento de transferências (upload/download)
 * - Sistema de notificações e feedback visual
 * - Operações de sistema de arquivos local
 * 
 * Padrões implementados:
 * - Separação de responsabilidades (métodos especializados)
 * - Event-driven architecture (listeners para APIs FTP)
 * - State management centralizado
 * - Error handling consistente
 * - Progressive enhancement (funcionalidades adicionais conforme disponibilidade)
 * 
 * @class myFTudPApp
 * @author Thalles Felipe
 * @version 1.0.0
 * @since 2025-01-23
 */
class myFTudPApp {
    /**
     * Construtor da aplicação principal
     * 
     * Inicializa o estado da aplicação, obtém referências para elementos DOM,
     * configura event listeners e executa inicialização assíncrona.
     */
    constructor() {
        // === Estado da Aplicação ===
        
        /** @private {boolean} isConnected - Status de conexão com servidor */
        this.isConnected = false;
        
        /** @private {boolean} isAuthenticated - Status de autenticação */
        this.isAuthenticated = false;
        
        /** @private {string} currentUser - Usuário autenticado atual */
        this.currentUser = '';
        
        /** @private {string} currentPath - Diretório atual no servidor */
        this.currentPath = '/';
        
        /** @private {string} localPath - Diretório local atual */
        this.localPath = '';
        
        /** @private {Element|null} selectedFile - Elemento de arquivo selecionado */
        this.selectedFile = null;
        
        /** @private {Map} transfers - Mapa de transferências ativas */
        this.transfers = new Map();
        
        // === Inicialização ===
        this.initializeElements();
        this.setupEventListeners();
        this.initializeApp();
    }

    /**
     * Inicializa referências para elementos DOM
     * 
     * Obtém e armazena referências para todos os elementos da interface
     * que serão manipulados pela aplicação, organizados por contexto.
     * 
     * @private
     */
    initializeElements() {
        // === Telas Principais ===
        this.connectionScreen = document.getElementById('connectionScreen');
        this.mainScreen = document.getElementById('mainScreen');

        // === Elementos da Tela de Conexão ===
        this.serverAddressInput = document.getElementById('serverAddress');
        this.serverPortInput = document.getElementById('serverPort');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.connectBtn = document.getElementById('connectBtn');
        this.connectionStatus = document.getElementById('connectionStatus');

        // === Elementos do Cabeçalho ===
        this.connectedServer = document.getElementById('connectedServer');
        this.loggedUser = document.getElementById('loggedUser');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.refreshBtn = document.getElementById('refreshBtn');

        // === Elementos de Navegação ===
        this.currentPathSpan = document.getElementById('currentPath');
        this.backBtn = document.getElementById('backBtn');
        this.homeBtn = document.getElementById('homeBtn');

        // === Elementos de Listagem de Arquivos ===
        this.localFileList = document.getElementById('localFileList');
        this.remoteFileList = document.getElementById('remoteFileList');
        this.localPath = document.getElementById('localPath');

        // === Controles dos Painéis ===
        this.localBrowseBtn = document.getElementById('localBrowseBtn');
        this.localRefreshBtn = document.getElementById('localRefreshBtn');
        this.remoteMkdirBtn = document.getElementById('remoteMkdirBtn');
        this.remoteRefreshBtn = document.getElementById('remoteRefreshBtn');

        // === Elementos de Transferência ===
        this.transferList = document.getElementById('transferList');
        this.clearTransfersBtn = document.getElementById('clearTransfersBtn');

        // === Elementos do Console ===
        this.commandInput = document.getElementById('commandInput');
        this.sendCommandBtn = document.getElementById('sendCommandBtn');
        this.clearConsoleBtn = document.getElementById('clearConsoleBtn');
        this.consoleOutput = document.getElementById('consoleOutput');

        this.mkdirModal = document.getElementById('mkdirModal');
        this.confirmModal = document.getElementById('confirmModal');
        this.contextMenu = document.getElementById('contextMenu');

        this.newDirNameInput = document.getElementById('newDirName');
        this.mkdirConfirmBtn = document.getElementById('mkdirConfirmBtn');
        this.confirmTitle = document.getElementById('confirmTitle');
        this.confirmMessage = document.getElementById('confirmMessage');
        this.confirmBtn = document.getElementById('confirmBtn');
    }

    setupEventListeners() {
        this.connectBtn.addEventListener('click', () => this.handleConnect());
        this.disconnectBtn.addEventListener('click', () => this.handleDisconnect());

        document.querySelectorAll('.test-account').forEach(account => {
            account.addEventListener('click', () => {
                const user = account.dataset.user;
                const pass = account.dataset.pass;
                this.usernameInput.value = user;
                this.passwordInput.value = pass;
            });
        });

        this.backBtn.addEventListener('click', () => this.goBack());
        this.homeBtn.addEventListener('click', () => this.goHome());
        this.refreshBtn.addEventListener('click', () => this.refreshAll());

        this.localBrowseBtn.addEventListener('click', () => this.browseLocalDirectory());
        this.localRefreshBtn.addEventListener('click', () => this.refreshLocalFiles());

        this.remoteMkdirBtn.addEventListener('click', () => this.showMkdirModal());
        this.remoteRefreshBtn.addEventListener('click', () => this.refreshRemoteFiles());

        this.clearTransfersBtn.addEventListener('click', () => this.clearTransfers());

        this.sendCommandBtn.addEventListener('click', () => this.sendCommand());
        this.clearConsoleBtn.addEventListener('click', () => this.clearConsole());
        this.commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendCommand();
        });

        this.setupModalEvents();

        this.setupContextMenu();

        this.setupFTPEvents();

        this.passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleConnect();
        });

        this.setupDragAndDrop();
    }

    setupModalEvents() {
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('active');
            });
        });

        this.mkdirConfirmBtn.addEventListener('click', () => this.createDirectory());
        this.newDirNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createDirectory();
        });

        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    }

    setupContextMenu() {
        this.remoteFileList.removeEventListener('contextmenu', this.handleContextMenuEvent);
        
        this.handleContextMenuEvent = (e) => {
            e.preventDefault();
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                this.showContextMenu(e.clientX, e.clientY, fileItem);
            }
        };

        this.remoteFileList.addEventListener('contextmenu', this.handleContextMenuEvent);

        this.contextMenu.addEventListener('click', (e) => {
            const action = e.target.closest('.context-item')?.dataset.action;
            if (action) {
                this.handleContextAction(action);
                this.hideContextMenu();
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        });
    }

    setupFTPEvents() {
        window.ftpAPI.onConnected(() => {
            this.showStatus('Conectado ao servidor', 'success');
        });

        window.ftpAPI.onDisconnected(() => {
            this.showStatus('Desconectado do servidor', 'error');
            this.handleDisconnect();
        });

        window.ftpAPI.onAuthenticated(() => {
            this.isAuthenticated = true;
            this.showMainScreen();
            this.refreshRemoteFiles();
        });

        window.ftpAPI.onError((event, error) => {
            this.logToConsole(error, 'error');
            this.showStatus(error, 'error');
        });

        window.ftpAPI.onUploadProgress((event, data) => {
            this.updateTransferProgress(data.fileName, data.progress, 'upload');
        });

        window.ftpAPI.onDownloadProgress((event, data) => {
            this.updateTransferProgress(data.fileName, data.progress, 'download');
        });

        window.ftpAPI.onDownloadStart((event, data) => {
            this.addTransfer(data.fileName, 'download');
        });

        window.ftpAPI.onDownloadComplete((event, data) => {
            this.completeTransfer(data.fileName);
            this.logToConsole(`Download concluído: ${data.fileName}`, 'response');
        });
    }

    setupDragAndDrop() {
        this.remoteFileList.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.remoteFileList.classList.add('drag-over');
        });

        this.remoteFileList.addEventListener('dragleave', (e) => {
            if (!this.remoteFileList.contains(e.relatedTarget)) {
                this.remoteFileList.classList.remove('drag-over');
            }
        });

        this.remoteFileList.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.remoteFileList.classList.remove('drag-over');
            
            if (e.dataTransfer.files.length > 0) {
                const files = Array.from(e.dataTransfer.files);
                for (const file of files) {
                    if (file.type !== '' || file.size > 0) {
                        await this.uploadFile(file.path, file.name);
                    }
                }
            }
            else if (e.dataTransfer.getData('text/plain')) {
                const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (dragData.source === 'local' && dragData.fileType === 'file') {
                    await this.uploadFile(dragData.filePath, dragData.fileName);
                }
            }
        });

        this.localFileList.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.localFileList.classList.add('drag-over');
        });

        this.localFileList.addEventListener('dragleave', (e) => {
            if (!this.localFileList.contains(e.relatedTarget)) {
                this.localFileList.classList.remove('drag-over');
            }
        });

        this.localFileList.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.localFileList.classList.remove('drag-over');
            
            if (e.dataTransfer.getData('text/plain')) {
                const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
                if (dragData.source === 'remote' && dragData.fileType === 'file') {
                    await this.downloadFileToPath(dragData.fileName, this.localPath);
                }
            }
        });
    }

    async initializeApp() {
        try {
            const homeDir = await window.fileAPI.getUserHome();
            this.localPath = homeDir;
            await this.refreshLocalFiles();
        } catch (error) {
            console.error('Erro ao carregar diretório home:', error);
        }
    }

    async handleConnect() {
        const address = this.serverAddressInput.value.trim();
        const port = parseInt(this.serverPortInput.value);
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;

        if (!address || !port || !username || !password) {
            this.showStatus('Preencha todos os campos', 'error');
            return;
        }

        this.connectBtn.disabled = true;
        this.connectBtn.innerHTML = '<span class="material-symbols-outlined spinning">progress_activity</span> Conectando...';

        try {
            console.log('Tentando conectar ao servidor...');
            const connectResult = await window.ftpAPI.connect(address, port);
            console.log('Resultado da conexão:', connectResult);
            if (!connectResult.success) {
                throw new Error(connectResult.error);
            }

            this.isConnected = true;
            console.log('Conectado! Tentando autenticar...');

            const loginResult = await window.ftpAPI.login(username, password);
            console.log('Resultado do login:', loginResult);
            if (!loginResult.success) {
                throw new Error(loginResult.error);
            }

            this.isAuthenticated = true;
            this.currentUser = username;
            this.connectedServer.textContent = `${address}:${port}`;
            this.loggedUser.textContent = `Usuário: ${username}`;

            console.log('Autenticado com sucesso! Mostrando tela principal...');
            this.showMainScreen();
            this.refreshRemoteFiles();
            this.showStatus('Conectado com sucesso!', 'success');

        } catch (error) {
            console.error('Erro na conexão:', error);
            this.showStatus(error.message, 'error');
        } finally {
            this.connectBtn.disabled = false;
            this.connectBtn.innerHTML = '<span class="material-symbols-outlined">electrical_services</span> Conectar';
        }
    }

    handleDisconnect() {
        if (window.ftpAPI) {
            window.ftpAPI.disconnect();
        }
        
        this.isConnected = false;
        this.isAuthenticated = false;
        this.currentUser = '';
        this.currentPath = '/';
        
        this.showConnectionScreen();
        this.clearTransfers();
        this.clearConsole();
    }

    showConnectionScreen() {
        this.connectionScreen.classList.add('active');
        this.mainScreen.classList.remove('active');
    }

    showMainScreen() {
        this.connectionScreen.classList.remove('active');
        this.mainScreen.classList.add('active');
        this.updateCurrentPath();
    }

    showStatus(message, type) {
        this.connectionStatus.textContent = message;
        this.connectionStatus.className = `status-message ${type}`;
        this.connectionStatus.style.display = 'block';
        
        setTimeout(() => {
            this.connectionStatus.style.display = 'none';
        }, 5000);
    }

    async refreshAll() {
        await Promise.all([
            this.refreshLocalFiles(),
            this.refreshRemoteFiles()
        ]);
    }

    async refreshLocalFiles() {
        if (!this.localPath) return;

        this.localFileList.innerHTML = '<div class="loading"><span class="material-symbols-outlined spinning">progress_activity</span> Carregando...</div>';
        
        try {
            const result = await window.fileAPI.readLocalDirectory(this.localPath);
            if (result.success) {
                this.displayLocalFiles(result.files);
                document.getElementById('localPath').textContent = this.localPath;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.localFileList.innerHTML = `<div class="error">Erro: ${error.message}</div>`;
        }
    }

    async refreshRemoteFiles() {
        if (!this.isAuthenticated) return;

        this.remoteFileList.innerHTML = '<div class="loading"><span class="material-symbols-outlined spinning">progress_activity</span> Carregando...</div>';
        
        try {
            const result = await window.ftpAPI.ls();
            if (result.success) {
                this.displayRemoteFiles(result.data);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            this.remoteFileList.innerHTML = `<div class="error">Erro: ${error.message}</div>`;
            this.logToConsole(`Erro ao listar arquivos: ${error.message}`, 'error');
        }
    }

    displayLocalFiles(files) {
        this.localFileList.innerHTML = '';
        
        files.forEach(file => {
            const fileElement = this.createFileElement(file, true);
            this.localFileList.appendChild(fileElement);
        });
    }

    displayRemoteFiles(data) {
        this.remoteFileList.innerHTML = '';
        
        if (data.startsWith('SUCCESS')) {
            const lines = data.split('\n').slice(1);
            
            lines.forEach(line => {
                if (line.trim()) {
                    const parts = line.split(' ');
                    const type = parts[0];
                    const name = parts[1];
                    const size = parts[2] || '0';
                    
                    const file = {
                        name: name,
                        type: type === 'DIR' ? 'directory' : 'file',
                        size: parseInt(size)
                    };
                    
                    const fileElement = this.createFileElement(file, false);
                    this.remoteFileList.appendChild(fileElement);
                }
            });
        } else {
            this.remoteFileList.innerHTML = `<div class="error">${data}</div>`;
        }
    }

    createFileElement(file, isLocal) {
        const div = document.createElement('div');
        div.className = `file-item ${file.type}`;
        div.dataset.fileName = file.name;
        div.dataset.fileType = file.type;
        if (isLocal) {
            div.dataset.filePath = file.path;
        }

        if (file.type === 'file') {
            div.draggable = true;
            div.addEventListener('dragstart', (e) => {
                const dragData = {
                    source: isLocal ? 'local' : 'remote',
                    fileName: file.name,
                    fileType: file.type,
                    filePath: isLocal ? file.path : null
                };
                e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
                e.dataTransfer.effectAllowed = 'copy';
                
                div.classList.add('dragging');
            });

            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
            });
        }

        const icon = file.type === 'directory' ? 'folder' : 'description';
        const sizeText = file.type === 'directory' ? '' : this.formatFileSize(file.size);

        div.innerHTML = `
            <span class="file-icon material-symbols-outlined">${icon}</span>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${sizeText}</div>
            </div>
        `;

        div.addEventListener('click', () => this.selectFile(div));
        div.addEventListener('dblclick', () => this.handleFileDoubleClick(div, isLocal));

        return div;
    }

    selectFile(element) {
        element.parentElement.querySelectorAll('.file-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        element.classList.add('selected');
        this.selectedFile = element;
    }

    async handleFileDoubleClick(element, isLocal) {
        const fileName = element.dataset.fileName;
        const fileType = element.dataset.fileType;

        if (isLocal) {
            if (fileType === 'directory') {
                this.localPath = element.dataset.filePath;
                await this.refreshLocalFiles();
            } else {
                await this.uploadFile(element.dataset.filePath, fileName);
            }
        } else {
            if (fileType === 'directory') {
                await this.changeDirectory(fileName);
            } else {
                await this.downloadFile(fileName);
            }
        }
    }

    async browseLocalDirectory() {
        const result = await window.fileAPI.selectDirectory();
        if (result.success) {
            this.localPath = result.dirPath;
            await this.refreshLocalFiles();
        }
    }

    async uploadFile(localPath, remoteName) {
        try {
            this.addTransfer(remoteName, 'upload');
            const result = await window.ftpAPI.put(localPath, remoteName);
            
            if (result.success) {
                this.logToConsole(`Upload concluído: ${remoteName}`, 'response');
                this.completeTransfer(remoteName);
                await this.refreshRemoteFiles();
            } else {
                this.logToConsole(`Erro no upload: ${result.error}`, 'error');
                this.removeTransfer(remoteName);
            }
        } catch (error) {
            this.logToConsole(`Erro no upload: ${error.message}`, 'error');
            this.removeTransfer(remoteName);
        }
    }

    async downloadFile(remoteName) {
        try {
            const saveResult = await window.fileAPI.saveFileDialog(remoteName);
            if (!saveResult.success) return;

            const result = await window.ftpAPI.get(remoteName, saveResult.filePath);
            
            if (!result.success) {
                this.logToConsole(`Erro no download: ${result.error}`, 'error');
            }
        } catch (error) {
            this.logToConsole(`Erro no download: ${error.message}`, 'error');
        }
    }

    async downloadFileToPath(remoteName, localDirectory) {
        try {
            const localFilePath = await window.fileAPI.joinPath(localDirectory, remoteName);
            
            const result = await window.ftpAPI.get(remoteName, localFilePath);
            
            if (result.success) {
                this.logToConsole(`Download concluído: ${remoteName} -> ${localFilePath}`, 'response');
                await this.refreshLocalFiles();
            } else {
                this.logToConsole(`Erro no download: ${result.error}`, 'error');
            }
        } catch (error) {
            this.logToConsole(`Erro no download: ${error.message}`, 'error');
        }
    }

    async changeDirectory(dirName) {
        try {
            const result = await window.ftpAPI.cd(dirName);
            if (result.success) {
                this.currentPath = result.data.split(' ').slice(1).join(' ');
                this.updateCurrentPath();
                await this.refreshRemoteFiles();
                this.logToConsole(`cd ${dirName}`, 'command');
                this.logToConsole(result.data, 'response');
            } else {
                this.logToConsole(`Erro: ${result.error}`, 'error');
            }
        } catch (error) {
            this.logToConsole(`Erro: ${error.message}`, 'error');
        }
    }

    async goBack() {
        await this.changeDirectory('..');
    }

    async goHome() {
        this.currentPath = '/';
        this.updateCurrentPath();
        await this.refreshRemoteFiles();
    }

    updateCurrentPath() {
        this.currentPathSpan.textContent = this.currentPath;
    }

    showMkdirModal() {
        this.mkdirModal.classList.add('active');
        this.newDirNameInput.value = '';
        this.newDirNameInput.focus();
    }

    async createDirectory() {
        const dirName = this.newDirNameInput.value.trim();
        if (!dirName) return;

        try {
            const result = await window.ftpAPI.mkdir(dirName);
            if (result.success) {
                this.logToConsole(`mkdir ${dirName}`, 'command');
                this.logToConsole(result.data, 'response');
                await this.refreshRemoteFiles();
            } else {
                this.logToConsole(`Erro: ${result.error}`, 'error');
            }
        } catch (error) {
            this.logToConsole(`Erro: ${error.message}`, 'error');
        }

        this.mkdirModal.classList.remove('active');
    }

    showContextMenu(x, y, fileItem) {
        this.contextMenu.style.left = x + 'px';
        this.contextMenu.style.top = y + 'px';
        this.contextMenu.style.display = 'block';
        
        this.contextMenu.dataset.fileName = fileItem.dataset.fileName;
        this.contextMenu.dataset.fileType = fileItem.dataset.fileType;
        
        const rect = this.contextMenu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        if (rect.right > windowWidth) {
            this.contextMenu.style.left = (x - rect.width) + 'px';
        }
        
        if (rect.bottom > windowHeight) {
            this.contextMenu.style.top = (y - rect.height) + 'px';
        }
    }

    hideContextMenu() {
        this.contextMenu.style.display = 'none';
        delete this.contextMenu.dataset.fileName;
        delete this.contextMenu.dataset.fileType;
    }

    async handleContextAction(action) {
        const fileName = this.contextMenu.dataset.fileName;
        const fileType = this.contextMenu.dataset.fileType;

        if (!fileName || !fileType) {
            console.error('Informações do arquivo não encontradas no menu de contexto');
            return;
        }

        console.log(`Ação do contexto: ${action}, Arquivo: ${fileName}, Tipo: ${fileType}`);

        try {
            switch (action) {
                case 'download':
                    if (fileType === 'file') {
                        await this.downloadFile(fileName);
                    } else {
                        this.showStatus('Não é possível baixar diretórios', 'error');
                    }
                    break;
                case 'delete':
                    await this.deleteFile(fileName, fileType);
                    break;
                default:
                    console.warn(`Ação desconhecida: ${action}`);
            }
        } catch (error) {
            console.error('Erro ao executar ação do menu de contexto:', error);
            this.showStatus(`Erro: ${error.message}`, 'error');
        }
    }

    async deleteFile(fileName, fileType) {
        const confirmMsg = `Tem certeza que deseja excluir ${fileType === 'directory' ? 'a pasta' : 'o arquivo'} "${fileName}"?`;
        
        if (confirm(confirmMsg)) {
            try {
                let result;
                if (fileType === 'directory') {
                    result = await window.ftpAPI.rmdir(fileName);
                } else {
                    this.logToConsole('Exclusão de arquivos não implementada ainda', 'error');
                    return;
                }

                if (result.success) {
                    this.logToConsole(`${fileType === 'directory' ? 'rmdir' : 'rm'} ${fileName}`, 'command');
                    this.logToConsole(result.data, 'response');
                    await this.refreshRemoteFiles();
                } else {
                    this.logToConsole(`Erro: ${result.error}`, 'error');
                }
            } catch (error) {
                this.logToConsole(`Erro: ${error.message}`, 'error');
            }
        }
    }

    async sendCommand() {
        const command = this.commandInput.value.trim();
        if (!command) return;

        this.commandInput.value = '';
        this.logToConsole(command, 'command');

        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);

        try {
            let result;
            
            switch (cmd) {
                case 'ls':
                    result = await window.ftpAPI.ls();
                    break;
                case 'cd':
                    if (args.length === 0) {
                        this.logToConsole('Uso: cd <nome_pasta>', 'error');
                        return;
                    }
                    await this.changeDirectory(args[0]);
                    return;
                case 'mkdir':
                    if (args.length === 0) {
                        this.logToConsole('Uso: mkdir <nome_pasta>', 'error');
                        return;
                    }
                    result = await window.ftpAPI.mkdir(args[0]);
                    break;
                case 'rmdir':
                    if (args.length === 0) {
                        this.logToConsole('Uso: rmdir <nome_pasta>', 'error');
                        return;
                    }
                    result = await window.ftpAPI.rmdir(args[0]);
                    break;
                case 'get':
                    if (args.length === 0) {
                        this.logToConsole('Uso: get <nome_arquivo>', 'error');
                        return;
                    }
                    await this.downloadFile(args[0]);
                    return;
                case 'put':
                    if (args.length === 0) {
                        this.logToConsole('Uso: put (selecione um arquivo local primeiro)', 'error');
                        return;
                    }
                    const fileResult = await window.fileAPI.selectFile();
                    if (fileResult.success) {
                        await this.uploadFile(fileResult.filePath, args[0] || undefined);
                    }
                    return;
                default:
                    this.logToConsole(`Comando não reconhecido: ${cmd}`, 'error');
                    return;
            }

            if (result) {
                if (result.success) {
                    this.logToConsole(result.data, 'response');
                    if (cmd === 'ls' || cmd === 'mkdir' || cmd === 'rmdir') {
                        await this.refreshRemoteFiles();
                    }
                } else {
                    this.logToConsole(result.error, 'error');
                }
            }
        } catch (error) {
            this.logToConsole(`Erro: ${error.message}`, 'error');
        }
    }

    logToConsole(message, type = 'response') {
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
        this.consoleOutput.appendChild(line);
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
    }

    clearConsole() {
        this.consoleOutput.innerHTML = '';
    }

    addTransfer(fileName, type) {
        const transferId = `${type}_${fileName}_${Date.now()}`;
        
        const transferItem = document.createElement('div');
        transferItem.className = 'transfer-item';
        transferItem.dataset.transferId = transferId;
        
        transferItem.innerHTML = `
            <div class="transfer-info">
                <div class="transfer-name">
                    <span class="material-symbols-outlined">${type === 'upload' ? 'upload' : 'download'}</span>
                    ${fileName}
                </div>
                <div class="transfer-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <div class="progress-text">0%</div>
                </div>
            </div>
        `;

        const noTransfers = this.transferList.querySelector('.no-transfers');
        if (noTransfers) {
            noTransfers.remove();
        }

        this.transferList.appendChild(transferItem);
        this.transfers.set(fileName, { element: transferItem, type: type });
    }

    updateTransferProgress(fileName, progress, type) {
        const transfer = this.transfers.get(fileName);
        if (transfer && transfer.type === type) {
            const progressFill = transfer.element.querySelector('.progress-fill');
            const progressText = transfer.element.querySelector('.progress-text');
            
            progressFill.style.width = progress + '%';
            progressText.textContent = progress + '%';
        }
    }

    completeTransfer(fileName) {
        const transfer = this.transfers.get(fileName);
        if (transfer) {
            setTimeout(() => {
                this.removeTransfer(fileName);
            }, 2000);
        }
    }

    removeTransfer(fileName) {
        const transfer = this.transfers.get(fileName);
        if (transfer) {
            transfer.element.remove();
            this.transfers.delete(fileName);
            
            if (this.transfers.size === 0) {
                this.transferList.innerHTML = `
                    <div class="no-transfers">
                        <span class="material-symbols-outlined">info</span>
                        Nenhuma transferência ativa
                    </div>
                `;
            }
        }
    }

    clearTransfers() {
        this.transfers.clear();
        this.transferList.innerHTML = `
            <div class="no-transfers">
                <span class="material-symbols-outlined">info</span>
                Nenhuma transferência ativa
            </div>
        `;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new myFTudPApp();
});
