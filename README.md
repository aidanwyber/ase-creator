# ASE Creator

Simple JavaScript/TypeScript library for creating Adobe Swatch Exchange (`.ase`) files.

This project was written entirely by Codex and is based on the Python `swatch` library. Full credit for the original work goes to the `swatch` project: https://github.com/nsfmc/swatch

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
```

## Export the ASE file

Use one of these once you have an `ase` instance.

### Node.js (write to disk)

```ts
import { writeFile } from 'node:fs/promises';

await writeFile('brand-palette.ase', ase.toBytes());
```

### Web (browser download)

```ts
ase.download('brand-palette');
```

## Examples

### 1) One swatch only: `Red` (`#FF0000`)

```ts
import { ASE } from 'ase-creator';

const ase = ASE.create({ groupName: 'Single Swatch' }).addColor('Red', '#FF0000');
```

Preview in Adobe apps:

```text
Group: Single Swatch
- Red   #FF0000
```

### 2) Three colors with no names provided by the caller

ASE entries require names, so this example auto-generates `Color 1`, `Color 2`, `Color 3`.

```ts
import { ASE } from 'ase-creator';

const hexes = ['#FF0000', '#00FF00', '#0000FF'];
const ase = ASE.create({ groupName: 'Three Colors' });

hexes.forEach((hex, index) => {
	ase.addColor(`Color ${index + 1}`, hex);
});
```

Preview in Adobe apps:

```text
Group: Three Colors
- Color 1   #FF0000
- Color 2   #00FF00
- Color 3   #0000FF
```

### 3) Six named colors split across two groups (`Warm` and `Cool`)

```ts
import { ASE } from 'ase-creator';

const ase = ASE.create({ groupName: 'Warm' })
	.addColors([
		{ name: 'Sunset Orange', hex: '#FF5E3A' },
		{ name: 'Marigold', hex: '#FFB200' },
		{ name: 'Rose', hex: '#E63946' },
	])
	.addGroup('Cool')
	.addColors([
		{ name: 'Ocean', hex: '#0077B6' },
		{ name: 'Mint', hex: '#2EC4B6' },
		{ name: 'Indigo', hex: '#3A0CA3' },
	]);
```

Preview in Adobe apps:

```text
Group: Warm
- Sunset Orange   #FF5E3A
- Marigold        #FFB200
- Rose            #E63946

Group: Cool
- Ocean           #0077B6
- Mint            #2EC4B6
- Indigo          #3A0CA3
```

### 4) Stepped gradient from red to blue (5 steps)

```ts
import { ASE } from 'ase-creator';

const ase = ASE.create({ groupName: 'Red to Blue' }).addGradient(
	[
		{ hex: '#FF0000', position: 0 },
		{ hex: '#0000FF', position: 100 },
	],
	{ steps: 5, prefix: 'Step' },
);
```

Preview in Adobe apps:

```text
Group: Red to Blue
- Step 01 (0%)     #FF0000
- Step 02 (25%)    #BF0040
- Step 03 (50%)    #800080
- Step 04 (75%)    #4000BF
- Step 05 (100%)   #0000FF
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
- `addGroup(name, colors?)` creates a new active group
- `addGradient(stops, options?)`
- `setGroupName(name)` renames the active group
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

## Development

```bash
npm install
npm test
npm run build
```

## License

MIT
