/* <rovn-atmos> — layered amber atmospheres for Rōvn. WebGL2, no images, no dependencies.
 *
 *   <rovn-atmos look="peaks">…content…</rovn-atmos>
 *
 * Each look is a fixed, composed vista built from planes at real depths (far ridges, peaks, cloud banks, near
 * shoulders). The camera only sways slowly, so depth reads through parallax while fog banks drift between the planes.
 *
 * Looks
 *   peaks   peaks and a long ridge standing in a sea of amber cloud that drifts through the valleys
 *   lake    a pine spit mirrored in a still lake; mist rolls over the water, the cursor leaves rings
 *
 * Attributes
 *   look           peaks | lake                                  (default peaks)
 *   intensity      0–2 multiplier on motion; 0 freezes it        (default 1)
 *   clear          scroll | manual — fog starts dense and lifts as the section scrolls (or via el.progress)
 *   scroll-target  selector measured for clear="scroll"          (default: the element itself)
 *   reverse        with clear: clear → fogged instead
 *   resolution     max device-pixel ratio for the canvas         (default 1.5)
 *
 * Content inside the element sits above the canvas. Size the element with CSS. The cursor sways the camera a
 * little. Respects prefers-reduced-motion (still frames), pauses offscreen and in hidden tabs, falls back to a
 * CSS gradient without WebGL2.
 */
