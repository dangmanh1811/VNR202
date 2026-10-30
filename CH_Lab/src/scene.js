import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { artworks } from './presentation-art.js';
import { deskPositions, seatPosition, SPAWN_POSITION } from './classroom-config.js';
import { approachMotionPose, createMotionBuffer, predictMotionPose, pushMotionSample } from './remote-motion.js';
import { getAvatarOption } from './avatar-options.js';

const palette = {
  ink: 0x416567, mint: 0xc9ead8, darkMint: 0x83bca5, cream: 0xfff6dd,
  peach: 0xf4baa0, coral: 0xe98772, wood: 0xc88d66, woodDark: 0x946c58,
  chalk: 0x376f68, gold: 0xf7cd79, blue: 0x9ed8e5, white: 0xfffdf3,
};

const gradient = new THREE.DataTexture(new Uint8Array([72, 72, 72, 255, 135, 135, 135, 255, 210, 210, 210, 255, 255, 255, 255, 255]), 4, 1);
gradient.needsUpdate = true;
gradient.magFilter = THREE.NearestFilter;
gradient.minFilter = THREE.NearestFilter;

const mat = (color, options = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradient, ...options });
const materials = Object.fromEntries(Object.entries(palette).map(([key, value]) => [key, mat(value)]));
const flat = (color, options = {}) => new THREE.MeshBasicMaterial({ color, ...options });

const avatarAssetUrls = {
  'agnes-tachyon': new URL('../models/agnes_tachyon_chibi.glb', import.meta.url).href,
  chikawa: new URL('../models/chikawa.glb', import.meta.url).href,
  megumin: new URL('../models/megumin_and_chomosuke.glb', import.meta.url).href,
  miku: new URL('../models/miku_chibi.glb', import.meta.url).href,
  'professor-layton': new URL('../models/professor_layton_chibi.glb', import.meta.url).href,
  'female-suzuka': new URL('../models/silence_suzuka_chibi.glb', import.meta.url).href,
  'super-creek': new URL('../models/super_creek_chibi.glb', import.meta.url).href,
};
const avatarTemplatePromises = new Map();

function loadAvatarTemplate(avatar) {
  if (!avatarAssetUrls[avatar]) return Promise.reject(new Error(`Không tìm thấy model ${avatar}.`));
  if (!avatarTemplatePromises.has(avatar)) {
    avatarTemplatePromises.set(avatar, new GLTFLoader().loadAsync(avatarAssetUrls[avatar]).then(gltf => gltf.scene));
  }
  return avatarTemplatePromises.get(avatar);
}

function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(x, y, z);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function box(parent, x, y, z, w, h, d, material) {
  return mesh(new THREE.BoxGeometry(w, h, d), material, parent, x, y, z);
}

function sphere(parent, x, y, z, r, material, segments = 16) {
  return mesh(new THREE.SphereGeometry(r, segments, 12), material, parent, x, y, z);
}

function cylinder(parent, x, y, z, rt, rb, h, material, sides = 12) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, sides), material, parent, x, y, z);
}

function makeTextTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function wallSign(parent, textLines, x, y, z, w, h, color, fontSize = 74) {
  const lines = Array.isArray(textLines) ? textLines : [textLines];
  const textureWidth = 2048;
  const textureHeight = Math.round(textureWidth * h / w);
  const texture = makeTextTexture(textureWidth, textureHeight, (ctx) => {
    ctx.clearRect(0, 0, textureWidth, textureHeight);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = Math.min(fontSize, textureHeight / (lines.length * 1.25));
    do {
      ctx.font = `700 ${size}px "Trebuchet MS", sans-serif`;
      if (Math.max(...lines.map(line => ctx.measureText(line).width)) < textureWidth * .93) break;
      size -= 2;
    } while (size > 20);
    ctx.fillStyle = color;
    const lineHeight = size * 1.14;
    const firstY = textureHeight / 2 - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, index) => ctx.fillText(line, textureWidth / 2, firstY + index * lineHeight));
  });
  const panel = mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }), parent, x, y, z);
  panel.castShadow = false;
  return panel;
}

function addWindow(room, x, y) {
  const group = new THREE.Group(); group.position.set(x, y, -6.34); room.add(group);
  box(group, 0, 0, 0, 2.85, 2.7, 0.18, materials.white);
  const outside = makeTextTexture(512, 512, (c) => {
    const sky = c.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#95dcec'); sky.addColorStop(1, '#fff0c5');
    c.fillStyle = sky; c.fillRect(0, 0, 512, 512);
    c.fillStyle = '#fff9df'; c.beginPath(); c.arc(386, 115, 54, 0, 7); c.fill();
    c.fillStyle = '#91cbb2'; c.beginPath(); c.moveTo(0, 356); c.quadraticCurveTo(115, 190, 250, 347); c.quadraticCurveTo(360, 235, 512, 335); c.lineTo(512, 512); c.lineTo(0, 512); c.fill();
    c.fillStyle = '#6aaf91'; c.beginPath(); c.moveTo(0, 427); c.quadraticCurveTo(230, 317, 512, 418); c.lineTo(512, 512); c.lineTo(0, 512); c.fill();
  });
  mesh(new THREE.PlaneGeometry(2.5, 2.34), new THREE.MeshBasicMaterial({ map: outside }), group, 0, 0, 0.103);
  box(group, 0, 0, 0.15, 0.11, 2.4, 0.13, materials.white);
  box(group, 0, 0, 0.15, 2.53, 0.11, 0.13, materials.white);
  box(group, 0, -1.35, 0.26, 3.1, 0.15, 0.52, materials.white);
  box(group, -1.45, 0, 0.19, 0.16, 2.8, 0.22, materials.white);
  box(group, 1.45, 0, 0.19, 0.16, 2.8, 0.22, materials.white);
  return group;
}

