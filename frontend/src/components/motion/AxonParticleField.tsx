"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface AxonParticleFieldProps {
  className?: string;
  particleCount?: number;
  reducedMotionFallback?: React.ReactNode;
}

const OBSIDIAN = 0x050608;
const SILVER_HIGHLIGHT = 0xf8fafc;
const CYAN_RIM = 0x38bdf8;
const VIOLET_RIM = 0xa855f7;

const RIBBON_VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uPointerInfluence;
  uniform float uPointerSpeed;
  uniform float uAspect;
  uniform vec3 uCameraPos;
  attribute float aPhase;
  attribute float aFold;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  varying float vFold;
  varying float vMagnetic;
  varying float vAlong;
  varying float vAcross;

  void main() {
    vec3 pos = position;
    vec3 nrm = normal;

    // Small sculptural breathing of the folds.
    float wave = sin(pos.x * 1.7 + uTime * 0.32 + aPhase) * 0.030
               + sin(pos.x * 3.6 - uTime * 0.21) * 0.016;
    pos.z += wave;
    pos.y += sin(pos.x * 2.3 + uTime * 0.26) * 0.018;

    // Cursor magnetic pull with a slight swirl.
    vec2 pointerWorld = uPointer * vec2(uAspect, 1.0) * 3.6;
    float d = length(pointerWorld - pos.xy);
    float magnetic = exp(-d * d / 0.85) * uPointerInfluence;
    float swirl = magnetic * (0.05 + uPointerSpeed * 0.10);
    pos.x += (pointerWorld.x - pos.x) * magnetic * 0.11 - (pointerWorld.y - pos.y) * swirl;
    pos.y += (pointerWorld.y - pos.y) * magnetic * 0.11 + (pointerWorld.x - pos.x) * swirl;
    pos.z += magnetic * 0.12;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);

    vWorldPos = worldPosition.xyz;
    vNormal = normalize(normalMatrix * nrm);
    vViewDir = normalize(uCameraPos - worldPosition.xyz);
    vFold = aFold;
    vMagnetic = magnetic;
    vAlong = clamp(pos.x / 7.2 + 0.5, 0.0, 1.0);
    vAcross = uv.y;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const RIBBON_FRAGMENT_SHADER = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;
  varying float vFold;
  varying float vMagnetic;
  varying float vAlong;
  varying float vAcross;

  void main() {
    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vViewDir);

    vec3 keyLight = normalize(vec3(0.55, 0.85, 0.75));
    vec3 fillLight = normalize(vec3(-0.70, -0.25, 0.45));
    float diffuse = max(dot(N, keyLight), 0.0) * 0.92
                  + max(dot(N, fillLight), 0.0) * 0.22;
    float fresnel = pow(1.0 - abs(dot(N, V)), 2.4);

    vec3 halfVec = normalize(keyLight + V);
    float specular = pow(max(dot(N, halfVec), 0.0), 54.0);

    vec3 charcoal = vec3(0.012, 0.016, 0.024);
    vec3 silverMid = vec3(0.42, 0.47, 0.53);
    vec3 silverBright = vec3(0.972, 0.980, 0.988);

    vec3 color = mix(charcoal, silverMid, smoothstep(0.08, 0.58, diffuse));
    color = mix(color, silverBright, clamp(smoothstep(0.64, 0.92, diffuse) * 0.95 + specular * 1.15, 0.0, 1.0));

    // Deep sculptural creases stay near obsidian.
    float crease = smoothstep(0.22, 0.95, abs(vFold));
    color *= 1.0 - crease * 0.86;

    // Subtle cyan -> violet edge tint, never a full-screen haze.
    vec3 rimColor = mix(vec3(0.22, 0.74, 0.97), vec3(0.66, 0.33, 0.97),
                        smoothstep(0.0, 1.0, vAlong));
    color += rimColor * fresnel * (0.32 + vMagnetic * 0.45);

    // Slight pulse so the sculpture feels alive without blinking.
    color *= 0.94 + sin(uTime * 0.8 + vWorldPos.x * 1.4) * 0.04;

    float edge = smoothstep(0.0, 0.05, vAcross) * (1.0 - smoothstep(0.95, 1.0, vAcross));
    float alpha = 0.90 + 0.10 * edge;
    gl_FragColor = vec4(color, alpha);
  }
