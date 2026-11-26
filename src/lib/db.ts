import "server-only";
import postgres from "postgres";

// Supabase Postgres via the Supavisor transaction pooler (port 6543), which suits serverless
// functions. The pooler doesn't support prepared statements, hence `prepare: false`.
let client: postgres.Sql | null = null;

const connect = () =>
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });

// Connect lazily so builds and imports don't need DATABASE_URL.
export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client ??= connect())(strings, ...(values as any[]))) as unknown as <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, any>,
>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;
