---
name: siteforge-3d
description: Drop Three.js hero scenes (particle starfield, wireframe terrain, floating shapes, shader orb, GLB model viewer) into a site with `siteforge 3d`. Use for 3D backgrounds and interactive 3D heroes.
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
