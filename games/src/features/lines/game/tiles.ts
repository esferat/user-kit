import * as THREE from 'three';

import {CELL_SIZE, TILE_DEPTH} from './constants';
import {makeRng, range, type Rng} from './random';

/**
 * Контур плитки: скруглённый прямоугольник со случайными сколами по краям.
 * Сколы разные у каждой плитки: их количество, ширина и глубина зависят от rng.
 */
function tileShape(rng: Rng): THREE.Shape {
  const size = CELL_SIZE;
  const radius = 14;
  const points: THREE.Vector2[] = [];

  const push = (x: number, y: number) => {
    const last = points[points.length - 1];
    if (last && Math.abs(last.x - x) < 1e-6 && Math.abs(last.y - y) < 1e-6) {
      return;
    }
    points.push(new THREE.Vector2(x, y));
  };

  // Дуга скругления: sampled полигоном — ExtrudeGeometry не любит дыры в контуре.
  const arc = (cx: number, cy: number, from: number, to: number) => {
    const steps = 5;
    for (let i = 0; i <= steps; i += 1) {
      const angle = from + ((to - from) * i) / steps;
      push(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
    }
  };

  // Ребро с `chips` сколами. Путь идёт против часовой — внутренняя нормаль слева.
  const edge = (x1: number, y1: number, x2: number, y2: number, chips: number) => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const dx = (x2 - x1) / length;
    const dy = (y2 - y1) / length;
    const nx = -dy;
    const ny = dx;
    const at = (t: number, depth = 0) => push(x1 + dx * t + nx * depth, y1 + dy * t + ny * depth);

    const spans: Array<[number, number]> = [];
    for (let i = 0; i < chips; i += 1) {
      const width = range(rng, 9, 18);
      const center = range(rng, radius + width + 10, length - radius - width - 10);
      const span: [number, number] = [center - width / 2, center + width / 2];
      if (span[0] < 6 || span[1] > length - 6) continue;
      if (spans.some((other) => span[0] < other[1] + 6)) continue;
      spans.push(span);
    }
    spans.sort((a, b) => a[0] - b[0]);

    for (const [from, to] of spans) {
      const width = to - from;
      const depth = range(rng, 3.5, 7);
      at(from); // вход в скол
      at(from + width * 0.22, depth * range(rng, 0.5, 0.85)); // острый зуб
      at(from + width * 0.46, depth); // глубочайшая точка скола
      at(from + width * 0.7, depth * range(rng, 0.3, 0.65)); // скошенный склон
      at(to); // выход наружу
    }
    at(length); // конец ребра
  };

  // Обход против часовой от нижнего левого угла.
  arc(radius, radius, Math.PI, Math.PI * 1.5);
  edge(radius, 0, size - radius, 0, rng() < 0.6 ? (rng() < 0.3 ? 2 : 1) : 0);
  arc(size - radius, radius, -Math.PI / 2, 0);
  edge(size, radius, size, size - radius, rng() < 0.6 ? (rng() < 0.3 ? 2 : 1) : 0);
  arc(size - radius, size - radius, 0, Math.PI / 2);
  edge(size - radius, size, radius, size, rng() < 0.6 ? (rng() < 0.3 ? 2 : 1) : 0);
  arc(radius, size - radius, Math.PI / 2, Math.PI);
  edge(0, size - radius, 0, radius, rng() < 0.6 ? (rng() < 0.3 ? 2 : 1) : 0);

  return new THREE.Shape(points);
}

/** Уникальная для плитки геометрия: скруглённые края (bevel) плюс случайные сколы. */
export function createTileGeometry(rng: Rng): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(tileShape(rng), {
    depth: TILE_DEPTH,
    bevelEnabled: true,
    bevelThickness: 1.4,
    bevelSize: 1.4,
    bevelOffset: 0,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 1,
  });
  // Плоскость XZ, центр в начале координат, низ на земле (y = 0).
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(-CELL_SIZE / 2, 1.4, CELL_SIZE / 2);

  // UV генератор ExtrudeGeometry работает в единицах фигуры (0..100) — приводим к 0..1.
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, uv.getX(i) * 0.01, uv.getY(i) * 0.01);
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Общая текстура камня: шум, пятна и трещины, нарисованные на canvas. */
export function createStoneTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D-контекст недоступен');
  }
  const rng = makeRng(31_052_026);

  ctx.fillStyle = '#a9a496';
  ctx.fillRect(0, 0, size, size);

  // Крупные светлые и тёмные пятна.
  for (let i = 0; i < 14; i += 1) {
    const x = range(rng, 0, size);
    const y = range(rng, 0, size);
    const r = range(rng, 90, 240);
    const rgb = rng() > 0.5 ? '198, 193, 179' : '96, 92, 83';
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, `rgba(${rgb}, 0.16)`);
    gradient.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  // Мелкие вкрапления.
  for (let i = 0; i < 380; i += 1) {
    const light = rng() > 0.5;
    ctx.fillStyle = light
      ? `rgba(214, 208, 192, ${range(rng, 0.04, 0.14)})`
      : `rgba(74, 70, 62, ${range(rng, 0.04, 0.16)})`;
    ctx.beginPath();
    ctx.arc(range(rng, 0, size), range(rng, 0, size), range(rng, 2, 14), 0, Math.PI * 2);
    ctx.fill();
  }

  // Трещины.
  ctx.strokeStyle = 'rgba(64, 60, 54, 0.4)';
  for (let i = 0; i < 26; i += 1) {
    ctx.lineWidth = range(rng, 0.5, 1.6);
    ctx.beginPath();
    let x = range(rng, 0, size);
    let y = range(rng, 0, size);
    ctx.moveTo(x, y);
    for (let step = 0; step < 5; step += 1) {
      x += range(rng, -46, 46);
      y += range(rng, -46, 46);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Мелкое зерно.
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (rng() - 0.5) * 30;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Материал плитки: общая текстура камня со случайными сдвигом/поворотом
 * и лёгким оттенком — соседние плитки не выглядят одинаковыми.
 */
export function createTileMaterial(texture: THREE.Texture, rng: Rng): THREE.MeshStandardMaterial {
  const map = texture.clone();
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.center.set(0.5, 0.5);
  map.rotation = rng() * Math.PI * 2;
  map.offset.set(rng(), rng());
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map,
    color: new THREE.Color().setHSL(
      range(rng, 0.06, 0.12),
      range(rng, 0.03, 0.08),
      range(rng, 0.78, 0.95),
    ),
    roughness: range(rng, 0.82, 0.95),
    metalness: 0.02,
  });
}
