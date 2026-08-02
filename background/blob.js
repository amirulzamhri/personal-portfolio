import * as THREE from 'three';

// Configuration (unchanged from your original script.js)
const blobCfg = {
  color1  : '#d60000',
  color2  : '#440101',
  color3  : '#200000',
  brightness : 1,
  freq       : 1.2,
  amp        : 0.21,
  spd        : 0.1,
  strength   : 0.6,
  fov        : 45,
  pxDensity  : 0.8,
  rotX : 0, rotY : 130, rotZ : 70
};

export function initBlob(canvasId) {
  const blobCanvas = document.getElementById(canvasId);
  if (!blobCanvas) {
    console.error(`Missing <canvas id="${canvasId}">`);
    return;
  }

  // Scene / camera
  const blobScene = new THREE.Scene();
  blobScene.background = new THREE.Color(0x000000);

  const blobCamera = new THREE.PerspectiveCamera(
    blobCfg.fov,
    window.innerWidth / window.innerHeight,
    0.1, 1000
  );

  // Fixed camera position (original placement)
  const phi = THREE.MathUtils.degToRad(180);
  const theta = THREE.MathUtils.degToRad(270);
  const dist = 0.5 * 15.09 * 0.33;
  blobCamera.position.set(
    dist * Math.sin(phi) * Math.sin(theta) - 1.5,
    dist * Math.cos(phi),
    dist * Math.sin(phi) * Math.cos(theta)
  );
  blobCamera.lookAt(0, 0, 0);

  // Renderer
  const blobRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, canvas: blobCanvas });
  blobRenderer.setSize(window.innerWidth, window.innerHeight);
  blobRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * blobCfg.pxDensity);

  // Controls (disabled)
  import('three/addons/controls/OrbitControls.js').then(({ OrbitControls }) => {
    new OrbitControls(blobCamera, blobRenderer.domElement).enabled = false;
  });

  // ── Shaders (identical to your original) ──
  const vertShader = /* glsl */`
    varying vec3 vNormal;
    varying vec3 vViewPos;
    varying vec3 vWorldPos;
    uniform float uTime, uFrequency, uAmplitude, uSpeed;

    vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v){
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 1.0/7.0;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      float t = uTime * uSpeed;
      float noise = snoise(position * uFrequency + t) * uAmplitude;
      noise += snoise(position * 2.5 - t * 1.5) * (uAmplitude * 0.4);
      vec3 newPos = position + normal * noise;
      vWorldPos = newPos;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vec4 mv = modelViewMatrix * vec4(newPos, 1.0);
      vViewPos = -mv.xyz;
      gl_Position = projectionMatrix * mv;
    }
  `;

  const fragShader = /* glsl */`
    varying vec3 vNormal;
    varying vec3 vViewPos;
    varying vec3 vWorldPos;
    uniform float uTime, uSpeed, uFrequency, uAmplitude, uStrength, uBrightness;
    uniform vec3 uColor1, uColor2, uColor3;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vec3 n = normalize(vNormal);
      vec3 viewDir = normalize(vViewPos);
      float t = uTime * uSpeed;
      float noiseVal = snoise(vWorldPos * uFrequency + t) * uAmplitude;
      noiseVal = noiseVal * 0.5 + 0.5;
      float mix1 = smoothstep(0.0, uStrength, noiseVal);
      float mix2 = smoothstep(uStrength, 1.0, noiseVal);
      vec3 col = mix(uColor1, uColor2, mix1);
      col = mix(col, uColor3, mix2);
      col *= uBrightness;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // Uniforms
  const u = {
    uTime: { value: 0 },
    uSpeed: { value: blobCfg.spd },
    uFrequency: { value: blobCfg.freq },
    uAmplitude: { value: blobCfg.amp },
    uStrength: { value: blobCfg.strength },
    uBrightness: { value: blobCfg.brightness },
    uColor1: { value: new THREE.Color(blobCfg.color1) },
    uColor2: { value: new THREE.Color(blobCfg.color2) },
    uColor3: { value: new THREE.Color(blobCfg.color3) }
  };

  const blobMat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: vertShader,
    fragmentShader: fragShader,
    depthWrite: true,
    side: THREE.FrontSide
  });

  const blobGeo = new THREE.IcosahedronGeometry(1.5, 64);
  const blob = new THREE.Mesh(blobGeo, blobMat);
  blob.rotation.set(
    THREE.MathUtils.degToRad(blobCfg.rotX),
    THREE.MathUtils.degToRad(blobCfg.rotY),
    THREE.MathUtils.degToRad(blobCfg.rotZ)
  );
  blobScene.add(blob);

  // Animation loop
  const blobClock = new THREE.Clock();
  (function animateBlob() {
    const dt = blobClock.getDelta();
    requestAnimationFrame(animateBlob);
    u.uTime.value += dt;
    blobRenderer.render(blobScene, blobCamera);
  })();

  // Resize handler for this canvas
  window.addEventListener('resize', () => {
    blobCamera.aspect = window.innerWidth / window.innerHeight;
    blobCamera.updateProjectionMatrix();
    blobRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  console.log('✨ 3D noise blob initialised');
}