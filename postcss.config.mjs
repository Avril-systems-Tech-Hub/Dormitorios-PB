import path from "path";
import { fileURLToPath } from "url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // Resolve tailwindcss from this app, not parent folders (e.g. ~/dormitorios).
      base: appDir,
    },
  },
};

export default config;
