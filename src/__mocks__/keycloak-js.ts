const keycloakMock = {
  init: jest.fn().mockResolvedValue(true),
  updateToken: jest.fn().mockResolvedValue(true),
  logout: jest.fn(),
  token: "mock-token",
  refreshToken: "mock-refresh-token",
  idToken: "mock-id-token",
  tokenParsed: {
    preferred_username: "testuser",
    sub: "user-123",
    realm_access: { roles: ["user"] },
  },
  onTokenExpired: null as (() => void) | null,
};

export default function Keycloak() {
  return keycloakMock;
}

export { keycloakMock };
