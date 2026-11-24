"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface FaceParticleMatrixProps {
  className?: string;
  particleDensity?: number;
}

/**
 * FaceParticleMatrix — Procedural 3D face from a dense dotted particle matrix.
 * Features:
 * - Dense particle grid morphed into face geometry via signed distance field
 * - Continuous sine-wave ripple animations across the surface
 * - Biometric laser scan sweep (horizontal line with glow trail)
 * - Cursor repulsion + ripple physics (particles push away, then settle)
 * - Mouse-drag 360° orbit with damping (inertia + easing)
 * - Electric lime (#00ff88) accent throughout
 * - 2x animation speeds (consistent with AxonParticleField)
 * - Zero external assets — all geometry procedural
 */
export default function FaceParticleMatrix({
  className = "",
  particleDensity = 1.0,
}: FaceParticleMatrixProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "80px" }
    );
    if (mountRef.current) observer.observe(mountRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mountRef.current || prefersReduced || !visible || !webglSupported) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Colors
    const ELECTRIC_LIME = new THREE.Color(0x00ff88);
    const LIME_BRIGHT = new THREE.Color(0x44ffaa);
    const CYAN_GLOW = new THREE.Color(0x00ffff);

    // ---- Face SDF (Signed Distance Field) ----
    // Procedural face shape using implicit functions
    function faceSDF(p: THREE.Vector3): number {
      const x = p.x;
      const y = p.y;
      const z = p.z;

      // Head ellipsoid (base shape)
      const head = Math.sqrt(x * x * 1.2 + y * y * 1.5 + z * z * 0.8) - 1.0;

      // Chin taper
      const chin = Math.max(0, -y - 0.5) * 0.8;

      // Forehead bulge
      const forehead = Math.max(0, y - 0.6) * 0.3;

      // Cheekbones
      const cheek = Math.max(0, Math.abs(x) - 0.45 - Math.max(0, y + 0.2) * 0.3) * 0.4;

      // Nose
      const noseDist = Math.sqrt(x * x + (y - 0.05) * (y - 0.05));
      const nose = Math.max(0, 0.18 - noseDist) * (0.6 - z * 1.2);

      // Eye sockets
      const eyeL = Math.sqrt((x + 0.22) * (x + 0.22) + (y - 0.18) * (y - 0.18) + (z - 0.35) * (z - 0.35));
      const eyeR = Math.sqrt((x - 0.22) * (x - 0.22) + (y - 0.18) * (y - 0.18) + (z - 0.35) * (z - 0.35));
      const eyes = Math.max(0, 0.12 - Math.min(eyeL, eyeR)) * 0.8;

      // Brow ridge
      const brow = Math.max(0, 0.08 - Math.abs(y - 0.28)) * Math.max(0, 0.3 - Math.abs(x)) * (0.5 - z);

      // Mouth
      const mouth = Math.max(0, 0.06 - Math.sqrt(x * x + (y + 0.35) * (y + 0.35))) * (0.4 - z * 1.5);

      return head - chin - forehead - cheek - nose + eyes + brow + mouth;
    }

    // ---- Generate Particle Matrix ----
    const density = Math.floor(48000 * particleDensity); // Dense matrix
    const positions = new Float32Array(density * 3);
    const basePositions = new Float32Array(density * 3);
    const colors = new Float32Array(density * 3);
    const sizes = new Float32Array(density);
    const phases = new Float32Array(density);
    const faceWeights = new Float32Array(density); // How "inside" the face each particle is
    const normals = new Float32Array(density * 3); // Surface normals for lighting
    const rippleSeeds = new Float32Array(density); // Per-particle ripple variation

    const tempVec = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();

    let validCount = 0;
    const attempts = density * 4; // Oversample to fill face volume

    for (let i = 0, attempt = 0; i < density && attempt < attempts; attempt++) {
      // Sample in a bounding box around the face
      const x = (Math.random() - 0.5) * 2.8;
      const y = (Math.random() - 0.5) * 3.0;
      const z = (Math.random() - 0.5) * 2.0 - 0.3; // Bias toward front

      tempVec.set(x, y, z);
      const d = faceSDF(tempVec);

      // Accept particles near the surface (thin shell) + some interior
      const shellThickness = 0.18;
      if (Math.abs(d) < shellThickness || (d < 0 && Math.random() < 0.15)) {
        const idx = validCount * 3;
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
        basePositions[idx] = x;
        basePositions[idx + 1] = y;
        basePositions[idx + 2] = z;

        // Compute surface normal via gradient
        const eps = 0.008;
        const nx = faceSDF(new THREE.Vector3(x + eps, y, z)) - faceSDF(new THREE.Vector3(x - eps, y, z));
        const ny = faceSDF(new THREE.Vector3(x, y + eps, z)) - faceSDF(new THREE.Vector3(x, y - eps, z));
        const nz = faceSDF(new THREE.Vector3(x, y, z + eps)) - faceSDF(new THREE.Vector3(x, y, z - eps));
        tempNormal.set(nx, ny, nz).normalize();
        normals[idx] = tempNormal.x;
        normals[idx + 1] = tempNormal.y;
        normals[idx + 2] = tempNormal.z;

        // Face weight: 1 = on surface, 0 = outside, <0 = inside
        faceWeights[validCount] = 1.0 - Math.abs(d) / shellThickness;

        // Color by depth/feature
        const depth = Math.max(0, -d) / shellThickness;
        const feature = Math.abs(y + 0.35) < 0.08 || Math.abs(y - 0.18) < 0.08 || Math.abs(x) > 0.4 ? 1.0 : 0.0;
        const color = ELECTRIC_LIME.clone().lerp(LIME_BRIGHT, depth * 0.5 + feature * 0.3);
        colors[idx] = color.r;
        colors[idx + 1] = color.g;
        colors[idx + 2] = color.b;

        sizes[validCount] = 0.8 + Math.random() * 0.6 + depth * 0.4;
        phases[validCount] = Math.random() * Math.PI * 2;
        rippleSeeds[validCount] = Math.random() * 100;

        validCount++;
      }
    }

    // Trim arrays to actual count
    const finalCount = validCount;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions.slice(0, finalCount * 3), 3));
    geometry.setAttribute("aBasePos", new THREE.BufferAttribute(basePositions.slice(0, finalCount * 3), 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors.slice(0, finalCount * 3), 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes.slice(0, finalCount), 1));
    geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases.slice(0, finalCount), 1));
    geometry.setAttribute("aFaceWeight", new THREE.BufferAttribute(faceWeights.slice(0, finalCount), 1));
    geometry.setAttribute("aNormal", new THREE.BufferAttribute(normals.slice(0, finalCount * 3), 3));
    geometry.setAttribute("aRippleSeed", new THREE.BufferAttribute(rippleSeeds.slice(0, finalCount), 1));

    // ---- Shaders ----
    const VERTEX_SHADER = `
      uniform float uTime;
      uniform vec2 uPointer;
      uniform float uPointerInfluence;
      uniform float uPointerSpeed;
      uniform float uAspect;
      uniform float uAutoAnim;
      uniform float uScanLine;
      uniform float uScanIntensity;
      uniform vec3 uCameraPos;
      uniform mat4 uViewMatrix;
      uniform mat4 uProjMatrix;
      uniform mat4 uModelMatrix;

      attribute vec3 aBasePos;
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      attribute float aFaceWeight;
      attribute vec3 aNormal;
      attribute float aRippleSeed;

      varying vec3 vColor;
      varying float vAlpha;
      varying float vFaceWeight;
      varying float vScanGlow;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying float vRippleAmount;

      // Hash for pseudo-random
      float hash(float n) {
        return fract(sin(n * 43758.5453) * 62831.853);
      }

      vec3 computeRipple(vec3 pos, float phase, float seed, float time) {
        // Multi-octave sine ripple across face surface
        float ripple = 0.0;
        ripple += sin(pos.x * 8.0 + time * 3.5 + phase + seed) * 0.015;
        ripple += sin(pos.y * 6.0 - time * 2.8 + phase * 1.3 + seed * 1.7) * 0.012;
        ripple += sin((pos.x + pos.y) * 5.0 + time * 2.0 + seed * 2.3) * 0.008;
        ripple += sin(pos.z * 12.0 + time * 4.0 + seed * 0.9) * 0.006;
        // Faster ripple propagation
        return vec3(0.0, 0.0, ripple);
      }

      void main() {
        vec3 pos = aBasePos;
        vec3 nrm = normalize(aNormal);

        // Continuous sine ripple animation (2x speed)
        vec3 rippleOffset = computeRipple(pos, aPhase, aRippleSeed, uTime);
        pos += rippleOffset * aFaceWeight * (1.0 + uAutoAnim * 0.5);
        float rippleMag = length(rippleOffset);

        // Biometric scan line effect
        float scanDist = abs(pos.y - uScanLine);
        float scanGlow = exp(-scanDist * scanDist / 0.008) * uScanIntensity * aFaceWeight;
        // Scan pushes particles slightly forward
        pos.z += scanGlow * 0.05;

        // Cursor repulsion / ripple physics
        vec2 pointerWorld = uPointer * vec2(uAspect, 1.0) * 4.0;
        float d = length(pointerWorld - pos.xy);
        float repulseRadius = 0.65;
        float repulse = 0.0;
        if (d < repulseRadius && uPointerInfluence > 0.1) {
          float falloff = 1.0 - smoothstep(0.0, repulseRadius, d);
          repulse = falloff * falloff * uPointerInfluence * 0.35;
          vec2 dir = normalize(pos.xy - pointerWorld);
          pos.xy += dir * repulse * (1.0 + uPointerSpeed * 0.5);
          // Add ripple wave from cursor
          rippleMag += falloff * uPointerInfluence * 0.02;
        }

        vec4 mvPosition = uViewMatrix * uModelMatrix * vec4(pos, 1.0);
        vec4 worldPosition = uModelMatrix * vec4(pos, 1.0);

        vWorldPos = worldPosition.xyz;
        vWorldNormal = normalize((uModelMatrix * vec4(nrm, 0.0)).xyz);
        vFaceWeight = aFaceWeight;
        vScanGlow = scanGlow;
        vRippleAmount = rippleMag;

        float size = aSize * (12.0 / max(-mvPosition.z, 0.1));
        gl_PointSize = clamp(size * (1.0 + vScanGlow * 0.8 + uAutoAnim * 0.2), 1.2, 4.0);
        gl_Position = uProjMatrix * mvPosition;

        // Color with scan glow
        vec3 finalColor = mix(aColor, WHITE_HOT, scanGlow * 0.7);
        finalColor = mix(finalColor, CYAN_GLOW, scanGlow * 0.3);
        vColor = finalColor;

        // Alpha: face weight + scan + auto pulse
        float pulse = 0.6 + 0.4 * sin(uTime * 2.5 + aPhase * 2.5) + uAutoAnim * 0.2;
        vAlpha = aFaceWeight * (0.7 + 0.3 * pulse) + scanGlow * 1.2;
      }
    `;

    const FRAGMENT_SHADER = `
      varying vec3 vColor;
      varying float vAlpha;
      varying float vFaceWeight;
      varying float vScanGlow;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPos;
      varying float vRippleAmount;

      void main() {
        float dist = length(gl_PointCoord - 0.5);
        // Sharper core for dotted look
        float core = 1.0 - smoothstep(0.02, 0.45, dist);
        float alpha = vAlpha * pow(core, 1.6);

        // Subtle rim highlight on facing particles
        vec3 viewDir = normalize(vec3(0.0, 0.0, 4.5) - vWorldPos);
        float facing = max(dot(vWorldNormal, viewDir), 0.0);
        float rim = pow(facing, 8.0) * vFaceWeight * 0.3;

        if (alpha < 0.01) discard;

        vec3 finalColor = vColor;
        // Add subtle rim
        finalColor += vec3(0.0, 1.0, 0.53) * rim;
        // Scan glow bloom
        finalColor += vec3(1.0, 1.0, 1.0) * vScanGlow * 0.4;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uPointerInfluence: { value: 0 },
        uPointerSpeed: { value: 0 },
        uAspect: { value: width / height },
        uAutoAnim: { value: 0 },
        uScanLine: { value: 1.0 },
        uScanIntensity: { value: 0 },
        uCameraPos: { value: new THREE.Vector3(0, 0, 4.5) },
        uViewMatrix: { value: camera.matrixWorldInverse },
        uProjMatrix: { value: camera.projectionMatrix },
        uModelMatrix: { value: new THREE.Matrix4() },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const particles = new THREE.Points(geometry, material);
    particles.frustumCulled = false;
    scene.add(particles);

    // ---- Ambient subtle glow particles (background dust) ----
    const dustCount = Math.floor(3000 * particleDensity);
    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustBasePositions = new Float32Array(dustCount * 3);
    const dustColors = new Float32Array(dustCount * 3);
    const dustSizes = new Float32Array(dustCount);
    const dustPhases = new Float32Array(dustCount);

    for (let i = 0; i < dustCount; i++) {
      const x = (Math.random() - 0.5) * 4.0;
      const y = (Math.random() - 0.5) * 3.5;
      const z = -1.0 - Math.random() * 3.0;

      dustPositions[i * 3] = x;
      dustPositions[i * 3 + 1] = y;
      dustPositions[i * 3 + 2] = z;
      dustBasePositions[i * 3] = x;
      dustBasePositions[i * 3 + 1] = y;
      dustBasePositions[i * 3 + 2] = z;

      const r = Math.random();
      const color = r < 0.5 ? ELECTRIC_LIME.clone() : CYAN_GLOW.clone();
      color.multiplyScalar(0.3 + Math.random() * 0.2);
      dustColors[i * 3] = color.r;
      dustColors[i * 3 + 1] = color.g;
      dustColors[i * 3 + 2] = color.b;

      dustSizes[i] = 0.3 + Math.random() * 0.4;
      dustPhases[i] = Math.random() * Math.PI * 2;
    }

    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    dustGeometry.setAttribute("aBasePos", new THREE.BufferAttribute(dustBasePositions, 3));
    dustGeometry.setAttribute("aColor", new THREE.BufferAttribute(dustColors, 3));
    dustGeometry.setAttribute("aSize", new THREE.BufferAttribute(dustSizes, 1));
    dustGeometry.setAttribute("aPhase", new THREE.BufferAttribute(dustPhases, 1));

    const dustMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        uniform float uTime;
        uniform vec2 uPointer;
        uniform float uPointerInfluence;
        uniform float uAspect;
        uniform float uAutoAnim;
        uniform mat4 uViewMatrix;
        uniform mat4 uProjMatrix;
        attribute vec3 aBasePos;
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec3 pos = aBasePos;
          pos.y += sin(uTime * 0.15 + aPhase) * 0.02;
          pos.x += cos(uTime * 0.1 + aPhase * 1.5) * 0.015;
          vec2 pointerWorld = uPointer * vec2(uAspect, 1.0) * 4.0;
          float d = length(pointerWorld - pos.xy);
          float magnetic = exp(-d * d / 1.5) * uPointerInfluence * 0.15;
          pos.x += (pointerWorld.x - pos.x) * magnetic * 0.05;
          pos.y += (pointerWorld.y - pos.y) * magnetic * 0.05;
          vec4 mvPosition = uViewMatrix * uProjMatrix * vec4(pos, 1.0);
          float size = aSize * (8.0 / max(-mvPosition.z, 0.1));
          gl_PointSize = clamp(size, 0.8, 2.5);
          gl_Position = uProjMatrix * uViewMatrix * vec4(pos, 1.0);
          vColor = aColor;
          vAlpha = 0.4 + 0.3 * sin(uTime * 1.2 + aPhase) + uAutoAnim * 0.15;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float dist = length(gl_PointCoord - 0.5);
          float core = 1.0 - smoothstep(0.05, 0.5, dist);
          float alpha = vAlpha * pow(core, 1.8);
          if (alpha < 0.008) discard;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      uniforms: {
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uPointerInfluence: { value: 0 },
        uAspect: { value: width / height },
        uAutoAnim: { value: 0 },
        uViewMatrix: { value: camera.matrixWorldInverse },
        uProjMatrix: { value: camera.projectionMatrix },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });

    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.frustumCulled = false;
    scene.add(dust);

    // ---- Animation State ----
    let time = 0;
    let autoAnim = 0;
    let scanLine = 1.0;
    let scanDirection = -1;
    let scanIntensity = 0;

    // Orbit controls (drag to rotate)
    let targetRotationX = 0;
    let targetRotationY = 0;
    let currentRotationX = 0;
    let currentRotationY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    // Model matrix for orbit
    const modelMatrix = new THREE.Matrix4();
    const modelQuaternion = new THREE.Quaternion();

    const updateModelMatrix = () => {
      modelMatrix.makeRotationFromQuaternion(modelQuaternion);
      material.uniforms.uModelMatrix.value.copy(modelMatrix);
    };

    const animate = () => {
      if (!visible || prefersReduced) return;

      time += 0.016 * 2.0; // 2x speed
      autoAnim = Math.min(autoAnim + 0.0008, 1);

      // Biometric scan line sweep (continuous)
      scanLine += scanDirection * 0.008 * 2.0; // 2x speed
      if (scanLine > 1.0) {
        scanLine = 1.0;
        scanDirection = -1;
        scanIntensity = 1.0;
      } else if (scanLine < -1.0) {
        scanLine = -1.0;
        scanDirection = 1;
        scanIntensity = 1.0;
      } else {
        scanIntensity *= 0.96;
      }

      // Orbit physics with damping
      if (!isDragging) {
        velocityX *= 0.94;
        velocityY *= 0.94;
        targetRotationX += velocityX;
        targetRotationY += velocityY;
      }

      // Smooth toward target
      currentRotationX += (targetRotationX - currentRotationX) * 0.08;
      currentRotationY += (targetRotationY - currentRotationY) * 0.08;

      // Apply rotation (Y then X for natural orbit)
      modelQuaternion.setFromEuler(new THREE.Euler(currentRotationX, currentRotationY, 0, "YXZ"));
      updateModelMatrix();

      // Update uniforms
      material.uniforms.uTime.value = time;
      material.uniforms.uAutoAnim.value = autoAnim;
      material.uniforms.uScanLine.value = scanLine;
      material.uniforms.uScanIntensity.value = scanIntensity;

      dustMaterial.uniforms.uTime.value = time;
      dustMaterial.uniforms.uAutoAnim.value = autoAnim;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    // ---- Pointer Interaction ----
    let pointerX = 0;
    let pointerY = 0;
    let pointerInfluence = 0;
    let pointerVelocity = 0;
    let pointerActive = false;
    const targetPointer = { x: 0, y: 0 };

    const onPointerMove = (event: PointerEvent) => {
      const w = Math.max(window.innerWidth, 1);
      const h = Math.max(window.innerHeight, 1);
      targetPointer.x = (event.clientX / w - 0.5) * 2;
      targetPointer.y = (event.clientY / h - 0.5) * -2;

      const dx = event.clientX - lastMouseX;
      const dy = event.clientY - lastMouseY;
      pointerVelocity = Math.min(Math.hypot(dx, dy) / 20, 1.5);
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;

      if (isDragging) {
        velocityY += dx * 0.004;
        velocityX -= dy * 0.004;
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      isDragging = true;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
      container.style.cursor = "grabbing";
      event.preventDefault();
    };

    const onPointerUp = () => {
      isDragging = false;
      container.style.cursor = "";
    };

    const onPointerLeave = () => {
      pointerActive = false;
      pointerVelocity = 0;
      targetPointer.x = 0;
      targetPointer.y = 0;
      isDragging = false;
      container.style.cursor = "";
    };

    const pointerSmoother = () => {
      pointerX += (targetPointer.x - pointerX) * 0.06;
      pointerY += (targetPointer.y - pointerY) * 0.06;
      pointerInfluence += ((pointerActive ? 1 : 0) - pointerInfluence) * 0.06;
      pointerVelocity *= 0.85;

      material.uniforms.uPointer.value.set(pointerX, pointerY);
      material.uniforms.uPointerInfluence.value = pointerInfluence;
      material.uniforms.uPointerSpeed.value = pointerVelocity;

      dustMaterial.uniforms.uPointer.value.set(pointerX, pointerY);
      dustMaterial.uniforms.uPointerInfluence.value = pointerInfluence;

      requestAnimationFrame(pointerSmoother);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: false });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });

    pointerSmoother();

    // Resize
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      material.uniforms.uAspect.value = w / h;
      material.uniforms.uProjMatrix.value.copy(camera.projectionMatrix);
      material.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);
      dustMaterial.uniforms.uAspect.value = w / h;
      dustMaterial.uniforms.uProjMatrix.value.copy(camera.projectionMatrix);
      dustMaterial.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse);
    };
    window.addEventListener("resize", handleResize);

    // Visibility
    const handleVisibility = () => {
      setVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // WebGL context lost
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglSupported(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

    // Start animation
    if (!prefersReduced) requestAnimationFrame(animate);
    else renderer.render(scene, camera);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.dispose();
      geometry.dispose();
      dustGeometry.dispose();
      material.dispose();
      dustMaterial.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [prefersReduced, visible, webglSupported]);

  // Fallback for reduced motion / no WebGL
  if (prefersReduced || !webglSupported) {
    return (
      <div
        ref={mountRef}
        className={`relative aspect-[4/3] w-full ${className}`}
        aria-hidden="true"
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,255,136,0.06) 0%, rgba(5,6,8,0) 70%)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-3/4 h-3/4 opacity-30"
            viewBox="0 0 300 300"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="limeGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00ff88" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#00ff88" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Face outline from particles */}
            <circle cx="150" cy="150" r="110" stroke="url(#limeGrad)" strokeWidth="1.5" fill="none" opacity="0.4" />
            <ellipse cx="150" cy="120" rx="50" ry="30" stroke="#00ff88" strokeWidth="0.8" fill="none" opacity="0.3" strokeDasharray="4 6" />
            <ellipse cx="115" cy="115" rx="12" ry="8" stroke="#00ff88" strokeWidth="0.6" fill="none" opacity="0.25" />
            <ellipse cx="185" cy="115" rx="12" ry="8" stroke="#00ff88" strokeWidth="0.6" fill="none" opacity="0.25" />
            <path d="M130 165 Q150 175 170 165" stroke="#00ff88" strokeWidth="0.6" fill="none" opacity="0.25" />
            {/* Scan line */}
            <line x1="60" y1="150" x2="240" y2="150" stroke="#00ff88" strokeWidth="1.5" opacity="0.4" strokeDasharray="8 4" />
            {/* Dotted matrix hint */}
            <g stroke="#00ff88" strokeWidth="0.5" opacity="0.15">
              {Array.from({ length: 30 }).map((_, i) => (
                <circle
                  key={i}
                  cx={50 + (i % 10) * 20}
                  cy={50 + Math.floor(i / 10) * 20}
                  r={1.5}
                />
              ))}
            </g>
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className={`relative aspect-[4/3] w-full ${className}`}
      aria-hidden="true"
      style={{ background: "transparent", cursor: "grab" }}
    />
  );
}