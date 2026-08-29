# NSIS ApplicationID plugin (vendored)

Source: https://nsis.sourceforge.io/ApplicationID_plug-in
Download: https://nsis.sourceforge.io/mediawiki/images/8/8e/ApplicationID.zip
File: Plugins/x86-unicode/ApplicationID.dll
License: zlib/libpng (LGPL-3.0 compatible per nsis.sourceforge.io plugin conventions)
Consumed by: `src/installer/SendArc.nsi` — `ApplicationID::Set` call in the shortcut/AUMID function.
Re-vendoring: replace the DLL with the latest connectiblutz-fork build if needed; no code changes in `SendArc.nsi` are required unless the plugin ABI changes.

## Actual acquisition notes (2026-04-20)

The legacy sourceforge ZIP link (`https://nsis.sourceforge.io/mediawiki/images/8/8e/ApplicationID.zip`)
returns 404 as of 2026; the NSIS wiki page now points to the actively maintained connectiblutz fork
at https://github.com/connectiblutz/NSIS-ApplicationID. The vendored binary in this directory was
taken from the v1.1 release:

    https://github.com/connectiblutz/NSIS-ApplicationID/releases/download/1.1/NSIS-ApplicationID.zip
    → ReleaseUnicode/ApplicationID.dll

Size: 203264 bytes. This is the Unicode release build, required because `SendArc.nsi` declares
`Unicode True`.
