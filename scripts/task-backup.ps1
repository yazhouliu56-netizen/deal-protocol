# task-backup.ps1 — 任务级快照备份
# 用法: .\scripts\task-backup.ps1 -TaskName "完成了什么"
# 在 S21 门禁前由 AI 自动执行

param(
  [Parameter(Mandatory = $true)]
  [string]$TaskName
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$snapshotFile = Join-Path $root ".opencode" "snapshot-index.json"
$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")

# 1. 检查 git dirty
Set-Location $root
$status = git status --porcelain
if (-not $status) {
  Write-Host "[task-backup] 工作区干净，无需备份"
  exit 0
}

# 2. 记录快照
try {
  $snaps = Get-Content $snapshotFile -Raw | ConvertFrom-Json
} catch {
  $snaps = @{ version = 1; snaps = @() }
}

$count = $snaps.snaps.Count + 1
$snapId = "snap-{0:D2}" -f $count

# 3. git commit
git add -A
$message = "snapshot-${TaskName} [${snapId}]"
git commit -m $message

$commitHash = git rev-parse HEAD
$filesChanged = git diff-tree --no-commit-id --name-only -r HEAD

# 4. 更新索引
$entry = @{
  id = $snapId
  task = $TaskName
  commit = $commitHash.Substring(0,12)
  timestamp = $timestamp
  files = @($filesChanged).Count
}
$snaps.snaps += $entry
$snaps | ConvertTo-Json -Depth 10 | Set-Content $snapshotFile -Encoding utf8

$shortHash = $commitHash.Substring(0,12)
Write-Host "[task-backup] OK snapshot-$TaskName ($shortHash) @ $filesChanged files"
