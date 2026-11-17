import { describe, expect, it } from "vitest";
import { plainDbError } from "./db-errors";

describe("plainDbError", () => {
  it("passes on sentences our database functions raise", () => {
    expect(plainDbError({ code: "23503", message: "Move its people to another department first." }, "x")).toBe(
      "Move its people to another department first.",
    );
    expect(plainDbError({ code: "42501", message: "You can't remove yourself. Ask another Admin." }, "x")).toBe(
      "You can't remove yourself. Ask another Admin.",
    );
  });

  it("hides Postgres's own messages", () => {
    expect(plainDbError({ code: "42501", message: 'new row violates row-level security policy for table "departments"' }, "Not allowed.")).toBe("Not allowed.");
    expect(plainDbError({ code: "23503", message: 'insert or update on table "memberships" violates foreign key constraint' }, "Try again.")).toBe("Try again.");
    expect(plainDbError({ message: "" }, "Try again.")).toBe("Try again.");
  });

  it("uses the duplicate message for unique clashes", () => {
    expect(plainDbError({ code: "23505", message: "duplicate key value" }, "x", "That name is taken.")).toBe("That name is taken.");
  });
});
