import * as THREE from 'three';

function randomFrom(seed) {
  let current = seed;
  return () => {
    current = (current * 1664525 + 1013904223) >>> 0;
    return current / 0xffffffff;
  };
}

function surfaceTexture(kind, base, detail) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);
  const random = randomFrom(kind.length * 971);
  context.globalAlpha = 0.16;
  if (kind === 'steel') {
    for (let y = 8; y < 256; y += 12) {
      context.fillStyle = detail;
      context.fillRect(0, y, 256, 2);
    }
    for (let i = 0; i < 200; i += 1) {
      context.fillStyle = i % 5 === 0 ? '#c2784e' : '#061119';
      context.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1 + random() * 2);
    }
  } else if (kind === 'concrete') {
    for (let i = 0; i < 1400; i += 1) {
      const tone = Math.floor(70 + random() * 75);
      context.fillStyle = `rgb(${tone},${tone + 7},${tone + 10})`;
      context.fillRect(random() * 256, random() * 256, 1, 1);
    }
    context.strokeStyle = detail;
    context.lineWidth = 1;
    context.beginPath();
    for (let y = 32; y < 256; y += 56) { context.moveTo(0, y); context.lineTo(256, y); }
    context.stroke();
  } else if (kind === 'deck') {
    context.fillStyle = detail;
    for (let x = 0; x < 256; x += 32) context.fillRect(x, 0, 2, 256);
    for (let i = 0; i < 80; i += 1) {
      context.fillStyle = '#071017';
      context.fillRect(random() * 256, random() * 256, 2, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 2.5);
  texture.anisotropy = 4;
  return texture;
}

export function createMaterials() {
  const concreteMap = surfaceTexture('concrete', '#3c474b', '#263033');
  const steelMap = surfaceTexture('steel', '#243d47', '#16282e');
  const deckMap = surfaceTexture('deck', '#172b31', '#355057');
  return {
    floor: new THREE.MeshStandardMaterial({ map: concreteMap, color: '#9aabb0', roughness: 0.86, metalness: 0.03 }),
    wall: new THREE.MeshStandardMaterial({ map: steelMap, color: '#799097', roughness: 0.62, metalness: 0.52 }),
    deck: new THREE.MeshStandardMaterial({ map: deckMap, color: '#789299', roughness: 0.48, metalness: 0.6 }),
    trim: new THREE.MeshStandardMaterial({ color: '#142329', roughness: 0.42, metalness: 0.78 }),
    rail: new THREE.MeshStandardMaterial({ color: '#90a8aa', roughness: 0.28, metalness: 0.9 }),
    warm: new THREE.MeshStandardMaterial({ color: '#ffd28a', emissive: '#ff9d45', emissiveIntensity: 1.8, roughness: 0.38 }),
    amber: new THREE.MeshStandardMaterial({ color: '#ffc15d', emissive: '#ff870e', emissiveIntensity: 2.4, roughness: 0.28 }),
    red: new THREE.MeshStandardMaterial({ color: '#ff6f5c', emissive: '#d5201c', emissiveIntensity: 2.0, roughness: 0.3 }),
    green: new THREE.MeshStandardMaterial({ color: '#8be0a7', emissive: '#1c9e68', emissiveIntensity: 2.2, roughness: 0.26 }),
    blue: new THREE.MeshStandardMaterial({ color: '#75c8e7', emissive: '#197ea4', emissiveIntensity: 1.9, roughness: 0.3 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#6fa4ba', transmission: 0.08, transparent: true, opacity: 0.55, roughness: 0.16, metalness: 0.15 }),
    black: new THREE.MeshStandardMaterial({ color: '#071116', roughness: 0.62, metalness: 0.35 }),
  };
}
