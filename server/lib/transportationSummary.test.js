import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  departureChangeAllowed,
  isSummaryRowVisible,
  isTransportationVehicle,
  planLogisticsInsert,
  planManualInsert,
} from "./transportationSummary.js";

describe("isTransportationVehicle", () => {
  it("is true only when the flag is saved as true", () => {
    assert.equal(isTransportationVehicle({ is_transportation: true }), true);
    assert.equal(isTransportationVehicle({ is_transportation: false, name: "מיניבוס" }), false);
    assert.equal(isTransportationVehicle({ name: "מידיבוס" }), false);
    assert.equal(isTransportationVehicle(null), false);
  });
});

describe("planLogisticsInsert", () => {
  const base = {
    date: "2026-11-26",
    vehicleId: "bus-1",
    exitTime: "07:10",
    workplaceName: "לול הנגב",
    existingRows: [],
  };

  it("inserts one logistics row with the workplace and exit time", () => {
    const plan = planLogisticsInsert(base);
    assert.equal(plan.action, "insert");
    assert.equal(plan.values.source, "logistics");
    assert.equal(plan.values.destination, "לול הנגב");
    assert.equal(plan.values.departure_time, "07:10");
    assert.equal(plan.values.assembly, "טצ");
    assert.equal(plan.values.return_time, "12:00");
  });

  it("uses 06:35 when logistics has no exit time", () => {
    const plan = planLogisticsInsert({ ...base, exitTime: "" });
    assert.equal(plan.values.departure_time, "06:35");
  });

  it("does not insert a second logistics row for the same date and vehicle", () => {
    const plan = planLogisticsInsert({
      ...base,
      existingRows: [
        {
          date: "2026-11-26",
          vehicle_id: "bus-1",
          source: "logistics",
          departure_time: "07:10",
        },
      ],
    });
    assert.deepEqual(plan, { action: "skip", reason: "exists" });
  });

  it("skips when a manual row already uses that hour", () => {
    const plan = planLogisticsInsert({
      ...base,
      existingRows: [
        {
          date: "2026-11-26",
          vehicle_id: "bus-1",
          source: "manual",
          departure_time: "07:10",
        },
      ],
    });
    assert.deepEqual(plan, { action: "skip", reason: "hour-taken" });
  });

  it("inserts when the same vehicle already has a manual row at another hour", () => {
    const plan = planLogisticsInsert({
      ...base,
      existingRows: [
        {
          date: "2026-11-26",
          vehicle_id: "bus-1",
          source: "manual",
          departure_time: "09:00",
        },
      ],
    });
    assert.equal(plan.action, "insert");
  });
});

describe("planManualInsert", () => {
  it("rejects a vehicle that is not marked transportation", () => {
    const plan = planManualInsert({
      date: "2026-11-26",
      vehicleId: "car-1",
      departureTime: "08:00",
      isTransportation: false,
      existingRows: [],
    });
    assert.deepEqual(plan, { action: "reject", reason: "not-transportation" });
  });

  it("creates a row for a transportation vehicle that is not on logistics", () => {
    const plan = planManualInsert({
      date: "2026-11-26",
      vehicleId: "bus-1",
      departureTime: "08:00",
      isTransportation: true,
      existingRows: [],
    });
    assert.equal(plan.action, "insert");
    assert.equal(plan.values.source, "manual");
    assert.equal(plan.values.destination, "");
    assert.equal(plan.values.departure_time, "08:00");
    assert.equal(plan.values.assembly, "טצ");
    assert.equal(plan.values.return_time, "12:00");
  });

  it("keeps the values the user typed instead of the defaults", () => {
    const plan = planManualInsert({
      date: "2026-11-26",
      vehicleId: "bus-1",
      departureTime: "09:15",
      isTransportation: true,
      assembly: "צומת",
      destination: "לול הנגב",
      returnTime: "13:30",
      existingRows: [],
    });
    assert.equal(plan.action, "insert");
    assert.equal(plan.values.assembly, "צומת");
    assert.equal(plan.values.destination, "לול הנגב");
    assert.equal(plan.values.departure_time, "09:15");
    assert.equal(plan.values.return_time, "13:30");
  });

  it("rejects a second row at the same hour", () => {
    const plan = planManualInsert({
      date: "2026-11-26",
      vehicleId: "bus-1",
      departureTime: "08:00",
      isTransportation: true,
      existingRows: [
        {
          date: "2026-11-26",
          vehicle_id: "bus-1",
          source: "manual",
          departure_time: "08:00",
        },
      ],
    });
    assert.deepEqual(plan, { action: "reject", reason: "hour-taken" });
  });

  it("allows a second row at a different hour", () => {
    const plan = planManualInsert({
      date: "2026-11-26",
      vehicleId: "bus-1",
      departureTime: "10:00",
      isTransportation: true,
      existingRows: [
        {
          date: "2026-11-26",
          vehicle_id: "bus-1",
          source: "logistics",
          departure_time: "08:00",
        },
      ],
    });
    assert.equal(plan.action, "insert");
  });
});

describe("summary row visibility", () => {
  it("hides every row when the vehicle is not transportation", () => {
    assert.equal(
      isSummaryRowVisible({
        source: "manual",
        isTransportation: false,
        assigned: true,
      }),
      false,
    );
  });

  it("shows a manual row even when the vehicle is not assigned", () => {
    assert.equal(
      isSummaryRowVisible({
        source: "manual",
        isTransportation: true,
        assigned: false,
      }),
      true,
    );
  });

  it("hides a logistics row when the vehicle is cleared from logistics", () => {
    assert.equal(
      isSummaryRowVisible({
        source: "logistics",
        isTransportation: true,
        assigned: false,
      }),
      false,
    );
  });
});

describe("departureChangeAllowed", () => {
  const rows = [
    {
      id: "a",
      date: "2026-11-26",
      vehicle_id: "bus-1",
      departure_time: "08:00",
    },
    {
      id: "b",
      date: "2026-11-26",
      vehicle_id: "bus-1",
      departure_time: "10:00",
    },
  ];

  it("rejects an hour already used by the same vehicle that day", () => {
    assert.equal(
      departureChangeAllowed(rows, {
        id: "b",
        date: "2026-11-26",
        vehicleId: "bus-1",
        departureTime: "08:00",
      }),
      false,
    );
  });

  it("allows keeping the row's own hour", () => {
    assert.equal(
      departureChangeAllowed(rows, {
        id: "a",
        date: "2026-11-26",
        vehicleId: "bus-1",
        departureTime: "08:00",
      }),
      true,
    );
  });
});
