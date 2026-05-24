const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const demo = require("../node-location-demo/app.js");

test("builds fixed QR/location codes from normalized parts", () => {
  assert.equal(
    demo.buildLocationCode(
      demo.normalizeZone("A"),
      demo.normalizeRowCode("B"),
      demo.normalizeShelfCode(1),
      1,
      demo.normalizeBoxCode(1)
    ),
    "AB001-101"
  );

  assert.equal(
    demo.buildLocationCode(
      demo.normalizeZone("A"),
      demo.normalizeRowCode("AB"),
      demo.normalizeShelfCode(12),
      3,
      demo.normalizeBoxCode(5)
    ),
    "AAB12-305"
  );

  assert.equal(
    demo.buildLocationCode(
      demo.normalizeZone("A"),
      demo.normalizeRowCode("G"),
      demo.normalizeShelfCode(1),
      4,
      demo.normalizeBoxCode(38)
    ),
    "AG001-438"
  );
});

test("builds 8x8 grid coordinates from index 1 to 64", () => {
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 });

  assert.equal(zone.totalCells, 64);
  assert.deepEqual(demo.gridPositionFromIndex(1, 8), {
    gridIndex: 1,
    gridRow: 1,
    gridCol: 1,
  });
  assert.deepEqual(demo.gridPositionFromIndex(64, 8), {
    gridIndex: 64,
    gridRow: 8,
    gridCol: 8,
  });
});

test("blocks duplicate row creation inside the same zone", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);

  demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 2, levelCount: 4 },
    state
  );

  assert.throws(
    () =>
      demo.createRowShelves(
        { zoneId: zone.id, rowInput: "B", shelfCount: 2, levelCount: 4 },
        state
      ),
    /duplicate row/i
  );
});

test("prevents shelf overlap in the same grid cell", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);
  const row = demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 2, levelCount: 4 },
    state
  );

  const first = state.shelves.find((shelf) => shelf.rowId === row.id && shelf.shelfNo === 1);
  const second = state.shelves.find((shelf) => shelf.rowId === row.id && shelf.shelfNo === 2);

  demo.placeShelf({ shelfId: first.id, gridIndex: 1 }, state);
  assert.throws(
    () => demo.placeShelf({ shelfId: second.id, gridIndex: 1 }, state),
    /overlap/i
  );
});

test("moves one selected shelf without moving the whole row", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);
  const row = demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 2, levelCount: 4 },
    state
  );
  const first = state.shelves.find((shelf) => shelf.rowId === row.id && shelf.shelfNo === 1);
  const second = state.shelves.find((shelf) => shelf.rowId === row.id && shelf.shelfNo === 2);

  demo.moveRowLayout(
    { rowId: row.id, startGridIndex: 10, direction: "horizontal", stackOrder: "1-x" },
    state
  );
  demo.placeShelf({ shelfId: second.id, gridIndex: 20 }, state);

  assert.equal(first.gridIndex, 10);
  assert.equal(second.gridIndex, 20);
  assert.equal(second.gridRow, 3);
  assert.equal(second.gridCol, 4);
  assert.throws(
    () => demo.placeShelf({ shelfId: second.id, gridIndex: 10 }, state),
    /overlap/i
  );
});

test("blocks generate when an active placed shelf is missing box setup", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);
  const row = demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 1, levelCount: 1 },
    state
  );
  const shelf = state.shelves.find((item) => item.rowId === row.id);

  demo.placeShelf({ shelfId: shelf.id, gridIndex: 1 }, state);

  assert.throws(() => demo.generateLocations({ zoneId: zone.id }, state), /missing box/i);
});

test("generates locations and exports layout/location masters separately", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);
  const row = demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 1, levelCount: 1 },
    state
  );
  const shelf = state.shelves.find((item) => item.rowId === row.id);

  demo.placeShelf({ shelfId: shelf.id, gridIndex: 1 }, state);
  demo.setShelfBoxCount({ shelfId: shelf.id, level: 1, boxCount: 1 }, state);
  const locations = demo.generateLocations(
    { zoneId: zone.id, generatedBatchId: "batch-1" },
    state
  );

  assert.equal(locations.length, 1);
  assert.equal(locations[0].locationCode, "AB001-101");
  const layout = demo.exportLayoutMaster(state);
  const location = demo.exportLocationMaster(state);
  assert.equal(layout.length, 1);
  assert.equal(location.length, 1);
  assert.ok("f_grid_row" in layout[0]);
  assert.equal(layout[0].f_layout_key, "A|B0|01");
  assert.equal(layout[0].f_grid_key, "A|1");
  assert.ok("f_location_code" in location[0]);
  assert.equal(location[0].f_layout_key, "A|B0|01");
  assert.equal(location[0].f_generated_batch_id, "batch-1");
  assert.equal(location[0].f_created_by_app, "NodeLocationDemo");
});

test("summarizes generate readiness before writing output", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);
  const row = demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 2, levelCount: 1 },
    state
  );
  const first = state.shelves.find((item) => item.rowId === row.id && item.shelfNo === 1);
  const second = state.shelves.find((item) => item.rowId === row.id && item.shelfNo === 2);

  demo.placeShelf({ shelfId: first.id, gridIndex: 1 }, state);
  demo.placeShelf({ shelfId: second.id, gridIndex: 2 }, state);
  demo.setShelfBoxCount({ shelfId: first.id, level: 1, boxCount: 2 }, state);
  demo.toggleShelfActive(second.id, state);

  assert.deepEqual(demo.getGenerateSummary({ zoneId: zone.id }, state), {
    zoneCount: 1,
    rowCount: 1,
    shelfCount: 2,
    activeShelfCount: 1,
    skippedShelfCount: 1,
    locationCount: 2,
    duplicateCount: 0,
    errorCount: 0,
    errors: [],
  });
});

