/**
 * @file client.js
 * @description Implementação do cliente FTP sobre UDP (myFTudP Client).
 * Este arquivo contém a lógica principal do cliente que se conecta ao servidor,
 * realiza autenticação e executa operações de transferência de arquivos.
 * 
 * O cliente implementa:
 * - Conexão UDP com o servidor
 * - Autenticação de usuário
 * - Upload de arquivos com fragmentação
 * - Download de arquivos com reagrupamento
 * - Operações de navegação em diretórios
 * - Sistema de eventos para comunicação com a interface
 * 
 * @author Thalles Felipe
 * @version 1.0.0
 * @since 2025-01-23
 */

const dgram = require('dgram');
const fs = require('fs-extra');
const path = require('path');
const { EventEmitter } = require('events');
const Protocol = require('../shared/protocol');

/**
 * Cliente FTP sobre UDP com sistema de eventos
 * 
 * Estende EventEmitter para permitir comunicação assíncrona com a interface.
 * Gerencia conexão, autenticação e todas as operações FTP suportadas.
 * 
 * @class myFTudPClient
 * @extends EventEmitter
 * 
 * @fires myFTudPClient#connected - Quando conecta ao servidor
 * @fires myFTudPClient#disconnected - Quando desconecta do servidor
 * @fires myFTudPClient#authenticated - Quando autenticação é bem-sucedida
 * @fires myFTudPClient#error - Quando ocorre um erro
 * @fires myFTudPClient#uploadProgress - Durante progresso de upload
 * @fires myFTudPClient#downloadProgress - Durante progresso de download
 */
class myFTudPClient extends EventEmitter {
    /**
     * Construtor do cliente myFTudP
     * 
     * Inicializa o cliente com socket UDP, estruturas de controle
     * e configuração inicial dos event listeners.
     */
    constructor() {
        super();
        
        /** @private {dgram.Socket} socket - Socket UDP para comunicação */
        this.socket = dgram.createSocket('udp4');
        
        /** @private {string|null} serverAddress - Endereço IP do servidor */
        this.serverAddress = null;
        
        /** @private {number|null} serverPort - Porta do servidor */
        this.serverPort = null;
        
        /** @private {boolean} connected - Status de conexão */
        this.connected = false;
        
        /** @private {boolean} authenticated - Status de autenticação */
        this.authenticated = false;
        
        /** @private {string|null} currentUser - Usuário autenticado */
        this.currentUser = null;
        
        /** @private {number} packetId - Contador sequencial de pacotes */
        this.packetId = 1;
        
        /** @private {Map} pendingRequests - Requisições aguardando resposta */
        this.pendingRequests = new Map();
        
        /** @private {Object|null} currentTransfer - Transferência ativa */
        this.currentTransfer = null;
        
        this.setupSocket();
    }

    /**
     * Configura os event listeners do socket UDP
     * 
     * Define handlers para mensagens recebidas e erros de comunicação.
     * Estabelece o pipeline de processamento de respostas do servidor.
     * 
     * @private
     */
    setupSocket() {
        // Handler para mensagens recebidas do servidor
        this.socket.on('message', (msg, rinfo) => {
            this.handleMessage(msg, rinfo);
        });

        // Handler para erros do socket
        this.socket.on('error', (err) => {
            console.error('Erro no cliente:', err);
            this.emit('error', err);
        });
    }

    /**
     * Estabelece conexão com o servidor FTP
     * 
     * Configura os parâmetros de conexão e tenta estabelecer
     * comunicação com o servidor especificado.
     * 
     * @param {string} address - Endereço IP do servidor
     * @param {number} port - Porta do servidor
     * @returns {Promise<void>} Promise que resolve quando conectado
     * 
     * @example
     * client.connect('192.168.1.100', 21000)
     *   .then(() => console.log('Conectado!'))
     *   .catch(err => console.error('Erro:', err));
     */
    connect(address, port) {
        return new Promise((resolve, reject) => {
            this.serverAddress = address;
            this.serverPort = port;
            
            try {
                this.connected = true;
                this.emit('connected');
                resolve();
            } catch (error) {
                this.connected = false;
                reject(error);
            }
        });
    }

    disconnect() {
        this.connected = false;
        this.authenticated = false;
        this.currentUser = null;
        this.socket.close();
        this.emit('disconnected');
    }

