import * as THREE from './assets/three.module.js';
import { createCosmicBackground } from './cosmic-background.js?v=20260914-sky2';

// The HTML poster remains visible until an actual WebGL frame has rendered.
// Content and navigation never depend on this progressively enhanced scene.
const host = document.querySelector('#earth-stage');
const hero = document.querySelector('#top');
const poster = host?.querySelector('.earth-fallback');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (host && hero) initialiseScene().catch(showFallback);

function showFallback(error) {
  host?.classList.remove('ready');
  host?.classList.add('unavailable');
  if (host) host.dataset.scene = 'fallback';
  if (poster) { poster.hidden = false; poster.style.display = 'block'; }
  const canvas = host?.querySelector('canvas');
  if (canvas) canvas.style.visibility = 'hidden';
  window.dispatchEvent(new CustomEvent('virentora:scene-error'));
  if (error) console.warn('Virentora Earth: using the static scene.', error);
}

async function initialiseScene() {
  let renderer;
  let failed = false;
  let frame = 0;
  let visible = true;
  let ready = false;
  let readyEventSent = false;
  let resourcesReady = false;
  let paused = document.documentElement.dataset.motion === 'paused';
  let width = 1;
  let height = 1;
  let mobile = false;
  let lastTime = 0;
  let progress = 0;
  let pointerX = 0;
  let pointerY = 0;
  let targetPointerX = 0;
  let targetPointerY = 0;
  const canMove = () => !paused && !reducedMotion.matches;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const smooth = value => value * value * (3 - 2 * value);

  try {
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'default' });
  } catch (error) {
    showFallback(error);
    return;
  }
  renderer.setClearColor(0x02050a, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.setAttribute('role', 'presentation');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;visibility:hidden;opacity:1;transition:none;';
  host.appendChild(renderer.domElement);

  const fail = error => {
    failed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    showFallback(error);
  };
  renderer.debug.onShaderError = () => fail(new Error('The graphics driver could not compile the scene.'));
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    fail();
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    failed = false;
    host.classList.remove('unavailable');
    ready = false;
    if (resourcesReady) resize();
  });

  const scene = new THREE.Scene();
  const cosmicSky = createCosmicBackground(THREE, renderer);
  scene.add(cosmicSky.mesh);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const loader = new THREE.TextureLoader();
  let textures;
  const use8k = matchMedia('(min-width: 1100px)').matches && renderer.capabilities.maxTextureSize >= 8192 && !navigator.connection?.saveData;
  const surfacePath = use8k ? './assets/earth-day-8k.webp' : './assets/earth-day-4k.webp';
  try {
    textures = await Promise.all([
      loader.loadAsync(surfacePath).catch(error => {
        if (!use8k) throw error;
        return loader.loadAsync('./assets/earth-day-4k.webp');
      }),
      loader.loadAsync('./assets/earth-night-4k.webp'),
      loader.loadAsync('./assets/earth_bump_roughness_clouds_4096.jpg'),
      loader.loadAsync('./assets/earth-clouds-4k.webp')
    ]);
  } catch (error) {
    renderer.dispose();
    fail(error);
    return;
  }
  const [day, night, details, cloudMap] = textures;
  host.dataset.textureWidth = String(day.image.width);
  day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;
  textures.forEach(texture => {
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  });

  // Packed details: R = elevation, G = roughness. Clouds use their own map.
  // See assets/ATTRIBUTION.md.
  const sun = new THREE.Vector3(-0.72, 0.48, 0.12).normalize();
  const globe = new THREE.Group();
  scene.add(globe);
  const sphere = new THREE.SphereGeometry(1, 256, 160);
  const vertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vWorld;
    varying vec3 vTangent;
    void main() {
      vUv = uv;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec3 tangent = vec3(-position.z, 0.00001, position.x);
      vTangent = normalize(mat3(modelMatrix) * tangent);
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `;

  const earthMaterial = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: day }, nightMap: { value: night },
      details: { value: details }, cloudMap: { value: cloudMap }, sun: { value: sun },
      cloudOffset: { value: 0 }
    },
    vertexShader,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D details;
      uniform sampler2D cloudMap;
      uniform vec3 sun;
      uniform float cloudOffset;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying vec3 vTangent;
      void main() {
        vec3 geometricNormal = normalize(vNormal);
        vec3 tangent = normalize(vTangent);
        vec3 bitangent = normalize(cross(geometricNormal, tangent));
        vec2 texel = vec2(1.0 / 4096.0, 1.0 / 2048.0);
        float heightL = texture2D(details, vUv - vec2(texel.x, 0.0)).r;
        float heightR = texture2D(details, vUv + vec2(texel.x, 0.0)).r;
        float heightD = texture2D(details, vUv - vec2(0.0, texel.y)).r;
        float heightU = texture2D(details, vUv + vec2(0.0, texel.y)).r;
        vec3 n = normalize(geometricNormal - tangent * (heightR - heightL) * 1.5
          - bitangent * (heightU - heightD) * 1.5);
        vec3 view = normalize(cameraPosition - vWorld);
        float light = dot(n, sun);
        float geometricLight = dot(geometricNormal, sun);
        float daylight = smoothstep(-0.10, 0.22, geometricLight);
        vec3 surface = texture2D(dayMap, vUv).rgb;
        float roughness = texture2D(details, vUv).g;
        float ocean = 1.0 - smoothstep(0.22, 0.65, roughness);
        // Keep geography photographic: deep ocean color, no metallic land.
        // Texture decoding and lighting use linear color throughout.
        float luminance = dot(surface, vec3(0.2126, 0.7152, 0.0722));
        surface = mix(vec3(luminance), surface, 1.0);
        surface = mix(surface, surface * vec3(0.50, 0.74, 0.94), ocean * 0.36);
        float cloudShadow = texture2D(cloudMap, vUv + vec2(cloudOffset - 0.0013, 0.0012)).r;
        float diffuse = pow(max(light, 0.0), 0.82);
        vec3 color = surface * (vec3(0.026, 0.037, 0.065) + diffuse * 1.55);
        color *= 1.0 - smoothstep(0.28, 0.84, cloudShadow) * 0.19 * daylight;
        vec3 cities = texture2D(nightMap, vUv).rgb;
        color += cities * vec3(1.0, 0.79, 0.53) * (1.0 - daylight) * 2.0;
        vec3 halfway = normalize(sun + view);
        float glint = pow(max(dot(n, halfway), 0.0), 90.0);
        color += vec3(0.63, 0.76, 0.91) * glint * ocean * daylight * 0.23;
        float rim = pow(1.0 - max(dot(geometricNormal, view), 0.0), 4.0);
        float litRim = smoothstep(-0.22, 0.52, geometricLight);
        color += vec3(0.045, 0.26, 0.66) * rim * litRim * 0.60;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const earth = new THREE.Mesh(sphere, earthMaterial);
  earth.rotation.set(0.06, 4.34, 0.13);
  globe.add(earth);

  const cloudMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { cloudMap: { value: cloudMap }, sun: { value: sun } },
    vertexShader,
    fragmentShader: `
      uniform sampler2D cloudMap;
      uniform vec3 sun;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        float cloud = texture2D(cloudMap, vUv).r;
        float light = dot(normalize(vNormal), sun);
        float day = smoothstep(-0.10, 0.20, light);
        float opacity = smoothstep(0.18, 0.86, cloud) * 0.94;
        vec3 color = vec3(0.80, 0.87, 0.98) * (0.022 + max(light, 0.0) * 1.38);
        color += vec3(0.018, 0.035, 0.065) * (1.0 - day);
        gl_FragColor = vec4(color, opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const clouds = new THREE.Mesh(sphere, cloudMaterial);
  clouds.rotation.copy(earth.rotation);
  clouds.scale.setScalar(1.006);
  globe.add(clouds);

  const atmosphere = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: { sun: { value: sun } },
    vertexShader,
    fragmentShader: `
      uniform vec3 sun;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(cameraPosition - vWorld);
        float edge = pow(clamp(1.0 + dot(n, view), 0.0, 1.0), 4.5);
        float light = smoothstep(-0.28, 0.65, dot(n, sun));
        float opacity = edge * (0.018 + light * 0.62);
        gl_FragColor = vec4(vec3(0.16, 0.48, 0.92), opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  atmosphere.scale.setScalar(1.022);
  globe.add(atmosphere);

  // Stable seeded placement, real depth and three brightness/size populations.
  const starGeometry = new THREE.BufferGeometry();
  const starMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { pixelRatio: { value: 1 } },
    vertexShader: `
      attribute float starSize;
      attribute float starLight;
      attribute vec3 starColor;
      uniform float pixelRatio;
      varying float vLight;
      varying float vSize;
      varying vec3 vColor;
      void main() {
        vLight = starLight;
        vSize = starSize;
        vColor = starColor;
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = starSize * pixelRatio;
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      varying float vLight;
      varying float vSize;
      varying vec3 vColor;
      void main() {
        float radius = length(gl_PointCoord - 0.5) * 2.0;
        if (radius > 1.0) discard;
        float core = exp(-radius * radius * 11.0);
        float halo = (1.0 - smoothstep(0.12, 1.0, radius)) * 0.18;
        vec2 q = abs(gl_PointCoord - 0.5) * 2.0;
        float rays = (exp(-q.x*36.0)*pow(1.0-q.y,2.0)
                    + exp(-q.y*36.0)*pow(1.0-q.x,2.0));
        float flare = smoothstep(6.0,8.5,vSize)*rays*0.16;
        gl_FragColor = vec4(vColor, (core + halo + flare) * vLight);
        #include <colorspace_fragment>
      }
    `
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);

  function scatterStars() {
    let seed = 17429;
    const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
    const positions = [], sizes = [], brightness = [], colors = [];
    const count = mobile ? 1200 : 3200;
    host.dataset.starCount = String(count);
    for (let i = 0; i < count; i++) {
      const x = random(), y = random(), z = -8 - random() * 38;
      const spread = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (7 - z);
      positions.push((x - 0.5) * spread * camera.aspect * 1.08, (y - 0.5) * spread * 1.08, z);
      const rare = random();
      sizes.push(rare > 0.993 ? 8.5 : rare > 0.92 ? 4.2 : 2.2 + random() * 0.9);
      const underCopy = !mobile && x < 0.52 && y > 0.24 && y < 0.85;
      brightness.push((rare > 0.92 ? 1.0 : 0.54 + random() * 0.42) * (underCopy ? 0.66 : 1));
      const temperature = random();
      if (temperature > 0.86) colors.push(1.0, 0.88, 0.72);
      else if (temperature < 0.24) colors.push(0.68, 0.82, 1.0);
      else colors.push(0.87, 0.91, 1.0);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    starGeometry.setAttribute('starSize', new THREE.Float32BufferAttribute(sizes, 1));
    starGeometry.setAttribute('starLight', new THREE.Float32BufferAttribute(brightness, 1));
    starGeometry.setAttribute('starColor', new THREE.Float32BufferAttribute(colors, 3));
    starGeometry.computeBoundingSphere();
  }

  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    mobile = matchMedia('(max-width: 800px)').matches;
    const pixelRatio = Math.min(Math.max(devicePixelRatio || 1, mobile ? 1.5 : 1.35), 2, Math.sqrt(6000000 / (width * height)));
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    starMaterial.uniforms.pixelRatio.value = pixelRatio;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    scatterStars();
    cosmicSky.resize(width,height);
    applyCamera();
    requestFrame();
  }

  function readProgress() {
    const range = Math.max(1, hero.offsetHeight - height);
    return clamp(-hero.getBoundingClientRect().top / range);
  }

  function applyCamera() {
    // Position-derived approach and arc: scroll reversal never restarts a clip.
    const p = reducedMotion.matches ? 0 : smooth(progress);
    const visibleHeight = 2 * 7 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const centerX = mobile ? 0.50 + p * 0.015 : 0.73 + p * 0.045;
    const centerY = mobile ? 0.76 - p * 0.04 : 0.58 - p * 0.09;
    const radiusPixels = mobile ? Math.min(width * 0.40, height * 0.31) : Math.min(width * 0.34, height * 0.44);
    // Compensate the apparent radius increase from perspective projection.
    const worldRadius = radiusPixels / height * visibleHeight;
    globe.scale.setScalar(worldRadius / Math.sqrt(1 + (worldRadius / 7) ** 2));
    globe.position.set((centerX - 0.5) * visibleHeight * camera.aspect, (0.5 - centerY) * visibleHeight, 0);
    globe.rotation.set(pointerY * 0.018 + p * 0.08, pointerX * 0.025 + p * 0.17, 0);
    camera.position.set(p * -0.14 + pointerX * 0.028, p * 0.08 + pointerY * 0.018, 7 - p * (mobile ? 0.24 : 0.62));
    camera.lookAt(p * 0.08, p * 0.035, 0);
    stars.rotation.y = p * -0.006 + pointerX * 0.0015;
    stars.rotation.x = pointerY * 0.001;
  }

  function requestFrame() {
    if (frame || failed || !visible || document.hidden) return;
    frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    if (failed || !visible || document.hidden) { lastTime = 0; return; }
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime = now;
    if (canMove()) {
      earth.rotation.y += delta * 0.010;
      clouds.rotation.y += delta * 0.012;
      earthMaterial.uniforms.cloudOffset.value = -(clouds.rotation.y - earth.rotation.y) / (Math.PI * 2);
      pointerX += (targetPointerX - pointerX) * Math.min(1, delta * 4);
      pointerY += (targetPointerY - pointerY) * Math.min(1, delta * 4);
      progress = readProgress();
    }
    applyCamera();
    try {
      renderer.render(scene, camera);
    } catch (error) {
      fail(error);
      return;
    }
    if (failed) return;
    if (renderer.getContext().isContextLost()) { fail(); return; }
    if (!ready) {
      ready = true;
      host.classList.remove('unavailable');
      host.classList.add('ready');
      // Atomic swap: the poster and live globe never share a visible frame.
      if (poster) { poster.hidden = true; poster.style.display = 'none'; }
      renderer.domElement.style.visibility = 'visible';
      host.dataset.scene = 'ready';
      if (!readyEventSent) {
        readyEventSent = true;
        window.dispatchEvent(new CustomEvent('virentora:scene-ready', { detail: { surfaceWidth: day.image.width } }));
      } else {
        window.dispatchEvent(new CustomEvent('virentora:scene-restored'));
      }
    }
    if (canMove()) requestFrame();
  }

  resourcesReady = true;
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    } else requestFrame();
  });
  intersectionObserver.observe(host);

  window.addEventListener('virentora:motion', event => {
    paused = Boolean(event.detail?.paused);
    lastTime = 0;
    requestFrame();
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      progress = 0;
      pointerX = pointerY = targetPointerX = targetPointerY = 0;
    }
    lastTime = 0;
    requestFrame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    } else requestFrame();
  });
  window.addEventListener('scroll', () => { if (canMove()) requestFrame(); }, { passive: true });
  hero.addEventListener('pointermove', event => {
    if (mobile || event.pointerType === 'touch' || !canMove()) return;
    const bounds = host.getBoundingClientRect();
    targetPointerX = clamp((event.clientX - bounds.left) / width * 2 - 1, -1, 1);
    targetPointerY = clamp((event.clientY - bounds.top) / height * 2 - 1, -1, 1);
    requestFrame();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { targetPointerX = targetPointerY = 0; });
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0; });
  window.addEventListener('pageshow', requestFrame);
  // A visitor can pause while the textures are loading.
  paused = document.documentElement.dataset.motion === 'paused';
  resize();
}
