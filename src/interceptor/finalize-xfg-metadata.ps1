# Finalize and verify the x64 Simple MAPI XFG target metadata.
#
# MSVC 14.51 accepts /guard:xfg and advertises XFG at image level, but does
# not emit IMAGE_GUARD_FLAG_FID_XFG on MASM-defined functions. The six public
# landing pads carry canonical type hashes in mapi_xfg_exports.asm; this script
# marks only those verified GFID entries as XFG targets that participate in
# export suppression, matching the metadata used by the Windows MAPI shim.

param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = "Stop"

$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$bytes = [System.IO.File]::ReadAllBytes($resolvedPath)

function Read-U16([int]$Offset) {
    return [System.BitConverter]::ToUInt16($bytes, $Offset)
}

function Read-U32([int]$Offset) {
    return [System.BitConverter]::ToUInt32($bytes, $Offset)
}

function Read-U64([int]$Offset) {
    return [System.BitConverter]::ToUInt64($bytes, $Offset)
}

function Read-AsciiZ([int]$Offset) {
    $end = $Offset
    while ($end -lt $bytes.Length -and $bytes[$end] -ne 0) {
        $end++
    }
    if ($end -ge $bytes.Length) {
        throw "Unterminated PE export name at file offset 0x$($Offset.ToString('X'))."
    }
    return [System.Text.Encoding]::ASCII.GetString($bytes, $Offset, $end - $Offset)
}

if ($bytes.Length -lt 512 -or (Read-U16 0) -ne 0x5A4D) {
    throw "Not a valid PE image: $resolvedPath"
}

$peOffset = [int](Read-U32 0x3C)
if ($peOffset + 264 -gt $bytes.Length -or (Read-U32 $peOffset) -ne 0x00004550) {
    throw "Invalid PE signature: $resolvedPath"
}

$fileHeader = $peOffset + 4
$machine = Read-U16 $fileHeader
$sectionCount = Read-U16 ($fileHeader + 2)
$optionalHeaderSize = Read-U16 ($fileHeader + 16)
$optionalHeader = $fileHeader + 20

if ($machine -ne 0x8664 -or (Read-U16 $optionalHeader) -ne 0x20B) {
    throw "XFG metadata finalization requires an x64 PE32+ image."
}

$imageBase = Read-U64 ($optionalHeader + 24)
$dataDirectory = $optionalHeader + 112
$exportRva = Read-U32 $dataDirectory
$exportSize = Read-U32 ($dataDirectory + 4)
$loadConfigRva = Read-U32 ($dataDirectory + (10 * 8))

if ($exportRva -eq 0 -or $loadConfigRva -eq 0) {
    throw "The provider is missing its export or load-config directory."
}

$sections = @()
$sectionTable = $optionalHeader + $optionalHeaderSize
for ($i = 0; $i -lt $sectionCount; $i++) {
    $offset = $sectionTable + ($i * 40)
    $sections += [pscustomobject]@{
        VirtualSize = Read-U32 ($offset + 8)
        VirtualAddress = Read-U32 ($offset + 12)
        RawSize = Read-U32 ($offset + 16)
        RawOffset = Read-U32 ($offset + 20)
    }
}

function Convert-RvaToOffset([uint32]$Rva) {
    foreach ($section in $sections) {
        $span = [Math]::Max([uint64]$section.VirtualSize, [uint64]$section.RawSize)
        if ([uint64]$Rva -ge [uint64]$section.VirtualAddress -and
            [uint64]$Rva -lt ([uint64]$section.VirtualAddress + $span)) {
            return [int]([uint64]$section.RawOffset + ([uint64]$Rva - [uint64]$section.VirtualAddress))
        }
    }
    throw "RVA 0x$($Rva.ToString('X8')) is outside every PE section."
}

$exportDirectory = Convert-RvaToOffset $exportRva
$functionCount = Read-U32 ($exportDirectory + 20)
$nameCount = Read-U32 ($exportDirectory + 24)
$functionsRva = Read-U32 ($exportDirectory + 28)
$namesRva = Read-U32 ($exportDirectory + 32)
$ordinalsRva = Read-U32 ($exportDirectory + 36)
$functionsOffset = Convert-RvaToOffset $functionsRva
$namesOffset = Convert-RvaToOffset $namesRva
$ordinalsOffset = Convert-RvaToOffset $ordinalsRva

