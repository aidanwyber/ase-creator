import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ASE } from '../src';

type ParsedAseColor = {
	name: string;
	hex: string;
};

type ParsedAse = {
	signature: string;
	version: [number, number];
	blockCount: number;
	groupNames: string[];
	colors: ParsedAseColor[];
	groupedColors: Record<string, ParsedAseColor[]>;
};

const decodeAscii = (bytes: Uint8Array): string =>
	String.fromCharCode(...Array.from(bytes));

const decodeUtf16Be = (bytes: Uint8Array): string => {
	let result = '';
	for (let i = 0; i < bytes.length; i += 2) {
		const high = bytes[i] ?? 0;
		const low = bytes[i + 1] ?? 0;
		const codeUnit = (high << 8) | low;
		result += String.fromCharCode(codeUnit);
	}
	return result;
};

const parseAse = (bytes: Uint8Array): ParsedAse => {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let offset = 0;

	const signature = decodeAscii(bytes.slice(offset, offset + 4));
	offset += 4;
	const major = view.getUint16(offset, false);
	offset += 2;
	const minor = view.getUint16(offset, false);
	offset += 2;
	const blockCount = view.getUint32(offset, false);
	offset += 4;

	const groupNames: string[] = [];
	const colors: ParsedAseColor[] = [];
	const groupedColors: Record<string, ParsedAseColor[]> = {};
	let activeGroupName: string | null = null;

	for (let i = 0; i < blockCount; i += 1) {
		const blockType = view.getUint16(offset, false);
		offset += 2;
		const blockLength = view.getUint32(offset, false);
		offset += 4;
		const blockStart = offset;
		const blockEnd = blockStart + blockLength;

		if (blockType === 0xc001) {
			const nameLength = view.getUint16(offset, false);
			offset += 2;
			const nameBytesLength = nameLength * 2;
			const groupName = decodeUtf16Be(
				bytes.slice(offset, offset + nameBytesLength),
			).replace(/\u0000$/, '');
			groupNames.push(groupName);
			groupedColors[groupName] = groupedColors[groupName] ?? [];
			activeGroupName = groupName;
		}

		if (blockType === 0xc002) {
			activeGroupName = null;
		}

		if (blockType === 0x0001) {
			const nameLength = view.getUint16(offset, false);
			offset += 2;
			const nameBytesLength = nameLength * 2;
			const swatchName = decodeUtf16Be(
				bytes.slice(offset, offset + nameBytesLength),
			).replace(/\u0000$/, '');
			offset += nameBytesLength;

			const mode = decodeAscii(bytes.slice(offset, offset + 4)).trim();
			offset += 4;
			if (mode !== 'RGB') {
				throw new Error(
					`Unsupported swatch mode in test parser: ${mode}`,
				);
			}

			const r = view.getFloat32(offset, false);
			offset += 4;
			const g = view.getFloat32(offset, false);
			offset += 4;
			const b = view.getFloat32(offset, false);
			offset += 4;
			offset += 2;

			const toHex = (value: number): string =>
				Math.round(value * 255)
					.toString(16)
					.padStart(2, '0')
					.toUpperCase();

			const color = {
				name: swatchName,
				hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
			};
			colors.push(color);
			if (activeGroupName) {
				const groupColors = groupedColors[activeGroupName];
				if (groupColors) {
					groupColors.push(color);
				}
			}
		}

		offset = blockEnd;
	}

	return {
		signature,
		version: [major, minor],
		blockCount,
		groupNames,
		colors,
		groupedColors,
	};
};

