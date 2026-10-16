import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;

// Connect lazily so builds and imports don't need DATABASE_URL.
export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  (client ??= neon(process.env.DATABASE_URL!))(strings, ...values)) as NeonQueryFunction<false, false>;
