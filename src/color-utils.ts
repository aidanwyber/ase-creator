export type RGBColor = {
	r: number;
	g: number;
	b: number;
};

export type GradientStopPoint = {
	hex: string;
	position: number;
};

export const clamp = (value: number, min: number, max: number): number =>
	Math.min(Math.max(value, min), max);

export const normalizeHex = (value: string): string | null => {
	const cleaned = value.trim().replace(/^#/, '');
	if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
		return `#${cleaned}`.toUpperCase();
	}
	if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
		const expanded = cleaned
			.split('')
			.map(char => `${char}${char}`)
			.join('');
		return `#${expanded}`.toUpperCase();
	}
	return null;
};

export const hexToRgb = (hex: string): RGBColor | null => {
	const normalized = normalizeHex(hex);
	if (!normalized) return null;
	const value = normalized.slice(1);
	return {
		r: Number.parseInt(value.slice(0, 2), 16),
		g: Number.parseInt(value.slice(2, 4), 16),
		b: Number.parseInt(value.slice(4, 6), 16),
	};
};

export const rgbToHex = (rgb: RGBColor): string => {
	const toHex = (channel: number) =>
		clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0');
	return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
};

export const colorAtPosition = (
	stops: GradientStopPoint[],
	position: number,
): string => {
	if (stops.length === 0) return '#000000';
	if (stops.length === 1) {
		const onlyStop = stops[0];
		return normalizeHex(onlyStop?.hex ?? '') ?? '#000000';
	}

	const sorted = stops.slice().sort((a, b) => a.position - b.position);
	const firstStop = sorted[0];
	const lastStop = sorted[sorted.length - 1];
	if (!firstStop || !lastStop) return '#000000';

	if (position <= firstStop.position) {
		return normalizeHex(firstStop.hex) ?? '#000000';
	}

	if (position >= lastStop.position) {
		return normalizeHex(lastStop.hex) ?? '#000000';
	}

	for (let i = 0; i < sorted.length - 1; i += 1) {
		const start = sorted[i];
		const end = sorted[i + 1];
		if (!start || !end) continue;
		if (position < start.position || position > end.position) continue;
		if (start.position === end.position) {
			return normalizeHex(end.hex) ?? '#000000';
		}

		const ratio =
			(position - start.position) / (end.position - start.position);
		const startRgb = hexToRgb(start.hex);
		const endRgb = hexToRgb(end.hex);
		if (!startRgb || !endRgb) {
			return normalizeHex(end.hex) ?? '#000000';
		}

		return rgbToHex({
			r: startRgb.r + (endRgb.r - startRgb.r) * ratio,
			g: startRgb.g + (endRgb.g - startRgb.g) * ratio,
			b: startRgb.b + (endRgb.b - startRgb.b) * ratio,
		});
	}

	return normalizeHex(lastStop.hex) ?? '#000000';
};

export const steppedGradientSamples = (
	stops: GradientStopPoint[],
	steps: number,
): Array<{ position: number; hex: string }> => {
	if (stops.length === 0) return [];
	const safeSteps = clamp(Math.round(steps), 2, 64);
	const samples: Array<{ position: number; hex: string }> = [];

	for (let i = 0; i < safeSteps; i += 1) {
		const ratio = safeSteps === 1 ? 0 : i / (safeSteps - 1);
		const position = Math.round(ratio * 1000) / 10;
		samples.push({ position, hex: colorAtPosition(stops, position) });
	}

	return samples;
};
