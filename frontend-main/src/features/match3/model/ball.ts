/** Обычный цветной шарик — базовый элемент поля. */
export class BallModel {
  readonly kind = 'ball' as const;

  constructor(readonly color: number) {}
}
