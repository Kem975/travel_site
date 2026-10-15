#!/usr/bin/env pwsh
#
# Stop the local PHP API + Vite dev server. MySQL is left running.
# Windows counterpart to stop-dev.sh.
#
# Run it as:  powershell -NoProfile -ExecutionPolicy Bypass -File .\stop-dev.ps1

$Root  = Split-Path -Parent $MyInvocation.MyCommand.Definition
$DevDb = Join-Path $Root '.devdb'

# Matched on this repo's path so a dev server from another project is never hit.
$procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
        $_.CommandLine -and
        ($_.CommandLine -like "*$Root*" -or $_.CommandLine -like '*127.0.0.1:8000*') -and
        ($_.CommandLine -like '*vite*' -or $_.CommandLine -like '*127.0.0.1:8000*')
    }

$php  = $procs | Where-Object { $_.CommandLine -like '*127.0.0.1:8000*' }
$vite = $procs | Where-Object { $_.CommandLine -like '*vite*' }

if ($php)  { $php  | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Host 'v stopped PHP API' -ForegroundColor Green }
else       { Write-Host '. PHP API was not running' }
if ($vite) { $vite | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Host 'v stopped Vite' -ForegroundColor Green }
else       { Write-Host '. Vite was not running' }

$mysqladmin = Get-Item 'C:\Program Files\MySQL\MySQL Server *\bin\mysqladmin.exe' -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1

Write-Host ''
Write-Host 'MySQL (.devdb) is still running. To stop it too:'
if ($mysqladmin) { Write-Host "  & `"$($mysqladmin.FullName)`" -h 127.0.0.1 -P 3306 -u root shutdown" }
else { Write-Host '  mysqladmin -h 127.0.0.1 -P 3306 -u root shutdown' }
