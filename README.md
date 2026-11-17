# Framecheck

Visual QA for frontend developers. Framecheck compares a reference screenshot with an
implementation screenshot pixel by pixel and shows exactly where, and by how much, they differ.

It runs entirely in the browser. Images are never uploaded, there are no accounts or analytics,
and comparisons are saved locally in IndexedDB.

## Features

- Import two PNG or JPEG screenshots by drag-and-drop or file picker. Dropping both at once fills
  both slots. Invalid and corrupt files get specific, actionable errors.
- Four comparison modes on one shared pan and zoom:
  - **Side by side**: both images in synchronised panes, with a matching pixel marker in each.
  - **Slider**: a draggable before/after divider. Reference left, implementation right.
  - **Overlay**: the implementation over the reference with a blend slider. Hold `R` or `I` to
    flick to one image on its own.
  - **Differences**: the exact Pixelmatch mask over a dimmed, desaturated reference, with a
    legend, an adjustable amount of reference context, and a halo that keeps isolated changes
    visible when zoomed out.
- Honest statistics: difference percentage, pixel counts, pixels actually compared, pixels ignored
  as anti-aliasing, pixels not compared (size mismatch), the bounding box of changes, the settings
  that produced the numbers, and a marked "Updating…" state so stale numbers are never shown as
  current.
- Configurable threshold and anti-aliasing handling, recomputed live.
- Explicit handling of mismatched dimensions: images are never rescaled. Choose **Pad** or
  **Crop**, and an alignment anchor (top left, top centre, centre).
- Zoom from 2% to 3200% with zoom at the cursor, pinch, double-click, inertial panning, fit,
  actual size and zoom-to-changes. Above 6× a pixel under the pointer is outlined; above 10× a
  pixel grid appears. The footer reports the pointer's pixel coordinates and the colour of both
  images there.
- Light and dark themes, each designed separately, following the system by default and remembering
  an explicit choice.
- Saved comparisons, settings and view state, restored from the URL. A bundled sample that opens on
  the differences view.
- Keyboard operable throughout, with a shortcut list (`?`). Responsive from phone to desktop.

## Getting started

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints and choose **Open the sample comparison**, or drop two screenshots.

| Script                    | What it does                                               |
| ------------------------- | ---------------------------------------------------------- |
| `npm run dev`             | Start the dev server                                       |
| `npm run build`           | Type-check and build to `dist/`                            |
| `npm run preview`         | Serve the production build                                 |
| `npm run typecheck`       | `tsc -b`, strict mode                                      |
| `npm run lint`            | ESLint with type-aware rules                               |
| `npm run format`          | Prettier                                                   |
| `npm test`                | Unit and component tests (Vitest)                          |
| `npm run test:e2e`        | End-to-end tests against the production build (Playwright) |
| `npm run check`           | Type-check, lint, format check, unit tests and build       |
| `npm run sample:generate` | Re-capture the sample screenshots from `scripts/sample`    |

`test:e2e` and `sample:generate` need Playwright browsers once:
`npx playwright install chromium firefox webkit`. To run one engine: `npx playwright test --project=webkit`.

The build uses a relative base path, so `dist/` can be served from any static host or sub-path.

## Using it

1. Add a **Reference** (the design or expected result) and an **Implementation** (what was built).
2. Press **Compare**. The comparison is saved automatically and gets its own URL.
3. Switch modes, adjust the threshold, and use **Zoom to changes**. The headline number stays in the
   toolbar; the inspector holds the detail and can be collapsed with `[`.

| Input                           | Action                                                    |
| ------------------------------- | --------------------------------------------------------- |
| `1` `2` `3` `4`                 | Side by side, Slider, Overlay, Differences                |
| Hold `R` / `I`                  | Show only the reference / implementation                  |
| `+` / `−`, `0`, `F`             | Zoom a step, actual size, fit                             |
| Arrow keys (viewport focused)   | Pan; Shift for larger steps                               |
| Arrow keys (divider focused)    | 1%; Shift or Page keys 10%; Home/End to the ends          |
| Double-click                    | Zoom in at the cursor and back to fit; centre the divider |
| Drag, scroll                    | Pan                                                       |
| Ctrl/⌘ + scroll, trackpad pinch | Zoom at the cursor                                        |
| Two-finger pinch (touch)        | Zoom and pan                                              |
| `[`, `?`                        | Toggle the inspector, show shortcuts                      |

