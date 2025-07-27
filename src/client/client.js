const dgram = require("dgram");
const fs = require("fs-extra");
const path = require("path");
const { EventEmitter } = require("events");
const Protocol = require("../shared/protocol");

class myFTudPClient extends EventEmitter {
    constructor() {
        super();

        this.socket = dgram.createSocket("udp4");

        this.serverAddress = null;

        this.serverPort = null;

        this.connected = false;

        this.authenticated = false;

        this.currentUser = null;

        this.packetId = 1;

        this.pendingRequests = new Map();

        this.currentTransfer = null;

        this.setupSocket();
    }

    setupSocket() {
        this.socket.on("message", (msg, rinfo) => {
            this.handleMessage(msg, rinfo);
        });

        this.socket.on("error", (err) => {
            console.error("Erro no cliente:", err);
            this.emit("error", err);
        });
    }

    connect(address, port) {
        return new Promise((resolve, reject) => {
            this.serverAddress = address;
            this.serverPort = port;

            try {
                this.connected = true;
                this.emit("connected");
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
        this.emit("disconnected");
    }

    login(username, password) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error("Não conectado ao servidor"));
                return;
            }

            const data = `${username} ${password}`;
            const packetId = this.getNextPacketId();

            this.sendPacket(Protocol.PACKET_TYPES.LOGIN, data, packetId);

            this.pendingRequests.set(packetId, {
                type: "login",
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error("Timeout na resposta do servidor"));
                }, Protocol.TIMEOUT),
            });
        });
    }

    put(localFilePath, remoteFileName) {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error("Cliente não autenticado"));
                return;
            }

            if (!fs.existsSync(localFilePath)) {
                reject(new Error("Arquivo local não encontrado"));
                return;
            }

            const fileName = remoteFileName || path.basename(localFilePath);
            const fileData = fs.readFileSync(localFilePath);
            const packets = Protocol.fragmentData(
                fileData,
                Protocol.PACKET_TYPES.PUT_DATA
            );

            console.log(
                `Preparando upload: ${fileName} (${fileData.length} bytes, ${packets.length} pacotes)`
            );

            const packetId = this.getNextPacketId();

            this.sendPacket(
                Protocol.PACKET_TYPES.PUT,
                `${fileName} ${packets.length}`,
                packetId
            );
            this.currentTransfer = {
                type: "put",
                packets: packets,
                currentPacket: 0,
                fileName: fileName,
                resolve: resolve,
                reject: reject,
            };

            this.pendingRequests.set(packetId, {
                type: "put_init",
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
                    reject(new Error("Timeout na resposta do servidor"));
                }, Protocol.TIMEOUT),
            });
        });
    }

    sendFilePackets() {
        if (
            !this.currentTransfer ||
            this.currentTransfer.currentPacket >= this.currentTransfer.packets.length
        ) {
            return;
        }

        const packetData =
            this.currentTransfer.packets[this.currentTransfer.currentPacket];
        const packet = Protocol.createPacket(
            packetData.id,
            packetData.type,
            packetData.data,
            packetData.checksum
        );

        console.log(
            `Enviando pacote ${packetData.id} (${this.currentTransfer.currentPacket + 1
            }/${this.currentTransfer.packets.length})`
        );

        this.socket.send(packet, this.serverPort, this.serverAddress);
        this.currentTransfer.currentPacket++;

        const progress =
            (this.currentTransfer.currentPacket /
                this.currentTransfer.packets.length) *
            100;
        this.emit("uploadProgress", {
            fileName: this.currentTransfer.fileName,
            progress: Math.round(progress),
            sent: this.currentTransfer.currentPacket,
            total: this.currentTransfer.packets.length,
        });

        if (
            this.currentTransfer.currentPacket < this.currentTransfer.packets.length
        ) {
            setTimeout(() => this.sendFilePackets(), 10);
        } else {
            console.log(
                `Todos os pacotes enviados para ${this.currentTransfer.fileName}`
            );
            setTimeout(() => {
                if (this.currentTransfer) {
                    this.currentTransfer.resolve("Upload concluído com sucesso");
                    this.currentTransfer = null;
                }
            }, 1000);
        }
    }

    get(remoteFileName, localFilePath) {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error("Cliente não autenticado"));
                return;
            }

            const packetId = this.getNextPacketId();

            this.sendPacket(Protocol.PACKET_TYPES.GET, remoteFileName, packetId);

            this.currentTransfer = {
                type: "get",
                fileName: remoteFileName,
                localPath: localFilePath || remoteFileName,
                packets: [],
                expectedPackets: 0,
                resolve: resolve,
                reject: reject,
            };

            this.pendingRequests.set(packetId, {
                type: "get_init",
                resolve: (response) => {
                    if (response.startsWith(Protocol.STATUS.SUCCESS)) {
                        const parts = response.split(" ");
                        this.currentTransfer.expectedPackets = parseInt(parts[1]) || 0;
                        this.emit("downloadStart", {
                            fileName: remoteFileName,
                            expectedPackets: this.currentTransfer.expectedPackets,
                        });
                    } else {
                        reject(new Error(response));
                        this.currentTransfer = null;
                    }
                },
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error("Timeout na resposta do servidor"));
                    this.currentTransfer = null;
                }, Protocol.TIMEOUT),
            });
        });
    }

    ls() {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error("Cliente não autenticado"));
                return;
            }

            const packetId = this.getNextPacketId();

            this.sendPacket(Protocol.PACKET_TYPES.LS, "", packetId);

            this.pendingRequests.set(packetId, {
                type: "ls",
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error("Timeout na resposta do servidor"));
                }, Protocol.TIMEOUT),
            });
        });
    }

    cd(dirName) {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error("Cliente não autenticado"));
                return;
            }

            const packetId = this.getNextPacketId();

            this.sendPacket(Protocol.PACKET_TYPES.CD, dirName, packetId);

            this.pendingRequests.set(packetId, {
                type: "cd",
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error("Timeout na resposta do servidor"));
                }, Protocol.TIMEOUT),
            });
        });
    }

    mkdir(dirName) {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error("Cliente não autenticado"));
                return;
            }

            const packetId = this.getNextPacketId();

            this.sendPacket(Protocol.PACKET_TYPES.MKDIR, dirName, packetId);

            this.pendingRequests.set(packetId, {
                type: "mkdir",
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error("Timeout na resposta do servidor"));
                }, Protocol.TIMEOUT),
            });
        });
    }

    rmdir(dirName) {
        return new Promise((resolve, reject) => {
            if (!this.authenticated) {
                reject(new Error("Cliente não autenticado"));
                return;
            }

            const packetId = this.getNextPacketId();

            this.sendPacket(Protocol.PACKET_TYPES.RMDIR, dirName, packetId);

            this.pendingRequests.set(packetId, {
                type: "rmdir",
                resolve,
                reject,
                timeout: setTimeout(() => {
                    this.pendingRequests.delete(packetId);
                    reject(new Error("Timeout na resposta do servidor"));
                }, Protocol.TIMEOUT),
            });
        });
    }

    handleMessage(msg, rinfo) {
        try {
            const packet = Protocol.parsePacket(msg);

            if (
                packet.type === Protocol.PACKET_TYPES.GET_DATA &&
                this.currentTransfer &&
                this.currentTransfer.type === "get"
            ) {
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
                        this.emit("authenticated");
                        request.resolve("Login realizado com sucesso");
                    } else {
                        request.reject(new Error(this.getErrorMessage(response)));
                    }
                } else {
                    request.resolve(response);
                }
            }
        } catch (error) {
            console.error("Erro ao processar resposta:", error);
        }
    }

    handleDownloadPacket(packet) {
        if (!this.currentTransfer || this.currentTransfer.type !== "get") {
            return;
        }

        this.currentTransfer.packets.push(packet);

        this.sendAck(packet.id);

        const progress =
            (this.currentTransfer.packets.length /
                this.currentTransfer.expectedPackets) *
            100;
        this.emit("downloadProgress", {
            fileName: this.currentTransfer.fileName,
            progress: Math.round(progress),
            received: this.currentTransfer.packets.length,
            total: this.currentTransfer.expectedPackets,
        });

        if (
            this.currentTransfer.packets.length >=
            this.currentTransfer.expectedPackets
        ) {
            this.completeDownload();
        }
    }

    completeDownload() {
        try {
            const data = Protocol.reassembleData(this.currentTransfer.packets);
            fs.writeFileSync(this.currentTransfer.localPath, data);

            this.currentTransfer.resolve("Download concluído com sucesso");
            this.emit("downloadComplete", {
                fileName: this.currentTransfer.fileName,
                localPath: this.currentTransfer.localPath,
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
        const packet = Protocol.createPacket(
            packetId,
            Protocol.PACKET_TYPES.ACK,
            ""
        );
        this.socket.send(packet, this.serverPort, this.serverAddress);
    }

    getNextPacketId() {
        return this.packetId++;
    }

    getErrorMessage(status) {
        const messages = {
            [Protocol.STATUS.USER_NOT_FOUND]: "Usuário não encontrado",
            [Protocol.STATUS.WRONG_PASSWORD]: "Senha incorreta",
            [Protocol.STATUS.FILE_NOT_FOUND]: "Arquivo não encontrado",
            [Protocol.STATUS.DIRECTORY_NOT_FOUND]: "Diretório não encontrado",
            [Protocol.STATUS.PERMISSION_DENIED]: "Permissão negada",
            [Protocol.STATUS.ALREADY_EXISTS]: "Já existe",
            [Protocol.STATUS.NOT_EMPTY]: "Diretório não está vazio",
        };

        return messages[status] || status;
    }
}

module.exports = myFTudPClient;
