# Development

How to run, check, change and release the simulator. Related documents:
- the rules the code follows: [conventions.md](conventions.md)
- the page's design: [ui-design.md](ui-design.md)
- the plan, release by release: [../design/roadmap.md](../design/roadmap.md)
- the machine's decisions: [../design/decisions.md](../design/decisions.md)

## Running it

There is nothing to build. Serve the repository's root over HTTP:

```
pnpm serve           # or: python3 -m http.server 8000
```

Then open <http://localhost:8000/>. `pnpm serve` tells the browser not to cache, so an edited module is always the one loaded. Browsers do not load modules from `file://`, so opening `index.html` from disk does not work.

**Options in the address** (developer options, not linked from the page):

| Option | What it does |
|---|---|
| `?selftest` | Runs the page's own checks and shows a tick or a cross for each; publishes `window.__selftest = { done, passed, failed }` |
| `?debug` | Exposes the set-up to the console as `cec` (js/sim/system.js), and the page as `app` (stage, dock, flat, viewer, model()) |

The page's own link format (`#view=3d`, `#view=2d`, `?lang=`) is described in [ui-design.md](ui-design.md) (P8). From 1.0.0 it is frozen.

## Requirements

- **Node.js 24** (22 or later works) and **pnpm**, pinned in `package.json`; `corepack enable` installs it. These are for the checks only: `pnpm install` fetches three.js for the tests and TypeScript's checker, and the page does not use them.
- **Blender 4.2 or later**, for `pnpm build:model` only (`BLENDER` names its binary if it is not in `/Applications`).
- **Chrome**, for `pnpm test:browser` only (`CHROME` names it if it is not found).

## Checks

```
pnpm install
pnpm check          # all three below, in order (what CI runs)
pnpm check:refs     # no private references, local paths or broken links
pnpm typecheck      # the JSDoc types, checked strictly; nothing is compiled
pnpm test           # the machine on its ROMs, the 6502's sample, the page's logic, the model, vendor/
pnpm test:6502      # the 6502 against all 1,510,000 SingleStepTests cases (downloads ~750 MB once)
reuse lint          # every file's licence is declared (REUSE.toml, LICENSES/)
```

`reuse` is a Python tool; without installing it, `uvx --from 'reuse[charset-normalizer]' reuse lint` runs it. CI runs all but `test:6502` on every push and pull request.

### The browser checks

```
pnpm test:browser                 # every check, about six minutes
pnpm test:browser boot keys       # just these
pnpm test:browser --coverage      # and what of the page's code they reach, file by file
```

`tests/browser/` drives the page itself in a headless Chrome, with real mouse and key events. Its checks, in the order they run (`tests/browser/run.mjs`):

| Check | What it drives |
|---|---|
| `boot` | a first visit on a live machine, typing, the strip's switches, what stays off, the page's own self-test, the ROMs missing |
| `keys` | the visitor's keys as the machine's (中文, Ctrl-F12, Caps Lock, Ctrl-V), after a click on the 3D view too |
| `typein` | Type in, with Chinese through 区位; a character the machine has not; Save offered |
| `views` | the 3D views, taking it apart and putting it back, Display |
| `labels` | the parts' labels under a resting mouse, quiet between the keys |
| `flat` | the 2D view, its keyboard drawer, the TV's button and knobs |
| `programs` | our programs, typed in from any state |
| `lessons` | the lessons: Type it, Show me, the ticks, a program's step |
| `disk` | the disk drive: a disk dropped and booted, saved, ejected; files opened and saved |
| `tools` | the four instruments |
| `layout` | desktop, laptop and phone sizes, upright and on its side: the page fits, the stage keeps its room |
| `dialogs` | About, References, Display's choices, the dock folding |
| `access` | the keyboard alone, names on a phone, selection and dragging |
| `lang` | the ten languages |

They need Chrome (`CHROME` names it if it is not found). On a Mac they use its GPU; elsewhere Chrome's software one, much slower. They take several minutes, so they are run locally: the checks a change touches as it is made, every check before each release. CI stays fast and does not run them.

## The 3D model

```
pnpm build:model    # Blender, headless: model/params -> model/cec-i.glb
```

The `.glb` is committed (design/decisions.md, D12). `tests/model.test.js` fails if it no longer has every part the page uses. The generated params are made by `model/tools/` ([../model/README.md](../model/README.md)).

## The vendored files

`pnpm vendor` copies three.js, the font and the icons from `node_modules`, and writes the icon module from the list in `tools/vendor.mjs`. `tests/vendor.test.js` fails while anything differs; `tests/stamp.test.js` while a bare import is missing from the import map.

## Branches, versions and releases

- **`main` takes changes only by pull request.** Work goes on a branch named for the release it builds, `dev-v<x.y.z>`, and reaches `main` only when that release is ready.
- **The version lives in one place:** `package.json`. Set it with `pnpm version <x.y.z>`, which also writes the `?v=` stamps. It does not commit or tag (`.npmrc`).
- **A release is a pull request named for its version.** It is tagged `vX.Y.Z` on its merge commit, and its changes are listed in `CHANGELOG.md`. Versions 0.0.x are marked as pre-releases on GitHub.
- **Each push to `main` deploys** the site to GitHub Pages (Settings ▸ Pages ▸ Source: GitHub Actions) once its tests have passed.

## Deploying behind a cache

Every file the page names carries `?v=<version>`, so a cache may keep those files for ever. Only `index.html` (and `/`) must be revalidated:

| What | `Cache-Control` |
|---|---|
| `index.html`, `/` | `no-cache` |
| Everything asked for with `?v=` | `public, max-age=31536000, immutable` |

GitHub Pages keeps everything for 10 minutes, so a release reaches everyone there within 10 minutes.
