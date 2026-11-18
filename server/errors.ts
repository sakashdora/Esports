// Only explicitly authored messages may be returned to API clients.
export class ClientInputError extends Error {}

export function clientErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ClientInputError ? error.message : fallback;
}
