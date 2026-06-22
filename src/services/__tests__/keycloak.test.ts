// Test keycloak service with auth DISABLED (isAuthEnabled = false)
// This tests the real module, not a mock

const mockKeycloakInstance = {
  init: jest.fn().mockResolvedValue(true),
  updateToken: jest.fn().mockResolvedValue(true),
  logout: jest.fn(),
  token: "real-token",
  refreshToken: "real-refresh",
  idToken: "real-id",
  tokenParsed: {
    preferred_username: "john",
    sub: "sub-456",
    realm_access: { roles: ["user", "admin"] },
  },
  onTokenExpired: null as (() => void) | null,
};

jest.mock("keycloak-js", () => {
  return jest.fn(() => mockKeycloakInstance);
});

describe("keycloak service", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    sessionStorage.clear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("with auth disabled", () => {
    beforeEach(() => {
      process.env.REACT_APP_AUTH_ENABLED = "false";
    });

    it("initKeycloak returns true without calling keycloak.init", async () => {
      const { initKeycloak } = require("../keycloak");
      const result = await initKeycloak();
      expect(result).toBe(true);
      expect(mockKeycloakInstance.init).not.toHaveBeenCalled();
    });

    it("getToken returns empty string", async () => {
      const { getToken } = require("../keycloak");
      const token = await getToken();
      expect(token).toBe("");
    });

    it("getUsername returns 'anonymous'", () => {
      const { getUsername } = require("../keycloak");
      expect(getUsername()).toBe("anonymous");
    });

    it("getUserId returns 'anonymous'", () => {
      const { getUserId } = require("../keycloak");
      expect(getUserId()).toBe("anonymous");
    });

    it("hasRole returns true for any role", () => {
      const { hasRole } = require("../keycloak");
      expect(hasRole("admin")).toBe(true);
      expect(hasRole("whatever")).toBe(true);
    });

    it("logout does nothing", () => {
      const { logout } = require("../keycloak");
      logout();
      expect(mockKeycloakInstance.logout).not.toHaveBeenCalled();
    });
  });

  describe("with auth enabled", () => {
    beforeEach(() => {
      process.env.REACT_APP_AUTH_ENABLED = "true";
      mockKeycloakInstance.init.mockClear();
      mockKeycloakInstance.updateToken.mockClear();
      mockKeycloakInstance.logout.mockClear();
    });

    it("initKeycloak calls keycloak.init and stores tokens on success", async () => {
      mockKeycloakInstance.init.mockResolvedValue(true);
      const { initKeycloak } = require("../keycloak");
      const result = await initKeycloak();
      expect(result).toBe(true);
      expect(mockKeycloakInstance.init).toHaveBeenCalledWith(
        expect.objectContaining({ onLoad: "login-required" })
      );
      expect(sessionStorage.getItem("kc_token")).toBe("real-token");
      expect(sessionStorage.getItem("kc_refreshToken")).toBe("real-refresh");
      expect(sessionStorage.getItem("kc_idToken")).toBe("real-id");
    });

    it("initKeycloak restores tokens from sessionStorage", async () => {
      sessionStorage.setItem("kc_token", "stored-token");
      sessionStorage.setItem("kc_refreshToken", "stored-refresh");
      sessionStorage.setItem("kc_idToken", "stored-id");
      mockKeycloakInstance.init.mockResolvedValue(true);

      const { initKeycloak } = require("../keycloak");
      await initKeycloak();

      expect(mockKeycloakInstance.init).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "stored-token",
          refreshToken: "stored-refresh",
          idToken: "stored-id",
        })
      );
    });

    it("initKeycloak does not store tokens when not authenticated", async () => {
      mockKeycloakInstance.init.mockResolvedValue(false);
      const { initKeycloak } = require("../keycloak");
      const result = await initKeycloak();
      expect(result).toBe(false);
      expect(sessionStorage.getItem("kc_token")).toBeNull();
    });

    it("initKeycloak sets onTokenExpired handler", async () => {
      mockKeycloakInstance.init.mockResolvedValue(true);
      const { initKeycloak } = require("../keycloak");
      await initKeycloak();
      expect(mockKeycloakInstance.onTokenExpired).toBeInstanceOf(Function);
    });

    it("onTokenExpired refreshes and stores new tokens", async () => {
      mockKeycloakInstance.init.mockResolvedValue(true);
      mockKeycloakInstance.updateToken.mockResolvedValue(true);
      const { initKeycloak } = require("../keycloak");
      await initKeycloak();

      // Simulate token expiry
      mockKeycloakInstance.token = "new-token";
      mockKeycloakInstance.refreshToken = "new-refresh";
      mockKeycloakInstance.idToken = "new-id";

      await (mockKeycloakInstance.onTokenExpired as Function)();
      // Wait for the promise chain
      await new Promise((r) => setTimeout(r, 0));

      expect(mockKeycloakInstance.updateToken).toHaveBeenCalledWith(30);
      expect(sessionStorage.getItem("kc_token")).toBe("new-token");
    });

    it("getToken calls updateToken and returns token", async () => {
      mockKeycloakInstance.updateToken.mockResolvedValue(true);
      const { getToken } = require("../keycloak");
      const token = await getToken();
      expect(mockKeycloakInstance.updateToken).toHaveBeenCalledWith(30);
      expect(token).toBe("new-token");
    });

    it("getUsername returns preferred_username from tokenParsed", () => {
      const { getUsername } = require("../keycloak");
      expect(getUsername()).toBe("john");
    });

    it("getUserId returns sub from tokenParsed", () => {
      const { getUserId } = require("../keycloak");
      expect(getUserId()).toBe("sub-456");
    });

    it("hasRole returns true when user has the role", () => {
      const { hasRole } = require("../keycloak");
      expect(hasRole("admin")).toBe(true);
      expect(hasRole("user")).toBe(true);
    });

    it("hasRole returns false when user does not have the role", () => {
      const { hasRole } = require("../keycloak");
      expect(hasRole("superadmin")).toBe(false);
    });

    it("logout clears sessionStorage and calls keycloak.logout", () => {
      sessionStorage.setItem("kc_token", "t");
      sessionStorage.setItem("kc_refreshToken", "r");
      sessionStorage.setItem("kc_idToken", "i");

      const { logout } = require("../keycloak");
      logout();

      expect(sessionStorage.getItem("kc_token")).toBeNull();
      expect(sessionStorage.getItem("kc_refreshToken")).toBeNull();
      expect(sessionStorage.getItem("kc_idToken")).toBeNull();
      expect(mockKeycloakInstance.logout).toHaveBeenCalledWith({
        redirectUri: window.location.origin,
      });
    });
  });
});
