import * as THREE from './assets/three.module.min.js';
import { createCosmicBackground } from './cosmic-background.js?v=20260916-mobile4';

// A static Earth is mounted only if graphics fail, never during normal loading.
// Content and navigation never depend on this progressively enhanced scene.
const host = document.querySelector('#earth-stage');
const hero = document.querySelector('#top');

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

if (host && hero) initialiseScene().catch(showFallback);

function showFallback(error) {
  host?.classList.remove('ready');
  host?.classList.add('unavailable');
  if (host) host.dataset.scene = 'fallback';
  if (host && !host.querySelector('.earth-fallback')) {
    const template = document.querySelector('#earth-fallback-template');
    if (template) host.append(template.content.cloneNode(true));
  }
  const poster = host?.querySelector('.earth-fallback');
  if (poster) { poster.hidden = false; poster.style.display = 'block'; }
  const canvas = host?.querySelector('canvas');
  if (canvas) canvas.style.visibility = 'hidden';
  window.dispatchEvent(new CustomEvent('virentora:scene-error'));
  if (error) console.warn('Virentora Earth: using the static scene.', error);
}

async function initialiseScene() {
  let renderer;
  let failed = false;
  let fatal = false;
  let contextNeedsRebuild = false;
  const contextWaiters = [];
  let frame = 0;
  let visible = true;
  let ready = false;
  let readyEventSent = false;
  let resourcesReady = false;
  let paused = document.documentElement.dataset.motion === 'paused';
  let width = Math.max(1, host.clientWidth);
  let height = Math.max(1, host.clientHeight);
  const compactMedia = matchMedia('(max-width: 800px), (pointer: coarse)');
  let mobile = compactMedia.matches;
  const compact = mobile;
  host.dataset.profile = compact ? 'mobile' : 'desktop';
  let qualityRatio = compact ? 1.5 : 2;
  const effectiveRatio = () => Math.min(devicePixelRatio || 1,qualityRatio,Math.sqrt((compact ? 900000 : 6000000)/(width*height)));
  let pixelRatio = effectiveRatio();
  let nextRender = 0;
  let qualityElapsed = 0, slowElapsed = 0, nextQualityChange = 0;
  let pendingResize = null;
  let forceFrame = true;
  let targetProgress = Number.parseFloat(hero.style.getPropertyValue('--scene-progress')) || 0;
  let introStart = 0;
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
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: !compact, powerPreference: compact ? 'low-power' : 'default' });
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
    fatal = Boolean(error);
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
    contextNeedsRebuild = true;
    contextWaiters.splice(0).forEach(resolve => resolve());
    if (resourcesReady) { resize(true); contextNeedsRebuild=false; }
  });

  function waitForContext() {
    if (!renderer.getContext().isContextLost()) return Promise.resolve();
    return new Promise(resolve => contextWaiters.push(resolve));
  }
  const scene = new THREE.Scene();
  const cosmicSky = createCosmicBackground(THREE, renderer, {maxWidth: compact ? 640 : 1536, maxHeight: compact ? 800 : 1024});
  scene.add(cosmicSky.mesh);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

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
  stars.renderOrder = -2;
  scene.add(stars);

  function scatterStars() {
    let seed = 17429;
    const random = () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646;
    const positions = [], sizes = [], brightness = [], colors = [];
    const count = compact ? 1000 : 3200;
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
    for (const [name, values, size] of [['position',positions,3],['starSize',sizes,1],['starLight',brightness,1],['starColor',colors,3]]) {
      const attribute = starGeometry.getAttribute(name);
      if (attribute) { attribute.array.set(values); attribute.needsUpdate=true; }
      else starGeometry.setAttribute(name,new THREE.Float32BufferAttribute(values,size));
    }
    starGeometry.computeBoundingSphere();
  }


  camera.aspect = width/height;
  camera.updateProjectionMatrix();
  renderer.setDrawingBufferSize(width,height,pixelRatio);
  starMaterial.uniforms.pixelRatio.value = pixelRatio;
  scatterStars();
  cosmicSky.resize(width,height);
  renderer.render(scene,camera);
  if (fatal) return;
  await waitForContext();
  if (contextNeedsRebuild) { cosmicSky.resize(width,height,true); contextNeedsRebuild=false; }
  renderer.domElement.style.visibility = 'visible';
  host.dataset.scene = 'loading';
  host.dataset.renderRatio = pixelRatio.toFixed(2);

  const loader = new THREE.TextureLoader();
  let textures;
  // Preserve the detailed desktop surface; startup is accelerated by early
  // parallel preloads, not by replacing it with a low-resolution texture.
  const use8k = !compact && matchMedia('(min-width: 1100px)').matches && renderer.capabilities.maxTextureSize >= 8192 && !navigator.connection?.saveData;
  const surfacePath = compact ? './assets/earth-day-2k.webp' : use8k ? './assets/earth-day-8k.webp' : './assets/earth-day-4k.webp';
  try {
    textures = await Promise.all([
      loader.loadAsync(surfacePath).catch(error => {
        if (!use8k) throw error;
        return loader.loadAsync('./assets/earth-day-4k.webp');
      }),
      loader.loadAsync(compact ? './assets/earth-night-1k.webp' : './assets/earth-night-4k.webp'),
      loader.loadAsync(compact ? './assets/earth-details-1k.webp' : './assets/earth_bump_roughness_clouds_4096.jpg'),
      loader.loadAsync(compact ? './assets/earth-clouds-2k.webp' : './assets/earth-clouds-4k.webp')
    ]);
  } catch (error) {
    renderer.dispose();
    fail(error);
    return;
  }
  await Promise.all(textures.map(t => t.image.decode?.().catch(() => {})));
  const [day, night, details, cloudMap] = textures;
  host.dataset.textureWidth = String(day.image.width);
  day.colorSpace = night.colorSpace = THREE.SRGBColorSpace;
  textures.forEach(texture => {
    texture.anisotropy = Math.min(compact ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  });

  // Packed details: R = elevation, G = roughness. Clouds use their own map.
  // See assets/ATTRIBUTION.md.
  const sun = new THREE.Vector3(-0.72, 0.48, 0.12).normalize();
  const globe = new THREE.Group();
  scene.add(globe);
  const sphere = new THREE.SphereGeometry(1, compact ? 96 : 256, compact ? 64 : 160);
  const reveal = {value: 0};
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
    transparent: true,
    defines: { MOBILE_QUALITY: compact ? 1 : 0 },
    uniforms: {
      dayMap: { value: day }, nightMap: { value: night },
      details: { value: details }, cloudMap: { value: cloudMap }, sun: { value: sun },
      cloudOffset: { value: 0 }, reveal
    },
    vertexShader,
    fragmentShader: `
      uniform sampler2D dayMap;
      uniform sampler2D nightMap;
      uniform sampler2D details;
      uniform sampler2D cloudMap;
      uniform vec3 sun;
      uniform float cloudOffset;
      uniform float reveal;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying vec3 vTangent;
      void main() {
        vec3 geometricNormal = normalize(vNormal);
        vec3 tangent = normalize(vTangent);
        vec3 bitangent = normalize(cross(geometricNormal, tangent));
        #if MOBILE_QUALITY == 1
        vec3 n = geometricNormal;
        #else
        vec2 texel = vec2(1.0 / 4096.0, 1.0 / 2048.0);
        float heightL = texture2D(details, vUv - vec2(texel.x, 0.0)).r;
        float heightR = texture2D(details, vUv + vec2(texel.x, 0.0)).r;
        float heightD = texture2D(details, vUv - vec2(0.0, texel.y)).r;
        float heightU = texture2D(details, vUv + vec2(0.0, texel.y)).r;
        vec3 n = normalize(geometricNormal - tangent * (heightR - heightL) * 1.5
          - bitangent * (heightU - heightD) * 1.5);
        #endif
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
        #if MOBILE_QUALITY == 1
        float cloud = texture2D(cloudMap, vUv + vec2(cloudOffset,0.0)).r;
        float cloudOpacity = smoothstep(0.18,0.86,cloud)*0.94;
        vec3 cloudColor = vec3(0.80,0.87,0.98)*(0.022+max(geometricLight,0.0)*1.38);
        cloudColor += vec3(0.018,0.035,0.065)*(1.0-daylight);
        color = mix(color,cloudColor,cloudOpacity);
        #endif
        float rim = pow(1.0 - max(dot(geometricNormal, view), 0.0), 4.0);
        float litRim = smoothstep(-0.22, 0.52, geometricLight);
        color += vec3(0.045, 0.26, 0.66) * rim * litRim * 0.60;
        gl_FragColor = vec4(color, reveal);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const earth = new THREE.Mesh(sphere, earthMaterial);
  earth.rotation.set(0.06, 4.34, 0.13);
  earth.renderOrder = 0;
  globe.add(earth);

  const cloudMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { cloudMap: { value: cloudMap }, sun: { value: sun }, reveal },
    vertexShader,
    fragmentShader: `
      uniform sampler2D cloudMap;
      uniform vec3 sun;
      uniform float reveal;
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
        gl_FragColor = vec4(color, opacity * reveal);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
  const clouds = new THREE.Mesh(sphere, cloudMaterial);
  clouds.rotation.copy(earth.rotation);
  clouds.scale.setScalar(1.006);
  clouds.renderOrder = 1;
  if (!compact) globe.add(clouds);

  const atmosphere = new THREE.Mesh(sphere, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: { sun: { value: sun }, reveal },
    vertexShader,
    fragmentShader: `
      uniform vec3 sun;
      uniform float reveal;
      varying vec3 vNormal;
      varying vec3 vWorld;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 view = normalize(cameraPosition - vWorld);
        float edge = pow(clamp(1.0 + dot(n, view), 0.0, 1.0), 4.5);
        float light = smoothstep(-0.28, 0.65, dot(n, sun));
        float opacity = edge * (0.018 + light * 0.62);
        gl_FragColor = vec4(vec3(0.16, 0.48, 0.92), opacity * reveal);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  }));
  atmosphere.scale.setScalar(1.022);
  atmosphere.renderOrder = 2;
  globe.add(atmosphere);

  function resize(force=false) {
    const nextWidth = Math.max(1,host.clientWidth), nextHeight = Math.max(1,host.clientHeight);
    if (!force && !pendingResize && nextWidth===width && nextHeight===height && mobile===compactMedia.matches) return;
    // ResizeObserver runs after layout, potentially after this frame's rAF.
    // Never clear the visible framebuffer here: keep its last complete image
    // until draw() can resize and render the replacement in the same callback.
    pendingResize = { width: nextWidth, height: nextHeight, rebuild: force || Boolean(pendingResize?.rebuild) };
    requestFrame(true);
  }

  function applyPendingResize() {
    if (!pendingResize) return;
    const next = pendingResize;
    pendingResize = null;
    width=next.width; height=next.height;
    mobile=compactMedia.matches;
    pixelRatio=effectiveRatio();
    host.dataset.renderRatio=pixelRatio.toFixed(2);
    if (renderer.domElement.width !== Math.floor(width*pixelRatio) || renderer.domElement.height !== Math.floor(height*pixelRatio)) {
      renderer.setDrawingBufferSize(width,height,pixelRatio);
    }
    starMaterial.uniforms.pixelRatio.value=pixelRatio;
    camera.aspect=width/height; camera.updateProjectionMatrix();
    scatterStars(); cosmicSky.resize(width,height,next.rebuild);
    qualityElapsed=slowElapsed=0;
    // A resize/context restore is not a representative steady-state sample.
    lastTime=0;
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

  function requestFrame(force=false) {
    if (force) forceFrame=true;
    if (frame || failed || !visible || document.hidden) return;
    frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    frame = 0;
    if (failed || !visible || document.hidden) { lastTime = 0; return; }
    const required = forceFrame || Boolean(pendingResize) || !ready;
    if (!required && compact && canMove() && now < nextRender-0.5) { requestFrame(); return; }
    forceFrame=false;
    applyPendingResize();
    if (failed) return;
    if (required || nextRender < now-100) nextRender=now;
    nextRender += 1000/60;
    const elapsed = lastTime ? (now-lastTime)/1000 : 0;
    const delta = Math.min(elapsed,0.05);
    lastTime = now;
    if (!introStart) introStart=now;
    reveal.value = paused || reducedMotion.matches ? 1 : Math.min(1,(now-introStart)/300);
    if (compact && !required && elapsed > 0 && elapsed < 0.15 && canMove() && now >= nextQualityChange) {
      qualityElapsed += elapsed;
      if (elapsed > 0.028) slowElapsed += elapsed;
      if (qualityElapsed > 4) {
        if (slowElapsed/qualityElapsed > 0.25 && pixelRatio > 1.05) {
          qualityRatio=Math.max(1,qualityRatio-0.25);
          pixelRatio=effectiveRatio();
          renderer.setDrawingBufferSize(width,height,pixelRatio);
          starMaterial.uniforms.pixelRatio.value=pixelRatio;
          host.dataset.renderRatio=pixelRatio.toFixed(2);
          // One direction, infrequent steps: scrolling cannot make quality
          // oscillate or repeatedly reallocate GPU buffers.
          nextQualityChange=now+10000;
        }
        qualityElapsed=slowElapsed=0;
      }
    }
    if (canMove()) {
      earth.rotation.y += delta * 0.010;
      clouds.rotation.y += delta * 0.012;
      earthMaterial.uniforms.cloudOffset.value = -(clouds.rotation.y - earth.rotation.y) / (Math.PI * 2);
      pointerX += (targetPointerX - pointerX) * Math.min(1, delta * 4);
      pointerY += (targetPointerY - pointerY) * Math.min(1, delta * 4);
      progress += (targetProgress-progress)*(1-Math.exp(-delta*18));
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
      host.querySelector('.earth-fallback')?.remove();
      renderer.domElement.style.visibility = 'visible';
      host.dataset.scene = 'ready';
      if (!readyEventSent) {
        readyEventSent = true;
        window.dispatchEvent(new CustomEvent('virentora:scene-ready', { detail: { surfaceWidth: day.image.width } }));
      } else {
        window.dispatchEvent(new CustomEvent('virentora:scene-restored'));
      }
    }
    if (canMove() || reveal.value < 1) requestFrame();
  }

  await waitForContext();
  if (fatal) return;
  // Warm programs before the moving scene starts. A context loss cannot strand
  // an async compilation promise tied to deleted WebGL programs.
  renderer.compile(scene,camera);
  if (fatal) return;
  resourcesReady = true;
  if (contextNeedsRebuild) { cosmicSky.resize(width,height,true); contextNeedsRebuild=false; }
  progress = targetProgress = Number.parseFloat(hero.style.getPropertyValue('--scene-progress')) || 0;
  host.dataset.triangles = String(sphere.index.count/3*(compact?2:3));
  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      qualityElapsed=slowElapsed=0;
    } else requestFrame(true);
  }, { rootMargin: '160px 0px', threshold: 0 });
  intersectionObserver.observe(host);

  compactMedia.addEventListener('change', () => {
    mobile=compactMedia.matches;
    if (mobile) pointerX=pointerY=targetPointerX=targetPointerY=0;
    resize(true);
  });

  window.addEventListener('virentora:motion', event => {
    paused = Boolean(event.detail?.paused);
    lastTime = 0;
    qualityElapsed=slowElapsed=0;
    requestFrame(true);
  });
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      progress = 0;
      pointerX = pointerY = targetPointerX = targetPointerY = 0;
    }
    lastTime = 0;
    requestFrame(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      qualityElapsed=slowElapsed=0;
    } else requestFrame(true);
  });
  window.addEventListener('virentora:scroll', event => {
    targetProgress=clamp(event.detail.progress);
    if (canMove()) requestFrame();
  });
  hero.addEventListener('pointermove', event => {
    if (mobile || event.pointerType === 'touch' || !canMove()) return;
    const bounds = host.getBoundingClientRect();
    targetPointerX = clamp((event.clientX - bounds.left) / width * 2 - 1, -1, 1);
    targetPointerY = clamp((event.clientY - bounds.top) / height * 2 - 1, -1, 1);
    requestFrame();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { targetPointerX = targetPointerY = 0; });
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0; qualityElapsed=slowElapsed=0; });
  window.addEventListener('pageshow', () => { resize(); requestFrame(true); });
  // A visitor can pause while the textures are loading.
  paused = document.documentElement.dataset.motion === 'paused';
  applyCamera();
  // Texture loading may have overlapped a viewport/orientation change.
  resize();
  requestFrame(true);
}
