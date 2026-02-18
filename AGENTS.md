# AGENTS.md

Guidance for coding agents working in this repository.

## Project overview

- Package: `ase-creator`
- Purpose: Create Adobe Swatch Exchange (`.ase`) files from JavaScript/TypeScript.
- Runtime target: ESM/CJS library output via `tsup`.
- Language: TypeScript with strict compiler settings.

## Repository map

- `src/ase.ts`: Main `ASE` class API and browser download helper.
- `src/ase-encoder.ts`: Binary ASE encoding logic.
- `src/color-utils.ts`: HEX/RGB utilities and gradient sampling.
- `src/index.ts`: Public exports.
- `test/ase.test.ts`: Vitest coverage for encoding and API behavior.
- `README.md`: Public docs and usage examples.

## Required workflow

1. Install dependencies: `npm install`
2. Type-check: `npm run check`
3. Run tests: `npm test`
4. Build package: `npm run build`

Run steps 2-4 after meaningful code changes.

## Coding rules

- Preserve the public API shape unless explicitly asked to change it.
- Keep behavior deterministic for binary output and gradient sampling.
- Add or update tests for any behavior change.
- Keep browser-only behavior guarded (`document`, `URL`) as in current code.
- Do not edit generated output in `dist/` directly.

## Formatting

Prettier config is in `.prettierrc`.

Follow existing style in the codebase.

## Documentation

- Update `README.md` when API or usage changes.
- Keep attribution text to the Python `swatch` project unless the user requests otherwise.
