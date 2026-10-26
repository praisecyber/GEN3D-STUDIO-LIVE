import * as THREE from '../node_modules/three/build/three.module.js';
import {GLTFLoader} from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';

// Orange robot presenter built from simple shapes. Swap this file for a glTF avatar later.
export function createAvatar(canvas, options={}) {
  canvas.setAttribute('aria-label','Orange robot presenter');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer:options.preserveDrawingBuffer===true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 1.0, 8.5);
  cam.lookAt(0, 0.8, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7be0ff, 0.9); rim.position.set(-4, 2, -3); scene.add(rim);

  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.2, ...o });
  const orange = mat(0xff7a1a), deep = mat(0xe05a00), dark = mat(0x1b1326, { metalness: 0.4 });
  const glow = mat(0x7be0ff, { emissive: 0x3ac8f0, emissiveIntensity: 1.2 });
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };

  const robot = new THREE.Group(); scene.add(robot);
  add(robot, new THREE.BoxGeometry(1.7, 1.6, 1.1), deep, 0, -0.55, 0);
  add(robot, new THREE.BoxGeometry(0.6, 0.35, 0.05), mat(0xffd9a8), 0, -0.45, 0.58);

  const head = new THREE.Group(); head.position.y = 0.95; robot.add(head);
  add(head, new THREE.BoxGeometry(1.9, 1.4, 1.4), orange);
  add(head, new THREE.BoxGeometry(1.5, 0.9, 0.06), dark, 0, 0.05, 0.71);
  const eyeL = add(head, new THREE.SphereGeometry(0.15, 20, 20), glow, -0.36, 0.2, 0.76);
  const eyeR = add(head, new THREE.SphereGeometry(0.15, 20, 20), glow, 0.36, 0.2, 0.76);
  const mouth = add(head, new THREE.BoxGeometry(0.5, 0.07, 0.05), glow, 0, -0.14, 0.76);
  add(head, new THREE.CylinderGeometry(0.04, 0.04, 0.4, 10), mat(0xffb36b), 0, 0.9, 0);
  add(head, new THREE.SphereGeometry(0.11, 16, 16), mat(0xffd9a8), 0, 1.15, 0);
  for (const sx of [-1, 1]) { const e = add(head, new THREE.CylinderGeometry(0.25, 0.25, 0.2, 20), deep, sx * 1.0, 0, 0); e.rotation.z = Math.PI / 2; }

  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-1.0, -0.1, 0); armR.position.set(1.0, -0.1, 0);
  robot.add(armL, armR);
  for (const a of [armL, armR]) { add(a, new THREE.CylinderGeometry(0.16, 0.16, 1.0, 14), deep, 0, -0.5, 0); add(a, new THREE.SphereGeometry(0.2, 14, 14), orange, 0, -1.05, 0); }

  let speaking = false, mouthOpen = 0, audioLevel=null,custom=null,mixer=null,modelRequest=0;const morphs=[];
  let lastWidth=0,lastHeight=0;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h || (w===lastWidth&&h===lastHeight)) return;
    lastWidth=w;lastHeight=h;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);

  const clock = new THREE.Clock(); let nextBlink = 2,lastFrame=0;
  function renderFrame(){
    const t = clock.getElapsedTime();
    robot.position.y = Math.sin(t * 1.6) * 0.04;
    head.rotation.y = Math.sin(t * 0.7) * 0.18;
    head.rotation.x = speaking ? Math.sin(t * 5) * 0.04 : 0;
    if(mixer)mixer.update(Math.min(.1,t-lastFrame));lastFrame=t;
    const target = audioLevel!==null?audioLevel:speaking ? 0.3 + Math.abs(Math.sin(t * 13)) * 0.7 * (0.6 + 0.4 * Math.sin(t * 5.3)) : 0;
    mouthOpen += (target - mouthOpen) * 0.35;
    mouth.scale.y = 1 + mouthOpen * 9;for(const [mesh,index]of morphs)mesh.morphTargetInfluences[index]=mouthOpen;
    armR.rotation.z = speaking ? -0.5 + Math.sin(t * 3) * 0.25 : -0.08;
    armL.rotation.z = 0.08;
    const blinking = t > nextBlink && t < nextBlink + 0.12;
    eyeL.scale.y = eyeR.scale.y = blinking ? 0.1 : 1;
    if (t > nextBlink + 0.12) nextBlink = t + 2 + Math.random() * 3;
    renderer.render(scene, cam);
  }
  if(!options.manual)renderer.setAnimationLoop(renderFrame);
  let captureRaw=null,captureRgba=null;
  function captureFrame(){resize();renderFrame();const gl=renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;if(gl.isContextLost()||!w||!h)throw Error('The 3D export renderer is unavailable.');const size=w*h*4;if(!captureRaw||captureRaw.length!==size){captureRaw=new Uint8Array(size);captureRgba=new Uint8ClampedArray(size);}gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,captureRaw);const stride=w*4;for(let y=0;y<h;y++)captureRgba.set(captureRaw.subarray((h-1-y)*stride,(h-y)*stride),y*stride);return new ImageData(captureRgba,w,h);}
  function clearModel(){if(custom){scene.remove(custom);custom.traverse(object=>{object.geometry?.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];for(const material of materials)material?.dispose();});custom=null;}mixer=null;morphs.length=0;robot.visible=true;canvas.setAttribute('aria-label','Orange robot presenter');}
  return {captureFrame,renderFrame:()=>{resize();renderFrame();},setSpeaking:v=>{speaking=!!v;},setAudioLevel:value=>{audioLevel=value===null?null:Math.max(0,Math.min(1,Number(value)||0));},
    async loadModel(url){const request=++modelRequest;const gltf=await new GLTFLoader().loadAsync(url);if(request!==modelRequest)return;clearModel();custom=gltf.scene;const box=new THREE.Box3().setFromObject(custom),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());const scale=3/Math.max(size.x,size.y,size.z,.001);custom.scale.setScalar(scale);custom.position.set(-center.x*scale,-center.y*scale+.6,-center.z*scale);scene.add(custom);robot.visible=false;canvas.setAttribute('aria-label','Custom 3D presenter');custom.traverse(object=>{if(object.morphTargetDictionary)for(const [name,index]of Object.entries(object.morphTargetDictionary))if(/^(mouthopen|jawopen|viseme_aa|viseme_a)$/i.test(name))morphs.push([object,index]);});if(gltf.animations.length){mixer=new THREE.AnimationMixer(custom);mixer.clipAction(gltf.animations[0]).play();}},
    resetModel(){modelRequest++;clearModel();},dispose(){modelRequest++;observer.disconnect();renderer.setAnimationLoop(null);clearModel();scene.traverse(object=>{object.geometry?.dispose();if(object.material)for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();});renderer.dispose();}
  };
}
