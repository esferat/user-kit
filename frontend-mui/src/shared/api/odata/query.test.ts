import { describe, expect, it } from 'vitest';

import {
  assertProperty,
  buildEntitySetUrl,
  buildQuery,
  formatFilter,
  formatLiteral,
  isFilterNode,
  joinUrl,
  ODataQueryError,
} from './query';

describe('isFilterNode', () => {
  it('accepts every supported kind', () => {
    expect(isFilterNode({ kind: 'comparison' })).toBe(true);
    expect(isFilterNode({ kind: 'in' })).toBe(true);
    expect(isFilterNode({ kind: 'function' })).toBe(true);
    expect(isFilterNode({ kind: 'and' })).toBe(true);
    expect(isFilterNode({ kind: 'or' })).toBe(true);
    expect(isFilterNode({ kind: 'not' })).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isFilterNode({ kind: 'join' })).toBe(false);
    expect(isFilterNode(null)).toBe(false);
    expect(isFilterNode('comparison')).toBe(false);
  });
});

describe('assertProperty', () => {
  it('accepts plain identifiers', () => {
    expect(assertProperty('createdAt')).toBe('createdAt');
    expect(assertProperty('_private1')).toBe('_private1');
  });

  it('rejects anything that is not an identifier', () => {
    expect(() => assertProperty('a;drop')).toThrow(ODataQueryError);
    expect(() => assertProperty('1name')).toThrow(ODataQueryError);
    expect(() => assertProperty('')).toThrow(ODataQueryError);
  });

  it('enforces the allow list of an entity set', () => {
    expect(() => assertProperty('name', ['id', 'name'])).not.toThrow();
    expect(() => assertProperty('storageKey', ['id', 'name'])).toThrow(ODataQueryError);
  });
});

describe('formatLiteral', () => {
  it('formats strings, numbers, booleans and null', () => {
    expect(formatLiteral('a')).toBe("'a'");
    expect(formatLiteral(42)).toBe('42');
    expect(formatLiteral(true)).toBe('true');
    expect(formatLiteral(null)).toBe('null');
  });

  it('escapes quotes and backslashes', () => {
    expect(formatLiteral("O'Brien")).toBe("'O''Brien'");
    expect(formatLiteral('back\\slash')).toBe("'back\\\\slash'");
  });

  it('rejects numbers that cannot be sent', () => {
    expect(() => formatLiteral(Number.POSITIVE_INFINITY)).toThrow(ODataQueryError);
    expect(() => formatLiteral(Number.NaN)).toThrow(ODataQueryError);
  });
});

describe('formatFilter', () => {
  it('formats comparisons', () => {
    expect(formatFilter({ kind: 'comparison', property: 'sizeBytes', operator: 'ge', value: 1024 })).toBe(
      'sizeBytes ge 1024',
    );
  });

  it('formats in, function and logical nodes', () => {
    expect(formatFilter({ kind: 'in', property: 'name', values: ['a', 'b'] })).toBe("name in ('a','b')");
    expect(formatFilter({ kind: 'function', name: 'contains', property: 'name', value: 're' })).toBe(
      "contains(name,'re')",
    );
    expect(
      formatFilter({
        kind: 'and',
        operands: [
          { kind: 'function', name: 'startswith', property: 'name', value: 'a' },
          { kind: 'comparison', property: 'sizeBytes', operator: 'lt', value: 10 },
        ],
      }),
    ).toBe("(startswith(name,'a') and sizeBytes lt 10)");
    expect(formatFilter({ kind: 'not', operand: { kind: 'in', property: 'name', values: ['a'] } })).toBe(
      "not (name in ('a'))",
    );
  });

  it('rejects empty operand lists', () => {
    expect(() => formatFilter({ kind: 'and', operands: [] })).toThrow(ODataQueryError);
    expect(() => formatFilter({ kind: 'or', operands: [] })).toThrow(ODataQueryError);
    expect(() => formatFilter({ kind: 'in', property: 'name', values: [] })).toThrow(ODataQueryError);
  });

  it('rejects an unsupported node', () => {
    expect(() => formatFilter({ kind: 'join' } as never)).toThrow(ODataQueryError);
  });
});

describe('buildQuery', () => {
  it('serialises every supported query option', () => {
    const params = buildQuery({
      filter: { kind: 'function', name: 'contains', property: 'name', value: 'a b' },
      select: ['id', 'name'],
      orderBy: [{ property: 'createdAt', descending: true }, { property: 'name' }],
      top: 10,
      skip: 20,
      count: true,
      expand: ['owner'],
    });

    expect(params.get('$filter')).toBe("contains(name,'a b')");
    expect(params.getAll('$select')).toEqual(['id', 'name']);
    expect(params.get('$orderby')).toBe('createdAt desc,name asc');
    expect(params.get('$top')).toBe('10');
    expect(params.get('$skip')).toBe('20');
    expect(params.get('$count')).toBe('true');
    expect(params.get('$expand')).toBe('owner');
  });

  it('omits empty option lists', () => {
    const params = buildQuery({ select: [], orderBy: [], expand: [] });

    expect([...params.keys()]).toEqual([]);
  });

  it('rejects invalid counters', () => {
    expect(() => buildQuery({ top: -1 })).toThrow(ODataQueryError);
    expect(() => buildQuery({ skip: 1.5 })).toThrow(ODataQueryError);
  });

  it('omits an empty order by instead of sending an invalid one', () => {
    expect(buildQuery({ orderBy: [] }).has('$orderby')).toBe(false);
  });
});

describe('joinUrl', () => {
  it('joins the base URL and the path exactly once', () => {
    expect(joinUrl('http://api:8080', '/api/v1/me')).toBe('http://api:8080/api/v1/me');
    expect(joinUrl('http://api:8080/', '/api/v1/me')).toBe('http://api:8080/api/v1/me');
    expect(joinUrl('http://api:8080/', 'api/v1/me')).toBe('http://api:8080/api/v1/me');
  });
});

describe('buildEntitySetUrl', () => {
  it('builds the URL of an entity set', () => {
    expect(buildEntitySetUrl('http://api:8080', 'Files')).toBe('http://api:8080/odata/Files');
  });

  it('appends the query string when options are used', () => {
    const url = buildEntitySetUrl('', 'Users', { top: 5 });

    expect(url).toBe('/odata/Users?%24top=5');
  });
});