function addArt(room, item, x, y, z, facing = 'back', width = 1.72) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  if (facing === 'left') group.rotation.y = Math.PI / 2;
  room.add(group);
  const h = width * 0.79;
  box(group, 0, 0, 0, width + 0.23, h + 0.23, 0.18, materials.woodDark);
  box(group, 0, 0, 0.105, width + 0.12, h + 0.12, 0.08, materials.gold);
  box(group, 0, 0, 0.155, width + 0.035, h + 0.035, 0.03, materials.white);
  const texture = new THREE.TextureLoader().load(item.imageUrl, loaded => {
    const imageAspect = loaded.image.width / loaded.image.height;
    const frameAspect = width / h;
    if (imageAspect > frameAspect) {
      loaded.repeat.x = frameAspect / imageAspect;
      loaded.offset.x = (1 - loaded.repeat.x) / 2;
    } else {
      loaded.repeat.y = imageAspect / frameAspect;
      loaded.offset.y = (1 - loaded.repeat.y) / 2;
    }
    loaded.needsUpdate = true;
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const image = mesh(new THREE.PlaneGeometry(width, h), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }), group, 0, 0, 0.178);
  image.userData.artwork = item;
  image.castShadow = false;
  const pin = sphere(group, 0, h / 2 + 0.19, 0.03, 0.067, materials.coral);
  pin.castShadow = false;
  return image;
}

function addPlant(room, x, z, scale = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(scale); room.add(g);
  cylinder(g, 0, 0.36, 0, 0.34, 0.25, 0.65, materials.peach, 10);
  cylinder(g, 0, 0.66, 0, 0.29, 0.29, 0.09, materials.woodDark, 10);
  const leaf = mat(0x67aa80); const leafLight = mat(0x8dca91);
  for (let i = 0; i < 7; i++) {
    const a = i * Math.PI * 2 / 7;
    const l = sphere(g, Math.sin(a) * 0.3, 1.04 + i % 2 * 0.16, Math.cos(a) * 0.28, 0.37, i % 2 ? leaf : leafLight, 10);
    l.scale.set(0.63, 1.4, 0.63); l.rotation.z = Math.sin(a) * -0.35;
  }
  sphere(g, 0, 1.38, 0, 0.3, leafLight, 10);
  return g;
}

function addDesk(room, x, z, index) {
  const g = new THREE.Group(); g.position.set(x, 0, z); room.add(g);
  const leg = materials.woodDark;
  box(g, 0, 1.04, 0, 2.12, 0.16, 1.0, materials.wood);
  box(g, 0, 1.13, -0.42, 2.12, 0.11, 0.16, materials.woodDark);
  [-0.88, 0.88].forEach(px => [-0.33, 0.33].forEach(pz => box(g, px, 0.51, pz, 0.13, 1.02, 0.13, leg)));
  box(g, 0, 0.83, -0.35, 1.86, 0.34, 0.08, materials.cream);
  const chair = new THREE.Group(); chair.position.set(0, 0, 0.95); g.add(chair);
  const chairSeat = box(chair, 0, 0.52, 0, 0.86, 0.13, 0.73, materials.peach);
  const chairBack = box(chair, 0, 0.99, 0.34, 0.86, 0.91, 0.12, materials.peach);
  [chairSeat, chairBack].forEach(part => { part.userData.interaction = 'seat'; part.userData.seatId = index; });
  [-0.32, 0.32].forEach(px => [-0.23, 0.28].forEach(pz => box(chair, px, 0.26, pz, 0.1, 0.52, 0.1, leg)));
  const bookColors = [materials.coral, materials.blue, materials.gold, materials.darkMint];
  const book = box(g, -0.4, 1.17, -0.05, 0.57, 0.07, 0.35, bookColors[index % 4]); book.rotation.y = index % 2 ? 0.14 : -0.11;
  box(g, -0.4, 1.211, -0.05, 0.48, 0.01, 0.32, materials.white).rotation.y = book.rotation.y;
  cylinder(g, 0.68, 1.23, 0.04, 0.105, 0.095, 0.19, materials.white, 12);
  if (index % 3 === 0) { const pencil = cylinder(g, 0.18, 1.2, -0.17, 0.026, 0.026, 0.53, materials.gold, 6); pencil.rotation.z = Math.PI / 2; }
  const paperTexture = makeTextTexture(256, 320, c => {
    c.fillStyle = '#fffdf4'; c.fillRect(0, 0, 256, 320);
    c.strokeStyle = '#d0bfa1'; c.lineWidth = 5; c.strokeRect(9, 9, 238, 302);
    c.fillStyle = '#637d72'; c.font = 'bold 25px sans-serif'; c.textAlign = 'center'; c.fillText('BÀI KIỂM TRA', 128, 60);
    c.strokeStyle = '#d6d2bc'; c.lineWidth = 3;
    for (let y = 105; y < 280; y += 31) { c.beginPath(); c.moveTo(32, y); c.lineTo(224, y); c.stroke(); }
    c.fillStyle = '#df9c72'; c.beginPath(); c.arc(210, 280, 13, 0, Math.PI * 2); c.fill();
  });
  const paper = mesh(new THREE.PlaneGeometry(.55, .68), new THREE.MeshBasicMaterial({ map: paperTexture, side: THREE.DoubleSide }), g, .34, 1.132, .01);
  paper.rotation.x = -Math.PI / 2; paper.castShadow = false; paper.visible = false;
  return { x, z, w: 2.35, d: 1.65, chairMeshes: [chairSeat, chairBack], paper };
}

