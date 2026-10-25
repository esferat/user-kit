import * as THREE from 'three';

import {BALL_PALETTE} from './balls';
import {CAMERA_TILT_DEG, CELL_PITCH, GRID_SIZE, SCENE_HALF} from './constants';
import {EMPTY, findPath, type LinesState} from './engine';
import {createPlantFrame} from './plants';
import {makeRng} from './random';
import {createStoneTexture, createTileGeometry, createTileMaterial} from './tiles';

/**
 * Верхняя плоскость плитки в мировых координатах: глубина extrude (8) +
 * верхний bevel (1.4) + подъём геометрии над землёй (1.4).
 */
const TILE_TOP = 10.8;

/** Радиус игрового шара (клетка 100). */
const BALL_RADIUS = 38;

/** Радиус маленького шарика будущего броска. */
const SMALL_RADIUS = 15;

/** Скорость движения шара, мс на клетку. */
const MOVE_MS_PER_CELL = 90;

/** Длительность анимаций списания и появления, мс. */
const CLEAR_MS = 260;
const SPAWN_MS = 240;

/** Прыжок выделенного шара: период цикла, с, и высоты приседания/подлёта. */
const BOUNCE_PERIOD_S = 0.7;
const BOUNCE_CROUCH = 4;
const BOUNCE_HEIGHT = 22;

/**
 * Поле «Цветных линий» на three.js: сетка каменных плиток 10×10 с отступами
 * и обрамлением из растений. Вид сверху под лёгким углом.
 * Сцена живая: шарики, шарики будущего броска, выделение, анимации хода;
 * кадры рендерятся по запросу — пока анимаций нет, сцена статична.
 */
export class LinesBoard {
  private container: HTMLElement | null;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly resizeObserver: ResizeObserver;
  private readonly stoneTexture: THREE.CanvasTexture;
  private readonly onCellClick: ((cell: number) => void) | null;

  private readonly tiles: THREE.Mesh[] = [];
  private readonly ballGeometry: THREE.SphereGeometry;
  private readonly ballMaterials: THREE.MeshStandardMaterial[];
  private readonly dotGeometry: THREE.SphereGeometry;
  private readonly dotMaterials: THREE.MeshStandardMaterial[];
  private readonly footprintGeometry: THREE.CircleGeometry;
  /** Отпечатки под курсором игрока: акцентные, полупрозрачные. */
  private readonly footprintMaterial: THREE.MeshBasicMaterial;
  /** Подсказка: белые следы и метка, отдельные от маршрута игрока. */
  private readonly hintMaterial: THREE.MeshBasicMaterial;
  private readonly targetMarker: THREE.Mesh;
  /** Кольцо цели подсказки: видно, пока ничего не выделено. */
  private readonly hintMarker: THREE.Mesh;
  private readonly pathMeshes: THREE.Mesh[] = [];
  private readonly hintMeshes: THREE.Mesh[] = [];
  private readonly ring: THREE.Mesh;
  private readonly ballMeshes = new Map<number, THREE.Mesh>();
  private readonly dotMeshes = new Map<number, THREE.Mesh>();

  private readonly raycaster = new THREE.Raycaster();
  private animations: Array<() => boolean> = [];
  private rafId = 0;
  private selectedCell: number | null = null;
  private bounceTarget: THREE.Mesh | null = null;
  private bounceBaseY = 0;
  private bounceTime = 0;
  private lastBounceFrame = 0;
  private pointerCell: number | null = null;
  private hasBoardState = false;
  private currentBalls: number[] | null = null;

