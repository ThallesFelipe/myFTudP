class Protocol {
    static PACKET_SIZE = 1024;
    static HEADER_SIZE = 32;
    static DATA_SIZE = Protocol.PACKET_SIZE - Protocol.HEADER_SIZE;
    static TIMEOUT = 5000;
    static MAX_RETRIES = 3;
    static PACKET_TYPES = {
        LOGIN: 'LOGIN',
        LOGIN_RESPONSE: 'LOGIN_RESPONSE',
        PUT: 'PUT',
        PUT_DATA: 'PUT_DATA',
        PUT_RESPONSE: 'PUT_RESPONSE',
        GET: 'GET',
        GET_DATA: 'GET_DATA',
        GET_RESPONSE: 'GET_RESPONSE',
        LS: 'LS',
        LS_RESPONSE: 'LS_RESPONSE',
        CD: 'CD',
        CD_RESPONSE: 'CD_RESPONSE',
        MKDIR: 'MKDIR',
        MKDIR_RESPONSE: 'MKDIR_RESPONSE',
        RMDIR: 'RMDIR',
        RMDIR_RESPONSE: 'RMDIR_RESPONSE',
        ACK: 'ACK',
        NACK: 'NACK',
        ERROR: 'ERROR'
    };
    static STATUS = {
        SUCCESS: 'SUCCESS',
        ERROR: 'ERROR',
        USER_NOT_FOUND: 'USER_NOT_FOUND',
        WRONG_PASSWORD: 'WRONG_PASSWORD',
        FILE_NOT_FOUND: 'FILE_NOT_FOUND',
        DIRECTORY_NOT_FOUND: 'DIRECTORY_NOT_FOUND',
        PERMISSION_DENIED: 'PERMISSION_DENIED',
        ALREADY_EXISTS: 'ALREADY_EXISTS',
        NOT_EMPTY: 'NOT_EMPTY'
    };
    static createPacket(id, type, data = '', checksum = 0) {
        const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        const dataSize = dataBuffer.length;
        const header = Buffer.alloc(Protocol.HEADER_SIZE);
        header.writeUInt32BE(id, 0);
        header.write(type.padEnd(20), 4);
        header.writeUInt32BE(dataSize, 24);
        header.writeUInt32BE(checksum, 28);
        return Buffer.concat([header, dataBuffer]);
    }
    static parsePacket(buffer) {
        if (buffer.length < Protocol.HEADER_SIZE) {
            throw new Error('Pacote muito pequeno');
        }
        const id = buffer.readUInt32BE(0);
        const type = buffer.toString('utf8', 4, 24).trim();
        const dataSize = buffer.readUInt32BE(24);
        const checksum = buffer.readUInt32BE(28);
        const data = buffer.slice(Protocol.HEADER_SIZE, Protocol.HEADER_SIZE + dataSize);
        return { id, type, dataSize, checksum, data };
    }
    static calculateChecksum(data) {
        let sum = 0;
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i];
        }
        return sum % 65536;
    }
    static fragmentData(data, type, startId = 1) {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        const packets = [];
        let packetId = startId;
        for (let i = 0; i < buffer.length; i += Protocol.DATA_SIZE) {
            const chunk = buffer.slice(i, i + Protocol.DATA_SIZE);
            const checksum = Protocol.calculateChecksum(chunk);
            packets.push({
                id: packetId++,
                type: type,
                data: chunk,
                checksum: checksum
            });
        }
        return packets;
    }
    static reassembleData(packets) {
        packets.sort((a, b) => a.id - b.id);
        const buffers = packets.map(packet => packet.data);
        return Buffer.concat(buffers);
    }
    static validateCommand(command, args) {
        const validCommands = ['login', 'put', 'get', 'ls', 'cd', 'cd..', 'mkdir', 'rmdir'];
        if (!validCommands.includes(command)) {
            return { valid: false, error: 'Comando inválido' };
        }
        switch (command) {
            case 'login':
                if (args.length !== 2) {
                    return { valid: false, error: 'Uso: login <usuário> <senha>' };
                }
                break;
            case 'put':
            case 'get':
                if (args.length !== 1) {
                    return { valid: false, error: `Uso: ${command} <nome_arquivo>` };
                }
                break;
            case 'cd':
            case 'mkdir':
            case 'rmdir':
                if (args.length !== 1) {
                    return { valid: false, error: `Uso: ${command} <nome_pasta>` };
                }
                break;
            case 'ls':
            case 'cd..':
                if (args.length !== 0) {
                    return { valid: false, error: `Uso: ${command}` };
                }
                break;
        }
        return { valid: true };
    }
}
module.exports = Protocol;
