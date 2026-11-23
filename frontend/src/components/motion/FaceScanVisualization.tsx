"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * FaceScanVisualization — 3D face scanning mesh with wireframe overlay,
 * animated scan lines, and electric lime accent highlights.
 * Purely decorative — no external dependencies beyond Three.js.
 */
export default function FaceScanVisualization({
  className = "",
}: {
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [visible, setVisible] = useState(true);

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
    if (!mountRef.current || prefersReduced || !visible) return;

    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();

    // Camera - positioned for face view
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Electric lime color
    const ELECTRIC_LIME = new THREE.Color(0x00ff88);
    const CYAN = new THREE.Color(0x00ffff);
    const VIOLET = new THREE.Color(0xd8a0ff);

    // Head geometry - simplified face mesh
    const headGeometry = new THREE.SphereGeometry(1.0, 48, 36);
    
    // Morph to face-like shape
    const posAttr = headGeometry.getAttribute("position");
    const temp = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      temp.fromBufferAttribute(posAttr, i);
      // Flatten front for face
      if (temp.z > 0.2) {
        temp.z = 0.3 + temp.z * 0.5;
        temp.y *= 1.1;
        temp.x *= 1.05;
      }
      // Chin taper
      if (temp.y < -0.5) {
        temp.x *= 0.7;
        temp.z *= 0.8;
      }
      // Forehead
      if (temp.y > 0.6) {
        temp.z *= 1.15;
      }
      posAttr.setXYZ(i, temp.x, temp.y, temp.z);
    }
    headGeometry.computeVertexNormals();

    // Wireframe geometry
    const wireGeometry = new THREE.EdgesGeometry(headGeometry);

    // Face material - subtle glass-like
    const faceMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x0a0e14),
      metalness: 0.15,
      roughness: 0.25,
      transmission: 0.15,
      thickness: 0.3,
      clearcoat: 0.3,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });

    // Wireframe material - electric lime
    const wireMaterial = new THREE.LineBasicMaterial({
      color: ELECTRIC_LIME,
      transparent: true,
      opacity: 0.45,
      toneMapped: false,
    });

    // Scan line material
    const scanMaterial = new THREE.LineBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    });

    const headMesh = new THREE.Mesh(headGeometry, faceMaterial);
    const wireMesh = new THREE.LineSegments(wireGeometry, wireMaterial);
    headMesh.add(wireMesh);
    scene.add(headMesh);

    // Scan line ring
    const scanRingGeometry = new THREE.RingGeometry(0.95, 1.05, 64);
    const scanRing = new THREE.Mesh(scanRingGeometry, scanMaterial);
    scanRing.rotation.x = -Math.PI / 2;
    scanRing.position.y = -1.2;
    headMesh.add(scanRing);

    // Particle field around face
    const particleCount = 800;
    const particlesGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particlePhases = new Float32Array(particleCount);
    const particleSizes = new Float32Array(particleCount);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.3 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);

      particlePhases[i] = Math.random() * Math.PI * 2;
      particleSizes[i] = 0.8 + Math.random() * 1.2;

      const r = Math.random();
      const color = r < 0.5 ? ELECTRIC_LIME.clone() : r < 0.8 ? CYAN.clone() : VIOLET.clone();
      particleColors[i * 3] = color.r;
      particleColors[i * 3 + 1] = color.g;
      particleColors[i * 3 + 2] = color.b;
    }

    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particlesGeometry.setAttribute("aPhase", new THREE.BufferAttribute(particlePhases, 1));
    particlesGeometry.setAttribute("aSize", new THREE.BufferAttribute(particleSizes, 1));
    particlesGeometry.setAttribute("aColor", new THREE.BufferAttribute(particleColors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const particles = new THREE.Points(particlesGeometry, particleMaterial);
    scene.add(particles);

    // Subtle ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Key light - electric lime tint
    const keyLight = new THREE.DirectionalLight(ELECTRIC_LIME, 0.6);
    keyLight.position.set(2, 2, 3);
    scene.add(keyLight);

    // Rim light - cyan
    const rimLight = new THREE.DirectionalLight(CYAN, 0.35);
    rimLight.position.set(-2, 1, -2);
    scene.add(rimLight);

    // Fill light - violet
    const fillLight = new THREE.DirectionalLight(VIOLET, 0.2);
    fillLight.position.set(0, -1, 2);
    scene.add(fillLight);

    // Animation
    let time = 0;
    let scanPhase = -1.2;
    let autoAnim = 0;

    const animate = () => {
      if (!visible || prefersReduced) return;

      time += 0.01;
      autoAnim = Math.min(autoAnim + 0.0008, 1);
      scanPhase += 0.008;

      // Head subtle rotation
      headMesh.rotation.y = Math.sin(time * 0.15) * 0.15;
      headMesh.rotation.x = Math.sin(time * 0.1) * 0.08;

      // Breathing scale
      const breathe = 1 + Math.sin(time * 0.7) * 0.015;
      headMesh.scale.setScalar(breathe);

      // Wireframe pulse
      wireMaterial.opacity = 0.3 + Math.sin(time * 1.5) * 0.1 + autoAnim * 0.15;
      wireMaterial.color.set(ELECTRIC_LIME);

      // Face material pulse
      faceMaterial.opacity = 0.25 + Math.sin(time * 1.2) * 0.05 + autoAnim * 0.05;

      // Scan ring animation
      if (scanPhase > 1.0) {
        scanPhase = -1.2;
        scanMaterial.opacity = 0.85;
        scanRing.position.y = -1.2;
      } else {
        scanMaterial.opacity = Math.max(0, 0.85 - Math.abs(scanPhase) * 0.7);
        scanRing.position.y = -1.2 + (scanPhase + 1.2) * 2.2;
      }

      // Particles drift
      const particlePos = particles.geometry.getAttribute("position");
      const particlePhase = particles.geometry.getAttribute("aPhase");
      for (let i = 0; i < particleCount; i++) {
        const phase = particlePhase.getX(i);
        const idx = i * 3;
        particlePos.setX(idx, particlePos.getX(idx) + Math.sin(time * 0.3 + phase) * 0.0008);
        particlePos.setY(idx, particlePos.getY(idx) + Math.cos(time * 0.25 + phase * 1.3) * 0.0008);
        particlePos.setZ(idx, particlePos.getZ(idx) + Math.sin(time * 0.18 + phase * 0.9) * 0.0005);
      }
      particlePos.needsUpdate = true;

      // Particle material pulse
      particleMaterial.opacity = 0.5 + Math.sin(time * 2.0) * 0.15 + autoAnim * 0.15;
      particleMaterial.size = 0.022 + Math.sin(time * 1.8) * 0.004 + autoAnim * 0.005;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Visibility change
    const handleVisibility = () => {
      setVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.dispose();
      headGeometry.dispose();
      wireGeometry.dispose();
      scanRingGeometry.dispose();
      particlesGeometry.dispose();
      faceMaterial.dispose();
      wireMaterial.dispose();
      scanMaterial.dispose();
      particleMaterial.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [prefersReduced, visible]);

  // Fallback for reduced motion
  if (prefersReduced) {
    return (
      <div
        ref={mountRef}
        className={`relative aspect-[4/3] w-full ${className}`}
        aria-hidden="true"
        style={{
          background: "radial-gradient(ellipse at center, rgba(0,255,136,0.08) 0%, rgba(5,6,8,0) 70%)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-3/4 h-3/4 opacity-30"
            viewBox="0 0 200 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <ellipse cx="100" cy="100" rx="80" ry="100" stroke="#00ff88" strokeWidth="1.5" opacity="0.3" />
            <ellipse cx="100" cy="100" rx="60" ry="75" stroke="#00ffff" strokeWidth="1" opacity="0.2" />
            <ellipse cx="100" cy="100" rx="40" ry="50" stroke="#d8a0ff" strokeWidth="0.5" opacity="0.15" />
            <path d="M70 85 Q100 70 130 85" stroke="#00ff88" strokeWidth="1.5" fill="none" opacity="0.4" />
            <circle cx="80" cy="82" r="6" stroke="#00ff88" strokeWidth="1" fill="none" opacity="0.3" />
            <circle cx="120" cy="82" r="6" stroke="#00ff88" strokeWidth="1" fill="none" opacity="0.3" />
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
      style={{ background: "transparent" }}
    />
  );
}