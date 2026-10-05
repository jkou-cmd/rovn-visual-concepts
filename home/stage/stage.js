/* Layered stage: the engine from rovn-experiment-1/index.html, as an embeddable ES module.

   import { mountStage } from './stage.js';
   const stage = await mountStage(el, { sceneUrl: './scene.json', assetBase: './', maxDpr: 1.5, onReady });
   stage.setPointer(nx, ny)   // -1..1, x right, y UP (the app's convention); smoothed exactly as the app smooths its pointer
   stage.setPaused(bool)      // also pauses by itself while the container is offscreen (an ancestor's clip-path does not count)
   stage.setProgress(p)       // 0..1 scroll hook; currently a no-op
   stage.renderOnce()         // draw the current state without advancing time (e.g. while paused)
   stage.destroy()

   The host page provides an importmap for 'three' and 'three/addons/' (three r160).

   The GLSL, post passes, layer types and composition effects below are the app's code, unchanged except where
   marked "port:", and without the editor's slider definitions. What differs from the app:
   - One WebGL canvas instead of one per plane. Each plane renders and runs its post chain as before, ends in an
     8-bit target (what a plane's canvas backbuffer was) and is laid over the planes below it premultiplied
     source-over, which is what the browser did with the stacked canvases. Plane blend modes use the layer blend shader.
   - Sized from the container with a ResizeObserver, never the window. No window listeners: parallax comes only
     from setPointer(). The loop stops while paused or offscreen (IntersectionObserver).
   - Composition effects stay CSS/SVG filters on the stage element (ids are per instance); the stage clips the
     filters' overflow so nothing spills outside the container.
   - Draws nothing until every image and model has loaded; onReady fires once that first frame is on screen.
   - Skips work whose result is exactly nothing: a plane with no visible layer (and no vignette pass, the only
     pass that paints on an empty frame), and a mist at opacity 0. The picture is unchanged.
   - A model file used by several layers is fetched once.
   - ColorManagement is switched off globally on import, as in the app (hex colours are used as-is). */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
THREE.ColorManagement.enabled = false;   // hex colors are used as-is

/* ============================================================================
   GLSL
   ========================================================================== */
const GLSL = {};
GLSL.snoise = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*snoise(p); p=p*2.02+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
`;
GLSL.quadVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
GLSL.worldVert = /* glsl */`
varying vec3 vWorld; varying vec2 vUv; varying float vDepth;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vUv = uv;
  vec4 mv = viewMatrix * wp; vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`;
GLSL.fog = /* glsl */`
uniform vec3 uFogColor; uniform float uFogDensity, uFogStart;
float fogAmount(float depth){ return 1.0 - exp(-uFogDensity * max(0.0, depth - uFogStart)); }`;

/* ============================================================================
   Helpers
   ========================================================================== */
const col = (c) => new THREE.Color(c);
const lerp = (a, b, t) => a + (b - a) * t;
const uid = () => Math.random().toString(36).slice(2, 8);
const clone = (o) => JSON.parse(JSON.stringify(o));
const quadMaterial = (opts) => new THREE.ShaderMaterial({ ...opts, vertexShader: GLSL.quadVert, blending: THREE.NoBlending, depthTest: false, depthWrite: false });
const makeRT = (w, h, extra = {}) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...extra });
const LAYER_BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'add', 'subtract'];
const BLEND_ID = Object.fromEntries(LAYER_BLENDS.map((k, i) => [k, i]));
// Source-over compositing with a blend function, per the CSS compositing spec. Both inputs are premultiplied.
const blendMaterial = () => quadMaterial({ uniforms: { tBase: { value: null }, tSrc: { value: null }, uMode: { value: 0 }, uAmount: { value: 1 } },
  fragmentShader: /* glsl */`uniform sampler2D tBase, tSrc; uniform int uMode; uniform float uAmount; varying vec2 vUv;
    vec3 straight(vec4 c){ return c.rgb / max(c.a, 1e-4); }
    float dodge(float b, float s){ return s >= 1.0 ? 1.0 : min(1.0, b / (1.0 - s)); }
    float burn(float b, float s){ return s <= 0.0 ? 0.0 : 1.0 - min(1.0, (1.0 - b) / s); }
    float hard(float b, float s){ return s <= 0.5 ? 2.0 * b * s : 1.0 - 2.0 * (1.0 - b) * (1.0 - s); }
    float soft(float b, float s){ float d = b <= 0.25 ? ((16.0 * b - 12.0) * b + 4.0) * b : sqrt(b);
      return s <= 0.5 ? b - (1.0 - 2.0 * s) * b * (1.0 - b) : b + (2.0 * s - 1.0) * (d - b); }
    vec3 blend(vec3 b, vec3 s){
      if (uMode == 1) return b * s;
      if (uMode == 2) return b + s - b * s;
      if (uMode == 3) return vec3(hard(s.r, b.r), hard(s.g, b.g), hard(s.b, b.b));
      if (uMode == 4) return min(b, s);
      if (uMode == 5) return max(b, s);
      if (uMode == 6) return vec3(dodge(b.r, s.r), dodge(b.g, s.g), dodge(b.b, s.b));
      if (uMode == 7) return vec3(burn(b.r, s.r), burn(b.g, s.g), burn(b.b, s.b));
      if (uMode == 8) return vec3(hard(b.r, s.r), hard(b.g, s.g), hard(b.b, s.b));
      if (uMode == 9) return vec3(soft(b.r, s.r), soft(b.g, s.g), soft(b.b, s.b));
      if (uMode == 10) return abs(b - s);
      if (uMode == 11) return b + s - 2.0 * b * s;
      if (uMode == 12) return min(vec3(1.0), b + s);
      if (uMode == 13) return max(vec3(0.0), b + s - 1.0);
      return s;
    }
    void main(){
      vec4 B = texture2D(tBase, vUv), S = texture2D(tSrc, vUv);
      float ab = clamp(B.a, 0.0, 1.0), as = clamp(S.a, 0.0, 1.0) * uAmount;
      vec3 cb = straight(B), cs = straight(S);
      vec3 mixed = mix(cs, blend(cb, cs), ab);                       // the blend only applies where a backdrop exists
      gl_FragColor = vec4(as * mixed + (1.0 - as) * ab * cb, as + ab * (1.0 - as));
    }` });

/* ============================================================================
   Post passes — read their params from a config object every frame, so the
   editor can tweak them live. Buffers hold PREMULTIPLIED colour (that is what
   WebGL blending writes into a transparent target), and every pass keeps it
   that way; the canvas composites premultiplied too.
   ========================================================================== */
const PassTypes = {};

PassTypes.blur = {
  label: 'Depth blur',
  defaults: { near: 2, far: 8, depthNear: 8, depthFar: 16, bottom: 0 },
  create(cfg) {
    const tmp = makeRT(1, 1);
    const mat = quadMaterial({
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) },
        uRadNear: { value: 0 }, uRadFar: { value: 0 }, uDNear: { value: 0 }, uDFar: { value: 0 }, uBottom: { value: 0 }, uNear: { value: 0.1 }, uFar: { value: 100 }, uDpr: { value: 1 } },
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse, tDepth; uniform vec2 uTexel, uDir;
        uniform float uRadNear, uRadFar, uDNear, uDFar, uBottom, uNear, uFar, uDpr; varying vec2 vUv;
        float linDepth(float d){ float z = d*2.0-1.0; return (2.0*uNear*uFar)/(uFar+uNear-z*(uFar-uNear)); }
        void main(){
          float dist = linDepth(texture2D(tDepth, vUv).r);
          float rad = mix(uRadNear, uRadFar, smoothstep(uDNear, uDFar, dist));
          float b = 1.0 - vUv.y; rad += uBottom * b * b; rad *= uDpr;
          vec4 c0 = texture2D(tDiffuse, vUv);
          if (rad < 0.4) { gl_FragColor = c0; return; }
          vec2 stp = uDir * uTexel * (rad / 6.0);
          vec3 acc = vec3(0.0); float accA = 0.0, ws = 0.0;
          for (int i = -6; i <= 6; i++) { float fi = float(i); float w = exp(-0.5*(fi/3.0)*(fi/3.0));
            vec4 c = texture2D(tDiffuse, vUv + stp * fi); acc += c.rgb * w; accA += c.a * w; ws += w; }
          gl_FragColor = vec4(acc / ws, accA / ws);
        }` });
    return {
      setSize(w, h) { tmp.setSize(w, h); mat.uniforms.uTexel.value.set(1 / w, 1 / h); },
      render(chain, read, target, sceneRT) {
        const u = mat.uniforms, cam = chain.engine.camera;
        u.uRadNear.value = cfg.near; u.uRadFar.value = cfg.far; u.uDNear.value = cfg.depthNear; u.uDFar.value = cfg.depthFar; u.uBottom.value = cfg.bottom;
        u.tDepth.value = sceneRT.depthTexture; u.uNear.value = cam.near; u.uFar.value = cam.far; u.uDpr.value = chain.engine.dpr;
        u.tDiffuse.value = read.texture; u.uDir.value.set(1, 0); chain.draw(mat, tmp);
        u.tDiffuse.value = tmp.texture; u.uDir.value.set(0, 1); chain.draw(mat, target);
      },
      dispose() { tmp.dispose(); mat.dispose(); } };
  } };

PassTypes.bloom = {
  label: 'Bloom',
  defaults: { threshold: 0.8, soft: 0.15, strength: 0.5, radius: 24 },
  create(cfg) {
    const rtA = makeRT(1, 1), rtB = makeRT(1, 1), texel = new THREE.Vector2();
    const thr = quadMaterial({ uniforms: { tDiffuse: { value: null }, uThr: { value: 0 }, uSoft: { value: 0 } },
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform float uThr, uSoft; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 pm = c.rgb; float l = dot(pm, vec3(0.299, 0.587, 0.114));
          gl_FragColor = vec4(pm * smoothstep(uThr - uSoft, uThr + uSoft, l), 1.0); }` });
    const blur = quadMaterial({ uniforms: { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform vec2 uStep; varying vec2 vUv;
        void main(){ vec4 acc = vec4(0.0); float ws = 0.0;
          for (int i = -6; i <= 6; i++) { float fi = float(i); float w = exp(-0.5*(fi/3.0)*(fi/3.0)); acc += texture2D(tDiffuse, vUv + uStep * fi) * w; ws += w; }
          gl_FragColor = acc / ws; }` });
    const comp = quadMaterial({ uniforms: { tDiffuse: { value: null }, tBloom: { value: null }, uStrength: { value: 0 } },
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse, tBloom; uniform float uStrength; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 b = texture2D(tBloom, vUv).rgb * uStrength;
          float a = clamp(c.a + dot(b, vec3(0.299, 0.587, 0.114)), 0.0, 1.0); gl_FragColor = vec4(min(c.rgb + b, vec3(a)), a); }` });
    return {
      setSize(w, h) { const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1); rtA.setSize(hw, hh); rtB.setSize(hw, hh); texel.set(1 / hw, 1 / hh); },
      render(chain, read, target) {
        const r = (cfg.radius * chain.engine.dpr * 0.5) / 6.0;
        thr.uniforms.tDiffuse.value = read.texture; thr.uniforms.uThr.value = cfg.threshold; thr.uniforms.uSoft.value = cfg.soft; chain.draw(thr, rtA);
        for (let k = 1; k <= 2; k++) {
          blur.uniforms.tDiffuse.value = rtA.texture; blur.uniforms.uStep.value.set(texel.x * r * k, 0); chain.draw(blur, rtB);
          blur.uniforms.tDiffuse.value = rtB.texture; blur.uniforms.uStep.value.set(0, texel.y * r * k); chain.draw(blur, rtA);
        }
        comp.uniforms.tDiffuse.value = read.texture; comp.uniforms.tBloom.value = rtA.texture; comp.uniforms.uStrength.value = cfg.strength; chain.draw(comp, target);
      },
      dispose() { rtA.dispose(); rtB.dispose(); thr.dispose(); blur.dispose(); comp.dispose(); } };
  } };

// Photoshop "duplicate, blur, set to screen/lighten/overlay/soft light". Works on the whole frame, not only the bright parts.
PassTypes.glow = {
  label: 'Dreamy glow',
  defaults: { mode: 'screen', amount: 0.5, radius: 60 },
  create(cfg) {
    const rtA = makeRT(1, 1), rtB = makeRT(1, 1), texel = new THREE.Vector2(), MODES = { screen: 0, lighten: 1, overlay: 2, softlight: 3 };
    const copy = quadMaterial({ uniforms: { tDiffuse: { value: null } }, fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }` });
    const blur = quadMaterial({ uniforms: { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform vec2 uStep; varying vec2 vUv;
        void main(){ vec4 acc = vec4(0.0); float ws = 0.0;
          for (int i = -6; i <= 6; i++) { float fi = float(i); float w = exp(-0.5*(fi/3.0)*(fi/3.0)); acc += texture2D(tDiffuse, vUv + uStep * fi) * w; ws += w; }
          gl_FragColor = acc / ws; }` });
    const comp = quadMaterial({ uniforms: { tDiffuse: { value: null }, tBlur: { value: null }, uAmount: { value: 0 }, uMode: { value: 0 } },
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse, tBlur; uniform float uAmount; uniform int uMode; varying vec2 vUv;
        void main(){ vec4 c = texture2D(tDiffuse, vUv); vec4 b = texture2D(tBlur, vUv);   // both premultiplied
          if (uMode == 0) { vec4 k = b * uAmount; gl_FragColor = c + k - c * k; return; }             // screen: haze spreads past the edges
          if (uMode == 1) { gl_FragColor = max(c, b * uAmount); return; }                           // lighten
          vec3 cs = c.rgb / max(c.a, 1e-4), bs = b.rgb / max(b.a, 1e-4), r;
          if (uMode == 2) r = mix(2.0 * cs * bs, 1.0 - 2.0 * (1.0 - cs) * (1.0 - bs), step(0.5, cs));                       // overlay
          else r = mix(cs - (1.0 - 2.0 * bs) * cs * (1.0 - cs), cs + (2.0 * bs - 1.0) * (sqrt(cs) - cs), step(0.5, bs));   // soft light
          gl_FragColor = vec4(mix(cs, r, uAmount * b.a) * c.a, c.a); }` });
    return {
      setSize(w, h) { const hw = Math.max(1, w >> 1), hh = Math.max(1, h >> 1); rtA.setSize(hw, hh); rtB.setSize(hw, hh); texel.set(1 / hw, 1 / hh); },
      render(chain, read, target) {
        const r = (cfg.radius * chain.engine.dpr * 0.5) / 6.0;
        copy.uniforms.tDiffuse.value = read.texture; chain.draw(copy, rtA);
        for (let k = 1; k <= 2; k++) {
          blur.uniforms.tDiffuse.value = rtA.texture; blur.uniforms.uStep.value.set(texel.x * r * k, 0); chain.draw(blur, rtB);
          blur.uniforms.tDiffuse.value = rtB.texture; blur.uniforms.uStep.value.set(0, texel.y * r * k); chain.draw(blur, rtA);
        }
        comp.uniforms.tDiffuse.value = read.texture; comp.uniforms.tBlur.value = rtA.texture; comp.uniforms.uAmount.value = cfg.amount; comp.uniforms.uMode.value = MODES[cfg.mode] ?? 0;
        chain.draw(comp, target);
      },
      dispose() { rtA.dispose(); rtB.dispose(); copy.dispose(); blur.dispose(); comp.dispose(); } };
  } };

