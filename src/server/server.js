const dgram = require('dgram');
const fs = require('fs-extra');
const path = require('path');
const { Worker } = require('worker_threads');
const Protocol = require('../shared/protocol');
class myFTudPServer {
    constructor(port = 21000, serverRoot = './data/server-files') {
        this.port = port;
        this.serverRoot = path.resolve(serverRoot);
        this.socket = dgram.createSocket('udp4');
        this.clients = new Map();
        this.pendingTransfers = new Map();
        this.users = this.loadUsers();
        this.setupSocket();
        this.ensureServerDirectory();
    }
    setupSocket() {
        this.socket.on('message', (msg, rinfo) => {
            this.handleMessage(msg, rinfo);
        });
        this.socket.on('error', (err) => {
            console.error('Erro no servidor:', err);
        });
        this.socket.on('listening', () => {
            const address = this.socket.address();
            console.log(`Servidor myFTudP rodando em ${address.address}:${address.port}`);
        });
    }
    ensureServerDirectory() {
        if (!fs.existsSync(this.serverRoot)) {
            fs.mkdirSync(this.serverRoot, { recursive: true });
            console.log(`Diretório do servidor criado: ${this.serverRoot}`);
        }
    }
    loadUsers() {
        return {
            'thalles': 'thalles123',
            'daniel': 'daniel123',
            'user': 'user123',
            'teste': 'teste123'
        };
    }
    start() {
        this.socket.bind(this.port);
    }
    stop() {
        this.socket.close();
    }
    getClientId(rinfo) {
        return `${rinfo.address}:${rinfo.port}`;
    }
    handleMessage(msg, rinfo) {
        try {
            const packet = Protocol.parsePacket(msg);
            const clientId = this.getClientId(rinfo);
            console.log(`Pacote recebido de ${clientId}: ${packet.type} (ID: ${packet.id})`);
            this.processCommand(packet, rinfo, clientId);
        } catch (error) {
            console.error('Erro ao processar mensagem:', error);
            this.sendError(rinfo, 'Erro no formato do pacote');
        }
    }
    processCommand(packet, rinfo, clientId) {
        const { type, data, id } = packet;
        switch (type) {
            case Protocol.PACKET_TYPES.LOGIN:
                this.handleLogin(data, rinfo, clientId, id);
                break;
            case Protocol.PACKET_TYPES.PUT:
                this.handlePut(data, rinfo, clientId, id);
                break;
            case Protocol.PACKET_TYPES.PUT_DATA:
                this.handlePutData(packet, rinfo, clientId);
                break;
            case Protocol.PACKET_TYPES.GET:
                this.handleGet(data, rinfo, clientId, id);
                break;
            case Protocol.PACKET_TYPES.LS:
                this.handleLs(rinfo, clientId, id);
                break;
            case Protocol.PACKET_TYPES.CD:
                this.handleCd(data, rinfo, clientId, id);
                break;
            case Protocol.PACKET_TYPES.MKDIR:
                this.handleMkdir(data, rinfo, clientId, id);
                break;
            case Protocol.PACKET_TYPES.RMDIR:
                this.handleRmdir(data, rinfo, clientId, id);
                break;
            case Protocol.PACKET_TYPES.ACK:
                this.handleAck(packet, rinfo, clientId);
                break;
            default:
                this.sendError(rinfo, 'Comando não reconhecido');
        }
    }
    handleLogin(data, rinfo, clientId, packetId) {
        console.log(`Tentativa de login de ${clientId}: ${data.toString()}`);
        const credentials = data.toString().split(' ');
        if (credentials.length !== 2) {
            console.log('Formato inválido de credenciais');
            this.sendResponse(rinfo, Protocol.PACKET_TYPES.LOGIN_RESPONSE,
                Protocol.STATUS.ERROR + ' Formato inválido', packetId);
            return;
        }
        const [username, password] = credentials;
        console.log(`Usuário: ${username}, Senha: ${password}`);
        if (!this.users[username]) {
            console.log(`Usuário ${username} não encontrado`);
            this.sendResponse(rinfo, Protocol.PACKET_TYPES.LOGIN_RESPONSE,
                Protocol.STATUS.USER_NOT_FOUND, packetId);
            return;
        }
        if (this.users[username] !== password) {
            console.log(`Senha incorreta para usuário ${username}`);
            this.sendResponse(rinfo, Protocol.PACKET_TYPES.LOGIN_RESPONSE,
                Protocol.STATUS.WRONG_PASSWORD, packetId);
            return;
        }
        console.log(`Login bem-sucedido para usuário ${username}`);
        this.clients.set(clientId, {
            username: username,
            currentDir: '/',
            authenticated: true,
            rinfo: rinfo
        });
        this.sendResponse(rinfo, Protocol.PACKET_TYPES.LOGIN_RESPONSE,
            Protocol.STATUS.SUCCESS, packetId);
        console.log(`Cliente ${username} logado de ${clientId}`);
    }
    handlePut(data, rinfo, clientId, packetId) {
        if (!this.isAuthenticated(clientId)) {
            this.sendError(rinfo, 'Cliente não autenticado');
            return;
        }
        const putData = data.toString().trim().split(' ');
        const filename = putData[0];
        const expectedPackets = parseInt(putData[1]) || 0;
        const client = this.clients.get(clientId);
        const targetPath = this.getAbsolutePath(client.currentDir, filename);
        console.log(`Preparando para receber arquivo: ${filename} (${expectedPackets} pacotes)`);
        const transferId = `put_${clientId}_${Date.now()}`;
        this.pendingTransfers.set(transferId, {
            type: 'put',
            filename: filename,
            targetPath: targetPath,
            clientId: clientId,
            packets: [],
            expectedPackets: expectedPackets,
            receivedPackets: 0,
            startTime: Date.now()
        });
        this.sendResponse(rinfo, Protocol.PACKET_TYPES.PUT_RESPONSE,
            `${Protocol.STATUS.SUCCESS} ${transferId}`, packetId);
    }
    handlePutData(packet, rinfo, clientId) {
        const transfer = Array.from(this.pendingTransfers.values())
            .find(t => t.clientId === clientId && t.type === 'put');
        if (!transfer) {
            console.log(`Transferência não encontrada para cliente ${clientId}`);
            this.sendError(rinfo, 'Transferência não encontrada');
            return;
        }
        transfer.packets.push(packet);
        transfer.receivedPackets++;
        console.log(`Pacote ${packet.id} recebido (${transfer.receivedPackets}/${transfer.expectedPackets})`);
        this.sendAck(rinfo, packet.id);
        if (transfer.expectedPackets > 0 && transfer.receivedPackets >= transfer.expectedPackets) {
            console.log(`Todos os pacotes recebidos para ${transfer.filename}`);
            this.completePutTransfer(transfer, rinfo);
        } else if (transfer.expectedPackets === 0) {
            clearTimeout(transfer.timeout);
            transfer.timeout = setTimeout(() => {
                console.log(`Timeout atingido para ${transfer.filename}, finalizando upload`);
                this.completePutTransfer(transfer, rinfo);
            }, 2000);
        }
    }
    completePutTransfer(transfer, rinfo) {
        try {
            console.log(`Iniciando finalização do upload de ${transfer.filename}`);
            console.log(`Pacotes recebidos: ${transfer.packets.length}`);
            const targetDir = path.dirname(transfer.targetPath);
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
                console.log(`Diretório criado: ${targetDir}`);
            }
            const data = Protocol.reassembleData(transfer.packets);
            console.log(`Dados reassemblados: ${data.length} bytes`);
            fs.writeFileSync(transfer.targetPath, data);
            console.log(`Arquivo salvo em: ${transfer.targetPath}`);
            if (fs.existsSync(transfer.targetPath)) {
                const stats = fs.statSync(transfer.targetPath);
                console.log(`Arquivo confirmado: ${stats.size} bytes`);
                this.sendResponse(rinfo, Protocol.PACKET_TYPES.PUT_RESPONSE,
                    Protocol.STATUS.SUCCESS + ` Upload concluído: ${transfer.filename} (${stats.size} bytes)`);
            } else {
                throw new Error('Arquivo não foi criado');
            }
            const transferId = Array.from(this.pendingTransfers.entries())
                .find(([id, t]) => t === transfer)?.[0];
            if (transferId) {
                this.pendingTransfers.delete(transferId);
                console.log(`Transferência ${transferId} removida`);
            }
            if (transfer.timeout) {
                clearTimeout(transfer.timeout);
            }
            console.log(`Upload de ${transfer.filename} concluído com sucesso`);
        } catch (error) {
            console.error(`Erro ao finalizar upload de ${transfer.filename}:`, error);
            this.sendError(rinfo, `Erro ao salvar arquivo: ${error.message}`);
        }
    }
    handleGet(data, rinfo, clientId, packetId) {
        if (!this.isAuthenticated(clientId)) {
            this.sendError(rinfo, 'Cliente não autenticado');
            return;
        }
        const filename = data.toString().trim();
        const client = this.clients.get(clientId);
        const filePath = this.getAbsolutePath(client.currentDir, filename);
        try {
            if (!fs.existsSync(filePath)) {
                this.sendResponse(rinfo, Protocol.PACKET_TYPES.GET_RESPONSE,
                    Protocol.STATUS.FILE_NOT_FOUND, packetId);
                return;
            }
            const fileData = fs.readFileSync(filePath);
            const packets = Protocol.fragmentData(fileData, Protocol.PACKET_TYPES.GET_DATA);
            this.sendResponse(rinfo, Protocol.PACKET_TYPES.GET_RESPONSE,
                `${Protocol.STATUS.SUCCESS} ${packets.length}`, packetId);
            packets.forEach((packetData, index) => {
                setTimeout(() => {
                    const packet = Protocol.createPacket(
                        packetData.id,
                        packetData.type,
                        packetData.data,
                        packetData.checksum
                    );
                    this.socket.send(packet, rinfo.port, rinfo.address);
                }, index * 10);
            });
            console.log(`Enviando arquivo ${filename} (${packets.length} pacotes)`);
        } catch (error) {
            this.sendError(rinfo, `Erro ao ler arquivo: ${error.message}`);
        }
    }
    handleLs(rinfo, clientId, packetId) {
        if (!this.isAuthenticated(clientId)) {
            this.sendError(rinfo, 'Cliente não autenticado');
            return;
        }
        const client = this.clients.get(clientId);
        const dirPath = this.getAbsolutePath(client.currentDir, '');
        try {
            const items = fs.readdirSync(dirPath);
            const fileList = items.map(item => {
                const itemPath = path.join(dirPath, item);
                const stats = fs.statSync(itemPath);
                const type = stats.isDirectory() ? 'DIR' : 'FILE';
                const size = stats.isDirectory() ? 0 : stats.size;
                return `${type} ${item} ${size}`;
            }).join('\n');
            this.sendResponse(rinfo, Protocol.PACKET_TYPES.LS_RESPONSE,
                Protocol.STATUS.SUCCESS + '\n' + fileList, packetId);
        } catch (error) {
            this.sendError(rinfo, `Erro ao listar diretório: ${error.message}`);
        }
    }
    handleCd(data, rinfo, clientId, packetId) {
        if (!this.isAuthenticated(clientId)) {
            this.sendError(rinfo, 'Cliente não autenticado');
            return;
        }
        const dirName = data.toString().trim();
        const client = this.clients.get(clientId);
        if (dirName === '..') {
            if (client.currentDir !== '/') {
                client.currentDir = path.dirname(client.currentDir).replace(/\\/g, '/');
                if (!client.currentDir.startsWith('/')) {
                    client.currentDir = '/' + client.currentDir;
                }
            }
            this.sendResponse(rinfo, Protocol.PACKET_TYPES.CD_RESPONSE,
                Protocol.STATUS.SUCCESS + ' ' + client.currentDir, packetId);
        } else {
            const newDir = path.join(client.currentDir, dirName).replace(/\\/g, '/');
            const fullPath = this.getAbsolutePath(newDir, '');
            if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                client.currentDir = newDir;
                this.sendResponse(rinfo, Protocol.PACKET_TYPES.CD_RESPONSE,
                    Protocol.STATUS.SUCCESS + ' ' + client.currentDir, packetId);
            } else {
                this.sendResponse(rinfo, Protocol.PACKET_TYPES.CD_RESPONSE,
                    Protocol.STATUS.DIRECTORY_NOT_FOUND, packetId);
            }
        }
    }
    handleMkdir(data, rinfo, clientId, packetId) {
        if (!this.isAuthenticated(clientId)) {
            this.sendError(rinfo, 'Cliente não autenticado');
            return;
        }
        const dirName = data.toString().trim();
        const client = this.clients.get(clientId);
        const dirPath = this.getAbsolutePath(client.currentDir, dirName);
        try {
            if (fs.existsSync(dirPath)) {
                this.sendResponse(rinfo, Protocol.PACKET_TYPES.MKDIR_RESPONSE,
                    Protocol.STATUS.ALREADY_EXISTS, packetId);
            } else {
                fs.mkdirSync(dirPath);
                this.sendResponse(rinfo, Protocol.PACKET_TYPES.MKDIR_RESPONSE,
                    Protocol.STATUS.SUCCESS, packetId);
                console.log(`Diretório criado: ${dirPath}`);
            }
        } catch (error) {
            this.sendError(rinfo, `Erro ao criar diretório: ${error.message}`);
        }
    }
    handleRmdir(data, rinfo, clientId, packetId) {
        if (!this.isAuthenticated(clientId)) {
            this.sendError(rinfo, 'Cliente não autenticado');
            return;
        }
        const dirName = data.toString().trim();
        const client = this.clients.get(clientId);
        const dirPath = this.getAbsolutePath(client.currentDir, dirName);
        try {
            if (!fs.existsSync(dirPath)) {
                this.sendResponse(rinfo, Protocol.PACKET_TYPES.RMDIR_RESPONSE,
                    Protocol.STATUS.DIRECTORY_NOT_FOUND, packetId);
            } else if (!fs.statSync(dirPath).isDirectory()) {
                this.sendResponse(rinfo, Protocol.PACKET_TYPES.RMDIR_RESPONSE,
                    Protocol.STATUS.ERROR + ' Não é um diretório', packetId);
            } else {
                const items = fs.readdirSync(dirPath);
                if (items.length > 0) {
                    this.sendResponse(rinfo, Protocol.PACKET_TYPES.RMDIR_RESPONSE,
                        Protocol.STATUS.NOT_EMPTY, packetId);
                } else {
                    fs.rmdirSync(dirPath);
                    this.sendResponse(rinfo, Protocol.PACKET_TYPES.RMDIR_RESPONSE,
                        Protocol.STATUS.SUCCESS, packetId);
                    console.log(`Diretório removido: ${dirPath}`);
                }
            }
        } catch (error) {
            this.sendError(rinfo, `Erro ao remover diretório: ${error.message}`);
        }
    }
    handleAck(packet, rinfo, clientId) {
        console.log(`ACK recebido de ${clientId} para pacote ${packet.id}`);
    }
    isAuthenticated(clientId) {
        const client = this.clients.get(clientId);
        return client && client.authenticated;
    }
    getAbsolutePath(currentDir, filename) {
        const relativePath = path.join(currentDir, filename).replace(/\\/g, '/');
        return path.join(this.serverRoot, relativePath);
    }
    sendResponse(rinfo, type, data, packetId = 0) {
        const packet = Protocol.createPacket(packetId, type, data);
        this.socket.send(packet, rinfo.port, rinfo.address);
    }
    sendAck(rinfo, packetId) {
        const packet = Protocol.createPacket(packetId, Protocol.PACKET_TYPES.ACK, '');
        this.socket.send(packet, rinfo.port, rinfo.address);
    }
    sendError(rinfo, message) {
        const packet = Protocol.createPacket(0, Protocol.PACKET_TYPES.ERROR, message);
        this.socket.send(packet, rinfo.port, rinfo.address);
    }
}
if (require.main === module) {
    const server = new myFTudPServer();
    server.start();
    process.on('SIGINT', () => {
        console.log('\nParando servidor...');
        server.stop();
        process.exit(0);
    });
}
module.exports = myFTudPServer;
