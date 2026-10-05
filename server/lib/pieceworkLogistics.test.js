import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickCanonicalLogistics } from "./pieceworkLogistics.js";

describe("pickCanonicalLogistics", () => {
  it("prefers the piecework row over a newer hourly duplicate", () => {
    const hourly = {
      is_piecework: false,
      updated_date: "2026-09-15T10:10:54.050Z",
    };
    const piecework = {
      is_piecework: true,
      units: 50,
      updated_date: "2026-09-15T10:10:50.347Z",
    };
    assert.equal(pickCanonicalLogistics(hourly, piecework), piecework);
    assert.equal(pickCanonicalLogistics(piecework, hourly), piecework);
  });
});
