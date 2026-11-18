import zlib from "node:zlib";

export interface ZipFixtureEntry {
  name: string;
  data?: Buffer | string;
  /** Unix mode stored in the external attributes (e.g. 0o120777 for a symlink). */
  mode?: number;
  encrypted?: boolean;
  /** Name bytes as stored; defaults to the UTF-8 encoding of `name`. */
  rawName?: Buffer;
  /** General purpose bit 11 (names are UTF-8). Defaults to true. */
  utf8Flag?: boolean;
  /** Store the data deflated instead of uncompressed. */
  deflate?: boolean;
  /** Uncompressed size written to the headers instead of the real one (a lying archive). */
  declaredSize?: number;
  /** Extra field bytes, written to the local and the central header. */
  extra?: Buffer;
}

/** Info-ZIP Unicode Path extra field (0x7075) for `rawName`; `crcOfName` can be falsified. */
export function unicodePathField(unicodeName: string, rawName: Buffer, crcOfName = zlib.crc32(rawName)): Buffer {
  const name = Buffer.from(unicodeName, "utf8");
  const field = Buffer.alloc(4 + 5 + name.length);
  field.writeUInt16LE(0x7075, 0);
  field.writeUInt16LE(5 + name.length, 2);
  field.writeUInt8(1, 4);
  field.writeUInt32LE(crcOfName, 5);
  name.copy(field, 9);
  return field;
}

/** Minimal STORED (uncompressed) zip writer for test fixtures. */
export function buildZip(entries: ZipFixtureEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = entry.rawName ?? Buffer.from(entry.name, "utf8");
    const extra = entry.extra ?? Buffer.alloc(0);
    const content = Buffer.from(entry.data ?? "");
    const crc = zlib.crc32(content);
    // Traditional encryption prepends a 12 byte header to the stored payload.
    const data = entry.encrypted
      ? Buffer.concat([Buffer.alloc(12), content])
      : entry.deflate
        ? zlib.deflateRawSync(content)
        : content;
    const declared = entry.declaredSize ?? content.length;
    const flags = (entry.utf8Flag === false ? 0 : 0x0800) | (entry.encrypted ? 0x0001 : 0);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(declared, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(extra.length, 28);
    parts.push(local, name, extra, data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE((3 << 8) | 20, 4); // made by: unix
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(flags, 8);
    header.writeUInt16LE(entry.deflate ? 8 : 0, 10);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(declared, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt16LE(extra.length, 30);
    header.writeUInt32LE(((entry.mode ?? 0o100644) << 16) >>> 0, 38);
    header.writeUInt32LE(offset, 42);
    central.push(header, name, extra);

    offset += local.length + name.length + extra.length + data.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuffer, end]);
}
