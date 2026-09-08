import { copyFile, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/import-artwork.mjs /path/to/original-jpeg');
const bytes = await readFile(source);
if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error('The original artwork must be a JPEG; it will not be converted or redrawn.');
const target = fileURLToPath(new URL('../public/assets/patrick-terminal.jpg', import.meta.url));
await copyFile(source, target, constants.COPYFILE_EXCL);
console.log(`Imported original JPEG: ${bytes.length} bytes`);
console.log(`SHA-256: ${createHash('sha256').update(bytes).digest('hex')}`);
