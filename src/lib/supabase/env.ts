// Public Supabase settings. Values live only in .env.local and Vercel; this
// file reads them and fails loudly when one is missing.
//
// NEXT_PUBLIC_* values are inlined at build time, so they must be read with
// literal property access (process.env.NEXT_PUBLIC_X), not process.env[name].

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Add it to .env.local (see .env.example).`);
  }
  return value;
}

export const supabaseUrl = () =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);

export const supabasePublishableKey = () =>
  required(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
