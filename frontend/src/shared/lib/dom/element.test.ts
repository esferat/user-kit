import { describe, expect, it } from 'vitest';

import { detailOf, element, messageOfError, MESSAGE_DESIGN, showMessage } from './element';

describe('element', () => {
  it('applies class, text, attributes and dataset', () => {
    const node = element('div', {
      className: 'page-content',
      text: 'Документы',
      attributes: { slot: 'header' },
      dataset: { id: '42' },
    });

    expect(node.className).toBe('page-content');
    expect(node.textContent).toBe('Документы');
    expect(node.getAttribute('slot')).toBe('header');
    expect(node.dataset.id).toBe('42');
  });

  it('creates a plain element without options', () => {
    expect(element('ui5-page').tagName).toBe('UI5-PAGE');
  });
});

describe('showMessage', () => {
  it('replaces the previous message and maps the design', () => {
    const host = element('div');
    host.appendChild(element('span'));

    showMessage(host, 'Файл удалён', 'Success');

    const strip = host.firstElementChild;
    expect(host.children).toHaveLength(1);
    expect(strip?.tagName).toBe('UI5-MESSAGE-STRIP');
    expect(strip?.getAttribute('design')).toBe(MESSAGE_DESIGN.Success);
    expect(strip?.textContent).toBe('Файл удалён');
  });
});

describe('messageOfError', () => {
  it('prefers the message of the error', () => {
    expect(messageOfError(new Error('boom'), 'fallback')).toBe('boom');
  });

  it('falls back for values that are not errors', () => {
    expect(messageOfError('boom', 'Неизвестная ошибка')).toBe('Неизвестная ошибка');
    expect(messageOfError(undefined, 'Неизвестная ошибка')).toBe('Неизвестная ошибка');
  });
});

describe('detailOf', () => {
  it('reads the detail of a custom event', () => {
    expect(detailOf<{ value: number }>(new CustomEvent('change', { detail: { value: 7 } }))).toEqual({ value: 7 });
  });
});
