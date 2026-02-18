# ASE Creator

Simple JavaScript/TypeScript library for creating Adobe Swatch Exchange (`.ase`) files.

## Install

```bash
npm install ase-creator
```

## Quick start

```ts
import { ASE } from 'ase-creator';

const ase = ASE.create({ groupName: 'Brand Palette' })
	.addColor('Primary', '#0066FF')
	.addColor('Secondary', '#FFAA00')
	.addGradient(
		[
			{ hex: '#0066FF', position: 0 },
			{ hex: '#FFAA00', position: 100 },
		],
		{ steps: 6, prefix: 'Blend' },
	);

// Browser download:
ase.download('brand-palette');
```

## API

### `ASE.create(options?)`

Creates a new ASE builder instance.

```ts
type ASECreateOptions = {
	groupName?: string;
	colors?: Array<{ name: string; hex: string }>;
};
```

### Instance methods

- `addColor(name, hex)` or `addColor({ name, hex })`
- `addColors(colors)`
- `addGradient(stops, options?)`
- `setGroupName(name)`
- `clear()`
- `toBytes()`
- `toArrayBuffer()`
- `toBlob()`
- `download(filename?)` (browser only)

### Gradient options

```ts
type ASEGradientOptions = {
	steps?: number; // clamped to 2..64, default 7
	prefix?: string; // default "Step"
};
```

## Node usage

```ts
import { writeFile } from 'node:fs/promises';
import { ASE } from 'ase-creator';

const ase = ASE.create({ groupName: 'CLI Palette' }).addColor('Ink', '#111111');
await writeFile('palette.ase', ase.toBytes());
```

## Development

```bash
npm install
npm test
npm run build
```

## License

MIT
