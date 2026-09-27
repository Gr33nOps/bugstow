# BugsTow installer for Windows. Run in PowerShell:
#
#   irm https://raw.githubusercontent.com/Gr33nOps/bugstow/main/install.ps1 | iex
#
# What it does (nothing needs administrator rights):
#   1. Downloads the latest BugsTow release from GitHub and checks its SHA-256.
#   2. Downloads a private copy of Node.js from nodejs.org (checked against the
#      official SHA256SUMS) so BugsTow keeps working whatever else is installed.
#   3. Installs into %LOCALAPPDATA%\BugsTow\app. Your data lives in
#      %LOCALAPPDATA%\BugsTow\data and is never touched by installs or updates.
#   4. Adds a "BugsTow" Start menu + desktop shortcut and a `bugstow` command.
#   5. Starts BugsTow and opens it in your browser (http://localhost:5757).
#
# Run the same command again to update. Remove with: bugstow uninstall
#
# Options (environment variables): BUGSTOW_HOME (install folder),
# BUGSTOW_PACKAGE (local .tar.gz or URL instead of the latest release),
# BUGSTOW_NO_SHORTCUTS=1, BUGSTOW_NO_PATH=1, BUGSTOW_NO_START=1.

function Install-BugsTow {
  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'   # much faster downloads on Windows PowerShell 5.1
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

  $Repo = 'Gr33nOps/bugstow'
  $NodeVersion = '22.23.3'
  $Root = if ($env:BUGSTOW_HOME) { $env:BUGSTOW_HOME } else { Join-Path $env:LOCALAPPDATA 'BugsTow' }
  $AppDir = Join-Path $Root 'app'
  $NodeDir = Join-Path $Root 'node'
  $BinDir = Join-Path $Root 'bin'
  $Tar = Join-Path $env:SystemRoot 'System32\tar.exe'

  function Say($m) { Write-Host "  $m" }
  function Step($m) { Write-Host "`n> $m" -ForegroundColor Cyan }
  # .NET directly: Get-FileHash can be missing when Windows PowerShell is started from PowerShell 7.
  function Get-Sha256($file) {
    $stream = [IO.File]::OpenRead($file)
    try { -join ([Security.Cryptography.SHA256]::Create().ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) }
    finally { $stream.Dispose() }
  }
  function Fetch($url, $dest) { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $dest -Headers @{ 'User-Agent' = 'bugstow-installer' } }

  Write-Host "`nBugsTow installer" -ForegroundColor White
  if (-not (Test-Path $Tar)) { throw 'This installer needs Windows 10 (version 1803) or newer.' }
  $arch = switch ($env:PROCESSOR_ARCHITECTURE) { 'AMD64' { 'x64' } 'ARM64' { 'arm64' } default { throw "Unsupported processor: $($env:PROCESSOR_ARCHITECTURE). BugsTow needs 64-bit Windows." } }

  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("bugstow-install-" + [Guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $tmp, $Root | Out-Null
  try {
    # ── 1. The BugsTow package ────────────────────────────────────────────────
    Step 'Getting BugsTow'
    $pkg = Join-Path $tmp 'bugstow-app.tar.gz'
    $expected = $null
    if ($env:BUGSTOW_PACKAGE) {
      if ($env:BUGSTOW_PACKAGE -match '^https?://') {
        Fetch $env:BUGSTOW_PACKAGE $pkg
        try { Fetch "$($env:BUGSTOW_PACKAGE).sha256" "$pkg.sha256"; $expected = ((Get-Content "$pkg.sha256" -Raw) -split '\s+')[0] } catch { }
      } else {
        Copy-Item -LiteralPath $env:BUGSTOW_PACKAGE -Destination $pkg
        if (Test-Path "$($env:BUGSTOW_PACKAGE).sha256") { $expected = ((Get-Content "$($env:BUGSTOW_PACKAGE).sha256" -Raw) -split '\s+')[0] }
      }
      Say "Package: $($env:BUGSTOW_PACKAGE)"
    } else {
      $release = Invoke-RestMethod -UseBasicParsing -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'bugstow-installer' }
      $asset = $release.assets | Where-Object { $_.name -like 'bugstow-app-*.tar.gz' } | Select-Object -First 1
      $sum = $release.assets | Where-Object { $_.name -like 'bugstow-app-*.tar.gz.sha256' } | Select-Object -First 1
      if (-not $asset -or -not $sum) { throw "The latest release ($($release.tag_name)) has no BugsTow app package." }
      Say "Version $($release.tag_name)"
      Fetch $asset.browser_download_url $pkg
      Fetch $sum.browser_download_url "$pkg.sha256"
      $expected = ((Get-Content "$pkg.sha256" -Raw) -split '\s+')[0]
    }
    if ($expected) {
      if ((Get-Sha256 $pkg) -ne $expected.ToLowerInvariant()) { throw 'The download is damaged or was changed (SHA-256 mismatch). Nothing was installed.' }
      Say 'Checksum OK'
    } elseif (-not $env:BUGSTOW_PACKAGE) {
      throw 'No checksum available for the download. Nothing was installed.'
    }

    # ── 2. Stop a running BugsTow (an update replaces its files) ─────────────
    $nodeExe = Join-Path $NodeDir 'node.exe'
    if ((Test-Path $nodeExe) -and (Test-Path (Join-Path $AppDir 'bugstow.mjs'))) {
      & $nodeExe (Join-Path $AppDir 'bugstow.mjs') stop | Out-Null
    }

    # ── 3. Private Node.js ────────────────────────────────────────────────────
    $haveNode = (Test-Path $nodeExe) -and ((& $nodeExe -v) -eq "v$NodeVersion")
    if (-not $haveNode) {
      Step "Getting Node.js $NodeVersion (used only by BugsTow)"
      $nodeName = "node-v$NodeVersion-win-$arch"
      $nodeZip = Join-Path $tmp "$nodeName.zip"
      Fetch "https://nodejs.org/dist/v$NodeVersion/$nodeName.zip" $nodeZip
      Fetch "https://nodejs.org/dist/v$NodeVersion/SHASUMS256.txt" (Join-Path $tmp 'SHASUMS256.txt')
      $line = Get-Content (Join-Path $tmp 'SHASUMS256.txt') | Where-Object { $_ -match "\s$([regex]::Escape("$nodeName.zip"))$" }
      if (-not $line -or (Get-Sha256 $nodeZip) -ne ($line -split '\s+')[0]) { throw 'Node.js download failed its checksum. Nothing was installed.' }
      & $Tar -xf $nodeZip -C $tmp
      if ($LASTEXITCODE -ne 0) { throw 'Could not unpack Node.js.' }
      if (Test-Path $NodeDir) { Remove-Item -Recurse -Force -LiteralPath $NodeDir }
      Move-Item -LiteralPath (Join-Path $tmp $nodeName) -Destination $NodeDir
      Say 'Checksum OK'
    }

    # ── 4. Unpack BugsTow and install its libraries ──────────────────────────
    Step 'Installing'
    $unpack = Join-Path $tmp 'pkg'
    New-Item -ItemType Directory -Force -Path $unpack | Out-Null
    & $Tar -xzf $pkg -C $unpack
    if ($LASTEXITCODE -ne 0) { throw 'Could not unpack the BugsTow package.' }
    $staged = Get-ChildItem -LiteralPath $unpack -Directory | Select-Object -First 1
    if (-not $staged -or -not (Test-Path (Join-Path $staged.FullName 'bugstow.mjs'))) { throw 'The package does not look like BugsTow.' }

    $env:Path = "$NodeDir;$env:Path"
    Push-Location (Join-Path $staged.FullName 'server')
    try {
      & (Join-Path $NodeDir 'npm.cmd') ci --omit=dev --no-audit --no-fund --no-update-notifier --loglevel=error
      if ($LASTEXITCODE -ne 0) { throw 'Installing BugsTow''s libraries failed (see the npm output above).' }
    } finally { Pop-Location }

    $old = "$AppDir.old"
    if (Test-Path $old) { Remove-Item -Recurse -Force -LiteralPath $old -ErrorAction SilentlyContinue }
    if (Test-Path $AppDir) { Move-Item -LiteralPath $AppDir -Destination $old }
    Move-Item -LiteralPath $staged.FullName -Destination $AppDir
    if (Test-Path $old) { Remove-Item -Recurse -Force -LiteralPath $old -ErrorAction SilentlyContinue }
    $version = (Get-Content (Join-Path $AppDir 'VERSION') -Raw).Trim()
    Say "BugsTow $version installed in $AppDir"

    # ── 5. `bugstow` command, PATH and shortcuts ─────────────────────────────
    New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
    Set-Content -LiteralPath (Join-Path $BinDir 'bugstow.cmd') -Encoding ASCII -Value "@echo off`r`n`"%~dp0..\node\node.exe`" `"%~dp0..\app\bugstow.mjs`" %*"

    if ($env:BUGSTOW_NO_PATH -ne '1') {
      $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
      $parts = @($userPath -split ';' | Where-Object { $_ })
      if ($parts -notcontains $BinDir) {
        [Environment]::SetEnvironmentVariable('Path', (($parts + $BinDir) -join ';'), 'User')
        Say 'Added the "bugstow" command (open a new terminal to use it)'
      }
    }

    if ($env:BUGSTOW_NO_SHORTCUTS -ne '1') {
      $shell = New-Object -ComObject WScript.Shell
      $dirs = if ($env:BUGSTOW_SHORTCUT_DIR) { @($env:BUGSTOW_SHORTCUT_DIR) } else { @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop')) }
      foreach ($d in $dirs) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
        $lnk = $shell.CreateShortcut((Join-Path $d 'BugsTow.lnk'))
        $lnk.TargetPath = $nodeExe
        $lnk.Arguments = "`"$(Join-Path $AppDir 'bugstow.mjs')`""
        $lnk.WorkingDirectory = $Root
        $lnk.IconLocation = (Join-Path $AppDir 'bugstow.ico')
        $lnk.WindowStyle = 7   # minimized: the launcher only starts BugsTow and opens the browser
        $lnk.Description = 'Open BugsTow'
        $lnk.Save()
      }
      Say 'Added BugsTow to the Start menu and desktop'
    }

    # ── 6. Start ─────────────────────────────────────────────────────────────
    Write-Host "`nDone. Your data folder: $(Join-Path $Root 'data')" -ForegroundColor Green
    if ($env:BUGSTOW_NO_START -ne '1') {
      # Start-Process, not `& node`: BugsTow keeps running in the background, and
      # PowerShell would otherwise wait for it when this script's output is captured.
      $launcher = Start-Process -FilePath $nodeExe -ArgumentList @("`"$(Join-Path $AppDir 'bugstow.mjs')`"", 'start') -NoNewWindow -PassThru
      $launcher.WaitForExit()
    } else {
      Say 'Start it from the BugsTow shortcut or with: bugstow'
    }
  } finally {
    Remove-Item -Recurse -Force -LiteralPath $tmp -ErrorAction SilentlyContinue
  }
}

Install-BugsTow