function addTeacherDesk(room) {
  const g = new THREE.Group(); g.position.set(-1.0, 0, -4.47); room.add(g);
  box(g, 0, 1.2, 0, 2.8, 0.17, 1.22, materials.wood);
  box(g, 0, 0.71, -0.48, 2.5, 0.9, 0.12, materials.cream);
  [-1.25, 1.25].forEach(px => [-0.46, 0.46].forEach(pz => box(g, px, 0.56, pz, 0.14, 1.1, 0.14, materials.woodDark)));
  const books = [materials.coral, materials.blue, materials.gold];
  books.forEach((m, i) => box(g, -0.75 + i * 0.2, 1.32 + i * 0.07, -0.1, 0.67, 0.11, 0.44, m));
  cylinder(g, 0.91, 1.42, -0.03, 0.15, 0.14, 0.35, materials.white);
  for (let i = 0; i < 4; i++) {
    const pencil = cylinder(g, 0.82 + i * 0.06, 1.67, -0.03, 0.025, 0.025, 0.38, i % 2 ? materials.coral : materials.gold, 6);
    pencil.rotation.z = (i - 1.5) * 0.14;
  }
  return { x: -1, z: -4.47, w: 3, d: 1.5 };
}

function addBoard(room) {
  const g = new THREE.Group(); g.position.set(-1.02, 3.12, -6.32); room.add(g);
  box(g, 0, 0, 0, 5.47, 2.7, 0.18, materials.woodDark);
  box(g, 0, 0, 0.11, 5.22, 2.47, 0.035, materials.chalk);
  const texture = makeTextTexture(1024, 512, (c) => {
    c.clearRect(0, 0, 1024, 512);
    c.textAlign = 'center'; c.fillStyle = '#fff8d9';
    c.font = 'bold 66px "Trebuchet MS", sans-serif'; c.fillText('DI CƯ 1954', 512, 98);
    c.fillStyle = '#f8eab9'; c.font = '45px "Trebuchet MS", sans-serif';
    ['✦  Hiệp định Giơnevơ', '✦  Bắc vào Nam', '✦  Passage to Freedom'].forEach((line, i) => c.fillText(line, 512, 190 + i * 82));
    c.strokeStyle = '#f8d496'; c.lineWidth = 4; c.beginPath(); c.moveTo(185, 121); c.lineTo(839, 121); c.stroke();
    c.font = '42px sans-serif'; c.fillStyle = '#ffd997'; c.fillText('☆', 900, 82); c.fillText('☆', 124, 392);
  });
  const text = mesh(new THREE.PlaneGeometry(5.18, 2.43), new THREE.MeshBasicMaterial({ map: texture, transparent: true }), g, 0, 0, 0.134);
  text.castShadow = false;
  box(g, 0, -1.41, 0.27, 5.6, 0.13, 0.55, materials.wood);
  box(g, 2.0, -1.31, 0.38, 0.35, 0.08, 0.17, materials.white);
  box(g, 1.55, -1.31, 0.38, 0.22, 0.08, 0.17, materials.peach);
}

function addWallDecor(room) {
  box(room, 0, 0.12, -6.31, 17.1, 0.25, 0.27, materials.woodDark);
  box(room, -8.32, 0.12, 0, 0.27, 0.25, 13.1, materials.woodDark);
  box(room, 0, 5.1, -6.43, 17.1, 0.18, 0.35, materials.white);
  box(room, -8.45, 5.1, 0, 0.35, 0.18, 13.1, materials.white);
  box(room, 0, 1.25, -6.34, 17.1, 0.12, 0.15, materials.white);
  box(room, -8.35, 1.25, 0, 0.15, 0.12, 13.1, materials.white);
  for (let x = -7.1; x <= 7.1; x += 1.9) box(room, x, 0.66, -6.32, 0.06, 1.15, 0.1, materials.darkMint);
  for (let z = -5.3; z <= 5.5; z += 1.9) box(room, -8.32, 0.66, z, 0.1, 1.15, 0.06, materials.darkMint);
  wallSign(room, [
    'Hiệp định Giơnevơ 1954 mở thời hạn chuyển quân',
    'và quyền thường dân chuyển vùng cư trú',
  ], -8.18, 4.46, 0.05, 11.6, 0.78, '#47766b', 60).rotation.y = Math.PI / 2;
}

function addQuizTv(shelf) {
  const tv = new THREE.Group();
  tv.position.set(0, 1.78, 0);
  shelf.add(tv);
  box(tv, 0, 0.09, 0, 1.25, 0.16, 0.47, materials.woodDark);
  box(tv, 0, 0.73, 0, 1.83, 1.22, 0.28, materials.peach);
  const bezel = box(tv, 0, 0.75, 0.155, 1.62, 0.99, 0.035, materials.woodDark);
  box(tv, 0.76, 0.12, 0.13, 0.18, 0.13, 0.12, materials.gold);
  const aerialLeft = cylinder(tv, -0.2, 1.49, -0.04, 0.018, 0.018, 0.45, materials.woodDark, 8);
  aerialLeft.rotation.z = -0.52;
  const aerialRight = cylinder(tv, 0.2, 1.49, -0.04, 0.018, 0.018, 0.45, materials.woodDark, 8);
  aerialRight.rotation.z = 0.52;

  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 320;
  const ctx = canvas.getContext('2d');
  const birdFrames = ['downflap', 'midflap', 'upflap'].map(frame => {
    const image = new Image();
    image.src = `/flappy/yellowbird-${frame}.png`;
    return image;
  });
  const pipeSprite = new Image();
  pipeSprite.src = '/flappy/pipe-green.png';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const screen = mesh(new THREE.PlaneGeometry(1.51, 0.88), new THREE.MeshBasicMaterial({ map: texture }), tv, 0, 0.75, 0.178);
  screen.castShadow = false;
  const hitArea = mesh(new THREE.PlaneGeometry(2.2, 1.55), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), tv, 0, 0.72, 0.21);
  hitArea.castShadow = false;
  [hitArea, screen, bezel].forEach(item => { item.userData.interaction = 'quiz'; });

  function draw(time) {
    const t = time * .001;
    ctx.imageSmoothingEnabled = false;
    const sky = ctx.createLinearGradient(0, 0, 0, 320);
    sky.addColorStop(0, '#7ccfe3'); sky.addColorStop(1, '#e6f6d6');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, 512, 320);
    ctx.fillStyle = '#fff8df';
    [[72, 66, 28], [102, 61, 37], [130, 69, 26], [381, 92, 24], [408, 85, 34]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#a5d8a2'; ctx.fillRect(0, 267, 512, 53);
    ctx.fillStyle = '#77b987';
    for (let x = -40; x < 570; x += 44) { ctx.beginPath(); ctx.arc(x, 275, 39, Math.PI, 0); ctx.fill(); }
    if (pipeSprite.complete && pipeSprite.naturalWidth) {
      for (let i = 0; i < 2; i++) {
        const pipeX = 520 - ((t * 87 + i * 300) % 660);
        const gapCenter = 150 + Math.sin(t * .75 + i * 2) * 23;
        const gapHalf = 66;
        const pipeWidth = 70;
        const pipeHeight = pipeWidth * pipeSprite.naturalHeight / pipeSprite.naturalWidth;
        ctx.save();
        ctx.translate(pipeX, gapCenter - gapHalf);
        ctx.scale(1, -1);
        ctx.drawImage(pipeSprite, 0, 0, pipeWidth, pipeHeight);
        ctx.restore();
        ctx.drawImage(pipeSprite, pipeX, gapCenter + gapHalf, pipeWidth, pipeHeight);
      }
    }
    const birdY = 153 + Math.sin(t * 3.7) * 21;
    const bird = birdFrames[Math.floor(t * 10) % birdFrames.length];
    if (bird.complete && bird.naturalWidth) {
      ctx.save();
      ctx.translate(164, birdY);
      ctx.rotate(Math.sin(t * 3.7) * .11);
      ctx.drawImage(bird, -34, -24, 68, 48);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(47,100,101,.82)'; ctx.font = 'bold 27px "Trebuchet MS", sans-serif'; ctx.textAlign = 'left'; ctx.fillText('FLAPPY QUIZ', 18, 37);
    ctx.fillStyle = '#fffbe8'; ctx.font = 'bold 19px "Trebuchet MS", sans-serif'; ctx.fillText('NHẤP ĐỂ CHƠI', 18, 301);
    texture.needsUpdate = true;
    tv.rotation.z = Math.sin(t * 1.35) * .006;
  }
  draw(0);
  return { pickables: [hitArea, screen, bezel], position: { x: 5.35, z: -3.2 }, update: draw };
}

