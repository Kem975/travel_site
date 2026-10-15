#!/usr/bin/env pwsh
#
# Local dev launcher for Our Journey (Windows).
# Starts: MySQL -> PHP API (:8000) -> Vite dev server (:5173).
# Ctrl+C stops PHP + Vite; MySQL is left running.
#
# This is the Windows counterpart to dev.sh: same services, same ports, same
# test credentials. dev.sh stays the launcher for macOS and Linux/WSL -- it
# relies on pkill/nohup/trap, which have no equivalent here.
#
# Run it as:  powershell -NoProfile -ExecutionPolicy Bypass -File .\dev.ps1
# (the -ExecutionPolicy flag is only needed while the user policy is Restricted)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $Root
$DevDb   = Join-Path $Root '.devdb'
$PhpLog  = Join-Path $DevDb 'php.log'
$PhpOut  = Join-Path $DevDb 'php.out.log'

# --- locate the tools -------------------------------------------------------
# Node and PHP put themselves on PATH; the MySQL MSI does not, so fall back to
# the versioned install dir the same way dev.sh falls back to Homebrew's.
function Resolve-Tool([string]$Name, [string[]]$Candidates) {
    $onPath = (Get-Command $Name -ErrorAction SilentlyContinue)
    if ($onPath) { return $onPath.Source }
    foreach ($c in $Candidates) {
        $hit = Get-Item $c -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
        if ($hit) { return $hit.FullName }
    }
    return $null
}

$Mysqld      = if ($env:MYSQLD)      { $env:MYSQLD }      else { Resolve-Tool 'mysqld'      @('C:\Program Files\MySQL\MySQL Server *\bin\mysqld.exe') }
$MysqlAdmin  = if ($env:MYSQLADMIN)  { $env:MYSQLADMIN }  else { Resolve-Tool 'mysqladmin'  @('C:\Program Files\MySQL\MySQL Server *\bin\mysqladmin.exe') }
$Php         = Resolve-Tool 'php' @("$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.8.3*\php.exe", 'C:\Program Files\PHP*\php.exe')
$Npm         = Resolve-Tool 'npm' @('C:\Program Files\nodejs\npm.cmd')

if (-not $Php) { Write-Host "x PHP not found on PATH. Open a new terminal (the installer edits PATH) or set it up again." -ForegroundColor Red; exit 1 }
if (-not $Npm) { Write-Host "x npm not found on PATH. Open a new terminal, or reinstall Node.js." -ForegroundColor Red; exit 1 }

# --- clear leftovers from a previous run (MySQL is left alone) ---------------
# Matched on this repo's path so a dev server from another project is never hit.
function Stop-Leftovers {
    $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and
            ($_.CommandLine -like "*$Root*" -or $_.CommandLine -like '*127.0.0.1:8000*') -and
            ($_.CommandLine -like '*vite*' -or $_.CommandLine -like '*127.0.0.1:8000*')
        }
    foreach ($p in $procs) {
        if ($p.ProcessId -eq $PID) { continue }
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
Stop-Leftovers

# --- 1) MySQL ---------------------------------------------------------------
# Only ever auto-started for the isolated .devdb instance. On a machine with a
# real MySQL service, starting a second server on the same port would just fail
# confusingly, so say what to do instead.
function Test-MysqlUp {
    if (-not $MysqlAdmin) { return $false }
    & $MysqlAdmin --host=127.0.0.1 --port=3306 --user=root ping *> $null
    return ($LASTEXITCODE -eq 0)
}

if (-not (Test-MysqlUp)) {
    if ((Test-Path (Join-Path $DevDb 'data')) -and $Mysqld) {
        Write-Host '> starting MySQL (.devdb)...'
        $basedir = Split-Path -Parent (Split-Path -Parent $Mysqld)
        Start-Process -FilePath $Mysqld -WindowStyle Hidden -ArgumentList @(
            "--basedir=`"$basedir`""
            "--datadir=`"$(Join-Path $DevDb 'data')`""
            '--port=3306'
            '--bind-address=127.0.0.1'
            '--mysqlx=0'
            "--log-error=`"$(Join-Path $DevDb 'mysqld.err')`""
        )
        for ($i = 0; $i -lt 40; $i++) { if (Test-MysqlUp) { break }; Start-Sleep -Milliseconds 500 }
    } else {
        Write-Host '! No MySQL answering on 127.0.0.1:3306, and no .devdb instance to start.' -ForegroundColor Yellow
        Write-Host '  Start your own server, then re-run.'
        Write-Host '  Carrying on - the API will boot but every database call will fail.'
    }
}
if (Test-MysqlUp) { Write-Host 'v MySQL ready (127.0.0.1:3306)' -ForegroundColor Green }

# --- 2) Frontend deps (first run only) --------------------------------------
if (-not (Test-Path (Join-Path $Root 'frontend\node_modules'))) {
    Write-Host '> installing frontend deps...'
    & $Npm --prefix frontend install
}

# --- 3) PHP API (background) ------------------------------------------------
$phpProc = Start-Process -FilePath $Php -PassThru -WindowStyle Hidden `
    -ArgumentList @('-S', '127.0.0.1:8000', 'backend/public/index.php') `
    -RedirectStandardOutput $PhpOut -RedirectStandardError $PhpLog
Write-Host "v PHP API (http://localhost:8000)  log: .devdb\php.log" -ForegroundColor Green

Write-Host @"

------------------------------------------------------------
  Our Journey - local dev (Windows)
    App      -> http://localhost:5173
    Admin    -> http://localhost:5173/admin/login
    API test -> http://localhost:8000/api/health

  Test credentials (dev DB):
    Trip password : trip-secret-123
    Admin login   : admin@example.com / admin-pass-456

  Press Ctrl+C to stop. (Run .\stop-dev.ps1 from another shell to stop too.)
------------------------------------------------------------

"@

# --- 4) Vite in the foreground so you see HMR logs --------------------------
try {
    & $Npm --prefix frontend run dev
} finally {
    Write-Host ''
    Write-Host '> stopping PHP + Vite (MySQL stays up)...'
    if ($phpProc -and -not $phpProc.HasExited) { Stop-Process -Id $phpProc.Id -Force -ErrorAction SilentlyContinue }
    Stop-Leftovers
}
