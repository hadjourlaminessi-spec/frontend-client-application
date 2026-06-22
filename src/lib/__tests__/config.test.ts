describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear any window config
    delete (window as any).__APP_CONFIG__;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("API_CONFIG uses fallback values when no env or runtime config", () => {
    const { API_CONFIG } = require("../config");
    expect(API_CONFIG.CATALOG).toBe("http://localhost:4000");
    expect(API_CONFIG.ORDERS).toBe("http://localhost:8000");
    expect(API_CONFIG.PAYMENT).toBe("http://localhost:8082");
  });

  it("API_CONFIG reads REACT_APP_ env variables", () => {
    process.env.REACT_APP_CATALOG = "http://catalog.example.com";
    const { API_CONFIG } = require("../config");
    expect(API_CONFIG.CATALOG).toBe("http://catalog.example.com");
  });

  it("API_CONFIG prefers window.__APP_CONFIG__ over env", () => {
    process.env.REACT_APP_CATALOG = "http://from-env.com";
    (window as any).__APP_CONFIG__ = { CATALOG: "http://from-runtime.com" };
    const { API_CONFIG } = require("../config");
    expect(API_CONFIG.CATALOG).toBe("http://from-runtime.com");
  });

  it("KEYCLOAK_CONFIG has sensible defaults", () => {
    const { KEYCLOAK_CONFIG } = require("../config");
    expect(KEYCLOAK_CONFIG.URL).toBe("http://localhost:8080");
    expect(KEYCLOAK_CONFIG.REALM).toBe("ecommerce");
    expect(KEYCLOAK_CONFIG.CLIENT_ID).toBe("ecommerce-front");
  });

  it("isAuthEnabled returns true by default", () => {
    const { isAuthEnabled } = require("../config");
    expect(isAuthEnabled()).toBe(true);
  });

  it("isAuthEnabled returns false when AUTH_ENABLED is 'false'", () => {
    process.env.REACT_APP_AUTH_ENABLED = "false";
    const { isAuthEnabled } = require("../config");
    expect(isAuthEnabled()).toBe(false);
  });
});