/* ---- Single-shader passes. Frames are premultiplied: unpack to straight color, work, repack. ---- */
const PRE = /* glsl */`uniform sampler2D tDiffuse; varying vec2 vUv;
  vec3 straight(vec4 c){ return c.rgb / max(c.a, 1e-4); }
  float luma(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }`;
// Build a pass from one fragment shader. uniforms: extra uniform defs; update(u, cfg, chain) copies sliders in each frame.
function simplePass(label, defaults, uniforms, body, update) {
  return { label, defaults,
    create(cfg) {
      const mat = quadMaterial({ uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, ...uniforms() },
        fragmentShader: PRE + 'uniform vec2 uRes; uniform float uTime;' + body });
      return {
        setSize(w, h) { mat.uniforms.uRes.value.set(w, h); },
        render(chain, read, target) { mat.uniforms.tDiffuse.value = read.texture; mat.uniforms.uTime.value = chain.engine.time; update(mat.uniforms, cfg, chain); chain.draw(mat, target); },
        dispose() { mat.dispose(); } };
    } };
}

PassTypes.color = simplePass('Color grade',
  { exposure: 0, contrast: 0, saturation: 0, vibrance: 0, temperature: 0, tint: 0, gamma: 1, black: 0, white: 1 },
  () => ({ uExposure: { value: 0 }, uContrast: { value: 0 }, uSat: { value: 0 }, uVib: { value: 0 }, uTemp: { value: 0 }, uTint: { value: 0 }, uGamma: { value: 1 }, uBlack: { value: 0 }, uWhite: { value: 1 } }),
  /* glsl */`uniform float uExposure, uContrast, uSat, uVib, uTemp, uTint, uGamma, uBlack, uWhite;
  void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 s = straight(c);
    s = (s - uBlack) / max(0.001, uWhite - uBlack);
    s *= exp2(uExposure);
    s += vec3(uTemp, uTint, -uTemp) * 0.08;
    s = mix(vec3(0.5), s, 1.0 + uContrast);
    float l = luma(s), sat = max(s.r, max(s.g, s.b)) - min(s.r, min(s.g, s.b));
    s = mix(vec3(l), s, 1.0 + uSat + uVib * (1.0 - clamp(sat, 0.0, 1.0)));
    s = pow(max(s, 0.0), vec3(1.0 / uGamma));
    gl_FragColor = vec4(s * c.a, c.a); }`,
  (u, c) => { u.uExposure.value = c.exposure; u.uContrast.value = c.contrast; u.uSat.value = c.saturation; u.uVib.value = c.vibrance; u.uTemp.value = c.temperature; u.uTint.value = c.tint; u.uGamma.value = c.gamma; u.uBlack.value = c.black; u.uWhite.value = c.white; });

PassTypes.tone = simplePass('Split toning',
  { shadows: '#3d4470', highlights: '#ffd8b4', balance: 0, amount: 0.5, keepLuma: 1 },
  () => ({ uShadows: { value: new THREE.Color() }, uHighlights: { value: new THREE.Color() }, uBalance: { value: 0 }, uAmount: { value: 0 }, uKeep: { value: 1 } }),
  /* glsl */`uniform vec3 uShadows, uHighlights; uniform float uBalance, uAmount, uKeep;
  void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 s = straight(c); float l = luma(s);
    float t = pow(clamp(l, 0.0, 1.0), exp2(-uBalance * 2.0));
    vec3 g = mix(uShadows, uHighlights, t);                      // gradient map
    g *= pow(l / max(luma(g), 0.001), uKeep);                     // keep the original brightness
    gl_FragColor = vec4(mix(s, g, uAmount) * c.a, c.a); }`,
  (u, c) => { u.uShadows.value.set(c.shadows); u.uHighlights.value.set(c.highlights); u.uBalance.value = c.balance; u.uAmount.value = c.amount; u.uKeep.value = c.keepLuma; });

PassTypes.ripple = simplePass('Glass ripple',
  { amount: 0.008, scale: 3, drift: 0.15, grain: 0.3 },
  () => ({ uAmount: { value: 0 }, uScale: { value: 1 }, uDrift: { value: 0 }, uGrain: { value: 0 } }),
  GLSL.snoise + /* glsl */`uniform float uAmount, uScale, uDrift, uGrain;
  void main(){ vec2 p = vUv * vec2(uRes.x / uRes.y, 1.0) * uScale; float t = uTime * uDrift;
    vec2 d = vec2(snoise(vec3(p, t)), snoise(vec3(p + 7.3, t + 3.1)));
    vec2 f = vec2(snoise(vec3(p * 9.0, t)), snoise(vec3(p * 9.0 + 2.0, t))) * uGrain;
    gl_FragColor = texture2D(tDiffuse, vUv + (d + f) * uAmount); }`,
  (u, c) => { u.uAmount.value = c.amount; u.uScale.value = c.scale; u.uDrift.value = c.drift; u.uGrain.value = c.grain; });

/* Frosted glass. Objects at the glass stay sharp; the further behind it, the softer. Five progressively
   blurred copies (each half the size of the last) give a large, smooth blur; depth picks the mix between them. */