function makeCharacter(room) {
  const root = new THREE.Group(); root.position.set(SPAWN_POSITION.x, 0, SPAWN_POSITION.z); room.add(root);
  const body = new THREE.Group(); root.add(body);
  const navy = mat(0x547f96); const hair = mat(0x55475a); const skin = mat(0xf3bf9f);
  const shoe = mat(0x667386); const blush = flat(0xe9938e);
  const torso = sphere(body, 0, 0.92, 0, 0.42, navy); torso.scale.set(1, 1.22, 0.77);
  sphere(body, 0, 1.66, 0.02, 0.44, skin, 20);
  const cap = sphere(body, 0, 1.9, -0.04, 0.42, hair, 20); cap.scale.set(1.08, 0.53, 1.1);
  for (let i = 0; i < 3; i++) { const tuft = sphere(body, -0.26 + i * 0.24, 1.92 - (i % 2) * 0.06, 0.31, 0.19, hair); tuft.scale.set(1, 0.7, 0.8); }
  [-0.18, 0.18].forEach(x => { sphere(body, x, 1.68, 0.405, 0.045, flat(0x394c55), 10); sphere(body, x * 1.65, 1.54, 0.368, 0.055, blush, 10); });
  const glasses = new THREE.Group(); body.add(glasses);
  [-0.18, 0.18].forEach(x => mesh(new THREE.TorusGeometry(.105, .018, 5, 20), flat(0x6e564d), glasses, x, 1.68, .43));
  box(glasses, 0, 1.7, .44, .17, .025, .025, flat(0x6e564d));
  glasses.visible = false;
  const smile = mesh(new THREE.TorusGeometry(0.085, 0.014, 5, 14, Math.PI), flat(0x9c5c60), body, 0, 1.49, 0.422); smile.rotation.z = Math.PI; smile.castShadow = false;
  const bag = box(body, 0, 0.91, -0.32, 0.55, 0.64, 0.24, materials.gold); bag.rotation.x = -0.12;
  box(body, 0, 1.04, -0.47, 0.37, 0.13, 0.06, materials.coral);
  const arms = [], legs = [];
  [-1, 1].forEach(side => {
    const arm = new THREE.Group(); arm.position.set(side * 0.42, 1.2, 0); body.add(arm);
    const sleeve = sphere(arm, side * 0.065, -0.19, 0, 0.16, navy); sleeve.scale.set(0.8, 1.5, 0.84);
    sphere(arm, side * 0.095, -0.42, 0.01, 0.105, skin); arms.push(arm);
    const leg = new THREE.Group(); leg.position.set(side * 0.18, 0.6, 0); body.add(leg);
    box(leg, 0, -0.23, 0, 0.23, 0.47, 0.25, materials.cream);
    const foot = sphere(leg, 0, -0.49, 0.13, 0.17, shoe); foot.scale.set(1, 0.58, 1.38); legs.push(leg);
  });
  const maleParts = [...body.children];
  const modelContainer = new THREE.Group();
  body.add(modelContainer);
  modelContainer.visible = false;
  let modelRig = null;
  let loadingAvatar = null;
  let loadVersion = 0;
  const failedAvatars = new Set();
  let currentAvatar = 'male-classic';

  const findBones = (model, patterns) => {
    const found = [];
    model.traverse(child => {
      if (child.isBone && patterns.some(pattern => pattern.test(child.name))) found.push(child);
    });
    return found;
  };
  const refreshAvatarVisibility = () => {
    const showModel = currentAvatar !== 'male-classic' && modelRig?.avatar === currentAvatar;
    maleParts.forEach(part => { part.visible = !showModel; });
    modelContainer.visible = Boolean(showModel);
  };

  function ensureModelAvatar(avatar) {
    if (modelRig?.avatar === avatar || loadingAvatar === avatar || failedAvatars.has(avatar)) return;
    const version = loadVersion;
    loadingAvatar = avatar;
    loadAvatarTemplate(avatar).then(template => {
      if (currentAvatar !== avatar || version !== loadVersion) return;
      const model = cloneSkeleton(template);
      // The GLB characters face +Z, matching the procedural character and
      // Math.atan2(velocityX, velocityZ) used by the movement controller.
      model.rotation.y = 0;
      model.updateMatrixWorld(true);
      const sourceBounds = new THREE.Box3().setFromObject(model);
      const sourceHeight = Math.max(.001, sourceBounds.getSize(new THREE.Vector3()).y);
      model.scale.setScalar(2.02 / sourceHeight);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.set(-center.x, -bounds.min.y, -center.z);
      model.traverse(child => {
        if (!child.isMesh) return;
        child.castShadow = true; child.receiveShadow = true;
        if (child.material?.map) child.material.map.anisotropy = 8;
      });
      modelContainer.clear();
      modelContainer.add(model);
      const bones = {
        // Miku uses j_kata for the upper arm and j_ude for the forearm.
        // Treating j_ude as the shoulder joint bends the hands up while the
        // upper arms remain in their imported T-pose.
        leftArm: findBones(model, [/^Arm_L_\d+$/, /^upper_arm\.L_\d+$/, /^upper_armL_\d+$/, /^j_kata_l_wj_cu_\d+$/]),
        rightArm: findBones(model, [/^Arm_R_\d+$/, /^upper_arm\.R_\d+$/, /^upper_armR_\d+$/, /^j_kata_r_wj_cu_\d+$/]),
        leftForearm: findBones(model, [/^Elbow_L_\d+$/, /^forearm\.L_\d+$/, /^forearmL_\d+$/, /^j_ude_l_wj_\d+$/]),
        rightForearm: findBones(model, [/^Elbow_R_\d+$/, /^forearm\.R_\d+$/, /^forearmR_\d+$/, /^j_ude_r_wj_\d+$/]),
        leftThigh: findBones(model, [/^Thigh_L_/, /^thighL_/, /^j_momo_l_wj_/]),
        rightThigh: findBones(model, [/^Thigh_R_/, /^thighR_/, /^j_momo_r_wj_/]),
        leftKnee: findBones(model, [/^Knee_L_/, /^shinL_/, /^j_sune_l_wj_/]),
        rightKnee: findBones(model, [/^Knee_R_/, /^shinR_/, /^j_sune_r_wj_/]),
        head: findBones(model, [/^Head_/, /^spine006_/, /^j_kao_wj_/]),
        chest: findBones(model, [/^Chest_/, /^spine003_/, /^j_mune_wj_/]),
      };
      const defaults = new Map(Object.values(bones).flat().map(bone => [bone, bone.quaternion.clone()]));
      const canBendLegs = bones.leftThigh.length > 0 && bones.rightThigh.length > 0;
      modelRig = { avatar, model, bones, defaults, canBendLegs };
      loadingAvatar = null;
      refreshAvatarVisibility();
    }).catch(error => {
      if (version !== loadVersion) return;
      loadingAvatar = null;
      failedAvatars.add(avatar);
      refreshAvatarVisibility();
      console.warn(`Không tải được avatar ${avatar}:`, error);
    });
  }

  const shadow = mesh(new THREE.CircleGeometry(0.65, 32), new THREE.MeshBasicMaterial({ color: 0x4f776a, transparent: true, opacity: 0.15, depthWrite: false }), root, 0, 0.018, 0);
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false;
  const nameCanvas = document.createElement('canvas'); nameCanvas.width = 384; nameCanvas.height = 80;
  const nameTexture = new THREE.CanvasTexture(nameCanvas); nameTexture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTexture, transparent: true, depthTest: false }));
  label.position.set(0, 2.43, 0); label.scale.set(1.9, .4, 1); root.add(label);
  let currentName = '';
  let currentRole = '';
  let currentGender = 'male';
  function setAppearance(name, role, gender = 'male', avatar = 'male-classic') {
    const selected = getAvatarOption(avatar);
    gender = selected.gender; avatar = selected.id;
    if (name === currentName && role === currentRole && gender === currentGender && avatar === currentAvatar) return;
    if (avatar !== currentAvatar) { loadVersion++; loadingAvatar = null; }
    currentName = name; currentRole = role; currentGender = gender; currentAvatar = avatar;
    if (currentAvatar !== 'male-classic') ensureModelAvatar(currentAvatar);
    refreshAvatarVisibility();
    navy.color.setHex(role === 'teacher' ? 0x9c6f82 : 0x547f96);
    glasses.visible = role === 'teacher';
    const c = nameCanvas.getContext('2d'); c.clearRect(0, 0, 384, 80);
    c.fillStyle = role === 'teacher' ? '#fff0c7' : '#fffdf1'; c.beginPath(); c.roundRect(4, 5, 376, 68, 30); c.fill();
    c.fillStyle = role === 'teacher' ? '#805662' : '#416d6b';
    c.font = 'bold 35px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(name.slice(0, 24), 192, 40, 342);
    nameTexture.needsUpdate = true;
  }
  const extraRotation = new THREE.Quaternion();
  const targetRotation = new THREE.Quaternion();
  const extraEuler = new THREE.Euler();
  function poseBones(bones, x = 0, y = 0, z = 0, blend = 1) {
    extraRotation.setFromEuler(extraEuler.set(x, y, z));
    for (const bone of bones || []) {
      const base = modelRig?.defaults.get(bone);
      if (!base) continue;
      targetRotation.copy(base).multiply(extraRotation);
      bone.quaternion.slerp(targetRotation, blend);
    }
  }
  function animate({ walking, phase, stride = 0, seated = false, dt, now }) {
    const usingModel = currentAvatar !== 'male-classic' && modelRig?.avatar === currentAvatar;
    // Rigged avatars keep their hips near chair-seat height. Models without
    // recognized leg bones are lifted onto the seat instead of sinking under it.
    const seatedY = modelRig?.canBendLegs ? -0.06 : 0.54;
    const targetY = usingModel && seated ? seatedY : walking ? Math.abs(Math.sin(phase)) * 0.055 * stride : usingModel ? Math.sin(now * .0018) * .009 : 0;
    body.position.y += (targetY - body.position.y) * (1 - Math.exp(-dt * 14));

    const swing = walking ? Math.sin(phase) * stride : 0;
    arms[0].rotation.x += (swing * .48 - arms[0].rotation.x) * .25;
    arms[1].rotation.x += (-swing * .48 - arms[1].rotation.x) * .25;
    legs[0].rotation.x += (((seated ? -1.2 : 0) - swing * .47) - legs[0].rotation.x) * .25;
    legs[1].rotation.x += (((seated ? -1.2 : 0) + swing * .47) - legs[1].rotation.x) * .25;

    if (!usingModel) return;
    const { bones, model } = modelRig;
    const idle = Math.sin(now * .0015);
    const blend = 1 - Math.exp(-dt * 12);
    const armDrop = seated ? 1.3 : 1.42;
    const armSwing = walking ? swing * .38 : idle * .025;
    poseBones(bones.leftArm, armSwing, 0, -armDrop, blend);
    poseBones(bones.rightArm, -armSwing, 0, armDrop, blend);
    // Keep the elbows in their natural imported alignment. The shoulder
    // drives the relaxed pendulum motion, so hands hang beside the body
    // instead of curling forward into the old T-pose correction.
    poseBones(bones.leftForearm, 0, 0, 0, blend);
    poseBones(bones.rightForearm, 0, 0, 0, blend);
    poseBones(bones.leftThigh, seated && modelRig.canBendLegs ? -1.05 : -swing * .5, 0, 0, blend);
    poseBones(bones.rightThigh, seated && modelRig.canBendLegs ? -1.05 : swing * .5, 0, 0, blend);
    poseBones(bones.leftKnee, seated && modelRig.canBendLegs ? 1.28 : Math.max(0, swing) * .3, 0, 0, blend);
    poseBones(bones.rightKnee, seated && modelRig.canBendLegs ? 1.28 : Math.max(0, -swing) * .3, 0, 0, blend);
    poseBones(bones.head, 0, idle * .035, idle * .012, blend);
    poseBones(bones.chest, idle * .008, 0, walking ? -swing * .035 : idle * .008, blend);
    model.rotation.z += (((walking ? -swing * .025 : idle * .009)) - model.rotation.z) * blend;
  }
  setAppearance('Sinh viên', 'student', 'male', 'male-classic');
  return { root, body, arms, legs, setAppearance, animate };
}

