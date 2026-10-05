/** Properties of the `Files` entity set that may be used in `$filter`/`$orderby`. */
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