PassTypes.frost = {
  label: 'Frosted glass',
  defaults: { amount: 0.8, near: 0, depthNear: 6, depthFar: 16, curve: 1, milk: 0.3, milkColor: '#e6e4ef', grain: 0.2 },
  create(cfg) {
    const N = 5, lv = []; for (let i = 1; i < N; i++) lv.push({ a: makeRT(1, 1), b: makeRT(1, 1), texel: new THREE.Vector2() });
    const copy = quadMaterial({ uniforms: { tDiffuse: { value: null } }, fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }` });
    const blur = quadMaterial({ uniforms: { tDiffuse: { value: null }, uStep: { value: new THREE.Vector2() } },
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform vec2 uStep; varying vec2 vUv;
        void main(){ vec4 acc = vec4(0.0); float ws = 0.0;
          for (int i = -4; i <= 4; i++) { float fi = float(i); float w = exp(-0.5 * (fi / 2.0) * (fi / 2.0)); acc += texture2D(tDiffuse, vUv + uStep * fi) * w; ws += w; }
          gl_FragColor = acc / ws; }` });
    const comp = quadMaterial({
      uniforms: { t0: { value: null }, t1: { value: null }, t2: { value: null }, t3: { value: null }, t4: { value: null }, tDepth: { value: null },
        uNear: { value: 0.1 }, uFar: { value: 100 }, uDNear: { value: 0 }, uDFar: { value: 1 }, uCurve: { value: 1 }, uAmt: { value: 0 }, uAmtNear: { value: 0 },
        uMilk: { value: 0 }, uMilkColor: { value: new THREE.Color() }, uGrain: { value: 0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
      fragmentShader: /* glsl */`uniform sampler2D t0, t1, t2, t3, t4, tDepth; uniform vec3 uMilkColor; uniform vec2 uRes;
        uniform float uNear, uFar, uDNear, uDFar, uCurve, uAmt, uAmtNear, uMilk, uGrain, uTime; varying vec2 vUv;
        float linDepth(float d){ float z = d * 2.0 - 1.0; return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear)); }
        vec4 level(int i, vec2 uv){ if (i <= 0) return texture2D(t0, uv); if (i == 1) return texture2D(t1, uv); if (i == 2) return texture2D(t2, uv); if (i == 3) return texture2D(t3, uv); return texture2D(t4, uv); }
        vec2 hash2(vec2 p){ return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
        void main(){
          float d = linDepth(texture2D(tDepth, vUv).r);
          float t = pow(smoothstep(uDNear, uDFar, d), uCurve);        // 0 at the glass, 1 fully behind it
          float amt = mix(uAmtNear, uAmt, t);
          vec2 jit = (hash2(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) * uGrain * amt * 8.0 / uRes;   // diffusion: the glass surface scatters
          float k = amt * 4.0; int i = int(floor(k));
          vec4 c = mix(level(i, vUv + jit), level(i + 1, vUv + jit), fract(k));
          c.rgb = mix(c.rgb, uMilkColor * c.a, uMilk * t);            // deep objects sink into the glass color
          gl_FragColor = c; }` });
    return {
      setSize(w, h) { lv.forEach((l, i) => { const s = 1 << (i + 1), lw = Math.max(1, w >> (i + 1)), lh = Math.max(1, h >> (i + 1)); l.a.setSize(lw, lh); l.b.setSize(lw, lh); l.texel.set(1 / lw, 1 / lh); }); comp.uniforms.uRes.value.set(w, h); },
      render(chain, read, target, sceneRT) {
        let src = read;
        for (const l of lv) {
          copy.uniforms.tDiffuse.value = src.texture; chain.draw(copy, l.a);                                   // downsample
          blur.uniforms.tDiffuse.value = l.a.texture; blur.uniforms.uStep.value.set(l.texel.x, 0); chain.draw(blur, l.b);
          blur.uniforms.tDiffuse.value = l.b.texture; blur.uniforms.uStep.value.set(0, l.texel.y); chain.draw(blur, l.a);
          src = l.a;
        }
        const u = comp.uniforms, cam = chain.engine.camera;
        u.t0.value = read.texture; lv.forEach((l, i) => (u['t' + (i + 1)].value = l.a.texture)); u.tDepth.value = sceneRT.depthTexture;
        u.uNear.value = cam.near; u.uFar.value = cam.far; u.uDNear.value = cfg.depthNear; u.uDFar.value = Math.max(cfg.depthFar, cfg.depthNear + 0.01); u.uCurve.value = cfg.curve;
        u.uAmt.value = cfg.amount; u.uAmtNear.value = cfg.near; u.uMilk.value = cfg.milk; u.uMilkColor.value.set(cfg.milkColor); u.uGrain.value = cfg.grain; u.uTime.value = chain.engine.time;
        chain.draw(comp, target);
      },
      dispose() { lv.forEach((l) => { l.a.dispose(); l.b.dispose(); }); copy.dispose(); blur.dispose(); comp.dispose(); } };
  } };

/* Ordered dither the way the Codrops guide does it: pixelate to a cell grid, threshold each cell's value with a
   recursive Bayer matrix, snap to a few levels. Duotone maps the result onto two colors. */
PassTypes.dither = simplePass('Dither',
  { pixel: 3, matrix: 8, levels: 2, mode: 'duotone', dark: '#1b1a2e', light: '#f2eee4', strength: 1, mix: 1 },
  () => ({ uPixel: { value: 3 }, uMatrix: { value: 8 }, uLevels: { value: 2 }, uMode: { value: 0 }, uDark: { value: new THREE.Color() }, uLight: { value: new THREE.Color() }, uStrength: { value: 1 }, uMix: { value: 1 } }),
  /* glsl */`uniform float uPixel, uLevels, uStrength, uMix; uniform int uMatrix, uMode; uniform vec3 uDark, uLight;
  float Bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
  float Bayer4(vec2 a){ return Bayer2(0.5 * a) * 0.25 + Bayer2(a); }
  float Bayer8(vec2 a){ return Bayer4(0.5 * a) * 0.25 + Bayer2(a); }
  float Bayer16(vec2 a){ return Bayer8(0.5 * a) * 0.25 + Bayer2(a); }
  float bayer(vec2 a){ if (uMatrix == 2) return Bayer2(a); if (uMatrix == 4) return Bayer4(a); if (uMatrix == 16) return Bayer16(a); return Bayer8(a); }
  float q(float v, float b){ float n = uLevels - 1.0; return clamp(floor(v * n + 0.5 + (b - 0.5) * uStrength), 0.0, n) / n; }
  void main(){
    vec2 cell = floor(gl_FragCoord.xy / uPixel);
    vec2 uv = (cell + 0.5) * uPixel / uRes;                                // one sample per cell
    vec4 c = texture2D(tDiffuse, uv); vec3 s = straight(c); float b = bayer(cell); vec3 o;
    if (uMode == 2) o = vec3(q(s.r, b), q(s.g, b), q(s.b, b));
    else { float l = q(luma(s), b); o = uMode == 0 ? mix(uDark, uLight, l) : vec3(l); }
    gl_FragColor = mix(texture2D(tDiffuse, vUv), vec4(o * c.a, c.a), uMix); }`,
  (u, c, chain) => { u.uPixel.value = Math.max(1, c.pixel) * chain.engine.dpr; u.uMatrix.value = c.matrix | 0; u.uLevels.value = Math.max(2, c.levels); u.uMode.value = { duotone: 0, mono: 1, rgb: 2 }[c.mode] ?? 0;
    u.uDark.value.set(c.dark); u.uLight.value.set(c.light); u.uStrength.value = c.strength; u.uMix.value = c.mix; });

PassTypes.radial = simplePass('Zoom blur',
  { amount: 0.1, x: 0.5, y: 0.5, mix: 1 },
  () => ({ uAmount: { value: 0 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uMix: { value: 1 } }),
  /* glsl */`uniform float uAmount, uMix; uniform vec2 uCenter;
  void main(){ vec2 dir = (vUv - uCenter) * uAmount; vec4 acc = vec4(0.0);
    for (int i = 0; i < 16; i++) acc += texture2D(tDiffuse, vUv - dir * (float(i) / 15.0));
    gl_FragColor = mix(texture2D(tDiffuse, vUv), acc / 16.0, uMix); }`,
  (u, c) => { u.uAmount.value = c.amount; u.uCenter.value.set(c.x, c.y); u.uMix.value = c.mix; });

PassTypes.aberration = simplePass('Chromatic aberration',
  { amount: 0.004, radial: 1 },
  () => ({ uAmount: { value: 0 }, uRadial: { value: 1 } }),
  /* glsl */`uniform float uAmount, uRadial;
  void main(){ vec2 q = vUv - 0.5; vec2 d = q * uAmount * mix(1.0, length(q) * 2.0, uRadial);
    vec4 r = texture2D(tDiffuse, vUv + d), g = texture2D(tDiffuse, vUv), b = texture2D(tDiffuse, vUv - d);
    gl_FragColor = vec4(r.r, g.g, b.b, max(r.a, max(g.a, b.a))); }`,
  (u, c) => { u.uAmount.value = c.amount; u.uRadial.value = c.radial; });

PassTypes.sharpen = simplePass('Sharpen',
  { amount: 0.5, radius: 1.5 },
  () => ({ uAmount: { value: 0 }, uRadius: { value: 1 } }),
  /* glsl */`uniform float uAmount, uRadius;
  void main(){ vec2 e = uRadius / uRes; vec4 c = texture2D(tDiffuse, vUv);
    vec4 b = (texture2D(tDiffuse, vUv + vec2(e.x, 0.0)) + texture2D(tDiffuse, vUv - vec2(e.x, 0.0)) + texture2D(tDiffuse, vUv + vec2(0.0, e.y)) + texture2D(tDiffuse, vUv - vec2(0.0, e.y))) * 0.25;
    vec4 o = c + (c - b) * uAmount; gl_FragColor = vec4(max(o.rgb, 0.0), c.a); }`,
  (u, c) => { u.uAmount.value = c.amount; u.uRadius.value = c.radius; });

PassTypes.vignette = simplePass('Vignette',
  { color: '#2b2f4a', amount: 0.5, size: 0.75, softness: 0.5, roundness: 1, x: 0.5, y: 0.5 },
  () => ({ uColor: { value: new THREE.Color() }, uAmount: { value: 0 }, uSize: { value: 1 }, uSoft: { value: 0.5 }, uRound: { value: 1 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) } }),
  /* glsl */`uniform vec3 uColor; uniform float uAmount, uSize, uSoft, uRound; uniform vec2 uCenter;
  void main(){ vec4 c = texture2D(tDiffuse, vUv);
    vec2 p = (vUv - uCenter) * vec2(mix(1.0, uRes.x / uRes.y, uRound), 1.0) * 2.0;
    float v = smoothstep(uSize * (1.0 - uSoft), uSize * (1.0 + uSoft), length(p)) * uAmount;
    gl_FragColor = vec4(c.rgb * (1.0 - v) + uColor * v, c.a * (1.0 - v) + v); }`,   // vignette color composited over the frame
  (u, c) => { u.uColor.value.set(c.color); u.uAmount.value = c.amount; u.uSize.value = c.size; u.uSoft.value = c.softness; u.uRound.value = c.roundness; u.uCenter.value.set(c.x, c.y); });

PassTypes.grain = {
  label: 'Grain & dither',
  defaults: { amount: 0.06, luma: 1, chroma: 0.5, shadow: 1, lift: 0, liftColor: '#ffffff', vignette: 0 },
  create(cfg) {
    const mat = quadMaterial({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0 }, uLuma: { value: 0 }, uChroma: { value: 0 }, uShadow: { value: 0 },
        uLift: { value: 0 }, uLiftColor: { value: new THREE.Color() }, uVignette: { value: 0 } },
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float uTime, uAmount, uLuma, uChroma, uShadow, uLift, uVignette; uniform vec3 uLiftColor; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
        float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
        void main(){
          vec4 c = texture2D(tDiffuse, vUv); vec3 rgb = c.rgb;
          float lum = c.a > 1e-4 ? dot(rgb / c.a, vec3(0.299, 0.587, 0.114)) : 1.0;
          vec2 s = gl_FragCoord.xy; vec2 t = vec2(fract(uTime * 13.7), fract(uTime * 7.1)) * 100.0;
          float n = hash(s + t) - 0.5; vec3 nc = vec3(hash(s + t + 1.0), hash(s + t + 2.0), hash(s + t + 3.0)) - 0.5;
          float amt = uAmount * (1.0 + uShadow * (1.0 - smoothstep(0.0, 0.6, lum)));
          rgb += ((n * uLuma + nc * uChroma) * amt + (bayer4(s) - 0.5) * (2.0 / 255.0)) * c.a;
          rgb = mix(rgb, uLiftColor * c.a, uLift);
          vec2 q = vUv - 0.5; rgb *= 1.0 - uVignette * dot(q, q) * 2.0;
          gl_FragColor = vec4(rgb, c.a);
        }` });
    return {
      render(chain, read, target) { const u = mat.uniforms; u.tDiffuse.value = read.texture; u.uTime.value = chain.engine.time;
        u.uAmount.value = cfg.amount; u.uLuma.value = cfg.luma; u.uChroma.value = cfg.chroma; u.uShadow.value = cfg.shadow;
        u.uLift.value = cfg.lift; u.uLiftColor.value.set(cfg.liftColor); u.uVignette.value = cfg.vignette; chain.draw(mat, target); },
      dispose() { mat.dispose(); } };
  } };

class PostChain {
  constructor(engine, renderer, passCfgs) {
    this.engine = engine; this.renderer = renderer; this.cfgs = passCfgs;
    this.passes = passCfgs.map((c) => { if (c.type === 'frost' && 'scale' in c && !('depthFar' in c)) c.type = 'ripple';   // the old frost was a displacement
      for (const [k, v] of Object.entries(PassTypes[c.type].defaults)) if (!(k in c)) c[k] = clone(v);   // sliders added after the pass was saved
      return { cfg: c, inst: PassTypes[c.type].create(c) }; });
    this.copy = quadMaterial({ uniforms: { tDiffuse: { value: null } }, fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }` });
    this.rtA = makeRT(1, 1); this.rtB = makeRT(1, 1);
    this.finalTarget = null;   // set a render target to capture the plane offscreen instead of drawing to its canvas
  }
  setSize(w, h) { this.rtA.setSize(w, h); this.rtB.setSize(w, h); this.passes.forEach((p) => p.inst.setSize && p.inst.setSize(w, h)); }
  draw(material, target) { this.engine.quad.material = material; this.renderer.setRenderTarget(target); this.renderer.render(this.engine.quadScene, this.engine.quadCam); }
  run(sceneRT) {
    const active = this.passes.filter((p) => p.cfg.enabled !== false);
    let read = sceneRT;
    if (!active.length) { this.copy.uniforms.tDiffuse.value = read.texture; this.draw(this.copy, this.finalTarget); return; }
    active.forEach((p, i) => {
      const last = i === active.length - 1;
      const target = last ? this.finalTarget : (read === this.rtA ? this.rtB : this.rtA);
      p.inst.render(this, read, target, sceneRT); read = target;
    });
  }
  dispose() { this.rtA.dispose(); this.rtB.dispose(); this.copy.dispose(); this.passes.forEach((p) => p.inst.dispose()); }
}

/* ============================================================================
   Engine: shared scene + camera, N planes drawn in order into one canvas.
   port: the app gave every plane its own canvas and WebGL context, sized from the window.
   ========================================================================== */
