# Windows code-signing status

## Current decision

SendArc `0.1.0-beta` uses a no-payment release constraint. No eligible free trusted signing path has been confirmed for the current Korean individual operator, so the beta may be published unsigned only if every download/release surface labels it **Unsigned beta**.

Do not use self-signed certificates as if they established public trust. Do not tell users to disable SmartScreen, Defender, or enterprise controls. Do not buy a certificate or managed signing plan without new authorization.

## Preferred future path

Use an Authenticode certificate or managed signing service issued to the final legal publisher identity. The release order must be:

1. build reproducible x64 desktop executable and x64/x86 MAPI DLLs;
2. sign those three binaries;
3. verify each signature and timestamp;
4. build the installer from the signed payloads;
5. sign the installer;
6. verify all four signatures with `Get-AuthenticodeSignature` and WinVerifyTrust;
7. generate SHA-256 checksums from the final immutable artifacts;
8. publish tag, source, checksums, and artifacts together.

If signing is configured, any missing/invalid signature must fail the release. If signing is not configured for the authorized unsigned beta, the workflow must name artifacts and release notes truthfully and must not claim publisher verification.

## Re-evaluation triggers

- A domain/legal publisher identity is finalized.
- The project becomes eligible for a reputable open-source signing program.
- A paid signing budget is explicitly approved.
- Microsoft changes individual availability or pricing for its managed signing service.

