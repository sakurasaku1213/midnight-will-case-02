import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, 'assets-src');
const outputRoot = path.join(repoRoot, 'public', 'assets');
const publicRoot = path.join(repoRoot, 'public');

const categoryOptions = {
  locations: { max: 1536, quality: 80 },
  scenes: { max: 1536, quality: 80 },
  characters: { max: 1152, quality: 80 },
  evidence: { max: 1024, quality: 80 },
};

async function main() {
  await assertDirectory(sourceRoot);
  await fs.mkdir(outputRoot, { recursive: true });

  const pngFiles = await listFiles(sourceRoot, '.png');
  if (!pngFiles.length) {
    throw new Error(`No PNG sources found under ${sourceRoot}`);
  }

  const results = [];
  for (const sourcePath of pngFiles) {
    const relativePath = path.relative(sourceRoot, sourcePath);
    const category = relativePath.split(path.sep)[0];
    if (!categoryOptions[category]) continue;

    const outputPath = path.join(
      outputRoot,
      relativePath.replace(/\.png$/i, '.webp'),
    );
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const result = await convertAsset(sourcePath, outputPath, categoryOptions[category]);
    results.push({ sourcePath, outputPath, ...result });
  }

  await createMetaImages();
  printSummary(results);
}

async function assertDirectory(directory) {
  const stat = await fs.stat(directory).catch(() => undefined);
  if (!stat?.isDirectory()) {
    throw new Error(`Missing source directory: ${directory}`);
  }
}

async function listFiles(directory, extension) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return listFiles(entryPath, extension);
      return entry.isFile() && entry.name.toLowerCase().endsWith(extension) ? [entryPath] : [];
    }),
  );
  return files.flat();
}

async function convertAsset(sourcePath, outputPath, options) {
  const input = sharp(sourcePath);
  const metadata = await input.metadata();
  const longEdge = Math.max(metadata.width ?? 0, metadata.height ?? 0);
  const resized =
    longEdge > options.max
      ? input.resize({
          width: metadata.width >= metadata.height ? options.max : undefined,
          height: metadata.height > metadata.width ? options.max : undefined,
          withoutEnlargement: true,
        })
      : input;

  await resized.webp({ quality: options.quality, effort: 6 }).toFile(outputPath);
  const outputStat = await fs.stat(outputPath);
  return { bytes: outputStat.size, maxEdge: options.max, quality: options.quality };
}

async function createMetaImages() {
  const titleSource = path.join(sourceRoot, 'scenes', 'title-key-visual.png');
  const titleStat = await fs.stat(titleSource).catch(() => undefined);
  if (!titleStat?.isFile()) {
    throw new Error(`Missing title image for meta generation: ${titleSource}`);
  }

  await sharp(titleSource)
    .resize(1200, 630, { fit: 'cover', position: 'center' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicRoot, 'ogp.png'));

  const faviconPng = await sharp(titleSource)
    .resize(32, 32, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();
  await fs.writeFile(path.join(publicRoot, 'favicon.ico'), createPngIco(faviconPng, 32, 32));

  await sharp(titleSource)
    .resize(180, 180, { fit: 'cover', position: 'center' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(publicRoot, 'apple-touch-icon.png'));
}

function createPngIco(pngBuffer, width, height) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const directory = Buffer.alloc(16);
  directory.writeUInt8(width === 256 ? 0 : width, 0);
  directory.writeUInt8(height === 256 ? 0 : height, 1);
  directory.writeUInt8(0, 2);
  directory.writeUInt8(0, 3);
  directory.writeUInt16LE(1, 4);
  directory.writeUInt16LE(32, 6);
  directory.writeUInt32LE(pngBuffer.length, 8);
  directory.writeUInt32LE(22, 12);

  return Buffer.concat([header, directory, pngBuffer]);
}

function printSummary(results) {
  const total = results.reduce((sum, item) => sum + item.bytes, 0);
  console.log(`Converted ${results.length} assets to WebP.`);
  console.log(`public/assets image total: ${formatBytes(total)}`);
  for (const item of results) {
    console.log(`${path.relative(repoRoot, item.outputPath)} ${formatBytes(item.bytes)}`);
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