class Engine {
  constructor(stage, { maxDpr = 1.5, assetBase = document.baseURI } = {}) {
    this.stage = stage;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.clock = new THREE.Clock(); this.time = 0; this.dt = 0;
    this.pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    this.maxDpr = maxDpr; this.scale = 1; this.samples = 4;
    this.width = 1; this.height = 1;   // container size, CSS px
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr) * this.scale;
    this.shared = { time: { value: 0 }, resolution: { value: new THREE.Vector2(1, 1) },
      fogColor: { value: new THREE.Color('#d6d5ec') }, fogDensity: { value: 0 }, fogStart: { value: 8 },
      light: { sky: { value: new THREE.Color('#ffffff') }, ground: { value: new THREE.Color('#9b95b8') }, ambient: { value: 1 },
        sunColor: { value: new THREE.Color('#fff1dc') }, sunAmt: { value: 1 }, sunDir: { value: new THREE.Vector3(0.5, 0.7, 0.6).normalize() } } };
    // Lights for mesh layers (models, mountains). Shader layers ignore them.
    this.hemi = new THREE.HemisphereLight('#ffffff', '#9b95b8', Math.PI); this.hemi.layers.enableAll(); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dc', Math.PI); this.sun.position.set(5, 7, 6); this.sun.layers.enableAll(); this.scene.add(this.sun);
    this.planes = []; this.baseZ = 10; this.onFrame = null; this.plan = []; this.planeBlend = [];
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null); this.quad.frustumCulled = false; this.quadScene.add(this.quad);
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.assetBase = assetBase; this.loads = []; this.models = new Map();
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
    stage.appendChild(this.canvas);
    // The bottom plane's canvas was opaque (alpha: false); the planes above it are composited onto it.
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false, alpha: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    const copyFrag = 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }';
    // Premultiplied source-over: a transparent canvas stacked on the ones below it.
    this.overMat = quadMaterial({ uniforms: { tDiffuse: { value: null } }, fragmentShader: copyFrag });
    Object.assign(this.overMat, { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    this.copyMat = quadMaterial({ uniforms: { tDiffuse: { value: null } }, fragmentShader: copyFrag });
    this.opaqueMat = quadMaterial({ uniforms: { tDiffuse: { value: null } }, fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }' });
    this.accA = null; this.accB = null; this.accMat = null;   // only when a plane has a blend mode other than normal
  }

  // Assets: paths in the scene resolve against assetBase. Every request is tracked so the first frame can wait for all of them.
  url(src) { try { return new URL(src, this.assetBase).href; } catch (e) { return src; } }
  track(promise) { this.loads.push(promise); return promise; }
  async settled() { let n; do { n = this.loads.length; await Promise.allSettled(this.loads); } while (n !== this.loads.length); }
  loadModel(src) {
    const url = this.url(src);
    let data = this.models.get(url);
    if (!data) { data = fetch(url).then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.arrayBuffer(); }); this.models.set(url, data); }
    return data.then((buf) => new Promise((resolve, reject) => new GLTFLoader().parse(buf, THREE.LoaderUtils.extractUrlBase(url), resolve, reject)));
  }

  setPlanes(n) {
    if (this.planes.length === n) return;
    this.planes.forEach((p) => this.disposePlane(p));
    this.planes = [];
    for (let i = 0; i < n; i++) {
      const sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1), depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      sceneRT.samples = this.samples;   // MSAA: the scene draws into this target, so the canvas antialias flag would do nothing
      // What the plane's canvas held in the app: the end of its post chain, clamped and stored in 8 bits.
      const outRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
      this.planes.push({ renderer: this.renderer, sceneRT, outRT, chain: null, partRT: null, blendRT: null, blendMat: null });
    }
    this.resize();
  }
  disposePlane(p) { p.chain && p.chain.dispose(); p.sceneRT.dispose(); p.outRT.dispose(); p.partRT && p.partRT.dispose(); p.blendRT && p.blendRT.dispose();
    p.blendMat && p.blendMat.dispose(); p.copyMat && p.copyMat.dispose(); }

  setPost(postCfg) {
    this.planes.forEach((p, i) => { p.chain && p.chain.dispose(); p.chain = new PostChain(this, p.renderer, postCfg[i] || []); });
    this.resize();
  }

  setCamera({ fov = 35, z = 10 }) { this.camera.fov = fov; this.baseZ = z; this.resize(); }

  // plan: [{ object, plane, blend, amount }] in draw order. Layers with a blend other than 'normal' composite separately.
  setPlan(plan) { this.plan = plan; this.byPlane = []; for (const x of plan) (this.byPlane[x.plane] = this.byPlane[x.plane] || []).push(x); }
  drawQuad(renderer, material, target) { this.quad.material = material; renderer.setRenderTarget(target); renderer.render(this.quadScene, this.quadCam); }
  // Split the plane into segments at every blended layer, render each one alone, and composite them in order.
  renderPlane(p, i) {
    const all = (this.byPlane && this.byPlane[i]) || [];
    let blended = false; for (const x of all) if (x.object.visible && x.blend !== 'normal') { blended = true; break; }
    if (!blended) { p.renderer.setRenderTarget(p.sceneRT); p.renderer.clear(); p.renderer.render(this.scene, this.camera); return; }
    const items = all.filter((x) => x.object.visible);
    const segs = [];   // consecutive normal layers share one render, so depth still sorts them
    for (const it of items) {
      const adv = it.blend && it.blend !== 'normal';
      if (!adv && segs.length && !segs[segs.length - 1].adv) segs[segs.length - 1].items.push(it);
      else segs.push({ adv, blend: it.blend, amount: it.amount, items: [it] });
    }
    const w = p.sceneRT.width, h = p.sceneRT.height;
    if (!p.partRT) { p.partRT = makeRT(w, h, { depthBuffer: true }); p.partRT.samples = this.samples; p.blendRT = makeRT(w, h); p.blendMat = blendMaterial(); }
    const show = (seg) => items.forEach((x) => (x.object.visible = seg.items.includes(x)));
    // The first segment renders into sceneRT, so the depth texture the blur pass reads stays populated.
    let acc = p.sceneRT;
    segs.forEach((seg, si) => {
      show(seg);
      const target = si === 0 ? p.sceneRT : p.partRT;
      p.renderer.setRenderTarget(target); p.renderer.clear(); p.renderer.render(this.scene, this.camera);
      if (si === 0) return;
      const out = acc === p.blendRT ? p.sceneRT : p.blendRT;
      p.blendMat.uniforms.tBase.value = acc.texture; p.blendMat.uniforms.tSrc.value = target.texture;
      p.blendMat.uniforms.uMode.value = BLEND_ID[seg.blend] ?? 0; p.blendMat.uniforms.uAmount.value = seg.adv ? seg.amount : 1;
      this.drawQuad(p.renderer, p.blendMat, out); acc = out;
    });
    items.forEach((x) => (x.object.visible = true));
    if (acc !== p.sceneRT) { p.blendMat.uniforms.tBase.value = null; this.copyRT(p, acc, p.sceneRT); }
  }
  copyRT(p, from, to) {
    if (!p.copyMat) p.copyMat = quadMaterial({ uniforms: { tDiffuse: { value: null } }, fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }' });
    p.copyMat.uniforms.tDiffuse.value = from.texture; this.drawQuad(p.renderer, p.copyMat, to);
  }

  // planeBlend[i] was the CSS mix-blend-mode of plane i's canvas.
  setPlaneBlend(list) {
    this.planeBlend = list || [];
    const odd = this.planeBlend.filter((b, i) => i > 0 && b && b !== 'normal' && !(b in BLEND_ID));
    if (odd.length) console.warn('stage: plane blend not supported, drawn as normal:', odd.join(', '));
  }
  // Edge quality. samples = MSAA on the scene target; scale = extra render resolution, resolved down by the browser.
  setQuality({ samples = 4, scale = 1 } = {}) {
    this.samples = samples; this.scale = scale;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr) * scale;
    for (const p of this.planes) if (p.sceneRT.samples !== samples) { p.sceneRT.samples = samples; p.sceneRT.dispose(); if (p.partRT) { p.partRT.samples = samples; p.partRT.dispose(); } }
    this.resize();
  }

  // Slider units: 1 = base color at full brightness. three's physical lights need a factor of PI for that.
  setLight(L) {
    const u = this.shared.light;
    u.sky.value.set(L.sky); u.ground.value.set(L.ground); u.ambient.value = L.ambient; u.sunColor.value.set(L.sun); u.sunAmt.value = L.sunAmt;
    u.sunDir.value.set(L.sunX, L.sunY, 0.6).normalize();
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.ambient * Math.PI;
    this.sun.color.set(L.sun); this.sun.intensity = L.sunAmt * Math.PI; this.sun.position.copy(u.sunDir.value).multiplyScalar(20);
  }

  // Visible half-extents of the frustum at world z (used for screen-relative placement).
  viewAt(z) {
    const dist = Math.max(0.1, this.camera.position.z - z);
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    return { halfW: halfH * this.camera.aspect, halfH, dist };
  }

  // port: the container's size, not the window's.
  setSize(w, h) { this.width = Math.max(1, w); this.height = Math.max(1, h); this.resize(); }
  resize() {
    const w = this.width, h = this.height;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr) * this.scale;
    const pw = Math.max(1, Math.floor(w * this.dpr)), ph = Math.max(1, Math.floor(h * this.dpr));
    this.camera.aspect = w / h;
    this.camera.position.z = this.baseZ * Math.max(1, 0.85 / this.camera.aspect);
    this.camera.updateProjectionMatrix();
    this.shared.resolution.value.set(pw, ph);
    this.renderer.setPixelRatio(this.dpr); this.renderer.setSize(w, h, false);
    for (const p of this.planes) { p.sceneRT.setSize(pw, ph); p.outRT.setSize(pw, ph); p.chain && p.chain.setSize(pw, ph);
      p.partRT && p.partRT.setSize(pw, ph); p.blendRT && p.blendRT.setSize(pw, ph); }
    this.accA && this.accA.setSize(pw, ph); this.accB && this.accB.setSize(pw, ph);
  }

  // advance = false draws the current state again without moving time (renderOnce, resizes).
  frame(advance = true) {
    const dt = advance ? Math.min(this.clock.getDelta(), 0.05) : 0; this.time += dt; this.dt = dt; this.shared.time.value = this.time;
    if (this.reduceMotion) { this.pointer.tx = 0; this.pointer.ty = 0; }
    const k = 1 - Math.pow(0.001, dt);
    this.pointer.x = lerp(this.pointer.x, this.pointer.tx, k); this.pointer.y = lerp(this.pointer.y, this.pointer.ty, k);
    if (this.onFrame) this.onFrame(this.time, dt);
    this.drawPlanes();
  }

  // An empty plane renders a cleared, transparent frame, and every post pass except the vignette keeps it transparent.
  isEmpty(p, i) {
    const items = (this.byPlane && this.byPlane[i]) || [];
    if (items.some((x) => x.object.visible)) return false;
    return !(p.chain && p.chain.passes.some((q) => q.cfg.enabled !== false && q.cfg.type === 'vignette'));
  }
  // The bottom plane goes straight to the canvas. Each plane above ends in its 8-bit target and is laid over what is there.
  drawPlanes() {
    const r = this.renderer, blends = this.planeBlend;
    const mixed = this.planes.some((p, i) => i > 0 && blends[i] && blends[i] !== 'normal' && blends[i] in BLEND_ID);
    if (mixed && !this.accA) { const { width, height } = this.planes[0].outRT; this.accA = makeRT(width, height, { type: THREE.UnsignedByteType }); this.accB = makeRT(width, height, { type: THREE.UnsignedByteType }); this.accMat = blendMaterial(); }
    let acc = null, drawn = 0;
    this.planes.forEach((p, i) => {
      if (!p.chain || this.isEmpty(p, i)) return;
      this.camera.layers.set(i);
      this.renderPlane(p, i);
      const first = drawn++ === 0;
      p.chain.finalTarget = first && !mixed ? null : p.outRT;
      p.chain.run(p.sceneRT);
      if (first) { if (mixed) { this.opaqueMat.uniforms.tDiffuse.value = p.outRT.texture; this.drawQuad(r, this.opaqueMat, this.accA); acc = this.accA; } return; }
      if (!mixed) { this.overMat.uniforms.tDiffuse.value = p.outRT.texture; const ac = r.autoClear; r.autoClear = false; this.drawQuad(r, this.overMat, null); r.autoClear = ac; return; }
      const out = acc === this.accA ? this.accB : this.accA, u = this.accMat.uniforms, b = blends[i] || 'normal';
      u.tBase.value = acc.texture; u.tSrc.value = p.outRT.texture; u.uMode.value = BLEND_ID[b] ?? 0; u.uAmount.value = 1;
      this.drawQuad(r, this.accMat, out); acc = out;
    });
    if (!drawn) { r.setRenderTarget(null); r.clear(); return; }   // nothing visible: black, like an empty opaque bottom canvas
    if (mixed) { this.copyMat.uniforms.tDiffuse.value = acc.texture; this.drawQuad(r, this.copyMat, null); }
  }

  dispose() {
    this.planes.forEach((p) => this.disposePlane(p)); this.planes = [];
    this.accA && this.accA.dispose(); this.accB && this.accB.dispose(); this.accMat && this.accMat.dispose();
    this.overMat.dispose(); this.copyMat.dispose(); this.opaqueMat.dispose(); this.quad.geometry.dispose();
    this.models.clear();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.canvas.remove();
  }
}

/* ============================================================================
   Layer types. Each returns { object, apply(cfg), frame(cfg, engine), dispose }.
   Positions are screen-relative: x,y in [-1,1] of the viewport; size as a
   fraction of viewport height — so changing depth (z) changes blur/fog/
   parallax without moving the image on screen.
   ========================================================================== */

function parallaxOffset(cfg, engine, v, scale) {
  const p = (cfg.parallax || 0) * scale;
  return { x: engine.pointer.x * p * 0.12 * v.halfW, y: engine.pointer.y * p * 0.08 * v.halfH };
}

const LayerTypes = {};

LayerTypes.image = {
  label: 'Image',
  defaults: { name: 'Image', blend: 'normal', blendAmt: 1, plane: 1, visible: true, z: 0, src: '', fit: 'height', size: 0.6, x: 0, y: 0, rotation: 0, parallax: 0.4,
    xref: 'width', opacity: 1, tint: '#ffffff', tintAmt: 0, fog: 1, sway: 0 },
  create(cfg, engine) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { tMap: { value: null }, uOpacity: { value: 1 }, uTint: { value: new THREE.Color() }, uTintAmt: { value: 0 }, uFog: { value: 1 }, uPremul: { value: 0 },
        uFogColor: engine.shared.fogColor, uFogDensity: engine.shared.fogDensity, uFogStart: engine.shared.fogStart },
      vertexShader: GLSL.worldVert,
      fragmentShader: GLSL.fog + /* glsl */`
        uniform sampler2D tMap; uniform vec3 uTint; uniform float uOpacity, uTintAmt, uFog, uPremul; varying vec2 vUv; varying float vDepth;
        void main(){ vec4 t = texture2D(tMap, vUv); if (t.a < 0.004) discard;
          vec3 c = mix(t.rgb, t.rgb * uTint, uTintAmt);
          c = mix(c, uFogColor, fogAmount(vDepth) * uFog);
          float a = t.a * uOpacity;
          gl_FragColor = uPremul > 0.5 ? vec4(c * a, a) : vec4(c, a); }`,
      transparent: true, depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.frustumCulled = false;
    let aspect = 1, loadedSrc = null;
    const load = (src) => {
      loadedSrc = src; if (!src) { mat.uniforms.tMap.value = null; return; }
      // port: path resolved against assetBase; the request is tracked so the first frame can wait for it.
      engine.track(new Promise((done) => new THREE.TextureLoader().load(engine.url(src), (tex) => { done(); if (loadedSrc !== src) { tex.dispose(); return; }
        tex.anisotropy = 4; if (mat.uniforms.tMap.value) mat.uniforms.tMap.value.dispose();
        mat.uniforms.tMap.value = tex; aspect = tex.image.width / tex.image.height; },
        undefined, () => { done(); console.warn('Image failed to load:', src.slice(0, 80)); })));
    };
    return {
      object: mesh,
      apply(c) {
        if (c.src !== loadedSrc) load(c.src);
        mat.uniforms.uOpacity.value = c.opacity; mat.uniforms.uTint.value.set(c.tint); mat.uniforms.uTintAmt.value = c.tintAmt; mat.uniforms.uFog.value = c.fog;
        mesh.visible = c.visible !== false && !!c.src;
      },
      frame(c, engine, sceneCfg) {
        const v = engine.viewAt(c.z); let w, h;
        if (c.fit === 'cover') { h = Math.max(2 * v.halfW / aspect, 2 * v.halfH) * (1 + Math.abs(c.parallax || 0) * 0.15); w = h * aspect; }
        else if (c.fit === 'width') { w = c.size * 2 * v.halfW; h = w / aspect; }
        else { h = c.size * 2 * v.halfH; w = h * aspect; }
        const o = parallaxOffset(c, engine, v, sceneCfg.parallax);
        mesh.scale.set(w, h, 1);
        mesh.position.set(c.x * (c.xref === 'height' ? v.halfH : v.halfW) + o.x, c.y * v.halfH + o.y, c.z);
        mesh.rotation.z = THREE.MathUtils.degToRad(c.rotation) + (c.sway ? Math.sin(engine.time * 0.6 + c.z) * THREE.MathUtils.degToRad(c.sway) : 0);
      },
      dispose() { mat.uniforms.tMap.value && mat.uniforms.tMap.value.dispose(); mat.dispose(); mesh.geometry.dispose(); } };
  } };

