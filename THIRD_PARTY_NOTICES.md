# Third-party notices

## go-mapi upstream

SendArc incorporates and modifies [go-mapi](https://github.com/marcfargas/go-mapi) by Marc Fargas. The fork started from upstream commit [`b90fcb08754f910fc318cbc922cbf24702582463`](https://github.com/marcfargas/go-mapi/commit/b90fcb08754f910fc318cbc922cbf24702582463). The original Git history is preserved and the repository retains `https://github.com/marcfargas/go-mapi.git` as the `upstream` remote.

The repository declares `LGPL-3.0-or-later`; the license text is in [LICENSE](LICENSE). This notice does not alter the license or copyright notice of any individual file. For every distributed SendArc binary, the matching public SendArc tag/release must make corresponding source and build instructions available.

> SendArc incorporates and modifies open-source code from go-mapi. Covered source code is provided under the GNU Lesser General Public License v3.0 or later. SendArc is an independent project and is not affiliated with the original go-mapi author or Affixa.

No endorsement by Marc Fargas, go-mapi contributors, Affixa, or Notably Good Ltd. is implied.

## Included and direct dependencies

SendArc also uses third-party packages whose own licenses and notices remain in force. The dependency manifests and vendored license files at the exact release tag are authoritative. Notable components include:

- Wails v2 and its Go/WebView2 dependencies;
- Svelte, Vite, TypeScript, and Vitest;
- `golang.org/x/oauth2`;
- `fsnotify/fsnotify`;
- `zalando/go-keyring` and its Windows Credential Manager backend;
- `fyne.io/systray`;
- `jackmordaunt/go-toast`;
- `creativeprojects/go-selfupdate`, used for release metadata/checksum helpers while the product update behavior remains notify-only;
- the vendored Wails `go-webview2` fork, whose [MIT license](src/app/vendor/go-webview2-e2e/LICENSE) and loader [ISC license](src/app/vendor/go-webview2-e2e/webviewloader/LICENSE) are included;
- doctest 2.4.11, included in `src/interceptor/tests/doctest.h` under the MIT license, with portions attributed there to Catch2 and lest under the Boost Software License 1.0;
- the vendored NSIS ApplicationID plugin described in [its README](src/installer/plugins/x86-unicode/README.md) under the stated zlib/libpng terms;
- Nunito font files under the [SIL Open Font License 1.1](src/app/frontend/src/assets/fonts/OFL.txt).

Before a public release, generate and archive a complete dependency/license inventory from `go.mod`/build lists, npm lockfiles, vendored source, installer payloads, and website lockfiles. Resolve any missing license text before distribution; this high-level notice is not a substitute for that release inventory.

Google, Gmail, Microsoft, Windows, Cloudflare, GitHub, Affixa, and other product names are trademarks of their respective owners. Their names describe interoperability or service providers and do not imply sponsorship or endorsement.
