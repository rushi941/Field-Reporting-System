# Daily end-of-day workflow: branch -> commit -> push -> PR -> merge to main
# Fully automatic — uses Git Credential Manager (no gh auth login needed).
# Schedule: 6:45 PM local time via Windows Task Scheduler.

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

$Date = Get-Date -Format "yyyy-MM-dd"
$Branch = "daily/$Date"
$LogDir = Join-Path $PSScriptRoot "logs"
$LogFile = Join-Path $LogDir "daily-work-$Date.log"

if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir | Out-Null
}

function Write-Log {
    param([string]$Message)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -Path $LogFile -Value $line
    Write-Host $line
}

function Get-GitHubAuth {
    if ($env:GITHUB_TOKEN) {
        return @{ Token = $env:GITHUB_TOKEN; Username = $env:GITHUB_USERNAME }
    }

    $input = "protocol=https`nhost=github.com`n`n"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "git"
    $psi.Arguments = "credential fill"
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.Write($input)
    $proc.StandardInput.Close()
    $output = $proc.StandardOutput.ReadToEnd()
    $proc.WaitForExit()

    if ($proc.ExitCode -ne 0) {
        throw "Could not read GitHub credentials from Git Credential Manager."
    }

    $username = $null
    $token = $null
    foreach ($line in ($output -split "`r?`n")) {
        if ($line -match "^username=(.+)$") { $username = $matches[1] }
        if ($line -match "^password=(.+)$") { $token = $matches[1] }
    }

    if (-not $token) {
        throw "No GitHub token found. Sign in once via Git: git fetch origin"
    }

    return @{ Token = $token; Username = $username }
}

function Get-RepoInfo {
    $remote = (git remote get-url origin).Trim()
    if ($remote -match "github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+)") {
        return @{
            Owner = $matches.owner
            Repo  = $matches.repo -replace '\.git$', ''
        }
    }
    throw "Could not parse GitHub owner/repo from origin remote."
}

function Invoke-GitHubApi {
    param(
        [string]$Method,
        [string]$Uri,
        [hashtable]$Auth,
        [object]$Body = $null
    )

    $headers = @{
        Authorization = "Bearer $($Auth.Token)"
        Accept        = "application/vnd.github+json"
        "X-GitHub-Api-Version" = "2022-11-28"
    }

    $params = @{
        Method  = $Method
        Uri     = $Uri
        Headers = $headers
    }

    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Depth 6)
        $params.ContentType = "application/json"
    }

    return Invoke-RestMethod @params
}

function Get-ExistingPullRequest {
    param([hashtable]$Repo, [string]$HeadBranch, [hashtable]$Auth)

    $head = "$($Repo.Owner):$HeadBranch"
    $uri = "https://api.github.com/repos/$($Repo.Owner)/$($Repo.Repo)/pulls?state=open&head=$head&base=main"
    $items = Invoke-GitHubApi -Method GET -Uri $uri -Auth $Auth
    if ($items -and $items.Count -gt 0) {
        return $items[0].number
    }
    return $null
}

function New-GitHubPullRequest {
    param([hashtable]$Repo, [string]$HeadBranch, [string]$Title, [string]$BodyText, [hashtable]$Auth)

    $uri = "https://api.github.com/repos/$($Repo.Owner)/$($Repo.Repo)/pulls"
    $result = Invoke-GitHubApi -Method POST -Uri $uri -Auth $Auth -Body @{
        title = $Title
        head  = $HeadBranch
        base  = "main"
        body  = $BodyText
    }
    return $result.number
}

function Merge-GitHubPullRequest {
    param([hashtable]$Repo, [int]$Number, [hashtable]$Auth)

    $uri = "https://api.github.com/repos/$($Repo.Owner)/$($Repo.Repo)/pulls/$Number/merge"
    Invoke-GitHubApi -Method PUT -Uri $uri -Auth $Auth -Body @{
        merge_method = "merge"
    } | Out-Null
}

function Remove-GitHubBranch {
    param([hashtable]$Repo, [string]$BranchName, [hashtable]$Auth)

    $uri = "https://api.github.com/repos/$($Repo.Owner)/$($Repo.Repo)/git/refs/heads/$BranchName"
    try {
        Invoke-GitHubApi -Method DELETE -Uri $uri -Auth $Auth | Out-Null
    }
    catch {
        Write-Log "Note: remote branch cleanup skipped ($($_.Exception.Message))"
    }
}

try {
    Write-Log "Starting daily work flow in $RepoRoot"

    git rev-parse --is-inside-work-tree | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Not a git repository: $RepoRoot" }

    $status = git status --porcelain
    if (-not $status) {
        Write-Log "No local changes. Nothing to commit."
        exit 0
    }

    Write-Log "Fetching origin..."
    git fetch origin

    $hasStash = $false
    git stash push -u -m "daily-work-$Date"
    if ($LASTEXITCODE -eq 0) {
        $stashList = git stash list
        if ($stashList -match "daily-work-$Date") {
            $hasStash = $true
            Write-Log "Stashed local changes."
        }
    }

    $remoteBranch = git ls-remote --heads origin "refs/heads/$Branch"
    if ($remoteBranch) {
        Write-Log "Branch $Branch exists on remote. Checking out and pulling."
        git checkout $Branch 2>$null
        if ($LASTEXITCODE -ne 0) {
            git checkout -b $Branch "origin/$Branch"
        }
        git pull origin $Branch
    }
    else {
        Write-Log "Creating branch $Branch from main."
        git checkout main
        git pull origin main
        git checkout -b $Branch
    }

    if ($hasStash) {
        git stash pop
        if ($LASTEXITCODE -ne 0) {
            throw "Stash pop failed due to merge conflicts."
        }
        Write-Log "Restored stashed changes."
    }

    $statusAfter = git status --porcelain
    if (-not $statusAfter) {
        Write-Log "No changes after sync. Nothing to commit."
        exit 0
    }

    git add -A
    $commitMessage = "Daily work $Date"
    git commit -m $commitMessage
    Write-Log "Committed: $commitMessage"

    git push -u origin $Branch
    Write-Log "Pushed to origin/$Branch"

    $auth = Get-GitHubAuth
    $repo = Get-RepoInfo

    $prNumber = Get-ExistingPullRequest -Repo $repo -HeadBranch $Branch -Auth $auth
    if ($prNumber) {
        Write-Log "Existing PR #$prNumber found for $Branch"
    }
    else {
        $prNumber = New-GitHubPullRequest `
            -Repo $repo `
            -HeadBranch $Branch `
            -Title "Daily work $Date" `
            -BodyText "Automated end-of-day sync for $Date." `
            -Auth $auth
        Write-Log "Created PR #$prNumber"
    }

    Merge-GitHubPullRequest -Repo $repo -Number $prNumber -Auth $auth
    Write-Log "Merged PR #$prNumber into main"

    Remove-GitHubBranch -Repo $repo -BranchName $Branch -Auth $auth
    Write-Log "Deleted remote branch $Branch"

    git checkout main
    git pull origin main
    Write-Log "Daily work flow completed successfully."
    exit 0
}
catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    exit 1
}
