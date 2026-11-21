# Contributing

Thank you for helping. Issues and pull requests are welcome: a bug with the steps that show it, a fact about the CEC-I with its source, a translation that reads better.

## Before a pull request

```
pnpm install
pnpm check            # unit tests, the strict type check, the reference check: what CI runs
pnpm test:browser     # the page in a headless Chrome (needs Chrome): before anything that touches the page
```

- **Branches:** work on a branch of your own; `main` is what the site serves. A release is built on `dev-v<x.y.z>` and reaches `main` by a pull request ([docs/development.md](docs/development.md)).
- **The rules the code follows** are in [docs/conventions.md](docs/conventions.md): plain JavaScript modules checked by TypeScript's checker, no build step, no framework.
- **A fix comes with a test** that fails without it: a unit test in `tests/` where the logic is pure or runs on the machine headless, else a browser check in `tests/browser/`.
- **Facts about the machine** cite their source (the books, a measurement); the machine's design decisions are in [design/decisions.md](design/decisions.md).

## Words on the page

Every text of the page is a message in `js/l10n/en.js`, and every message is in each language (`js/l10n/<locale>.js`). A test holds each language to English's keys, placeholders, `code` and [[keys]]. The machine's own words (`ZHONG HUA XUE XI JI`, 中文, the key legends) stay as the machine has them.

## Licences

Code is Apache-2.0; docs and the model are CC BY-SA 4.0 ([docs/licensing.md](docs/licensing.md)). By contributing you agree your contribution is under the same licence as the files it changes. No third-party software, ROM images or text from the manuals beyond what is already here: link to them instead.
