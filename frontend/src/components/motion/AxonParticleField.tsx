"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface AxonParticleFieldProps {
  className?: string;
  particleCount?: number;
  reducedMotionFallback?: React.ReactNode;
}

const OBSIDIAN = 0x050608;

// Electric lime green - the new accent color
const ELECTRIC_LIME = 0x00ff88;

// Brighter variants for enhanced visibility
const BRIGHT_SILVER = 0xffffff;
const BRIGHT_CYAN = 0x00ffff;
const BRIGHT_VIOLET = 0xd8a0ff;

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
  uniform float uAutoAnim;
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
    float diffuse = max(dot(N, keyLight), 0.0) * 1.2
                  + max(dot(N, fillLight), 0.0) * 0.35;
    float fresnel = pow(1.0 - abs(dot(N, V)), 2.0);

    vec3 halfVec = normalize(keyLight + V);
    float specular = pow(max(dot(N, halfVec), 0.0), 48.0);

    vec3 charcoal = vec3(0.02, 0.025, 0.035);
    vec3 silverMid = vec3(0.55, 0.6, 0.68);
    vec3 silverBright = vec3(1.0, 1.0, 1.0);

    vec3 color = mix(charcoal, silverMid, smoothstep(0.05, 0.5, diffuse));
    color = mix(color, silverBright, clamp(smoothstep(0.55, 0.85, diffuse) * 1.2 + specular * 1.4, 0.0, 1.0));

    // Deep sculptural creases stay near obsidian.
    float crease = smoothstep(0.22, 0.95, abs(vFold));
    color *= 1.0 - crease * 0.7;

    // Electric lime + cyan -> violet edge tint with FASTER auto-animation glow.
    vec3 limeColor = vec3(0.0, 1.0, 0.53);
    vec3 cyanColor = vec3(0.0, 1.0, 1.0);
    vec3 violetColor = vec3(0.75, 0.4, 1.0);
    vec3 rimColor = mix(mix(limeColor, cyanColor, smoothstep(0.0, 0.5, vAlong)), violetColor, smoothstep(0.5, 1.0, vAlong));
    float autoGlow = 1.0 + sin(uTime * 2.0 + vWorldPos.x * 3.0) * 0.2 + uAutoAnim * 0.35;
    color += rimColor * fresnel * (0.5 + vMagnetic * 0.7) * autoGlow;

    // FASTER pulse so the sculpture feels alive.
    color *= 0.9 + sin(uTime * 1.8 + vWorldPos.x * 2.5) * 0.08 + uAutoAnim * 0.12;

    float edge = smoothstep(0.0, 0.05, vAcross) * (1.0 - smoothstep(0.95, 1.0, vAcross));
    float alpha = 0.98 + 0.02 * edge;
    gl_FragColor = vec4(color, alpha);
  }
`;

const PARTICLE_VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uPointerInfluence;
  uniform float uPointerSpeed;
  uniform float uAspect;
  uniform float uAutoAnim;
  attribute vec3 aBasePos;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 pos = aBasePos;
    // FASTER animation speeds
    pos.x += sin(uTime * 0.5 + aPhase) * 0.045;
    pos.y += cos(uTime * 0.4 + aPhase * 1.3) * 0.045;
    pos.z += sin(uTime * 0.3 + aPhase * 0.8) * 0.03;

    vec2 pointerWorld = uPointer * vec2(uAspect, 1.0) * 3.6;
    float d = length(pointerWorld - pos.xy);
    float magnetic = exp(-d * d / 0.55) * uPointerInfluence;
    float swirl = magnetic * (0.1 + uPointerSpeed * 0.15);
    pos.x += (pointerWorld.x - pos.x) * magnetic * 0.22 - (pointerWorld.y - pos.y) * swirl;
    pos.y += (pointerWorld.y - pos.y) * magnetic * 0.22 + (pointerWorld.x - pos.x) * swirl;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float size = aSize * (8.0 / max(-mvPosition.z, 0.1));
    gl_PointSize = clamp(size * (1.0 + magnetic * 0.8 + uAutoAnim * 0.3), 1.5, 3.5);
    gl_Position = projectionMatrix * mvPosition;

    vColor = aColor;
    // FASTER pulse
    vAlpha = 0.6 + 0.4 * sin(uTime * 2.5 + aPhase * 2.5) + magnetic * 0.5 + uAutoAnim * 0.25;
  }
`;

const PARTICLE_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float dist = length(gl_PointCoord - 0.5);
    float core = 1.0 - smoothstep(0.06, 0.48, dist);
    float alpha = vAlpha * pow(core, 1.4);
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.45), alpha);
  }
