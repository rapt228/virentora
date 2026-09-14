import * as THREE from './assets/three.module.js';

const host=document.querySelector('#earth-stage');
const motionButton=document.querySelector('#motion-toggle');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=reduced.matches;
function syncMotion(){motionButton.setAttribute('aria-pressed',String(paused));document.querySelector('#motion-symbol').textContent=paused?'▷':'Ⅱ';}
syncMotion();
motionButton.addEventListener('click',()=>{paused=!paused;syncMotion();});
reduced.addEventListener('change',()=>{paused=reduced.matches;syncMotion();});

async function initEarth(){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0x030507,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const camera=new THREE.OrthographicCamera(-6,6,3.6,-3.6,.1,60);
  camera.position.z=8;
  const loader=new THREE.TextureLoader();
  const [day,night,packed]=await Promise.all([
    loader.loadAsync('./assets/earth_day_4096.jpg'),
    loader.loadAsync('./assets/earth_night_4096.jpg'),
    loader.loadAsync('./assets/earth_bump_roughness_clouds_4096.jpg')
  ]);
  day.colorSpace=night.colorSpace=THREE.SRGBColorSpace;
  [day,night,packed].forEach(t=>{t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());});
  const group=new THREE.Group();scene.add(group);
  const sun=new THREE.Vector3(-2.5,2.2,2.1).normalize();
  const sphere=new THREE.SphereGeometry(1,128,96);
  const vertex=`varying vec2 vUv; varying vec3 vNormal; varying vec3 vWorld;
    void main(){vUv=uv;vNormal=normalize(mat3(modelMatrix)*normal);vWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
  const material=new THREE.ShaderMaterial({
    uniforms:{dayMap:{value:day},nightMap:{value:night},details:{value:packed},sun:{value:sun}},
    vertexShader:vertex,
    fragmentShader:`uniform sampler2D dayMap;uniform sampler2D nightMap;uniform sampler2D details;uniform vec3 sun;
      varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;
      void main(){
        vec3 n=normalize(vNormal);vec3 view=vec3(0.,0.,1.);
        float h=texture2D(details,vUv).r;
        vec2 delta=vec2(1./4096.,1./2048.);
        float dx=texture2D(details,vUv+vec2(delta.x,0.)).r-h;
        float dy=texture2D(details,vUv+vec2(0.,delta.y)).r-h;
        vec3 tangent=normalize(vec3(-n.z,.0001,n.x));
        vec3 bitangent=normalize(cross(n,tangent));
        n=normalize(n-tangent*dx*2.4-bitangent*dy*2.4);
        float light=dot(n,sun);float daylight=smoothstep(-.12,.3,light);
        vec3 land=texture2D(dayMap,vUv).rgb;vec3 cities=texture2D(nightMap,vUv).rgb;
        float rough=texture2D(details,vUv).g;
        float ocean=1.-smoothstep(.18,.7,rough);
        land=mix(land,land*vec3(.42,.65,1.02),ocean*.7);
        vec3 base=land*(.025+pow(max(light,0.),.85)*1.32);
        base+=cities*vec3(1.05,.74,.42)*(1.-daylight)*2.2;
        vec3 halfway=normalize(sun+view);float spec=pow(max(dot(n,halfway),0.),65.)*(1.-rough);
        base+=vec3(.30,.56,.9)*spec*.52*daylight;
        float rim=pow(1.-max(dot(n,view),0.),4.5);
        base+=vec3(.05,.38,.95)*rim*smoothstep(-.25,.6,light)*1.05;
        gl_FragColor=vec4(base,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  const earth=new THREE.Mesh(sphere,material);group.add(earth);
  const clouds=new THREE.Mesh(sphere,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    uniforms:{details:{value:packed},sun:{value:sun}},vertexShader:vertex,
    fragmentShader:`uniform sampler2D details;uniform vec3 sun;varying vec2 vUv;varying vec3 vNormal;varying vec3 vWorld;
      void main(){float c=texture2D(details,vUv).b;float l=max(dot(normalize(vNormal),sun),0.);gl_FragColor=vec4(vec3(.82,.9,1.)*(.04+l*1.2),smoothstep(.19,.8,c)*.86);
      #include <colorspace_fragment>
      }`
  }));clouds.scale.setScalar(1.006);group.add(clouds);
  const atmosphere=new THREE.Mesh(sphere,new THREE.ShaderMaterial({
    transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.BackSide,
    uniforms:{sun:{value:sun}},vertexShader:vertex,
    fragmentShader:`uniform vec3 sun;varying vec3 vNormal;varying vec3 vWorld;void main(){
      vec3 n=normalize(vNormal);vec3 v=vec3(0.,0.,1.);
      float edge=pow(max(0.,1.+dot(n,v)),7.);
      float lit=smoothstep(-.25,.65,dot(n,sun));
      gl_FragColor=vec4(vec3(.04,.40,1.),edge*(.16+lit*1.3));}`
  }));atmosphere.scale.setScalar(1.034);group.add(atmosphere);
  // Fixed seed keeps the sparse star field stable between visits.
  const points=[];let seed=2897;function rand(){seed=(seed*16807)%2147483647;return(seed-1)/2147483646;}
  for(let i=0;i<100;i++)points.push((rand()-.5)*26,(rand()-.5)*18,-5-rand()*12);
  const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:0xbad7ff,size:1.2,transparent:true,opacity:.65,sizeAttenuation:false,depthWrite:false}));scene.add(stars);
  let small=false,visible=true,scroll=0,targetX=0,targetY=0;
  let homeY=0;
  function resize(){
    const w=host.clientWidth,h=host.clientHeight;small=w<700;
    renderer.setSize(w,h);camera.left=-3.6*w/h;camera.right=3.6*w/h;camera.updateProjectionMatrix();
    const copy=document.querySelector('.hero-copy');
    const radius=small?w*.8:Math.min(w*.49,h*.65);
    const top=copy.offsetHeight+(small?48:45);
    group.scale.setScalar(radius/h*7.2);
    homeY=(.5-(top+radius)/h)*7.2;group.position.y=homeY;
  }
  new ResizeObserver(resize).observe(host);resize();
  new ResizeObserver(resize).observe(document.querySelector('.hero-copy'));
  document.fonts.ready.then(resize);
  earth.rotation.y=clouds.rotation.y=4.05;earth.rotation.z=clouds.rotation.z=.08;
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;},{rootMargin:'100px'});observer.observe(host);
  addEventListener('scroll',()=>{scroll=Math.min(1,scrollY/host.clientHeight);},{passive:true});
  host.parentElement.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||reduced.matches)return;targetX=(e.clientX/innerWidth-.5)*.07;targetY=(e.clientY/innerHeight-.5)*.04;},{passive:true});
  host.parentElement.addEventListener('pointerleave',()=>{targetX=targetY=0;});
  let last=0;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-last)/1000,.05);last=now;
    if(!visible||document.hidden)return;
    if(!paused){earth.rotation.y+=dt*.013;clouds.rotation.y+=dt*.017;}
    if(!reduced.matches){group.rotation.y+=(targetX-group.rotation.y)*.035;group.rotation.x+=(targetY+scroll*.1-group.rotation.x)*.035;group.position.y=homeY+scroll*.35;}
    renderer.render(scene,camera);
  });
  renderer.domElement.addEventListener('webglcontextlost',()=>{renderer.setAnimationLoop(null);motionButton.hidden=true;});
}
initEarth().catch(()=>{host.classList.add('unavailable');motionButton.hidden=true;});

const burger=document.querySelector('#burger');
const menu=document.querySelector('#mm');
const menuSync=new MutationObserver(()=>burger.setAttribute('aria-expanded',String(menu.classList.contains('open'))));
menuSync.observe(menu,{attributes:true,attributeFilter:['class']});
addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.classList.contains('open')){burger.click();burger.focus();}});
document.querySelectorAll('.qa').forEach((qa,i)=>{
  const button=qa.querySelector('button'),answer=qa.querySelector('.qa-a');answer.id='answer-'+i;button.setAttribute('aria-controls',answer.id);
  new MutationObserver(()=>button.setAttribute('aria-expanded',String(qa.classList.contains('open')))).observe(qa,{attributes:true,attributeFilter:['class']});
});
