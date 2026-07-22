<#
.SYNOPSIS
  deal-protocol 一键安装脚本
.DESCRIPTION
  零基础用户运行此脚本即可完成全部安装。
  自动安装 Bun（如需）、装依赖、建数据库、写入测试数据。
#>

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== deal-protocol 一键安装 ===" -ForegroundColor Cyan
Write-Host ""

# ── 检查 Bun，未安装则自动安装 ──
$bun = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bun) {
  Write-Host "→ 正在安装 Bun..." -ForegroundColor Yellow
  try {
    $installScript = Invoke-RestMethod -Uri "https://bun.sh/install.ps1"
    Invoke-Expression "$installScript"
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.bun\bin"
  } catch {
    Write-Host "  [自动安装失败]" -ForegroundColor Red
    Write-Host "  请手动安装 Bun: https://bun.sh/docs/installation" -ForegroundColor Yellow
    Write-Host "  然后重新运行此脚本" -ForegroundColor Yellow
    exit 1
  }
  Write-Host "  Bun 安装完成！" -ForegroundColor Green
}

# ── 进入项目目录 ──
Set-Location $root

# ── 运行安装 ──
& .\setup.ps1

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "安装成功！立即启动：" -ForegroundColor Green
  Write-Host "  cd $root" -ForegroundColor Gray
  Write-Host "  bun dev" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "打开浏览器访问 http://localhost:3000" -ForegroundColor White
}
