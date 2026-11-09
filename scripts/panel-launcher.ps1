param([switch]$NoBrowser, [switch]$CheckOnly, [switch]$Stop)
$ErrorActionPreference = 'Stop'
$projectDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$logsDir = Join-Path $projectDir 'data\logs'
$recordFile = Join-Path $projectDir 'data\panel-process.json'
$panelUrl = 'http://127.0.0.1:3140'
$entryFile = Join-Path $projectDir 'build\server.js'
$launcherMutex = $null
$ownsMutex = $false

function Write-LaunchLog([string]$Message) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
    Add-Content -LiteralPath (Join-Path $logsDir 'launcher.log') -Encoding UTF8 -Value ((Get-Date).ToUniversalTime().ToString('o') + ' ' + $Message)
}
function Test-Panel {
    try {
        $probe = Invoke-RestMethod -Uri ($panelUrl + '/api/bootstrap') -TimeoutSec 2
        return ($probe.csrf -is [string] -and $probe.csrf -match '^[a-f0-9]{64}$')
    } catch { return $false }
}
function Test-PanelPort {
    $client = New-Object Net.Sockets.TcpClient
    try { $task = $client.ConnectAsync('127.0.0.1', 3140); return ($task.Wait(350) -and $client.Connected) }
    catch { return $false }
    finally { $client.Dispose() }
}
function Get-ManagedProcess {
    if (-not (Test-Path -LiteralPath $recordFile)) { return $null }
    try {
        $record = Get-Content -LiteralPath $recordFile -Raw | ConvertFrom-Json
        if ($record.entry -ne $entryFile) { return $null }
        $process = Get-Process -Id ([int]$record.processId) -ErrorAction Stop
        if ($process.ProcessName -ne 'node' -or $process.Path -ne $record.executable) { return $null }
        if ($process.StartTime.ToUniversalTime().Ticks -ne [long]$record.startedTicks) { return $null }
        return $process
    } catch { return $null }
}
function Get-ChromePath {
    foreach ($keyPath in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe')) {
        if (Test-Path $keyPath) {
            $candidate = (Get-Item $keyPath).GetValue('')
            if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
        }
    }
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
        if ($base) { $candidate = Join-Path $base 'Google\Chrome\Application\chrome.exe'; if (Test-Path -LiteralPath $candidate) { return $candidate } }
    }
    return $null
}
function Open-PanelTab {
    # Prefer the user's already-open Chrome from the project shortcut, without reading credentials.
    try {
        $settings = Invoke-RestMethod -Uri ($panelUrl + '/api/settings') -TimeoutSec 3
        $endpoint = [uri]$settings.config.browser.cdpEndpoint
        if ($endpoint.Scheme -eq 'http' -and $endpoint.Host -eq '127.0.0.1' -and $endpoint.Port -gt 0 -and $endpoint.AbsolutePath -eq '/' -and -not $endpoint.Query -and -not $endpoint.UserInfo) {
            $cdp = $endpoint.GetLeftPart([UriPartial]::Authority)
            $version = Invoke-RestMethod -Uri ($cdp + '/json/version') -TimeoutSec 2
            if ($version.Browser -match '^Chrome/') {
                $tab = Invoke-RestMethod -Uri ($cdp + '/json/new?' + $panelUrl) -Method Put -TimeoutSec 3
                try { Invoke-RestMethod -Uri ($cdp + '/json/activate/' + $tab.id) -TimeoutSec 2 | Out-Null } catch {}
                Write-LaunchLog 'Opened a panel tab in existing project Chrome.'
                return
            }
        }
    } catch {}
    $chrome = Get-ChromePath
    if (-not $chrome) { throw 'Google Chrome پیدا نشد. Chrome را نصب کنید یا پنل را در http://127.0.0.1:3140 باز کنید.' }
    # This browser window is visible because the user explicitly requested an interactive tab.
    Start-Process -FilePath $chrome -ArgumentList @('--new-tab', $panelUrl) -WindowStyle Normal | Out-Null
    Write-LaunchLog 'Opened a panel tab using Chrome single-instance handling.'
}
function Invoke-Npm([string[]]$NpmArguments) {
    $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
    $line = '"' + $npmPath + '" ' + ($NpmArguments -join ' ')
    $process = Start-Process -FilePath $env:ComSpec -ArgumentList @('/d', '/s', '/c', ('"' + $line + '"')) -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput (Join-Path $logsDir 'setup.stdout.log') -RedirectStandardError (Join-Path $logsDir 'setup.stderr.log')
    if ($process.ExitCode -ne 0) { throw 'آماده‌سازی برنامه کامل نشد؛ فایل‌های setup.stdout.log و setup.stderr.log در data\logs را بررسی کنید.' }
}
try {
    if ($CheckOnly) {
        $node = Get-Command node.exe -ErrorAction SilentlyContinue
        [pscustomobject]@{ PanelReady = (Test-Panel); NodeAvailable = ($null -ne $node); ChromeAvailable = ($null -ne (Get-ChromePath)); ManagedServer = ($null -ne (Get-ManagedProcess)) } | ConvertTo-Json
        return
    }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $key = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectDir.ToLowerInvariant()))).Replace('-', '').Substring(0, 16) } finally { $sha.Dispose() }
    $launcherMutex = New-Object Threading.Mutex($false, ('Local\HamkadehPanel_' + $key))
    try { $ownsMutex = $launcherMutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { return }
    Write-LaunchLog $(if ($Stop) { 'Stop requested.' } else { 'Open requested.' })
    if ($Stop) {
        $managed = Get-ManagedProcess
        if (-not $managed) { throw 'سرور این پنل با Open-Panel.vbs اجرا نشده یا قبلاً بسته شده است. اجرای دستی start.cmd را با Ctrl+C ببندید.' }
        if (Test-Panel) {
            $settings = Invoke-RestMethod -Uri ($panelUrl + '/api/settings') -TimeoutSec 3
            if ($settings.locked) {
                $job = Invoke-RestMethod -Uri ($panelUrl + '/api/landing/jobs/' + $settings.locked.job) -TimeoutSec 3
                if ($job.status -in @('running', 'uploading', 'checking', 'confirming')) { throw 'یک سفارش در حال اجراست؛ ابتدا آن را به پایان برسانید یا از پنل لغو کنید.' }
            }
            $batch = Invoke-RestMethod -Uri ($panelUrl + '/api/landing/batches/active') -TimeoutSec 3
            if ($batch -and $batch.status -eq 'running') { throw 'صف گروهی فعال است؛ ابتدا از پنل آن را متوقف کنید.' }
        }
        Stop-Process -Id $managed.Id -ErrorAction Stop
        Remove-Item -LiteralPath $recordFile -ErrorAction SilentlyContinue
        Write-LaunchLog 'Managed background server stopped.'
        return
    }
    if (-not (Test-Panel)) {
        $managed = Get-ManagedProcess
        if (-not $managed) {
            if (Test-PanelPort) { throw 'پورت 3140 توسط برنامه دیگری اشغال شده یا پنل پاسخ‌گو نیست؛ برنامه‌ای متوقف نشد.' }
            $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
            Set-Location -LiteralPath $projectDir
            if (-not (Test-Path -LiteralPath (Join-Path $projectDir 'node_modules'))) { Invoke-Npm @('ci', '--cache', '.npm-cache') }
            $needsBuild = -not ((Test-Path -LiteralPath $entryFile) -and (Test-Path -LiteralPath (Join-Path $projectDir 'dist\index.html')))
            if (-not $needsBuild) {
                $latest = Get-ChildItem -LiteralPath @((Join-Path $projectDir 'server'), (Join-Path $projectDir 'web'), (Join-Path $projectDir 'config')) -Recurse -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
                $needsBuild = $latest.LastWriteTimeUtc -gt (Get-Item -LiteralPath $entryFile).LastWriteTimeUtc -or $latest.LastWriteTimeUtc -gt (Get-Item -LiteralPath (Join-Path $projectDir 'dist\index.html')).LastWriteTimeUtc
            }
            if ($needsBuild) { Invoke-Npm @('run', 'build') }
            $env:PORT = '3140'
            $env:DATA_DIR = Join-Path $projectDir 'data'
            $managed = Start-Process -FilePath $nodePath -ArgumentList ('"' + $entryFile + '"') -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logsDir 'panel.stdout.log') -RedirectStandardError (Join-Path $logsDir 'panel.stderr.log')
            @{processId=$managed.Id;startedTicks=$managed.StartTime.ToUniversalTime().Ticks;executable=$nodePath;entry=$entryFile} | ConvertTo-Json | Set-Content -LiteralPath $recordFile -Encoding UTF8
            Write-LaunchLog 'Managed background server launched.'
        }
        $deadline = (Get-Date).AddSeconds(45)
        while (-not (Test-Panel)) {
            if ($managed.HasExited) { throw 'سرور اجرا نشد؛ panel.stderr.log در data\logs را بررسی کنید.' }
            if ((Get-Date) -gt $deadline) { throw 'سرور در زمان مورد انتظار آماده نشد؛ فایل‌های لاگ را بررسی کنید.' }
            Start-Sleep -Milliseconds 250
        }
    } else { Write-LaunchLog 'Reused an already-running panel.' }
    if (-not $NoBrowser) { Open-PanelTab }
} catch {
    $message = $_.Exception.Message
    try { Write-LaunchLog ('Error: ' + $message) } catch {}
    if (-not $NoBrowser -and -not $CheckOnly) { (New-Object -ComObject WScript.Shell).Popup($message, 0, 'Hamkadeh Panel', 16) | Out-Null }
    else { Write-Output $message }
    exit 1
} finally {
    if ($ownsMutex -and $launcherMutex) { $launcherMutex.ReleaseMutex() }
    if ($launcherMutex) { $launcherMutex.Dispose() }
}
