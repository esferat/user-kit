import * as THREE from 'three';

import {BOARD_HALF, FRAME_WIDTH, SCENE_HALF} from './constants';
import {makeRng, range, type Rng} from './random';

/** Случайный оттенок зелени для листьев и травы. */
function greenColor(rng: Rng): THREE.Color {
  return new THREE.Color().setHSL(
    range(rng, 0.24, 0.36),
    range(rng, 0.4, 0.62),
    range(rng, 0.2, 0.4),
  );
}

/** Скруглённый прямоугольный путь (для земляного кольца и его отверстия). */
function roundedRect<T extends THREE.Shape | THREE.Path>(target: T, half: number, radius: number): T {
  target.moveTo(-half + radius, -half);
  target.lineTo(half - radius, -half);
  target.absarc(half - radius, -half + radius, radius, -Math.PI / 2, 0, false);
  target.lineTo(half, half - radius);
  target.absarc(half - radius, half - radius, radius, 0, Math.PI / 2, false);
  target.lineTo(-half + radius, half);
  target.absarc(-half + radius, half - radius, radius, Math.PI / 2, Math.PI, false);
  target.lineTo(-half, -half + radius);
  target.absarc(-half + radius, -half + radius, radius, Math.PI, Math.PI * 1.5, false);
  return target;
}

/** Точка в полосе обрамления: по периметру поля, на расстоянии от его края. */
function perimeterPoint(rng: Rng): {x: number; z: number} {
  const side = Math.floor(rng() * 4);
  const along = range(rng, -SCENE_HALF, SCENE_HALF);
  const edge = BOARD_HALF + range(rng, 6, FRAME_WIDTH - 4);
  if (side === 0) return {x: along, z: edge};
  if (side === 1) return {x: along, z: -edge};
  if (side === 2) return {x: edge, z: along};
  return {x: -edge, z: along};
}

/** Земляная полоса под растениями: кольцо между полем и внешним краем сцены. */
function soilRing(): THREE.Mesh {
  const inner = BOARD_HALF + 4;
  const outer = SCENE_HALF + 2;
  const shape = roundedRect(new THREE.Shape(), outer, 18);
  const hole = roundedRect(new THREE.Path(), inner, 12);
  shape.holes.push(hole);
  const geometry = new THREE.ShapeGeometry(shape, 4);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({color: '#38322a', roughness: 1, metalness: 0});
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.3;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Обрамление поля в виде растений: земляное кольцо, переплетённая лоза
 * вдоль сторон, листья и трава. Все элементы случайные — не повторяются.
 */
export function createPlantFrame(): THREE.Group {
  const group = new THREE.Group();
  const rng = makeRng(8_240_517);

  group.add(soilRing());

  // Лоза: две волнистые линии вдоль каждой стороны.
  const vineMaterial = new THREE.MeshStandardMaterial({
    color: '#3c5f2e',
    roughness: 0.9,
    metalness: 0,
  });
  const axes = [
    {axis: new THREE.Vector3(1, 0, 0), normal: new THREE.Vector3(0, 0, 1)},
    {axis: new THREE.Vector3(0, 0, 1), normal: new THREE.Vector3(1, 0, 0)},
  ];
  for (const {axis, normal} of axes) {
    for (const sign of [1, -1]) {
      for (const offset of [34, 76]) {
        const points: THREE.Vector3[] = [];
        const steps = 13;
        for (let i = 0; i <= steps; i += 1) {
          const t = -SCENE_HALF + (i / steps) * SCENE_HALF * 2;
          const wobble = Math.sin(i * 1.7 + sign + offset) * range(rng, 4, 14);
          const point = axis
            .clone()
            .multiplyScalar(t)
            .add(normal.clone().multiplyScalar(sign * (BOARD_HALF + offset + wobble)));
          point.y = range(rng, 1.4, 4.2);
          points.push(point);
        }
        const curve = new THREE.CatmullRomCurve3(points);
        const geometry = new THREE.TubeGeometry(curve, 64, range(rng, 1.6, 2.6), 6, false);
        const mesh = new THREE.Mesh(geometry, vineMaterial);
        mesh.castShadow = true;
        group.add(mesh);
      }
    }
  }

  // Лист: заострённый овал, лежит горизонтально.
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(6.5, 9, 0, 21);
  leafShape.quadraticCurveTo(-6.5, 9, 0, 0);
  const leafGeometry = new THREE.ShapeGeometry(leafShape, 5);
  leafGeometry.rotateX(-Math.PI / 2);
  const leafMaterials = Array.from({length: 10}, () =>
    greenMaterial(rng, 0.8, THREE.DoubleSide),
  );
  const addLeaf = () => {
    const {x, z} = perimeterPoint(rng);
    const leaf = new THREE.Mesh(leafGeometry, leafMaterials[Math.floor(rng() * leafMaterials.length)]);
    leaf.position.set(x, range(rng, 1, 3.5), z);
    leaf.rotation.set(range(rng, -0.25, 0.25), rng() * Math.PI * 2, range(rng, -0.18, 0.18));
    leaf.scale.setScalar(range(rng, 0.6, 1.5));
    leaf.castShadow = true;
    group.add(leaf);
  };
  for (let i = 0; i < 130; i += 1) addLeaf();
  // В углах растительность гуще.
  for (let i = 0; i < 40; i += 1) addLeaf();

  // Трава: тонкие колосья.
  const bladeGeometry = new THREE.ConeGeometry(2.2, 26, 4);
  bladeGeometry.translate(0, 13, 0);
  const bladeMaterials = Array.from({length: 6}, () => greenMaterial(rng, 0.85));
  for (let i = 0; i < 80; i += 1) {
    const {x, z} = perimeterPoint(rng);
    const blade = new THREE.Mesh(bladeGeometry, bladeMaterials[Math.floor(rng() * bladeMaterials.length)]);
    blade.position.set(x, 0.4, z);
    blade.rotation.set(range(rng, -0.4, 0.4), rng() * Math.PI * 2, range(rng, -0.4, 0.4));
    blade.scale.set(range(rng, 0.7, 1.4), range(rng, 0.5, 1.5), range(rng, 0.7, 1.4));
    blade.castShadow = true;
    group.add(blade);
  }

  return group;
}

function greenMaterial(rng: Rng, roughness: number, side?: THREE.Side): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: greenColor(rng),
    roughness,
    metalness: 0,
    ...(side === undefined ? {} : {side}),
  });
}