test("reports missing box setup in generate summary without mutating output", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);
  const row = demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 1, levelCount: 1 },
    state
  );
  const shelf = state.shelves.find((item) => item.rowId === row.id);

  demo.placeShelf({ shelfId: shelf.id, gridIndex: 1 }, state);
  const summary = demo.getGenerateSummary({ zoneId: zone.id }, state);

  assert.equal(summary.locationCount, 0);
  assert.equal(summary.errorCount, 1);
  assert.match(summary.errors[0], /missing box/i);
  assert.equal(state.generatedLocations.length, 0);
});

test("inactive shelves stay in layout but do not generate locations", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);
  const row = demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 2, levelCount: 1 },
    state
  );
  const first = state.shelves.find((item) => item.rowId === row.id && item.shelfNo === 1);
  const second = state.shelves.find((item) => item.rowId === row.id && item.shelfNo === 2);

  demo.placeShelf({ shelfId: first.id, gridIndex: 1 }, state);
  demo.placeShelf({ shelfId: second.id, gridIndex: 2 }, state);
  demo.setShelfBoxCount({ shelfId: first.id, level: 1, boxCount: 1 }, state);
  demo.setShelfBoxCount({ shelfId: second.id, level: 1, boxCount: 1 }, state);
  demo.toggleShelfActive(second.id, state);

  const locations = demo.generateLocations({ zoneId: zone.id }, state);
  const layout = demo.exportLayoutMaster(state);

  assert.deepEqual(locations.map((item) => item.locationCode), ["AB001-101"]);
  assert.equal(layout.length, 2);
  assert.equal(layout.find((item) => item.f_display_name === "B2").f_is_active, false);
});

test("hidden shelves are not rendered but remain active and generate locations", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);
  const row = demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 1, levelCount: 1 },
    state
  );
  const shelf = state.shelves.find((item) => item.rowId === row.id);

  demo.placeShelf({ shelfId: shelf.id, gridIndex: 1 }, state);
  demo.setShelfBoxCount({ shelfId: shelf.id, level: 1, boxCount: 1 }, state);
  demo.toggleShelfVisible(shelf.id, state);

  assert.equal(shelf.isVisible, false);
  assert.equal(demo.generateLocations({ zoneId: zone.id }, state)[0].locationCode, "AB001-101");
  assert.equal(demo.exportLayoutMaster(state)[0].f_is_visible, false);
});

test("sets box count for one selected shelf instead of the whole row", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);
  const row = demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 2, levelCount: 1 },
    state
  );
  const first = state.shelves.find((item) => item.rowId === row.id && item.shelfNo === 1);
  const second = state.shelves.find((item) => item.rowId === row.id && item.shelfNo === 2);

  demo.setShelfBoxCount({ shelfId: second.id, level: 1, boxCount: 5 }, state);

  assert.equal(state.shelfBoxes.some((item) => item.shelfId === first.id), false);
  assert.equal(state.shelfBoxes.find((item) => item.shelfId === second.id).boxCount, 5);
});

test("returns shelf detail with levels, boxes, locations, and item names", () => {
  const state = demo.createInitialState();
  const zone = demo.createZone({ zoneCode: "A", gridSize: 8 }, state);
  const row = demo.createRowShelves(
    { zoneId: zone.id, rowInput: "B", shelfCount: 1, levelCount: 2 },
    state
  );
  const shelf = state.shelves.find((item) => item.rowId === row.id);

  demo.placeShelf({ shelfId: shelf.id, gridIndex: 10 }, state);
  demo.setShelfBoxCount({ shelfId: shelf.id, level: 1, boxCount: 2 }, state);
  demo.setShelfBoxCount({ shelfId: shelf.id, level: 2, boxCount: 1 }, state);
  demo.setBoxItem(
    { shelfId: shelf.id, level: 1, boxNo: 2, itemCode: "SKU-RED", itemName: "Red Tape" },
    state
  );

  assert.deepEqual(demo.getShelfDetail(shelf.id, state), {
    displayName: "B1",
    zoneCode: "A",
    rowInput: "B",
    rowCode: "B0",
    shelfNo: 1,
    shelfCode: "01",
    gridIndex: 10,
    gridRow: 2,
    gridCol: 2,
    levelCount: 2,
    boxCount: 3,
    status: "Active",
    levels: [
      {
        level: 1,
        boxes: [
          { boxNo: 1, locationCode: "AB001-101", itemCode: "", itemName: "No item assigned" },
          { boxNo: 2, locationCode: "AB001-102", itemCode: "SKU-RED", itemName: "Red Tape" },
        ],
      },
      {
        level: 2,
        boxes: [
          { boxNo: 1, locationCode: "AB001-201", itemCode: "", itemName: "No item assigned" },
        ],
      },
    ],
  });
});

test("attaches the demo API to the browser global", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "../node-location-demo/app.js"),
    "utf8"
  );
  const context = {
    document: {
      addEventListener() {},
    },
  };
  context.globalThis = context;

  vm.runInNewContext(source, context);

  assert.equal(typeof context.NodeLocationDemo, "object");
  assert.equal(typeof context.NodeLocationDemo.getGenerateSummary, "function");
});