describe('ASE', () => {
	it('builds a valid ASE file with custom swatches', () => {
		const ase = ASE.create({ groupName: 'Brand Colors' })
			.addColor('Primary', '#123456')
			.addColor('Accent', 'ABCDEF');

		const parsed = parseAse(ase.toBytes());
		expect(parsed.signature).toBe('ASEF');
		expect(parsed.version).toEqual([1, 0]);
		expect(parsed.groupNames).toEqual(['Brand Colors']);
		expect(parsed.colors).toEqual([
			{ name: 'Primary', hex: '#123456' },
			{ name: 'Accent', hex: '#ABCDEF' },
		]);
	});

	it('supports multiple groups in one ASE file', () => {
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

		const parsed = parseAse(ase.toBytes());
		expect(parsed.groupNames).toEqual(['Warm', 'Cool']);
		expect(parsed.groupedColors.Warm).toEqual([
			{ name: 'Sunset Orange', hex: '#FF5E3A' },
			{ name: 'Marigold', hex: '#FFB200' },
			{ name: 'Rose', hex: '#E63946' },
		]);
		expect(parsed.groupedColors.Cool).toEqual([
			{ name: 'Ocean', hex: '#0077B6' },
			{ name: 'Mint', hex: '#2EC4B6' },
			{ name: 'Indigo', hex: '#3A0CA3' },
		]);
	});

	it('samples gradients into named swatches', () => {
		const ase = ASE.create({ groupName: 'Gradient Steps' }).addGradient(
			[
				{ hex: '#000000', position: 0 },
				{ hex: '#FFFFFF', position: 100 },
			],
			{ steps: 5, prefix: 'Step' },
		);

		const parsed = parseAse(ase.toBytes());
		expect(parsed.colors.map(color => color.name)).toEqual([
			'Step 01 (0%)',
			'Step 02 (25%)',
			'Step 03 (50%)',
			'Step 04 (75%)',
			'Step 05 (100%)',
		]);
		expect(parsed.colors.map(color => color.hex)).toEqual([
			'#000000',
			'#404040',
			'#808080',
			'#BFBFBF',
			'#FFFFFF',
		]);
	});

	it('throws for invalid gradient color values', () => {
		const ase = ASE.create();
		expect(() =>
			ase.addGradient([
				{ hex: '#000000', position: 0 },
				{ hex: 'NOT-HEX', position: 100 },
			]),
		).toThrow('Invalid gradient HEX color');
	});

	it('creates a manual verification ASE file with all features', async () => {
		const ase = ASE.create({ groupName: 'Single Swatch' }).addColor(
			'Red',
			'#FF0000',
		);

		ase.addGroup('Three Colors');
		['#FF0000', '#00FF00', '#0000FF'].forEach((hex, index) => {
			ase.addColor(`Color ${index + 1}`, hex);
		});

		ase.addGroup('Warm').addColors([
			{ name: 'Sunset Orange', hex: '#FF5E3A' },
			{ name: 'Marigold', hex: '#FFB200' },
			{ name: 'Rose', hex: '#E63946' },
		]);

		ase.addGroup('Cool').addColors([
			{ name: 'Ocean', hex: '#0077B6' },
			{ name: 'Mint', hex: '#2EC4B6' },
			{ name: 'Indigo', hex: '#3A0CA3' },
		]);

		ase.addGroup('Red to Blue').addGradient(
			[
				{ hex: '#FF0000', position: 0 },
				{ hex: '#0000FF', position: 100 },
			],
			{ steps: 5, prefix: 'Step' },
		);

		const bytes = ase.toBytes();
		const outputDir = resolve(process.cwd(), 'manual-output');
		const outputFile = resolve(outputDir, 'all-features.ase');
		await mkdir(outputDir, { recursive: true });
		await writeFile(outputFile, bytes);

		const parsed = parseAse(bytes);
		expect(parsed.groupNames).toEqual([
			'Single Swatch',
			'Three Colors',
			'Warm',
			'Cool',
			'Red to Blue',
		]);
		expect(parsed.groupedColors['Single Swatch']).toEqual([
			{ name: 'Red', hex: '#FF0000' },
		]);
		expect(parsed.groupedColors['Three Colors']).toEqual([
			{ name: 'Color 1', hex: '#FF0000' },
			{ name: 'Color 2', hex: '#00FF00' },
			{ name: 'Color 3', hex: '#0000FF' },
		]);
		expect(parsed.groupedColors.Warm).toEqual([
			{ name: 'Sunset Orange', hex: '#FF5E3A' },
			{ name: 'Marigold', hex: '#FFB200' },
			{ name: 'Rose', hex: '#E63946' },
		]);
		expect(parsed.groupedColors.Cool).toEqual([
			{ name: 'Ocean', hex: '#0077B6' },
			{ name: 'Mint', hex: '#2EC4B6' },
			{ name: 'Indigo', hex: '#3A0CA3' },
		]);
		expect(parsed.groupedColors['Red to Blue']).toEqual([
			{ name: 'Step 01 (0%)', hex: '#FF0000' },
			{ name: 'Step 02 (25%)', hex: '#BF0040' },
			{ name: 'Step 03 (50%)', hex: '#800080' },
			{ name: 'Step 04 (75%)', hex: '#4000BF' },
			{ name: 'Step 05 (100%)', hex: '#0000FF' },
		]);

		const preview = [
			'Expected Adobe preview:',
			'Group: Single Swatch',
			'- Red   #FF0000',
			'',
			'Group: Three Colors',
			'- Color 1   #FF0000',
			'- Color 2   #00FF00',
			'- Color 3   #0000FF',
			'',
			'Group: Warm',
			'- Sunset Orange   #FF5E3A',
			'- Marigold        #FFB200',
			'- Rose            #E63946',
			'',
			'Group: Cool',
			'- Ocean           #0077B6',
			'- Mint            #2EC4B6',
			'- Indigo          #3A0CA3',
			'',
			'Group: Red to Blue',
			'- Step 01 (0%)     #FF0000',
			'- Step 02 (25%)    #BF0040',
			'- Step 03 (50%)    #800080',
			'- Step 04 (75%)    #4000BF',
			'- Step 05 (100%)   #0000FF',
		].join('\n');

		console.log(`[manual-check] Wrote ${outputFile}`);
		console.log(preview);
	});

	it('downloads with a generated blob URL in browser-like environments', () => {
		const createObjectURL = vi.fn(() => 'blob:mock');
		const revokeObjectURL = vi.fn();
		const click = vi.fn();
		const remove = vi.fn();
		const appendChild = vi.fn();
		const anchor = {
			href: '',
			download: '',
			click,
			remove,
		};
		const createElement = vi.fn(() => anchor);

		const previousDocument = globalThis.document;
		const previousURL = globalThis.URL;

		Object.defineProperty(globalThis, 'document', {
			configurable: true,
			value: {
				createElement,
				body: { appendChild },
			},
		});

		Object.defineProperty(globalThis, 'URL', {
			configurable: true,
			value: {
				createObjectURL,
				revokeObjectURL,
			},
		});

		try {
			ASE.create().addColor('Primary', '#112233').download('palette');

			expect(createElement).toHaveBeenCalledWith('a');
			expect(anchor.download).toBe('palette.ase');
			expect(anchor.href).toBe('blob:mock');
			expect(appendChild).toHaveBeenCalledTimes(1);
			expect(click).toHaveBeenCalledTimes(1);
			expect(remove).toHaveBeenCalledTimes(1);
			expect(createObjectURL).toHaveBeenCalledTimes(1);
			expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');
		} finally {
			Object.defineProperty(globalThis, 'document', {
				configurable: true,
				value: previousDocument,
			});
			Object.defineProperty(globalThis, 'URL', {
				configurable: true,
				value: previousURL,
			});
		}
	});
});
