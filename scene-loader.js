// Loading is a live scene, never a stretched Earth photograph.
import('./earth.js?v=20260914-smooth3').catch(error => {
  const host = document.querySelector('#earth-stage');
  const fallback = document.querySelector('#earth-fallback-template');
  if (host && fallback && !host.querySelector('.earth-fallback')) host.append(fallback.content.cloneNode(true));
  if (host) host.dataset.scene = 'fallback';
  window.dispatchEvent(new CustomEvent('virentora:scene-error'));
  console.warn('Virentora: the 3D module is unavailable.', error);
});