`;

// Fine pinpoint dust particle shaders — crisp, minimal, drift along ribbon edges
const DUST_VERTEX_SHADER = `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uPointerInfluence;
  uniform float uPointerSpeed;
  uniform float uAspect;
  uniform float uAutoAnim;
  attribute vec3 aBasePos;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  attribute float aDrift;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDistFromRibbon;

  void main() {
    vec3 pos = aBasePos;

    // FASTER vertical drift with auto-animation
    pos.y += sin(uTime * 0.25 + aPhase) * 0.035 * aDrift + uAutoAnim * 0.025;
    pos.x += cos(uTime * 0.18 + aPhase * 1.7) * 0.025 * aDrift;
    pos.z += sin(uTime * 0.12 + aPhase * 0.9) * 0.02 * aDrift;

    // Subtle magnetic pull from cursor — weaker than main particles
    vec2 pointerWorld = uPointer * vec2(uAspect, 1.0) * 3.6;
    float d = length(pointerWorld - pos.xy);
    float magnetic = exp(-d * d / 1.0) * uPointerInfluence * 0.4;
    float swirl = magnetic * (0.04 + uPointerSpeed * 0.07);
    pos.x += (pointerWorld.x - pos.x) * magnetic * 0.1 - (pointerWorld.y - pos.y) * swirl;
    pos.y += (pointerWorld.y - pos.y) * magnetic * 0.1 + (pointerWorld.x - pos.x) * swirl;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float size = aSize * (6.0 / max(-mvPosition.z, 0.1));
    gl_PointSize = clamp(size * (1.0 + magnetic * 0.4 + uAutoAnim * 0.2), 1.2, 3.2);
    gl_Position = projectionMatrix * mvPosition;

    vColor = aColor;
    // FASTER pulse
    vAlpha = 0.8 + 0.2 * sin(uTime * 1.8 + aPhase * 1.8) + magnetic * 0.25 + uAutoAnim * 0.2;
    // Track distance from ribbon center for edge clustering
    vDistFromRibbon = abs(pos.y - sin(pos.x * 0.88 + uTime * 0.2) * 0.45);
  }
