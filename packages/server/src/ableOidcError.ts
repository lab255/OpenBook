export class AbleOidcError extends Error {
  constructor(
    readonly status: 400 | 401 | 429 | 502,
    message: string,
  ) {
    super(message);
    this.name = 'AbleOidcError';
  }
}