(() => {
  if (typeof window === 'undefined' || customElements.get('rovn-atmos')) return;

  const LOOKS = { peaks: 0, lake: 1, bloom: 2 };
  const FALLBACK = {
    peaks: 'radial-gradient(70% 50% at 45% 48%, #F2A548 0%, transparent 70%), linear-gradient(180deg, #CC5E06 0%, #E28A2C 48%, #B8501A 100%)',
    bloom: 'radial-gradient(40% 50% at 62% 30%, #F6B077 0%, transparent 70%), linear-gradient(160deg, #C7621C 0%, #E38B35 50%, #F2B266 100%)',
    lake: 'radial-gradient(70% 40% at 55% 45%, #F7B85A 0%, transparent 70%), linear-gradient(180deg, #E58A22 0%, #F0A23C 45%, #C4501A 100%)',
  };

  const VERT = `#version 300 es
in vec2 aPos; out vec2 vUv;
void main(){ vUv = vec2(aPos.x * .5 + .5, .5 - aPos.y * .5); gl_Position = vec4(aPos, 0., 1.); }`;

  const FRAG = (look) => `#version 300 es
precision highp float;
#define LOOK ${look}
in vec2 vUv; out vec4 o;
uniform sampler2D uN;
uniform vec2 uRes, uPar;
uniform float uTime, uClarity, uIntensity;
uniform vec4 uRip[6];

const float ASPECT = 16. / 9.;
const mat2 M2 = mat2(.8, -.6, .6, .8);
float T;
vec2 CAM;

float n2(vec2 x){ vec2 p = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return textureLod(uN, (p + f + .5) / 256., 0.).x; }
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * n2(p); p = M2 * p * 2.02; a *= .5; } return v; }
float ridged(float x, float s){
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++){ float n = 1. - abs(n2(vec2(x, s)) * 2. - 1.); v += a * n * n; x *= 2.13; s += 7.1; a *= .5; }
  return v;
}
float hash(float x){ return fract(sin(x * 127.1) * 43758.5453); }
float cone(float x, float cx, float top, float sl, float sr){ return top + (x < cx ? (cx - x) * sl : (x - cx) * sr); }

// composition uv on a 16:9 frame, cropped like object-fit: cover (y down)
vec2 frame(vec2 uv, float zoom){
  float ca = uRes.x / uRes.y;
  vec2 vis = ca > ASPECT ? vec2(1., ASPECT / ca) : vec2(ca / ASPECT, 1.);
  vis /= zoom;
  return (1. - vis) * .5 + uv * vis;
}
// a plane at depth z: nearer planes shift more as the camera sways (parallax)
vec2 L(vec2 p, float z){ return p + CAM / z; }

// a drifting bank of fog on the plane at depth z, centred on height yc
float bank(vec2 p, float z, float yc, float th, float speed, float seed){
  vec2 q = L(p, z);
  float sc = .7 + z * .35;
  vec2 s = vec2((q.x + T * speed / z) * 1.3, q.y * 5.) * sc + seed;
  s += (vec2(fbm(s * .45 + vec2(T * .05, 0.)), fbm(s * .45 + vec2(4.3, T * .03))) - .5) * 1.4;
  float band = exp(-pow((q.y - yc) / th, 2.));
  return smoothstep(.34, .72, fbm(s)) * band;
}
// dense fog that burns off as clarity rises: lifts off the high ground first, lingers low
float denseFog(vec2 p){
  float n = fbm(p * vec2(2., 3.) + vec2(T * .012, 0.) + (fbm(p * 1.3 + T * .01) - .5)) * .62 + p.y * .42;
  float thr = mix(-.12, 1.12, uClarity);
  return smoothstep(thr - .22, thr + .22, n);
}

#if LOOK == 0
// ======================= peaks =======================
const vec3 SKY_TOP = vec3(.86, .41, .05);
const vec3 GLOW    = vec3(1., .71, .33);
const vec3 LOW     = vec3(.91, .51, .11);
const vec3 RED     = vec3(.80, .25, .03);
const vec3 HAZE    = vec3(.99, .68, .32);
const vec3 ROCK    = vec3(.84, .38, .07);

vec3 scene(vec2 p, float aa, out float fogAmt){
  float fm = mix(2.2, 1., uClarity);
  // sky
  vec3 c = mix(SKY_TOP, GLOW, smoothstep(.04, .52, p.y));
  c = mix(c, LOW, smoothstep(.56, .98, p.y));
  vec2 sp = L(vec2(.47, .43), 14.);
  vec2 sd = (p - sp) * vec2(ASPECT, 1.);
  c += vec3(.9, .5, .2) * (exp(-dot(sd, sd) / .02) * .14 + exp(-dot(sd, sd) / .2) * .08);
  c = mix(c, RED, clamp(exp(-pow(p.x / .16, 2.) - pow((p.y - .24) / .2, 2.)) * .6 + exp(-pow((1. - p.x) / .12, 2.) - pow((p.y - .5) / .14, 2.)) * .45, 0., 1.));

  // far range
  vec2 q = L(p, 7.);
  float hF = .478 - ridged(q.x * 4., 1.) * .045;
  c = mix(c, mix(HAZE, ROCK, .25), smoothstep(-aa, aa, p.y - hF) * .5 * (1. - smoothstep(.48, .56, p.y)));
  c = mix(c, HAZE, bank(p, 5., .50, .05, .03, 2.) * .7 * fm);

  // the peaks
  q = L(p, 3.);
  // pointed massifs broken up by ridged noise: sharp, irregular crests that never repeat
  float pk1 = exp(-abs(q.x - .335) / .022) * .6 + exp(-pow((q.x - .335) / .035, 2.)) * .4;
  float pk2 = exp(-abs(q.x - .618) / .03) * .55 + exp(-pow((q.x - .625) / .05, 2.)) * .45;
  float env = .64 - .13 * pk1 - .2 * pk2 - .12 * exp(-abs(q.x - .67) / .05);
  float rr = .556 - (q.x - .70) * .33;
  env = min(env, mix(.66, rr, smoothstep(.6, .82, q.x)));                         // the long ridge rising to the right
  float summit = smoothstep(.63, .47, env);
  float hP = env - ((ridged(q.x * 6.5, 3.) - .3) * .11 + (ridged(q.x * 23., 8.) - .3) * .035) * summit;
  float crag = smoothstep(.62, .40, hP);                                         // more broken toward the summits
  hP += (n2(vec2(q.x * 90., 2.)) - .5) * .005 * crag;
  float soft = .0045 + aa;
  float m = smoothstep(-soft, soft, p.y - hP) * (1. - smoothstep(.49, .66, p.y));
  vec3 rock = mix(ROCK, RED, smoothstep(.72, 1.02, q.x) * .85);
  rock = mix(rock, HAZE, smoothstep(.0, .12, p.y - hP) * .35);
  c = mix(c, rock, m * .82);
  c += vec3(1., .66, .32) * exp(-pow((p.y - hP + .003) / .004, 2.)) * .08 * (1. - smoothstep(.5, .6, p.y));   // sunlit crest

  float b0 = bank(p, 2.8, .515, .045, .05, 17.);
  c = mix(c, mix(HAZE, vec3(1., .8, .5), .3), clamp(b0 * .75 * fm, 0., .85));   // a veil drifting across the peaks
  // the cloud sea
  float b1 = bank(p, 2.6, .565, .07, .055, 5.);
  float b2 = bank(p, 2.0, .645, .09, .065, 9.);
  float b3 = bank(p, 1.5, .76, .13, .08, 13.);
  vec3 seaTop = mix(HAZE, vec3(1., .80, .48), .4);
  c = mix(c, mix(LOW, HAZE, .55), smoothstep(.56, .84, p.y) * .55);
  c = mix(c, seaTop, clamp(b1 * .95 * fm, 0., .94));
  c = mix(c, HAZE, clamp(b2 * .85 * fm, 0., .92));

  // a near shoulder for depth, then the nearest bank
  q = L(p, 1.25);
  float hN = .80 + pow(abs(q.x - .1), 1.5) * .5 + (ridged(q.x * 6., 11.) - .33) * .04;
  c = mix(c, mix(ROCK, RED, .35), smoothstep(-.02, .02, p.y - hN) * .3);
  c = mix(c, HAZE, clamp(b3 * .75 * fm, 0., .9));

  fogAmt = 1.;
  return c;
}
#elif LOOK == 1
// ======================= lake =======================
const float H = .5;
const vec3 SKY_T  = vec3(.98, .70, .24);
const vec3 SKY_H  = vec3(.96, .60, .16);
const vec3 HILL   = vec3(.93, .50, .11);
const vec3 PINE   = vec3(.80, .25, .04);
const vec3 PINE_F = vec3(.90, .42, .09);
const vec3 WAT_T  = vec3(.95, .57, .14);
const vec3 WAT_B  = vec3(.86, .29, .05);

// a dense, spiky treeline: one pine per cell, tiered branches, tallest at the base of the spit
float treeline(vec2 q, float shore, float w, float hMax, float tipX, float aa){
  float m = 0.;
  float cell = floor(q.x / w);
  for (int k = -2; k <= 2; k++){
    float id = cell + float(k);
    float r = hash(id), r2 = hash(id + 17.3);
    float cx = (id + .5 + (r - .5) * .7) * w;
    float h = hMax * (.5 + .5 * r2) * smoothstep(tipX + .02, tipX - .12, cx) * (.8 + .3 * hash(id + 3.1));
    if (h <= 0.) continue;
    float top = shore - h;
    float t = (q.y - top) / h;
    if (t < 0. || t > 1.2) continue;
    float tiers = 7. + r * 4.;
    float tf = fract(t * tiers + r);
    float hw = w * 1.2 * pow(t, .85) * (.45 + .55 * pow(tf, 1.5)) + .0006;      // drooping tiers
    hw += (n2(vec2(q.y * 700., id)) - .5) * .004 * t;
    m = max(m, smoothstep(aa, -aa, abs(q.x - cx) - hw) * smoothstep(0., .02, t));
  }
  return m;
}

vec3 above(vec2 p, float aa){
  vec3 c = mix(SKY_T, SKY_H, smoothstep(.0, .48, p.y));
  vec2 cq = L(p, 18.);
  float cl = fbm(cq * vec2(2.2, 6.) + vec2(T * .006, 0.) + fbm(cq * 3.) * .5);
  c = mix(c, vec3(1., .82, .5), smoothstep(.48, .75, cl) * .4 * (1. - smoothstep(.05, .32, p.y)));
  vec2 sd = (p - L(vec2(.64, .40), 14.)) * vec2(ASPECT, 1.);
  c += vec3(.9, .55, .22) * (exp(-dot(sd, sd) / .015) * .12 + exp(-dot(sd, sd) / .15) * .07);

  // far hills
  vec2 q = L(p, 7.);
  float hf = .40 - ridged(q.x * 2.5, 21.) * .07 - smoothstep(.55, 1.1, q.x) * .03;
  c = mix(c, mix(SKY_H, HILL, .6), smoothstep(-.006 - aa, .006 + aa, p.y - hf) * .35);
  q = L(p, 5.);
  float hl = .17 + pow(abs(q.x - .13), 1.3) * .95 + (ridged(q.x * 5., 4.) - .33) * .03;
  c = mix(c, HILL, smoothstep(-.004 - aa, .004 + aa, p.y - hl) * .32 * (1. - smoothstep(.35, .7, q.x)));
  // far shore treeline on the right
  q = L(p, 5.5);
  float fs = treeline(q, H - .012, .007, .03, 1.3, aa) * smoothstep(.45, .6, q.x);
  c = mix(c, mix(HILL, PINE_F, .4), max(fs, smoothstep(-aa, aa, q.y - (H - .014)) * smoothstep(.45, .6, q.x)) * .4);
  c = mix(c, SKY_H, bank(p, 4., .43, .05, .06, 3.) * .55);

  // the pine spit
  q = L(p, 1.6);
  float shore = H - .008;
  float spit = smoothstep(-aa, aa, q.y - (shore - .012 + smoothstep(.3, .42, q.x) * .01)) * smoothstep(.43, .38, q.x + (q.y - shore) * 2.);
  float under = smoothstep(-aa, aa, q.y - (shore - .07 - (n2(vec2(q.x * 60., 2.)) - .5) * .03)) * smoothstep(.36, .3, q.x);
  float pines = max(treeline(q, shore, .017, .27, .36, aa), treeline(q + vec2(.009, 0.), shore + .004, .013, .15, .33, aa));
  float fade = smoothstep(.3, H, p.y);
  vec3 pc = mix(PINE, PINE_F, smoothstep(.15, .36, q.x) * .5);
  pc = mix(pc, SKY_H, fade * .25);
  c = mix(c, pc, max(max(spit, under), pines) * .92);
  return c;
}

float w0off(vec2 p){ return fbm(p * vec2(3., 12.)) * 6.; }
vec3 scene(vec2 p, float aa, out float fogAmt){
  vec3 c;
  float d = p.y - H;
  if (d <= 0.) c = above(p, aa);
  else {
    // swell: horizontal ripples, finer toward the horizon
    float pz = 1. / (d + .03);
    vec2 wq = vec2(p.x * 24. + w0off(p), pz * 1.4 + T * .9);
    float w1 = n2(wq) - .5, w2 = n2(wq * vec2(.5, 2.1) + 9.) - .5;
    float k = smoothstep(0., .3, d) * uIntensity;
    vec2 disp = vec2(w1 * .0015, (w1 * .6 + w2) * .006 * (d + .1)) * k;
    float crest = 0.;
    vec2 asp = vec2(uRes.x / uRes.y, 2.8);
    for (int i = 0; i < 6; i++){
      vec4 r = uRip[i];
      if (r.w <= 0.) continue;
      vec2 v = (vUv - r.xy) * asp;
      float dist = length(v), rad = r.z * .14;
      float env = exp(-pow((dist - rad) / .035, 2.)) * exp(-r.z * .8) * r.w;
      float wv = sin((dist - rad) * 110.) * env;
      disp += v / max(dist, 1e-4) / asp * wv * .012;
      crest += max(wv, 0.) * .6 + env * .2;
    }
    vec2 mp = vec2(p.x + disp.x, H - d + disp.y);
    vec3 refl = above(mp, aa + d * .03);
    vec3 water = mix(WAT_T, WAT_B, smoothstep(0., .48, d));
    water = mix(water, PINE * 1.05, (1. - smoothstep(.0, .5, p.x)) * smoothstep(.05, .45, d) * .35);
    c = mix(water, refl * vec3(.99, .9, .84), .88 * exp(-d * 1.9));
    c += vec3(1., .78, .45) * crest * .08;
  }
  // mist rolling over the water
  float fm = mix(2.4, 1., uClarity);
  c = mix(c, mix(SKY_H, vec3(1., .82, .52), .4), clamp(bank(p, 1.8, H - .01, .035, .14, 7.) * .8 * fm, 0., .9));
  c = mix(c, mix(SKY_H, vec3(1., .8, .5), .3), clamp(bank(p, 1.1, H + .09, .07, .18, 11.) * .6 * fm, 0., .85));
  fogAmt = 1.;
  return c;
}
#else
// ======================= bloom =======================
// Amber take on the "lost tulips" stage: a drifting mesh-gradient field, two tulips that sway in it at the same
// value so they blur into it, and petals that glow as the one hot thing in the frame.
const vec3 BASE = vec3(.89, .55, .22);
const vec3 HAZE = vec3(.97, .74, .44);
const vec3 GLOW = vec3(1., .60, .42);
const vec3 HOT  = vec3(1., .86, .70);
const vec3 DEEP = vec3(.88, .33, .20);

vec3 field(vec2 uv){
  float a = uRes.x / uRes.y; vec2 p = uv * vec2(a, 1.);
  float t = T * .12;
  p += .09 * (vec2(fbm(p * 1.1 + vec2(t * .5, 0.)), fbm(p * 1.1 + vec2(5., t * .5))) - .5) * 2.;
  vec3 C[5] = vec3[5](vec3(.78, .38, .11), vec3(.96, .70, .40), vec3(.86, .47, .16), vec3(.93, .60, .27), vec3(.98, .79, .52));
  vec3 acc = BASE * .05; float ws = .05;
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    vec2 b = (vec2(.5) + .5 * vec2(sin(t * .61 + fi * 1.9 + .6 * sin(t * .27 + fi)), cos(t * .47 + fi * 2.7 + .6 * cos(t * .19 + fi * .7)))) * vec2(a, 1.);
    float d = distance(p, b), w = exp(-d * d / .25);
    acc += C[i] * w; ws += w;
  }
  return acc / ws;
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float ell(vec2 p, vec2 r){ return (length(p / r) - 1.) * min(r.x, r.y); }
float leaf(vec2 p, float ang, float len, float w, float curve){
  p = rot(ang) * p;
  float t = p.y / len;
  float x = p.x - curve * len * t * t;
  float hw = w * pow(max(sin(3.1416 * clamp(t, 0., 1.)), 0.), .75);
  float d = abs(x) - hw;
  return max(d, max(-p.y, p.y - len));
}
// one tulip in its own space: base at the origin, y up, about 1 unit tall. Returns plant distance; cup distance + cup coords out.
float tulip(vec2 p, float sway, out float cup, out vec2 cq){
  p.x -= sway * p.y * p.y;                                   // the whole plant bends from the base
  float stemX = .035 * sin(p.y * 2.2);
  float stem = max(abs(p.x - stemX) - .014, max(-p.y, p.y - .8));
  float lv = min(leaf(p - vec2(-.005, .0), .5, .78, .1, -.32), leaf(p - vec2(.01, .03), -.4, .86, .095, .3));
  vec2 c = vec2(.035 * sin(.8 * 2.2), .87);
  cq = p - c;
  vec2 k = cq;
  float body = ell(k - vec2(0., -.015), vec2(.092, .098));
  float pc = ell(k - vec2(.004, .03), vec2(.055, .118));
  float pl = ell(rot(-.42) * (k - vec2(-.045, .022)), vec2(.048, .108));
  float pr = ell(rot(.38) * (k - vec2(.044, .02)), vec2(.048, .104));
  cup = min(body, min(pc, min(pl, pr)));
  return min(stem, lv);
}
vec3 drawTulip(vec3 col, vec2 p, vec2 base, float size, float soft, float fogAmt, float glowAmt, float sway, float phase){
  vec2 tp = (p - base) * vec2(ASPECT, -1.) / size;            // screen → tulip space (y up)
  float s = sway * (sin(T * .55 + phase) * .8 + sin(T * 1.17 + phase * 2.) * .35);
  float cup; vec2 cq;
  float plant = tulip(tp, s, cup, cq);
  float fade = smoothstep(-.05, .55, tp.y);                    // stems dissolve into the field toward the bottom
  vec3 shade = mix(col * vec3(.84, .70, .64), col, fogAmt);
  float aP = smoothstep(soft, -soft, plant) * fade;
  col = mix(col, shade, aP * .9);
  float aC = smoothstep(soft * .75, -soft * .75, cup);
  vec3 petal = mix(DEEP, GLOW, smoothstep(-.12, .1, cq.y));
  petal = mix(petal, HOT, exp(-dot(cq - vec2(0., .04), cq - vec2(0., .04)) / .004) * .5);
  petal = mix(petal, col, fogAmt * .55);
  col = mix(col, petal, aC * glowAmt);
  float halo = exp(-max(cup, 0.) / (soft * 1.4 + .035)) * (1. - aC);
  col = 1. - (1. - col) * (1. - GLOW * halo * .22 * glowAmt);   // screen: haze spreads past the petals
  return col;
}

vec3 scene(vec2 p, float aa, out float fogAmt){
  vec3 col = field(p);
  vec2 par = CAM;
  col = drawTulip(col, p + par * .14, vec2(.29, 1.05), .6, .045, .5, .6, .05, 1.3);
  col = drawTulip(col, p + par * .35, vec2(.62, 1.08), .9, .02, .08, .95, .06, 0.);
  fogAmt = 1.;
  return col;
}
#endif

void main(){
  T = uTime * uIntensity + 30.;
  CAM = vec2(sin(T * .16) * .04 + sin(T * .061) * .025 + uPar.x * .07, uPar.y * .02);
  float zoom = mix(1.08, 1.0, smoothstep(0., 1., uClarity));
  vec2 p = frame(vUv, zoom);
#if LOOK == 2
  // glass ripple: a slow refraction over the whole frame, plus a fine frosted break-up
  vec2 rp = vUv * vec2(uRes.x / uRes.y, 1.) * 2.5;
  p += ((vec2(fbm(rp + vec2(T * .1, 0.)), fbm(rp + vec2(7.3, T * .1))) - .5) * 2. + (vec2(n2(rp * 9.), n2(rp * 9. + 2.)) - .5) * .6) * .006;
#endif
  float aa = fwidth(p.y) * .8;
  float f;
  vec3 col = scene(p, aa, f);
#if LOOK == 1
  vec3 haze = mix(SKY_H, vec3(1., .82, .52), .25);
#else
  vec3 haze = HAZE;
#endif
  float dense = denseFog(p);
  col = mix(col, haze + (vec3(1., .9, .72) - haze) * .2 * dense, dense * .97);
  vec2 q = vUv - .5;
  col *= mix(vec3(1.), vec3(.96, .86, .8), smoothstep(.45, 1.1, length(q * vec2(1.1, 1.3))));   // warm edges, never grey
#if LOOK == 2
  vec2 gs = gl_FragCoord.xy + fract(vec2(uTime * 13.7, uTime * 7.1)) * 100.;
  float gn = fract(sin(dot(gs, vec2(12.9898, 78.233))) * 43758.5453) - .5;
  vec3 gc = vec3(fract(sin(dot(gs + 1., vec2(12.9898, 78.233))) * 43758.5453), fract(sin(dot(gs + 2., vec2(12.9898, 78.233))) * 43758.5453), fract(sin(dot(gs + 3., vec2(12.9898, 78.233))) * 43758.5453)) - .5;
  col += (gn + gc * .5) * .055;                                                  // film grain, as on the tulip stage
#else
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) * .012;
#endif
  o = vec4(clamp(col, 0., 1.), 1.);
}`;

  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  class RovnAtmos extends HTMLElement {
    static get observedAttributes() { return ['look', 'resolution']; }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
:host { display: block; position: relative; overflow: hidden; isolation: isolate; background: #D46A0C; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; z-index: 0; opacity: 0; transition: opacity 1.2s cubic-bezier(.22,1,.36,1); pointer-events: none; }
canvas.is-on { opacity: 1; }
.content { position: relative; z-index: 1; height: 100%; }
</style><canvas aria-hidden="true"></canvas><div class="content" part="content"><slot></slot></div>`;
      this._canvas = root.querySelector('canvas');
      this._ptr = { x: 0, y: 0, tx: 0, ty: 0, on: 0, ton: 0 };
      this._ripples = [];
      this._prog = { v: 0, t: 0, manual: null, init: false };
      this._visible = false;
      this._t0 = performance.now();
      this._last = this._t0;
      this._nextDrip = 2;
      this._frame = this._frame.bind(this);
    }

    get progress() { return this._prog.t; }
    set progress(v) { this._prog.manual = Math.min(1, Math.max(0, +v || 0)); this._kick(); }

    get _look() { return LOOKS[this.getAttribute('look')] ?? 0; }

    connectedCallback() {
      this._applyFallback();
      if (!this._init()) return;
      this._io = new IntersectionObserver(([e]) => { this._visible = e.isIntersecting; this._kick(); }, { rootMargin: '120px' });
      this._io.observe(this);
      this._ro = new ResizeObserver(() => { this._resize(); this._kick(); });
      this._ro.observe(this);
      this._onScroll = () => this._kick();
      window.addEventListener('scroll', this._onScroll, { passive: true });
      document.addEventListener('visibilitychange', this._onScroll);
      reduceMQ.addEventListener?.('change', this._onScroll);
      this._onMove = (e) => this._pointer(e);
      this._onDown = (e) => this._pointer(e, true);
      this._onLeave = () => { this._ptr.ton = 0; };
      this.addEventListener('pointermove', this._onMove, { passive: true });
      this.addEventListener('pointerdown', this._onDown, { passive: true });
      this.addEventListener('pointerleave', this._onLeave);
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf); this._raf = 0;
      this._io?.disconnect(); this._ro?.disconnect();
      window.removeEventListener('scroll', this._onScroll);
      document.removeEventListener('visibilitychange', this._onScroll);
      reduceMQ.removeEventListener?.('change', this._onScroll);
      this.removeEventListener('pointermove', this._onMove);
      this.removeEventListener('pointerdown', this._onDown);
      this.removeEventListener('pointerleave', this._onLeave);
      this._gl?.getExtension('WEBGL_lose_context')?.loseContext();
      this._gl = null;
    }

    attributeChangedCallback(name, prev, next) {
      if (prev === next) return;
      if (name === 'look') { this._applyFallback(); if (this._gl) this._compile(); }
      if (name === 'resolution') this._resize();
      this._kick();
    }

    // ---------- setup ----------

    _applyFallback() {
      this.style.setProperty('background-image', FALLBACK[this.getAttribute('look')] || FALLBACK.peaks);
    }

    _init() {
      const gl = this._canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
      if (!gl) return false;
      this._gl = gl;
      this._canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(this._raf); this._raf = 0; });
      this._canvas.addEventListener('webglcontextrestored', () => { this._setupGL(); this._kick(); });
      this._setupGL();
      return true;
    }

    _setupGL() {
      const gl = this._gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      // 256² random texture; G is R offset by (37,17) for cheap 3D noise. Seeded, so every load looks the same.
      const N = 256, data = new Uint8Array(N * N * 4);
      let s = 1337;
      const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) >>> 24);
      for (let i = 0; i < N * N; i++) { data[i * 4] = rnd(); data[i * 4 + 2] = rnd(); data[i * 4 + 3] = rnd(); }
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++)
        data[(y * N + x) * 4 + 1] = data[(((y + 17) & 255) * N + ((x + 37) & 255)) * 4];
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      this._compile();
      this._resize();
    }

    _compile() {
      const gl = this._gl;
      const sh = (type, src) => {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('rovn-atmos: ' + gl.getShaderInfoLog(s));
        return s;
      };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FRAG(this._look)));
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('rovn-atmos: ' + gl.getProgramInfoLog(p));
      if (this._program) gl.deleteProgram(this._program);
      this._program = p;
      gl.useProgram(p);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      this._u = {};
      for (const n of ['uN', 'uRes', 'uPar', 'uTime', 'uClarity', 'uIntensity', 'uRip'])
        this._u[n] = gl.getUniformLocation(p, n);
      gl.uniform1i(this._u.uN, 0);
    }

    _resize() {
      if (!this._gl) return;
      const max = parseFloat(this.getAttribute('resolution')) || 1.5;
      const k = Math.min(window.devicePixelRatio || 1, max);
      const w = Math.max(1, Math.round(this.clientWidth * k));
      const h = Math.max(1, Math.round(this.clientHeight * k));
      if (this._canvas.width !== w || this._canvas.height !== h) {
        this._canvas.width = w; this._canvas.height = h;
        this._gl.viewport(0, 0, w, h);
      }
    }

    // ---------- input ----------

    _pointer(e, down) {
      const r = this.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const p = this._ptr;
      if (e.pointerType === 'mouse') { p.tx = x - .5; p.ty = y - .5; p.ton = 1; }
      if (this._look === 1 && !reduceMQ.matches && y > .5) {
        const now = (performance.now() - this._t0) / 1000;
        const last = this._ripples[this._ripples.length - 1];
        const far = !last || Math.hypot(x - last.x, (y - last.y) * 2.6) > .06;
        if (down || (far && now - (last?.born ?? -9) > .22)) this._addRipple(x, y, down ? 1 : .6, now);
      }
      this._kick();
    }

    _addRipple(x, y, s, born) {
      this._ripples.push({ x, y, s, born });
      if (this._ripples.length > 6) this._ripples.shift();
    }

    _clarityTarget() {
      const mode = this.getAttribute('clear');
      if (mode == null) return 1;
      let p;
      if (mode === 'manual' || this._prog.manual != null) p = this._prog.manual ?? 0;
      else {
        const sel = this.getAttribute('scroll-target');
        const el = (sel && document.querySelector(sel)) || this;
        const r = el.getBoundingClientRect(), vh = window.innerHeight;
        p = r.height > vh * 1.05 ? -r.top / (r.height - vh) : (vh - r.top) / (vh + r.height);
      }
      p = Math.min(1, Math.max(0, p));
      return this.hasAttribute('reverse') ? 1 - p : p;
    }

    // ---------- loop ----------

    _kick() {
      if (!this._gl || this._raf || !this._visible || document.hidden) return;
      this._raf = requestAnimationFrame(this._frame);
    }

    _frame(now) {
      this._raf = 0;
      const gl = this._gl;
      if (!gl || !this._program || gl.isContextLost()) return;
      const reduce = reduceMQ.matches;
      const dt = Math.min(.1, (now - this._last) / 1000);
      this._last = now;
      const t = reduce ? 0 : (now - this._t0) / 1000;
      const ease = (k) => 1 - Math.exp(-k * dt);

      const p = this._ptr;
      p.x += (p.tx - p.x) * ease(2.2); p.y += (p.ty - p.y) * ease(2.2);
      p.on += (p.ton - p.on) * ease(1.6);
      if (reduce) p.on = 0;

      const pr = this._prog;
      pr.t = this._clarityTarget();
      pr.v = reduce || !pr.init ? pr.t : pr.v + (pr.t - pr.v) * ease(4);
      pr.init = true;

      if (this._look === 1 && !reduce && t > this._nextDrip) {
        this._addRipple(.15 + Math.random() * .7, .6 + Math.random() * .35, .4, t);
        this._nextDrip = t + 2 + Math.random() * 3;
      }
      this._ripples = this._ripples.filter((r) => t - r.born < 5);
      const rip = new Float32Array(24);
      this._ripples.forEach((r, i) => rip.set([r.x, r.y, t - r.born, r.s], i * 4));

      const u = this._u;
      gl.useProgram(this._program);
      gl.uniform2f(u.uRes, this._canvas.width, this._canvas.height);
      gl.uniform2f(u.uPar, p.x * p.on, p.y * p.on);
      gl.uniform1f(u.uTime, t);
      gl.uniform1f(u.uClarity, pr.v);
      const k = parseFloat(this.getAttribute('intensity'));
      gl.uniform1f(u.uIntensity, isFinite(k) ? Math.max(0, k) : 1);
      gl.uniform4fv(u.uRip, rip);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!this._shown) {
        this._shown = true;
        this._canvas.classList.add('is-on');
        this.dispatchEvent(new CustomEvent('atmos:ready', { bubbles: true }));
      }
      const settling = Math.abs(pr.v - pr.t) > .0005 || Math.abs(p.on - p.ton) > .002 || Math.abs(p.x - p.tx) > .0005;
      if (!reduce || settling) this._kick();
    }
  }

  customElements.define('rovn-atmos', RovnAtmos);
})();
