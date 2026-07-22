param(
  [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# 确保控制台输出 UTF-8
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
chcp 65001 > $null

Write-Host "=== deal-protocol 安装脚本 ===" -ForegroundColor Cyan
Write-Host ""

# ── 检查 Bun ──
Write-Host "→ 检查 Bun..." -NoNewline
$bun = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bun) {
  Write-Host " [未安装]" -ForegroundColor Red
  Write-Host ""
  Write-Host "请先安装 Bun: https://bun.sh/docs/installation"
  Write-Host "  PowerShell: powershell -c 'irm bun.sh/install.ps1 | iex'"
  exit 1
}
Write-Host " $(bun --version)" -ForegroundColor Green

# ── 安装依赖 ──
Write-Host "→ 安装项目依赖..." -ForegroundColor Yellow
bun install
if ($LASTEXITCODE -ne 0) {
  Write-Host "  [失败]" -ForegroundColor Red
  exit 1
}
Write-Host "  [完成]" -ForegroundColor Green

# ── 检查 .env ──
if (-not (Test-Path ".env")) {
  Write-Host "→ 创建 .env 文件（默认配置）..." -ForegroundColor Yellow
  @"
AUTH_SECRET=$(bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ANTHROPIC_API_KEY=
NEXTAUTH_URL=http://localhost:3000
"@ | Set-Content ".env" -Encoding UTF8
  Write-Host "  AUTH_SECRET 已自动生成" -ForegroundColor Green
  Write-Host "  如需 LLM 功能（标签提取/争议裁决），请在 .env 中配置 ANTHROPIC_API_KEY" -ForegroundColor DarkYellow
} else {
  Write-Host "→ .env 已存在，跳过" -ForegroundColor Green
}

# ── 数据库 ──
Write-Host "→ 初始化数据库..." -ForegroundColor Yellow
bunx prisma db push
if ($LASTEXITCODE -ne 0) {
  Write-Host "  [失败]" -ForegroundColor Red
  exit 1
}
Write-Host "  [完成]" -ForegroundColor Green

# ── 种子数据 ──
if (-not $SkipSeed) {
  Write-Host "→ 写入测试数据..." -ForegroundColor Yellow
  bun run prisma/seed.ts
  if ($LASTEXITCODE -ne 0) {
    Write-Host "  [失败]" -ForegroundColor Red
    exit 1
  }
  Write-Host "  [完成]" -ForegroundColor Green
}

# ── 验证 ──
Write-Host "→ 验证构建..." -ForegroundColor Yellow
bun run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "  [失败]" -ForegroundColor Red
  exit 1
}
Write-Host "  [完成]" -ForegroundColor Green

Write-Host ""
Write-Host "=== 安装完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "启动开发服务器:" -ForegroundColor White
Write-Host "  bun dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "测试账号:" -ForegroundColor White
Write-Host "  服务商: test@test.com / password123" -ForegroundColor Gray
Write-Host "  客户:   user@test.com / password123" -ForegroundColor Gray
Write-Host "  管理员: admin@test.com / password123" -ForegroundColor Gray
Write-Host ""
Write-Host "可通过以下命令启动生产模式:" -ForegroundColor White
Write-Host "  bun run build && bun run start" -ForegroundColor Yellow
