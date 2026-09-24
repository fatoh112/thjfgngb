import * as THREE from './three.module.js';

export function makeCinderMaterial() {
  const material = new THREE.MeshStandardMaterial({
    color: 0x777a76,
    roughness: 0.98,
    metalness: 0,
    vertexColors: true,
    side: THREE.DoubleSide
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 ashWorldPosition;'
    ).replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nashWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
varying vec3 ashWorldPosition;
float ashNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = dot(i, vec3(1.0, 57.0, 113.0));
  return mix(mix(mix(fract(sin(n) * 43758.5453), fract(sin(n + 1.0) * 43758.5453), f.x), mix(fract(sin(n + 57.0) * 43758.5453), fract(sin(n + 58.0) * 43758.5453), f.x), f.y), mix(mix(fract(sin(n + 113.0) * 43758.5453), fract(sin(n + 114.0) * 43758.5453), f.x), mix(fract(sin(n + 170.0) * 43758.5453), fract(sin(n + 171.0) * 43758.5453), f.x), f.y), f.z);
}`
    ).replace(
      '#include <color_fragment>',
      `#include <color_fragment>
float ashGrain = ashNoise(ashWorldPosition * 38.0);
float ashFine = ashNoise(ashWorldPosition * 115.0);
diffuseColor.rgb *= 0.73 + ashGrain * 0.38 + ashFine * 0.16;`
    );
    material.userData.shader = shader;
  };
  material.customProgramCacheKey = () => 'ashme-cinder-grain-v2';
  return material;
}

export function makeAshCrown(radius) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const indices = [];
  const rings = 8;
  const sides = 32;
  const length = radius * 2.1;
  for (let ring = 0; ring <= rings; ring += 1) {
    const along = ring / rings;
    for (let side = 0; side <= sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      const tooth = Math.sin(angle * 7 + 0.5) * 0.1 + Math.sin(angle * 13) * 0.045;
      const wobble = 0.94 + 0.045 * Math.sin(side * 8.7 + ring * 2.4) + 0.025 * Math.cos(side * 3.1 - ring * 4.2);
      const radial = radius * wobble;
      const jaggedTop = ring === rings ? tooth * radius * 0.85 : 0;
      const inward = ring === rings ? 0.93 + tooth * 0.16 : 1;
      positions.push(
        along * length,
        Math.cos(angle) * radial * inward,
        Math.sin(angle) * radial * inward + jaggedTop
      );
      const grain = 0.36 + 0.06 * Math.sin(side * 4.3 + ring * 3.2) + 0.035 * Math.cos(side * 7.9 - ring * 2.1);
      colors.push(grain, grain * 1.02, grain * 1.04);
    }
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let side = 0; side < sides; side += 1) {
      const a = ring * (sides + 1) + side;
      const b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function makeAshChunk(radius) {
  const geometry = new THREE.IcosahedronGeometry(radius, 2);
  const position = geometry.getAttribute('position');
  const colors = [];
  for (let index = 0; index < position.count; index += 1) {
    const p = new THREE.Vector3().fromBufferAttribute(position, index);
    const grit = 1 + 0.11 * Math.sin(p.x * 73.1 + p.y * 19.3) * Math.cos(p.z * 46.7 + p.x * 28.4);
    p.multiplyScalar(grit);
    position.setXYZ(index, p.x, p.y * (0.9 + 0.09 * Math.sin(p.x * 22)), p.z);
    const value = 0.34 + Math.abs(Math.sin(p.x * 38 + p.y * 71 + p.z * 23)) * 0.28;
    colors.push(value, value * 1.015, value * 1.04);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 1, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255, 236, 190, 1)');
  gradient.addColorStop(0.13, 'rgba(255, 120, 55, .72)');
  gradient.addColorStop(0.42, 'rgba(228, 68, 27, .2)');
  gradient.addColorStop(1, 'rgba(228, 68, 27, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeDust(count, color = 0xc8c3b4) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    positions[index * 3] = (Math.sin(index * 71.13) * 0.5 + 0.5) * 0.5 - 0.25;
    positions[index * 3 + 1] = -index * 0.014;
    positions[index * 3 + 2] = (Math.cos(index * 39.31) * 0.5 + 0.5) * 0.32 - 0.16;
    sizes[index] = 0.008 + ((index * 17) % 10) * 0.0013;
    seeds[index] = index * 0.61;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.PointsMaterial({ color, size: 0.035, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  return new THREE.Points(geometry, material);
}
