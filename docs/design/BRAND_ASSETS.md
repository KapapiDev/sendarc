# SendArc brand assets

The clean vector sources are:

- `website/public/logo.svg` — primary horizontal wordmark
- `website/public/logo-monochrome.svg` — single-color wordmark
- `website/public/favicon.svg` — square app/website mark

Raster app-icon exports are in `docs/design/brand/` at 16, 24, 32, 48, 64, 128, 256, and 512 pixels. `src/app/build/appicon.png` is the 512-pixel Wails source, and `src/app/build/windows/icon.ico` contains Windows icon frames from 16 through 256 pixels.

The mark is recreated as SVG geometry and is not a crop from the supplied landing-page screenshot. Preserve clear space equal to the endpoint-circle diameter. Use the primary cobalt mark on white or very pale backgrounds and the monochrome mark where only one ink color is available.

The Windows executable metadata uses product name `SendArc`, operator
`장형진`, and numeric file/product version `0.1.0.0`. Keep the numeric form in
`src/app/wails.json` so the fixed Windows resource remains unambiguous; the
human-facing app version can still retain a beta or development suffix. The
tracked `build/windows/info.json` provides the English resource string table
used by Explorer and installer verification.
