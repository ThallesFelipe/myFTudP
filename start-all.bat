@echo off
rem ============================================================================
rem start-all.bat
rem ============================================================================
rem Script de inicialização completa do projeto myFTudP para Windows
rem 
rem Este script automatiza o processo de inicialização tanto do servidor
rem quanto do cliente em terminais separados, facilitando o desenvolvimento
rem e teste da aplicação.
rem 
rem Funcionalidades:
rem - Inicia o servidor myFTudP em uma janela de terminal dedicada
rem - Inicia o cliente Electron em outra janela de terminal
rem - Ambos os processos rodam simultaneamente
rem - Mantém as janelas abertas mesmo após encerramento dos processos
rem 
rem Requisitos:
rem - Node.js instalado e acessível via PATH
rem - Dependências npm instaladas (npm install)
rem - Diretório atual deve ser a raiz do projeto
rem 
rem Uso:
rem   start-all.bat
rem 
rem Autor: Thalles Felipe
rem Versão: 1.0.0
rem Data: 2025-01-23
rem ============================================================================

echo ========================================
echo      Iniciando projeto myFTudP
echo ========================================
echo.
echo Este script irá iniciar:
echo  1. Servidor myFTudP (porta 21000)
echo  2. Cliente Electron
echo.
echo Aguarde a abertura das janelas...
echo.

rem Navega para o diretório do script (garantia de contexto correto)
cd /d "%~dp0"

rem Inicia o servidor em uma nova janela de comando
rem - start: cria nova janela
rem - "Servidor": título da janela
rem - cmd /k: mantém janela aberta após execução
rem - npm run server: comando a ser executado
echo Iniciando servidor...
start "myFTudP - Servidor" cmd /k "npm run server"

rem Pequena pausa para garantir que o servidor inicie primeiro
timeout /t 2 /nobreak >nul

rem Inicia o cliente em outra nova janela de comando
echo Iniciando cliente...
start "myFTudP - Cliente" cmd /k "npm start"

echo.
echo ========================================
echo   Ambos os componentes foram iniciados!
echo ========================================
echo.
echo Verifique as duas novas janelas que se abriram:
echo  - Janela "myFTudP - Servidor": Console do servidor
echo  - Janela "myFTudP - Cliente": Interface da aplicação
echo.
echo Para encerrar o projeto:
echo  1. Feche a aplicação cliente
echo  2. Pressione Ctrl+C na janela do servidor
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause >nul