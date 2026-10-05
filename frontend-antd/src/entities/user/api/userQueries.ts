/** Properties of the `Users` entity set that may be used in `$filter`/`$orderby`. */
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
