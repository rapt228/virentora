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
