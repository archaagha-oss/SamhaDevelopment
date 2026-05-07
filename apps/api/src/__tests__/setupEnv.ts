// Set required env vars BEFORE any module is imported.
// Vitest runs setupFiles before transforming test sources, so importing env.ts
// inside the suite would otherwise run validation against an empty process.env.
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(48);
process.env.DATABASE_URL =
  process.env.DATABASE_URL || "mysql://test:test@localhost:3306/test";
