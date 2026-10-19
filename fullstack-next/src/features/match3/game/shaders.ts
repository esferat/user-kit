import { BALL_RADIUS, GRID_SIZE, TILE_SIZE } from './constants';

let shaderSeq = 0;

/**
 * Счётчик имён шейдеров: имя попадает в имя шейдерной программы,
 * а каждому объекту нужна своя программа — uniform'ы у них разные.
 */
export function nextShaderName(base: string): string {
  shaderSeq += 1;
  return `${base}-${shaderSeq}`;
}

/** Длительность эффекта разряда (шейдер гаснет сам к 400 мс, объект удаляется позже). */
export const STRIKE_DURATION_MS = 420;

/**
 * Фрагментный шейдер плитки-бомбы. Тёмный корпус с ободком цвета
 * совпадения и раскалённым пульсирующим ядром, а над ядром — живой
 * огонь: шумовые языки поднимаются вверх, конус сужается и рассеивается,
 * от ядра отрываются искры-угольки. Фаза сдвинута на `uSeed` — пламя
 * разных бомб горит независимо. Координаты — пиксели плитки, цвет
 * выводится в предмножительном виде (блендинг ONE).
 */
export const BOMB_TILE_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 outTexCoord;

uniform vec3 uColor;
uniform float uTime;
uniform float uAlpha;
uniform float uSeed;

float hash2(vec2 x) {
  return fract(sin(dot(x, vec2(127.1, 311.7)) + uSeed * 47.3) * 43758.5453123);
}

float vnoise2(vec2 x) {
  vec2 i = floor(x);
  vec2 f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x),
    mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 x) {
  float v = 0.0;
  float amp = 0.55;
  for (int i = 0; i < 4; i++) {
    v += amp * vnoise2(x);
    x *= 2.03;
    amp *= 0.5;
  }
  return v;
}

void layer(inout vec3 col, inout float a, vec3 color, float alpha) {
  alpha = clamp(alpha, 0.0, 1.0);
  col = color * alpha + col * (1.0 - alpha);
  a = alpha + a * (1.0 - alpha);
}

// Пламя: тёмно-красный → оранжево-жёлтый → белый.
vec3 fireColor(float i) {
  vec3 c = mix(vec3(0.4, 0.02, 0.0), vec3(1.0, 0.3, 0.03), smoothstep(0.0, 0.45, i));
  c = mix(c, vec3(1.0, 0.72, 0.2), smoothstep(0.45, 0.8, i));
  c = mix(c, vec3(1.0, 0.98, 0.85), smoothstep(0.8, 1.0, i));
  return c;
}