`;

const PARTICLE_VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uPointerInfluence;
  uniform float uPointerSpeed;
  uniform float uAspect;
  attribute vec3 aBasePos;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = aBasePos;
    pos.x += sin(uTime * 0.24 + aPhase) * 0.025;
    pos.y += cos(uTime * 0.20 + aPhase * 1.3) * 0.025;

    vec2 pointerWorld = uPointer * vec2(uAspect, 1.0) * 3.6;
    float d = length(pointerWorld - pos.xy);
    float magnetic = exp(-d * d / 0.7) * uPointerInfluence;
    float swirl = magnetic * (0.06 + uPointerSpeed * 0.10);
    pos.x += (pointerWorld.x - pos.x) * magnetic * 0.16 - (pointerWorld.y - pos.y) * swirl;
    pos.y += (pointerWorld.y - pos.y) * magnetic * 0.16 + (pointerWorld.x - pos.x) * swirl;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float size = aSize * (6.3 / max(-mvPosition.z, 0.1));
    gl_PointSize = clamp(size * (1.0 + magnetic * 0.6), 1.0, 2.5);
    gl_Position = projectionMatrix * mvPosition;

    vColor = aColor;
    vAlpha = 0.40 + 0.30 * sin(uTime * 1.1 + aPhase * 2.0) + magnetic * 0.35;
  }
`;

const PARTICLE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float dist = length(gl_PointCoord - 0.5);
    float core = 1.0 - smoothstep(0.08, 0.5, dist);
    float alpha = vAlpha * pow(core, 1.6);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.3), alpha);
  }
