/**
 * @file preload.js
 * @description Script de preload do Electron que estabelece a ponte segura
 * entre o renderer process (interface web) e o main process (Node.js).
 * Este arquivo é carregado no contexto isolado do renderer e expõe APIs
 * específicas através do contextBridge, mantendo a segurança da aplicação.
 * 
 * APIs expostas:
 * - ftpAPI: Operações do cliente FTP (conectar, upload, download, navegação)
 * - fileAPI: Operações de sistema de arquivos (diálogos, leitura local)
 * 
 * Segurança:
 * - Usa contextBridge para exposição segura de APIs
 * - Não expõe Node.js diretamente ao renderer
 * - Valida e filtra comunicação entre processos
 * 
 * @author Thalles Felipe
 * @version 1.0.0
 * @since 2025-01-23
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * API para operações FTP
 * 
 * Expõe métodos para comunicação com o servidor FTP através
 * do main process, incluindo gerenciamento de conexão,
 * autenticação e operações de arquivos.
 */
contextBridge.exposeInMainWorld('ftpAPI', {
    // === Operações de Conexão ===
    
    /**
     * Conecta ao servidor FTP
     * @param {string} address - Endereço IP do servidor
     * @param {number} port - Porta do servidor
     * @returns {Promise<Object>} Resultado da conexão
     */
    connect: (address, port) => ipcRenderer.invoke('ftp-connect', { address, port }),
    
    /**
     * Desconecta do servidor FTP
     * @returns {Promise<Object>} Resultado da desconexão
     */
    disconnect: () => ipcRenderer.invoke('ftp-disconnect'),
    
    /**
     * Realiza autenticação no servidor
     * @param {string} username - Nome de usuário
     * @param {string} password - Senha
     * @returns {Promise<Object>} Resultado da autenticação
     */
    login: (username, password) => ipcRenderer.invoke('ftp-login', { username, password }),

    // === Operações de Arquivos e Diretórios ===
    
    /**
     * Lista conteúdo do diretório atual no servidor
     * @returns {Promise<Object>} Lista de arquivos e diretórios
     */
    ls: () => ipcRenderer.invoke('ftp-ls'),
    
    /**
     * Muda diretório no servidor
     * @param {string} dirName - Nome do diretório
     * @returns {Promise<Object>} Resultado da operação
     */
    cd: (dirName) => ipcRenderer.invoke('ftp-cd', dirName),
    
    /**
     * Cria diretório no servidor
     * @param {string} dirName - Nome do novo diretório
     * @returns {Promise<Object>} Resultado da criação
     */
    mkdir: (dirName) => ipcRenderer.invoke('ftp-mkdir', dirName),
    
    /**
     * Remove diretório do servidor
     * @param {string} dirName - Nome do diretório a remover
     * @returns {Promise<Object>} Resultado da remoção
     */
    rmdir: (dirName) => ipcRenderer.invoke('ftp-rmdir', dirName),
    
    /**
     * Envia arquivo para o servidor (upload)
     * @param {string} localPath - Caminho local do arquivo
     * @param {string} remoteName - Nome no servidor
     * @returns {Promise<Object>} Resultado do upload
     */
    put: (localPath, remoteName) => ipcRenderer.invoke('ftp-put', { localPath, remoteName }),
    
    /**
     * Baixa arquivo do servidor (download)
     * @param {string} remoteName - Nome do arquivo no servidor
     * @param {string} localPath - Caminho local de destino
     * @returns {Promise<Object>} Resultado do download
     */
    get: (remoteName, localPath) => ipcRenderer.invoke('ftp-get', { remoteName, localPath }),

    // === Event Listeners ===
    
    /**
     * Registra listener para evento de conexão estabelecida
     * @param {Function} callback - Função callback
     */
    onConnected: (callback) => ipcRenderer.on('ftp-connected', callback),
    
    /**
     * Registra listener para evento de desconexão
     * @param {Function} callback - Função callback
     */
    onDisconnected: (callback) => ipcRenderer.on('ftp-disconnected', callback),
    
    /**
     * Registra listener para evento de autenticação bem-sucedida
     * @param {Function} callback - Função callback
     */
    onAuthenticated: (callback) => ipcRenderer.on('ftp-authenticated', callback),
    
    /**
     * Registra listener para eventos de erro
     * @param {Function} callback - Função callback
     */
    onError: (callback) => ipcRenderer.on('ftp-error', callback),
    
    /**
     * Registra listener para progresso de upload
     * @param {Function} callback - Função callback com dados de progresso
     */
    onUploadProgress: (callback) => ipcRenderer.on('upload-progress', callback),
    
    /**
     * Registra listener para progresso de download
     * @param {Function} callback - Função callback com dados de progresso
     */
    onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
    
    /**
     * Registra listener para início de download
     * @param {Function} callback - Função callback
     */
    onDownloadStart: (callback) => ipcRenderer.on('download-start', callback),
    
    /**
     * Registra listener para conclusão de download
     * @param {Function} callback - Função callback
     */
    onDownloadComplete: (callback) => ipcRenderer.on('download-complete', callback),

    /**
     * Remove todos os listeners de um canal específico
     * @param {string} channel - Nome do canal
     */
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

/**
 * API para operações de sistema de arquivos local
 * 
 * Expõe métodos para interagir com o sistema de arquivos local,
 * incluindo diálogos de abertura/salvamento e navegação em diretórios.
 */
contextBridge.exposeInMainWorld('fileAPI', {
    /**
     * Abre diálogo para seleção de arquivo
     * @returns {Promise<Object>} Informações do arquivo selecionado
     */
    selectFile: () => ipcRenderer.invoke('select-file'),
    
    /**
     * Abre diálogo para seleção de diretório
     * @returns {Promise<Object>} Informações do diretório selecionado
     */
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    
    /**
     * Abre diálogo para salvar arquivo
     * @param {string} defaultName - Nome padrão do arquivo
     * @returns {Promise<Object>} Caminho de salvamento escolhido
     */
    saveFileDialog: (defaultName) => ipcRenderer.invoke('save-file-dialog', defaultName),
    
    /**
     * Lê conteúdo de diretório local
     * @param {string} dirPath - Caminho do diretório
     * @returns {Promise<Array>} Lista de arquivos e diretórios
     */
    readLocalDirectory: (dirPath) => ipcRenderer.invoke('read-local-directory', dirPath),
    
    /**
     * Obtém diretório home do usuário
     * @returns {Promise<string>} Caminho do diretório home
     */
    getUserHome: () => ipcRenderer.invoke('get-user-home'),
    
    /**
     * Junta caminhos de forma segura
     * @param {...string} paths - Segmentos de caminho
     * @returns {Promise<string>} Caminho combinado
     */
    joinPath: (...paths) => ipcRenderer.invoke('join-path', ...paths)
});
