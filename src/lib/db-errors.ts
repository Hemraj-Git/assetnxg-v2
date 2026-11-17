// Database errors in plain words. Our own functions and triggers raise
// sentences meant for people ("Move its people to another department
// first."); Postgres's own messages ("violates foreign key constraint …")
// are not shown to anyone.

const TECHNICAL = /violates|permission denied|row-level security|relation |column |syntax|function |duplicate key|null value|invalid input|constraint|schema|42\d{3}|PGRST/i;

export type DbError = { code?: string | null; message: string };

/** The error's own message when it's one we wrote for people, else `fallback`.
 *  `duplicate` is used for a unique-key clash (23505). */
export function plainDbError(error: DbError, fallback: string, duplicate?: string): string {
  if (error.code === "23505") return duplicate ?? fallback;
  const msg = error.message?.trim() ?? "";
  if (!msg || TECHNICAL.test(msg)) return fallback;
  return msg;
}