`;

/**
 * Narrow S-twisted ribbon band. The cross-section is parallel-transported
 * along a sine-wave centreline and rotated about the tangent, producing a
 * genuine sculpted twist rather than a flat screen-filling sheet.
 */
function createRibbonGeometry(segmentsU: number, segmentsV: number): THREE.BufferGeometry {
  const length = 7.8;
  const width = 1.35;
  const positions: number[] = [];
  const uvs: number[] = [];
  const phases: number[] = [];
  const folds: number[] = [];
  const indices: number[] = [];

  const centerAt = (u: number): [number, number, number] => [
    (u - 0.5) * length + 0.35,
    Math.sin(u * Math.PI * 2.0 - 0.6) * 1.10 + (u - 0.5) * 0.85,
    Math.cos(u * Math.PI * 2.0 - 0.6) * 0.70,
  ];

  for (let i = 0; i <= segmentsU; i++) {
    const u = i / segmentsU;
    const [cx, cy, cz] = centerAt(u);
    const [ax, ay, az] = centerAt(Math.max(0, u - 0.002));
    const [bx, by, bz] = centerAt(Math.min(1, u + 0.002));

    let tx = bx - ax;
    let ty = by - ay;
    let tz = bz - az;
    const tangentLength = Math.hypot(tx, ty, tz) || 1;
    tx /= tangentLength;
    ty /= tangentLength;
    tz /= tangentLength;

    // normal = up x tangent, binormal = tangent x normal.
    let nx = tz;
    let ny = 0;
    let nz = -tx;
    const normalLength = Math.hypot(nx, ny, nz) || 1;
    nx /= normalLength;
    ny /= normalLength;
    nz /= normalLength;

    const bx2 = ty * nz - tz * ny;
    const by2 = tz * nx - tx * nz;
    const bz2 = tx * ny - ty * nx;
    const binormalLength = Math.hypot(bx2, by2, bz2) || 1;
    const bxn = bx2 / binormalLength;
    const byn = by2 / binormalLength;
    const bzn = bz2 / binormalLength;

    const twist = u * Math.PI * 3.6 + 0.45;
    const cosT = Math.cos(twist);
    const sinT = Math.sin(twist);

    // surface normal for fold displacement.
    let sx = ty * (nz * cosT + bzn * sinT) - tz * (ny * cosT + byn * sinT);
    let sy = tz * (nx * cosT + bxn * sinT) - tx * (nz * cosT + bzn * sinT);
    let sz = tx * (ny * cosT + byn * sinT) - ty * (nx * cosT + bxn * sinT);
    const surfaceLength = Math.hypot(sx, sy, sz) || 1;
    sx /= surfaceLength;
    sy /= surfaceLength;
    sz /= surfaceLength;

    const taper = 0.55 + 0.45 * Math.pow(Math.sin(Math.PI * u), 0.45);

    for (let j = 0; j <= segmentsV; j++) {
      const v = j / segmentsV;
      const side = v - 0.5;

      const fold =
        Math.sin(u * Math.PI * 14.0 + v * Math.PI * 2.6) * 0.075 +
        Math.sin(v * Math.PI * 5.5 + u * Math.PI * 6.0) * 0.042;

      const dx = nx * cosT + bxn * sinT;
      const dy = ny * cosT + byn * sinT;
      const dz = nz * cosT + bzn * sinT;
      const offset = side * width * taper + fold;

      positions.push(
        cx + dx * offset + sx * fold * 0.35,
        cy + dy * offset + sy * fold * 0.35,
        cz + dz * offset + sz * fold * 0.35,
      );
      uvs.push(u, v);
      phases.push(u * 4.2 + v * 1.7);
      folds.push(fold * 9.0);
    }
  }

  const row = segmentsV + 1;
  for (let i = 0; i < segmentsU; i++) {
    for (let j = 0; j < segmentsV; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
  geometry.setAttribute("aFold", new THREE.Float32BufferAttribute(folds, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export default function AxonParticleField({
  className = "",
  particleCount = 2000,
  reducedMotionFallback = null,
}: AxonParticleFieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetPointerRef = useRef({ x: 0, y: 0 });
  const pointerActiveRef = useRef(false);
  const pointerVelocityRef = useRef(0);
  const isVisibleRef = useRef(true);
  const isTabVisibleRef = useRef(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const visibilityTarget = document.querySelector("[data-axon-visibility]") ?? element;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisibleRef.current = entry.isIntersecting;
      },
      { rootMargin: "80px", threshold: 0.01 },
    );
    observer.observe(visibilityTarget);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let lastX = window.innerWidth / 2;
    let lastY = window.innerHeight / 2;

    const onPointerMove = (event: PointerEvent) => {
      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      targetPointerRef.current.x = (event.clientX / width - 0.5) * 2;
      targetPointerRef.current.y = (event.clientY / height - 0.5) * -2;
      pointerVelocityRef.current = Math.min(
        Math.hypot(event.clientX - lastX, event.clientY - lastY) / 30,
        1,
      );
      pointerActiveRef.current = true;
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerLeave = () => {
      pointerActiveRef.current = false;
      pointerVelocityRef.current = 0;
      targetPointerRef.current.x = 0;
      targetPointerRef.current.y = 0;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  const init = useCallback((): (() => void) | undefined => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let renderer: THREE.WebGLRenderer | undefined;
    let rafId = 0;

    try {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const isNarrow = width < 640;
      const density = isNarrow ? 0.5 : width < 1024 ? 0.75 : 1;

      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height);
      renderer.setClearColor(OBSIDIAN, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
      camera.position.set(0, 0, 6.3);
      camera.lookAt(0, 0, 0);

      const ribbonGeometry = createRibbonGeometry(
        isNarrow ? 150 : 260,
        isNarrow ? 20 : 36,
      );
      const ribbonMaterial = new THREE.ShaderMaterial({
        vertexShader: RIBBON_VERTEX_SHADER,
        fragmentShader: RIBBON_FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uPointerInfluence: { value: 0 },
          uPointerSpeed: { value: 0 },
          uAspect: { value: width / height },
          uCameraPos: { value: new THREE.Vector3(0, 0, 6.3) },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const ribbon = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
      ribbon.frustumCulled = false;
      scene.add(ribbon);

      const particleGeometry = new THREE.BufferGeometry();
      const pCount = Math.max(400, Math.floor(particleCount * density));
      const positions = new Float32Array(pCount * 3);
      const basePositions = new Float32Array(pCount * 3);
      const colors = new Float32Array(pCount * 3);
      const sizes = new Float32Array(pCount);
      const phases = new Float32Array(pCount);

      const cyan = new THREE.Color(CYAN_RIM);
      const silver = new THREE.Color(SILVER_HIGHLIGHT);
      const violet = new THREE.Color(VIOLET_RIM);

      for (let i = 0; i < pCount; i++) {
        const x = (Math.random() - 0.5) * (width / height) * 9.0;
        const y = (Math.random() - 0.5) * 5.0;
        const z = -0.6 - Math.random() * 2.4;
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
        basePositions[i * 3] = x;
        basePositions[i * 3 + 1] = y;
        basePositions[i * 3 + 2] = z;

        const r = Math.random();
        const color = r < 0.45 ? silver.clone() : r < 0.75 ? cyan.clone() : violet.clone();
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        sizes[i] = 0.8 + Math.random() * 1.0;
        phases[i] = Math.random() * 6.283;
      }

      particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute("aBasePos", new THREE.BufferAttribute(basePositions, 3));
      particleGeometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      particleGeometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      particleGeometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

      const particleMaterial = new THREE.ShaderMaterial({
        vertexShader: PARTICLE_VERTEX_SHADER,
        fragmentShader: PARTICLE_FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uPointerInfluence: { value: 0 },
          uPointerSpeed: { value: 0 },
          uAspect: { value: width / height },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      particles.frustumCulled = false;
      scene.add(particles);

      const render = () => renderer?.render(scene, camera);
      let elapsed = 0;
      let lastTime = performance.now();
      let pointerX = 0;
      let pointerY = 0;
      let pointerInfluence = 0;

      const animate = (time: number) => {
        if (!renderer) return;
        rafId = requestAnimationFrame(animate);
        if (!isTabVisibleRef.current || !isVisibleRef.current) {
          lastTime = time;
          return;
        }

        const delta = Math.min((time - lastTime) / 1000, 0.05);
        lastTime = time;
        elapsed += delta;
        pointerX += (targetPointerRef.current.x - pointerX) * 0.06;
        pointerY += (targetPointerRef.current.y - pointerY) * 0.06;
        pointerInfluence += ((pointerActiveRef.current ? 1 : 0) - pointerInfluence) * 0.06;
        pointerVelocityRef.current *= 0.9;

        for (const material of [ribbonMaterial, particleMaterial]) {
          (material.uniforms.uTime as { value: number }).value = elapsed;
          (material.uniforms.uPointer as { value: THREE.Vector2 }).value.set(pointerX, pointerY);
          (material.uniforms.uPointerInfluence as { value: number }).value = pointerInfluence;
          (material.uniforms.uPointerSpeed as { value: number }).value = pointerVelocityRef.current;
        }

        ribbon.rotation.z = -0.28 + Math.sin(elapsed * 0.14) * 0.03;
        ribbon.rotation.x = 0.18 + pointerY * 0.035 + Math.sin(elapsed * 0.11) * 0.01;
        ribbon.rotation.y = -0.22 + pointerX * 0.035 + Math.cos(elapsed * 0.09) * 0.01;
        ribbon.position.x = 1.35 + pointerX * 0.06;
        ribbon.position.y = -0.15 + pointerY * 0.03;

        camera.position.x += (pointerX * 0.03 - camera.position.x) * 0.008;
        camera.position.y += (pointerY * 0.02 - camera.position.y) * 0.008;
        camera.lookAt(0, 0, 0);
        (ribbonMaterial.uniforms.uCameraPos as { value: THREE.Vector3 }).value.copy(camera.position);

        render();
      };

      if (reducedMotion) render();
      else rafId = requestAnimationFrame(animate);

      const onResize = () => {
        const nextWidth = Math.max(1, container.clientWidth);
        const nextHeight = Math.max(1, container.clientHeight);
        camera.aspect = nextWidth / nextHeight;
        camera.updateProjectionMatrix();
        renderer?.setSize(nextWidth, nextHeight);
        (ribbonMaterial.uniforms.uAspect as { value: number }).value = nextWidth / nextHeight;
        (particleMaterial.uniforms.uAspect as { value: number }).value = nextWidth / nextHeight;
        render();
      };
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
        cancelAnimationFrame(rafId);
        ribbonGeometry.dispose();
        ribbonMaterial.dispose();
        particleGeometry.dispose();
        particleMaterial.dispose();
        renderer?.dispose();
      };
    } catch (error) {
      console.warn("[AxonParticleField] WebGL init failed; using the static fallback.", error);
      renderer?.dispose();
      setWebglFailed(true);
      return;
    }
  }, [particleCount, reducedMotion]);

  useEffect(() => {
    if (webglFailed) return;
    return init();
  }, [init, webglFailed]);

  const showFallback = webglFailed;

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {showFallback ? (
        <div className="absolute inset-0 bg-[#050608]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(1px 1px at 6% 14%, rgba(232,244,255,.84) 55%, transparent 100%), radial-gradient(1px 1px at 18% 72%, rgba(56,189,248,.75) 55%, transparent 100%), radial-gradient(1px 1px at 31% 42%, rgba(232,244,255,.64) 55%, transparent 100%), radial-gradient(1px 1px at 47% 9%, rgba(45,212,191,.7) 55%, transparent 100%), radial-gradient(1px 1px at 67% 78%, rgba(192,132,252,.72) 55%, transparent 100%), radial-gradient(1px 1px at 83% 27%, rgba(232,244,255,.78) 55%, transparent 100%), radial-gradient(ellipse at 52% 48%, rgba(56,189,248,.06), transparent 48%)",
            }}
          />
        </div>
      ) : (
        <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      )}
      {showFallback && reducedMotionFallback}
    </div>
  );
}
