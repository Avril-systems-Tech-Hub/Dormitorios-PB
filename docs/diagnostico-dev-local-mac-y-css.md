# Diagnóstico: Mac congelada, dev server y estilos rotos (junio 2026)

Documento de referencia sobre los problemas al correr `npm run dev` en un MacBook Air M3 (8 GB) y cómo se resolvieron en el proyecto `dormitorios-app`.

---

## Resumen ejecutivo

| Síntoma | Causa principal | Solución |
|--------|------------------|----------|
| Mac se apaga o reinicia al hacer `npm run dev` | RAM agotada + kernel panic (watchdog) | Liberar RAM; quitar proyectos npm en `~` y carpetas padre; opcional `NODE_OPTIONS` |
| `localhost` no carga / sistema se congela | Mismo problema de memoria + a veces Next escaneando carpetas incorrectas | Mover `package.json` / lockfiles fuera de `~` y `~/dormitorios` |
| Error `Can't resolve 'tailwindcss' in '/Users/main/dormitorios'` | Next/Turbopack resolvía CSS desde la carpeta padre sin `node_modules` | Mover `~/dormitorios/package.json`; ajustar `postcss.config.mjs` y `turbopack.root` |
| Landing sin botones / dashboard “sin estilos” | Tailwind no escaneaba `components/` (CSS casi vacío) | `@source` en `app/globals.css` |
| `Parsing CSS source code failed` (línea ~1970, `safe-area`) | Bug Turbopack + clases arbitrarias con `env(safe-area-inset-*)` | Clases CSS `.safe-area-pt-header` / `.safe-area-pb-footer` en `globals.css` |

Estado final: **`npm run dev` normal** (sin flags obligatorios), app navegable en Brave con Cursor y el servidor abiertos.

---

## 1. Mac que se “apagaba” al correr `npm run dev`

### Qué pasaba

1. `npm run dev` → Next.js 16 + Turbopack.
2. Cursor, Brave y otros procesos ya consumían RAM.
3. En **8 GB**, el sistema entraba en presión de memoria (swap/compresión).
4. La UI dejaba de responder; a veces **reinicio completo**.

### Evidencia (kernel panic)

En `/Library/Logs/DiagnosticReports/` aparecían panics del tipo:

```text
watchdog timeout: no checkins from watchdogd in 94 seconds
```

Eso indica **congelamiento total del sistema**, no un fallo normal de Node. En los logs había muchos procesos `node` y poca memoria libre.

### Factores agravantes en este entorno

- **MacBook Air M3, 8 GB RAM** — justo para dev web + IDE.
- **`~/package.json` + `~/package-lock.json` + `~/node_modules`** — mini-proyecto npm en la carpeta personal (p. ej. dependencia `permissionless`).
- **`~/yarn.lock`** — Next podía inferir `/Users/main` como raíz del workspace.
- **`~/dormitorios/package.json`** — otro `package.json` padre sin `node_modules`, confundiendo la resolución de módulos.
- Carpeta personal muy cargada (`~/Library` ~44 GB, muchos repos y caches de herramientas).

### Qué hicimos (sin borrar)

| Origen | Acción |
|--------|--------|
| `~/package.json`, `~/package-lock.json`, `~/node_modules` | Movidos a `~/Developer/home-permissionless/` (o similar) |
| `~/dormitorios/package.json` | Movido a `~/Developer/dormitorios-parent-meta/` |
| `~/yarn.lock` | Movido a `~/Developer/home-npm-project/` |

### Recomendaciones de uso diario

```bash
# Normal (suficiente si la Mac responde bien)
cd ~/dormitorios/dormitorios-app
npm run dev
```

Si vuelve la presión de RAM:

```bash
NODE_OPTIONS='--max-old-space-size=2048' npm run dev
```

O cerrar Docker / pestañas de Brave / Cursor mientras compilas la primera vez.

**No** hace falta `NODE_OPTIONS` para que los estilos funcionen; solo limita cuánta RAM puede tomar un proceso Node.

---

## 2. Error de Tailwind: `Can't resolve 'tailwindcss' in '/Users/main/dormitorios'`

### Qué pasaba

El servidor arrancaba (`Ready in ~400ms`) pero al compilar `/` fallaba con:

```text
resolve 'tailwindcss' in '/Users/main/dormitorios'
No description file found in /Users/main/dormitorios or above
/Users/main/dormitorios/node_modules doesn't exist
```

`tailwindcss` **sí** estaba instalado en `dormitorios-app/node_modules`, pero el bundler buscaba en la **carpeta padre** `dormitorios/`.

### Causa

Next/Turbopack sube el árbol de directorios buscando la “raíz” del proyecto (`package.json`, lockfiles). Un `package.json` en `~/dormitorios/` (solo con script `favicon:sync`) hacía que la raíz efectiva fuera un nivel arriba del app real.

### Solución

