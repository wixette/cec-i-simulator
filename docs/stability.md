# What 1.0 promises

From version 1.0.0 these stay as they are. A link someone shared, a file someone saved, and a disk image someone keeps all work in every later 1.x. Related documents: the link format ([ui-design.md](ui-design.md), P8), the languages (U11), how the page keeps its own choices ([privacy.md](privacy.md)).

## Links

| In the address | What | Values |
|---|---|---|
| `#view=` | the view the page opens in | `3d`, `2d` |
| `?lang=` | the language | `zh`, `en`, `zh-TW`, `ja`, `ko`, `es`, `fr`, `de`, `it`, `pt-BR`, or a tag that maps to one (`zh-CN`, `zh-HK`, `en-GB`, `pt-PT`) |

- **Never renamed, dropped or read differently.** A later version may add fields; a field a version does not know is ignored, so a newer link still opens in an older page.
- **A value not known is ignored:** an unknown view opens the remembered one (else 3D); an unknown language falls back to the visitor's choice or the browser's, else 简体中文.
- **What a link does not carry:** the machine's state. A link opens the machine switched on afresh, as a visit does (design/decisions.md, D10).
- **Pinned by** `tests/link.test.js`. The code is `js/app/link.js` and `js/l10n/locales.js`.

## Files the page writes and reads

| File | Written by | What it is | Read back by |
|---|---|---|---|
| `<name>.bas` | Programs ▸ Save the program, with BASIC in memory | the program as `LIST` shows it: UTF-8 text, a line a line (`\n`), keywords spelled as the ROM's own table spells them, Chinese as Chinese | Programs ▸ Open a program file, or a file dropped on the page: typed in after `NEW`. UTF-8 or GB18030 (GBK, GB2312) |
| `<name>.logo` | Save the program, while LOGO runs | LOGO's procedures as `PO ALL` prints them (`TO …` to `END`), UTF-8 text | Open a program file: LOGO started, the procedures typed into its editor |
| `<name>.dsk`, `.po` | Programs ▸ Disk ▸ Save the disk image, for a disk loaded from a sector image | a 143,360-byte sector image, in the order it came in (DOS 3.3 for `.dsk` and `.do`, ProDOS for `.po`), with every sector written since | Programs ▸ Disk ▸ Insert a disk image, or a file dropped on the page |
| `<name>.woz` | the same, for a disk loaded from `.nib` or `.woz` | a WOZ 2 file, each track's bits as they now are | the same |

- **Disk images read:**
  - `.dsk` and `.do`: 143,360 bytes, DOS 3.3 order;
  - `.po`: ProDOS order, and a `.dsk` holding ProDOS order is recognised;
  - `.nib`: 232,960 bytes;
  - `.woz`: versions 1 and 2, 5.25-inch.
- **A file the page saves opens in every later 1.x,** and means the same there.
- **Pinned by** `tests/files.test.js` (names, text, LOGO's procedures) and `tests/disk.test.js` (each image format in and out). The code is `js/app/files.js` and `js/sim/disk-image.js`.

## Not promised

- **The page's own choices,** kept in the browser (`ceci.*` in `localStorage`: the language, the view, the dock, the lessons' ticks): a later version may change them, and starts afresh where it does not understand them.
- **The developer options** `?debug` and `?selftest`, and the handles `?debug` exposes (`cec`, `app`): for development and the tools, as they are in each version ([development.md](development.md)).
- **What the page looks like and how it is laid out.**

## Versions

From 1.0.0 the version is `MAJOR.MINOR.PATCH`, as [Semantic Versioning](https://semver.org/) has it, judged by what is promised here:

- **PATCH** (1.0.1): fixes, and changes to wording, the model or the look.
- **MINOR** (1.1.0): what is new and keeps every promise: a lesson, a program, a language, a link field, a file format read.
- **MAJOR** (2.0.0): only if one of these promises has to break. None is planned.

Each release is listed in [../CHANGELOG.md](../CHANGELOG.md) and tagged `vX.Y.Z`; 1.0.0 is the first that is not a pre-release.
