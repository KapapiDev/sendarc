# test-drop-email.ps1
# Drop a test email JSON into the real per-user SendArc queue to simulate a
# MAPI intercept without changing machine registration.
# Usage:
#   .\scripts\test-drop-email.ps1                                          # Simple email
#   .\scripts\test-drop-email.ps1 -WithAttachment -AttachmentPath "C:\file.pdf"
#   .\scripts\test-drop-email.ps1 -Subject "Custom subject" -To "user@example.com"
#   .\scripts\test-drop-email.ps1 -CC "cc@example.com" -BCC "bcc@example.com"

param(
    [string]$Subject = "SendArc test email",
    [string]$Body = "This is a test email dropped by test-drop-email.ps1.",
    [string]$To = "test@example.com",
    [string]$ToName = "Test User",
    [string]$CC = "",
    [string]$BCC = "",
    [switch]$WithAttachment,
    [string]$AttachmentPath = "",
    [switch]$Html
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    throw 'LOCALAPPDATA is unavailable; cannot resolve the SendArc queue.'
}
$sendArcQueueDir = Join-Path $env:LOCALAPPDATA 'SendArc\queue'
if (-not (Test-Path -LiteralPath $sendArcQueueDir)) {
    New-Item -ItemType Directory -Path $sendArcQueueDir -Force | Out-Null
}

# Generate the queue stem before copying attachments. The production watcher
# intentionally accepts attachments only from the sibling directory whose name
# matches the JSON stem: <queue>\<stem>.json and <queue>\<stem>\<file>.
$ts = (Get-Date).ToString("yyyyMMdd_HHmmss")
$rand = -join ((0..5) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
$stem = "msg_${ts}_${rand}"
$filename = "$stem.json"
$filePath = Join-Path $sendArcQueueDir $filename

# Build recipients
$toRecipients = @(@{ name = $ToName; address = $To })
$ccRecipients = @()
$bccRecipients = @()

if ($CC) {
    $ccRecipients = @(@{ name = ""; address = $CC })
}
if ($BCC) {
    $bccRecipients = @(@{ name = ""; address = $BCC })
}

# Build attachments
$attachments = @()
if ($WithAttachment) {
    $createdTestSource = $false
    if (-not $AttachmentPath) {
        # Create a small test file
        $testFile = Join-Path $env:TEMP "SendArc-test-attachment-$rand.txt"
        "This is a test attachment created by test-drop-email.ps1." | Out-File -FilePath $testFile -Encoding UTF8
        $AttachmentPath = $testFile
        $createdTestSource = $true
        Write-Host "Created test attachment: $testFile"
    }

    if (-not (Test-Path -LiteralPath $AttachmentPath -PathType Leaf)) {
        Write-Error "Attachment file not found: $AttachmentPath"
        exit 1
    }

    $fileInfo = Get-Item -LiteralPath $AttachmentPath
    $attachmentDir = Join-Path $sendArcQueueDir $stem
    New-Item -ItemType Directory -Path $attachmentDir | Out-Null
    $queuedAttachmentPath = $null

    try {
        $queuedAttachmentPath = Join-Path $attachmentDir $fileInfo.Name
        Copy-Item -LiteralPath $fileInfo.FullName -Destination $queuedAttachmentPath
        $queuedFileInfo = Get-Item -LiteralPath $queuedAttachmentPath
        $attachments = @(@{
            filename = $queuedFileInfo.Name
            path     = $queuedFileInfo.FullName
            size     = $queuedFileInfo.Length
        })
    }
    catch {
        if ($queuedAttachmentPath) {
            Remove-Item -LiteralPath $queuedAttachmentPath -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $attachmentDir -Force -ErrorAction SilentlyContinue
        throw
    }
    finally {
        if ($createdTestSource) {
            Remove-Item -LiteralPath $fileInfo.FullName -Force -ErrorAction SilentlyContinue
        }
    }
}

# Build the email JSON
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
$bodyFormat = if ($Html) { "html" } else { "plain" }

$email = @{
    version    = 1
    timestamp  = $timestamp
    subject    = $Subject
    body       = $Body
    bodyFormat = $bodyFormat
    recipients = @{
        to  = $toRecipients
        cc  = $ccRecipients
        bcc = $bccRecipients
    }
    attachments = $attachments
    originApp   = "test-drop-email.ps1"
}

$json = $email | ConvertTo-Json -Depth 5

# Write the file
try {
    $json | Out-File -LiteralPath $filePath -Encoding UTF8 -NoNewline
}
catch {
    if ($WithAttachment -and $attachmentDir) {
        if ($queuedAttachmentPath) {
            Remove-Item -LiteralPath $queuedAttachmentPath -Force -ErrorAction SilentlyContinue
        }
        Remove-Item -LiteralPath $attachmentDir -Force -ErrorAction SilentlyContinue
    }
    throw
}
Write-Host ""
Write-Host "Dropped test email:" -ForegroundColor Green
Write-Host "  File:    $filePath"
Write-Host "  Subject: $Subject"
Write-Host "  To:      $To"
if ($CC)  { Write-Host "  CC:      $CC" }
if ($BCC) { Write-Host "  BCC:     $BCC" }
if ($attachments.Count -gt 0) {
    Write-Host "  Attach:  $($attachments[0].filename) ($($attachments[0].size) bytes)"
}
Write-Host ""
