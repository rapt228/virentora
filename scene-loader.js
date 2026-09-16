// Loading is a live scene, never a stretched Earth photograph.
// Start the matching maps while Three.js is still being loaded and parsed.
// The texture loader reuses these same URLs; phones never fetch desktop maps.
const compact = matchMedia('(max-width: 800px), (pointer: coarse)').matches;
const highSurface = !compact && matchMedia('(min-width: 1100px)').matches && !navigator.connection?.saveData;
const maps = compact
  ? ['earth-day-2k.webp','earth-night-1k.webp','earth-details-1k.webp','earth-clouds-2k.webp']
  : [highSurface ? 'earth-day-8k.webp' : 'earth-day-4k.webp','earth-night-4k.webp','earth_bump_roughness_clouds_4096.jpg','earth-clouds-4k.webp'];
for (const name of maps) {
  const preload = document.createElement('link');
  preload.rel = 'preload'; preload.as = 'image'; preload.href = `./assets/${name}`;
  document.head.append(preload);
}
import('./earth.js?v=20260916-mobile4').catch(error => {
  const host = document.querySelector('#earth-stage');
  const fallback = document.querySelector('#earth-fallback-template');
  if (host && fallback && !host.querySelector('.earth-fallback')) host.append(fallback.content.cloneNode(true));
  if (host) host.dataset.scene = 'fallback';
  window.dispatchEvent(new CustomEvent('virentora:scene-error'));
  console.warn('Virentora: the 3D module is unavailable.', error);
});
