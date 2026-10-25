import { BallModel } from './ball';
import { BombModel } from './bomb';
import { LightningModel } from './lightning';
import { RainbowModel } from './rainbow';

/** Любая модель, которая может лежать в клетке поля. */
export type CellModel = BallModel | BombModel | LightningModel | RainbowModel;

/**
 * Цвет, которым элемент участвует в совпадениях.
 * У радужного элемента своего цвета нет — возвращает `null`.
 */
export function cellColor(cell: CellModel): number | null {
  return cell.kind === 'rainbow' ? null : cell.color;
}