LayerTypes.gradient = {
  label: 'Gradient',
  defaults: { name: 'Gradient', blend: 'normal', blendAmt: 1, plane: 0, visible: true, z: -8, top: '#c9c6ea', mid: '#cfe2ee', bottom: '#e1d7e8', midpoint: 0.5,
    noise: 0.3, noiseScale: 1.2, speed: 0.05, warm: '#f8e6c8', warmX: 0.7, warmY: 0.72, warmSize: 0.35, warmAmt: 0.8 },
  create(cfg, engine) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: engine.shared.time, uRes: engine.shared.resolution, uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
        uMidpoint: { value: 0.5 }, uNoise: { value: 0 }, uNoiseScale: { value: 1 }, uSpeed: { value: 0 }, uWarm: { value: new THREE.Color() },
        uWarmPos: { value: new THREE.Vector2() }, uWarmSize: { value: 0.3 }, uWarmAmt: { value: 0 } },
      vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: GLSL.snoise + /* glsl */`
        uniform float uTime, uMidpoint, uNoise, uNoiseScale, uSpeed, uWarmSize, uWarmAmt; uniform vec2 uRes, uWarmPos; uniform vec3 uTop, uMid, uBottom, uWarm;
        void main(){
          vec2 uv = gl_FragCoord.xy / uRes; vec2 p = uv * vec2(uRes.x / uRes.y, 1.0);
          float n1 = snoise(vec3(p * uNoiseScale, uTime * uSpeed)); float n2 = snoise(vec3(p * uNoiseScale * 1.7 + 7.0, uTime * uSpeed * 0.8));
          float t = clamp(uv.y + n1 * 0.25 * uNoise, 0.0, 1.0);
          vec3 c = t < uMidpoint ? mix(uBottom, uMid, smoothstep(0.0, uMidpoint, t)) : mix(uMid, uTop, smoothstep(uMidpoint, 1.0, t));
          c = mix(c, mix(uTop, uBottom, 0.5), (n2 * 0.5 + 0.5) * uNoise * 0.5);
          float w = exp(-length((uv - uWarmPos) * vec2(1.0, 1.4)) / uWarmSize);
          c = mix(c, uWarm, w * uWarmAmt);
          gl_FragColor = vec4(c, 1.0); }`,
      transparent: true, depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.frustumCulled = false;
    return {
      object: mesh,
      apply(c) { const u = mat.uniforms; u.uTop.value.set(c.top); u.uMid.value.set(c.mid); u.uBottom.value.set(c.bottom); u.uMidpoint.value = c.midpoint;
        u.uNoise.value = c.noise; u.uNoiseScale.value = c.noiseScale; u.uSpeed.value = c.speed; u.uWarm.value.set(c.warm);
        u.uWarmPos.value.set(c.warmX, c.warmY); u.uWarmSize.value = c.warmSize; u.uWarmAmt.value = c.warmAmt; mesh.visible = c.visible !== false; },
      frame(c, engine) { const v = engine.viewAt(c.z); mesh.scale.set(v.halfW * 2.2, v.halfH * 2.2, 1); mesh.position.set(0, 0, c.z); },
      dispose() { mat.dispose(); mesh.geometry.dispose(); } };
  } };

/* ---------------------------------------------------------------------------
   Mesh gradient: a base color plus five soft color blobs that drift on slow orbits,
   warped by noise. Full-screen like the gradient layer.
   --------------------------------------------------------------------------- */
LayerTypes.mesh = {
  label: 'Mesh gradient',
  defaults: { name: 'Mesh gradient', blend: 'normal', blendAmt: 1, plane: 0, visible: true, z: -8, base: '#8b93bf', c1: '#6f78ab', c2: '#a3aacb', c3: '#7d86b8', c4: '#9aa0c8', c5: '#b7a9c4',
    size: 0.5, spread: 1, speed: 0.15, warp: 0.25, warpScale: 1.2, contrast: 1 },
  create(cfg, engine) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: engine.shared.time, uRes: engine.shared.resolution, uBase: { value: new THREE.Color() }, uC: { value: [0, 1, 2, 3, 4].map(() => new THREE.Color()) },
        uSize: { value: 0.5 }, uSpread: { value: 1 }, uSpeed: { value: 0.1 }, uWarp: { value: 0 }, uWarpScale: { value: 1 }, uContrast: { value: 1 } },
      vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: GLSL.snoise + /* glsl */`
        uniform float uTime, uSize, uSpread, uSpeed, uWarp, uWarpScale, uContrast; uniform vec2 uRes; uniform vec3 uBase; uniform vec3 uC[5];
        vec2 orbit(float i, float t) {   // each blob wanders on its own slow loop
          return vec2(0.5) + 0.45 * uSpread * vec2(sin(t * 0.61 + i * 1.9 + 0.6 * sin(t * 0.27 + i)), cos(t * 0.47 + i * 2.7 + 0.6 * cos(t * 0.19 + i * 0.7))); }
        void main(){
          float aspect = uRes.x / uRes.y; vec2 uv = gl_FragCoord.xy / uRes; vec2 p = uv * vec2(aspect, 1.0);
          float t = uTime * uSpeed;
          p += uWarp * 0.25 * vec2(snoise(vec3(p * uWarpScale, t * 0.5)), snoise(vec3(p * uWarpScale + 5.0, t * 0.5 + 2.0)));
          vec3 acc = uBase * 0.05; float ws = 0.05;
          for (int i = 0; i < 5; i++) {
            vec2 b = orbit(float(i), t) * vec2(aspect, 1.0); float d = distance(p, b);
            float w = exp(-(d * d) / (uSize * uSize)); acc += uC[i] * w; ws += w; }
          vec3 c = acc / ws;
          c = mix(uBase, c, uContrast);
          gl_FragColor = vec4(c, 1.0); }`,
      transparent: true, depthTest: true, depthFunc: THREE.AlwaysDepth, depthWrite: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.frustumCulled = false;
    return {
      object: mesh,
      apply(c) { const u = mat.uniforms; u.uBase.value.set(c.base); [c.c1, c.c2, c.c3, c.c4, c.c5].forEach((col, i) => u.uC.value[i].set(col));
        u.uSize.value = c.size; u.uSpread.value = c.spread; u.uSpeed.value = c.speed; u.uWarp.value = c.warp; u.uWarpScale.value = c.warpScale; u.uContrast.value = c.contrast; mesh.visible = c.visible !== false; },
      frame(c, engine) { const v = engine.viewAt(c.z); mesh.scale.set(v.halfW * 2.2, v.halfH * 2.2, 1); mesh.position.set(0, 0, c.z); },
      dispose() { mat.dispose(); mesh.geometry.dispose(); } };
  } };

