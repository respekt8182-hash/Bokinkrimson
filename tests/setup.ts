// Shared test bootstrap for global mocks and environment setup.
import { vi } from "vitest";

process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret-at-least-16-chars";

vi.mock("server-only", () => ({}));