### Reading the numbers

- **Different** is the number of compared pixels whose colour distance exceeds the threshold. The
  percentage is that count divided by the pixels actually compared.
- **Threshold** is Pixelmatch's matching threshold from 0 to 1, a distance in the OKLab colour
  space with a lightness-weighted metric. 0 flags every change; 0.1 is the library default.
- **Ignored** counts pixels over the threshold that Pixelmatch classifies as anti-aliasing. They
  are left out of the total unless "Count anti-aliased pixels" is on.
- **Not compared** appears for mismatched sizes with Pad. Those pixels exist in one image only.
  They are tinted on the stage and never counted as differences or in the percentage.

## Design

A small token system in `src/index.css` covers surfaces, text, borders, role colours, shadows,
radii, type scale and motion timing, defined per theme. Colour carries meaning only: blue is the
reference, orange the implementation, pink a difference, teal an ignored anti-aliased pixel.
Everything else is neutral. Type uses the system font stack with tracking that tightens as size
grows. No fonts or other assets are fetched.

Motion is short and purposeful: the mode switcher's thumb slides, the inspector slides, and zoom,
fit and zoom-to-changes glide on a critically damped spring that starts from the current on-screen
value and is interrupted by any input. Dragging the divider, panning and wheel zoom are never
eased: they follow the pointer exactly. Under `prefers-reduced-motion` all transitions collapse and
viewport changes apply instantly.

## Architecture

Dependencies point one way: `domain` → `services` → `state` → `features`.

```
src/
  domain/      Pure TypeScript, no DOM. Layout of mismatched images, the diff computation
               and statistics, draw geometry, viewport maths, spring physics, file validation.
  services/    Browser boundaries. Image decoding, the diff worker and its client,
               the IndexedDB repository (Dexie), single-pixel sampling.
  state/       Zustand stores: the open comparison, the shared viewport (with its motion),
               theme, preferences, the pixel probe, hash routing.
  features/
    home/       Import slots, drop zones, previews.
    projects/   Saved-comparison list.
    workspace/  Top bar, toolbar, shortcuts, dialogs, and the stage (canvas panes, mode views,
                the divider, gestures).
    inspector/  Result statistics, sensitivity, alignment, image properties, notes.
  ui/          Accessible primitives: button, segmented control, range, switch, dialog, tooltips.
  test/        Test setup, fakes, a brute-force oracle for the diff tests.
e2e/           Playwright specs.
scripts/       Sample generator and a large-image measurement script.
```

### How a comparison flows

1. **Import.** A file is validated, decoded with `createImageBitmap`, then checked against
   dimension limits.
2. **Session.** `sessionStore` takes ownership of both bitmaps, starts the first comparison
   immediately and saves the project in the background. The UI never waits on storage.
3. **Layout.** `computeLayout` decides how two images share one canvas. It is pure and cheap, so the
   UI derives it synchronously.
4. **Diff.** `DiffClient` posts the encoded blobs and settings to a Web Worker. The worker decodes
   to pixels with `OffscreenCanvas`, caches them, extracts the overlap of the two images, runs
   Pixelmatch, and returns statistics plus the mask as a transferable `ImageBitmap`. Leaving a
   comparison terminates the worker, which frees its decoded copies.
5. **Render.** Each pane is one canvas sized to its on-screen box times the device pixel ratio, not
   to the image. Zooming and panning redraw only the visible source pixels, scaled by exactly the
   zoom factor. Memory does not grow with the zoom level, the picture is crisp at any zoom, and no
   React render happens while the pointer moves: the viewport store notifies each pane, which
   schedules at most one paint per animation frame.

### Decisions worth knowing

