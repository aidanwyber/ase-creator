import { hexToRgb } from "./color-utils";

export type AseSwatch = {
  name: string;
  hex: string;
};

const ASE_VERSION_MAJOR = 1;
const ASE_VERSION_MINOR = 0;
const BLOCK_COLOR_ENTRY = 0x0001;
const BLOCK_GROUP_START = 0xc001;
const BLOCK_GROUP_END = 0xc002;
const COLOR_TYPE_PROCESS = 2;

const encodeUtf16String = (value: string): Uint8Array => {
  const terminated = `${value}\0`;
  const bytes = new Uint8Array(2 + terminated.length * 2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, terminated.length, false);
  let offset = 2;
  for (let i = 0; i < terminated.length; i += 1) {
    view.setUint16(offset, terminated.charCodeAt(i), false);
    offset += 2;
  }
  return bytes;
};

const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

const makeBlock = (type: number, payload: Uint8Array): Uint8Array => {
  const header = new Uint8Array(6);
  const view = new DataView(header.buffer);
  view.setUint16(0, type, false);
  view.setUint32(2, payload.length, false);
  return concatBytes([header, payload]);
};

const makeGroupStartBlock = (groupName: string): Uint8Array =>
  makeBlock(BLOCK_GROUP_START, encodeUtf16String(groupName));

const makeGroupEndBlock = (): Uint8Array =>
  makeBlock(BLOCK_GROUP_END, new Uint8Array(0));

const makeColorEntryBlock = (swatch: AseSwatch): Uint8Array => {
  const rgb = hexToRgb(swatch.hex);
  if (!rgb) {
    throw new Error(`Invalid HEX value for ASE export: ${swatch.hex}`);
  }

  const nameBytes = encodeUtf16String(swatch.name);
  const modeBytes = new TextEncoder().encode("RGB ");
  const valueBytes = new Uint8Array(12);
  const valueView = new DataView(valueBytes.buffer);
  valueView.setFloat32(0, rgb.r / 255, false);
  valueView.setFloat32(4, rgb.g / 255, false);
  valueView.setFloat32(8, rgb.b / 255, false);

  const colorTypeBytes = new Uint8Array(2);
  new DataView(colorTypeBytes.buffer).setUint16(0, COLOR_TYPE_PROCESS, false);

  const payload = concatBytes([nameBytes, modeBytes, valueBytes, colorTypeBytes]);
  return makeBlock(BLOCK_COLOR_ENTRY, payload);
};

export const encodeAse = (
  groupName: string,
  swatches: AseSwatch[]
): Uint8Array => {
  if (swatches.length === 0) {
    throw new Error("At least one swatch is required to create an ASE file.");
  }

  const blocks = [
    makeGroupStartBlock(groupName),
    ...swatches.map(makeColorEntryBlock),
    makeGroupEndBlock()
  ];

  const header = new Uint8Array(12);
  const view = new DataView(header.buffer);
  header.set(new TextEncoder().encode("ASEF"), 0);
  view.setUint16(4, ASE_VERSION_MAJOR, false);
  view.setUint16(6, ASE_VERSION_MINOR, false);
  view.setUint32(8, blocks.length, false);

  return concatBytes([header, ...blocks]);
};
