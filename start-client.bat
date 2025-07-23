@echo off
rem ============================================================================
rem start-client.bat
rem ============================================================================
rem Script de inicialização do cliente myFTudP para Windows
rem 
rem Este script inicia apenas o cliente Electron da aplicação myFTudP,
rem útil quando o servidor já está rodando em outro local ou quando
rem se deseja testar apenas a interface cliente.
rem 
rem Funcionalidades:
rem - Inicia o cliente Electron (interface gráfica)
rem - Navega para o diretório correto do projeto
rem - Exibe informações de status durante a inicialização
rem - Mantém janela aberta para debug em caso de erro
rem 
rem Requisitos:
rem - Node.js instalado e acessível via PATH
rem - Electron instalado (via npm install)
rem - Servidor myFTudP rodando (localmente ou remoto)
rem 
rem Configuração Padrão:
rem - Servidor esperado em: localhost:21000
rem - Interface: 1200x800 pixels (redimensionável)
rem 
rem Uso:
rem   start-client.bat
rem 
rem Autor: Thalles Felipe
rem Versão: 1.0.0
rem Data: 2025-01-23
rem ============================================================================

echo ========================================
echo    Iniciando cliente myFTudP...
echo ========================================
echo.
echo Aplicação: myFTudP Cliente FTP/UDP
echo Plataforma: Electron
echo Interface: Interface gráfica moderna
echo.
echo Conectando ao servidor padrão:
echo  - Endereço: localhost
echo  - Porta: 21000
echo.
echo Certifique-se de que o servidor está rodando!
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

rem Inicia o cliente Electron
echo Carregando interface...
npm start

rem Se chegou até aqui, provavelmente houve erro
echo.
echo ========================================
echo          Cliente encerrado
echo ========================================
echo.
echo Se o cliente fechou inesperadamente,
echo verifique os logs acima para identificar
echo possíveis problemas.
echo.
echo Pressione qualquer tecla para sair...
pause >nul
