import { describe, it, expect } from "vitest";
import { errorMailAction } from "../worker/errorAlertLogic.js";

const watch = (o) => ({ status: "ACTIVE", alertsEnabled: true, errorNotifiedAt: null, ...o });
const told = new Date("2026-11-07T12:00:00Z");

describe("errorMailAction", () => {
  it("sends the failure email once a watch is in Error and nobody was told", () => {
    expect(errorMailAction(watch({ status: "ERROR" }))).toBe("failure");
  });

  it("does not repeat the failure email", () => {
    expect(errorMailAction(watch({ status: "ERROR", errorNotifiedAt: told }))).toBeNull();
  });

  it("sends nothing about an error when emails are off", () => {
    expect(errorMailAction(watch({ status: "ERROR", alertsEnabled: false }))).toBeNull();
  });

  it("sends the recovery email when a notified watch works again", () => {
    expect(errorMailAction(watch({ status: "ACTIVE", errorNotifiedAt: told }))).toBe("recovery");
  });

  it("clears the memory silently when it recovers with emails off", () => {
    expect(
      errorMailAction(watch({ status: "ACTIVE", errorNotifiedAt: told, alertsEnabled: false }))
    ).toBe("clear");
  });

  it("sends no recovery email if no failure email was sent", () => {
    expect(errorMailAction(watch({ status: "ACTIVE", errorNotifiedAt: null }))).toBeNull();
  });

  it("does nothing for paused and pending watches", () => {
    expect(errorMailAction(watch({ status: "PAUSED" }))).toBeNull();
    expect(errorMailAction(watch({ status: "PAUSED", errorNotifiedAt: told }))).toBeNull();
    expect(errorMailAction(watch({ status: "PENDING" }))).toBeNull();
  });
});