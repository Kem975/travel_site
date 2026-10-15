#Requires -Version 5.1
<#
    Assemble the FTP upload bundle in _deploy/ from the current working tree.

    Windows counterpart to assemble.sh, which cannot run here: it uses rsync, and
    Git Bash for Windows does not ship one. robocopy /MIR gives the same mirror
    semantics, and its /XD and /XF exclusions apply to the purge as well as to the
    copy — which is what keeps the server-owned files below from being deleted.

    Three things it must never do, because they'd break production:
      - overwrite _deploy/voyage-private/.env  (the real secrets; not in git)
      - wipe _deploy/voyage/uploads/           (visitor photos live on the server)
      - ship deployment/setup.php              (one-time installer, deleted post-setup)

    Run it as:  powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\scripts\assemble.ps1
#>

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $Root

$Public  = Join-Path $Root '_deploy\voyage'
$Private = Join-Path $Root '_deploy\voyage-private'

# robocopy reports success as 0-7 (8+ is a real failure), so $LASTEXITCODE cannot
# be tested the usual way and $ErrorActionPreference='Stop' would trip on a
# perfectly good copy.
function Invoke-Mirror([string]$From, [string]$To, [string[]]$Extra = @()) {
    $args = @($From, $To, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/R:2', '/W:1') + $Extra
    & robocopy.exe @args | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $From -> $To" }
    $global:LASTEXITCODE = 0
}

Write-Host '> building frontend...'
& npm --prefix frontend run build
if ($LASTEXITCODE -ne 0) { throw 'frontend build failed' }

Write-Host "> assembling $Public..."
New-Item -ItemType Directory -Force -Path (Join-Path $Public 'api'), (Join-Path $Public 'uploads') | Out-Null
# The excludes are the files that belong to the server, not to the build.
Invoke-Mirror (Join-Path $Root 'frontend\dist') $Public @('/XD', (Join-Path $Public 'api'), (Join-Path $Public 'uploads'), '/XF', '.htaccess', '.ovhconfig')
Copy-Item (Join-Path $Root 'deployment\.htaccess')     (Join-Path $Public '.htaccess')      -Force
Copy-Item (Join-Path $Root 'deployment\.ovhconfig')    (Join-Path $Public '.ovhconfig')     -Force
Copy-Item (Join-Path $Root 'deployment\api-index.php') (Join-Path $Public 'api\index.php')  -Force

Write-Host "> assembling $Private..."
New-Item -ItemType Directory -Force -Path $Private | Out-Null
foreach ($dir in 'src', 'migrations', 'public', 'config') {
    Invoke-Mirror (Join-Path $Root "backend\$dir") (Join-Path $Private $dir)
}
foreach ($file in 'bootstrap.php', 'composer.json', 'console.php', 'migrate.php', '.env.example') {
    Copy-Item (Join-Path $Root "backend\$file") (Join-Path $Private $file) -Force
}

Get-ChildItem (Join-Path $Root '_deploy') -Recurse -Force -Filter '.DS_Store' -ErrorAction SilentlyContinue |
    ForEach-Object { Remove-Item $_.FullName -Force }

# Guard rather than trust: a missing .env means the site 500s on every request.
# -Force throughout: Windows marks dotfiles hidden, and Get-Item without it
# reports the file as missing — a guard that cries wolf on a healthy bundle.
$envFile = Get-Item -LiteralPath (Join-Path $Private '.env') -Force -ErrorAction SilentlyContinue
if ($null -eq $envFile -or $envFile.Length -eq 0) {
    throw "$Private\.env is missing or empty - do not upload."
}
if (Get-Item -LiteralPath (Join-Path $Public 'setup.php') -Force -ErrorAction SilentlyContinue) {
    throw 'setup.php ended up in the bundle - remove it.'
}

function Get-FolderSize([string]$Path) {
    '{0:N1} MB' -f ((Get-ChildItem $Path -Recurse -Force -File | Measure-Object Length -Sum).Sum / 1MB)
}

$assets = Select-String -Path (Join-Path $Public 'index.html') -Pattern 'assets/[A-Za-z0-9_-]+\.(js|css)' -AllMatches |
    ForEach-Object { $_.Matches } | ForEach-Object { $_.Value } | Sort-Object -Unique

Write-Host ''
Write-Host 'v bundle ready'
Write-Host ("    {0,-32} {1}   -> upload to server  voyage/" -f '_deploy\voyage', (Get-FolderSize $Public))
Write-Host ("    {0,-32} {1}   -> upload to server  voyage-private/" -f '_deploy\voyage-private', (Get-FolderSize $Private))
Write-Host ''
Write-Host '  The shell now points at:'
$assets | ForEach-Object { Write-Host "    $_" }
Write-Host ''
Write-Host '  Upload the CONTENTS of each folder. Do not delete voyage/uploads/ on the server.'
Write-Host '  New migrations are not applied by uploading - run their SQL in phpMyAdmin.'
