import { describe, expect, it } from "vitest";
import { answerLabel, kindsFor, newItemKey, parseChecklistItems, storedItems } from "./templates";

const item = (over: Record<string, unknown> = {}) => ({
  key: "i_1",
  text: "Clean filters",
  instructions: null,
  response: "checkbox",
  unit: null,
  mandatory: true,
  photo_required: false,
  ...over,
});

describe("parseChecklistItems", () => {
  it("accepts a clean list, trims, and keeps units only for numbers", () => {
    const result = parseChecklistItems(
      JSON.stringify([item({ text: " Clean filters ", instructions: " " }), item({ key: "i_2", response: "numeric", unit: "°C" }), item({ key: "i_3", unit: "x" })]),
    );
    expect(result).toEqual({
      ok: true,
      items: [
        { key: "i_1", text: "Clean filters", instructions: null, response: "checkbox", unit: null, mandatory: true, photo_required: false },
        { key: "i_2", text: "Clean filters", instructions: null, response: "numeric", unit: "°C", mandatory: true, photo_required: false },
        { key: "i_3", text: "Clean filters", instructions: null, response: "checkbox", unit: null, mandatory: true, photo_required: false },
      ],
    });
  });

  it("explains problems in plain words", () => {
    expect(parseChecklistItems("[]")).toEqual({ ok: false, error: "Add at least one checklist item." });
    expect(parseChecklistItems(JSON.stringify([item({ text: "" })]))).toEqual({ ok: false, error: "Give every item its wording." });
    const many = Array.from({ length: 101 }, (_, i) => item({ key: `i_${i}` }));
    expect(parseChecklistItems(JSON.stringify(many))).toEqual({ ok: false, error: "Up to 100 items." });
  });

  it("refuses unknown answer types, repeated keys and broken JSON", () => {
    expect(parseChecklistItems(JSON.stringify([item({ response: "stars" })])).ok).toBe(false);
    expect(parseChecklistItems(JSON.stringify([item(), item()])).ok).toBe(false);
    expect(parseChecklistItems("{oops").ok).toBe(false);
  });
});

describe("helpers", () => {
  it("reads stored lists leniently", () => {
    expect(storedItems([item(), { nope: true }])).toHaveLength(1);
    expect(storedItems("x")).toEqual([]);
  });

  it("labels answers and makes keys", () => {
    expect(answerLabel({ response: "numeric", unit: "°C" })).toBe("Number · °C");
    expect(answerLabel({ response: "pass_fail", unit: null })).toBe("Pass / fail");
    expect(newItemKey(() => "abcdef12-3456-7890-abcd-ef1234567890")).toBe("i_abcdef1234");
  });

  it("offers only the kinds whose module is on", () => {
    expect(kindsFor(["maintenance"])).toEqual(["pm"]);
    expect(kindsFor(["inspections", "maintenance"])).toEqual(["pm", "inspection"]);
    expect(kindsFor([])).toEqual([]);
  });
});
