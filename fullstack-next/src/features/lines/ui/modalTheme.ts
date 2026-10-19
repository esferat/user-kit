import type { ModalProps } from 'antd';

/**
 * Тёмное оформление игровых окон (правила, настройки, конец партии).
 * Антд по умолчанию рисует светлую модалку, которая выбивается из тёмного поля,
 * поэтому фон, шапку и подвал задаём семантическими стилями модалки.
 */
export const DARK_MODAL_STYLES: ModalProps['styles'] = {
  container: {
    background: 'linear-gradient(180deg, #1c2230, #12151c)',
    border: '1px solid #33405a',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
  },
  header: {
    background: 'transparent',
    borderBottom: '1px solid #2a3345',
  },
  title: {
    color: '#e9edf5',
  },
  body: {
    color: '#d7dde8',
  },
  footer: {
    background: 'transparent',
    borderTop: '1px solid #2a3345',
  },
  close: {
    color: '#9fb0c8',
  },
};
