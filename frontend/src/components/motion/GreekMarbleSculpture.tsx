"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * GreekMarbleSculpture — Classical marble face sculpture with subsurface scattering,
 * dramatic rim lighting, and electric lime accent highlights.
 * Purely decorative — no external dependencies beyond Three.js.
 */
export default function GreekMarbleSculpture({
  className = "",
}: {
  className?: string;
}) {
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

    // Camera - positioned for face view
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.2);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    // Colors
    const MARBLE_WHITE = new THREE.Color(0xf5f0e8);
    const MARBLE_WARM = new THREE.Color(0xe8dfd0);
    const MARBLE_VEIN = new THREE.Color(0xc8c0b0);
    const ELECTRIC_LIME = new THREE.Color(0x00ff88);
    const LIME_GLOW = new THREE.Color(0x33ff88);
    const GOLD_RIM = new THREE.Color(0xffd700);
    const WARM_WHITE = new THREE.Color(0xfffff0);
    const COOL_WHITE = new THREE.Color(0xe8f0ff);

    // Base head geometry - classical proportions
    const headGeometry = new THREE.SphereGeometry(1.0, 64, 48);

    // Morph to classical Greek face proportions
    const posAttr = headGeometry.getAttribute("position");
    const normalAttr = headGeometry.getAttribute("normal");
    const temp = new THREE.Vector3();
    const tempNormal = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      temp.fromBufferAttribute(posAttr, i);
      tempNormal.fromBufferAttribute(normalAttr, i);

      // Flatten front for face plane
      if (temp.z > 0.15) {
        const depth = temp.z;
        temp.z = 0.25 + depth * 0.45;
        temp.y *= 1.12;
        temp.x *= 1.08;
      }

      // Chin taper - classical V-shape
      if (temp.y < -0.45) {
        const chinFactor = Math.min((-temp.y - 0.45) / 0.55, 1);
        temp.x *= 1 - chinFactor * 0.35;
        temp.z *= 1 - chinFactor * 0.25;
      }

      // Forehead prominence
      if (temp.y > 0.55) {
        temp.z *= 1.08 + (temp.y - 0.55) * 0.3;
      }

      // Cheekbones - subtle classical definition
      if (temp.y > -0.1 && temp.y < 0.4 && Math.abs(temp.x) > 0.35) {
        temp.x *= 1.03;
        temp.z *= 1.02;
      }

      // Brow ridge - subtle
      if (temp.y > 0.25 && temp.y < 0.45 && temp.z > 0.3) {
        temp.z *= 1.03;
      }

      // Nose bridge - subtle classical straight nose
      if (temp.y > -0.15 && temp.y < 0.25 && Math.abs(temp.x) < 0.12 && temp.z > 0.35) {
        temp.z *= 1.06;
      }

      posAttr.setXYZ(i, temp.x, temp.y, temp.z);
    }
    headGeometry.computeVertexNormals();
    headGeometry.computeTangents();

    // Marble material with subsurface scattering simulation
    const marbleMaterial = new THREE.MeshPhysicalMaterial({
      color: MARBLE_WHITE,
      metalness: 0.0,
      roughness: 0.18,
      clearcoat: 0.4,
      clearcoatRoughness: 0.08,
      transmission: 0.12,
      thickness: 0.8,
      ior: 1.52,
      specularIntensity: 0.6,
      specularColor: WARM_WHITE,
      side: THREE.FrontSide,
      transparent: false,
      depthWrite: true,
    });

    // Vein/dirt detail map using vertex colors
    const veinColors = new Float32Array(posAttr.count * 3);
    for (let i = 0; i < posAttr.count; i++) {
      temp.fromBufferAttribute(posAttr, i);
      // Subtle veins based on position - darker in recesses
      const veinNoise = Math.sin(temp.x * 15) * Math.sin(temp.y * 12) * Math.sin(temp.z * 10);
      const depthFactor = Math.max(0, -tempNormal.z * 0.5 + temp.y * 0.1);
      const veinAmount = Math.max(0, veinNoise * 0.03 + depthFactor * 0.02);
      const veinColor = MARBLE_WHITE.clone().lerp(MARBLE_VEIN, veinAmount);
      veinColors[i * 3] = veinColor.r;
      veinColors[i * 3 + 1] = veinColor.g;
      veinColors[i * 3 + 2] = veinColor.b;
    }
    headGeometry.setAttribute("color", new THREE.BufferAttribute(veinColors, 3));
    marbleMaterial.vertexColors = true;

    const headMesh = new THREE.Mesh(headGeometry, marbleMaterial);
    scene.add(headMesh);

    // Electric lime accent - subtle rim highlights on key facial features
    // Create a thin shell for rim lighting
    const rimGeometry = headGeometry.clone();
    const rimPositions = rimGeometry.getAttribute("position");
    for (let i = 0; i < rimPositions.count; i++) {
      temp.fromBufferAttribute(rimPositions, i);
      tempNormal.fromBufferAttribute(rimGeometry.getAttribute("normal"), i);
      // Push out slightly along normal
      temp.addScaledVector(tempNormal, 0.008);
      rimPositions.setXYZ(i, temp.x, temp.y, temp.z);
    }
    rimGeometry.computeVertexNormals();

    const rimMaterial = new THREE.MeshPhysicalMaterial({
      color: ELECTRIC_LIME,
      metalness: 0.0,
      roughness: 0.1,
      transmission: 0.95,
      thickness: 0.02,
      ior: 1.33,
      specularIntensity: 1.0,
      specularColor: LIME_GLOW,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const rimMesh = new THREE.Mesh(rimGeometry, rimMaterial);
    headMesh.add(rimMesh);

    // Gold accent - subtle gilded details on brow/cheek
    const goldGeometry = new THREE.RingGeometry(0.35, 0.42, 32, 1, -Math.PI * 0.6, Math.PI * 1.2);
    const goldMaterial = new THREE.MeshPhysicalMaterial({
      color: GOLD_RIM,
      metalness: 0.9,
      roughness: 0.2,
      clearcoat: 0.8,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    const goldRing = new THREE.Mesh(goldGeometry, goldMaterial);
    goldRing.rotation.x = -Math.PI / 2;
    goldRing.position.y = 0.32;
    goldRing.position.z = 0.58;
    headMesh.add(goldRing);

    // Lighting setup - classical museum lighting
    // Key light - warm, from upper left (classical window light)
    const keyLight = new THREE.DirectionalLight(WARM_WHITE, 1.8);
    keyLight.position.set(-2.5, 3, 2.5);
    scene.add(keyLight);

    // Fill light - cool, from right
    const fillLight = new THREE.DirectionalLight(COOL_WHITE, 0.6);
    fillLight.position.set(2, 1, 2);
    scene.add(fillLight);

    // Rim light - from behind, catches edges
    const rimLight = new THREE.DirectionalLight(WARM_WHITE, 1.2);
    rimLight.position.set(0, 1.5, -3);
    scene.add(rimLight);

    // Top light - subtle highlight on forehead/nose
    const topLight = new THREE.DirectionalLight(WARM_WHITE, 0.4);
    topLight.position.set(0, 4, 0);
    scene.add(topLight);

    // Ambient - very subtle
    const ambientLight = new THREE.AmbientLight(0x222018, 0.3);
    scene.add(ambientLight);

    // Electric lime accent light - subtle, animated
    const limeAccentLight = new THREE.PointLight(ELECTRIC_LIME, 0, 3, 2);
    limeAccentLight.position.set(1.5, 0.5, 1.5);
    scene.add(limeAccentLight);

    // Animation state
    let time = 0;
    let autoAnim = 0;
    let limePulse = 0;

    const animate = () => {
      if (!visible || prefersReduced) return;

      time += 0.008;
      autoAnim = Math.min(autoAnim + 0.0005, 1);
      limePulse += 0.006;

      // Very subtle slow rotation - contemplative
      headMesh.rotation.y = Math.sin(time * 0.04) * 0.08;
      headMesh.rotation.x = Math.sin(time * 0.03) * 0.03;

      // Breathing - extremely subtle
      const breathe = 1 + Math.sin(time * 0.35) * 0.003;
      headMesh.scale.setScalar(breathe);

      // Rim material pulse - electric lime glow
      const rimIntensity = 0.12 + Math.sin(limePulse * 1.2) * 0.06 + autoAnim * 0.08;
      rimMaterial.opacity = rimIntensity;
      rimMaterial.emissive = new THREE.Color(ELECTRIC_LIME).multiplyScalar(rimIntensity * 2);

      // Gold ring pulse
      const goldIntensity = 0.15 + Math.sin(limePulse * 0.8 + 1.5) * 0.08 + autoAnim * 0.1;
      goldMaterial.opacity = goldIntensity;
      goldMaterial.emissive = new THREE.Color(GOLD_RIM).multiplyScalar(goldIntensity * 1.5);
      goldRing.rotation.z = Math.sin(time * 0.02) * 0.02;

      // Lime accent light pulse
      limeAccentLight.intensity = 0.8 + Math.sin(limePulse * 1.5) * 0.4 + autoAnim * 0.6;
      limeAccentLight.position.x = 1.5 + Math.sin(time * 0.07) * 0.3;
      limeAccentLight.position.y = 0.5 + Math.cos(time * 0.05) * 0.2;

      // Marble material subtle warmth shift
      const warmthShift = Math.sin(time * 0.15) * 0.015;
      marbleMaterial.color.lerpColors(MARBLE_WHITE, MARBLE_WARM, 0.5 + warmthShift);

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

    // WebGL context lost
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglSupported(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.dispose();
      headGeometry.dispose();
      rimGeometry.dispose();
      goldGeometry.dispose();
      marbleMaterial.dispose();
      rimMaterial.dispose();
      goldMaterial.dispose();
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
          background: "radial-gradient(ellipse at center, rgba(245,240,232,0.12) 0%, rgba(5,6,8,0) 70%)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-3/4 h-3/4 opacity-25"
            viewBox="0 0 200 250"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            {/* Classical face silhouette */}
            <path
              d="M100 30 C140 30 165 65 165 105 C165 145 140 195 100 195 C60 195 35 145 35 105 C35 65 60 30 100 30 Z"
              stroke="#e8dfd0"
              strokeWidth="1.5"
              fill="none"
              opacity="0.4"
            />
            {/* Brow line */}
            <path
              d="M65 80 Q100 72 135 80"
              stroke="#c8c0b0"
              strokeWidth="1"
              fill="none"
              opacity="0.3"
            />
            {/* Eyes */}
            <ellipse cx="78" cy="82" rx="8" ry="5" stroke="#e8dfd0" strokeWidth="1" fill="none" opacity="0.3" />
            <ellipse cx="122" cy="82" rx="8" ry="5" stroke="#e8dfd0" strokeWidth="1" fill="none" opacity="0.3" />
            {/* Nose */}
            <path d="M100 90 Q98 110 100 115" stroke="#e8dfd0" strokeWidth="1" fill="none" opacity="0.3" />
            {/* Mouth */}
            <path d="M85 130 Q100 135 115 130" stroke="#e8dfd0" strokeWidth="1" fill="none" opacity="0.3" />
            {/* Electric lime accent - subtle highlight */}
            <path
              d="M70 75 Q100 65 130 75"
              stroke="#00ff88"
              strokeWidth="0.8"
              fill="none"
              opacity="0.25"
              strokeDasharray="8 12"
            />
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