void main() {
  float size = ${TILE_SIZE}.0;
  float radius = ${BALL_RADIUS}.0;
  float t = uTime + uSeed;
  vec2 p = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * size;
  vec2 center = vec2(size * 0.5);
  vec2 rel = p - center;
  float d = length(rel);

  vec3 col = vec3(0.0);
  float a = 0.0;

  // Дышащий ореол цвета совпадения и тёмный корпус.
  layer(
    col, a, uColor,
    (0.1 + 0.04 * sin(t * 4.0)) * (1.0 - smoothstep(radius + 5.0, radius + 6.0, d))
  );
  layer(col, a, vec3(0.18, 0.2, 0.25), 1.0 - smoothstep(radius - 1.0, radius, d));
  // Тень корпуса снизу-справа.
  layer(
    col, a, vec3(0.08, 0.09, 0.12),
    0.5 * (1.0 - smoothstep(radius * 0.7 - 1.0, radius * 0.7, length(rel - vec2(4.0, 5.0))))
  );
  // Ободок цвета совпадения.
  layer(col, a, uColor * 0.6 + 0.4, 0.8 * (1.0 - smoothstep(0.4, 1.3, abs(d - (radius - 0.5)))));

  // Раскалённое ядро: красное свечение и горячая сердцевина дышат.
  float breath = 0.5 + 0.5 * sin(t * 6.0);
  layer(
    col, a, vec3(1.0, 0.3, 0.3),
    (0.16 + 0.1 * breath) * (1.0 - smoothstep(radius * 0.62 - 2.0, radius * 0.62, d))
  );
  float coreR = radius * (0.3 + 0.04 * sin(t * 6.0 + 1.0));
  layer(col, a, vec3(1.0, 0.42, 0.42), 0.9 * (1.0 - smoothstep(coreR - 1.2, coreR, d)));
  // Блик на корпусе.
  layer(
    col, a, vec3(1.0),
    0.85 * (1.0 - smoothstep(radius * 0.1 - 0.6, radius * 0.1, length(rel - vec2(-9.6, -10.9))))
  );

  // Пламя: шум идёт вверх, языки сужаются кверху и рассеиваются к краям.
  float rise = fbm(vec2(rel.x * 0.055, (rel.y + t * 46.0) * 0.055));
  float upH = clamp(-rel.y / 30.0, 0.0, 1.0);
  float width = 13.0 * (1.0 - upH * 0.8) + 2.0;
  float axis = 1.0 - smoothstep(0.0, width, abs(rel.x + (rise - 0.5) * 18.0 * upH));
  float below = 1.0 - smoothstep(-2.0, 4.0, rel.y);
  float flame = axis * (1.0 - upH * 0.85) * smoothstep(0.25, 0.75, rise) * below;
  layer(col, a, fireColor(clamp(flame * 1.3, 0.0, 1.0)), smoothstep(0.08, 0.55, flame) * 0.92);

  // Искры-угольки отрываются от ядра, поднимаются и гаснут.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float life = fract(t * (0.5 + fi * 0.17) + fi * 0.41);
    vec2 sp = center + vec2(
      sin((life * 8.0 + fi * 2.3) * 2.0) * (4.0 + life * 8.0),
      8.0 - life * 38.0
    );
    float bright = (1.0 - life) * (0.5 + 0.5 * sin(t * 22.0 + fi * 5.0));
    layer(
      col, a, mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.9, 0.4), life),
      bright * (1.0 - smoothstep(0.7, 1.7, length(p - sp)))
    );
  }

  gl_FragColor = vec4(col * uAlpha, a * uAlpha);
}
`;

/**
 * Фрагментный шейдер плитки-радужного элемента. Тёмное тело и шесть
 * колец, которые живут своей жизнью: цвета плавно закручиваются по
 * радуге, кольца дышат волной от центра к краю, от пульсирующего
 * жемчужного ядра расходится волна энергии, а искра-блик обходит
 * по кругу. Фаза каждого элемента сдвинута на `uSeed` — пульсации
 * разных радужных не синхронны. Координаты — пиксели плитки, цвет
 * выводится в предмножительном виде (блендинг ONE).
 */
export const RAINBOW_TILE_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 outTexCoord;

uniform float uTime;
uniform float uAlpha;
uniform float uSeed;

vec3 hue2rgb(float h) {
  vec3 p = abs(fract(h + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return clamp(p - 1.0, 0.0, 1.0);
}

// Слой поверх: обычный альфа-овер поверх уже нарисованного.
void layer(inout vec3 col, inout float a, vec3 color, float alpha) {
  alpha = clamp(alpha, 0.0, 1.0);
  col = color * alpha + col * (1.0 - alpha);
  a = alpha + a * (1.0 - alpha);
}

void main() {
  float size = ${TILE_SIZE}.0;
  float radius = ${BALL_RADIUS}.0;
  float t = uTime + uSeed;
  vec2 p = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * size;
  vec2 center = vec2(size * 0.5);
  float d = length(p - center);

  vec3 col = vec3(0.0);
  float a = 0.0;

  // Дышащий ореол и тёмное тело.
  layer(
    col, a, vec3(1.0),
    (0.07 + 0.04 * sin(t * 4.0)) * (1.0 - smoothstep(radius + 5.0, radius + 6.0, d))
  );
  layer(col, a, vec3(0.137, 0.157, 0.2), 1.0 - smoothstep(radius - 1.0, radius, d));

  // Шесть колец: цвет плавно закручивается по радуге, кольца дышат волной.
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float ringR = radius - 2.5 - fi * 5.0 + 1.2 * sin(t * 2.0 - fi * 0.7);
    float width = 3.2 + 0.6 * sin(t * 3.0 + fi);
    vec3 ringColor = hue2rgb(fract(fi / 6.0 + t * 0.083 + 0.58));
    layer(
      col, a, ringColor,
      (1.0 - smoothstep(width * 0.5, width * 0.5 + 1.0, abs(d - ringR))) * 0.95
    );
  }

  // Волна энергии идёт от ядра к краю.
  float wave = fract(t * 0.55);
  float waveR = wave * (radius - 2.0);
  layer(
    col, a, vec3(1.0),
    (1.0 - smoothstep(1.2, 3.5, abs(d - waveR))) * 0.3 * (1.0 - wave) * smoothstep(0.0, 0.12, wave)
  );

  // Искра-блик обходит по кругу.
  vec2 glint = center + vec2(cos(t * 1.7), sin(t * 1.7)) * radius * 0.52;
  layer(
    col, a, vec3(1.0),
    (0.3 + 0.4 * (0.5 + 0.5 * sin(t * 5.0))) * (1.0 - smoothstep(1.5, 2.6, length(p - glint)))
  );

  // Жемчужное ядро пульсирует.
  float coreR = radius * (0.16 + 0.035 * sin(t * 6.0));
  layer(col, a, vec3(1.0), 0.95 * (1.0 - smoothstep(coreR - 0.7, coreR, d)));

  // Ободок.
  layer(
    col, a, vec3(1.0),
    (0.35 + 0.15 * sin(t * 4.0)) * (1.0 - smoothstep(0.4, 1.3, abs(d - (radius - 0.5))))
  );

  gl_FragColor = vec4(col * uAlpha, a * uAlpha);
}
`;