    login(username, password) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('Não conectado ao servidor'));
                return;
            }

            const data = `${username} ${password}`;
            const packetId = this.getNextPacketId();
            
            this.sendPacket(Protocol.PACKET_TYPES.LOGIN, data, packetId);
            
            this.pendingRequests.set(packetId, {
                type: 'login',
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error('Timeout na resposta do servidor'));
                }, Protocol.TIMEOUT)
            });
        });
    }

    put(localFilePath, remoteFileName) {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error('Cliente não autenticado'));
                return;
            }

            if (!fs.existsSync(localFilePath)) {
                reject(new Error('Arquivo local não encontrado'));
                return;
            }

        const fileName = remoteFileName || path.basename(localFilePath);
        const fileData = fs.readFileSync(localFilePath);
        const packets = Protocol.fragmentData(fileData, Protocol.PACKET_TYPES.PUT_DATA);
        
        console.log(`Preparando upload: ${fileName} (${fileData.length} bytes, ${packets.length} pacotes)`);
        
        const packetId = this.getNextPacketId();
        
        this.sendPacket(Protocol.PACKET_TYPES.PUT, `${fileName} ${packets.length}`, packetId);            this.currentTransfer = {
                type: 'put',
                packets: packets,
                currentPacket: 0,
                fileName: fileName,
                resolve: resolve,
                reject: reject
            };

            this.pendingRequests.set(packetId, {
                type: 'put_init',
                resolve: (response) => {
                    if (response.startsWith(Protocol.STATUS.SUCCESS)) {
                        this.sendFilePackets();
                    } else {
                        reject(new Error(response));
                    }
                },
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error('Timeout na resposta do servidor'));
                }, Protocol.TIMEOUT)
            });
        });
    }

    sendFilePackets() {
        if (!this.currentTransfer || this.currentTransfer.currentPacket >= this.currentTransfer.packets.length) {
            return;
        }

        const packetData = this.currentTransfer.packets[this.currentTransfer.currentPacket];
        const packet = Protocol.createPacket(
            packetData.id,
            packetData.type,
            packetData.data,
            packetData.checksum
        );

        console.log(`Enviando pacote ${packetData.id} (${this.currentTransfer.currentPacket + 1}/${this.currentTransfer.packets.length})`);

        this.socket.send(packet, this.serverPort, this.serverAddress);
        this.currentTransfer.currentPacket++;

        const progress = (this.currentTransfer.currentPacket / this.currentTransfer.packets.length) * 100;
        this.emit('uploadProgress', {
            fileName: this.currentTransfer.fileName,
            progress: Math.round(progress),
            sent: this.currentTransfer.currentPacket,
            total: this.currentTransfer.packets.length
        });

        if (this.currentTransfer.currentPacket < this.currentTransfer.packets.length) {
            setTimeout(() => this.sendFilePackets(), 10);
        } else {
            console.log(`Todos os pacotes enviados para ${this.currentTransfer.fileName}`);
            setTimeout(() => {
                if (this.currentTransfer) {
                    this.currentTransfer.resolve('Upload concluído com sucesso');
                    this.currentTransfer = null;
                }
            }, 1000);
        }
    }

    get(remoteFileName, localFilePath) {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error('Cliente não autenticado'));
                return;
            }

            const packetId = this.getNextPacketId();
            
            this.sendPacket(Protocol.PACKET_TYPES.GET, remoteFileName, packetId);
            
            this.currentTransfer = {
                type: 'get',
                fileName: remoteFileName,
                localPath: localFilePath || remoteFileName,
                packets: [],
                expectedPackets: 0,
                resolve: resolve,
                reject: reject
            };

            this.pendingRequests.set(packetId, {
                type: 'get_init',
                resolve: (response) => {
                    if (response.startsWith(Protocol.STATUS.SUCCESS)) {
                        const parts = response.split(' ');
                        this.currentTransfer.expectedPackets = parseInt(parts[1]) || 0;
                        this.emit('downloadStart', {
                            fileName: remoteFileName,
                            expectedPackets: this.currentTransfer.expectedPackets
                        });
                    } else {
                        reject(new Error(response));
                        this.currentTransfer = null;
                    }
                },
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error('Timeout na resposta do servidor'));
                    this.currentTransfer = null;
                }, Protocol.TIMEOUT)
            });
        });
    }

    ls() {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error('Cliente não autenticado'));
                return;
            }

            const packetId = this.getNextPacketId();
            
            this.sendPacket(Protocol.PACKET_TYPES.LS, '', packetId);
            
            this.pendingRequests.set(packetId, {
                type: 'ls',
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error('Timeout na resposta do servidor'));
                }, Protocol.TIMEOUT)
            });
        });
    }

    cd(dirName) {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error('Cliente não autenticado'));
                return;
            }

            const packetId = this.getNextPacketId();
            
            this.sendPacket(Protocol.PACKET_TYPES.CD, dirName, packetId);
            
            this.pendingRequests.set(packetId, {
                type: 'cd',
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error('Timeout na resposta do servidor'));
                }, Protocol.TIMEOUT)
            });
        });
    }

    mkdir(dirName) {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error('Cliente não autenticado'));
                return;
            }

            const packetId = this.getNextPacketId();
            
            this.sendPacket(Protocol.PACKET_TYPES.MKDIR, dirName, packetId);
            
            this.pendingRequests.set(packetId, {
                type: 'mkdir',
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error('Timeout na resposta do servidor'));
                }, Protocol.TIMEOUT)
            });
        });
    }

    rmdir(dirName) {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error('Cliente não autenticado'));
                return;
            }

            const packetId = this.getNextPacketId();
            
            this.sendPacket(Protocol.PACKET_TYPES.RMDIR, dirName, packetId);
            
            this.pendingRequests.set(packetId, {
                type: 'rmdir',
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error('Timeout na resposta do servidor'));
                }, Protocol.TIMEOUT)
            });
        });
    }

    handleMessage(msg, rinfo) {
        try {
            const packet = Protocol.parsePacket(msg);
            
            if (packet.type === Protocol.PACKET_TYPES.GET_DATA && this.currentTransfer && this.currentTransfer.type === 'get') {
                this.handleDownloadPacket(packet);
                return;
            }

            const request = this.pendingRequests.get(packet.id);
            if (request) {
                clearTimeout(request.timeout);
                this.pendingRequests.delete(packet.id);
                
                const response = packet.data.toString();
                
                if (packet.type === Protocol.PACKET_TYPES.LOGIN_RESPONSE) {
                    if (response === Protocol.STATUS.SUCCESS) {
                        this.authenticated = true;
                        this.emit('authenticated');
                        request.resolve('Login realizado com sucesso');
                    } else {
                        request.reject(new Error(this.getErrorMessage(response)));
                    }
                } else {
                    request.resolve(response);
                }
            }
        } catch (error) {
            console.error('Erro ao processar resposta:', error);
        }
    }

    handleDownloadPacket(packet) {
        if (!this.currentTransfer || this.currentTransfer.type !== 'get') {
            return;
        }

        this.currentTransfer.packets.push(packet);
        
        this.sendAck(packet.id);

        const progress = (this.currentTransfer.packets.length / this.currentTransfer.expectedPackets) * 100;
        this.emit('downloadProgress', {
            fileName: this.currentTransfer.fileName,
            progress: Math.round(progress),
            received: this.currentTransfer.packets.length,
            total: this.currentTransfer.expectedPackets
        });

        if (this.currentTransfer.packets.length >= this.currentTransfer.expectedPackets) {
            this.completeDownload();
        }
    }

    completeDownload() {
        try {
            const data = Protocol.reassembleData(this.currentTransfer.packets);
            fs.writeFileSync(this.currentTransfer.localPath, data);
            
            this.currentTransfer.resolve('Download concluído com sucesso');
            this.emit('downloadComplete', {
                fileName: this.currentTransfer.fileName,
                localPath: this.currentTransfer.localPath
            });
        } catch (error) {
            this.currentTransfer.reject(error);
        } finally {
            this.currentTransfer = null;
        }
    }

    sendPacket(type, data, packetId) {
        const packet = Protocol.createPacket(packetId, type, data);
        this.socket.send(packet, this.serverPort, this.serverAddress);
    }

    sendAck(packetId) {
        const packet = Protocol.createPacket(packetId, Protocol.PACKET_TYPES.ACK, '');
        this.socket.send(packet, this.serverPort, this.serverAddress);
    }

    getNextPacketId() {
        return this.packetId++;
    }

    getErrorMessage(status) {
        const messages = {
            [Protocol.STATUS.USER_NOT_FOUND]: 'Usuário não encontrado',
            [Protocol.STATUS.WRONG_PASSWORD]: 'Senha incorreta',
            [Protocol.STATUS.FILE_NOT_FOUND]: 'Arquivo não encontrado',
            [Protocol.STATUS.DIRECTORY_NOT_FOUND]: 'Diretório não encontrado',
            [Protocol.STATUS.PERMISSION_DENIED]: 'Permissão negada',
            [Protocol.STATUS.ALREADY_EXISTS]: 'Já existe',
            [Protocol.STATUS.NOT_EMPTY]: 'Diretório não está vazio'
        };
        
        return messages[status] || status;
    }
}

module.exports = myFTudPClient;
