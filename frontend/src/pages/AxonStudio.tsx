import { useEffect, useRef } from "react";
import * as THREE from "three";
import "./axon-studio.css";

const videos = [
  { title: "Lattices / zone", subtitle: "Ambient light / study", src: "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/oraciteslArea.mp4" },
  { title: "Prism / shell", subtitle: "Dispersion hero / render", src: "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/facet-glass-hero.mp4" },
  { title: "Nebular / loop", subtitle: "Procedural hero / sequence", src: "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/stellarmind-hero.mp4" },
  { title: "Fall / forward", subtitle: "Dolly track / study", src: "https://pub-86dc5b5484314368ac5436a674b0d919.r2.dev/aaaf/thedropthroughArea.mp4" },
];
const tags = ["All", "Light", "Physics", "Fluids", "Grid", "Audio", "Volumes", "Particles", "Capture", "Render"];

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: "high-performance" });
    } catch {
      const fallback = fallbackRef.current;
      const context = fallback?.getContext("2d");
      if (!fallback || !context) return;
      let frame = 0;
      let pointer = { x: 0, y: 0 };
      const dots = Array.from({ length: window.innerWidth < 760 ? 4200 : 12000 }, () => {
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * Math.PI * 2;
        const radius = 0.38 + 0.13 * Math.cos(v);
        return { u, v, r: radius, phase: Math.random() * Math.PI * 2, size: Math.random() * 1.15 + 0.35, tint: Math.random() > 0.992 };
      });
      const resizeFallback = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        fallback.width = window.innerWidth * dpr;
        fallback.height = window.innerHeight * dpr;
        context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      };
      const moveFallback = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY }; };
      const drawFallback = (time: number) => {
        const w = window.innerWidth, h = window.innerHeight;
        context!.clearRect(0, 0, w, h);
        const cx = w * (w < 760 ? 0.56 : 0.52), cy = h * 0.51;
        const sx = Math.min(w * (w < 760 ? 0.76 : 0.34), h * 0.46), sy = Math.min(h * 0.36, w * (w < 760 ? 0.62 : 0.27));
        for (const dot of dots) {
          const twist = dot.u + Math.sin(dot.v * 2 + time * 0.0002) * 0.2;
          const depth = Math.sin(dot.v + dot.u * 1.5 + time * 0.00015);
          const px = cx + Math.cos(twist) * dot.r * sx + Math.sin(dot.u * 2 + dot.v) * sx * 0.08;
          const py = cy + Math.sin(twist) * dot.r * sy + Math.sin(dot.v) * sy * 0.13;
          const dx = pointer.x - px, dy = pointer.y - py;
          const force = Math.exp(-(dx * dx + dy * dy) / 28000);
          const drift = Math.sin(time * 0.001 + dot.phase) * 3 + force * 15;
          context!.fillStyle = dot.tint ? `rgba(170,136,255,${0.35 + (depth + 1) * 0.2})` : `rgba(220,220,230,${0.22 + (depth + 1) * 0.2})`;
          context!.beginPath();
          context!.arc(px - dx * force * 0.04, py - dy * force * 0.04 + drift, dot.size + force * 0.8, 0, Math.PI * 2);
          context!.fill();
        }
        frame = requestAnimationFrame(drawFallback);
      };
      resizeFallback();
      window.addEventListener("resize", resizeFallback);
      window.addEventListener("pointermove", moveFallback, { passive: true });
      frame = requestAnimationFrame(drawFallback);
      return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resizeFallback); window.removeEventListener("pointermove", moveFallback); };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);
    camera.position.set(-1.17, 0, 6);
    camera.lookAt(0, 0, 0);
    const group = new THREE.Group();
    group.position.set(0.343, 0.16, -1);
    group.rotation.set(THREE.MathUtils.degToRad(-28.4), THREE.MathUtils.degToRad(390), THREE.MathUtils.degToRad(4.92));
    group.scale.set(5, 5, 6);
    scene.add(group);
    const count = window.innerWidth < 760 ? 16384 : 65536;
    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 3);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * Math.PI * 2;
      const major = 0.45 + 0.11 * Math.sin(3 * u + 0.8 * Math.sin(2 * v));
      const minor = 0.09 + 0.035 * (0.5 + 0.5 * Math.sin(2 * u + v));
      const r = major + minor * Math.cos(v);
      const n = i * 3;
      seeds[n] = r * Math.cos(u) + 0.07 * Math.sin(2 * u + v);
      seeds[n + 1] = r * Math.sin(u) + 0.08 * Math.sin(3 * u) + minor * Math.sin(v);
      seeds[n + 2] = minor * Math.cos(v) * Math.sin(u * 1.5) + 0.1 * Math.sin(u * 2 + v);
      positions[n] = (Math.random() - 0.5) * 2;
      positions[n + 1] = (Math.random() - 0.5) * 2;
      positions[n + 2] = (Math.random() - 0.5) * 2;
      randoms[n] = Math.random(); randoms[n + 1] = Math.random(); randoms[n + 2] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aTarget", new THREE.BufferAttribute(seeds, 3));
    geometry.setAttribute("aRandom", new THREE.BufferAttribute(randoms, 3));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPointer: { value: new THREE.Vector2(0, 0) }, uDpr: { value: Math.min(window.devicePixelRatio || 1, 2) } },
      vertexShader: `attribute vec3 aTarget; attribute vec3 aRandom; uniform float uTime; uniform vec2 uPointer; uniform float uDpr; varying float vShade; void main(){ vec3 p=mix(position,aTarget,smoothstep(0.0,3.0,uTime)); float d=length(p.xy-uPointer*0.65); float force=exp(-d*d*2.2); vec2 away=normalize(p.xy-uPointer*0.65+vec2(0.0001)); p.xy+=away*force*0.22*sin(uTime*2.0+aRandom.y*12.0); p+=0.006*sin(uTime*0.6+aRandom*20.0); vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp((0.04*uDpr*200.0/-mv.z)*mix(0.5,1.0,aRandom.z),1.0,7.0); vShade=mix(0.14,0.8,pow(aRandom.z,14.0))+pow(aRandom.x,22.0)*0.65; }`,
      fragmentShader: `varying float vShade; void main(){ vec2 p=gl_PointCoord-0.5; float r=length(p); if(r>0.5) discard; float sphere=sqrt(max(0.0,1.0-r*2.0)); vec3 grey=vec3(vShade); vec3 lavender=vec3(0.60,0.45,1.0); vec3 color=mix(grey,lavender,smoothstep(0.77,0.96,vShade)); gl_FragColor=vec4(color*(0.72+0.5*sphere),0.9*(1.0-smoothstep(0.40,0.5,r))); }`,
    });
    const points = new THREE.Points(geometry, material);
    group.add(points);
    const pointer = new THREE.Vector2();
    let aimX = camera.position.x;
    let aimY = camera.position.y;
    let frame = 0;
    const resize = () => { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); material.uniforms.uDpr.value = Math.min(window.devicePixelRatio || 1, 2); };
    const move = (e: PointerEvent) => { pointer.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight * 2 - 1)); };
    window.addEventListener("resize", resize); window.addEventListener("pointermove", move, { passive: true }); resize();
    const clock = new THREE.Clock();
    const animate = () => { frame = requestAnimationFrame(animate); const time = clock.getElapsedTime(); material.uniforms.uTime.value = time; material.uniforms.uPointer.value.lerp(pointer, 0.08); aimX = -1.17 - pointer.x; aimY = pointer.y * 2; camera.position.x += (aimX-camera.position.x)*0.025; camera.position.y += (aimY-camera.position.y)*0.025; camera.lookAt(0,0,0); renderer.render(scene,camera); };
    animate();
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", resize); window.removeEventListener("pointermove", move); geometry.dispose(); material.dispose(); renderer.dispose(); };
  }, []);
  return <><canvas ref={canvasRef} className="axon-canvas" aria-hidden="true" /><canvas ref={fallbackRef} className="axon-canvas axon-fallback-canvas" aria-hidden="true" /></>;
}