1. Mover `~/dormitorios/package.json` fuera de esa carpeta (ver tabla arriba).
2. En el repo, mantener en `next.config.ts`:

```ts
turbopack: {
  root: projectRoot, // __dirname → dormitorios-app
},
```

3. En `postcss.config.mjs`, fijar `base` al directorio de la app:

```js
"@tailwindcss/postcss": {
  base: appDir,
},
```

---

## 3. Dashboard y landing “sin estilos” / botones que no se ven

### Qué pasaba

- Login y rutas respondían **200**.
- El dashboard se veía como HTML plano (sin grid, colores, sidebar).
- En el landing faltaban botones visibles (p. ej. nav con `hidden md:flex` sin utilidades generadas).

### Causa

Tras el arreglo de PostCSS, Tailwind **no escaneaba** `app/` ni `components/`. El CSS compilado tenía ~4 KB y casi ninguna utilidad (`bg-surface`, `md:flex`, `grid`, etc.) — solo variables en `:root` y unas pocas clases genéricas.

### Solución (en `app/globals.css`)

```css
@import "tailwindcss";

@source "./**/*.{ts,tsx}";
@source "../components/**/*.{ts,tsx}";
@source "../hooks/**/*.{ts,tsx}";
```

Tras esto, un `next build` generó CSS de ~74 KB con clases como `.bg-surface`, `.md\:flex`, `.bg-brand-primary`.

### Después de cambiar CSS

```bash
rm -rf .next
npm run dev
```

En el navegador: recarga forzada (`Cmd+Shift+R`).

---

## 4. Error `Parsing CSS source code failed` (safe-area)

### Qué pasaba

Con `npm run dev` solo, a veces:

```text
./app/globals.css (1970:43)
... env(safe-area- ...
Unexpected token Delim('\u{11}')
```

El archivo fuente `globals.css` tiene ~90 líneas; el error apunta al **CSS generado** por Tailwind + PostCSS, no al archivo manual.

### Causa

Clases arbitrarias en `components/forms/reservation-mobile-wizard.tsx`:

```text
pt-[max(0.75rem,env(safe-area-inset-top))]
pb-[max(1rem,env(safe-area-inset-bottom))]
```

En **dev con Turbopack**, la salida generada corrompía el `env()`; en **`next build`** (Vercel) no fallaba igual.

### Solución

Reglas normales en `app/globals.css`:

```css
.safe-area-pt-header {
  padding-top: max(0.75rem, env(safe-area-inset-top));
}

.safe-area-pb-footer {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

Y en el wizard se usan esas clases en lugar de los corchetes de Tailwind.

---

## 5. Archivos del repo tocados (referencia)

| Archivo | Cambio |
|---------|--------|
| `app/globals.css` | `@source` para escaneo; clases safe-area |
| `postcss.config.mjs` | `base: appDir` |
| `next.config.ts` | `turbopack.root` → raíz de `dormitorios-app` |
| `components/forms/reservation-mobile-wizard.tsx` | Clases safe-area en lugar de arbitrary values |

---

## 6. ¿Afecta a Vercel / producción?

**No negativamente** — los cambios son código del repo y mejoran el build.

| Tema | En Vercel |
|------|-----------|
| Mover archivos en `~/` | No aplica (Vercel solo clona el repo) |
| `@source` + PostCSS `base` | Mismo `next build` → CSS completo en producción |
| Safe-area en CSS plano | Más estable en dev y prod |
| `turbopack.root` | Principalmente relevante en `next dev` |

Tras `git push`, conviene un redeploy y hard refresh en la URL de producción.

---

## 7. Checklist si el problema vuelve

1. ¿Hay `package.json`, `package-lock.json`, `yarn.lock` o `node_modules` en **`~`** o **`~/dormitorios`**? → Mover a `~/Developer/...`.
2. ¿Mac se reinicia sola? → Revisar panics en Consola; cerrar apps; probar `NODE_OPTIONS` o más RAM en el futuro.
3. ¿UI sin estilos? → `rm -rf .next`, `npm run dev`, `Cmd+Shift+R`.
4. ¿Error de parsing CSS con `safe-area`? → No usar `env()` dentro de `className` arbitrarios; usar CSS en `globals.css`.
5. ¿Puerto ocupado? → `lsof -ti:3000 | xargs kill` o usar el puerto que indique Next (3001).

---

## 8. Cómo llegaron esos archivos a `~` (contexto)

No los crea macOS ni Next por defecto. El patrón típico:

```bash
cd ~   # o carpeta equivocada
npm install <paquete>
```

O un agente (Codex, Cursor, etc.) ejecutando `npm install` con el terminal en `~`. En este caso, `~/package.json` solo declaraba `permissionless` (herramientas web3 / account abstraction).

---

## Estado validado (local)

- `npm run dev` sin variables extra.
- Brave + Cursor + servidor local: navegación OK en landing, login y dashboard.
- Build de producción (`npm run build`) exitoso con CSS completo.

---

*Última actualización: junio 2026*
