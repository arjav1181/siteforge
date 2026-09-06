---
name: siteforge-3d
description: Add Three.js 3D hero scenes via `siteforge 3d`: particle starfield, wireframe terrain, floating chrome shapes, GLSL gradient orb, GLB/GLTF model viewer with orbit + scroll spin. Use for 3D backgrounds, interactive 3D heroes, showing a 3D model on a site.
---

# siteforge 3d

```bash
siteforge 3d --list
siteforge 3d particle --dir src/components
```

Presets: `particle`, `terrain`, `shapes`, `orb`, `model`. Each writes a
self-contained client component. Then: `npm install three @types/three`.

Usage pattern (full-bleed background inside a relative hero):

```tsx
import ParticleHero from "./components/ParticleHero";
<section className="relative h-screen overflow-hidden">
  <ParticleHero />
  <div className="relative z-10">...content...</div>
</section>
```

`model` loads `/models/hero.glb` (put your file in `public/models/`):
auto-rotate + drag orbit + full scroll spin. All presets cap DPR at 1.5,
dispose on unmount, and fade/drift with scroll. Respect prefers-reduced-motion
for users who need stillness — gate the section behind the media query.

## Examples

- "Starfield hero" → `siteforge 3d particle`, then `npm i three @types/three`
- "Show my .glb on the landing page" → `siteforge 3d model`, drop file in `public/models/`
- Full-bleed pattern: relative section + absolute scene + `relative z-10` content
