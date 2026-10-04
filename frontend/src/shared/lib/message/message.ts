/** Semantic design of a message inside the application code. */
export type MessageDesign = 'Information' | 'Success' | 'Warning' | 'Error';

/** Maps the semantic design used in the code to the `ui5-message-strip` designs. */
export const MESSAGE_DESIGN: Record<MessageDesign, 'Information' | 'Positive' | 'Critical' | 'Negative'> = {
  Information: 'Information',
  Success: 'Positive',
  Warning: 'Critical',
  Error: 'Negative',
};

/** Reads the message of a failed request, falling back to a generic text. */
export function messageOfError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/** A message of a finished user interaction. */
export interface AppMessage {
  text: string;
  design: MessageDesign;
}
