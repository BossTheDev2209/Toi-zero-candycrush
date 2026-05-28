param(
  [switch]$Start,
  [switch]$NoStart
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
  param([string]$Message)
  Write-Host "OK: $Message" -ForegroundColor Green
}

function Write-Warn {
  param([string]$Message)
  Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Test-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Assert-ExitCode {
  param(
    [int]$Code,
    [string]$Message
  )
  if ($Code -ne 0) {
    throw "$Message (exit code $Code)"
  }
}

function Escape-SingleQuotedPowerShell {
  param([string]$Value)
  return $Value.Replace("'", "''")
}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PackageJson = Join-Path $Root "package.json"
$SettingsExample = Join-Path $Root "settings.example.json"
$Settings = Join-Path $Root "settings.json"

Write-Host "TOIZero setup" -ForegroundColor Magenta
Write-Host "Project: $Root"

if (!(Test-Path -LiteralPath $PackageJson)) {
  throw "package.json was not found. Put setup.ps1 in the TOIZero project root and run it from there."
}

if (!(Test-Path -LiteralPath $SettingsExample)) {
  throw "settings.example.json was not found. The project download may be incomplete."
}

Write-Step "Checking Bun"
if (!(Test-Command "bun")) {
  Write-Warn "Bun was not found. Installing Bun for this Windows user..."
  powershell -NoProfile -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex"

  $BunBin = Join-Path $HOME ".bun\bin"
  if (Test-Path -LiteralPath $BunBin) {
    $env:Path = "$BunBin;$env:Path"
  }
}

if (!(Test-Command "bun")) {
  throw "Bun still is not available. Close this PowerShell window, open a new one, then run .\setup.ps1 again."
}

$BunVersion = (& bun --version).Trim()
Write-Ok "Bun $BunVersion is available"

Write-Step "Installing project packages"
Push-Location $Root
try {
  & bun install
  Assert-ExitCode $LASTEXITCODE "bun install failed"
} finally {
  Pop-Location
}
Write-Ok "Dependencies installed"

Write-Step "Preparing local settings"
if (Test-Path -LiteralPath $Settings) {
  Write-Ok "settings.json already exists, leaving it unchanged"
} else {
  Copy-Item -LiteralPath $SettingsExample -Destination $Settings
  Write-Ok "Created settings.json from settings.example.json"
}

Write-Step "Checking optional C/C++ compilers"
if (Test-Command "gcc") {
  Write-Ok "gcc found"
} else {
  Write-Warn "gcc was not found. C judging will not work until gcc is installed and on PATH."
}
if (Test-Command "g++") {
  Write-Ok "g++ found"
} else {
  Write-Warn "g++ was not found. C++ judging will not work until g++ is installed and on PATH."
}

$ShouldStart = $false
if ($Start) {
  $ShouldStart = $true
} elseif ($NoStart) {
  $ShouldStart = $false
} else {
  Write-Host ""
  $Answer = Read-Host "Start TOIZero now in two new PowerShell windows? [Y/n]"
  $ShouldStart = ($Answer.Trim() -eq "" -or $Answer.Trim().ToLowerInvariant().StartsWith("y"))
}

if ($ShouldStart) {
  Write-Step "Starting TOIZero"
  $QuotedRoot = Escape-SingleQuotedPowerShell $Root
  $ServerCommand = "Set-Location -LiteralPath '$QuotedRoot'; bun run dev:server"
  $WebCommand = "Set-Location -LiteralPath '$QuotedRoot'; bun run dev:web"

  Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $ServerCommand) -WindowStyle Normal
  Start-Sleep -Seconds 2
  Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $WebCommand) -WindowStyle Normal

  Write-Ok "Server and web windows launched"
  Write-Host ""
  Write-Host "Open this after Vite finishes starting:" -ForegroundColor Cyan
  Write-Host "  http://localhost:5173/settings"
  Write-Host ""
  Write-Host "Then enter TOI username/password and click: Save and re-login"
} else {
  Write-Step "Next commands"
  Write-Host "Open PowerShell window 1:"
  Write-Host "  bun run dev:server" -ForegroundColor White
  Write-Host ""
  Write-Host "Open PowerShell window 2:"
  Write-Host "  bun run dev:web" -ForegroundColor White
  Write-Host ""
  Write-Host "Then open:"
  Write-Host "  http://localhost:5173/settings" -ForegroundColor White
}

Write-Host ""
Write-Ok "Setup finished"
