# rovn-atmos

Layered amber atmospheres for Rōvn: one dependency-free web component, `rovn-atmos.js` (about 20 KB unminified), with no images. Each look is a fixed, composed vista built from planes at real depths: far ridges, peaks, cloud banks and a near shoulder. The camera only sways slowly, so depth reads through parallax while fog drifts between the planes. The peaks never change shape.

## Use it

```html
<script src="/atmos/rovn-atmos.js" defer></script>

<rovn-atmos look="peaks" style="height: 100svh">
  <h1>Healthcare runs on you. Rōvn works for you.</h1>
</rovn-atmos>
```

**Astro (rovn-landing-page):**
1. Put `rovn-atmos.js` in `public/atmos/`.
2. Add `<script src="/atmos/rovn-atmos.js" is:inline defer></script>` to the base layout. Alternatively, import it from `src/scripts/` inside a `<script>` tag.
3. Use `<rovn-atmos …>` in any `.astro` file.

React works the same way: import the file once, then render the tag.

## Looks

| look | what it is | what moves |
|---|---|---|
| `peaks` | two craggy peaks and a long ridge standing in a sea of amber cloud, under a low glow | cloud banks drift through the valleys and a veil crosses the peaks; the camera sways slowly, and the cursor sways it further |
| `bloom` | an amber take on the tulip stage in rovn-experiment-1: a drifting mesh-gradient field with two tulips swaying in it at the same value, so they blur into it, and coral petals that glow as the one hot thing in the frame | the field drifts, the tulips sway (the front one more, plus cursor parallax), and a glass ripple and film grain sit over everything. It's drawn analytically, with no three.js or model files |
| `lake` | a pine spit and hills mirrored in a still lake | mist rolls over the water, the reflection shimmers, and the cursor or a click leaves rings (with an occasional ambient drop) |

## Attributes

| attribute | values | default |
|---|---|---|
| `look` | `peaks`, `lake`, `bloom` | `peaks` |
| `clear` | `scroll` or `manual`: starts fogged in, then the fog lifts off the peaks first and lingers low | off |
| `scroll-target` | selector whose scroll progress drives `clear="scroll"` | the element |
| `reverse` | with `clear`: goes clear → fogged (for a closing section) | off |
| `intensity` | motion multiplier: drift, sway, swell. `0` freezes it | `1` |
| `resolution` | maximum device-pixel ratio for the canvas | `1.5` |

**Progress:**
- With `clear="manual"`, set `el.progress = 0..1` yourself, for example from a GSAP ScrollTrigger `onUpdate`.
- With `clear="scroll"`, a scroll target taller than the viewport maps its top-to-bottom pass to 0→1. That suits a sticky scene inside a tall wrapper:

```html
<section id="clear" style="height: 260vh; position: relative">
  <rovn-atmos look="peaks" clear="scroll" scroll-target="#clear"
              style="position: sticky; top: 0; height: 100svh">…</rovn-atmos>
</section>
```

## Behaviour

- **Sizing:** the element is `display: block; position: relative`. Give it a height with CSS. Its children render above the canvas in normal flow.
- **Composition:** each scene is laid out on a 16:9 frame and cropped to cover the element, like `object-fit: cover`.
- **Performance:** it renders at full resolution and held 60fps at 1440×900 on Apple silicon.
- **Pausing:** each element only runs while it's on screen and the tab is visible.
- **Reduced motion:** under `prefers-reduced-motion` it renders still frames. Clearing still follows scroll.
- **Fallback:** without WebGL2 the element shows a CSS gradient that approximates the look. It fires a bubbling `atmos:ready` event once the first frame is drawn.
- **Contexts:** each element uses one WebGL context, and browsers allow about 16, so keep it to a handful per page.
- **Contrast:** paper text on the natural scenes is too low-contrast. Use ink text there, which is about 7:1 on amber. `bloom` follows the tulip stage and uses paper display type; keep it large.
