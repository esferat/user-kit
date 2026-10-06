/** Свойства набора сущностей `Users`, которые можно использовать в `$filter`/`$orderby`. */
export const USER_QUERYABLE_PROPERTIES = [
  'id',
  'subject',
  'email',
  'displayName',
  'roles',
  'enabled',
  'createdAt',
  'updatedAt',
] as const;