export function createClassroom(canvas, { onArtwork, onQuiz, onNearby, onSeat = () => {}, onPose = () => {} }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe5f4ed);
  scene.fog = new THREE.Fog(0xe5f4ed, 29, 65);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 100);
  camera.position.set(19, 18, 23);
  camera.lookAt(0, 1.45, 0);
  camera.zoom = 0.9;
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.45, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minPolarAngle = 0.48;
  controls.maxPolarAngle = 1.25;
  controls.minAzimuthAngle = 0.25;
  controls.maxAzimuthAngle = 1.28;
  controls.minZoom = 0.74;
  controls.maxZoom = 1.7;

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc0d9c4, 1.3));
  const sun = new THREE.DirectionalLight(0xfff0c7, 2.2);
  sun.position.set(10, 18, 13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 50;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 3;
  scene.add(sun);

  const room = new THREE.Group(); scene.add(room);
  box(room, 0, -0.24, 0, 17.2, 0.48, 13.2, materials.white);
  box(room, 0, -0.02, 0, 16.7, 0.04, 12.7, materials.cream);
  const tileLine = flat(0xe8dcc0);
  for (let x = -8.15; x <= 8.15; x += 1.6) { const l = box(room, x, 0.006, 0, 0.018, 0.005, 12.7, tileLine); l.castShadow = false; }
  for (let z = -6.15; z <= 6.15; z += 1.6) { const l = box(room, 0, 0.006, z, 16.7, 0.005, 0.018, tileLine); l.castShadow = false; }
  box(room, 0, 2.55, -6.52, 17.25, 5.15, 0.26, materials.mint);
  box(room, -8.52, 2.55, 0, 0.26, 5.15, 13.25, materials.mint);
  box(room, 0, 0.64, -6.35, 17.05, 1.23, 0.08, materials.darkMint);
  box(room, -8.35, 0.64, 0, 0.08, 1.23, 13.05, materials.darkMint);
  addWallDecor(room);
  addBoard(room);
  addWindow(room, 5.12, 3.11);
  wallSign(room, 'Phân biệt mục tiêu chính trị với động cơ người di cư', 4.98, 4.65, -6.18, 6.05, 0.48, '#47766b', 51);

  const artMeshes = [];
  const leftZ = [-4.94, -2.55, -0.16, 2.23, 4.62];
  leftZ.forEach((z, i) => artMeshes.push(addArt(room, artworks[i], -8.29, 3.0, z, 'left', 1.72)));
  artMeshes.push(addArt(room, artworks[5], -6.48, 3.2, -6.29, 'back', 1.48));
  artMeshes.push(addArt(room, artworks[6], 2.35, 3.1, -6.29, 'back', 1.35));
  artMeshes.push(addArt(room, artworks[7], 7.58, 3.1, -6.29, 'back', 1.22));

  const desks = deskPositions.map(({ x, z }, index) => addDesk(room, x, z, index));
  const obstacles = [addTeacherDesk(room), ...desks];
  addPlant(room, 7.58, -5.1, 0.86);
  addPlant(room, -7.4, 5.58, 0.72);
  addPlant(room, 6.62, 5.4, 0.7);

  // Classroom objects along the open side make the larger floor feel inhabited.
  const shelf = new THREE.Group(); shelf.position.set(5.35, 0, -3.2); room.add(shelf);
  box(shelf, 0, 0.9, 0, 1.9, 1.75, 0.61, materials.wood);
  box(shelf, 0, 1.34, 0.35, 1.72, 0.08, 0.1, materials.woodDark);
  box(shelf, 0, 0.83, 0.35, 1.72, 0.08, 0.1, materials.woodDark);
  for (let i = 0; i < 11; i++) box(shelf, -0.7 + i * 0.14, 1.53, 0.1, 0.1, 0.3 + i % 3 * 0.08, 0.38, [materials.coral, materials.blue, materials.gold, materials.darkMint][i % 4]);
  const quizTv = addQuizTv(shelf);
  obstacles.push({ x: 5.35, z: -3.2, w: 2.2, d: 0.9 });

  const character = makeCharacter(room);
  const remotePlayers = new Map();
  let selfSeatId = null;
  let selfId = null;
  let selfPoseInitialized = false;
  const raycaster = new THREE.Raycaster();
  const interactiveMeshes = [...artMeshes, ...quizTv.pickables, ...desks.flatMap(desk => desk.chairMeshes)];
  const pointer = new THREE.Vector2();
  let hovered = null;
  const keys = new Set();
  const mobile = { x: 0, z: 0 };
  let walkTime = 0;
  let velocityX = 0;
  let velocityZ = 0;
  let lastTime = performance.now();
  let pointerDown = null;
  let nearest = null;
  let active = true;
  let lastTvFrame = 0;
  let lastPoseFrame = 0;

  function updateRemoteAvatar(avatar, pose) {
    const now = performance.now();
    if (avatar.target?.seatId !== pose.seatId ||
        (avatar.target && Math.hypot(pose.x - avatar.target.x, pose.z - avatar.target.z) > 1.5)) {
      // Seat changes and large corrections should not animate through furniture.
      avatar.root.position.set(pose.x, 0, pose.z);
      avatar.body.rotation.y = pose.rotation;
      avatar.motion = createMotionBuffer(pose, now);
    } else {
      pushMotionSample(avatar.motion, pose, now);
    }
    avatar.target = { x: pose.x, z: pose.z, rotation: pose.rotation, seatId: pose.seatId };
  }

  function syncPlayers(players, ownId) {
    selfId = ownId;
    const seen = new Set();
    desks.forEach(desk => { desk.paper.visible = false; });
    for (const player of players) {
      if (player.seatId !== null) desks[player.seatId].paper.visible = true;
      if (player.id === selfId) {
        character.setAppearance(player.name, player.role, player.gender, player.avatar);
        if (!selfPoseInitialized || player.seatId !== selfSeatId) {
          selfPoseInitialized = true;
          selfSeatId = player.seatId;
          const safePose = player.seatId === null && !canMove(player.x, player.z)
            ? SPAWN_POSITION
            : player;
          character.root.position.set(safePose.x, 0, safePose.z);
          character.body.rotation.y = safePose.rotation;
          velocityX = 0;
          velocityZ = 0;
          keys.clear();
          mobile.x = 0;
          mobile.z = 0;
          if (safePose === SPAWN_POSITION) {
            onPose({ ...SPAWN_POSITION, vx: 0, vz: 0 });
            lastPoseFrame = performance.now();
          }
        }
        continue;
      }
      seen.add(player.id);
      let avatar = remotePlayers.get(player.id);
      if (!avatar) {
        avatar = makeCharacter(room);
        avatar.root.position.set(player.x, 0, player.z);
        avatar.walkTime = 0;
        avatar.motion = createMotionBuffer(player, performance.now());
        remotePlayers.set(player.id, avatar);
      }
      avatar.setAppearance(player.name, player.role, player.gender, player.avatar);
      updateRemoteAvatar(avatar, player);
    }
    for (const [id, avatar] of remotePlayers) {
      if (!seen.has(id)) { room.remove(avatar.root); remotePlayers.delete(id); }
    }
  }

  function syncPose(pose) {
    const { id, x, z, rotation } = pose;
    const avatar = remotePlayers.get(id);
    if (!avatar || avatar.target?.seatId !== null || ![x, z, rotation].every(Number.isFinite)) return;
    const sequence = pose.seq;
    if (Number.isInteger(sequence) && Number.isInteger(avatar.lastSequence) && sequence <= avatar.lastSequence) return;
    if (Number.isInteger(sequence)) avatar.lastSequence = sequence;
    updateRemoteAvatar(avatar, {
      x, z, rotation, seatId: null,
      vx: Number.isFinite(pose.vx) ? pose.vx : 0,
      vz: Number.isFinite(pose.vz) ? pose.vz : 0,
    });
  }

  function canMove(x, z) {
    if (x < -7.82 || x > 7.83 || z < -5.75 || z > 5.86) return false;
    return !obstacles.some(o => Math.abs(x - o.x) < o.w / 2 + 0.34 && Math.abs(z - o.z) < o.d / 2 + 0.33);
  }

  function nearestInteraction() {
    if (selfSeatId !== null) return { type: 'seat', seatId: selfSeatId, sitting: true };
    let found = null; let distance = Infinity;
    artMeshes.forEach(image => {
      const pos = new THREE.Vector3(); image.getWorldPosition(pos);
      const d = Math.hypot(character.root.position.x - pos.x, character.root.position.z - pos.z);
      if (d < 3.2 && d < distance) { distance = d; found = { type: 'art', artwork: image.userData.artwork }; }
    });
    const tvDistance = Math.hypot(character.root.position.x - quizTv.position.x, character.root.position.z - quizTv.position.z);
    if (tvDistance < 3.1 && tvDistance < distance) found = { type: 'quiz' };
    desks.forEach((desk, seatId) => {
      const seat = seatPosition(seatId);
      const d = Math.hypot(character.root.position.x - seat.x, character.root.position.z - seat.z);
      if (d < 1.7 && d < distance) { distance = d; found = { type: 'seat', seatId, sitting: false }; }
    });
    return found;
  }

  function activateInteraction(target) {
    if (!target) return;
    if (target.type === 'quiz') onQuiz();
    else if (target.type === 'seat') {
      if (selfSeatId === null) {
        onPose({ x: character.root.position.x, z: character.root.position.z, rotation: character.body.rotation.y });
        lastPoseFrame = performance.now();
      }
      onSeat(target.seatId);
    }
    else onArtwork(target.artwork);
  }

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactiveMeshes, false);
    hovered = hits.length ? hits[0].object : null;
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  }

  canvas.addEventListener('pointermove', updatePointer);
  canvas.addEventListener('pointerdown', e => { pointerDown = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (pointerDown && Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y) < 6) {
      updatePointer(e);
      if (hovered) {
        const kind = hovered.userData.interaction;
        activateInteraction(kind === 'quiz' ? { type: 'quiz' } : kind === 'seat' ? { type: 'seat', seatId: hovered.userData.seatId } : { type: 'art', artwork: hovered.userData.artwork });
      }
    }
    pointerDown = null;
  });
  window.addEventListener('keydown', e => {
    if (!active || e.target.closest('input, textarea, button, [role="dialog"]')) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'e' && active) {
      activateInteraction(nearestInteraction());
    }
  });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const span = aspect < 0.65 ? 36 : aspect < 0.9 ? 23 : aspect < 1.25 ? 17.8 : 16.4;
    camera.left = -span * aspect / 2;
    camera.right = span * aspect / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - lastTime) / 1000, 0.05); lastTime = now;
    controls.update();
    let side = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')) + mobile.x;
    let forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown')) + mobile.z;
    const length = Math.hypot(side, forward);
    let desiredX = 0;
    let desiredZ = 0;
    if (active && selfSeatId === null && length > 0.05) {
      side /= Math.max(1, length); forward /= Math.max(1, length);
      const cameraForward = new THREE.Vector3(); camera.getWorldDirection(cameraForward); cameraForward.y = 0; cameraForward.normalize();
      const cameraRight = new THREE.Vector3().crossVectors(cameraForward, new THREE.Vector3(0, 1, 0)).normalize();
      const vx = cameraRight.x * side + cameraForward.x * forward;
      const vz = cameraRight.z * side + cameraForward.z * forward;
      const speed = keys.has('shift') ? 4.65 : 3.05;
      desiredX = vx * speed;
      desiredZ = vz * speed;
    }
    if (!active || selfSeatId !== null) {
      velocityX = 0;
      velocityZ = 0;
    } else {
      const response = 1 - Math.exp(-dt * (length > .05 ? 16 : 22));
      velocityX += (desiredX - velocityX) * response;
      velocityZ += (desiredZ - velocityZ) * response;
    }
    const walkingSpeed = Math.hypot(velocityX, velocityZ);
    if (walkingSpeed > .05) {
      const p = character.root.position;
      if (canMove(p.x + velocityX * dt, p.z)) p.x += velocityX * dt;
      else velocityX = 0;
      if (canMove(p.x, p.z + velocityZ * dt)) p.z += velocityZ * dt;
      else velocityZ = 0;
      if (Math.hypot(velocityX, velocityZ) > .05) {
        const targetAngle = Math.atan2(velocityX, velocityZ);
        character.body.rotation.y += Math.atan2(Math.sin(targetAngle - character.body.rotation.y), Math.cos(targetAngle - character.body.rotation.y)) * Math.min(1, dt * 10);
      }
      walkTime += dt * 9;
      const stride = Math.min(1, Math.hypot(velocityX, velocityZ) / 3.05);
      character.animate({ walking: true, phase: walkTime, stride, seated: false, dt, now });
    } else {
      character.animate({ walking: false, phase: walkTime, seated: selfSeatId !== null, dt, now });
    }
    for (const avatar of remotePlayers.values()) {
      if (!avatar.target) continue;
      const { seatId } = avatar.target;
      const latest = predictMotionPose(avatar.motion, now);
      const { x, z, rotation } = seatId === null
        ? approachMotionPose({
            x: avatar.root.position.x, z: avatar.root.position.z, rotation: avatar.body.rotation.y,
          }, latest, dt)
        : latest;
      const previousX = avatar.root.position.x;
      const previousZ = avatar.root.position.z;
      avatar.root.position.set(x, 0, z);
      avatar.body.rotation.y = rotation;
      const walking = seatId === null && Math.hypot(avatar.root.position.x - previousX, avatar.root.position.z - previousZ) > .004;
      if (walking) {
        avatar.walkTime += dt * 9;
      }
      avatar.animate({ walking, phase: avatar.walkTime, stride: walking ? 1 : 0, seated: seatId !== null, dt, now });
    }
    if (selfId && selfSeatId === null && now - lastPoseFrame > 50) {
      onPose({
        x: character.root.position.x, z: character.root.position.z,
        rotation: character.body.rotation.y, vx: velocityX, vz: velocityZ,
      });
      lastPoseFrame = now;
    }
    if (now - lastTvFrame > 50) { quizTv.update(now); lastTvFrame = now; }
    nearest = nearestInteraction();
    onNearby(nearest);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  return {
    setMovement(x, z) { mobile.x = x; mobile.z = z; },
    setActive(value) { active = value; if (!active) keys.clear(); },
    resetSelfPose() {
      selfPoseInitialized = false;
      selfSeatId = null;
      velocityX = 0;
      velocityZ = 0;
      keys.clear();
      mobile.x = 0;
      mobile.z = 0;
    },
    resetCamera() { camera.position.set(19, 18, 23); controls.target.set(0, 1.45, 0); camera.zoom = 0.9; camera.updateProjectionMatrix(); controls.update(); },
    inspectNearby() { activateInteraction(nearestInteraction()); },
    setProfile({ name = 'Sinh viên', gender = 'male', avatar = 'male-classic' }) {
      character.setAppearance(name, 'student', gender, avatar);
    },
    syncPlayers,
    syncPose,
    getSeatId() { return selfSeatId; },
  };
}
