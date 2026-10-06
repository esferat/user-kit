/** Свойства набора сущностей `Files`, которые можно использовать в `$filter`/`$orderby`. */
export const FILE_QUERYABLE_PROPERTIES = [
  'id',
  'name',
  'description',
  'contentType',
  'sizeBytes',
  'ownerId',
  'ownerEmail',
  'createdAt',
  'updatedAt',
] as const;
