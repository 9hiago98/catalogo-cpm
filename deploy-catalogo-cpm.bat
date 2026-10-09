@echo off
title Deploy Catalogo CPM
cd /d "%~dp0"

echo ==========================================
echo      DEPLOY DO CATALOGO CPM
echo ==========================================
echo.
echo Enviando arquivos para o Cloudflare Pages...
echo.

call npx.cmd wrangler pages deploy public --project-name=catalogo-cpm

echo.
if %errorlevel% equ 0 (
    echo ==========================================
    echo DEPLOY CONCLUIDO COM SUCESSO!
    echo https://catalogo-cpm.pages.dev
    echo ==========================================
) else (
    echo ==========================================
    echo OCORREU UM ERRO NO DEPLOY.
    echo Veja a mensagem acima.
    echo ==========================================
)

echo.
pause
