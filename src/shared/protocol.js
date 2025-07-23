/**
 * @file protocol.js
 * @description Implementação do protocolo de comunicação UDP personalizado para o sistema myFTudP.
 * Este arquivo define a estrutura de pacotes, tipos de mensagens, códigos de status e 
 * métodos utilitários para manipulação de dados na comunicação cliente-servidor.
 * 
 * @author Thalles Felipe
 * @version 1.0.0
 * @since 2025-01-23
 */

/**
 * Classe Protocol - Define o protocolo de comunicação UDP customizado
 * 
 * Esta classe implementa um protocolo de comunicação confiável sobre UDP,
 * incluindo fragmentação de dados, checksums para integridade e tipos
 * de pacotes específicos para operações FTP.
 * 
 * @class Protocol
 */
class Protocol {
    /** @constant {number} PACKET_SIZE - Tamanho máximo de um pacote UDP (1024 bytes) */
    static PACKET_SIZE = 1024;
    
    /** @constant {number} HEADER_SIZE - Tamanho do cabeçalho do pacote (32 bytes) */
    static HEADER_SIZE = 32;
    
    /** @constant {number} DATA_SIZE - Tamanho máximo dos dados úteis por pacote (992 bytes) */
    static DATA_SIZE = Protocol.PACKET_SIZE - Protocol.HEADER_SIZE;
    
    /** @constant {number} TIMEOUT - Timeout para aguardar resposta (5000ms) */
    static TIMEOUT = 5000;
    
    /** @constant {number} MAX_RETRIES - Número máximo de tentativas de reenvio */
    static MAX_RETRIES = 3;

    /**
     * Tipos de pacotes suportados pelo protocolo
     * 
     * Cada tipo representa uma operação específica do protocolo FTP:
     * - LOGIN: Autenticação do usuário
     * - PUT/GET: Upload e download de arquivos
     * - LS: Listagem de diretório
     * - CD: Mudança de diretório
     * - MKDIR/RMDIR: Criação e remoção de diretórios
     * - ACK/NACK: Confirmações positivas e negativas
     * - ERROR: Mensagens de erro
     * 
     * @readonly
     * @enum {string}
     */
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

    /**
     * Códigos de status para respostas do servidor
     * 
     * Define os possíveis estados de resposta para operações:
     * - SUCCESS: Operação executada com sucesso
     * - ERROR: Erro genérico
     * - USER_NOT_FOUND/WRONG_PASSWORD: Erros de autenticação
     * - FILE_NOT_FOUND/DIRECTORY_NOT_FOUND: Erros de recursos não encontrados
     * - PERMISSION_DENIED: Erro de permissão
     * - ALREADY_EXISTS: Recurso já existe
     * - NOT_EMPTY: Diretório não está vazio
     * 
     * @readonly
     * @enum {string}
     */
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

    /**
     * Cria um pacote estruturado seguindo o protocolo definido
     * 
     * Estrutura do pacote (32 bytes de cabeçalho + dados):
     * - Bytes 0-3: ID do pacote (uint32, big-endian)
     * - Bytes 4-23: Tipo do pacote (string, 20 bytes)
     * - Bytes 24-27: Tamanho dos dados (uint32, big-endian)
     * - Bytes 28-31: Checksum (uint32, big-endian)
     * - Bytes 32+: Dados úteis
     * 
     * @param {number} id - Identificador único do pacote
     * @param {string} type - Tipo do pacote (deve estar em PACKET_TYPES)
     * @param {string|Buffer} data - Dados a serem enviados (padrão: string vazia)
     * @param {number} checksum - Checksum para verificação de integridade (padrão: 0)
     * @returns {Buffer} Pacote estruturado pronto para envio
     * 
     * @example
     * const packet = Protocol.createPacket(1, 'LOGIN', 'user password', 0);
     */
    static createPacket(id, type, data = '', checksum = 0) {
        // Converte dados para Buffer se necessário
        const dataBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        const dataSize = dataBuffer.length;
        
        // Cria o cabeçalho de 32 bytes
        const header = Buffer.alloc(Protocol.HEADER_SIZE);
        header.writeUInt32BE(id, 0);                    // ID do pacote (4 bytes)
        header.write(type.padEnd(20), 4);               // Tipo do pacote (20 bytes)
        header.writeUInt32BE(dataSize, 24);             // Tamanho dos dados (4 bytes)
        header.writeUInt32BE(checksum, 28);             // Checksum (4 bytes)

        // Concatena cabeçalho e dados
        return Buffer.concat([header, dataBuffer]);
    }

