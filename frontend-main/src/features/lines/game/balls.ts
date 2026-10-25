/** Цвет шара: три составляющие для радиального градиента «стеклянного» шарика. */
export interface BallColor {
  main: string;
  light: string;
  dark: string;
}

/** Палитра шаров: сложность использует первые N цветов (индексы палитры хранит движок). */
export const BALL_PALETTE: BallColor[] = [
  { main: '#e5484d', light: '#ff8a8e', dark: '#8f1d22' }, // красный
  { main: '#4dabf7', light: '#a5d8ff', dark: '#1f5fae' }, // синий
  { main: '#51cf66', light: '#b2f2bb', dark: '#237a35' }, // зелёный
  { main: '#ffd43b', light: '#ffec99', dark: '#a8790a' }, // жёлтый
  { main: '#cc5de8', light: '#eebefa', dark: '#703087' }, // фиолетовый
];
