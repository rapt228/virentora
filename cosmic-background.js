// A procedural sky, rendered once per size. No stock image, frame-by-frame
// noise generation or full-resolution volumetric ray marching is required.
export function createCosmicBackground(THREE, renderer, {maxWidth=1536,maxHeight=1024}={}) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: false, stencilBuffer: false
  });
  const camera = new THREE.Camera();
  const bakeScene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const vertexShader = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }
  `;
  const material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { aspect: { value: 1 } },
    vertexShader,
    fragmentShader: `
      varying vec2 vUv;
      uniform float aspect;
      float hash(vec2 p) {
        vec3 q = fract(vec3(p.xyx) * 0.1031);
        q += dot(q, q.yzx + 33.33);
        return fract((q.x + q.y) * q.z);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
                   mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float result = 0.0, amplitude = 0.5;
        mat2 turn = mat2(0.80, 0.60, -0.60, 0.80);
        for (int i = 0; i < 6; i++) {
          result += noise(p) * amplitude;
          p = turn * p * 2.04 + 7.13;
          amplitude *= 0.5;
        }
        return result;
      }
      void main() {
        vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
        vec2 field = p * 3.7 + vec2(11.2, 4.6);
        float warp = fbm(field * 0.72);
        float clouds = fbm(field + vec2(warp * 2.6, -warp));
        float fine = fbm(field * 4.2 + clouds * 2.3);
        float axis = dot(p, vec2(-0.54, 0.84)) - 0.08 + (warp-0.5)*0.32;
        float ribbon = exp(-axis*axis*10.0);
        float thread = exp(-axis*axis*42.0);
        float density = smoothstep(0.22, 0.79, clouds) * ribbon;
        float dust = smoothstep(0.46, 0.68, fine) * thread;
        vec3 blue = vec3(0.055, 0.17, 0.31);
        vec3 violet = vec3(0.17, 0.095, 0.255);
        vec3 cloudColor = mix(blue, violet, smoothstep(0.1,0.9,warp));
        vec3 color = vec3(0.0015,0.0025,0.006);
        color += cloudColor * density * (0.28 + fine*0.42);
        color += vec3(0.10,0.22,0.28) * pow(density,2.4) * 0.30;
        color *= 1.0 - dust * 0.73;
        // Reserve a calm reading area without erasing the surrounding sky.
        float reading = exp(-pow((vUv.x-0.27)/0.28,2.0)
                            -pow((vUv.y-0.50)/0.27,2.0));
        color *= 1.0-reading*0.54;
        float vignette = 1.0 - smoothstep(0.35,0.85,length(vUv-0.5))*0.40;
        color *= vignette * 0.68;
        // Store in perceptual space to preserve dark gradients in an 8-bit target.
        vec3 encoded = mix(color*12.92,1.055*pow(color,vec3(1.0/2.4))-0.055,
                           step(vec3(0.0031308),color));
        encoded += (hash(gl_FragCoord.xy)-0.5)/255.0;
        gl_FragColor = vec4(encoded,1.0);
      }
    `
  });
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  bakeScene.add(quad);
  const sky = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    depthWrite: false, depthTest: false,
    uniforms: { skyMap: { value: target.texture } },
    vertexShader,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D skyMap;
      void main() {
        gl_FragColor = texture2D(skyMap,vUv);

      }
    `
  }));
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  let previousWidth=0, previousHeight=0, previousAspect=0;
  return {
    mesh: sky,
    resize(width,height,force=false) {
      const scale = Math.min(1, maxWidth/width, maxHeight/height);
      const w=Math.max(1,Math.round(width*scale)), h=Math.max(1,Math.round(height*scale));
      if (!force && w===previousWidth && h===previousHeight && width/height===previousAspect) return;
      previousWidth=w; previousHeight=h; previousAspect=width/height;
      target.setSize(w,h);
      material.uniforms.aspect.value = width/height;
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.render(bakeScene,camera);
      renderer.setRenderTarget(previous);
    }
  };
}
