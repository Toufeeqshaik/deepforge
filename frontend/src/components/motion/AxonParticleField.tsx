"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/* ============================================================================
   AxonParticleField — procedural neural vortex
   ----------------------------------------------------------------------------
   A swirling golden-amber + cyan/violet particle-and-filament vortex rendered
   with THREE.Points + a custom GLSL ShaderMaterial. No external assets and no
   3D "DF" logo/text in the canvas.

   - Two layers: fine cyan/violet dust + larger amber/gold filaments
   - Differential rotation (inner particles orbit faster) = swirl
   - Gentle cursor parallax/turbulence + scroll depth
   - Pauses on tab-hidden / off-screen / reduced-motion
   - Reduces particle density on narrow viewports
   - try/catch WebGL init with a dark radial CSS fallback
   ========================================================================== */

const vertexShader = /* glsl */ `
  precision highp float;

  attribute float aSize;
  attribute float aPhase;
  attribute vec3  aColor;
  attribute float aSeed;

  uniform float uTime;
  uniform float uScrollProgress;
  uniform vec2  uMouse;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uSpin;
  uniform vec2  uMag;    // Cursor magnetism: (cursorX - 0.5, 0.5 - cursorY)
  uniform float uGrain;  // Slow global drift — the "grain movement"

  varying vec3  vColor;
  varying float vAlpha;
  varying float vPulse;

  // Value noise for grain movement.
  float grainHash(vec3 p) {
    vec3 h = fract(p * 0.1031);
    float d = dot(h, vec3(17.0, 73.0, 311.7));
    return fract(sin(d) * 43758.5453);
  }

  void main() {
    // Face-on disk: x/y form the swirl plane, z is thickness.
    float r = length(position.xy);
    float theta = atan(position.y, position.x);

    // Differential rotation — inner orbits faster than outer.
    theta += uTime * uSpin * (0.55 / (0.45 + r));

    // Spiral wobble for an organic filament feel.
    theta += 0.14 * sin(uTime * 0.25 + r * 1.8 + aSeed * 6.2831);

    float rr = r + 0.05 * sin(uTime * 0.5 + aSeed * 10.0);
    vec2 xy = vec2(cos(theta), sin(theta)) * rr;

    float z = position.z + 0.10 * sin(uTime * 0.4 + aPhase + r * 1.5);

    vec3 pos = vec3(xy, z);

    // Grain drift — a slow, low-frequency wrinkle across the whole vortex.
    vec3 grain = vec3(
      grainHash(vec3(xy.x * 1.8, xy.y * 1.8, uGrain * 1.4 + 0.31)),
      grainHash(vec3(xy.x * 1.4 + 19.0, xy.y * 1.4 - 7.0, uGrain * 1.1 + 7.0)),
      grainHash(vec3(xy.x + 31.0, xy.y - 21.0, uGrain * 0.9 + 13.0))
    );
    // Smooth over space/time so the grain looks like flowing dust, not snow.
    grain -= 0.5;
    grain = clamp(grain * 2.6, -1.0, 1.0);
    pos.xy += grain.xy * 0.012 * max(r, 0.15);
    pos.z  += grain.z * 0.05;

    // Cursor parallax — stronger toward the rim.
    pos.xy += (uMouse - 0.5) * (0.16 + r * 0.10);

    // Cursor magnetism — particles gravitate toward the cursor with a
    // smooth falloff; closer in-field ⇒ stronger pull. Never holds them.
    float magDepth = length(pos.xy);
    float attraction = 0.35 + 0.65 * smoothstep(2.4, 0.0, magDepth);
    vec2 nudge = uMag * 1.1 * attraction * smoothstep(1.5, 0.0, magDepth);
    pos.xy += nudge;

    // Scroll depth.
    pos.z += uScrollProgress * 1.8;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    vPulse = 0.72 + 0.28 * sin(uTime * 1.6 + aPhase * 6.2831);

    float baseSize = aSize * uSizeScale * (260.0 / max(-mvPosition.z, 0.1));
    gl_PointSize = baseSize * uPixelRatio * vPulse;

    vColor = aColor;
    vAlpha = smoothstep(-12.0, -2.0, mvPosition.z) * (0.32 + 0.48 * vPulse);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec3  vColor;
  varying float vAlpha;
  varying float vPulse;

  uniform float uOpacity;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;

    float core = smoothstep(1.0, 0.0, d);
    float glow = pow(core, 2.0);

    float alpha = (core * 0.55 + glow * 0.80) * vAlpha * uOpacity * vPulse;
    vec3 col = vColor + vec3(0.22) * glow;

    gl_FragColor = vec4(col, alpha);
  }
`;

