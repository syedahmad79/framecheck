# Framecheck

Visual QA for frontend developers. Framecheck compares two screenshots, a reference and an
implementation, pixel by pixel and shows exactly where and how much they differ.

It runs entirely in the browser. Images are never uploaded; comparisons are saved locally in
IndexedDB.

## Features

- Import two PNG or JPEG screenshots by drag-and-drop or file picker.
- Four comparison modes on one synchronised viewport:
  - **Side by side**: both images, panned and zoomed together.
  - **Slider**: a draggable before/after divider.
  - **Overlay**: the implementation over the reference at adjustable opacity.
  - **Differences**: the exact Pixelmatch mask over a dimmed reference, plus a coarse density
    layer when zoomed out so that isolated changed pixels remain visible.
- Real statistics from [Pixelmatch](https://github.com/mapbox/pixelmatch): differing pixels,
  share of compared pixels, anti-aliased pixels ignored, bounding box of all changes, and
  compare time. "Zoom to changes" frames the bounding box.
- Configurable threshold and anti-aliasing handling, recomputed live.
- Explicit handling of mismatched dimensions: images are never rescaled. Choose **Pad** (grow the
  canvas; non-overlapping area is tinted and excluded) or **Crop** (compare only the shared area),
  and an alignment anchor.
- Zoom from 2% to 3200%, zoom at cursor, pan, fit to screen, actual size.
- Comparisons, their settings and view state are saved in IndexedDB and restored from the URL.
- A bundled sample comparison, so the tool can be explored without any files.
- Keyboard operable throughout; responsive down to phone width.

## Getting started

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Then open the URL Vite prints and choose **Open the sample comparison**, or drop two screenshots.

| Script                    | What it does                                               |
| ------------------------- | ---------------------------------------------------------- |
| `npm run dev`             | Start the dev server                                       |
| `npm run build`           | Type-check and build to `dist/`                            |
| `npm run preview`         | Serve the production build                                 |
| `npm run typecheck`       | `tsc -b` in strict mode                                    |
| `npm run lint`            | ESLint with type-aware rules                               |
| `npm run format`          | Prettier                                                   |
| `npm test`                | Unit and component tests (Vitest)                          |
| `npm run test:e2e`        | End-to-end tests against the production build (Playwright) |
| `npm run check`           | Type-check, lint, format check, unit tests and build       |
| `npm run sample:generate` | Re-capture the sample screenshots from `scripts/sample`    |

`test:e2e` and `sample:generate` need a Playwright browser once: `npx playwright install chromium`.

The build uses a relative base path, so `dist/` can be served from any static host or sub-path.

## Using it

1. Add a **Reference** (the design or expected result) and an **Implementation** (what was built).
   Dropping two files at once fills both slots in order.
2. Press **Compare**. The comparison is saved automatically and gets its own URL.
3. Switch modes, adjust the threshold, and use **Zoom to changes** to inspect differences.

| Input                           | Action                                                    |
| ------------------------------- | --------------------------------------------------------- |
| `1` `2` `3` `4`                 | Side by side, Slider, Overlay, Differences                |
| `+` / `-`                       | Zoom in / out by one step                                 |
| `0`                             | Actual size (100%)                                        |
| `F`                             | Fit to screen                                             |
| Arrow keys (viewport focused)   | Pan; hold Shift for larger steps                          |
| Arrow keys (divider focused)    | Move the divider 1%; Shift for 10%; Home/End for the ends |
| Drag                            | Pan                                                       |
| Scroll                          | Pan; Shift + scroll pans sideways                         |
| Ctrl/⌘ + scroll, trackpad pinch | Zoom at the cursor                                        |

### Reading the numbers

- **Different** is the number of pixels whose colour distance exceeds the threshold. The headline
  percentage is that number divided by the pixels actually compared.
- **Threshold** is Pixelmatch's matching threshold from 0 to 1. Pixelmatch 8 measures distance in
  the OKLab colour space, so it tracks perceived difference better than raw RGB distance.
  0 flags every change; 0.1 is the library default.
- **Anti-aliasing, ignored** counts pixels that exceed the threshold but that Pixelmatch classifies
  as edge smoothing. Enable "Count anti-aliased pixels" to treat them as differences.
- **Outside overlap** only appears for mismatched sizes with the Pad strategy. Those pixels exist
  in one image only; they are excluded from the comparison and from the percentage.

## Architecture

Dependencies point one way: `domain` → `services` → `state` → `features`.

```
src/
  domain/      Pure TypeScript, no DOM. Types, layout of mismatched images,
               the diff computation and statistics, viewport maths, file validation.
  services/    Browser boundaries. Image decoding, the diff worker and its client,
               the IndexedDB repository (Dexie).
  state/       Zustand stores. The open comparison (session), the shared viewport,
               hash routing, and the application singletons.
  features/
    home/      Import slots, drop zones, saved-comparison list.
    workspace/ Toolbar, keyboard shortcuts, and the stage: panes, canvas layers,
               the four mode views, pointer and wheel gestures.
    stats/     Result statistics, mismatch handling, sensitivity controls, limitations.
  ui/          Small accessible primitives: button, segmented control, canvas, icons.
  test/        Test setup and shared fakes.
e2e/           Playwright specs.
scripts/       Sample generator and a large-image measurement script.
```

### How a comparison flows

1. **Import.** A file is validated (type, size), decoded with `createImageBitmap`, then checked
   against dimension limits. Each failure has its own error code and message.
2. **Session.** `sessionStore` takes ownership of both bitmaps, creates the project, starts the
   first comparison immediately and writes the project to IndexedDB in the background. The UI
   never waits on storage; a failed write is reported in the header and the comparison stays usable.
3. **Layout.** `computeLayout` decides how two images share one canvas. It is pure and cheap, so
   the UI derives it synchronously while the worker is still busy.
4. **Diff.** `DiffClient` posts the original encoded blobs and the settings to a Web Worker. The
   worker decodes to raw pixels with `OffscreenCanvas`, caches them per comparison, runs
   `computeDiff`, and transfers the mask and density buffers back without copying.
5. **Render.** Every pane draws the same canvas-sized content under one shared CSS transform from
   `viewportStore`. That single transform is what keeps the panes synchronised.

### Decisions worth knowing

- **`computeDiff` is a pure function.** It takes two pixel buffers and settings and returns the
  mask and statistics. The worker is a thin wrapper around it, so the algorithm is unit-tested
  directly with synthetic pixels and no browser.
- **Anti-aliased pixels are counted from Pixelmatch's own output.** In `diffMask` mode Pixelmatch
  does not draw them, so the diff is rendered with a fully faded background and the background is
  stripped in the same pass that collects the statistics.
- **Mismatched sizes use Pixelmatch's `ignoreMask`.** Areas covered by one image only are skipped
  by the comparison, not compared against transparent padding, so they can never inflate the result.
- **Latest wins.** Dragging the threshold slider produces many requests. They are debounced in the
  store; the client resolves a superseded job with `null`; the worker collapses queued requests to
  the newest. A stale result can never overwrite a newer one.
- **A result knows which settings produced it.** The UI only draws a mask whose layout matches the
  current strategy and anchor, and marks the numbers as "Updating…" until they match every setting.
- **The session store is a factory with injected dependencies** (repository, diff client, decoder),
  so its orchestration, races included, is tested without a browser, worker or database.
- **The URL is the source of truth for what is open.** Hash routes (`#/p/<id>`, `#/sample`) need no
  server configuration and restore the comparison on reload.
- **Encoded bytes are stored, not pixels.** IndexedDB holds the original PNG/JPEG bytes as
  ArrayBuffers and the diff is recomputed on open. This keeps storage small and avoids the Blob
  cloning differences between IndexedDB implementations.

## Testing

```bash
npm test
npm run test:e2e
```

- **Unit (Vitest):** layout for pad/crop and every anchor; the diff computation including exact
  counts, bounds, threshold, anti-aliasing and mismatched sizes; viewport maths; file validation and
  formatting; the diff client's latest-wins and crash recovery; the IndexedDB repository against
  `fake-indexeddb`; the session store's debouncing, autosave, error handling and races; routing.
- **Component (React Testing Library):** segmented control and divider keyboard behaviour, the home
  screen's import, rejection, swap and delete flows, the stats panel's states and controls, and
  keyboard shortcuts.
- **End to end (Playwright, Chromium, production build):** the sample, all four modes, the divider
  by keyboard and mouse, zoom/pan/fit, live threshold changes, uploads with exact expected pixel
  counts, identical images, mismatched sizes with both strategies, invalid and corrupt files,
  persistence across a reload, deletion, and a missing comparison link.

jsdom has no canvas, so drawing is covered by the end-to-end tests, not the component tests.

## Performance

Decoding to pixels and the comparison run in a worker, so the main thread stays free. Measured
with `scripts/measure-large.ts` on the production build in headless Chromium 159, on a 10-core
Mac with 16 GB of memory, in side-by-side mode. "Frame gap" is the longest interval between
animation frames on the main thread while the comparison ran (16.7 ms is one frame at 60 Hz).

| Image size           | First result after Compare | Compare time | Longest frame gap | Threshold change |
| -------------------- | -------------------------- | ------------ | ----------------- | ---------------- |
| 1920 × 1080 (2.1 MP) | 117 ms                     | 21 ms        | 17 ms             | 28 ms            |
| 4000 × 3000 (12 MP)  | 266 ms                     | 103 ms       | 17 ms             | 110 ms           |
| 6000 × 6000 (36 MP)  | 1061 ms                    | 310 ms       | 67 ms             | 329 ms           |

These are single runs on one machine with synthetic, flat-colour images. Treat them as an order
of magnitude, not a benchmark. Slower devices, other browsers and photographic content will differ.

## Known limitations

**What a pixel comparison can and cannot tell you**

- Pixels are compared by position. A one-pixel layout shift marks everything after it as different,
  so a large percentage can have one small cause. There is no shift detection or structural
  (DOM-aware) comparison.
- The percentage measures how much of the image changed, not how visible or important the change is.
- Anti-aliasing detection is a heuristic and can misclassify thin lines and small text.
- Screenshots at different device pixel ratios, or JPEGs at different qualities, differ almost
  everywhere. Framecheck does not normalise scale or compression.

**Browser behaviour**

- Only verified in Chromium (manually and with Playwright). Firefox and Safari are untested. The app
  needs module workers, `OffscreenCanvas` with a 2D context, and `createImageBitmap`; there is no
  fallback when these are missing, only an error message.
- Pixels are read through a canvas, which stores colour premultiplied by alpha. Fully opaque
  screenshots are unaffected; semi-transparent pixels can lose a little precision.
- Embedded colour profiles and JPEG decoding are handled by the browser and can vary between
  browsers, so the same files may produce slightly different counts elsewhere.
- EXIF orientation is applied on decode, matching how an `<img>` would display the file.

**Limits**

- Files up to 50 MB, 16,384 px per side and 40 megapixels per image. These are conservative
  application limits, not browser guarantees; a browser may still run out of memory below them,
  in which case the worker is restarted and the error is shown with a retry.
- Memory use is several times the raw pixel size (4 bytes per pixel), because the worker holds both
  decoded images and the mask while the page holds bitmaps and canvases.
- IndexedDB storage is subject to the browser's quota and may be unavailable or cleared in private
  windows. Saved comparisons exist only in the browser profile that created them; there is no
  export, import or sync.

**Interaction**

- Touch supports one-finger panning and the toolbar zoom buttons. Two-finger pinch zoom on touch
  screens is not implemented (trackpad pinch works).
- The interface is dark only.
- `eslint-plugin-jsx-a11y` is not used because it does not yet support ESLint 10. Accessibility is
  covered by role-based queries in the tests and manual keyboard checks, not by an automated audit.
- TypeScript is pinned to 6.0 because `typescript-eslint` does not yet support TypeScript 7.

## License

MIT
