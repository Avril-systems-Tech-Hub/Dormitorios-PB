/**
 * Embeds public/logo-dorm.png into app/icon.svg (base64) with a circular clip.
 * Run after updating the logo: `npm run favicon:sync`
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pngPath = path.join(root, "public", "logo-dorm.png");
const outPath = path.join(root, "app", "icon.svg");

const buf = fs.readFileSync(pngPath);
const b64 = buf.toString("base64");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 32 32" width="32" height="32">
  <defs>
    <clipPath id="logo-fav-clip" clipPathUnits="userSpaceOnUse">
      <circle cx="16" cy="16" r="16"/>
    </clipPath>
  </defs>
  <image
    width="32"
    height="32"
    href="data:image/png;base64,${b64}"
    xlink:href="data:image/png;base64,${b64}"
    clip-path="url(#logo-fav-clip)"
    preserveAspectRatio="xMidYMid slice"
  />
</svg>
`;

fs.writeFileSync(outPath, svg, "utf8");
console.log("Wrote", path.relative(root, outPath), `(${Math.round(svg.length / 1024)} KB)`);