interface AxonParticleFieldProps {
  className?: string;
  /** Desktop particle count for the fine-dust layer. */
  particleCount?: number;
  reducedMotionFallback?: React.ReactNode;
}

const CYAN = new THREE.Color("#38bdf8");
const VIOLET = new THREE.Color("#a855f7");
const ICE = new THREE.Color("#e2e8f0");
const AMBER = new THREE.Color("#f59e0b");
const GOLD = new THREE.Color("#fcd34d");

/** Inner core is cyan/violet; the rim warms to amber/gold. */
function colorForParticle(radiusNorm: number, rand: number): [number, number, number] {
  let c: THREE.Color;
  if (radiusNorm < 0.42) {
    c = CYAN.clone().lerp(VIOLET, rand);
  } else if (radiusNorm < 0.68) {
    c = VIOLET.clone().lerp(ICE, rand * 0.7);
  } else {
    c = AMBER.clone().lerp(GOLD, rand);
  }
  return [c.r, c.g, c.b];
}

interface LayerConfig {
  count: number;
  sizeMin: number;
  sizeMax: number;
  radiusMax: number;
  thickness: number;
}

function buildGeometry({
  count,
  sizeMin,
  sizeMax,
  radiusMax,
  thickness,
}: LayerConfig): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const r = 0.35 + Math.pow(Math.random(), 0.42) * radiusMax;
    const theta = Math.random() * Math.PI * 2;
    const z = (Math.random() - 0.5) * thickness * (0.4 + r * 0.25);

    positions[i * 3] = Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(theta) * r;
    positions[i * 3 + 2] = z;

    sizes[i] = sizeMin + Math.random() * (sizeMax - sizeMin);
    phases[i] = Math.random() * Math.PI * 2;

    const [cr, cg, cb] = colorForParticle(r / radiusMax, Math.random());
    colors[i * 3] = cr;
    colors[i * 3 + 1] = cg;
    colors[i * 3 + 2] = cb;

    seeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

