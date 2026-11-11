import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './worker/src/database/schema.ts',
  out: './worker/migrations',
});
