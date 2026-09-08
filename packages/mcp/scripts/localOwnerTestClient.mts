import {HttpDataClient, LOCAL_OWNER_HEADER} from '@book.dev/sdk';

export const TEST_LOCAL_OWNER_SECRET = 'openbook-mcp-test-local-owner';

/** HTTP client that models the trusted desktop/loopback owner transport in tests. */
export const localOwnerTestClient = (url: string): HttpDataClient =>
  new HttpDataClient(url, undefined, {
    fetchImpl: (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set(LOCAL_OWNER_HEADER, TEST_LOCAL_OWNER_SECRET);
      return fetch(input, {...init, headers});
    },
  });