function buildMaterial(
  pixelRatio: number,
  sizeScale: number,
  opacity: number,
  spin: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uScrollProgress: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uPixelRatio: { value: pixelRatio },
      uSizeScale: { value: sizeScale },
      uOpacity: { value: opacity },
      uSpin: { value: spin },
      uMag: { value: new THREE.Vector2(0.5, 0.5) },
      uGrain: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export default function AxonParticleField({
  className = "",
  particleCount = 6000,
  reducedMotionFallback = null,
}: AxonParticleFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 });
  const scrollProgressRef = useRef(0);
  const isVisibleRef = useRef(true);
  const isTabVisibleRef = useRef(true);

  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false
  );
  const [webglFailed, setWebglFailed] = useState(false);

  /* --- reduced-motion preference ------------------------------------- */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /* --- tab visibility ------------------------------------------------- */
  useEffect(() => {
    const onVisibility = () => {
      isTabVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  /* --- off-screen observer ------------------------------------------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { rootMargin: "120px", threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* --- pointer tracking ---------------------------------------------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
      targetMouseRef.current.x = (clientX - rect.left) / rect.width;
      targetMouseRef.current.y = 1 - (clientY - rect.top) / rect.height;
    };

    el.addEventListener("mousemove", onMove, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("touchmove", onMove);
    };
  }, []);

  /* --- scroll depth --------------------------------------------------- */
  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const progress = 1 - Math.max(0, Math.min(1, rect.bottom / window.innerHeight));
      scrollProgressRef.current = progress;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* --- WebGL init ----------------------------------------------------- */
  const init = useCallback((): (() => void) | undefined => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      // Scale density down on narrow viewports.
      const isNarrow = width < 640;
      const isMedium = width >= 640 && width < 1024;
      const density = isNarrow ? 0.32 : isMedium ? 0.62 : 1;
      const dustCount = Math.max(600, Math.floor(particleCount * density));
      const sparkCount = Math.max(180, Math.floor(dustCount * 0.18));

      const renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current ?? undefined,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(pixelRatio);
      renderer.setClearColor(0x050608, 0);
      if (!canvasRef.current) {
        container.appendChild(renderer.domElement);
      }

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
      camera.position.set(0, 0, 6.2);
      camera.lookAt(0, 0, 0);

      const dustGeo = buildGeometry({
        count: dustCount,
        sizeMin: 0.45,
        sizeMax: 1.15,
        radiusMax: 4.0,
        thickness: 0.8,
      });
      const sparkGeo = buildGeometry({
        count: sparkCount,
        sizeMin: 1.1,
        sizeMax: 2.4,
        radiusMax: 3.5,
        thickness: 0.4,
      });

      const dustMat = buildMaterial(pixelRatio, 1.0, 0.55, 0.32);
      const sparkMat = buildMaterial(pixelRatio, 1.85, 0.95, 0.18);

      const dust = new THREE.Points(dustGeo, dustMat);
      const sparks = new THREE.Points(sparkGeo, sparkMat);

      const group = new THREE.Group();
      group.add(dust, sparks);
      scene.add(group);

      const materials: THREE.ShaderMaterial[] = [dustMat, sparkMat];

      let rafId = 0;
      let lastTime = performance.now();
      let elapsed = 0;

      const animate = (time: number) => {
        rafId = requestAnimationFrame(animate);

        if (!isTabVisibleRef.current || !isVisibleRef.current) {
          lastTime = time;
          return;
        }

        const dt = Math.min((time - lastTime) / 1000, 0.05);
        lastTime = time;
        elapsed += dt;

        // Smooth cursor interpolation (eager when idle, slower when hovered).
        const speed = mouseRef.current.x !== targetMouseRef.current.x ||
          mouseRef.current.y !== targetMouseRef.current.y
          ? 0.12
          : 0.05;
        mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * speed;
        mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * speed;

        const mag = mouseRef.current.x - 0.5;
        const magY = 0.5 - mouseRef.current.y;

        for (const mat of materials) {
          mat.uniforms.uTime.value = elapsed;
          mat.uniforms.uScrollProgress.value = scrollProgressRef.current;
          mat.uniforms.uGrain.value = elapsed;
          (mat.uniforms.uMouse.value as THREE.Vector2).set(
            mouseRef.current.x,
            mouseRef.current.y
          );
          (mat.uniforms.uMag.value as THREE.Vector2).set(
            mag,
            magY
          );
        }

        // Autonomous rotation.
        group.rotation.z += dt * 0.05;

        // Gentle camera parallax.
        camera.position.x += (mouseRef.current.x - 0.5) * 0.06 - camera.position.x * 0.001;
        camera.position.y += (mouseRef.current.y - 0.5) * 0.06 - camera.position.y * 0.001;
        camera.lookAt(0, 0, 0);

        renderer.render(scene, camera);
      };

      animate(performance.now());

      const onResize = () => {
        const w = Math.max(1, container.clientWidth);
        const h = Math.max(1, container.clientHeight);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        const pr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(pr);
        for (const mat of materials) {
          mat.uniforms.uPixelRatio.value = pr;
        }
      };

      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(rafId);
        dustGeo.dispose();
        sparkGeo.dispose();
        dustMat.dispose();
        sparkMat.dispose();
        renderer.dispose();
      };
    } catch (err) {
      console.warn("[AxonParticleField] WebGL init failed — using CSS fallback.", err);
      setWebglFailed(true);
      return;
    }
  }, [particleCount]);

  useEffect(() => {
    if (reducedMotion || webglFailed) return;
    const cleanup = init();
    return cleanup;
  }, [init, reducedMotion, webglFailed]);

  const showFallback = reducedMotion || webglFailed;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {showFallback ? (
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 55% 50% at 62% 42%, rgba(245, 158, 11, 0.10) 0%, transparent 65%),
              radial-gradient(ellipse 45% 45% at 55% 45%, rgba(56, 189, 248, 0.08) 0%, transparent 70%),
              radial-gradient(ellipse 40% 40% at 45% 55%, rgba(168, 85, 247, 0.06) 0%, transparent 70%),
              linear-gradient(180deg, #050608 0%, #07090d 55%, #090b10 100%)
            `,
          }}
        />
      ) : (
        <canvas
          ref={canvasRef}
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      )}
      {showFallback && reducedMotionFallback}
    </div>
  );
}