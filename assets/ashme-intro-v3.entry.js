import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { MeshoptDecoder } from './meshopt_decoder.module.js';
import { EffectComposer } from './AshmeEffectComposer.js';
import { RenderPass } from './AshmeRenderPass.js';
import { UnrealBloomPass } from './AshmeUnrealBloomPass.js';
import { OutputPass } from './AshmeOutputPass.js';
import { RoomEnvironment } from './AshmeRoomEnvironment.js';

const root = document.querySelector('[data-ashme-cinematic]');

if (root && !window.__ashmeCinematicV3Started) {
  window.__ashmeCinematicV3Started = true;
  const canvas = root.querySelector('[data-ashme-canvas]');
  const skip = root.querySelector('[data-ashme-skip]');
  const eyebrow = root.querySelector('[data-ashme-eyebrow]');
  const line = root.querySelector('[data-ashme-line]');
  const loading = root.querySelector('[data-ashme-loading]');
  const progress = root.querySelector('[data-ashme-progress]');
  const loadFill = root.querySelector('[data-ashme-load-fill]');
  const recordButton = root.querySelector('[data-ashme-record]');
  const sessionKey = 'ashme-cinematic-intro-seen';
  const gsap = window.gsap;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const recordMode = new URLSearchParams(location.search).has('ashme_record');
  const state = { burn: 0, ash: 0, break: 0, fall: 0, reveal: 0, impact: 0, hero: 0, exit: 0, clipTime: 0 };
  let sceneBits;
  let timeline;
  let finished = false;
  let resize;
  let copyMode = 0;
  let recorder;
  let recordingStream;
  let recordingParts = [];

  const remember = () => { try { sessionStorage.setItem(sessionKey, '1'); } catch {} };
  const restore = () => {
    document.documentElement.classList.remove('ashme-cinematic-pending', 'ashme-cinematic-active', 'ashme-website-reveal');
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    if (window.__ashmeRevealFailsafe) clearTimeout(window.__ashmeRevealFailsafe);
  };
  const dispose = () => {
    if (resize) window.removeEventListener('resize', resize);
    sceneBits?.renderer.setAnimationLoop(null);
    sceneBits?.dispose();
    sceneBits = null;
  };
  const saveRecording = () => {
    if (!recordingParts.length) return;
    const blob = new Blob(recordingParts, { type: recorder?.mimeType || 'video/webm' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'AshMe-Cinematic-Intro-V3.webm';
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 5000);
    recordingStream?.getTracks().forEach((track) => track.stop());
  };
  const stopRecording = () => {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };
  const startRecording = async () => {
    try {
      recordingStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 } }, audio: false });
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      recorder = new MediaRecorder(recordingStream, { mimeType, videoBitsPerSecond: 8_000_000 });
      recorder.addEventListener('dataavailable', (event) => { if (event.data.size) recordingParts.push(event.data); });
      recorder.addEventListener('stop', saveRecording, { once: true });
      recorder.start(250);
      recordButton.hidden = true;
      timeline.play(0);
    } catch (error) {
      console.error('AshMe V3 screen recording could not start.', error);
      recordButton.textContent = 'Recording unavailable';
    }
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    stopRecording();
    remember();
    restore();
    root.hidden = true;
    skip?.removeEventListener('click', onSkip);
    window.removeEventListener('keydown', onKeyDown);
    dispose();
  };
  const onKeyDown = (event) => { if (event.key === 'Escape') onSkip(); };
  const onSkip = () => {
    if (finished) return;
    timeline?.kill();
    remember();
    if (gsap) gsap.to(root, { autoAlpha: 0, duration: 0.28, ease: 'power2.inOut', onComplete: finish });
    else finish();
  };
  const setCopy = (mode) => {
    if (copyMode === mode) return;
    copyMode = mode;
    gsap.to([eyebrow, line], {
      autoAlpha: 0, y: -7, duration: 0.18, stagger: 0.025, overwrite: true,
      onComplete: () => {
        if (mode === 1) {
          eyebrow.textContent = root.dataset.productEyebrow;
          line.textContent = root.dataset.productLine;
        }
        gsap.to([eyebrow, line], { autoAlpha: 1, y: 0, duration: 0.34, stagger: 0.05, ease: 'power2.out', overwrite: true });
      }
    });
  };

  const createScene = async () => {
    const width = innerWidth;
    const height = innerHeight;
    const portrait = width < 820 && width / height < 0.82;
    const mobile = width < 750;
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      const ratio = total ? loaded / total : 0;
      loadFill.style.transform = `scaleX(${ratio})`;
      loading.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    };
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1 : 1.35));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0c1313, 0.016);
    const cameraRig = new THREE.Group();
    cameraRig.name = 'CameraRig';
    const cameraPivot = new THREE.Group();
    cameraPivot.name = 'CameraPivot';
    // Object3D.lookAt() faces a Group's +Z toward the target; cameras view along -Z.
    cameraPivot.rotation.y = Math.PI;
    const camera = new THREE.PerspectiveCamera(portrait ? 42 : 35, width / height, 0.1, 90);
    camera.position.set(0, 0, 0);
    cameraRig.add(cameraPivot);
    cameraPivot.add(camera);
    scene.add(cameraRig);

    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(room, 0.045).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.38;
    pmrem.dispose();
    const ambient = new THREE.HemisphereLight(0xc8d9d3, 0x101918, 1.0);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffe5ca, 2.35);
    key.position.set(-3.8, 5.4, 5.8);
    key.castShadow = true;
    key.shadow.mapSize.set(mobile ? 512 : 1024, mobile ? 512 : 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.00025;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xb9d9d4, 0.62);
    fill.position.set(3.2, 1.8, 4.2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x63b9ac, 1.1);
    rim.position.set(3.5, 2.6, -3.4);
    scene.add(rim);
    const emberLight = new THREE.PointLight(0xff5929, 0, 2.2, 1.9);
    scene.add(emberLight);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x0c1212, roughness: 0.72, metalness: 0.02 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -3.12;
    ground.receiveShadow = true;
    scene.add(ground);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const ctx = shadowCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0,0,0,.48)');
    grad.addColorStop(0.45, 'rgba(0,0,0,.20)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.4), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.78 }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(0, -3.095, 0.05);
    scene.add(contact);

    const loader = new GLTFLoader(manager);
    loader.setMeshoptDecoder(MeshoptDecoder);
    const [cigGLTF, trayGLTF] = await Promise.all([
      loader.loadAsync(root.dataset.cigaretteUrl),
      loader.loadAsync(root.dataset.trayUrl)
    ]);
    await MeshoptDecoder.ready;
    const cigarette = cigGLTF.scene;
    const cigBounds = new THREE.Box3().setFromObject(cigarette);
    const cigSize = cigBounds.getSize(new THREE.Vector3());
    const cigCenter = cigBounds.getCenter(new THREE.Vector3());
    cigarette.position.sub(cigCenter);
    if (cigSize.x < 4 || cigSize.x > 6) cigarette.scale.setScalar(4.62 / Math.max(cigSize.x, cigSize.y, cigSize.z));
    cigarette.position.set(portrait ? 0.3 : -0.32, portrait ? 0.8 : 1.22, 0.12);
    cigarette.rotation.z = portrait ? Math.PI / 2 : -0.045;
    cigarette.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      obj.material = mats.map((source) => {
        const mat = source.clone();
        mat.roughness = Math.max(mat.roughness ?? 0.8, 0.74);
        mat.metalness = 0;
        mat.envMapIntensity = 0.75;
        return mat;
      });
      if (obj.material.length === 1) obj.material = obj.material[0];
    });
    scene.add(cigarette);
    const mixer = new THREE.AnimationMixer(cigarette);
    const authoredActions = cigGLTF.animations.map((clip) => {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      return action;
    });
    const authoredDuration = Math.max(0, ...cigGLTF.animations.map((clip) => clip.duration));
    const find = (partName) => cigarette.getObjectByName(partName);
    const mainAsh = find('Ash break | primary chunk');
    const emberObject = find('Ember | irregular hot seam');
    if (emberObject) {
      emberObject.traverse((obj) => {
        if (!obj.isMesh || !obj.material) return;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((mat) => { if ('emissiveIntensity' in mat) mat.emissiveIntensity = 2.1; });
      });
      emberObject.getWorldPosition(emberLight.position);
    }

    const tray = trayGLTF.scene;
    const trayBounds = new THREE.Box3().setFromObject(tray);
    const traySize = trayBounds.getSize(new THREE.Vector3());
    const trayCenter = trayBounds.getCenter(new THREE.Vector3());
    tray.position.sub(trayCenter);
    const trayDiameter = Math.max(traySize.x, traySize.z);
    if (trayDiameter < 3 || trayDiameter > 4.3) tray.scale.setScalar(3.65 / trayDiameter);
    const trayFloorY = -3.095;
    const trayTargetY = trayFloorY + traySize.y * tray.scale.y * 0.5;
    const trayStartY = trayTargetY - 0.72;
    tray.position.set(0, trayStartY, -0.12);
    tray.rotation.y = -0.08;
    tray.visible = false;
    tray.traverse((obj) => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      for (const mat of Array.isArray(obj.material) ? obj.material : [obj.material]) {
        mat.roughness = Math.max(mat.roughness ?? 0.4, 0.31);
        mat.metalness = Math.min(mat.metalness ?? 0, 0.03);
        mat.envMapIntensity = 0.8;
      }
    });
    scene.add(tray);

    const particles = new THREE.BufferGeometry();
    const particleCount = mobile ? 28 : 52;
    const coords = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i += 1) {
      coords[i * 3] = Math.sin(i * 17.3) * 4.4;
      coords[i * 3 + 1] = ((i * 29) % 101) / 18 - 2.6;
      coords[i * 3 + 2] = -2.5 - (i % 11) * 0.52;
    }
    particles.setAttribute('position', new THREE.BufferAttribute(coords, 3));
    const depthDust = new THREE.Points(particles, new THREE.PointsMaterial({ color: 0xb2c4bc, size: 0.018, transparent: true, opacity: 0.11, depthWrite: false }));
    scene.add(depthDust);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), mobile ? 0.12 : 0.16, 0.22, 2.35);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const lookTarget = new THREE.Vector3(0, 0.95, 0);
    const desiredRig = new THREE.Vector3(0, 2.0, portrait ? 11.8 : 9.75);
    let elapsed = 0;

    const render = (time = 0) => {
      elapsed = time * 0.001;
      if (authoredActions.length) mixer.setTime(Math.min(state.clipTime, authoredDuration));
      const flicker = 0.91 + 0.055 * Math.sin(elapsed * 14.3) + 0.035 * Math.sin(elapsed * 29.7 + 0.8);
      emberLight.intensity = state.break < 0.25 ? (0.32 + 0.48 * flicker) * (0.35 + state.burn * 0.65) : 0.12;
      const targetAsh = new THREE.Vector3();
      if (mainAsh && state.fall > 0.05) {
        mainAsh.getWorldPosition(targetAsh);
        lookTarget.lerp(targetAsh.add(new THREE.Vector3(0.0, 0.3, 0)), 0.014 + state.fall * 0.018);
      }
      const fallLookY = THREE.MathUtils.lerp(0.95, -1.38, state.fall);
      const heroLookY = THREE.MathUtils.lerp(fallLookY, -1.25, state.hero);
      lookTarget.y += (heroLookY - lookTarget.y) * 0.025;
      desiredRig.x = THREE.MathUtils.lerp(0, 0.22, state.fall);
      desiredRig.y = THREE.MathUtils.lerp(2.0, 1.05, state.fall) + state.hero * 0.45;
      desiredRig.z = THREE.MathUtils.lerp(portrait ? 11.8 : 9.75, portrait ? 10.4 : 8.8, state.hero);
      cameraRig.position.lerp(desiredRig, 0.055);
      cameraRig.lookAt(lookTarget);
      camera.fov = portrait
        ? THREE.MathUtils.lerp(42, 45, state.hero)
        : THREE.MathUtils.lerp(35, 39, state.hero);
      camera.updateProjectionMatrix();
      tray.visible = state.reveal > 0.008;
      tray.position.y = THREE.MathUtils.lerp(trayStartY, trayTargetY, state.reveal);
      const settle = Math.max(0, 1 - state.impact);
      tray.position.y += Math.sin(settle * Math.PI) * 0.035;
      contact.material.opacity = 0.42 + state.reveal * 0.34;
      key.intensity = 2.25 + state.hero * 0.42;
      depthDust.material.opacity = 0.055 + Math.sin(elapsed * 0.7) * 0.018;
      composer.render();
    };
    const resizeScene = () => {
      const w = innerWidth, h = innerHeight;
      const nextPortrait = w < 820 && w / h < 0.82;
      const nextMobile = w < 750;
      camera.aspect = w / h;
      desiredRig.z = nextPortrait ? 11.8 : 9.75;
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, nextMobile ? 1 : 1.35));
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      camera.updateProjectionMatrix();
    };
    const dispose = () => {
      composer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        for (const mat of mats) {
          for (const value of Object.values(mat)) if (value?.isTexture) value.dispose();
          mat.dispose();
        }
      });
      env.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    };
    resizeScene();
    return { renderer, render, resize: resizeScene, dispose, manager };
  };

  if (!reduceMotion && gsap && document.documentElement.classList.contains('ashme-cinematic-pending')) {
    root.hidden = false;
    document.documentElement.classList.add('ashme-cinematic-active');
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    skip.addEventListener('click', onSkip);
    window.addEventListener('keydown', onKeyDown);
    createScene().then((scene) => {
      if (finished) { scene.dispose(); return; }
      sceneBits = scene;
      gsap.to(loading, { autoAlpha: 0, duration: 0.24, ease: 'power1.out' });
      scene.renderer.setAnimationLoop(scene.render);
      resize = scene.resize;
      addEventListener('resize', resize, { passive: true });
      canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); finish(); }, { once: true });
      timeline = gsap.timeline({
        onUpdate: () => { progress.style.transform = `scaleX(${timeline.progress()})`; },
        onComplete: finish
      });
      root._ashmeTimeline = timeline;
      timeline.fromTo([eyebrow, line], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.48, stagger: 0.07, ease: 'power2.out' }, 0.08);
      timeline.to(state, { burn: 1, clipTime: 1.9, duration: 1.65, ease: 'sine.inOut' }, 0.48);
      timeline.to(state, { ash: 1, clipTime: 2.48, duration: 0.52, ease: 'power2.out' }, 1.45);
      timeline.to(state, { break: 1, clipTime: 3.05, duration: 0.4, ease: 'power2.in' }, 2.06);
      timeline.to(state, { fall: 1, clipTime: 4.16, duration: 1.35, ease: 'power2.in' }, 2.38);
      timeline.to(state, { reveal: 1, duration: 1.0, ease: 'power2.out' }, 3.62);
      timeline.to(state, { impact: 1, duration: 0.36, ease: 'power2.out' }, 4.34);
      timeline.call(() => setCopy(1), null, 4.72);
      timeline.to(state, { hero: 1, duration: 0.86, ease: 'power2.inOut' }, 4.7);
      timeline.to(state, { exit: 1, duration: 0.68, ease: 'power2.in' }, 5.44);
      timeline.call(() => {
        document.documentElement.classList.remove('ashme-cinematic-pending');
        document.documentElement.classList.add('ashme-website-reveal');
      }, null, 5.82);
      timeline.to(root, { autoAlpha: 0, duration: 0.66, ease: 'power2.inOut' }, 5.82);
      timeline.to([eyebrow, line], { autoAlpha: 0, y: -7, duration: 0.3, ease: 'power2.in' }, 5.82);
      timeline.call(() => document.documentElement.classList.remove('ashme-website-reveal'), null, 6.52);
      const params = new URLSearchParams(location.search);
      const holdValue = params.get('ashme_hold');
      const holdAt = holdValue === null ? Number.NaN : Number(holdValue);
      if (Number.isFinite(holdAt) && holdAt > 0) timeline.pause(Math.min(holdAt, 6.48));
      if (recordMode && !Number.isFinite(holdAt)) {
        timeline.pause(0);
        recordButton.hidden = false;
        recordButton.addEventListener('click', startRecording, { once: true });
      }
    }).catch((error) => {
      console.error('AshMe V3 intro failed to load.', error);
      finish();
    });
  } else {
    root.hidden = true;
    restore();
  }
}