`;

const DUST_FRAGMENT_SHADER = `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vDistFromRibbon;

  void main() {
    float dist = length(gl_PointCoord - 0.5);
    // Extremely tight radial falloff for pinpoint sharpness
    float core = 1.0 - smoothstep(0.015, 0.4, dist);
    float alpha = vAlpha * pow(core, 2.0);
    // Fade dust near ribbon center, keep at edges
    float edgeFactor = smoothstep(0.15, 0.5, vDistFromRibbon);
    alpha *= edgeFactor;
    if (alpha < 0.012) discard;
    gl_FragColor = vec4(mix(vColor, vec3(1.0), 0.25), alpha);
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
          uAutoAnim: { value: 0 },
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

      const lime = new THREE.Color(ELECTRIC_LIME);
      const cyan = new THREE.Color(BRIGHT_CYAN);
      const silver = new THREE.Color(BRIGHT_SILVER);
      const violet = new THREE.Color(BRIGHT_VIOLET);

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
        const color = r < 0.35 ? lime.clone() : r < 0.65 ? cyan.clone() : r < 0.85 ? violet.clone() : silver.clone();
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        sizes[i] = 1.0 + Math.random() * 1.2;
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
          uAutoAnim: { value: 0 },
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

      // Fine pinpoint dust layer
      const dustGeometry = new THREE.BufferGeometry();
      const dustCount = Math.max(200, Math.floor(particleCount * density * 0.35));
      const dustPositions = new Float32Array(dustCount * 3);
      const dustBasePositions = new Float32Array(dustCount * 3);
      const dustColors = new Float32Array(dustCount * 3);
      const dustSizes = new Float32Array(dustCount);
      const dustPhases = new Float32Array(dustCount);
      const dustDrifts = new Float32Array(dustCount);

      const dustLime = new THREE.Color(ELECTRIC_LIME);
      const dustCyan = new THREE.Color(BRIGHT_CYAN);
      const dustSilver = new THREE.Color(BRIGHT_SILVER);
      const dustViolet = new THREE.Color(BRIGHT_VIOLET);

      for (let i = 0; i < dustCount; i++) {
        // Distribute along ribbon edges — cluster near the twisted S-curve
        const u = Math.random();
        const edgeBias = Math.random() < 0.7 ? (Math.random() < 0.5 ? -1 : 1) : 0;

        // Follow ribbon centerline with edge offset
        const cx = (u - 0.5) * 7.8 + 0.35;
        const cy = Math.sin(u * Math.PI * 2.0 - 0.6) * 1.10 + (u - 0.5) * 0.85;
        const cz = Math.cos(u * Math.PI * 2.0 - 0.6) * 0.70;

        // Add perpendicular offset toward ribbon edges
        const taper = 0.55 + 0.45 * Math.pow(Math.sin(Math.PI * u), 0.45);
        const ribbonWidth = 1.35 * taper;
        const edgeOffset = edgeBias * ribbonWidth * (0.7 + Math.random() * 0.3);
        const jitter = (Math.random() - 0.5) * 0.15;

        const x = cx + edgeOffset + jitter;
        const y = cy + (Math.random() - 0.5) * 0.35;
        const z = cz - 0.4 - Math.random() * 1.2;

        dustPositions[i * 3] = x;
        dustPositions[i * 3 + 1] = y;
        dustPositions[i * 3 + 2] = z;
        dustBasePositions[i * 3] = x;
        dustBasePositions[i * 3 + 1] = y;
        dustBasePositions[i * 3 + 2] = z;

        const r = Math.random();
        const color = r < 0.4 ? dustLime.clone() : r < 0.7 ? dustCyan.clone() : r < 0.88 ? dustViolet.clone() : dustSilver.clone();
        dustColors[i * 3] = color.r;
        dustColors[i * 3 + 1] = color.g;
        dustColors[i * 3 + 2] = color.b;
        dustSizes[i] = 0.4 + Math.random() * 0.3; // Slightly larger pinpoints
        dustPhases[i] = Math.random() * 6.283;
        dustDrifts[i] = 0.5 + Math.random() * 0.5;
      }

      dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
      dustGeometry.setAttribute("aBasePos", new THREE.BufferAttribute(dustBasePositions, 3));
      dustGeometry.setAttribute("aColor", new THREE.BufferAttribute(dustColors, 3));
      dustGeometry.setAttribute("aSize", new THREE.BufferAttribute(dustSizes, 1));
      dustGeometry.setAttribute("aPhase", new THREE.BufferAttribute(dustPhases, 1));
      dustGeometry.setAttribute("aDrift", new THREE.BufferAttribute(dustDrifts, 1));

      const dustMaterial = new THREE.ShaderMaterial({
        vertexShader: DUST_VERTEX_SHADER,
        fragmentShader: DUST_FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
          uPointer: { value: new THREE.Vector2(0, 0) },
          uPointerInfluence: { value: 0 },
          uPointerSpeed: { value: 0 },
          uAspect: { value: width / height },
          uAutoAnim: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.NormalBlending, // Sharp pinpoints, no additive bloom
        toneMapped: false,
      });
      const dust = new THREE.Points(dustGeometry, dustMaterial);
      dust.frustumCulled = false;
      scene.add(dust);

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
        pointerX += (targetPointerRef.current.x - pointerX) * 0.08;
        pointerY += (targetPointerRef.current.y - pointerY) * 0.08;
        pointerInfluence += ((pointerActiveRef.current ? 1 : 0) - pointerInfluence) * 0.08;
        pointerVelocityRef.current *= 0.88;

        // Auto-animation factor: breathes and rotates even without user input
        const autoAnim = Math.sin(elapsed * 0.3) * 0.5 + Math.sin(elapsed * 0.7) * 0.3 + 0.5;

        for (const material of [ribbonMaterial, particleMaterial, dustMaterial]) {
          (material.uniforms.uTime as { value: number }).value = elapsed;
          (material.uniforms.uPointer as { value: THREE.Vector2 }).value.set(pointerX, pointerY);
          (material.uniforms.uPointerInfluence as { value: number }).value = pointerInfluence;
          (material.uniforms.uPointerSpeed as { value: number }).value = pointerVelocityRef.current;
          (material.uniforms.uAutoAnim as { value: number }).value = autoAnim;
        }

        // Enhanced auto-animation: continuous gentle rotation and breathing
        ribbon.rotation.z = -0.28 + Math.sin(elapsed * 0.14) * 0.05 + Math.sin(elapsed * 0.07) * 0.02;
        ribbon.rotation.x = 0.18 + pointerY * 0.05 + Math.sin(elapsed * 0.11) * 0.02 + Math.sin(elapsed * 0.05) * 0.015;
        ribbon.rotation.y = -0.22 + pointerX * 0.05 + Math.cos(elapsed * 0.09) * 0.02 + Math.cos(elapsed * 0.06) * 0.015;
        ribbon.position.x = 1.35 + pointerX * 0.08 + Math.sin(elapsed * 0.08) * 0.12;
        ribbon.position.y = -0.15 + pointerY * 0.05 + Math.cos(elapsed * 0.10) * 0.08;
        ribbon.position.z = Math.sin(elapsed * 0.06) * 0.15;

        // Camera follows with more dynamic movement
        camera.position.x += (pointerX * 0.05 + Math.sin(elapsed * 0.07) * 0.08 - camera.position.x) * 0.012;
        camera.position.y += (pointerY * 0.035 + Math.cos(elapsed * 0.09) * 0.06 - camera.position.y) * 0.012;
        camera.position.z += (6.3 + Math.sin(elapsed * 0.05) * 0.15 - camera.position.z) * 0.008;
        camera.lookAt(Math.sin(elapsed * 0.08) * 0.15, Math.cos(elapsed * 0.10) * 0.08, 0);
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
        (dustMaterial.uniforms.uAspect as { value: number }).value = nextWidth / nextHeight;
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
        dustGeometry.dispose();
        dustMaterial.dispose();
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
