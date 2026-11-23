# DeepForge Frontend UI/UX Upgrades - Task Tracker

## Tasks

### 1. Add Fine Pinpoint Dust Particle Layer to AxonParticleField.tsx
- [x] Add new fine dust particle system with THREE.Points
- [x] Small gl_PointSize (1.0-2.5px), tight radial falloff
- [x] Drift along ribbon edges
- [x] Respect prefers-reduced-motion
- [x] Pause on visibilitychange and IntersectionObserver (rootMargin 80px)
- [x] Mobile density scaling (width < 640 → density 0.5)
- [x] Clean Three.js disposal on unmount
- [x] Use NormalBlending for sharp pinpoints

### 2. Refine Glass Tokens in index.css
- [x] Strengthen backdrop blur (backdrop-blur-xl)
- [x] Adjust fill: rgba(10,14,24,0.44)
- [x] Adjust borders: rgba(148,163,184,0.18)
- [x] Add top specular highlight
- [x] Ensure high-contrast readability over bright ribbon folds

### 3. Update Layout.tsx Badge/Control Contrast
- [x] Ensure zero clipping/overlap on top-right cluster (Detect/Shield, API, Multimodal)
- [x] Fix status badges (ONLINE, EXPERIMENTAL, AVAILABLE) readability

### 4. Make PipelineRow Interactive in Home.tsx
- [x] Wrap with Link to analysis route
- [x] Add keyboard focus support
- [x] Add hover/focus detail tooltip with route/status/scope

### 5. Enhance UploadZone in Analysis Pages
- [x] Add drag-drop visual feedback
- [x] Add SHA-256 copy button with "Copied ✓" toast feedback
- [x] Show pipeline stepper during analysis phase
- [x] Apply to Analyze.tsx, VideoAnalysis.tsx, AudioAnalysis.tsx

### 6. Verification
- [x] Run `npx tsc --noEmit` - zero errors
- [x] Run `npm run build` - zero errors
- [ ] Visual verification on dev server

---

## Progress Log

**Started:** 2026-11-23
**Current Task:** 1 - Fine Pinpoint Dust Particle Layer