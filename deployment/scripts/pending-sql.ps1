#Requires -Version 5.1
<#
    Print the SQL to paste into phpMyAdmin for migrations production hasn't run yet.

    Windows counterpart to pending-sql.sh. There is no SSH on the host, so
    migrate.php can never run there: new migrations are applied by hand. This
    exists so that "by hand" means one paste in the right order, rather than
    opening several files and hoping — a half-applied migration is how the site
    went down on 1 Sept.

      powershell -NoProfile -ExecutionPolicy Bypass -File .\deployment\scripts\pending-sql.ps1 `
          -OutFile prod-migrations.sql 009_departure_point.sql 010_departure_timezone.sql

    Prefer -OutFile over redirecting stdout: the headers below are box-drawing
    characters, and a `>` redirect re-encodes them through the console codepage,
    which turns them into mojibake in the file.
#>
param(
    [string]$OutFile,
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$Versions
)

$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')

# Check every file up front: a partial paste is worse than no paste at all.
foreach ($v in $Versions) {
    if (-not (Test-Path (Join-Path $Root "backend\migrations\$v"))) {
        throw "no such migration: $v"
    }
}

$out = [System.Text.StringBuilder]::new()
foreach ($v in $Versions) {
    [void]$out.AppendLine("-- ═══ $v ═══")
    # Read as UTF-8 explicitly. Get-Content on Windows PowerShell 5.1 decodes a
    # BOM-less file with the ANSI codepage, which turns every em dash in the
    # migrations' comments into mojibake.
    $sql = [System.IO.File]::ReadAllText(
        (Join-Path $Root "backend\migrations\$v"),
        (New-Object System.Text.UTF8Encoding($false)))
    [void]$out.AppendLine($sql.TrimEnd())
    [void]$out.AppendLine()
}

[void]$out.AppendLine(@'
-- ═══ bookkeeping ═══
-- Marks the above as applied, so a future migrate.php run never replays them.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(255) NOT NULL PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
'@)

[void]$out.AppendLine('INSERT IGNORE INTO schema_migrations (version) VALUES')
for ($i = 0; $i -lt $Versions.Count; $i++) {
    $sep = if ($i -eq $Versions.Count - 1) { ';' } else { ',' }
    [void]$out.AppendLine("  ('$($Versions[$i])')$sep")
}

$text = $out.ToString().TrimEnd() + "`n"

if ($OutFile) {
    # UTF-8 without BOM: phpMyAdmin shows a BOM as stray characters before the
    # first statement, and the box headers above are not ASCII.
    $path = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutFile))
    [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "wrote $path ($($text.Length) chars)"
} else {
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    Write-Output $text
}
