# Registers a Windows scheduled task to run daily-work-flow.ps1 at 6:45 PM local time.
# Fully automatic — no manual gh auth or token setup required.

$TaskName = "FRS-Daily-Work-Push"
$ScriptPath = Join-Path $PSScriptRoot "daily-work-flow.ps1"
$Time = "18:45"

if (-not (Test-Path $ScriptPath)) {
    throw "Missing script: $ScriptPath"
}

$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`"" `
    -WorkingDirectory (Split-Path -Parent $PSScriptRoot)

$Trigger = New-ScheduledTaskTrigger -Daily -At $Time

$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "FRS daily work: commit, push, PR, merge to main at 6:45 PM (fully automatic)" `
    -Force | Out-Null

Write-Host "Scheduled task '$TaskName' registered for daily at $Time."
Write-Host "Script: $ScriptPath"
Write-Host "Logs:   $(Join-Path $PSScriptRoot 'logs')"
Write-Host ""
Write-Host "Fully automatic — uses your existing Git login. No manual steps needed."
