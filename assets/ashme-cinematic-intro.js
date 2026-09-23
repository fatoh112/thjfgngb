import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { MeshoptDecoder } from './meshopt_decoder.module.js';

const root = document.querySelector('[data-ashme-cinematic]');

if (root && !window.__ashmeCinematicStarted) {
  window.__ashmeCinematicStarted = true;

  const canvas = root.querySelector('[data-ashme-canvas]');
  const skip = root.querySelector('[data-ashme-skip]');
  const copy = root.querySelector('[data-ashme-copy]');
  const progress = root.querySelector('[data-ashme-progress]');
  const sessionKey = 'ashme-cinematic-intro-seen';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gsap = window.gsap;

  const hasSeenIntro = () => {
    try {
      return sessionStorage.getItem(sessionKey) === '1';
    } catch {
      return false;
    }
  };

  const rememberIntro = () => {
    try {
      sessionStorage.setItem(sessionKey, '1');
    } catch {
      return;
    }
  };

  if (!reducedMotion && !hasSeenIntro() && gsap) {
    startIntro().catch(finish);
  }

  function closeIntro() {
    root.hidden = true;
    root.style.opacity = '';
    document.documentElement.classList.remove('ashme-cinematic-active');
    restoreScroll();
    window.removeEventListener('keydown', onKeyDown);
    skip.removeEventListener('click', onSkip);
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') onSkip();
  }

  function onSkip() {
    if (root.hidden || root.dataset.closing === 'true') return;
    root.dataset.closing = 'true';
    rememberIntro();
    if (root._ashmeTimeline) root._ashmeTimeline.kill();
    gsap.to(root, { autoAlpha: 0, duration: 0.55, ease: 'power2.inOut', onComplete: finish });
  }

  function finish() {
    if (root._ashmeFinished) return;
    root._ashmeFinished = true;
    rememberIntro();
    if (root._ashmeTimeline) root._ashmeTimeline.kill();
    if (root._ashmeRenderer) root._ashmeRenderer.setAnimationLoop(null);
    if (root._ashmeResize) window.removeEventListener('resize', root._ashmeResize);
    if (root._ashmeContextLoss) canvas.removeEventListener('webglcontextlost', root._ashmeContextLoss);
    document.documentElement.classList.remove('ashme-cinematic-active');
    restoreScroll();
    skip.removeEventListener('click', onSkip);
    window.removeEventListener('keydown', onKeyDown);
    root.hidden = true;
    const renderer = root._ashmeRenderer;
    if (renderer) {
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    }
    if (root._ashmeScene) {
      root._ashmeScene.traverse((item) => {
        if (item.geometry) item.geometry.dispose();
        if (item.material) {
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          materials.forEach((material) => {
            Object.values(material).forEach((value) => {
              if (value && value.isTexture) value.dispose();
            });
            material.dispose();
          });
        }
      });
    }
  }

  function restoreScroll() {
    if (root._ashmeScrollStyles) {
      document.documentElement.style.overflow = root._ashmeScrollStyles.html;
      document.body.style.overflow = root._ashmeScrollStyles.body;
      root._ashmeScrollStyles = null;
    }
  }

  async function startIntro() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: window.innerWidth > 750, powerPreference: 'high-performance' });
    } catch {
      return;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b1716, 0.025);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    camera.position.set(0, 0, window.innerWidth < 820 && window.innerWidth / window.innerHeight < 0.85 ? 14.5 : 9);
    camera.lookAt(0, 0, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 750 ? 1.25 : 1.65));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.setClearColor(0x000000, 0);
    root._ashmeRenderer = renderer;
    root._ashmeScene = scene;

    scene.add(new THREE.HemisphereLight(0xb9d5c9, 0x101516, 1.35));
    const keyLight = new THREE.DirectionalLight(0xdce4d5, 3.4);
    keyLight.position.set(-4, 5, 7);
    scene.add(keyLight);
    const fillLight = new THREE.PointLight(0x77b9aa, 28, 12, 2);
    fillLight.position.set(3, -2, 3);
    scene.add(fillLight);
    const emberLight = new THREE.PointLight(0xff612e, 2.5, 2.2, 2);
    scene.add(emberLight);

    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    const [cigaretteResult, trayResult] = await Promise.all([
      gltfLoader.loadAsync(root.dataset.cigaretteUrl),
      gltfLoader.loadAsync(root.dataset.trayUrl)
    ]);
    await MeshoptDecoder.ready;
    const cigarette = cigaretteResult.scene;
    const sourceBounds = new THREE.Box3().setFromObject(cigarette);
    const sourceSize = sourceBounds.getSize(new THREE.Vector3());
    const center = sourceBounds.getCenter(new THREE.Vector3());
    cigarette.position.sub(center);
    let mobileLayout = window.innerWidth < 820 && window.innerWidth / window.innerHeight < 0.85;
    const cigaretteRoot = new THREE.Group();
    const cigaretteOrientation = new THREE.Group();
    if (sourceSize.y >= sourceSize.x && sourceSize.y >= sourceSize.z) cigaretteOrientation.rotation.z = -Math.PI / 2;
    else if (sourceSize.z >= sourceSize.x) cigaretteOrientation.rotation.y = Math.PI / 2;
    cigaretteRoot.rotation.z = mobileLayout ? -Math.PI / 2 : 0;
    const sourceLength = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
    let cigaretteScale = (mobileLayout ? 3.05 : 3.65) / sourceLength;
    cigaretteRoot.scale.setScalar(cigaretteScale);
    cigaretteRoot.position.set(mobileLayout ? 0 : -1.55, 1.3, 0);
    cigaretteOrientation.add(cigarette);
    cigaretteRoot.add(cigaretteOrientation);
    scene.add(cigaretteRoot);
    const burnPoint = new THREE.Vector3(sourceLength * cigaretteScale / 2, 0, 0)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), cigaretteRoot.rotation.z)
      .add(cigaretteRoot.position);

    cigarette.traverse((item) => {
      if (!item.isMesh) return;
      item.castShadow = false;
      item.receiveShadow = false;
      const materials = Array.isArray(item.material) ? item.material : [item.material];
      materials.forEach((material) => {
        material.roughness = 0.72;
        material.metalness = 0;
        material.needsUpdate = true;
      });
    });

    const ember = new THREE.Mesh(
      new THREE.SphereGeometry(0.125, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0xff4d25, emissive: 0xf33e16, emissiveIntensity: 3.5, roughness: 0.78 })
    );
    ember.position.copy(burnPoint).add(new THREE.Vector3(0, 0, 0.025));
    scene.add(ember);
    emberLight.position.copy(ember.position);

    const ashGeometry = createAshGeometry();
    const ashMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
    const ash = new THREE.Mesh(ashGeometry, ashMaterial);
    ash.position.set(-0.16, 0, 0);
    ash.rotation.z = cigaretteRoot.rotation.z;
    ash.scale.x = 0.08;

    const fallingAsh = new THREE.Group();
    fallingAsh.add(ash);
    const moteMaterial = new THREE.MeshBasicMaterial({ color: 0x9ca6a0, transparent: true, opacity: 0.66, depthWrite: false });
    const moteGeometry = new THREE.SphereGeometry(0.022, 6, 5);
    const motes = [];
    for (let index = 0; index < 20; index += 1) {
      const mote = new THREE.Mesh(moteGeometry, moteMaterial);
      const angle = index * 2.399;
      mote.position.set(Math.cos(angle) * 0.18, -index * 0.08, Math.sin(angle) * 0.11);
      mote.scale.setScalar(0.55 + (index % 4) * 0.18);
      fallingAsh.add(mote);
      motes.push(mote);
    }
    fallingAsh.position.set(burnPoint.x, burnPoint.y, 0.04);
    fallingAsh.visible = false;
    scene.add(fallingAsh);

    const tray = trayResult.scene;
    const trayBounds = new THREE.Box3().setFromObject(tray);
    const trayCenter = trayBounds.getCenter(new THREE.Vector3());
    tray.position.sub(trayCenter);
    tray.rotation.x = Math.PI / 2;
    tray.scale.setScalar(22);
    tray.position.y = -4.05;
    tray.position.z = -0.18;
    tray.visible = false;
    tray.traverse((item) => {
      if (item.isMesh) {
        item.castShadow = true;
        item.receiveShadow = true;
        if (item.material) item.material.roughness = 0.78;
      }
    });
    scene.add(tray);

    const contactGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.22, 32),
      new THREE.MeshBasicMaterial({ color: 0x9ed8ca, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    contactGlow.position.set(0.03, -4.02, 0.15);
    scene.add(contactGlow);

    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const nextMobileLayout = width < 820 && width / height < 0.85;
      camera.aspect = width / height;
      camera.fov = 34;
      camera.position.z = nextMobileLayout ? 14.5 : 9;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 750 ? 1.25 : 1.65));
      renderer.setSize(width, height, false);
      if (nextMobileLayout !== mobileLayout) {
        mobileLayout = nextMobileLayout;
        cigaretteScale = (mobileLayout ? 3.05 : 3.65) / sourceLength;
        cigaretteRoot.scale.setScalar(cigaretteScale);
        cigaretteRoot.rotation.z = mobileLayout ? -Math.PI / 2 : 0;
        cigaretteRoot.position.x = mobileLayout ? 0 : -1.55;
        burnPoint.set(sourceLength * cigaretteScale / 2, 0, 0)
          .applyAxisAngle(new THREE.Vector3(0, 0, 1), cigaretteRoot.rotation.z)
          .add(cigaretteRoot.position);
        ember.position.copy(burnPoint).add(new THREE.Vector3(0, 0, 0.025));
        emberLight.position.copy(ember.position);
        ash.rotation.z = cigaretteRoot.rotation.z;
        if (!root._ashmeTimeline || root._ashmeTimeline.time() < 4.52) {
          fallingAsh.position.set(burnPoint.x, burnPoint.y, 0.04);
        }
      }
    };
    resize();
    root._ashmeResize = resize;
    window.addEventListener('resize', resize, { passive: true });
    root._ashmeContextLoss = (event) => {
      event.preventDefault();
      finish();
    };
    canvas.addEventListener('webglcontextlost', root._ashmeContextLoss, { once: true });

    root.hidden = false;
    root.style.opacity = '1';
    root._ashmeScrollStyles = { html: document.documentElement.style.overflow, body: document.body.style.overflow };
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.classList.add('ashme-cinematic-active');
    skip.addEventListener('click', onSkip);
    window.addEventListener('keydown', onKeyDown);
    renderer.setAnimationLoop((time) => {
      const flicker = 0.82 + Math.sin(time * 0.018) * 0.14 + Math.sin(time * 0.047) * 0.045;
      ember.scale.setScalar(flicker);
      emberLight.intensity = 2.3 + flicker * 1.5;
      motes.forEach((mote, index) => {
        mote.position.x = Math.sin(time * 0.0012 + index * 1.8) * (0.12 + index * 0.003);
        mote.position.z = Math.cos(time * 0.001 + index * 1.3) * 0.13;
      });
      renderer.render(scene, camera);
    });

    const cameraRig = { y: 0 };
    const timeline = gsap.timeline({ onUpdate: () => { progress.style.transform = `scaleX(${timeline.progress()})`; }, onComplete: finish });
    root._ashmeTimeline = timeline;
    timeline.fromTo(copy, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out' }, 0.15);
    timeline.to(ash.scale, { x: 1, duration: 2.8, ease: 'sine.inOut' }, 1.35);
    timeline.to(ember.material, { emissiveIntensity: 6, duration: 0.55, repeat: 4, yoyo: true, ease: 'sine.inOut' }, 1.5);
    timeline.call(() => {
      cigaretteRoot.visible = false;
      ember.visible = false;
      fallingAsh.visible = true;
      tray.visible = true;
    }, null, 4.5);
    timeline.fromTo(fallingAsh.position, { x: burnPoint.x, y: burnPoint.y, z: 0.04 }, { x: 0.03, y: -3.76, z: 0.08, duration: 3.35, ease: 'power1.in' }, 4.52);
    timeline.to(cameraRig, { y: -3.5, duration: 3.1, ease: 'power1.inOut', onUpdate: () => {
      camera.position.y = cameraRig.y;
      camera.lookAt(0, cameraRig.y, 0);
    } }, 4.55);
    timeline.to(cameraRig, { y: -4.05, duration: 0.85, ease: 'power2.out', onUpdate: () => {
      camera.position.y = cameraRig.y;
      camera.lookAt(0, cameraRig.y, 0);
    } }, 7.65);
    timeline.to(fallingAsh.rotation, { x: 0.4, y: 0.9, z: -0.6, duration: 3.1, ease: 'power1.in' }, 4.55);
    timeline.to(tray.scale, { x: 22.8, y: 22.8, z: 22.8, duration: 0.8, ease: 'power3.out' }, 7.7);
    timeline.to(fallingAsh.scale, { x: 0.18, y: 0.18, z: 0.18, duration: 0.32, ease: 'power2.in' }, 7.82);
    timeline.to(contactGlow.material, { opacity: 0.55, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 7.82);
    timeline.to(fallingAsh, { y: -4.02, duration: 0.36, ease: 'bounce.out' }, 7.82);
    timeline.to(copy, { autoAlpha: 0, y: -6, duration: 0.6, ease: 'power2.in' }, 8.5);
    timeline.to(root, { autoAlpha: 0, duration: 1.1, ease: 'power2.inOut' }, 9.0);
    timeline.to(fillLight, { intensity: 8, duration: 1.2, ease: 'sine.inOut' }, 8.8);
    timeline.to(contactGlow.material, { opacity: 0, duration: 0.4 }, 8.9);
  }

  function createAshGeometry() {
    const length = 0.5;
    const rings = 8;
    const sides = 18;
    const positions = [];
    const colors = [];
    const indices = [];
    for (let ring = 0; ring <= rings; ring += 1) {
      const along = ring / rings;
      const radius = (0.16 + Math.sin(along * Math.PI) * 0.038) * (0.95 + (ring % 3) * 0.035);
      for (let side = 0; side <= sides; side += 1) {
        const angle = (side / sides) * Math.PI * 2;
        const grit = 0.92 + ((ring * 7 + side * 11) % 9) * 0.018;
        positions.push(along * length, Math.cos(angle) * radius * grit, Math.sin(angle) * radius * grit);
        const soot = 0.31 + ((ring * 13 + side * 5) % 12) * 0.018;
        colors.push(soot, soot * 1.02, soot * 0.95);
      }
    }
    for (let ring = 0; ring < rings; ring += 1) {
      for (let side = 0; side < sides; side += 1) {
        const a = ring * (sides + 1) + side;
        const b = a + sides + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
}
