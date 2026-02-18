import { encodeAse } from './ase-encoder';
import {
	clamp,
	normalizeHex,
	steppedGradientSamples,
	type GradientStopPoint,
} from './color-utils';

export type ASEColor = {
	name: string;
	hex: string;
};

export type ASEGradientStop = GradientStopPoint;

export type ASECreateOptions = {
	groupName?: string;
	colors?: ASEColor[];
};

export type ASEGradientOptions = {
	steps?: number;
	prefix?: string;
};

export class ASE {
	private groupName: string;
	private swatches: ASEColor[];

	private constructor(options?: ASECreateOptions) {
		this.groupName = options?.groupName ?? 'ASE Creator Swatches';
		this.swatches = [];
		if (options?.colors?.length) {
			this.addColors(options.colors);
		}
	}

	static create(options?: ASECreateOptions): ASE {
		return new ASE(options);
	}

	static fromColors(
		colors: ASEColor[],
		options?: Omit<ASECreateOptions, 'colors'>,
	): ASE {
		return new ASE({ ...options, colors });
	}

	setGroupName(name: string): this {
		const trimmed = name.trim();
		if (!trimmed) {
			throw new Error('Group name cannot be empty.');
		}
		this.groupName = trimmed;
		return this;
	}

	addColor(color: ASEColor): this;
	addColor(name: string, hex: string): this;
	addColor(colorOrName: ASEColor | string, hex?: string): this {
		const color =
			typeof colorOrName === 'string' ?
				{ name: colorOrName, hex: hex ?? '' }
			:	colorOrName;

		const name = color.name.trim();
		if (!name) {
			throw new Error('Color name cannot be empty.');
		}

		const normalizedHex = normalizeHex(color.hex);
		if (!normalizedHex) {
			throw new Error(`Invalid HEX color: ${color.hex}`);
		}

		this.swatches.push({ name, hex: normalizedHex });
		return this;
	}

	addColors(colors: ASEColor[]): this {
		for (const color of colors) {
			this.addColor(color);
		}
		return this;
	}

	addGradient(stops: ASEGradientStop[], options?: ASEGradientOptions): this {
		if (stops.length === 0) {
			throw new Error('At least one gradient stop is required.');
		}

		const safeStops = stops.map(stop => {
			const normalizedHex = normalizeHex(stop.hex);
			if (!normalizedHex) {
				throw new Error(`Invalid gradient HEX color: ${stop.hex}`);
			}
			return {
				hex: normalizedHex,
				position: clamp(stop.position, 0, 100),
			};
		});

		const safeSteps =
			Number.isFinite(options?.steps) ?
				clamp(Math.round(options?.steps ?? 7), 2, 64)
			:	7;

		const prefix = options?.prefix?.trim() || 'Step';
		const samples = steppedGradientSamples(safeStops, safeSteps);
		for (let i = 0; i < samples.length; i += 1) {
			const sample = samples[i];
			if (!sample) continue;
			const stepLabel = String(i + 1).padStart(2, '0');
			const positionLabel = formatPercentLabel(sample.position);
			this.addColor({
				name: `${prefix} ${stepLabel} (${positionLabel})`,
				hex: sample.hex,
			});
		}

		return this;
	}

	clear(): this {
		this.swatches = [];
		return this;
	}

	toBytes(): Uint8Array {
		return encodeAse(this.groupName, this.swatches);
	}

	toArrayBuffer(): ArrayBuffer {
		const bytes = this.toBytes();
		const copy = new Uint8Array(bytes.byteLength);
		copy.set(bytes);
		return copy.buffer;
	}

	toBlob(): Blob {
		return new Blob([this.toArrayBuffer()], {
			type: 'application/octet-stream',
		});
	}

	download(filename = 'swatches.ase'): void {
		if (typeof document === 'undefined' || typeof URL === 'undefined') {
			throw new Error(
				'ASE.download() is only available in browser environments.',
			);
		}
		if (
			typeof URL.createObjectURL !== 'function' ||
			typeof URL.revokeObjectURL !== 'function'
		) {
			throw new Error(
				'Browser URL APIs are not available for downloading.',
			);
		}

		const safeFilename =
			filename.endsWith('.ase') ? filename : `${filename}.ase`;
		const blobUrl = URL.createObjectURL(this.toBlob());
		const anchor = document.createElement('a');
		anchor.href = blobUrl;
		anchor.download = safeFilename;

		if (document.body && typeof document.body.appendChild === 'function') {
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
		} else {
			anchor.click();
		}

		URL.revokeObjectURL(blobUrl);
	}
}

const formatPercentLabel = (position: number): string => {
	const rounded = Math.round(position * 10) / 10;
	return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
};