function Mark() {
  return <svg className="axon-mark" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.5" fill="none" stroke="white" strokeWidth="1.6"/><path d="m20 7 2.15 10.85L33 20l-10.85 2.15L20 33l-2.15-10.85L7 20l10.85-2.15L20 7Z" fill="white"/><path d="m20 7 2.15 10.85L33 20l-10.85 2.15L20 33l-2.15-10.85L7 20l10.85-2.15L20 7Z" fill="white" transform="rotate(45 20 20)"/></svg>;
}

export default function AxonStudio() {
  return <main className="axon-page"><ParticleCanvas /><div className="axon-ui">
    <header className="axon-brand"><Mark/><div><strong>AXON</strong><span>Motion research</span></div></header>
    <div className="axon-counter" aria-label="7 studies">07</div>
    <nav className="axon-tags" aria-label="Study topics">{tags.map((tag,i)=><button className={i===0?"active":""} key={tag}>{tag}</button>)}</nav>
    <section className="axon-list" aria-label="Motion studies">{videos.map((video,i)=><article className="axon-card" key={video.title}><div className="axon-thumb"><video src={video.src} autoPlay muted loop playsInline preload="metadata" aria-label={`${video.title} motion study`} /></div><div className="axon-meta"><span>{video.title}<br/>{video.subtitle}</span><span>{String(i+1).padStart(2,"0")} / 04</span></div></article>)}</section>
    <div className="axon-about">
      <section><h2>[info]</h2><p>Studies are published as they are built and may not run on every device.</p></section>
      <section><h2>[aims]</h2><p>An open logbook of real-time rendering research: surfaces, fluids, fields, and the little tools we build to shape them.</p><p>It is here to keep the work in view and to give each new project a place to grow.</p></section>
      <section><h2>[exploring]</h2><ul><li>Signed surfaces</li><li>Cursor turbulence</li><li>Compute passes</li><li>Type in 3D space</li></ul></section>
      <section><h2>[connect]</h2><a href="#">Index <span>→ AXON</span></a><a href="mailto:hello@axonlab.dev">Mail <span>→ hello@axonlab.dev</span></a></section>
    </div>
  </div></main>;
}