  constructor(container: HTMLElement, onCellClick?: (cell: number) => void) {
    this.container = container;
    this.onCellClick = onCellClick ?? null;

    this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.cursor = 'pointer';
    container.appendChild(canvas);
    canvas.addEventListener('pointerdown', this.handlePointer);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 10, 8000);

    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2e2a24, 1.1));
    const sun = new THREE.DirectionalLight(0xfff4e2, 2.6);
    sun.position.set(380, 760, 320);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 1.5;
    const shadowCamera = sun.shadow.camera;
    shadowCamera.left = -700;
    shadowCamera.right = 700;
    shadowCamera.top = 700;
    shadowCamera.bottom = -700;
    shadowCamera.near = 50;
    shadowCamera.far = 2600;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xa9c4ff, 0.6);
    fill.position.set(-460, 420, -300);
    this.scene.add(fill);

    // Плоскость-приёмник мягких теней поверх фона страницы (в промежутках между плитками).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(SCENE_HALF * 2.6, SCENE_HALF * 2.6),
      new THREE.ShadowMaterial({opacity: 0.38}),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Плитки: у каждой свой контур со сколами и свой материал; клик по клетке отдаёт её номер.
    this.stoneTexture = createStoneTexture();
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const rng = makeRng(1000 + (row * GRID_SIZE + col) * 7919);
        const mesh = new THREE.Mesh(createTileGeometry(rng), createTileMaterial(this.stoneTexture, rng));
        mesh.position.set(
          (col - (GRID_SIZE - 1) / 2) * CELL_PITCH,
          0,
          (row - (GRID_SIZE - 1) / 2) * CELL_PITCH,
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.cell = row * GRID_SIZE + col;
        this.tiles.push(mesh);
        this.scene.add(mesh);
      }
    }

    this.scene.add(createPlantFrame());

    // Шарики: общая геометрия и материал на каждый цвет палитры.
    this.ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 28, 20);
    this.ballMaterials = BALL_PALETTE.map(
      (color) =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color.main),
          roughness: 0.24,
          metalness: 0.06,
        }),
    );

    // Маленькие шарики будущего броска: утоплены в плитку и слегка светятся.
    this.dotGeometry = new THREE.SphereGeometry(SMALL_RADIUS, 20, 14);
    this.dotMaterials = BALL_PALETTE.map(
      (color) =>
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(color.main),
          emissive: new THREE.Color(color.main),
          emissiveIntensity: 0.4,
          roughness: 0.35,
        }),
    );

    // Отпечатки ног игрока: овальная «подошва», полупрозрачная, поверх плитки.
    // Акцентный жёлтый; toneMapped: false — иначе ACES-тонмаппинг выцветает цвет.
    this.footprintGeometry = new THREE.CircleGeometry(26, 20);
    this.footprintMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd43b,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    // Подсказка — белая, чтобы её не путать с акцентным маршрутом игрока.
    this.hintMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    // Метка конечной клетки маршрута игрока.
    this.targetMarker = new THREE.Mesh(
      new THREE.RingGeometry(30, 42, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffd43b,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.targetMarker.rotation.x = -Math.PI / 2;
    this.targetMarker.visible = false;
    this.scene.add(this.targetMarker);

    // Метка цели подсказки — белая, живёт отдельно от маршрута игрока.
    this.hintMarker = new THREE.Mesh(new THREE.RingGeometry(30, 42, 40), this.hintMaterial);
    this.hintMarker.rotation.x = -Math.PI / 2;
    this.hintMarker.visible = false;
    this.scene.add(this.hintMarker);

    // Кольцо выделения выбранного шара.
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(BALL_RADIUS + 6, BALL_RADIUS + 15, 40),
      new THREE.MeshBasicMaterial({
        color: 0xffe066,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    this.scene.add(this.ring);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  /**
   * Синхронизация сцены с моделью: шарики, шарики будущего броска, выделение и подсказка.
   * Подсказка (`hintPath`) рисуется белым маршрутом и гасится при любом выделении.
   */
  sync(
    balls: number[],
    nextCells: number[],
    nextColors: number[],
    selected: number | null,
    hintPath: number[] | null = null,
  ): void {
    // Игровые шарики: сначала убираем те, которых больше нет на доске (в том числе
    // только что списанные — их меши уже скрыты анимацией). Если создавать новые
    // шары раньше, они могут занять скрытый меш и остаться невидимыми.
    for (const [cell, mesh] of [...this.ballMeshes]) {
      const color = balls[cell];
      if (color !== undefined && color !== EMPTY) continue;
      this.scene.remove(mesh);
      this.ballMeshes.delete(cell);
    }
    for (let cell = 0; cell < balls.length; cell += 1) {
      if (balls[cell] === EMPTY) continue;
      this.ensureBall(cell, balls[cell]);
    }

    // Маленькие шарики будущего броска — только в пустых клетках, цвета как в панели «Дальше».
    const nextAlive = new Set<number>();
    for (let i = 0; i < nextCells.length; i += 1) {
      const color = nextColors[i];
      const cell = nextCells[i];
      if (color === undefined || balls[cell] !== EMPTY) continue;
      nextAlive.add(cell);
      this.ensureDot(cell, color);
    }
    for (const [cell, mesh] of [...this.dotMeshes]) {
      if (!nextAlive.has(cell)) {
        this.scene.remove(mesh);
        this.dotMeshes.delete(cell);
      }
    }

    // Выделение выбранного шара.
    this.ring.visible = selected !== null && this.ballMeshes.has(selected);
    if (selected !== null) {
      const pos = this.cellPosition(selected, TILE_TOP + 0.8);
      this.ring.position.set(pos.x, pos.y, pos.z);
    }
    this.selectedCell = selected;
    this.stopBounce();
    if (selected !== null) {
      const target = this.ballMeshes.get(selected);
      if (target) {
        this.bounceTarget = target;
        this.bounceBaseY = target.position.y;
        this.bounceTime = 0;
        this.lastBounceFrame = 0;
        this.scheduleFrame();
      }
    }

    // Сохраняем текущее состояние для построения маршрута и пересчитываем его.
    this.hasBoardState = true;
    this.currentBalls = balls.slice();
    this.targetMarker.visible = false;
    this.clearPathMeshes();
    if (selected !== null && this.pointerCell !== null) this.updatePath(this.pointerCell);

    // Подсказка видна, пока игрок не выбрал шар.
    this.setHint(selected === null ? hintPath : null);

    for (const [cell, mesh] of this.ballMeshes) {
      mesh.scale.setScalar(cell === selected ? 1.15 : 1);
    }

    this.render();
  }

  /**
   * Ведёт шар по маршруту клеток (вертикально и горизонтально).
   * `onStep` вызывается на каждую клетку пути — под звук шагов.
   */
  animateMove(path: number[], onStep?: (index: number) => void): Promise<void> {
    const mesh = path.length > 1 ? this.ballMeshes.get(path[0]) : undefined;
    if (!mesh) return Promise.resolve();
    this.stopBounce(); // шар едет — прыжок мешает
    this.clearHint(); // подсказка гаснет вместе с началом хода
    this.targetMarker.visible = false;
    this.clearPathMeshes();
    this.pointerCell = null;
    this.ring.visible = false; // кольцо не должно отставать от шара
    const points = path.map((cell) => this.cellPosition(cell, mesh.position.y));
    const last = path[path.length - 1];
    const lastIndex = path.length - 1;
    let stepped = 0;
    onStep?.(0); // отталкивание с исходной клетки
    return this.animate(MOVE_MS_PER_CELL * lastIndex, (t) => {
      const eased = t * t * (3 - 2 * t); // плавный разгон и торможение
      const f = eased * (points.length - 1);
      const i = Math.min(points.length - 2, Math.floor(f));
      mesh.position.lerpVectors(points[i], points[i + 1], f - i);
      // Кадр может «перескочить» сразу через клетку — озвучиваем все пропущенные шаги.
      while (stepped < i) {
        stepped += 1;
        onStep?.(stepped);
      }
    }).then(() => {
      mesh.position.copy(points[points.length - 1]);
      // Маппинг шара перекладывается в конечную клетку — состояние модели ещё старое.
      this.ballMeshes.delete(path[0]);
      this.ballMeshes.set(last, mesh);
      // И луч тоже должен попадать в конечную клетку, иначе после хода шар
      // кликается по старому индексу и его нельзя снова выбрать.
      mesh.userData.cell = last;
      if (stepped < lastIndex) onStep?.(lastIndex); // шаг на конечную клетку
    });
  }

  /** Списание шаров: сжатие с лёгким поворотом. */
  animateClear(cells: number[]): Promise<void> {
    const meshes = cells.flatMap((cell) => this.ballMeshes.get(cell) ?? []);
    if (meshes.length === 0) return Promise.resolve();
    return this.animate(CLEAR_MS, (t) => {
      for (const mesh of meshes) {
        mesh.scale.setScalar(1 - t);
        mesh.rotation.y = t * Math.PI * 0.5;
      }
    }).then(() => {
      for (const mesh of meshes) mesh.visible = false;
    });
  }

  /** Появление новых шаров: всплывание с лёгким перелётом. */
  animateSpawn(cells: number[]): Promise<void> {
    const meshes = cells.flatMap((cell) => this.ballMeshes.get(cell) ?? []);
    if (meshes.length === 0) return Promise.resolve();
    for (const mesh of meshes) {
      mesh.scale.setScalar(0);
      mesh.visible = true;
    }
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return this.animate(SPAWN_MS, (t) => {
      const e = t - 1; // back-out: 0 → 1 с небольшим перелётом
      const s = 1 + c3 * e * e * e + c1 * e * e;
      for (const mesh of meshes) mesh.scale.setScalar(s);
    }).then(() => {
      for (const mesh of meshes) mesh.scale.setScalar(1);
    });
  }

  /** Клик по холсту → номер клетки (луч попадает в плитку или шар). */
  private handlePointer = (event: PointerEvent): void => {
    if (!this.onCellClick) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const targets: THREE.Object3D[] = [...this.tiles, ...this.ballMeshes.values()];
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    const cell = hit?.object.userData.cell as number | undefined;
    if (typeof cell === 'number') this.onCellClick(cell);
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.container || !this.hasBoardState || !this.currentBalls) return;
    if (this.animations.length > 0) return; // во время хода маршрут не строим
    const rect = this.container.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hit = this.raycaster.intersectObjects([...this.tiles, ...this.ballMeshes.values()], false)[0];
    const cell = hit?.object.userData.cell as number | undefined;
    const nextCell = typeof cell === 'number' ? cell : null;
    if (nextCell === this.pointerCell) return;
    this.pointerCell = nextCell;
    if (this.selectedCell === null || nextCell === null) {
      this.clearPathMeshes();
      this.targetMarker.visible = false;
      this.render();
      return;
    }
    this.updatePath(nextCell);
    this.render();
  };

  private handlePointerLeave = () => {
    if (this.pointerCell === null) return;
    this.pointerCell = null;
    this.clearPathMeshes();
    this.targetMarker.visible = false;
    this.render();
  };

  private ensureBall(cell: number, color: number): THREE.Mesh {
    const existing = this.ballMeshes.get(cell);
    if (existing) {
      // Меш мог остаться от списанного шара: возвращаем его в строй.
      existing.visible = true;
      existing.rotation.y = 0;
      existing.material = this.ballMaterials[color];
      // Инвариант: луч попадает в клетку, в которой лежит меш.
      existing.userData.cell = cell;
      return existing;
    }
    const mesh = new THREE.Mesh(this.ballGeometry, this.ballMaterials[color]);
    mesh.position.copy(this.cellPosition(cell, TILE_TOP + BALL_RADIUS * 0.72));
    mesh.castShadow = true;
    mesh.userData.cell = cell;
    this.scene.add(mesh);
    this.ballMeshes.set(cell, mesh);
    return mesh;
  }

  private ensureDot(cell: number, color: number): THREE.Mesh {
    const existing = this.dotMeshes.get(cell);
    if (existing) return existing;
    const mesh = new THREE.Mesh(this.dotGeometry, this.dotMaterials[color]);
    mesh.position.copy(this.cellPosition(cell, TILE_TOP - 4));
    mesh.castShadow = true;
    mesh.userData.cell = cell;
    this.scene.add(mesh);
    this.dotMeshes.set(cell, mesh);
    return mesh;
  }

  /** Мировая позиция центра клетки на заданной высоте. */
  private cellPosition(cell: number, y: number): THREE.Vector3 {
    const row = Math.floor(cell / GRID_SIZE);
    const col = cell % GRID_SIZE;
    return new THREE.Vector3(
      (col - (GRID_SIZE - 1) / 2) * CELL_PITCH,
      y,
      (row - (GRID_SIZE - 1) / 2) * CELL_PITCH,
    );
  }

  /** Пошаговая анимация: держит цикл перерисовки, пока есть активные анимации. */
  private animate(duration: number, step: (t: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / duration);
        step(t);
        if (t >= 1) {
          resolve();
          return false;
        }
        return true;
      };
      this.animations.push(tick);
      this.scheduleFrame();
    });
  }

  private stopBounce(): void {
    if (this.bounceTarget) {
      this.bounceTarget.position.y = this.bounceBaseY;
      this.bounceTarget.scale.setScalar(1);
    }
    this.bounceTarget = null;
    this.bounceTime = 0;
    this.lastBounceFrame = 0;
  }

  /** Циклическое подпрыгивание выделенного шара: приседание и прыжок вверх. */
  private updateBounce(): void {
    const mesh = this.bounceTarget;
    if (!mesh) return;
    const now = performance.now();
    if (this.lastBounceFrame !== 0) this.bounceTime += (now - this.lastBounceFrame) / 1000;
    this.lastBounceFrame = now;

    const period = BOUNCE_PERIOD_S;
    const phase = (this.bounceTime % period) / period;
    // Первая половина цикла — приседание, вторая — прыжок с инерцией.
    let lift: number;
    if (phase < 0.4) {
      const t = phase / 0.4;
      lift = -Math.sin(t * Math.PI) * BOUNCE_CROUCH;
    } else {
      const t = (phase - 0.4) / 0.6;
      lift = Math.sin(t * Math.PI) * BOUNCE_HEIGHT;
    }
    mesh.position.y = this.bounceBaseY + lift;
    if (lift < 0) {
      // Приседание: шар приплюснут и шире.
      const squeeze = 1 + lift / 60;
      mesh.scale.set(1.15 * (1 + (squeeze - 1) * 0.5), 1.15 * squeeze, 1.15 * (1 + (squeeze - 1) * 0.5));
    } else {
      mesh.scale.setScalar(1.15);
    }
  }

  /** Планирует кадр: один rAF на все активные анимации. */
  private scheduleFrame(): void {
    if (this.rafId !== 0) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.animations = this.animations.filter((tick) => tick());
      this.updateBounce();
      this.render();
      if (this.animations.length > 0 || this.bounceTarget !== null) this.scheduleFrame();
    });
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** Размер холста равен контейнеру; камера подгоняется так, чтобы поле помещалось целиком. */
  private resize(): void {
    const width = this.container?.clientWidth ?? 0;
    const height = this.container?.clientHeight ?? 0;
    if (width < 2 || height < 2) return;

    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.fitCamera();
    this.render();
  }

  /** Ставит камеру над центром поля с наклоном и на таком расстоянии, чтобы видеть всю сцену. */
  private fitCamera(): void {
    const tilt = THREE.MathUtils.degToRad(CAMERA_TILT_DEG);
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const span = SCENE_HALF * 2;
    const margin = 1.06;

    // Спроектированная высота сцены при наклоне + запас на перспективу переднего края.
    const vertical = ((span * Math.cos(tilt)) / 2) * margin;
    const horizontal = (span / 2) * margin;
    let distance = Math.max(
      vertical / Math.tan(fov / 2),
      horizontal / (Math.tan(fov / 2) * this.camera.aspect),
    );
    distance *= distance / Math.max(distance - SCENE_HALF * Math.sin(tilt), distance * 0.5);

    this.camera.position.set(0, distance * Math.cos(tilt), distance * Math.sin(tilt));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Строит маршрут от выделенного шара до `target` отпечатками ног.
   * Это предпросмотр под курсором: ход выполняется сразу по клику, подтверждать его не нужно.
   * Возвращает false, если пути нет.
   */
  private updatePath(target: number): boolean {
    this.clearPathMeshes();
    this.targetMarker.visible = false;
    const from = this.selectedCell;
    if (from === null || !this.currentBalls || !this.hasBoardState) return false;
    if (this.currentBalls[from] === EMPTY || this.currentBalls[target] !== EMPTY) return false;
    const path = findPath({size: GRID_SIZE, board: this.currentBalls} as LinesState, from, target);
    if (!path || path.length < 2) return false;
    // Старт под шаром не показываем, финиш отмечается кольцом.
    this.pathMeshes.push(...this.drawFootprints(path, false, this.footprintMaterial));
    const pos = this.cellPosition(path[path.length - 1], TILE_TOP + 0.7);
    this.targetMarker.position.set(pos.x, pos.y, pos.z);
    this.targetMarker.visible = true;
    return true;
  }

  /**
   * Подсказка: белый маршрут полезного хода плюс кольцо на целевой клетке.
   * `path` — маршрут шара; старт под шаром не показываем.
   */
  private setHint(path: number[] | null): void {
    this.clearHint();
    if (!path || path.length < 2) return;
    for (const mesh of this.drawFootprints(path, true, this.hintMaterial)) {
      this.hintMeshes.push(mesh);
    }
    const last = path[path.length - 1];
    const pos = this.cellPosition(last, TILE_TOP + 0.7);
    this.hintMarker.position.set(pos.x, pos.y, pos.z);
    this.hintMarker.visible = true;
  }

  private clearHint(): void {
    // Геометрия и материал отпечатков общие — убираем меши только из сцены.
    for (const mesh of this.hintMeshes) this.scene.remove(mesh);
    this.hintMeshes.length = 0;
    this.hintMarker.visible = false;
  }

  /** Следы ног по маршруту: овалы со смещением влево/вправо и поворотом по шагу. */
  private drawFootprints(
    path: number[],
    includeTarget: boolean,
    material: THREE.MeshBasicMaterial,
  ): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (let i = 1; i < path.length - (includeTarget ? 0 : 1); i += 1) {
      const cell = path[i];
      const pos = this.cellPosition(cell, TILE_TOP + 0.6);
      const mesh = new THREE.Mesh(this.footprintGeometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.scale.set(0.7, 1.2, 1); // овал — след ноги

      // Лёгкое смещение влево/вправо и поворот по направлению шага.
      const prev = path[i - 1];
      const dr = Math.floor(cell / GRID_SIZE) - Math.floor(prev / GRID_SIZE);
      const dc = (cell % GRID_SIZE) - (prev % GRID_SIZE);
      const angle = Math.atan2(dc, dr);
      mesh.rotation.z = -angle;
      const side = i % 2 === 0 ? 6 : -6;
      mesh.position.set(pos.x + Math.cos(angle) * side, pos.y, pos.z - Math.sin(angle) * side);

      this.scene.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }

  private clearPathMeshes(): void {
    // Геометрия общая для всех отпечатков — удаляем только из сцены.
    for (const mesh of this.pathMeshes) this.scene.remove(mesh);
    this.pathMeshes.length = 0;
  }

  /** Освобождает WebGL-ресурсы и убирает canvas из контейнера. */
  dispose(): void {
    if (this.rafId !== 0) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.animations = [];
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointer);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    this.clearPathMeshes();
    this.clearHint();
    this.resizeObserver.disconnect();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const map = (material as THREE.MeshStandardMaterial).map;
        map?.dispose();
        material.dispose();
      }
    });
    this.stoneTexture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.container = null;
  }
}