LayerTypes.mist = {
  label: 'Mist',
  defaults: { name: 'Mist', blend: 'normal', blendAmt: 1, plane: 0, visible: true, z: -2, y0: -1.3, y1: -0.2, x: 0, y: 0, parallax: 0.3, colorA: '#d4eaf5', colorB: '#f2f8fb',
    xref: 'width', density: 1, freq: 0.35, speed: 1, alpha: 0.9, fog: 0.5 },
  create(cfg, engine) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: engine.shared.time, uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uY0: { value: -1 }, uY1: { value: 0 }, uFreq: { value: 0.3 },
        uSeed: { value: Math.random() * 10 }, uDensity: { value: 1 }, uAlpha: { value: 1 }, uSpeed: { value: 1 }, uFog: { value: 0 },
        uFogColor: engine.shared.fogColor, uFogDensity: engine.shared.fogDensity, uFogStart: engine.shared.fogStart },
      vertexShader: GLSL.worldVert,
      fragmentShader: GLSL.snoise + GLSL.fog + /* glsl */`
        uniform vec3 uA, uB; uniform float uY0, uY1, uFreq, uSeed, uDensity, uAlpha, uTime, uSpeed, uFog; varying vec3 vWorld; varying float vDepth;
        void main(){
          float y = vWorld.y; float t = clamp((y - uY0) / max(0.01, uY1 - uY0), 0.0, 1.0);
          float band = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.5, 1.0, t));
          float n = fbm(vec3(vWorld.x * uFreq + uTime * 0.03 * uSpeed, y * uFreq * 2.0 + uTime * 0.012 * uSpeed, uSeed)) * 0.5 + 0.5;
          float a = band * smoothstep(0.25, 0.9, n * 0.65 + (1.0 - t) * 0.55) * uDensity;
          vec3 c = mix(mix(uA, uB, n), uFogColor, fogAmount(vDepth) * uFog);
          gl_FragColor = vec4(c, clamp(a, 0.0, 1.0) * uAlpha); }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.frustumCulled = false;
    return {
      object: mesh,
      apply(c) { const u = mat.uniforms; u.uA.value.set(c.colorA); u.uB.value.set(c.colorB); u.uFreq.value = c.freq; u.uDensity.value = c.density;
        u.uAlpha.value = c.alpha; u.uSpeed.value = c.speed; u.uFog.value = c.fog;
        mesh.visible = c.visible !== false && c.alpha > 0; },   // port: at opacity 0 the mist changes nothing, so it is not drawn
      frame(c, engine, sceneCfg) { const v = engine.viewAt(c.z); const o = parallaxOffset(c, engine, v, sceneCfg.parallax);
        mat.uniforms.uY0.value = c.y0 * v.halfH + c.y * v.halfH + o.y; mat.uniforms.uY1.value = c.y1 * v.halfH + c.y * v.halfH + o.y;
        mesh.scale.set(v.halfW * 2.6, v.halfH * 2.6, 1); mesh.position.set(c.x * (c.xref === 'height' ? v.halfH : v.halfW) + o.x, o.y, c.z); },
      dispose() { mat.dispose(); mesh.geometry.dispose(); } };
  } };

/* ---------------------------------------------------------------------------
   Mesh helpers: fog for three's lit materials, model cleanup, 2D noise
   --------------------------------------------------------------------------- */
// Per-layer look for three's lit materials: silhouette + backlight glow, then the shared fog.
// look = { fogAmt, silhouette, shade, glow, glowAmt, glowFrom, glowSoft, y0, y1 } uniforms shared by all materials of one layer.
function makeLook() {
  return { fogAmt: { value: 1 }, silhouette: { value: 0 }, shade: { value: new THREE.Color() }, glow: { value: new THREE.Color() },
    glowAmt: { value: 1 }, glowFrom: { value: 0.6 }, glowSoft: { value: 0.12 }, glowBy: { value: 0 }, y0: { value: 0 }, y1: { value: 1 },
    glowHot: { value: new THREE.Color() }, glowDeep: { value: new THREE.Color() }, shading: { value: 0.6 }, thick: { value: 0.5 }, hot: { value: 1 }, texMix: { value: 0.5 }, fade: { value: 0 }, fadeSoft: { value: 1 }, sat: { value: 0 }, trans: { value: 0 }, leafSpec: { value: 1 }, leafRough: { value: 1 },
    ramp: { value: 0 }, rampMid: { value: 0.5 }, rampTilt: { value: 0 }, rim: { value: 0 }, xc: { value: 0 } };
}
function addLayerLook(mat, engine, look) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uFogColor: engine.shared.fogColor, uFogDensity: engine.shared.fogDensity, uFogStart: engine.shared.fogStart, uFogAmt: look.fogAmt,
      uSil: look.silhouette, uShade: look.shade, uGlow: look.glow, uGlowAmt: look.glowAmt, uGlowFrom: look.glowFrom, uGlowSoft: look.glowSoft, uGlowBy: look.glowBy, uY0: look.y0, uY1: look.y1,
      uGlowHot: look.glowHot, uGlowDeep: look.glowDeep, uShading: look.shading, uThick: look.thick, uHot: look.hot, uTexMix: look.texMix, uFade: look.fade, uFadeSoft: look.fadeSoft, uSat: look.sat, uTrans: look.trans, uLeafSpec: look.leafSpec, uLeafRough: look.leafRough, uRamp: look.ramp, uRampMid: look.rampMid, uRampTilt: look.rampTilt, uRim: look.rim, uXc: look.xc });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLayerDepth, vLayerY, vLayerX;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvLayerDepth = -mvPosition.z; vec4 lw = modelMatrix * vec4(transformed, 1.0); vLayerY = lw.y; vLayerX = lw.x;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform vec3 uFogColor, uShade, uGlow, uGlowHot, uGlowDeep; uniform float uFogDensity, uFogStart, uFogAmt, uSil, uGlowAmt, uGlowFrom, uGlowSoft, uGlowBy, uY0, uY1, uShading, uThick, uHot, uTexMix, uFade, uFadeSoft, uSat, uTrans, uLeafSpec, uLeafRough, uRamp, uRampMid, uRampTilt, uRim, uXc;
        varying float vLayerDepth, vLayerY, vLayerX;`)
      // Leaves vs petals: split by base-color hue (green vs warm) before lighting, so each part gets its own gloss.
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nfloat petalMask = smoothstep(0.02, 0.14, diffuseColor.r - diffuseColor.g);')
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
        material.roughness = clamp(material.roughness * mix(uLeafRough, 1.0, petalMask), 0.05, 1.0);
        material.specularColor *= mix(uLeafSpec, 1.0, petalMask); material.specularF90 *= mix(uLeafSpec, 1.0, petalMask);`)
      .replace('#include <fog_fragment>', `#include <fog_fragment>
        { // Silhouette through diffusing glass. The lit result and the view angle survive as shading so the form keeps its depth.
          vec3 lit = gl_FragColor.rgb; float lum = dot(lit, vec3(0.3, 0.59, 0.11));
          lit = mix(vec3(lum), lit, 1.0 + uSat);                           // saturation
          float facing = abs(normal.z);                                  // 1 = surface faces the camera, 0 = edge-on (thicker path for the light)
          float hgt = (vLayerY - uY0) / max(0.001, uY1 - uY0);
          float byHeight = smoothstep(uGlowFrom - uGlowSoft, uGlowFrom + uGlowSoft, hgt);
          float byColor = petalMask;                                        // warm-toned parts (petals) transmit, green parts do not
          float thin = mix(1.0, facing, uThick);
          float shade = mix(1.0, 0.45 + 1.1 * lum, uShading);
          float g = mix(byHeight, byColor, uGlowBy) * uGlowAmt * thin * shade;
          // Transmitted color: deep tone where little light gets through, main glow in the middle, hot spots where most gets through.
          float k = clamp(lum * thin * 1.3, 0.0, 1.0);
          vec3 gcol = mix(uGlowDeep, uGlow, smoothstep(0.1, 0.5, k));
          gcol = mix(gcol, uGlowHot, smoothstep(0.5, 0.95, k) * uHot);
          // Ramp by position: deep at the base, main glow in the middle, hot at the top. Tilt leans the ramp sideways.
          float tt = clamp(hgt + (vLayerX - uXc) / max(0.001, uY1 - uY0) * uRampTilt, 0.0, 1.0);
          vec3 rcol = mix(uGlowDeep, uGlow, smoothstep(0.0, uRampMid, tt));
          rcol = mix(rcol, uGlowHot, smoothstep(uRampMid, 1.0, tt) * uHot);
          gcol = mix(gcol, rcol, uRamp);
          gcol *= mix(vec3(1.0), clamp(lit / max(lum, 0.02), 0.5, 1.6), uTexMix);   // the texture's own hue variation
          vec3 sil = mix(uShade * shade, gcol, clamp(g, 0.0, 1.0)) + gcol * max(g - 1.0, 0.0) * 0.5;
          float rimF = uRim * pow(1.0 - facing, 2.0);                        // edge light: frosted glass gets paler where the form turns away
          sil = mix(sil, uGlowHot, rimF); lit = mix(lit, uGlowHot, rimF * 0.6);
          lit += gcol * g * uTrans;                                          // translucency: transmitted light in the lit look
          gl_FragColor.rgb = mix(lit, sil, uSil);
          gl_FragColor.a *= pow(smoothstep(-0.001, max(uFade, 0.001), hgt), uFadeSoft);   // the base fades into whatever is behind
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColor, uFogAmt * (1.0 - exp(-uFogDensity * max(0.0, vLayerDepth - uFogStart)))); }`);
  };
  mat.customProgramCacheKey = () => 'layerlook';
}
const TEX_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'specularIntensityMap', 'specularColorMap', 'alphaMap'];
function disposeTree(root) {
  root.traverse((o) => { if (!o.isMesh) return; o.geometry && o.geometry.dispose();
    if (o.userData.rawGeometry && o.userData.rawGeometry !== o.geometry) o.userData.rawGeometry.dispose();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { TEX_SLOTS.forEach((k) => m[k] && m[k].dispose()); m.dispose(); }); });
}
// Seeded 2D simplex noise, returns roughly [-1, 1].
function makeNoise2D(seed) {
  const p = new Uint8Array(256), perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  let st = (seed * 9301 + 49297) % 233280 || 1;
  const rnd = () => (st = (st * 9301 + 49297) % 233280) / 233280;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const corner = (x, y, g) => { let t = 0.5 - x * x - y * y; if (t < 0) return 0; t *= t; return t * t * (g[0] * x + g[1] * y); };
  return (x, y) => {
    const sk = (x + y) * F2, i = Math.floor(x + sk), j = Math.floor(y + sk), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2, ii = i & 255, jj = j & 255;
    return 70 * (corner(x0, y0, G[perm[ii + perm[jj]] % 8]) + corner(x1, y1, G[perm[ii + i1 + perm[jj + j1]] % 8]) + corner(x2, y2, G[perm[ii + 1 + perm[jj + 1]] % 8]));
  };
}

/* ---------------------------------------------------------------------------
   3D model layer (glTF / glb). Size = model height as a fraction of viewport height.
   --------------------------------------------------------------------------- */
LayerTypes.model = {
  label: '3D model',
  defaults: { name: 'Model', blend: 'normal', blendAmt: 1, plane: 1, visible: true, z: 0, src: '', size: 0.6, x: 0, y: -0.5, xref: 'width', parallax: 0.4, anchor: 'bottom',
    rotX: 0, rotY: 0, rotZ: 0, spin: 0, sway: 0, fog: 1,
    clip: '', play: 1, clipSpeed: 1, clipStart: 0, clipLoop: 'repeat', smooth: 0, weld: 1,
    silhouette: 0, shade: '#6f7bab', glow: '#ff9d72', glowHot: '#fff0c8', glowDeep: '#d9587c', glowAmt: 1, glowFrom: 0.6, glowSoft: 0.12, glowBy: 0,
    shading: 0.6, thick: 0.5, hot: 1, texMix: 0.5, fade: 0, fadeSoft: 1,
    specular: 1, roughness: 1, leafSpecular: 1, leafRoughness: 1, opacity: 1, saturation: 0, translucency: 0,
    ramp: 0, rampMid: 0.5, rampTilt: 0, rim: 0 },
  create(cfg, engine) {
    const group = new THREE.Group();
    const look = makeLook();
    let loadedSrc = null, root = null, box = null, baseScale = 1, anchor = 'bottom', lastCfg = null, mixer = null, action = null, clips = []; const mats = [];
    const setMaterials = (c) => { for (const m of mats) { m.roughness = m.userData.base.roughness * c.roughness; if ('specularIntensity' in m) m.specularIntensity = m.userData.base.specularIntensity * c.specular;
      m.opacity = c.opacity; } };
    // Faceted models: weld vertices that sit within 10^-tol of each other, then average the face normals.
    let smoothState = null;
    const setSmooth = (c) => {
      const want = c.smooth ? 'w' + c.weld : 'off'; if (!root || smoothState === want) return; smoothState = want;
      root.traverse((o) => {
        if (!o.isMesh || !o.userData.rawGeometry) return;
        if (o.geometry !== o.userData.rawGeometry) o.geometry.dispose();
        if (!c.smooth || o.geometry.morphAttributes && Object.keys(o.userData.rawGeometry.morphAttributes).length) { o.geometry = o.userData.rawGeometry; return; }
        try { const g = mergeVertices(o.userData.rawGeometry.clone(), Math.pow(10, -c.weld)); g.computeVertexNormals(); o.geometry = g; }
        catch (e) { o.geometry = o.userData.rawGeometry; }
      });
    };
    const place = () => { if (!root || !box) return; const c = new THREE.Vector3(); box.getCenter(c);
      root.position.set(-c.x, anchor === 'bottom' ? -box.min.y : -c.y, -c.z); };
    const LOOP = { repeat: THREE.LoopRepeat, pingpong: THREE.LoopPingPong, once: THREE.LoopOnce };
    // One clip runs at a time. An empty clip name means the first one in the file.
    const setClip = (c) => {
      if (!mixer) return;
      const clip = clips.find((k) => k.name === c.clip) || clips[0]; if (!clip) return;
      if (!action || action.getClip() !== clip) { mixer.stopAllAction(); action = mixer.clipAction(clip); action.play(); action.time = Math.min(c.clipStart, clip.duration); }
      action.setLoop(LOOP[c.clipLoop] ?? THREE.LoopRepeat, Infinity); action.clampWhenFinished = c.clipLoop === 'once';
      action.paused = !c.play; action.timeScale = c.clipSpeed; action.enabled = true;
    };
    const load = (src) => {
      loadedSrc = src; if (root) { group.remove(root); disposeTree(root); root = null; box = null; } mats.length = 0; smoothState = null;
      if (mixer) { mixer.stopAllAction(); mixer = null; } action = null; clips = []; if (!src) return;
      // port: path resolved against assetBase, file fetched once per URL, request tracked for the first frame.
      engine.track(engine.loadModel(src).then((gltf) => {
        if (loadedSrc !== src) { disposeTree(gltf.scene); return; }
        root = gltf.scene; root.position.set(0, 0, 0); root.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(root); const size = new THREE.Vector3(); box.getSize(size);
        baseScale = 1 / Math.max(1e-6, size.y);
        root.traverse((o) => {
          o.layers.mask = group.layers.mask; o.renderOrder = group.renderOrder; o.frustumCulled = false;
          if (!o.isMesh) return;
          o.userData.rawGeometry = o.geometry;
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            // The whole stage treats colors as-is (no sRGB decode), so sample textures raw too.
            TEX_SLOTS.forEach((k) => { if (m[k]) { m[k].colorSpace = THREE.NoColorSpace; m[k].anisotropy = 4; m[k].needsUpdate = true; } });
            m.envMap = null; m.transparent = true; m.depthWrite = true; m.needsUpdate = true;   // transparent: keeps it in the renderOrder-sorted pass with the other layers
            m.userData.base = { roughness: m.roughness, specularIntensity: m.specularIntensity ?? 1 }; mats.push(m);
            addLayerLook(m, engine, look);
          });
        });
        if (lastCfg) setSmooth(lastCfg);
        clips = gltf.animations || [];
        if (clips.length) { mixer = new THREE.AnimationMixer(root); if (lastCfg) setClip(lastCfg); }
        place(); group.add(root); if (lastCfg) setMaterials(lastCfg);
      }, (e) => console.warn('Model failed to load:', src, e)));
    };
    return {
      object: group,
      get clips() { return clips.map((k) => k.name); },
      apply(c) { anchor = c.anchor; look.fogAmt.value = c.fog; look.silhouette.value = c.silhouette; look.shade.value.set(c.shade); look.glow.value.set(c.glow);
        look.glowAmt.value = c.glowAmt; look.glowFrom.value = c.glowFrom; look.glowSoft.value = c.glowSoft; look.glowBy.value = c.glowBy;
        look.glowHot.value.set(c.glowHot); look.glowDeep.value.set(c.glowDeep); look.shading.value = c.shading; look.thick.value = c.thick; look.hot.value = c.hot; look.texMix.value = c.texMix; look.fade.value = c.fade; look.fadeSoft.value = c.fadeSoft; look.sat.value = c.saturation; look.trans.value = c.translucency; look.leafSpec.value = c.leafSpecular; look.leafRough.value = c.leafRoughness;
        look.ramp.value = c.ramp; look.rampMid.value = c.rampMid; look.rampTilt.value = c.rampTilt; look.rim.value = c.rim; lastCfg = c; setMaterials(c); setSmooth(c); setClip(c);
        if (c.src !== loadedSrc) load(c.src); else place(); group.visible = c.visible !== false && !!c.src; },
      frame(c, engine, sceneCfg) {
        if (mixer) mixer.update(engine.reduceMotion ? 0 : engine.dt);
        const v = engine.viewAt(c.z), o = parallaxOffset(c, engine, v, sceneCfg.parallax), d = THREE.MathUtils.degToRad, hgt = c.size * 2 * v.halfH;
        group.scale.setScalar(hgt * baseScale);
        group.position.set(c.x * (c.xref === 'height' ? v.halfH : v.halfW) + o.x, c.y * v.halfH + o.y, c.z);
        look.y0.value = group.position.y - (c.anchor === 'bottom' ? 0 : hgt / 2); look.y1.value = look.y0.value + hgt; look.xc.value = group.position.x;
        group.rotation.set(d(c.rotX), d(c.rotY) + engine.time * d(c.spin), d(c.rotZ) + (c.sway ? Math.sin(engine.time * 0.6 + c.z) * d(c.sway) : 0));
      },
      dispose() { if (mixer) mixer.stopAllAction(); if (root) disposeTree(root); } };
  } };

/* ---------------------------------------------------------------------------
   Mountains layer: a noise-displaced strip with smooth normals, lit by the scene lights.
   Width/depth/height are fractions of the viewport at depth z.
   --------------------------------------------------------------------------- */
LayerTypes.terrain = {
  label: 'Mountains',
  defaults: { name: 'Mountains', blend: 'normal', blendAmt: 1, plane: 0, visible: true, z: -12, seed: 4, height: 0.5, width: 1.6, depth: 1, scale: 1.2, ridge: 0.7, detail: 5,
    x: 0, y: -0.6, xref: 'width', parallax: 0.15, tilt: 0, colorLow: '#7d6f96', colorHigh: '#e6d3de', snow: '#fbf4f6', snowLine: 0.6, fog: 1 },
  create(cfg, engine) {
    const L = engine.shared.light;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uNormalW: { value: new THREE.Matrix3() }, uLow: { value: new THREE.Color() }, uHigh: { value: new THREE.Color() }, uSnow: { value: new THREE.Color() },
        uSnowLine: { value: 0.6 }, uFog: { value: 1 }, uSky: L.sky, uGround: L.ground, uAmbient: L.ambient, uSunColor: L.sunColor, uSunAmt: L.sunAmt, uSunDir: L.sunDir,
        uFogColor: engine.shared.fogColor, uFogDensity: engine.shared.fogDensity, uFogStart: engine.shared.fogStart },
      vertexShader: /* glsl */`
        uniform mat3 uNormalW; varying vec3 vNormalW; varying float vH, vDepth;
        void main(){ vH = position.z; vNormalW = normalize(uNormalW * normal);
          vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0); vDepth = -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: GLSL.fog + /* glsl */`
        uniform vec3 uSky, uGround, uSunColor, uSunDir, uLow, uHigh, uSnow; uniform float uAmbient, uSunAmt, uSnowLine, uFog;
        varying vec3 vNormalW; varying float vH, vDepth;
        void main(){
          vec3 n = normalize(vNormalW); if (!gl_FrontFacing) n = -n;
          vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5) * uAmbient;
          float sun = max(0.0, (dot(n, uSunDir) + 0.25) / 1.25);
          vec3 base = mix(uLow, uHigh, smoothstep(0.0, 1.0, vH));
          float snow = smoothstep(uSnowLine - 0.12, uSnowLine + 0.12, vH + (n.y - 0.75) * 0.5);
          base = mix(base, uSnow, snow);
          vec3 c = base * (amb + uSunColor * uSunAmt * sun);
          c = mix(c, uFogColor, fogAmount(vDepth) * uFog);
          gl_FragColor = vec4(c, 1.0); }`,
      transparent: true, depthTest: true, depthWrite: true, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 256, 128), mat); mesh.frustumCulled = false;
    let built = '';
    const build = (c) => {
      const key = [c.seed, c.scale, c.ridge, c.detail].join(); if (key === built) return; built = key;
      const noise = makeNoise2D(c.seed), pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);           // y = +0.5 far edge, -0.5 near edge
        const nx = (x + 0.5) * c.scale * 3 + c.seed * 0.37, ny = (y + 0.5) * c.scale * 1.5;
        let ridged = 0, smooth = 0, amp = 0.5, freq = 1, w = 1, tot = 0;
        for (let o = 0; o < c.detail; o++) {
          const n = noise(nx * freq, ny * freq);
          let r = 1 - Math.abs(n); r = r * r * w; w = Math.min(1, Math.max(0, r * 2));
          ridged += r * amp; smooth += (n * 0.5 + 0.5) * amp; tot += amp; amp *= 0.5; freq *= 2.1;
        }
        let h = lerp(smooth / tot, ridged / tot, c.ridge);
        h *= 0.45 + 0.55 * (noise(nx * 0.3 + 11, ny * 0.3) * 0.5 + 0.5);   // broad envelope: peaks cluster
        h *= THREE.MathUtils.smoothstep(y, -0.5, -0.15);                      // slope down into the near edge
        pos.setZ(i, h);
      }
      pos.needsUpdate = true; mesh.geometry.computeVertexNormals();
    };
    return {
      object: mesh,
      apply(c) { build(c); const u = mat.uniforms; u.uLow.value.set(c.colorLow); u.uHigh.value.set(c.colorHigh); u.uSnow.value.set(c.snow);
        u.uSnowLine.value = c.snowLine; u.uFog.value = c.fog; mesh.visible = c.visible !== false; },
      frame(c, engine, sceneCfg) {
        const v = engine.viewAt(c.z), o = parallaxOffset(c, engine, v, sceneCfg.parallax);
        mesh.scale.set(c.width * 2 * v.halfW, c.depth * 2 * v.halfH, c.height * 2 * v.halfH);
        mesh.position.set(c.x * (c.xref === 'height' ? v.halfH : v.halfW) + o.x, c.y * v.halfH + o.y, c.z);
        mesh.rotation.set(-Math.PI / 2 + THREE.MathUtils.degToRad(c.tilt), 0, 0);
        mesh.updateMatrixWorld(true); mat.uniforms.uNormalW.value.getNormalMatrix(mesh.matrixWorld);
      },
      dispose() { mat.dispose(); mesh.geometry.dispose(); } };
  } };

