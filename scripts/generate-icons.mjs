import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

async function generateIcons() {
  const sizes = [192, 512];
  const bg = "#0a0a0a";
  const accent = "#3b82f6";

  for (const size of sizes) {
    const fontSize = Math.round(size * 0.45);
    const radius = Math.round(size * 0.15);

    const svgText = `
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
        <text x="${size / 2}" y="${size / 2 + fontSize * 0.35}" 
              font-family="system-ui, sans-serif" font-size="${fontSize}" 
              font-weight="700" fill="${accent}" text-anchor="middle">
          IN
        </text>
      </svg>`;

    const outputPath = join(publicDir, `icon-${size}.png`);
    await sharp(Buffer.from(svgText)).resize(size, size).png().toFile(outputPath);
    console.log(`Generated ${outputPath}`);
  }
}

generateIcons().catch(console.error);
