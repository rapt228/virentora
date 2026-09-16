# Earth asset provenance

Downloaded 2026-09-14.

Textures: Solar System Scope, based on NASA Blue Marble and other geographic imagery. Licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
Source and license: https://www.solarsystemscope.com/textures/
Three.js source example confirms attribution and channels: https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_earth.html

Downloaded resized/merged versions from official Three.js:
- https://threejs.org/examples/textures/planets/earth_day_4096.jpg
- https://threejs.org/examples/textures/planets/earth_night_4096.jpg
- https://threejs.org/examples/textures/planets/earth_bump_roughness_clouds_4096.jpg

All textures verified 4096x2048 JPEG, equirectangular.
Packed map channels: R elevation/bump; G roughness; B clouds. Day/night use sRGB, packed map linear.
Recommended public credit: Earth textures by Solar System Scope (CC BY 4.0), resized and merged by Three.js.

Library: Three.js r170 (npm version 0.170.0), MIT license. Existing source header retained.
- https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js

Static Earth posters: browser captures of the Virentora Three.js scene, using the attributed textures above. Captured at 1440×900, 768×1024 and 390×844.


## 2026-09-14: surface upgrade and procedural sky

New source maps by Solar System Scope, CC BY 4.0:
- https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg
- https://www.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg
- https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg
- Source / licence: https://www.solarsystemscope.com/textures/

All three source JPEGs are 8192×4096. Day has no baked cloud layer. Converted to WebP, with 4096×2048 copies downsampled using Lanczos; no upscaling or invented surface detail. Active desktop uses `earth-day-8k.webp` (quality 92) and 4K clouds/night (quality 90); mobile uses 4K maps. The existing packed 4K texture supplies elevation and roughness only.

`cosmic-background.js` generates the sky procedurally. Stars are seeded 3D points. No stock nebula image or downloaded star photograph is used. Static posters capture this same scene for loading and WebGL failure. Attribution for the Earth maps also applies to the posters.


## 2026-09-15: compact mobile maps

The mobile profile uses additional technical downscales of the same licensed maps: `earth-day-2k.webp` 2048×1024 q90; `earth-clouds-2k.webp` 2048×1024 grayscale q85; `earth-night-1k.webp` 1024×512 q88; `earth-details-1k.webp` 1024×512 RGB q90. Lanczos resizing, no upscaling or artistic changes. Total 923,170 bytes. Packed detail channels retain their meanings. The full desktop maps remain available. Posters are now used for graphics failure only, not for ordinary startup.

## 2026-09-16: logo and library packaging
The replacement Virentora mark was traced to vector from the logo supplied by the owner (photo_2026-09-12_12-25-37.jpg); it is not a new identity. Social preview is an HTML composition with that mark and the existing attributed Earth scene poster.
Three.js remains r170, locally minified using Terser 5.44.1 (module, mangle, compress:false; licence comments retained). Source/output hashes and byte counts: three-build.json. Normal desktop retains the 8K surface. Mobile maps are unchanged. Unused legacy day/night JPEGs and cinematic-sky.png were removed; historical source links above remain provenance.