/* ============================================================================
   Composition effects. A WebGL pass only sees one plane; the hero text lives in
   the DOM between planes. CSS/SVG filters on #stage see the finished picture.
   Effects run in list order. Overlays (vignette) always sit on top.
   ========================================================================== */
const SVG_NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const el = document.createElementNS(SVG_NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); return el; };
const CompTypes = {};
const CSS_BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

CompTypes.blur = { label: 'Blur', defaults: { px: 3 }, apply(c, ctx) { ctx.parts.push(`blur(${c.px}px)`); } };

CompTypes.color = { label: 'Color', defaults: { brightness: 1, contrast: 1, saturate: 1, hue: 0, sepia: 0, grayscale: 0, invert: 0 },
  apply(c, ctx) { ctx.parts.push(`brightness(${c.brightness}) contrast(${c.contrast}) saturate(${c.saturate}) hue-rotate(${c.hue}deg) sepia(${c.sepia}) grayscale(${c.grayscale}) invert(${c.invert})`); } };

CompTypes.glow = { label: 'Dreamy glow', defaults: { radius: 20, mode: 'screen', amount: 0.5 },
  apply(c, ctx) { const p = ctx.filter();
    p('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: c.radius, result: 'b' });
    const ct = p('feComponentTransfer', { in: 'b', result: 'ba' }); ct.append(svgEl('feFuncA', { type: 'linear', slope: c.amount }));
    p('feBlend', { in: 'ba', in2: 'SourceGraphic', mode: c.mode }); } };

CompTypes.tint = { label: 'Tint', defaults: { color: '#7b84b6', mode: 'soft-light', amount: 0.5 },
  apply(c, ctx) { const p = ctx.filter();
    p('feFlood', { 'flood-color': c.color, 'flood-opacity': c.amount, result: 'f' });
    p('feBlend', { in: 'f', in2: 'SourceGraphic', mode: c.mode }); } };

CompTypes.duotone = { label: 'Duotone', defaults: { shadows: '#3d4470', highlights: '#f6dcc8', amount: 1 },
  apply(c, ctx) { const p = ctx.filter(), a = col(c.shadows), b = col(c.highlights);
    p('feColorMatrix', { in: 'SourceGraphic', type: 'saturate', values: 0, result: 'g' });
    const ct = p('feComponentTransfer', { in: 'g', result: 'd' });
    [['feFuncR', a.r, b.r], ['feFuncG', a.g, b.g], ['feFuncB', a.b, b.b]].forEach(([t, lo, hi]) => ct.append(svgEl(t, { type: 'table', tableValues: lo + ' ' + hi })));
    p('feComposite', { in: 'd', in2: 'SourceGraphic', operator: 'arithmetic', k1: 0, k2: c.amount, k3: 1 - c.amount, k4: 0 }); } };

// Dither tiles, drawn at the cell size so feImage does not smooth them. Bayer 8x8 is ordered; "gradient" is interleaved gradient noise (fine, unstructured).
const BAYER8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
function ditherTile(kind, cell) {
  const n = kind === 'bayer' ? 8 : 64, px = Math.max(1, Math.round(cell)), cv = document.createElement('canvas'); cv.width = cv.height = n * px;
  const g = cv.getContext('2d');
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = kind === 'bayer' ? (BAYER8[y * 8 + x] + 0.5) / 64 : (52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1)) % 1;
    const k = Math.round(v * 255); g.fillStyle = 'rgb(' + k + ',' + k + ',' + k + ')'; g.fillRect(x * px, y * px, px, px);
  }
  return { url: cv.toDataURL(), size: n * px };
}
CompTypes.dither = { label: 'Dither', defaults: { pattern: 'bayer', levels: 2, amount: 1, size: 2, mix: 1, animate: 1, mode: 'duotone', dark: '#1b1a2e', light: '#f2eee4' },
  apply(c, ctx) { const p = ctx.filter(), step = 1 / Math.max(1, c.levels - 1);
    if (c.pattern === 'noise') {
      const n = p('feTurbulence', { type: 'fractalNoise', baseFrequency: (1.9 / c.size).toFixed(3), numOctaves: 1, seed: 1, result: 'raw' });   // > 1 cell per pixel: neighbors decorrelate
      const w = p('feComponentTransfer', { in: 'raw', result: 'pat' });   // fractalNoise sits in ~[0.25, 0.75]: widen to [0, 1]
      for (const ch of ['R', 'G', 'B']) w.append(svgEl('feFunc' + ch, { type: 'linear', slope: 2, intercept: -0.5 }));
      if (c.animate) { let last = -1; ctx.animated.push((t) => { const f = Math.floor(t * 15) % 101; if (f !== last) { last = f; n.setAttribute('seed', f); } }); }
    } else { const t = ditherTile(c.pattern, c.size); p('feImage', { href: t.url, x: 0, y: 0, width: t.size, height: t.size, preserveAspectRatio: 'none', result: 'tile' }); p('feTile', { in: 'tile', result: 'pat' }); }
    // Add one quantization step of the pattern, centered on zero, then snap each channel to the nearest level.
    let src = 'SourceGraphic';
    if (c.mode !== 'rgb') { p('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: '0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0', result: 'lum' }); src = 'lum'; }
    p('feComposite', { in: src, in2: 'pat', operator: 'arithmetic', k1: 0, k2: 1, k3: c.amount * step, k4: -0.5 * c.amount * step, result: 'shifted' });
    const q = p('feComponentTransfer', { in: 'shifted', result: 'q' }), tv = Array.from({ length: c.levels }, (_, i) => (i * step).toFixed(4)).join(' ');
    for (const ch of ['R', 'G', 'B']) q.append(svgEl('feFunc' + ch, { type: 'discrete', tableValues: tv }));
    let out = 'q';
    if (c.mode === 'duotone') { const d = col(c.dark), l = col(c.light), t = p('feComponentTransfer', { in: 'q', result: 'tone' });
      ['R', 'G', 'B'].forEach((ch, i) => t.append(svgEl('feFunc' + ch, { type: 'table', tableValues: [d.r, d.g, d.b][i].toFixed(4) + ' ' + [l.r, l.g, l.b][i].toFixed(4) }))); out = 'tone'; }
    p('feComposite', { in: out, in2: 'SourceGraphic', operator: 'arithmetic', k1: 0, k2: c.mix, k3: 1 - c.mix, k4: 0, result: 'm' });
    p('feComposite', { in: 'm', in2: 'SourceGraphic', operator: 'in' }); } };
CompTypes.grain = { label: 'Film grain', defaults: { amount: 0.2, size: 1, mode: 'overlay', animate: 1 },
  apply(c, ctx) { const p = ctx.filter();
    const n = p('feTurbulence', { type: 'fractalNoise', baseFrequency: (0.9 / c.size).toFixed(3), numOctaves: 2, seed: 1, result: 'n' });
    p('feColorMatrix', { in: 'n', type: 'matrix', values: `0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 0 ${c.amount}`, result: 'g' });
    p('feBlend', { in: 'g', in2: 'SourceGraphic', mode: c.mode });
    if (c.animate) { let last = -1; ctx.animated.push((t) => { const f = Math.floor(t * 12) % 97; if (f !== last) { last = f; n.setAttribute('seed', f); } }); } } };

CompTypes.frost = { label: 'Frosted glass', defaults: { scale: 14, size: 1, drift: 0.2 },
  apply(c, ctx) { const p = ctx.filter();
    p('feTurbulence', { type: 'turbulence', baseFrequency: (0.012 / c.size).toFixed(4), numOctaves: 2, seed: 3, result: 'n' });
    p('feColorMatrix', { in: 'n', type: 'matrix', values: '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0 1', result: 'nq' });   // opaque noise
    const o = p('feOffset', { in: 'nq', dx: 0, dy: 0, result: 'no' });
    // Edge mask: the displacement fades to neutral near the borders so nothing samples outside the picture.
    const pad = c.scale + 6, px = (100 * pad) / ctx.width, py = (100 * pad) / ctx.height;   // port: the stage's size, not the window's
    p('feFlood', { 'flood-color': '#fff', x: px + '%', y: py + '%', width: (100 - 2 * px) + '%', height: (100 - 2 * py) + '%', result: 'inner' });
    p('feGaussianBlur', { in: 'inner', stdDeviation: pad / 2, result: 'm' });
    p('feComposite', { in: 'no', in2: 'm', operator: 'in', result: 'nm' });
    p('feFlood', { 'flood-color': '#808080', result: 'gray' });
    p('feComposite', { in: 'nm', in2: 'gray', operator: 'over', result: 'map' });
    p('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: c.scale, xChannelSelector: 'R', yChannelSelector: 'G' });
    if (c.drift > 0) ctx.animated.push((t) => { o.setAttribute('dx', (Math.sin(t * c.drift * 0.6) * 40).toFixed(1)); o.setAttribute('dy', (Math.cos(t * c.drift * 0.45) * 40).toFixed(1)); }); } };

CompTypes.aberration = { label: 'Chromatic aberration', defaults: { px: 2 },
  apply(c, ctx) { const p = ctx.filter();
    const chan = (row, name) => p('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: row, result: name });
    chan('1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 'r'); chan('0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 'g'); chan('0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 'b');
    p('feOffset', { in: 'r', dx: c.px, dy: 0, result: 'ro' }); p('feOffset', { in: 'b', dx: -c.px, dy: 0, result: 'bo' });
    p('feComposite', { in: 'ro', in2: 'g', operator: 'arithmetic', k2: 1, k3: 1, result: 'rg' });
    p('feComposite', { in: 'rg', in2: 'bo', operator: 'arithmetic', k2: 1, k3: 1 }); } };

CompTypes.sharpen = { label: 'Sharpen', defaults: { amount: 0.6 }, apply(c, ctx) { const p = ctx.filter(), a = c.amount;
    p('feConvolveMatrix', { in: 'SourceGraphic', order: 3, kernelMatrix: `0 ${-a} 0 ${-a} ${1 + 4 * a} ${-a} 0 ${-a} 0`, preserveAlpha: 'true' }); } };

// Adjustments: per-channel transfer curves sampled into feComponentTransfer tables.
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const curveTable = (fn) => Array.from({ length: 33 }, (_, i) => clamp01(fn(i / 32)).toFixed(4)).join(' ');
function transfer(p, fr, fg, fb, attrs = {}) { const ct = p('feComponentTransfer', attrs);
  [['feFuncR', fr], ['feFuncG', fg], ['feFuncB', fb]].forEach(([t, f]) => ct.append(svgEl(t, { type: 'table', tableValues: curveTable(f) }))); return ct; }

CompTypes.levels = { label: 'Adjust: Levels', defaults: { inBlack: 0, inWhite: 1, gamma: 1, outBlack: 0, outWhite: 1 },
  apply(c, ctx) { const p = ctx.filter(); const f = (v) => Math.pow(clamp01((v - c.inBlack) / Math.max(0.001, c.inWhite - c.inBlack)), 1 / c.gamma) * (c.outWhite - c.outBlack) + c.outBlack;
    transfer(p, f, f, f); } };

CompTypes.exposure = { label: 'Adjust: Exposure', defaults: { exposure: 0, offset: 0, gamma: 1 },
  apply(c, ctx) { const p = ctx.filter(); const f = (v) => Math.pow(clamp01(v * Math.pow(2, c.exposure) + c.offset), 1 / c.gamma); transfer(p, f, f, f); } };

CompTypes.curves = { label: 'Adjust: Curves', defaults: { contrast: 0, shadows: 0, highlights: 0, red: 0, green: 0, blue: 0 },
  apply(c, ctx) { const p = ctx.filter();
    const master = (v) => { let o = v + c.contrast * 0.5 * (v - 0.5) * (1 - Math.abs(2 * v - 1));   // S-curve around the midpoint
      o += c.shadows * 0.35 * Math.pow(1 - v, 2) * v * 3; o += c.highlights * 0.35 * v * v * (1 - v) * 3; return o; };
    const ch = (k) => (v) => master(v) + k * 0.3 * 4 * v * (1 - v);
    transfer(p, ch(c.red), ch(c.green), ch(c.blue)); } };

CompTypes.balance = { label: 'Adjust: Color balance', defaults: { sR: 0, sG: 0, sB: 0, mR: 0, mG: 0, mB: 0, hR: 0, hG: 0, hB: 0 },
  apply(c, ctx) { const p = ctx.filter();
    const ch = (sh, mid, hi) => (v) => v + 0.2 * (sh * Math.pow(1 - v, 2) + mid * (1 - Math.abs(2 * v - 1)) + hi * v * v);
    transfer(p, ch(c.sR, c.mR, c.hR), ch(c.sG, c.mG, c.hG), ch(c.sB, c.mB, c.hB)); } };

CompTypes.hsl = { label: 'Adjust: Hue / Saturation', defaults: { hue: 0, saturation: 0, lightness: 0, colorize: 0, color: '#8a7fc0' },
  apply(c, ctx) { const p = ctx.filter();
    p('feColorMatrix', { in: 'SourceGraphic', type: 'hueRotate', values: c.hue, result: 'h' });
    p('feColorMatrix', { in: 'h', type: 'saturate', values: Math.max(0, 1 + c.saturation), result: 's' });
    const f = (v) => c.lightness >= 0 ? v + (1 - v) * c.lightness : v * (1 + c.lightness);
    transfer(p, f, f, f, { in: 's', result: 'l' });
    if (c.colorize > 0) { const k = col(c.color);
      p('feColorMatrix', { in: 'l', type: 'saturate', values: 0, result: 'g' });
      const ct = p('feComponentTransfer', { in: 'g', result: 'cz' });
      [['feFuncR', k.r], ['feFuncG', k.g], ['feFuncB', k.b]].forEach(([t, v]) => ct.append(svgEl(t, { type: 'table', tableValues: '0 ' + v.toFixed(3) + ' 1' })));
      p('feComposite', { in: 'cz', in2: 'l', operator: 'arithmetic', k2: c.colorize, k3: 1 - c.colorize }); } } };

CompTypes.vignette = { label: 'Vignette (overlay)', defaults: { color: '#2b2f4a', amount: 0.5, size: 0.75, softness: 0.5, mode: 'multiply' },
  apply(c, ctx) { const el = document.createElement('div'); const r0 = c.size * 75 * (1 - c.softness), r1 = c.size * 75 * (1 + c.softness);
    el.style.cssText = `position:absolute;inset:0;pointer-events:none;opacity:${c.amount};mix-blend-mode:${c.mode};background:radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) ${r0}%, ${c.color} ${r1}%)`;
    ctx.overlay.append(el); } };

// port: filters live in an svg inside the stage's root, with ids unique to this instance; the overlays sit above the canvas.
class Composition {
  constructor(stage, defsHost, idPrefix) {
    this.stage = stage; this.animated = []; this.idPrefix = idPrefix; this.width = 1; this.height = 1;
    this.svg = svgEl('svg', { width: 0, height: 0, style: 'position:absolute;width:0;height:0;overflow:hidden', 'aria-hidden': 'true' }); defsHost.append(this.svg);
    this.overlay = document.createElement('div'); this.overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    this.list = null;
  }
  apply(list) {
    this.list = list; this.svg.replaceChildren(); this.overlay.replaceChildren(); this.animated = [];
    const parts = [];
    (list || []).forEach((c, i) => {
      if (c.type === 'noise') c.type = 'dither';
      if (c.enabled === false || !CompTypes[c.type]) return;
      for (const [k, v] of Object.entries(CompTypes[c.type].defaults)) if (!(k in c)) c[k] = clone(v);
      const ctx = { parts, overlay: this.overlay, animated: this.animated, width: this.width, height: this.height,
        filter: () => { const id = this.idPrefix + '-' + i; const f = svgEl('filter', { id, x: '-8%', y: '-8%', width: '116%', height: '116%', 'color-interpolation-filters': 'sRGB' });
          this.svg.append(f); parts.push(`url(#${id})`); return (tag, attrs) => { const el = svgEl(tag, attrs); f.append(el); return el; }; } };
      CompTypes[c.type].apply(c, ctx);
    });
    this.stage.style.filter = parts.join(' ');
    if (this.stage.lastElementChild !== this.overlay) this.stage.append(this.overlay);
  }
  // The app rebuilt the effects on every window resize; only the frosted glass edge mask depends on the size.
  setSize(w, h) {
    if (w === this.width && h === this.height) return; this.width = w; this.height = h;
    if (this.list && this.list.some((c) => c.type === 'frost' && c.enabled !== false)) this.apply(this.list);
  }
  tick(time, reduceMotion) { if (reduceMotion) return; for (const a of this.animated) a(time); }
}

const SCENE_DEFAULTS = { planes: 2, bodyBg: '#d6d5ec', camera: { fov: 35, z: 10 }, parallax: 1, quality: { samples: 4, scale: 1 }, fog: { color: '#d6d5ec', density: 0.04, start: 8 },
  light: { sky: '#ffffff', ground: '#9b95b8', ambient: 0.9, sun: '#fff1dc', sunAmt: 0.9, sunX: 0.5, sunY: 0.7 },
  copy: { title: '', body: '', color: '#2b2f4a' } };

/* ============================================================================
   Runtime: one scene's layers, kept in sync with the engine (the app's App, without editing and persistence)
   ========================================================================== */
class Runtime {
  constructor(engine, comp) {
    this.engine = engine; this.comp = comp;
    this.runtime = new Map();   // layer id -> instance
    this.scene = null;
    this.engine.onFrame = () => this.frame();
  }
  show(def) {
    this.teardown();
    this.scene = def;
    this.engine.setPlanes(def.planes);
    this.engine.setCamera(def.camera);
    this.applySceneSettings();
    def.layers.forEach((l) => this.mount(l));
    this.syncOrder();
    this.engine.setPost(def.post);
    if (!def.comp) def.comp = []; this.comp.apply(def.comp);
  }
  teardown() {
    for (const inst of this.runtime.values()) { this.engine.scene.remove(inst.object); inst.dispose(); }
    this.runtime.clear();
  }
  // port: page colour, hero copy and copy colour belonged to the app's demo page; the host owns those.
  applySceneSettings() {
    const s = this.scene, sh = this.engine.shared;
    sh.fogColor.value.set(s.fog.color); sh.fogDensity.value = s.fog.density; sh.fogStart.value = s.fog.start;
    if (!s.light) s.light = clone(SCENE_DEFAULTS.light); this.engine.setLight(s.light);
    if (!s.quality) s.quality = clone(SCENE_DEFAULTS.quality); this.engine.setQuality(s.quality);
    this.engine.setPlaneBlend(s.planeBlend || []);
    this.engine.setCamera(s.camera);
  }
  mount(cfg) {
    for (const [k, v] of Object.entries(LayerTypes[cfg.type].defaults)) if (!(k in cfg)) cfg[k] = clone(v);
    if (cfg.blend === 'additive') cfg.blend = 'add';   // the image layer's old GL-blend name   // options added after the layer was saved
    const inst = LayerTypes[cfg.type].create(cfg, this.engine);
    inst.object.traverse((o) => o.layers.set(Math.min(cfg.plane, this.scene.planes - 1)));
    inst.apply(cfg); this.engine.scene.add(inst.object); this.runtime.set(cfg.id, inst);
  }
  syncOrder() {
    this.scene.layers.forEach((l, i) => { const inst = this.runtime.get(l.id); if (inst) inst.object.traverse((o) => (o.renderOrder = i)); });
    this.engine.setPlan(this.scene.layers.map((l) => { const inst = this.runtime.get(l.id); return inst && { object: inst.object, plane: Math.min(l.plane, this.scene.planes - 1), blend: l.blend || 'normal', amount: l.blendAmt ?? 1 }; }).filter(Boolean));
  }
  frame() { if (!this.scene) return; this.comp.tick(this.engine.time, this.engine.reduceMotion); for (const l of this.scene.layers) { const inst = this.runtime.get(l.id); if (inst && inst.object.visible) inst.frame(l, this.engine, this.scene); } }
}

/* ============================================================================
   Mount
   ========================================================================== */
let mounted = 0;
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export async function mountStage(container, { sceneUrl, assetBase, maxDpr = 1.5, onReady } = {}) {
  if (!container) throw new Error('mountStage: no container');
  const sceneHref = new URL(sceneUrl, document.baseURI).href;
  const res = await fetch(sceneHref);
  if (!res.ok) throw new Error('mountStage: ' + sceneHref + ' answered ' + res.status);
  const config = await res.json();
  if (!config || !Array.isArray(config.scenes) || !config.scenes.length) throw new Error('mountStage: not a layered-stage config');
  const def = config.scenes.find((s) => s.id === config.current) || config.scenes[0];
  // './assets/…' in the scene resolves against assetBase; without one, against the folder scene.json is in.
  let base = assetBase == null ? new URL('.', sceneHref).href : new URL(assetBase, document.baseURI).href;
  if (!base.endsWith('/')) base += '/';

  // root clips the composition filters (their region reaches 8% past the stage); stage carries them.
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  const root = document.createElement('div');
  root.className = 'rovn-stage'; root.setAttribute('aria-hidden', 'true');
  root.style.cssText = 'position:absolute;inset:0;overflow:hidden;contain:strict;pointer-events:none';
  const stage = document.createElement('div');
  stage.style.cssText = 'position:absolute;inset:0;pointer-events:none;visibility:hidden';   // shown once the first full frame is drawn
  root.append(stage); container.append(root);

  const engine = new Engine(stage, { maxDpr, assetBase: base });
  const comp = new Composition(stage, root, 'rovn-stage-' + (++mounted) + uid());
  const runtime = new Runtime(engine, comp);
  let width = root.clientWidth, height = root.clientHeight;
  engine.setSize(width, height); comp.setSize(width, height);
  runtime.show(def);

  let raf = 0, running = false, paused = false, visible = true, ready = false, destroyed = false, progress = 0;
  const tick = () => { raf = requestAnimationFrame(tick); engine.frame(); };
  const update = () => {
    const want = ready && !paused && visible && !destroyed;
    if (want === running) return;
    running = want;
    if (want) { engine.clock.getDelta(); raf = requestAnimationFrame(tick); }   // drop the time spent stopped, as if it had not passed
    else { cancelAnimationFrame(raf); raf = 0; }
  };

  // Resizing a canvas clears it, and the observer runs after this frame's draw: draw again so no blank frame shows.
  const ro = new ResizeObserver((entries) => {
    const r = entries[entries.length - 1].contentRect;
    if (r.width === width && r.height === height) return;
    width = r.width; height = r.height;
    engine.setSize(width, height); comp.setSize(width, height);
    if (ready && !destroyed) engine.frame(false);
  });
  ro.observe(root);
  const io = new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; update(); });
  io.observe(root);

  const api = {
    setPointer(nx, ny) { engine.pointer.tx = +nx || 0; engine.pointer.ty = +ny || 0; },
    setPaused(p) { paused = !!p; update(); },
    setProgress(p) { progress = +p || 0; },   // no scroll-linked behaviour yet
    renderOnce() { if (ready && !destroyed) engine.frame(false); },
    destroy() {
      if (destroyed) return; destroyed = true; update();
      ro.disconnect(); io.disconnect();
      runtime.teardown(); engine.dispose(); root.remove();
    },
  };

  engine.settled().then(async () => {
    if (destroyed) return;
    engine.frame();   // the first frame, at time 0
    stage.style.visibility = '';
    ready = true; update();
    await nextFrame(); await nextFrame();   // that frame has been composited
    if (!destroyed && onReady) onReady(api);
  });
  return api;
}
