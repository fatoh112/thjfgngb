import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { MeshoptDecoder } from './meshopt_decoder.module.js';
import { EffectComposer } from './AshmeEffectComposer.js';
import { RenderPass } from './AshmeRenderPass.js';
import { UnrealBloomPass } from './AshmeUnrealBloomPass.js';
import { OutputPass } from './AshmeOutputPass.js';
import { RoomEnvironment } from './AshmeRoomEnvironment.js';
import { makeAshChunk, makeAshCrown, makeCinderMaterial, makeDust, makeGlowTexture } from './ashme-intro-materials.js';

export async function createCinematicScene(root, canvas) {
  const width = window.innerWidth;
  const portrait = width < 820 && width / window.innerHeight < 0.82;
  const mobile = width < 750;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.2));
  renderer.setSize(width, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.72;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b0b);
  scene.fog = new THREE.FogExp2(0x0a1212, 0.026);
  const camera = new THREE.PerspectiveCamera(portrait ? 39 : 34, width / window.innerHeight, 0.1, 60);
  camera.position.set(0, 0.1, portrait ? 11.3 : 10.2);
  camera.lookAt(0, 0.1, 0);

  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room, 0.035).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.26;
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xaec9bf, 0x101615, 0.7));
  const key = new THREE.DirectionalLight(0xffead1, 1.7);
  key.position.set(-3.8, 4.6, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.0003;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x69c1b6, 1.4);
  rim.position.set(4.5, 0.5, -3.5);
  scene.add(rim);
  const trayKey = new THREE.SpotLight(0xb5f0df, 38, 15, Math.PI / 4.8, 0.62, 1.35);
  trayKey.position.set(2.5, 2.4, 6.3);
  trayKey.target.position.set(0, -1.4, 0);
  scene.add(trayKey, trayKey.target);
  const emberLight = new THREE.PointLight(0xff5726, 1.1, 2.5, 2);
  scene.add(emberLight);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const [cigaretteAsset, trayAsset] = await Promise.all([
    loader.loadAsync(root.dataset.cigaretteUrl),
    loader.loadAsync(root.dataset.trayUrl)
  ]);
  await MeshoptDecoder.ready;

  const cigarette = cigaretteAsset.scene;
  const cigaretteBounds = new THREE.Box3().setFromObject(cigarette);
  const cigaretteSize = cigaretteBounds.getSize(new THREE.Vector3());
  const cigaretteCenter = cigaretteBounds.getCenter(new THREE.Vector3());
  cigarette.position.sub(cigaretteCenter);
  const cigaretteLength = Math.max(cigaretteSize.x, cigaretteSize.y, cigaretteSize.z);
  const cigaretteScale = 4.62 / cigaretteLength;
  const cigaretteRoot = new THREE.Group();
  const cigaretteOrientation = new THREE.Group();
  if (cigaretteSize.y >= cigaretteSize.x && cigaretteSize.y >= cigaretteSize.z) cigaretteOrientation.rotation.z = -Math.PI / 2;
  else if (cigaretteSize.z >= cigaretteSize.x) cigaretteOrientation.rotation.y = Math.PI / 2;
  cigaretteOrientation.add(cigarette);
  cigaretteRoot.add(cigaretteOrientation);
  cigaretteRoot.scale.setScalar(cigaretteScale);
  cigaretteRoot.rotation.z = portrait ? Math.PI / 2 : -0.08;
  cigaretteRoot.position.set(portrait ? 0.5 : -0.32, portrait ? 0.8 : 1.24, 0.18);
  cigarette.traverse((item) => {
    if (!item.isMesh) return;
    item.castShadow = true;
    item.receiveShadow = true;
    item.material = (Array.isArray(item.material) ? item.material : [item.material]).map((source) => {
      const material = source.clone();
      material.roughness = Math.max(material.roughness || 0, 0.57);
      material.color.multiplyScalar(0.76);
      material.metalness = 0;
      material.envMapIntensity = 0.52;
      return material;
    });
    if (item.material.length === 1) item.material = item.material[0];
  });
  scene.add(cigaretteRoot);
  const tipLocal = new THREE.Vector3(cigaretteLength * cigaretteScale * 0.5, 0, 0);
  const cigaretteQuaternion = cigaretteRoot.quaternion.clone();
  const openingTip = tipLocal.clone().applyQuaternion(cigaretteQuaternion).add(cigaretteRoot.position);
  const paperDiameter = Math.min(cigaretteSize.x, cigaretteSize.y, cigaretteSize.z) * cigaretteScale;
  const radius = Math.max(paperDiameter * 0.52, 0.115);

  const charGroup = new THREE.Group();
  const charMaterial = new THREE.MeshStandardMaterial({ color: 0x302b28, roughness: 0.91, metalness: 0.02, emissive: 0x180804, emissiveIntensity: 0.55 });
  const charBand = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.98, radius * 1.03, 1, 32, 3, false), charMaterial);
  charBand.rotation.z = -Math.PI / 2;
  charBand.castShadow = true;
  const bandCenter = cigaretteLength * cigaretteScale * 0.5 - 0.46;
  charGroup.position.copy(cigaretteRoot.position);
  charGroup.quaternion.copy(cigaretteQuaternion);
  charBand.position.x = bandCenter;
  charBand.scale.y = 0.001;
  charGroup.add(charBand);
  scene.add(charGroup);

  const crown = new THREE.Mesh(makeAshCrown(radius * 0.98), makeCinderMaterial());
  crown.position.copy(openingTip).addScaledVector(new THREE.Vector3(1, 0, 0).applyQuaternion(cigaretteQuaternion), -radius * 1.6);
  crown.quaternion.copy(cigaretteQuaternion);
  crown.scale.x = 0.002;
  crown.castShadow = true;
  crown.receiveShadow = true;
  scene.add(crown);

  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.52, 28, 20),
    new THREE.MeshStandardMaterial({ color: 0xa93b20, emissive: 0xff3b17, emissiveIntensity: 4.2, roughness: 0.82 })
  );
  const emberAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(cigaretteQuaternion);
  ember.position.copy(openingTip).addScaledVector(emberAxis, 0.01);
  scene.add(ember);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeGlowTexture(), color: 0xff7546, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  glow.scale.set(radius * 1.7, radius * 1.7, 1);
  glow.position.copy(ember.position);
  scene.add(glow);
  emberLight.position.copy(ember.position);

  const crownCrumbs = new THREE.Group();
  for (let index = 0; index < 11; index += 1) {
    const crumb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius * (0.06 + (index % 4) * 0.018), 0),
      new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0x262927 : 0x737772, roughness: 1, flatShading: true })
    );
    const angle = index * 2.399;
    crumb.position.set(Math.cos(angle) * radius * 0.76, Math.sin(angle) * radius * 0.72, (index % 4 - 1.5) * radius * 0.16);
    crumb.rotation.set(angle, angle * 1.3, angle * 0.43);
    crumb.visible = false;
    crownCrumbs.add(crumb);
  }
  crown.add(crownCrumbs);

  const ashChunk = new THREE.Group();
  const mainAsh = new THREE.Mesh(makeAshChunk(radius * 1.06), makeCinderMaterial());
  mainAsh.scale.set(1.32, 0.76, 0.84);
  mainAsh.rotation.set(0.18, 0.23, -0.1);
  mainAsh.castShadow = true;
  ashChunk.add(mainAsh);
  const fragments = [];
  for (let index = 0; index < 7; index += 1) {
    const fragment = new THREE.Mesh(makeAshChunk(radius * (0.22 + (index % 3) * 0.065)), makeCinderMaterial());
    fragment.position.set((index - 3) * radius * 0.32, (index % 2 ? 1 : -1) * radius * 0.24, (index % 3 - 1) * radius * 0.18);
    fragment.rotation.set(index * 0.57, index * 0.24, index * 0.91);
    fragment.castShadow = true;
    fragment.visible = false;
    ashChunk.add(fragment);
    fragments.push(fragment);
  }
  ashChunk.position.copy(crown.position).addScaledVector(emberAxis, radius * 0.76);
  ashChunk.quaternion.copy(cigaretteQuaternion);
  ashChunk.visible = false;
  scene.add(ashChunk);
  const dust = makeDust(mobile ? 44 : 80);
  scene.add(dust);

  const tray = trayAsset.scene;
  const trayBounds = new THREE.Box3().setFromObject(tray);
  const traySize = trayBounds.getSize(new THREE.Vector3());
  const trayCenter = trayBounds.getCenter(new THREE.Vector3());
  tray.position.sub(trayCenter);
  tray.rotation.set(0.58, -0.17, 0.12);
  const trayBaseScale = 3.65 / Math.max(traySize.x, traySize.y);
  const trayOffset = trayCenter.clone().multiplyScalar(-trayBaseScale).applyEuler(tray.rotation);
  tray.scale.setScalar(trayBaseScale);
  tray.position.set(0, -1.4, -0.24).add(trayOffset);
  tray.traverse((item) => {
    if (!item.isMesh) return;
    item.castShadow = true;
    item.receiveShadow = true;
    const materialize = (source) => {
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.31,
        metalness: 0.025,
        clearcoat: 0.46,
        clearcoatRoughness: 0.3,
        envMapIntensity: 0.76,
        vertexColors: Boolean(item.geometry.getAttribute('color')),
        map: source.map || null
      });
      return material;
    };
    item.material = (Array.isArray(item.material) ? item.material : [item.material]).map(materialize);
    if (item.material.length === 1) item.material = item.material[0];
  });
  tray.visible = false;
  scene.add(tray);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshBasicMaterial({ color: 0x030606 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -3.72, -0.4);
  ground.receiveShadow = true;
  scene.add(ground);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.7, 64), new THREE.MeshBasicMaterial({ color: 0x020605, transparent: true, opacity: 0.46, depthWrite: false }));
  shadow.scale.set(1.42, 0.5, 1);
  shadow.position.set(0.12, -3.0, 0.2);
  scene.add(shadow);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, window.innerHeight), mobile ? 0.2 : 0.24, 0.24, 2.1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const state = {
    burn: 0,
    ash: 0,
    sag: 0,
    break: 0,
    fall: 0,
    reveal: 0,
    impact: 0,
    hero: 0,
    exit: 0,
    cameraY: 0,
    cameraX: 0,
    viewport: { portrait, mobile }
  };
  const homeAshPosition = ashChunk.position.clone();
  const debugIntro = new URLSearchParams(location.search).has('ashme_debug');
  const animate = (elapsed) => {
    const flicker = 0.84 + 0.09 * Math.sin(elapsed * 16.4) + 0.055 * Math.sin(elapsed * 31.8 + 1.1);
    ember.material.emissiveIntensity = 2.6 + flicker * 1.8;
    ember.scale.setScalar(0.97 + flicker * 0.055);
    glow.material.opacity = (0.11 + flicker * 0.07) * (1 - state.break);
    glow.scale.setScalar(radius * (1.6 + flicker * 0.16));
    emberLight.intensity = (0.85 + flicker * 1.35) * (1 - state.break * 0.92);
    const charLength = state.burn * 0.92;
    charBand.scale.y = Math.max(0.001, charLength);
    charBand.position.x = bandCenter - charLength * 0.45;
    crown.scale.x = Math.max(0.002, state.ash * 0.98);
    crown.visible = state.break < 0.55;
    crown.position.copy(openingTip).addScaledVector(emberAxis, -radius * 1.6 - state.sag * radius * 0.22);
    crown.position.z += Math.sin(elapsed * 3.4) * radius * 0.025 + radius * 0.05;
    crownCrumbs.children.forEach((crumb, index) => { crumb.visible = state.ash > 0.68 && state.break < 0.35; crumb.position.x = Math.cos(index * 2.399 + elapsed * 1.7) * radius * 0.76; });
    const detached = state.break > 0.42;
    ashChunk.visible = detached;
    const fallProgress = Math.max(0, Math.min(1, (state.fall - 0.03) / 0.97));
    ashChunk.position.set(
      THREE.MathUtils.lerp(homeAshPosition.x, 0.12, fallProgress) + Math.sin(fallProgress * 2.7) * 0.13,
      THREE.MathUtils.lerp(homeAshPosition.y - state.sag * radius * 0.35, -1.82, fallProgress),
      THREE.MathUtils.lerp(homeAshPosition.z + 0.05, 0.12, fallProgress)
    );
    ashChunk.rotation.x = 0.1 + fallProgress * 0.66;
    ashChunk.rotation.y = fallProgress * 0.95;
    ashChunk.rotation.z = -0.1 - fallProgress * 0.42;
    fragments.forEach((fragment, index) => {
      const fragmentLife = Math.max(0, state.break - 0.34);
      fragment.visible = detached && fragmentLife > 0.04 && fallProgress < 0.8;
      const phase = fragmentLife * 1.5;
      fragment.position.x = (index - 3) * radius * (0.32 + phase * 0.46) + Math.sin(elapsed * 4 + index) * radius * 0.12;
      fragment.position.y = (index % 2 ? 1 : -1) * radius * (0.24 + phase * 0.62) - phase * phase * 0.18;
      fragment.position.z = (index % 3 - 1) * radius * 0.18 + phase * 0.22;
    });
    dust.material.opacity = Math.min(0.45, Math.max(0, state.break * 0.32));
    const positions = dust.geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
      const seed = index * 0.61;
      positions.array[index * 3] = ashChunk.position.x + Math.sin(elapsed * 1.1 + seed) * (0.09 + fallProgress * 0.11);
      positions.array[index * 3 + 1] = ashChunk.position.y + Math.sin(seed * 8 + elapsed * 1.5) * 0.14 - (index % 7) * 0.014;
      positions.array[index * 3 + 2] = ashChunk.position.z + Math.cos(elapsed * 1.2 + seed * 1.3) * 0.12;
    }
    positions.needsUpdate = true;
    tray.visible = state.reveal > 0.005;
    tray.position.set(0, THREE.MathUtils.lerp(-1.95, -1.4, state.reveal), -0.24).add(trayOffset);
    tray.scale.setScalar(trayBaseScale * THREE.MathUtils.lerp(0.93, 1.0, state.reveal));
    const impact = Math.max(0, 1 - state.impact);
    tray.position.y += Math.sin(impact * Math.PI) * 0.035;
    shadow.material.opacity = 0.32 + 0.15 * state.reveal;

    const follow = state.fall;
    const cameraTargetY = THREE.MathUtils.lerp(-1.55 * follow, -1.8, state.hero);
    const cameraTargetX = Math.sin(follow * 2.1) * 0.055;
    state.cameraY += (cameraTargetY - state.cameraY) * 0.075;
    state.cameraX += (cameraTargetX - state.cameraX) * 0.075;
    camera.position.x = state.cameraX;
    camera.position.y = state.cameraY + 0.1 + state.hero * 4.1;
    camera.position.z = THREE.MathUtils.lerp(portrait ? 11.3 : 10.2, portrait ? 9.65 : 8.25, state.hero);
    camera.fov = portrait ? THREE.MathUtils.lerp(39, 42, state.hero) : THREE.MathUtils.lerp(34, 37, state.hero);
    camera.lookAt(state.cameraX * 0.5, state.cameraY - 0.03, 0);
    camera.updateProjectionMatrix();
    trayKey.intensity = THREE.MathUtils.lerp(12, 44, state.reveal) + state.hero * 8;
    trayKey.target.position.set(0.1, -1.4, -0.05);
    key.intensity = 1.95 + state.hero * 0.45;
    cigaretteRoot.position.x = portrait ? 0.5 : -0.32;
    cigaretteRoot.position.y = (portrait ? 0.8 : 1.24) + state.exit * 1.55;
    cigaretteRoot.rotation.z = (portrait ? Math.PI / 2 : -0.08) + state.exit * (portrait ? -0.08 : 0.08);
    composer.render();
    if (debugIntro) root.dataset.ashmeDebug = `${state.burn.toFixed(2)},${state.ash.toFixed(2)},${state.break.toFixed(2)},${state.fall.toFixed(2)},${state.reveal.toFixed(2)},${state.hero.toFixed(2)},${camera.position.y.toFixed(2)},${tray.position.y.toFixed(2)},${ashChunk.position.y.toFixed(2)}`;
  };

  const resize = () => {
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;
    const nextPortrait = nextWidth < 820 && nextWidth / nextHeight < 0.82;
    const nextMobile = nextWidth < 750;
    state.viewport = { portrait: nextPortrait, mobile: nextMobile };
    camera.aspect = nextWidth / nextHeight;
    camera.fov = nextPortrait ? 39 : 34;
    camera.position.z = nextPortrait ? 11.3 : 10.2;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, nextMobile ? 1 : 1.2));
    renderer.setSize(nextWidth, nextHeight, false);
    composer.setSize(nextWidth, nextHeight);
    bloom.setSize(nextWidth, nextHeight);
  };
  const render = (time = 0) => animate(time * 0.001);

  return { renderer, scene, camera, composer, bloom, resize, render, state, cigaretteRoot, tray, ashChunk, mainAsh, fragments, ember, glow, charBand, crown, dust, openingTip, mobile, portrait, dispose() {
    composer.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    environment.dispose();
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (!object.material) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        for (const value of Object.values(material)) if (value?.isTexture) value.dispose();
        material.dispose();
      }
    });
  } };
}
