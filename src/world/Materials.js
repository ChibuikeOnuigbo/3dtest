import * as THREE from 'three';

function seededRandom(seed) {
  let current = seed >>> 0;
  return () => {
    current = (current * 1664525 + 1013904223) >>> 0;
    return current / 0xffffffff;
  };
}

function textureCanvas(kind, base, accent, repeat = [2, 2]) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const random = seededRandom([...kind].reduce((value, char) => value + char.charCodeAt(0) * 31, 17));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);

  if (kind === 'tile') {
    ctx.fillStyle = '#2e4350';
    for (let x = 0; x <= 512; x += 64) ctx.fillRect(x, 0, 3, 512);
    for (let y = 0; y <= 512; y += 64) ctx.fillRect(0, y, 512, 3);
    for (let y = 3; y < 512; y += 64) {
      for (let x = 3; x < 512; x += 64) {
        ctx.fillStyle = random() > 0.52 ? accent : '#d7c08c';
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x + 3, y + 3, 58, 58);
        ctx.globalAlpha = 1;
      }
    }
    for (let i = 0; i < 220; i += 1) {
      ctx.fillStyle = i % 4 === 0 ? '#9f774d' : '#f2dda6';
      ctx.globalAlpha = 0.17;
      ctx.fillRect(random() * 512, random() * 512, 1 + random() * 2, 1 + random() * 2);
    }
  } else if (kind === 'plaster') {
    for (let i = 0; i < 3400; i += 1) {
      const shade = Math.floor(128 + random() * 95);
      ctx.fillStyle = `rgb(${shade}, ${Math.max(90, shade - 17)}, ${Math.max(74, shade - 34)})`;
      ctx.globalAlpha = 0.1 + random() * 0.16;
      ctx.fillRect(random() * 512, random() * 512, 1 + random() * 5, 1 + random() * 3);
    }
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.3;
    ctx.globalAlpha = 0.32;
    for (let i = 0; i < 15; i += 1) {
      const x = random() * 512;
      const y = random() * 512;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8 + random() * 22, y + 6 + random() * 34);
      ctx.lineTo(x + 20 + random() * 36, y + 8 + random() * 46);
      ctx.stroke();
    }
  } else if (kind === 'copper') {
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, accent);
    gradient.addColorStop(0.45, base);
    gradient.addColorStop(1, '#5f392d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    for (let x = 0; x < 512; x += 28) {
      ctx.fillStyle = x % 56 ? '#e8a45d' : '#683e34';
      ctx.globalAlpha = 0.14;
      ctx.fillRect(x, 0, 2 + random() * 3, 512);
    }
    for (let i = 0; i < 85; i += 1) {
      ctx.fillStyle = i % 3 ? '#3f817a' : '#d8ad61';
      ctx.globalAlpha = 0.1 + random() * 0.18;
      ctx.beginPath();
      ctx.arc(random() * 512, random() * 512, 2 + random() * 15, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'slate') {
    for (let i = 0; i < 1800; i += 1) {
      const grey = Math.floor(35 + random() * 58);
      ctx.fillStyle = `rgb(${grey}, ${grey + 13}, ${grey + 20})`;
      ctx.globalAlpha = 0.15 + random() * 0.22;
      ctx.fillRect(random() * 512, random() * 512, 2 + random() * 7, 1 + random() * 2);
    }
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.26;
    ctx.lineWidth = 2;
    for (let y = 14; y < 512; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y + random() * 6);
      for (let x = 0; x <= 512; x += 42) ctx.lineTo(x, y + random() * 11);
      ctx.stroke();
    }
  } else if (kind === 'hazard') {
    ctx.fillStyle = '#d9a73f';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = '#183248';
    ctx.lineWidth = 38;
    for (let x = -512; x < 700; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, 512);
      ctx.lineTo(x + 512, 0);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#fff0b0';
    for (let i = 0; i < 380; i += 1) ctx.fillRect(random() * 512, random() * 512, 1 + random() * 3, 1 + random() * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  texture.anisotropy = 8;
  return texture;
}

export function createMaterials() {
  const tile = textureCanvas('tile', '#d5c08d', '#b79261', [3.1, 3.1]);
  const plaster = textureCanvas('plaster', '#b9b09a', '#5a6070', [1.55, 1.55]);
  const copper = textureCanvas('copper', '#9e543b', '#d38d4d', [2.5, 2.5]);
  const slate = textureCanvas('slate', '#253c4c', '#7497a4', [3.2, 3.2]);
  const hazard = textureCanvas('hazard', '#dba63d', '#183248', [2.3, 2.3]);
  return {
    floor: new THREE.MeshStandardMaterial({ map: tile, color: '#f3dfa6', roughness: 0.82, metalness: 0.02 }),
    wall: new THREE.MeshStandardMaterial({ map: plaster, color: '#d4d0bd', roughness: 0.78, metalness: 0.04 }),
    deck: new THREE.MeshStandardMaterial({ map: slate, color: '#6c9bad', roughness: 0.47, metalness: 0.6 }),
    copper: new THREE.MeshStandardMaterial({ map: copper, color: '#e18a54', roughness: 0.42, metalness: 0.77 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazard, color: '#f7c655', roughness: 0.65, metalness: 0.15 }),
    wood: new THREE.MeshStandardMaterial({ color: '#5e3729', roughness: 0.72, metalness: 0.02 }),
    trim: new THREE.MeshStandardMaterial({ color: '#183248', roughness: 0.4, metalness: 0.82 }),
    rail: new THREE.MeshStandardMaterial({ color: '#e4c36e', roughness: 0.25, metalness: 0.91 }),
    warm: new THREE.MeshStandardMaterial({ color: '#ffe8af', emissive: '#f5a949', emissiveIntensity: 2.35, roughness: 0.28 }),
    amber: new THREE.MeshStandardMaterial({ color: '#ffd369', emissive: '#ef7c23', emissiveIntensity: 2.7, roughness: 0.24 }),
    red: new THREE.MeshStandardMaterial({ color: '#ff8065', emissive: '#e6372f', emissiveIntensity: 2.35, roughness: 0.26 }),
    green: new THREE.MeshStandardMaterial({ color: '#92f0b0', emissive: '#1ba66f', emissiveIntensity: 2.4, roughness: 0.24 }),
    blue: new THREE.MeshStandardMaterial({ color: '#9ee9ff', emissive: '#118bb5', emissiveIntensity: 2.3, roughness: 0.24 }),
    violet: new THREE.MeshStandardMaterial({ color: '#d0a4ff', emissive: '#8047dc', emissiveIntensity: 2.05, roughness: 0.27 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#42596e', roughness: 0.6, metalness: 0.31, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#76d4d5', transmission: 0.18, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0.08 }),
    black: new THREE.MeshStandardMaterial({ color: '#102433', roughness: 0.58, metalness: 0.42 }),
  };
}
