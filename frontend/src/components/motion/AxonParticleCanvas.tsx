import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function AxonParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
    } catch {
      const fallback = fallbackRef.current;
      const context = fallback?.getContext("2d");
      if (!fallback || !context) return;
      let frame = 0;
      let pointer = { x: 0, y: 0 };
      const dots = Array.from({ length: window.innerWidth < 760 ? 4200 : 12000 }, () => {
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;
        return { u, v, r: 0.38 + 0.13 * Math.cos(v), phase: Math.random() * Math.PI * 2, size: Math.random() * 1.15 + 0.35, tint: Math.random() > 0.992 };
      });
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        fallback.width = window.innerWidth * dpr;
        fallback.height = window.innerHeight * dpr;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      const move = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY }; };
      const draw = (time: number) => {
        const w = window.innerWidth, h = window.innerHeight;
        context.clearRect(0, 0, w, h);
        const cx = w * (w < 760 ? 0.56 : 0.52), cy = h * 0.51;
        const sx = Math.min(w * (w < 760 ? 0.76 : 0.34), h * 0.46), sy = Math.min(h * 0.36, w * (w < 760 ? 0.62 : 0.27));
        for (const dot of dots) {
          const twist = dot.u + Math.sin(dot.v * 2 + time * 0.0002) * 0.2;
          const depth = Math.sin(dot.v + dot.u * 1.5 + time * 0.00015);
          const x = cx + Math.cos(twist) * dot.r * sx + Math.sin(dot.u * 2 + dot.v) * sx * 0.08;
          const y = cy + Math.sin(twist) * dot.r * sy + Math.sin(dot.v) * sy * 0.13;
          const dx = pointer.x - x, dy = pointer.y - y;
          const force = Math.exp(-(dx * dx + dy * dy) / 28000);
          context.fillStyle = dot.tint ? `rgba(170,136,255,${0.35 + (depth + 1) * 0.2})` : `rgba(220,220,230,${0.22 + (depth + 1) * 0.2})`;
          context.beginPath();
          context.arc(x - dx * force * 0.04, y - dy * force * 0.04 + Math.sin(time * 0.001 + dot.phase) * 3 + force * 15, dot.size + force * 0.8, 0, Math.PI * 2);
          context.fill();
        }
        frame = requestAnimationFrame(draw);
      };
      resize();
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", move, { passive: true });
      frame = requestAnimationFrame(draw);
      return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); };
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
    camera.position.set(-1.17, 0, 6);
    const group = new THREE.Group();
    group.position.set(0.343, 0.16, -1);
    group.rotation.set(THREE.MathUtils.degToRad(-28.4), THREE.MathUtils.degToRad(390), THREE.MathUtils.degToRad(4.92));
    group.scale.set(5, 5, 6);
    scene.add(group);

    const count = window.innerWidth < 760 ? 16384 : 65536;
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 3);
    const targets = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * Math.PI * 2, v = Math.random() * Math.PI * 2;
      const major = 0.45 + 0.11 * Math.sin(3 * u + 0.8 * Math.sin(2 * v));
      const minor = 0.09 + 0.035 * (0.5 + 0.5 * Math.sin(2 * u + v));
      const radius = major + minor * Math.cos(v), n = i * 3;
      targets[n] = radius * Math.cos(u) + 0.07 * Math.sin(2 * u + v);
      targets[n + 1] = radius * Math.sin(u) + 0.08 * Math.sin(3 * u) + minor * Math.sin(v);
      targets[n + 2] = minor * Math.cos(v) * Math.sin(u * 1.5) + 0.1 * Math.sin(u * 2 + v);
      positions[n] = (Math.random() - 0.5) * 2; positions[n + 1] = (Math.random() - 0.5) * 2; positions[n + 2] = (Math.random() - 0.5) * 2;
      randoms[n] = Math.random(); randoms[n + 1] = Math.random(); randoms[n + 2] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aTarget", new THREE.BufferAttribute(targets, 3));
    geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 3));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPointer: { value: new THREE.Vector2() }, uDpr: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      vertexShader: `attribute vec3 aTarget; attribute vec3 aRandom; uniform float uTime; uniform vec2 uPointer; uniform float uDpr; varying float vShade; void main(){ vec3 p=mix(position,aTarget,smoothstep(0.0,3.0,uTime)); float d=length(p.xy-uPointer*0.65); float force=exp(-d*d*2.2); vec2 away=normalize(p.xy-uPointer*0.65+vec2(0.0001)); p.xy+=away*force*0.22*sin(uTime*2.0+aRandom.y*12.0); p+=0.006*sin(uTime*0.6+aRandom*20.0); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp((0.04*uDpr*200.0/-mv.z)*mix(0.5,1.0,aRandom.z),1.0,7.0); vShade=mix(0.14,0.8,pow(aRandom.z,14.0))+pow(aRandom.x,22.0)*0.65; }`,
      fragmentShader: `varying float vShade; void main(){ vec2 p=gl_PointCoord-0.5; float r=length(p); if(r>0.5) discard; float sphere=sqrt(max(0.0,1.0-r*2.0)); vec3 grey=vec3(vShade); vec3 lavender=vec3(0.60,0.45,1.0); vec3 color=mix(grey,lavender,smoothstep(0.77,0.96,vShade)); gl_FragColor=vec4(color*(0.72+0.5*sphere),0.9*(1.0-smoothstep(0.40,0.5,r))); }`,
    });
    group.add(new THREE.Points(geometry, material));
    const pointer = new THREE.Vector2();
    let frame = 0;
    const resize = () => { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); material.uniforms.uDpr.value = Math.min(window.devicePixelRatio || 1, 2); };
    const move = (event: PointerEvent) => pointer.set(event.clientX / window.innerWidth * 2 - 1, -(event.clientY / window.innerHeight * 2 - 1));
    window.addEventListener("resize", resize); window.addEventListener("pointermove", move, { passive: true }); resize();
    const clock = new THREE.Clock();
    const animate = () => { frame = requestAnimationFrame(animate); const time = clock.getElapsedTime(); material.uniforms.uTime.value = time; material.uniforms.uPointer.value.lerp(pointer, 0.08); camera.position.x += (-1.17 - pointer.x - camera.position.x) * 0.025; camera.position.y += (pointer.y * 2 - camera.position.y) * 0.025; camera.lookAt(0, 0, 0); renderer.render(scene, camera); };
    animate();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); geometry.dispose(); material.dispose(); renderer.dispose(); };
  }, []);

  return <div className="pointer-events-none absolute inset-0" aria-hidden="true"><canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" /><canvas ref={fallbackRef} className="absolute inset-0 block h-full w-full" /></div>;
}