/**
 * Фрагментный шейдер плитки-молнии. Кристалл своего цвета (раскладка
 * как у Graphics-версии `drawCrystal`), а поверх — живая молния, которая
 * проходит ровно по линии списания: горизонтально для строки, вертикально
 * для столбца. Форма ломаной пересчитывается тиками (~9 раз/с), яркость
 * мерцает, иногда проходит вспышка; по краям пульсируют пары стрелок-шевронов,
 * показывающих направление. Координаты — пиксели плитки, начало сверху слева.
 * Цвет выводится в предмножительном виде (блендинг ONE).
 */
export const LIGHTNING_TILE_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 outTexCoord;

uniform vec3 uColor;
uniform float uOrientation;
uniform float uTime;
uniform float uAlpha;
uniform float uSeed;

float hash(float n) {
  return fract(sin(n * 91.7 + uSeed * 47.3) * 43758.5453123);
}

float vnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), u);
}

// Слой поверх: обычный альфа-овер поверх уже нарисованного. Слои корректно
// ложатся на непрозрачный кристалл — молния и стрелки видны поверх шарика.
void layer(inout vec3 col, inout float a, vec3 color, float alpha) {
  alpha = clamp(alpha, 0.0, 1.0);
  col = color * alpha + col * (1.0 - alpha);
  a = alpha + a * (1.0 - alpha);
}