- **`computeDiff` is a pure function** over pixel buffers. The worker is a thin wrapper, so the
  algorithm is unit-tested directly.
- **Only the overlap is compared.** The two overlap regions are extracted and handed to Pixelmatch,
  rather than padding to a common canvas and masking. Padding can therefore neither create
  differences nor influence Pixelmatch's neighbour-based anti-aliasing detection.
- **Transparent pixels are composited over plain white**, not Pixelmatch's default checkerboard.
  The checkerboard picks a background per pixel position, so a transparent-versus-white
  comparison would flag about 7 in 8 pixels depending on where they sit. White is deterministic. The
  inspector says how many compared pixels are partly transparent.
- **The mask is read back under a checked invariant.** Pixelmatch reports the count of differing
  pixels but not of ignored anti-aliased ones, so the mask is read. That is only valid while the
  differing count read from the mask equals the count Pixelmatch returned, which is checked on
  every comparison and throws if it ever fails.
- **Gesture ownership is explicit.** The stage uses native listeners; the divider uses React
  handlers. React delegates to the root, so a native stage listener always runs first and
  `stopPropagation` in a React handler cannot stop it. The stage therefore skips any gesture that
  starts on a control (`data-gesture-owner`, buttons, links, inputs), which also avoids pointer
  capture retargeting the click that follows.
- **The divider and the clip share one box.** Its position is the pointer's offset along the pane's
  own bounding box (minus the offset at which it was grabbed), and the painter clips at that
  fraction of the same pane width. Zoom and pan cannot skew them.
- **Latest wins.** Settings changes are debounced in the store, the client resolves a superseded job
  with `null`, and the worker collapses queued requests to the newest.
- **A result knows which settings produced it.** The UI draws a mask only if its layout matches the
  current strategy and anchor, and marks numbers as updating until they match every setting.
- **The URL is the source of truth** for what is open (`#/p/<id>`, `#/sample`).

## Accuracy audit

The engine was audited rather than assumed correct. Findings:

- **Fixed: transparent pixels** were compared against a position-dependent checkerboard (above).
- **Fixed: padding** could influence anti-aliasing classification at the edge of the overlap.
- **Fixed: the worker retained both decoded images** after leaving a comparison.
- **Verified:** counts, bounds and exclusions match an independent brute-force walk over every
  canvas pixel, for both strategies and all three anchors, across 60 seeded random image pairs
  (`src/test/oracle.ts`, written from the definition of each strategy rather than from the layout
  code). Percentage denominators, bounding boxes in canvas coordinates, and "ignored plus different
  equals different when counting anti-aliasing" hold in every case.
- **Verified: threshold boundary.** For opaque grays the expected distance is the difference of
  toe-corrected OKLab lightness, computed from Ottosson's published formulas in the test. Pixelmatch
  flips within 2×10⁻⁴ of that value for every pair tested except the one below.
- **Known upstream quirk:** at threshold 1.0, pure black versus pure white is still flagged,
  because floating-point residue in the chroma term is non-zero when the allowed distance is
  exactly 0. Pinned by a test. The slider allows 1.0; nothing realistic depends on it.

Pixel difference is not semantic similarity. A one-pixel layout shift marks everything after it as
different. Framecheck reports how many pixels differ under stated settings, nothing more, and adds
no similarity or "accuracy" score.

## Testing

```bash
npm test
npm run test:e2e
```

- **Unit and component (Vitest, React Testing Library, jsdom): 237 tests in 20 files.** Engine
  (known cases, oracle, threshold boundary, transparency, every anchor and strategy), render
  geometry, spring physics, viewport store including animated motion and interruption, the session
  store's debouncing and races, the diff client, the IndexedDB repository, theme and preference
  persistence, the divider (drag both ways, extremes, grab offset, cancel, lost capture, second
  pointer, touch, pen, resize mid-drag, keyboard), stage gestures (pan, pinch, wheel, double-click,
  ownership), the home screen, the inspector and keyboard shortcuts.