$exports = @{}
for ($i = 0; $i -lt $nameCount; $i++) {
    $nameRva = Read-U32 ($namesOffset + ($i * 4))
    $name = Read-AsciiZ (Convert-RvaToOffset $nameRva)
    $ordinalIndex = Read-U16 ($ordinalsOffset + ($i * 2))
    if ($ordinalIndex -ge $functionCount) {
        throw "Export '$name' has an invalid ordinal index."
    }
    $targetRva = Read-U32 ($functionsOffset + ($ordinalIndex * 4))
    if ($targetRva -ge $exportRva -and $targetRva -lt ($exportRva + $exportSize)) {
        throw "Forwarded export '$name' is not a local XFG target."
    }
    $exports[$name] = [uint32]$targetRva
}

$loadConfigOffset = Convert-RvaToOffset $loadConfigRva
if ((Read-U32 $loadConfigOffset) -lt 148) {
    throw "The x64 load-config directory is too small for CFG metadata."
}

$guardTableVa = Read-U64 ($loadConfigOffset + 128)
$guardFunctionCount = Read-U64 ($loadConfigOffset + 136)
$guardFlags = Read-U32 ($loadConfigOffset + 144)

$requiredImageFlags = [uint32]0x00804500
if (($guardFlags -band $requiredImageFlags) -ne $requiredImageFlags) {
    throw "The provider is missing required CFG/XFG image flags (0x$($guardFlags.ToString('X8')))."
}

$guardStride = 4 + (($guardFlags -shr 28) -band 0xF)
if ($guardStride -lt 5) {
    throw "GFID entries have no metadata byte; cannot mark XFG targets safely."
}

if ($guardTableVa -lt $imageBase) {
    throw "The GFID table VA precedes the image base."
}
$guardTableRva = [uint32]($guardTableVa - $imageBase)
$guardTableOffset = Convert-RvaToOffset $guardTableRva

$expectedHashes = [ordered]@{
    MAPIFreeBuffer = 'B099976A12DCA271'
    MAPILogoff = '81F0A751725AF871'
    MAPILogon = 'E755B7C63ED19871'
    MAPISendDocuments = 'A738177716D2C171'
    MAPISendMail = 'A255A7A23CD2DB71'
    MAPISendMailW = 'D8D0BEE67A5D3271'
}

foreach ($entry in $expectedHashes.GetEnumerator()) {
    $name = $entry.Key
    if (-not $exports.ContainsKey($name)) {
        throw "Required Simple MAPI export '$name' is missing."
    }

    $targetRva = [uint32]$exports[$name]
    if (($targetRva -band 0xF) -ne 0) {
        throw "Export '$name' is not 16-byte aligned (RVA 0x$($targetRva.ToString('X8')))."
    }

    $hashOffset = Convert-RvaToOffset ([uint32]($targetRva - 8))
    $actualHash = Read-U64 $hashOffset
    $expectedHash = [uint64]::Parse($entry.Value, [System.Globalization.NumberStyles]::HexNumber)
    if ($actualHash -ne $expectedHash) {
        throw "Export '$name' has XFG hash 0x$($actualHash.ToString('X16')); expected 0x$($expectedHash.ToString('X16'))."
    }

    $gfidOffset = -1
    for ([uint64]$i = 0; $i -lt $guardFunctionCount; $i++) {
        $candidateOffset = $guardTableOffset + ([int]$i * $guardStride)
        if ((Read-U32 $candidateOffset) -eq $targetRva) {
            $gfidOffset = $candidateOffset
            break
        }
    }
    if ($gfidOffset -lt 0) {
        throw "Export '$name' is absent from the Guard CF function table."
    }

    $metadataOffset = $gfidOffset + 4
    # IMAGE_GUARD_FLAG_EXPORT_SUPPRESSED (0x02) lets GetProcAddress enable the
    # exported target, while IMAGE_GUARD_FLAG_FID_XFG (0x08) makes the XFG
    # dispatcher validate the canonical type hash stored at target - 8.
    $bytes[$metadataOffset] = [byte]($bytes[$metadataOffset] -bor 0x0A)
    Write-Host "XFG target verified: $name RVA=0x$($targetRva.ToString('X8')) hash=0x$($actualHash.ToString('X16')) flags=0x$($bytes[$metadataOffset].ToString('X2'))"
}

[System.IO.File]::WriteAllBytes($resolvedPath, $bytes)
Write-Host "Finalized XFG metadata: $resolvedPath"
