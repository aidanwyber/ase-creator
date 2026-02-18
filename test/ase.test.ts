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

			colors.push({
				name: swatchName,
				hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
			});
		}

		offset = blockEnd;
	}

	return {
		signature,
		version: [major, minor],
		blockCount,
		groupNames,
		colors,
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
