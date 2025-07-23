@echo off
rem ============================================================================
rem start-server.bat
rem ============================================================================
rem Script de inicialização do servidor myFTudP para Windows
rem 
rem Este script inicia apenas o servidor FTP sobre UDP da aplicação myFTudP,
rem útil para execução em servidor dedicado ou quando se deseja testar
rem múltiplos clientes conectando ao mesmo servidor.
rem 
rem Funcionalidades:
rem - Inicia o servidor FTP/UDP na porta 21000
rem - Configura diretório raiz do servidor
rem - Carrega base de usuários de teste
rem - Exibe logs de conexão e operações
rem - Mantém servidor rodando até interrupção manual
rem 
rem Configurações do Servidor:
rem - Porta: 21000 (padrão FTP alternativo)
rem - Protocolo: UDP com confiabilidade customizada
rem - Diretório raiz: ./data/server-files/
rem - Usuários: thalles, daniel, teste, user (hardcoded)
rem 
rem Operações Suportadas:
rem - LOGIN: Autenticação de usuários
rem - PUT: Upload de arquivos com fragmentação
rem - GET: Download de arquivos
rem - LS: Listagem de diretórios
rem - CD: Navegação em diretórios
rem - MKDIR: Criação de diretórios
rem - RMDIR: Remoção de diretórios
rem 
rem Requisitos:
rem - Node.js instalado e acessível via PATH
rem - Porta 21000 disponível
rem - Permissões de escrita no diretório do projeto
rem 
rem Uso:
rem   start-server.bat
rem 
rem Para parar o servidor:
rem   Ctrl+C na janela do terminal
rem 
rem Autor: Thalles Felipe
rem Versão: 1.0.0
rem Data: 2025-01-23
rem ============================================================================

echo ========================================
echo    Iniciando servidor myFTudP...
echo ========================================
echo.
echo Aplicação: myFTudP Servidor FTP/UDP
echo Plataforma: Node.js
echo Protocolo: UDP com camada de confiabilidade
echo.
echo Configurações do servidor:
echo  - Porta: 21000
echo  - Diretório raiz: ./data/server-files/
echo  - Protocolo: myFTudP (FTP sobre UDP)
echo.
echo Usuários de teste disponíveis:
echo  - thalles / thalles123
echo  - daniel  / daniel123
echo  - teste   / teste123
echo  - user    / user123
echo.

rem Navega para o diretório do script
cd /d "%~dp0"

rem Verifica se node_modules existe
if not exist "node_modules" (
    echo ERRO: Dependências não encontradas!
    echo.
    echo Execute primeiro: npm install
    echo.
    echo Pressione qualquer tecla para sair...
    pause >nul
    exit /b 1
)

rem Cria diretório do servidor se não existir
if not exist "data\server-files" (
    echo Criando diretório raiz do servidor...
    mkdir "data\server-files" 2>nul
)

rem Verifica se a porta está disponível
echo Verificando disponibilidade da porta 21000...
netstat -an | find "21000" >nul
if %errorlevel% equ 0 (
    echo.
    echo AVISO: Porta 21000 pode estar em uso!
    echo Se houver erro de bind, encerre outros processos usando esta porta.
    echo.
)

echo ========================================
echo      Iniciando servidor...
echo ========================================
echo.
echo O servidor estará disponível em:
echo  - Endereço local: localhost:21000
echo  - Endereço de rede: [seu_ip]:21000
echo.
echo Para parar o servidor, pressione Ctrl+C
echo.

rem Inicia o servidor Node.js
node src/server/server.js

rem Se chegou até aqui, o servidor foi encerrado
echo.
echo ========================================
echo          Servidor encerrado
echo ========================================
echo.
echo O servidor foi parado. Se foi encerrado
echo inesperadamente, verifique os logs acima.
echo.
echo Pressione qualquer tecla para sair...
pause >nul
