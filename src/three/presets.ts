export interface ThreePreset {
  file: string;
  description: string;
  render(): string;
}

const CLEANUP = `    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };`;

export const PRESETS: Record<string, ThreePreset> = {
  particle: {
    file: "ParticleHero.tsx",
    description: "Starfield particle hero — mouse parallax, fades on scroll",
    render: () => `"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ParticleHeroProps {
  count?: number;
  color?: string;
}

export default function ParticleHero({ count = 1500, color = "#ffffff" }: ParticleHeroProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 8;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() - 0.5) * 20;
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.035, transparent: true, opacity: 0.8 });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    let mx = 0, my = 0, raf = 0;
    const onMove = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      mat.opacity = max > 0 ? 0.8 * (1 - Math.min(1, window.scrollY / max)) : 0.8;
    };

    const tick = () => {
      points.rotation.y += 0.0006;
      camera.position.x += (mx * 0.8 - camera.position.x) * 0.03;
      camera.position.y += (-my * 0.8 - camera.position.y) * 0.03;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    tick();
${CLEANUP}
  }, [count, color]);

  return <div ref={mountRef} className="absolute inset-0 -z-0" aria-hidden="true" />;
}
`,
  },

  terrain: {
    file: "TerrainHero.tsx",
    description: "Animated wireframe landscape — camera drifts as you scroll",
    render: () => `"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface TerrainHeroProps {
  color?: string;
}

export default function TerrainHero({ color = "#4ade80" }: TerrainHeroProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.028);
    const camera = new THREE.PerspectiveCamera(60, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 3.2, 9);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    const geo = new THREE.PlaneGeometry(30, 30, 60, 60);
    const mat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.35 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2.4;
    scene.add(mesh);
    const base = (geo.attributes.position.array as Float32Array).slice();

    let raf = 0;
    const t0 = performance.now();
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const onScroll = () => {};
    const onMove = () => {};

    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        p.setZ(i, Math.sin(x * 0.5 + t) * 0.7 + Math.cos(y * 0.4 + t * 0.8) * 0.7);
      }
      p.needsUpdate = true;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const prog = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      camera.position.z = 9 - prog * 3;
      camera.position.y = 3.2 - prog * 1.2;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    tick();
${CLEANUP}
  }, [color]);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />;
}
`,
  },

  shapes: {
    file: "ShapesHero.tsx",
    description: "Floating chrome shapes with studio lighting",
    render: () => `"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ShapesHero() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 6, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.8);
    rim.position.set(-6, -2, -4);
    scene.add(rim);

    const mat = new THREE.MeshStandardMaterial({ color: 0xdde3ee, metalness: 0.85, roughness: 0.25 });
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.6, 0.45, 140, 20), mat);
    knot.position.x = -2.6;
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), new THREE.MeshStandardMaterial({ color: 0x4ade80, metalness: 0.4, roughness: 0.35 }));
    ball.position.x = 2.8;
    scene.add(knot, ball);

    let mx = 0, my = 0, raf = 0;
    const t0 = performance.now();
    const onMove = (e: MouseEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const onScroll = () => {};

    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      knot.rotation.x = t * 0.25; knot.rotation.y = t * 0.3;
      knot.position.y = Math.sin(t * 0.7) * 0.4;
      ball.rotation.y = -t * 0.4;
      ball.position.y = Math.cos(t * 0.9) * 0.5;
      camera.position.x += (mx * 1.4 - camera.position.x) * 0.04;
      camera.position.y += (-my * 1.4 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    tick();
${CLEANUP}
  }, []);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />;
}
`,
  },

  orb: {
    file: "OrbHero.tsx",
    description: "Breathing gradient shader orb (custom GLSL)",
    render: () => `"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface OrbHeroProps {
  colorA?: string;
  colorB?: string;
}

const VERT = [
  "varying vec2 vUv;",
  "varying float vWave;",
  "uniform float uTime;",
  "void main() {",
  "  vUv = uv;",
  "  vec3 p = position;",
  "  float w = sin(p.x * 3.0 + uTime) * 0.08 + cos(p.y * 4.0 + uTime * 1.3) * 0.08;",
  "  vWave = w;",
  "  p += normal * w;",
  "  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);",
  "}",
].join("\\n");

const FRAG = [
  "varying vec2 vUv;",
  "varying float vWave;",
  "uniform vec3 uA;",
  "uniform vec3 uB;",
  "void main() {",
  "  vec3 col = mix(uA, uB, vUv.y + vWave * 2.0);",
  "  gl_FragColor = vec4(col, 1.0);",
  "}",
].join("\\n");

export default function OrbHero({ colorA = "#4ade80", colorB = "#1e3a8a" }: OrbHeroProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    const uniforms = {
      uTime: { value: 0 },
      uA: { value: new THREE.Color(colorA) },
      uB: { value: new THREE.Color(colorB) },
    };
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(2, 64, 64),
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms }),
    );
    scene.add(orb);

    let raf = 0;
    const t0 = performance.now();
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const onScroll = () => {};
    const onMove = () => {};

    const tick = () => {
      uniforms.uTime.value = (performance.now() - t0) / 1000;
      orb.rotation.y += 0.002;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const prog = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      orb.position.y = prog * 2.2;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    tick();
${CLEANUP}
  }, [colorA, colorB]);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />;
}
`,
  },

  model: {
    file: "ModelViewer.tsx",
    description: "Drop-in GLB/GLTF viewer — auto-rotate, scroll spin, drag orbit",
    render: () => `"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

interface ModelViewerProps {
  url?: string;
  autoRotate?: boolean;
}

export default function ModelViewer({ url = "/models/hero.glb", autoRotate = true }: ModelViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.4, 5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(4, 6, 6);
    scene.add(key);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.2;

    const group = new THREE.Group();
    scene.add(group);
    new GLTFLoader().load(
      url,
      (gltf) => { group.add(gltf.scene); },
      undefined,
      () => {},
    );

    let raf = 0;
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const prog = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      group.rotation.y = prog * Math.PI * 2;
    };
    const onMove = () => {};

    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    tick();
${CLEANUP}
  }, [url, autoRotate]);

  return <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />;
}
`,
  },
};
