export interface ElementOptions {
  className?: string;
  text?: string;
  attributes?: Record<string, string>;
  dataset?: Record<string, string>;
}

/** Creates any HTML or UI5 Web Component element. */
export function element(tag: string, options: ElementOptions = {}): HTMLElement {
  const node = document.createElement(tag);
  if (options.className !== undefined) {
    node.className = options.className;
  }
  if (options.text !== undefined) {
    node.textContent = options.text;
  }
  Object.entries(options.attributes ?? {}).forEach(([name, value]) => {
    node.setAttribute(name, value);
  });
  Object.entries(options.dataset ?? {}).forEach(([name, value]) => {
    node.dataset[name] = value;
  });
  return node;
}

export type MessageDesign = 'Information' | 'Success' | 'Warning' | 'Error';

/** Maps the semantic design used in the code to `ui5-message-strip` designs. */
export const MESSAGE_DESIGN: Record<MessageDesign, 'Information' | 'Positive' | 'Critical' | 'Negative'> = {
  Information: 'Information',
  Success: 'Positive',
  Warning: 'Critical',
  Error: 'Negative',
};

export interface CustomEventDetail<T> {
  detail: T;
}

export function detailOf<T>(event: Event): T {
  return (event as unknown as CustomEventDetail<T>).detail;
}

/** Renders a `ui5-message-strip` and replaces whatever the host showed before. */
export function showMessage(host: HTMLElement, text: string, design: MessageDesign = 'Information'): void {
  const strip = document.createElement('ui5-message-strip');
  strip.setAttribute('design', MESSAGE_DESIGN[design]);
  strip.textContent = text;
  host.replaceChildren(strip);
}

/** Reads the message of a failed request, falling back to a generic text. */
export function messageOfError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