- **End to end (Playwright): 60 specs per browser.** The divider (both directions, extremes, after
  zoom, pan and resize, release outside the window, real touch input on Chromium), pixel-level
  agreement between the divider and the painted clip with differently sized images, themes,
  persistence, dialogs, the inspector, responsive layouts at phone, tablet and laptop widths, and
  axe-core audits in both themes at WCAG 2.0/2.1 A and AA.

The divider's ownership test was checked by mutation: with the owner check removed it fails.

jsdom has no canvas, so painting is verified by the end-to-end tests, which read canvas pixels.

## Performance

Decoding and comparison run in a worker; panning and zooming redraw only visible pixels.
Measured with `scripts/measure-large.ts` on the production build in headless Chromium 159, 10-core
Mac, 16 GB, 1440×900 viewport, synthetic flat-colour images. Frame times are `requestAnimationFrame`
intervals (16.7 ms is one frame at 60 Hz).

| Image size           | First result after Compare | Compare time | Panning the diff at 100% (worst frame) | Ctrl+wheel zoom (worst frame) |
| -------------------- | -------------------------- | ------------ | -------------------------------------- | ----------------------------- |
| 1920 × 1080 (2.1 MP) | 119 ms                     | 24 ms        | 16.8 ms                                | 16.8 ms                       |
| 4000 × 3000 (12 MP)  | 336 ms                     | 120 ms       | 16.8 ms                                | 33.3 ms                       |
| 6000 × 6000 (36 MP)  | 890 ms                     | 341 ms       | 16.8 ms                                | 33.5 ms                       |

A threshold change at 36 MP recomputed in 338 ms, reusing the worker's decoded pixels. These are
single runs on one machine with flat-colour images: an order of magnitude, not a benchmark. Memory
was not measured.

## Browser support

| Engine   | Status                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium | Full end-to-end suite passes (touch tests use the DevTools Protocol).                                                                        |
| WebKit   | Full end-to-end suite passes in Playwright's WebKit build, except the two touch specs, which are skipped.                                    |
| Firefox  | Configured as a Playwright project, but **could not be run in the environment this was built in** (the browser would not start). Unverified. |

Required features: module workers, `OffscreenCanvas` with a 2D context, `createImageBitmap`, and
container query units (for the divider's grab area). When these are missing there is no fallback,
only an error message. Real Safari on iOS is untested; the Playwright WebKit build is not iOS.

## Known limitations

**What a pixel comparison can tell you**

- Pixels are compared by position. A one-pixel layout shift flags everything after it. There is no
  shift detection and no DOM-aware comparison.
- The percentage measures how much changed, not how noticeable the change is.
- Anti-aliasing detection is a heuristic and can misclassify thin lines and small text.
- Screenshots at different device pixel ratios, or JPEGs at different qualities, differ almost
  everywhere. Framecheck does not normalise scale or compression.
- Partly transparent pixels are compared as if over white. Canvas readback stores colour
  premultiplied by alpha, so semi-transparent pixels can lose a little precision. Opaque
  screenshots are unaffected.
- Colours are compared after the browser decodes the file, so colour profiles and JPEG decoding can
  vary slightly between browsers.

**Limits**

- Files up to 50 MB, 16,384 px per side, 40 megapixels per image. These are application limits, not
  browser guarantees; a browser may still run out of memory, in which case the worker restarts and
  the error is shown with a retry. Memory is several times the raw pixel size.
- IndexedDB is subject to browser quota and may be unavailable in private windows. Saved
  comparisons exist only in the browser profile that made them. There is no export or sync.

**Interaction and verification**

- The pixel readout and outline show the pixel under a mouse. On touch screens there is no hover.
- Pinch, double-tap and inertial panning are covered by unit tests with synthetic pointers, not by
  tests on a real touch device.
- There is no magnifier loupe: the outline, grid, readout and 3200% zoom cover pixel inspection.
- axe-core checks a subset of accessibility. It does not replace testing with a screen reader,
  which was not done.
- TypeScript is pinned to 6.0 because `typescript-eslint` does not yet support 7, and
  `eslint-plugin-jsx-a11y` is not used because it does not yet support ESLint 10.

## License

MIT
