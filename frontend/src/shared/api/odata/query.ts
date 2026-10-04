export type ODataLiteral = string | number | boolean | null;

export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le';

/** Mirrors the functions supported by the backend filter parser. */
export type StringFunction = 'contains' | 'startswith' | 'endswith';

export interface ComparisonFilter {
  kind: 'comparison';
  property: string;
  operator: ComparisonOperator;
  value: ODataLiteral;
}

export interface InFilter {
  kind: 'in';
  property: string;
  values: ODataLiteral[];
}

export interface FunctionFilter {
  kind: 'function';
  name: StringFunction;
  property: string;
  value: string;
}

export interface AndFilter {
  kind: 'and';
  operands: FilterNode[];
}

export interface OrFilter {
  kind: 'or';
  operands: FilterNode[];
}

export interface NotFilter {
  kind: 'not';
  operand: FilterNode;
}

export type FilterNode = ComparisonFilter | InFilter | FunctionFilter | AndFilter | OrFilter | NotFilter;

export interface OrderByItem {
  property: string;
  descending?: boolean;
}

export interface ODataQuery {
  filter?: FilterNode;
  select?: string[];
  orderBy?: OrderByItem[];
  top?: number;
  skip?: number;
  count?: boolean;
  expand?: string[];
}

export class ODataQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ODataQueryError';
  }
}

const PROPERTY_NAME = /^[A-Za-z_]\w*$/;

export function isFilterNode(value: unknown): value is FilterNode {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const kind = (value as { kind?: unknown }).kind;
  return (
    kind === 'comparison' || kind === 'in' || kind === 'function' || kind === 'and' || kind === 'or' || kind === 'not'
  );
}

export function assertProperty(property: string, allowedProperties?: readonly string[]): string {
  if (!PROPERTY_NAME.test(property)) {
    throw new ODataQueryError(`Invalid property name: "${property}"`);
  }
  if (allowedProperties && !allowedProperties.includes(property)) {
    throw new ODataQueryError(`Property "${property}" is not queryable on this entity set`);
  }
  return property;
}

export function formatLiteral(value: ODataLiteral): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ODataQueryError(`Unsupported numeric literal: ${value}`);
    }
    return String(value);
  }
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "''");
  return `'${escaped}'`;
}

function formatLogical(
  node: AndFilter | OrFilter,
  operator: 'and' | 'or',
  allowedProperties?: readonly string[],
): string {
  const operands = node.operands;
  if (operands.length === 0) {
    throw new ODataQueryError(`"${operator}" requires at least one operand`);
  }
  const separator = ' ' + operator + ' ';
  const formatted = operands.map((operand) => formatFilter(operand, allowedProperties)).join(separator);
  return `(${formatted})`;
}

export function formatFilter(node: FilterNode, allowedProperties?: readonly string[]): string {
  if (!isFilterNode(node)) {
    throw new ODataQueryError('Unsupported $filter node');
  }

  switch (node.kind) {
    case 'comparison':
      return `${assertProperty(node.property, allowedProperties)} ${node.operator} ${formatLiteral(node.value)}`;
    case 'in': {
      if (node.values.length === 0) {
        throw new ODataQueryError('"in" requires at least one value');
      }
      const literals = node.values.map(formatLiteral).join(',');
      return `${assertProperty(node.property, allowedProperties)} in (${literals})`;
    }
    case 'function':
      return `${node.name}(${assertProperty(node.property, allowedProperties)},${formatLiteral(node.value)})`;
    case 'and':
      return formatLogical(node, 'and', allowedProperties);
    case 'or':
      return formatLogical(node, 'or', allowedProperties);
    case 'not':
      return `not (${formatFilter(node.operand, allowedProperties)})`;
  }
}

function formatOrderBy(orderBy: OrderByItem[], allowedProperties?: readonly string[]): string {
  if (orderBy.length === 0) {
    throw new ODataQueryError('$orderby requires at least one item');
  }
  return orderBy
    .map((item) => `${assertProperty(item.property, allowedProperties)}${item.descending ? ' desc' : ' asc'}`)
    .join(',');
}

function assertCount(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new ODataQueryError(`$${name} must be a non-negative integer, got ${value}`);
  }
  return value;
}

export function buildQuery(query: ODataQuery = {}, allowedProperties?: readonly string[]): URLSearchParams {
  const params = new URLSearchParams();

  if (query.filter !== undefined) {
    params.set('$filter', formatFilter(query.filter, allowedProperties));
  }
  if (query.select !== undefined && query.select.length > 0) {
    query.select.forEach((property) => params.append('$select', assertProperty(property, allowedProperties)));
  }
  if (query.orderBy !== undefined && query.orderBy.length > 0) {
    params.set('$orderby', formatOrderBy(query.orderBy, allowedProperties));
  }
  if (query.top !== undefined) {
    params.set('$top', String(assertCount(query.top, 'top')));
  }
  if (query.skip !== undefined) {
    params.set('$skip', String(assertCount(query.skip, 'skip')));
  }
  if (query.count !== undefined) {
    params.set('$count', query.count ? 'true' : 'false');
  }
  if (query.expand !== undefined && query.expand.length > 0) {
    query.expand.forEach((path) => params.append('$expand', path));
  }

  return params;
}

export function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function buildEntitySetUrl(
  baseUrl: string,
  entitySet: string,
  query: ODataQuery = {},
  allowedProperties?: readonly string[],
): string {
  const params = buildQuery(query, allowedProperties);
  const search = params.toString();
  const url = joinUrl(baseUrl, `/odata/${entitySet}`);
  return search === '' ? url : url + '?' + search;
}