    /**
     * Analisa um pacote recebido e extrai suas informações
     * 
     * Decompõe o pacote binário em seus componentes estruturais,
     * validando o tamanho mínimo necessário para o cabeçalho.
     * 
     * @param {Buffer} buffer - Buffer contendo o pacote recebido
     * @returns {Object} Objeto com as informações do pacote
     * @returns {number} returns.id - ID do pacote
     * @returns {string} returns.type - Tipo do pacote
     * @returns {number} returns.dataSize - Tamanho dos dados
     * @returns {number} returns.checksum - Checksum do pacote
     * @returns {Buffer} returns.data - Dados úteis do pacote
     * @throws {Error} Quando o pacote é menor que o tamanho mínimo do cabeçalho
     * 
     * @example
     * const packet = Protocol.parsePacket(receivedBuffer);
     * console.log(`Tipo: ${packet.type}, Dados: ${packet.data.toString()}`);
     */
    static parsePacket(buffer) {
        // Valida tamanho mínimo do pacote
        if (buffer.length < Protocol.HEADER_SIZE) {
            throw new Error('Pacote muito pequeno');
        }

        // Extrai informações do cabeçalho
        const id = buffer.readUInt32BE(0);                              // ID do pacote
        const type = buffer.toString('utf8', 4, 24).trim();            // Tipo do pacote
        const dataSize = buffer.readUInt32BE(24);                      // Tamanho dos dados
        const checksum = buffer.readUInt32BE(28);                      // Checksum
        const data = buffer.slice(Protocol.HEADER_SIZE, Protocol.HEADER_SIZE + dataSize); // Dados

        return { id, type, dataSize, checksum, data };
    }

    /**
     * Calcula checksum simples para verificação de integridade
     * 
     * Implementa um algoritmo de checksum básico somando todos os bytes
     * dos dados e aplicando módulo 65536 para garantir que o resultado
     * caiba em 32 bits.
     * 
     * @param {string|Buffer} data - Dados para calcular o checksum
     * @returns {number} Valor do checksum (0-65535)
     * 
     * @example
     * const checksum = Protocol.calculateChecksum('Hello World');
     * console.log(`Checksum: ${checksum}`);
     */
    static calculateChecksum(data) {
        let sum = 0;
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        
        // Soma todos os bytes dos dados
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i];
        }
        
        // Aplica módulo para manter resultado em 16 bits
        return sum % 65536;
    }

    /**
     * Fragmenta dados grandes em múltiplos pacotes
     * 
     * Divide dados que excedem o tamanho máximo por pacote (DATA_SIZE)
     * em múltiplos pacotes menores, cada um com seu próprio ID e checksum.
     * Esta função é essencial para transferência de arquivos grandes.
     * 
     * @param {string|Buffer} data - Dados a serem fragmentados
     * @param {string} type - Tipo do pacote para todos os fragmentos
     * @param {number} startId - ID inicial para sequência de pacotes (padrão: 1)
     * @returns {Array<Object>} Array de objetos pacote prontos para envio
     * @returns {number} returns[].id - ID sequencial do pacote
     * @returns {string} returns[].type - Tipo do pacote
     * @returns {Buffer} returns[].data - Fragmento dos dados
     * @returns {number} returns[].checksum - Checksum do fragmento
     * 
     * @example
     * const packets = Protocol.fragmentData(largeFileBuffer, 'PUT_DATA', 1);
     * packets.forEach(packet => console.log(`Pacote ${packet.id}: ${packet.data.length} bytes`));
     */
    static fragmentData(data, type, startId = 1) {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        const packets = [];
        let packetId = startId;

        // Fragmenta os dados em chunks do tamanho máximo
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

    /**
     * Reagrupa pacotes fragmentados em dados originais
     * 
     * Reconstrói os dados originais a partir de uma sequência de pacotes
     * fragmentados, ordenando-os pelo ID antes da concatenação.
     * 
     * @param {Array<Object>} packets - Array de pacotes a serem reagrupados
     * @param {number} packets[].id - ID do pacote para ordenação
     * @param {Buffer} packets[].data - Dados do fragmento
     * @returns {Buffer} Dados originais reconstituídos
     * 
     * @example
     * const originalData = Protocol.reassembleData(receivedPackets);
     * fs.writeFileSync('reconstructed-file.txt', originalData);
     */
    static reassembleData(packets) {
        // Ordena pacotes pelo ID para garantir sequência correta
        packets.sort((a, b) => a.id - b.id);
        
        // Extrai os dados de cada pacote e concatena
        const buffers = packets.map(packet => packet.data);
        return Buffer.concat(buffers);
    }

    /**
     * Valida comandos e seus argumentos
     * 
     * Verifica se o comando é válido e se os argumentos fornecidos
     * estão de acordo com a sintaxe esperada para cada operação.
     * 
     * @param {string} command - Nome do comando a ser validado
     * @param {Array<string>} args - Argumentos fornecidos para o comando
     * @returns {Object} Resultado da validação
     * @returns {boolean} returns.valid - Se o comando é válido
     * @returns {string} [returns.error] - Mensagem de erro se inválido
     * 
     * @example
     * const result = Protocol.validateCommand('login', ['user', 'pass']);
     * if (!result.valid) {
     *     console.error(`Erro: ${result.error}`);
     * }
     */
    static validateCommand(command, args) {
        // Lista de comandos válidos do protocolo FTP
        const validCommands = ['login', 'put', 'get', 'ls', 'cd', 'cd..', 'mkdir', 'rmdir'];
        
        // Verifica se o comando existe
        if (!validCommands.includes(command)) {
            return { valid: false, error: 'Comando inválido' };
        }

        // Valida argumentos específicos para cada comando
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