// Расстояние до отрезка.
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  float size = ${TILE_SIZE}.0;
  float radius = ${BALL_RADIUS}.0;
  vec2 p = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * size;
  vec2 center = vec2(size * 0.5);
  float mid = size * 0.5;
  float d = length(p - center);

  bool row = uOrientation < 0.5;

  vec3 col = vec3(0.0);
  float a = 0.0;

  // Кристалл: дышащий ореол, тело, тень, блик, искра и ободок.
  layer(
    col, a, uColor,
    (0.09 + 0.05 * sin(uTime * 3.0 + uSeed * 2.0))
      * (1.0 - smoothstep(radius + 5.0, radius + 6.0, d))
  );
  layer(col, a, uColor, 1.0 - smoothstep(radius - 1.0, radius, d));
  layer(
    col, a, uColor * 0.45,
    0.35 * (1.0 - smoothstep(radius * 0.85 - 0.8, radius * 0.85, length(p - (center + vec2(3.8, 4.5)))))
  );
  layer(
    col, a, uColor * 0.45 + 0.55,
    0.45 * (1.0 - smoothstep(radius * 0.42 - 0.8, radius * 0.42, length(p - (center - vec2(9.0, 9.6)))))
  );
  layer(
    col, a, vec3(1.0),
    0.9 * (1.0 - smoothstep(radius * 0.14 - 0.6, radius * 0.14, length(p - (center - vec2(12.2, 13.4)))))
  );
  layer(
    col, a, uColor * 0.75 + 0.25,
    0.55 * (1.0 - smoothstep(0.35, 0.75, abs(d - (radius - 0.5))))
  );

  // Молния строго по линии списания: ломаная из семи узлов идёт от края
  // до края плитки (узлы у краёв прижаты к оси — разряд захватывает всю
  // линию), размах сильнее в центре. Форма меняется тиками ~9 раз/с.
  float tick = floor(uTime * 9.0);
  float flick = 0.62 + 0.38 * hash(tick * 1.37);
  float surge = smoothstep(0.55, 0.9, vnoise(uTime * 2.6 + uSeed * 13.0));
  float energy = min(flick + surge * 0.7, 1.6);
  float boltDist = 1e5;
  vec2 prev = row ? vec2(0.0, mid) : vec2(mid, 0.0);
  for (int i = 1; i <= 6; i++) {
    float t = float(i) / 6.0;
    float amp = sin(t * 3.14159) * 24.0;
    float jitter = (vnoise(float(i) * 1.7 + tick * 3.7 + uSeed * 5.0) - 0.5) * amp;
    vec2 node = row ? vec2(t * size, mid + jitter) : vec2(mid + jitter, t * size);
    boltDist = min(boltDist, segDist(p, prev, node));
    prev = node;
  }
  layer(col, a, uColor * 0.35 + 0.65, (1.0 - smoothstep(4.0, 12.0, boltDist)) * 0.4 * energy);
  layer(col, a, vec3(0.62, 0.85, 1.0), (1.0 - smoothstep(1.8, 5.5, boltDist)) * 0.75 * energy);
  layer(col, a, vec3(1.0), (1.0 - smoothstep(0.5, 1.8, boltDist)) * energy);

  // Стрелки направления: по два шеврона с каждой стороны линии, они по
  // очереди вспыхивают и чуть едут наружу — читается, что спишется именно
  // этот ряд или столбец.
  vec3 arrowColor = vec3(0.72, 0.9, 1.0);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float pulse = 0.5 + 0.5 * sin((uTime * 2.2 - fi * 0.6) * 6.28318 + uSeed);
    pulse *= pulse;
    float off = 23.0 + fi * 11.0 + pulse * 3.0;
    for (int s = 0; s < 2; s++) {
      float sideS = float(s) * 2.0 - 1.0;
      vec2 tip = row ? vec2(mid + sideS * off, mid) : vec2(mid, mid + sideS * off);
      vec2 back = row ? vec2(-sideS * 8.0, 0.0) : vec2(0.0, -sideS * 8.0);
      vec2 spread = row ? vec2(0.0, 6.5) : vec2(6.5, 0.0);
      float arrowDist = min(
        segDist(p, tip, tip + back + spread),
        segDist(p, tip, tip + back - spread)
      );
      layer(col, a, arrowColor, (1.0 - smoothstep(0.6, 2.0, arrowDist)) * 0.85 * pulse);
      layer(col, a, uColor * 0.3 + 0.7, (1.0 - smoothstep(1.8, 5.5, arrowDist)) * 0.3 * pulse);
    }
  }

  gl_FragColor = vec4(col * uAlpha, a * uAlpha);
}
`;

/**
 * Фрагментный шейдер разряда молнии по линии: процедурная ломаная
 * вдоль строки или столбца с многооктавным изгибом, мерцанием новой
 * формы каждые ~45 мс, широким голубым свечением, полутоном, белым
 * ядром и вспышкой по ячейкам линии. Огибающая считается из uTime,
 * поэтому объект достаточно создать и удалить — твины не нужны.
 */
export const LIGHTNING_STRIKE_FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

varying vec2 outTexCoord;

uniform float uOrientation;
uniform float uLine;
uniform float uTime;
uniform float uSeed;

float hash(float n) {
  return fract(sin(n * 127.1 + uSeed * 91.7) * 43758.5453123);
}

float vnoise(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), u);
}

void layer(inout vec3 col, inout float a, vec3 color, float alpha) {
  alpha = clamp(alpha, 0.0, 1.0);
  col = color * alpha + col * (1.0 - alpha);
  a = alpha + a * (1.0 - alpha);
}

void main() {
  float board = ${GRID_SIZE * TILE_SIZE}.0;
  vec2 p = vec2(outTexCoord.x, 1.0 - outTexCoord.y) * board;
  bool isRow = uOrientation < 0.5;
  float axis = isRow ? p.x : p.y;
  float offset = (isRow ? p.y : p.x) - uLine * board;

  // Огибающая удара: быстрый всплеск, короткая пауза, затухание.
  float env = smoothstep(0.0, 0.05, uTime) * (1.0 - smoothstep(0.14, 0.40, uTime));
  // Мерцание: новая форма ломаной каждые ~45 мс.
  float tick = floor(uTime * 22.0);
  float flick = 0.72 + 0.28 * hash(tick * 1.37);

  // Изгиб: два октава шума, концы закреплены у краёв доски.
  float ends = smoothstep(0.0, 70.0, axis) * smoothstep(0.0, 70.0, board - axis);
  float jitter = ((vnoise(axis * 0.013 + tick * 7.31) - 0.5) * 46.0
    + (vnoise(axis * 0.052 + tick * 3.7) - 0.5) * 14.0) * ends;
  float d = abs(offset - jitter);

  vec3 col = vec3(0.0);
  float a = 0.0;
  // Вспышка по ячейкам линии: полоса шириной в клетку.
  layer(col, a, vec3(0.75, 0.90, 1.0), (1.0 - smoothstep(8.0, 38.0, abs(offset))) * 0.34 * env * flick);
  // Голубое свечение, полутон и белое ядро разряда.
  layer(col, a, vec3(0.30, 0.65, 1.0), exp(-d * d / 520.0) * 0.55 * env * flick);
  layer(col, a, vec3(0.62, 0.85, 1.0), exp(-d * d / 90.0) * 0.80 * env);
  layer(col, a, vec3(1.0), (1.0 - smoothstep(0.6, 2.6, d)) * env);

  gl_FragColor = vec4(col, a);
}
`;
