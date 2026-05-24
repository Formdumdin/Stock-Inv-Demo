(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.NodeLocationDemo = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const GRID_SIZES = [8, 10, 12, 15];

  // Power Apps mapping: this object mirrors app-level variables/collections.
  // Use App.OnStart or Screen.OnVisible to ClearCollect colZones/colRows/colShelves
  // and Set selected ids, active tab, and edit mode variables.
  const state = createInitialState();

  function createInitialState() {
    return {
      activeTab: "topView",
      layoutEditMode: "shelf",
      selectedZoneId: null,
      selectedRowId: null,
      selectedShelfId: null,
      zones: [],
      rows: [],
      shelves: [],
      shelfBoxes: [],
      boxItems: [],
      generatedLocations: [],
      messages: [],
      idSeed: 1,
    };
  }

  function nextId(prefix, targetState) {
    const workingState = targetState || state;
    const id = `${prefix}-${String(workingState.idSeed).padStart(4, "0")}`;
    workingState.idSeed += 1;
    return id;
  }

  function normalizeZone(value) {
    const zone = String(value || "").trim().toUpperCase();
    if (!/^[A-Z0-9]$/.test(zone)) {
      throw new Error("Zone must be exactly 1 letter or number.");
    }
    return zone;
  }

  function normalizeRowCode(rowInput) {
    const row = String(rowInput || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{1,2}$/.test(row)) {
      throw new Error("Row input must be 1 or 2 letters/numbers.");
    }
    return row.length === 1 ? `${row}0` : row;
  }

  function normalizeShelfCode(shelfNo) {
    const shelf = Number(shelfNo);
    if (!Number.isInteger(shelf) || shelf < 1 || shelf > 99) {
      throw new Error("Shelf must be a number from 1 to 99.");
    }
    return String(shelf).padStart(2, "0");
  }

  function normalizeBoxCode(boxNo) {
    const box = Number(boxNo);
    if (!Number.isInteger(box) || box < 1 || box > 99) {
      throw new Error("Box must be a number from 1 to 99.");
    }
    return String(box).padStart(2, "0");
  }

  function buildDisplayName(rowInput, shelfNo) {
    return `${String(rowInput || "").trim().toUpperCase()}${Number(shelfNo)}`;
  }

  function buildLocationCode(zone, rowCode, shelfCode, level, boxCode) {
    const levelNo = Number(level);
    if (!Number.isInteger(levelNo) || levelNo < 1 || levelNo > 9) {
      throw new Error("Level must be a number from 1 to 9.");
    }
    return `${zone}${rowCode}${shelfCode}-${levelNo}${boxCode}`;
  }

  function gridPositionFromIndex(gridIndex, gridSize) {
    const index = Number(gridIndex);
    const size = Number(gridSize);
    if (!Number.isInteger(index) || !Number.isInteger(size) || index < 1 || index > size * size) {
      throw new Error("Grid index is outside the selected grid size.");
    }
    return {
      gridIndex: index,
      gridRow: Math.floor((index - 1) / size) + 1,
      gridCol: ((index - 1) % size) + 1,
    };
  }

  function gridIndexFromPosition(gridRow, gridCol, gridSize) {
    const row = Number(gridRow);
    const col = Number(gridCol);
    const size = Number(gridSize);
    if (row < 1 || col < 1 || row > size || col > size) {
      throw new Error("Grid position is outside the selected grid size.");
    }
    return (row - 1) * size + col;
  }

  function createZone(payload, targetState) {
    // Power Apps: call from Create Zone button OnSelect, then Collect(colZones,...)
    // and Navigate/Set(varActiveTab,"createRow") after validation.
    const workingState = targetState || state;
    const zoneCode = normalizeZone(payload.zoneCode);
    const gridSize = Number(payload.gridSize || 8);
    if (!GRID_SIZES.includes(gridSize)) {
      throw new Error("Invalid grid size. Use 8x8, 10x10, 12x12, or 15x15.");
    }
    if (workingState.zones.some((zone) => zone.zoneCode === zoneCode)) {
      throw new Error("Duplicate Zone is prevented.");
    }
    const zone = {
      id: nextId("zone", workingState),
      zoneCode,
      gridSize,
      totalCells: gridSize * gridSize,
      isActive: true,
    };
    workingState.zones.push(zone);
    workingState.selectedZoneId = zone.id;
    workingState.activeTab = "createRow";
    return zone;
  }

  function createRowShelves(payload, targetState) {
    // Power Apps: call from Create Row button OnSelect. Collect one row into colRows,
    // then ForAll(Sequence(ShelfCount), Collect(colShelves,...)).
    const workingState = targetState || state;
    const zone = findZone(payload.zoneId, workingState);
    const rowInput = String(payload.rowInput || "").trim().toUpperCase();
    const rowCode = normalizeRowCode(rowInput);
    const shelfCount = positiveInteger(payload.shelfCount, "Shelf count");
    const levelCount = positiveInteger(payload.levelCount, "Level count");
    if (levelCount > 9) {
      throw new Error("Level count must be 1 to 9 for the fixed code format.");
    }
    if (workingState.rows.some((row) => row.zoneId === zone.id && row.rowCode === rowCode)) {
      throw new Error("Duplicate Row in the same Zone is prevented.");
    }

    const row = {
      id: nextId("row", workingState),
      zoneId: zone.id,
      rowInput,
      rowCode,
      shelfCount,
      levelCount,
      isActive: true,
    };
    workingState.rows.push(row);

    for (let shelfNo = 1; shelfNo <= shelfCount; shelfNo += 1) {
      if (workingState.shelves.some((shelf) => shelf.rowId === row.id && shelf.shelfNo === shelfNo)) {
        throw new Error("Duplicate Shelf in the same Row is prevented.");
      }
      workingState.shelves.push({
        id: nextId("shelf", workingState),
        zoneId: zone.id,
        rowId: row.id,
        rowInput,
        rowCode,
        shelfNo,
        shelfCode: normalizeShelfCode(shelfNo),
        gridIndex: null,
        gridRow: null,
        gridCol: null,
        isPlaced: false,
        isActive: true,
        isVisible: true,
      });
    }

    workingState.selectedRowId = row.id;
    return row;
  }

  function placeShelf(payload, targetState) {
    // Power Apps: single-shelf move. Use on a grid cell OnSelect after selecting a shelf:
    // Patch(colShelves, selectedShelf, {gridIndex: ThisItem.gridIndex, ...}).
    const workingState = targetState || state;
    const shelf = findShelf(payload.shelfId, workingState);
    const zone = findZone(shelf.zoneId, workingState);
    const position = gridPositionFromIndex(payload.gridIndex, zone.gridSize);
    validateNoOverlap(
      {
        zoneId: zone.id,
        gridIndex: position.gridIndex,
        ignoreShelfIds: [shelf.id],
      },
      workingState
    );
    Object.assign(shelf, position, { isPlaced: true });
    workingState.selectedShelfId = shelf.id;
    return shelf;
  }

  function moveRowLayout(payload, targetState) {
    // Power Apps: row move. Use when varLayoutMode="row"; ForAll selected row shelves
    // and Patch each shelf with calculated gridIndex/gridRow/gridCol.
    const workingState = targetState || state;
    const row = findRow(payload.rowId, workingState);
    const zone = findZone(row.zoneId, workingState);
    const direction = payload.direction === "vertical" ? "vertical" : "horizontal";
    const stackOrder = payload.stackOrder === "x-1" ? "x-1" : "1-x";
    const start = gridPositionFromIndex(payload.startGridIndex, zone.gridSize);
    const rowShelves = getShelvesForRow(row.id, workingState).sort((a, b) => a.shelfNo - b.shelfNo);
    const orderedShelves = stackOrder === "x-1" ? rowShelves.slice().reverse() : rowShelves;
    const placements = [];

    orderedShelves.forEach((shelf, offset) => {
      const gridRow = start.gridRow + (direction === "vertical" ? offset : 0);
      const gridCol = start.gridCol + (direction === "horizontal" ? offset : 0);
      const gridIndex = gridIndexFromPosition(gridRow, gridCol, zone.gridSize);
      placements.push({ shelf, gridIndex, gridRow, gridCol });
    });

    placements.forEach((placement) => {
      validateNoOverlap(
        {
          zoneId: zone.id,
          gridIndex: placement.gridIndex,
          ignoreShelfIds: rowShelves.map((shelf) => shelf.id),
        },
        workingState
      );
    });

    placements.forEach((placement) => {
      Object.assign(placement.shelf, {
        gridIndex: placement.gridIndex,
        gridRow: placement.gridRow,
        gridCol: placement.gridCol,
        isPlaced: true,
      });
    });

    workingState.selectedRowId = row.id;
    return placements.map((placement) => placement.shelf);
  }

  function clearRowPlacement(rowId, targetState) {
    const workingState = targetState || state;
    getShelvesForRow(rowId, workingState).forEach((shelf) => {
      shelf.gridIndex = null;
      shelf.gridRow = null;
      shelf.gridCol = null;
      shelf.isPlaced = false;
    });
  }

  function validateNoOverlap(payload, targetState) {
    const workingState = targetState || state;
    const ignored = new Set(payload.ignoreShelfIds || []);
    const occupied = workingState.shelves.find(
      (shelf) =>
        shelf.zoneId === payload.zoneId &&
        shelf.isPlaced &&
        shelf.gridIndex === Number(payload.gridIndex) &&
        !ignored.has(shelf.id)
    );
    if (occupied) {
      throw new Error(`Shelf overlap is prevented at grid ${payload.gridIndex}.`);
    }
    return true;
  }

  function toggleShelfActive(shelfId, targetState) {
    // Power Apps: Active controls whether the shelf is included in Generate Locations.
    const shelf = findShelf(shelfId, targetState || state);
    shelf.isActive = !shelf.isActive;
    return shelf;
  }

  function toggleShelfVisible(shelfId, targetState) {
    // Power Apps: Show/Hide only affects Top View visibility. The shelf remains usable
    // and can still generate locations when Active.
    const shelf = findShelf(shelfId, targetState || state);
    shelf.isVisible = shelf.isVisible === false;
    return shelf;
  }

  function setShelfBoxCount(payload, targetState) {
    // Power Apps: call from Shelf/Box screen OnSelect, patching one selected shelf+level.
    const workingState = targetState || state;
    const shelf = findShelf(payload.shelfId, workingState);
    const level = positiveInteger(payload.level, "Level");
    const row = findRow(shelf.rowId, workingState);
    if (level > row.levelCount) {
      throw new Error("Level exceeds the Row level count.");
    }
    const boxCount = positiveInteger(payload.boxCount, "Box count");
    if (boxCount > 99) {
      throw new Error("Box count must be 1 to 99.");
    }
    const existing = workingState.shelfBoxes.find(
      (item) => item.shelfId === shelf.id && item.level === level
    );
    if (existing) {
      existing.boxCount = boxCount;
      return existing;
    }
    const shelfBox = {
      id: nextId("box", workingState),
      zoneId: shelf.zoneId,
      rowId: shelf.rowId,
      shelfId: shelf.id,
      level,
      boxCount,
    };
    workingState.shelfBoxes.push(shelfBox);
    return shelfBox;
  }

  function setBoxItem(payload, targetState) {
    // Demo-only stock preview. In the real app this comes from transaction/stock lookup,
    // not from Location Master setup.
    const workingState = targetState || state;
    const shelf = findShelf(payload.shelfId, workingState);
    const level = positiveInteger(payload.level, "Level");
    const boxNo = positiveInteger(payload.boxNo, "Box");
    const existing = workingState.boxItems.find(
      (item) => item.shelfId === shelf.id && item.level === level && item.boxNo === boxNo
    );
    if (existing) {
      existing.itemCode = payload.itemCode || "";
      existing.itemName = payload.itemName || "No item assigned";
      return existing;
    }
    const boxItem = {
      id: nextId("item", workingState),
      zoneId: shelf.zoneId,
      rowId: shelf.rowId,
      shelfId: shelf.id,
      level,
      boxNo,
      itemCode: payload.itemCode || "",
      itemName: payload.itemName || "No item assigned",
    };
    workingState.boxItems.push(boxItem);
    return boxItem;
  }

  function getShelfDetail(shelfId, targetState) {
    // Power Apps: this is the popup/gallery data shape. In Canvas, bind a modal gallery
    // to Filter(colShelfBoxes, ShelfId = varSelectedShelfId) plus stock lookup per box.
    const workingState = targetState || state;
    const shelf = findShelf(shelfId, workingState);
    const row = findRow(shelf.rowId, workingState);
    const zone = findZone(shelf.zoneId, workingState);
    const levels = [];
    let boxCount = 0;

    for (let level = 1; level <= row.levelCount; level += 1) {
      const shelfBox = workingState.shelfBoxes.find(
        (item) => item.shelfId === shelf.id && item.level === level
      );
      const count = shelfBox ? shelfBox.boxCount : 0;
      const boxes = [];
      for (let boxNo = 1; boxNo <= count; boxNo += 1) {
        const boxItem = workingState.boxItems.find(
          (item) => item.shelfId === shelf.id && item.level === level && item.boxNo === boxNo
        );
        boxes.push({
          boxNo,
          locationCode: buildLocationCode(
            zone.zoneCode,
            shelf.rowCode,
            shelf.shelfCode,
            level,
            normalizeBoxCode(boxNo)
          ),
          itemCode: boxItem ? boxItem.itemCode : "",
          itemName: boxItem ? boxItem.itemName : "No item assigned",
        });
      }
      boxCount += boxes.length;
      levels.push({ level, boxes });
    }

    return {
      displayName: buildDisplayName(shelf.rowInput, shelf.shelfNo),
      zoneCode: zone.zoneCode,
      rowInput: shelf.rowInput,
      rowCode: shelf.rowCode,
      shelfNo: shelf.shelfNo,
      shelfCode: shelf.shelfCode,
      gridIndex: shelf.gridIndex,
      gridRow: shelf.gridRow,
      gridCol: shelf.gridCol,
      levelCount: row.levelCount,
      boxCount,
      status: shelf.isActive ? "Active" : "Inactive",
      levels,
    };
  }

  function validateBeforeGenerate(payload, targetState) {
    // Power Apps: run on Generate button OnSelect before any Patch().
    // If this returns errors, show Notify()/summary and stop.
    const workingState = targetState || state;
    const zone = findZone(payload.zoneId || workingState.selectedZoneId, workingState);
    const activeShelves = workingState.shelves.filter(
      (shelf) => shelf.zoneId === zone.id && shelf.isActive
    );
    if (!activeShelves.length) {
      throw new Error("No active shelves are ready to generate.");
    }
    activeShelves.forEach((shelf) => {
      if (!shelf.isPlaced) {
        throw new Error(`Shelf ${buildDisplayName(shelf.rowInput, shelf.shelfNo)} is not placed.`);
      }
      const row = findRow(shelf.rowId, workingState);
      for (let level = 1; level <= row.levelCount; level += 1) {
        const shelfBox = workingState.shelfBoxes.find(
          (item) => item.shelfId === shelf.id && item.level === level
        );
        if (!shelfBox || !shelfBox.boxCount) {
          throw new Error(
            `Missing box setup for ${buildDisplayName(shelf.rowInput, shelf.shelfNo)} level ${level}.`
          );
        }
      }
    });

    const placedKeys = new Set();
    workingState.shelves
      .filter((shelf) => shelf.zoneId === zone.id && shelf.isPlaced)
      .forEach((shelf) => {
        if (placedKeys.has(shelf.gridIndex)) {
          throw new Error(`Duplicate shelf placement at grid ${shelf.gridIndex}.`);
        }
        placedKeys.add(shelf.gridIndex);
      });

    return { zone, activeShelves };
  }

  function checkExistingLocationCodes(locations, existingCodes) {
    const existing = new Set((existingCodes || []).map((code) => String(code).toUpperCase()));
    const collisions = locations.filter((location) => existing.has(location.locationCode));
    if (collisions.length) {
      throw new Error(`Duplicate existing location code: ${collisions[0].locationCode}`);
    }
    return true;
  }

  function getGenerateSummary(payload, targetState) {
    // Power Apps: use this shape for a pre-generate summary container.
    const workingState = targetState || state;
    try {
      const zone = findZone((payload && payload.zoneId) || workingState.selectedZoneId, workingState);
      const { activeShelves } = validateBeforeGenerate({ zoneId: zone.id }, workingState);
      const rows = workingState.rows.filter((row) => row.zoneId === zone.id);
      const shelves = workingState.shelves.filter((shelf) => shelf.zoneId === zone.id);
      const skippedShelfCount = shelves.filter((shelf) => !shelf.isActive).length;
      const seen = new Set();
      let duplicateCount = 0;
      let locationCount = 0;

      activeShelves.forEach((shelf) => {
        const row = findRow(shelf.rowId, workingState);
        for (let level = 1; level <= row.levelCount; level += 1) {
          const shelfBox = workingState.shelfBoxes.find(
            (item) => item.shelfId === shelf.id && item.level === level
          );
          for (let boxNo = 1; boxNo <= shelfBox.boxCount; boxNo += 1) {
            const locationCode = buildLocationCode(
              zone.zoneCode,
              shelf.rowCode,
              shelf.shelfCode,
              level,
              normalizeBoxCode(boxNo)
            );
            if (seen.has(locationCode)) {
              duplicateCount += 1;
            } else {
              seen.add(locationCode);
            }
            locationCount += 1;
          }
        }
      });

      const existingCodes = new Set(
        ((payload && payload.existingCodes) || []).map((code) => String(code).toUpperCase())
      );
      seen.forEach((code) => {
        if (existingCodes.has(code)) duplicateCount += 1;
      });

      return {
        zoneCount: 1,
        rowCount: rows.length,
        shelfCount: shelves.length,
        activeShelfCount: activeShelves.length,
        skippedShelfCount,
        locationCount,
        duplicateCount,
        errorCount: duplicateCount,
        errors: duplicateCount ? [`Duplicate location code count: ${duplicateCount}`] : [],
      };
    } catch (error) {
      const zoneId = (payload && payload.zoneId) || workingState.selectedZoneId;
      const rows = workingState.rows.filter((row) => row.zoneId === zoneId);
      const shelves = workingState.shelves.filter((shelf) => shelf.zoneId === zoneId);
      const skippedShelfCount = shelves.filter((shelf) => !shelf.isActive).length;
      return {
        zoneCount: zoneId ? 1 : 0,
        rowCount: rows.length,
        shelfCount: shelves.length,
        activeShelfCount: shelves.filter((shelf) => shelf.isActive).length,
        skippedShelfCount,
        locationCount: 0,
        duplicateCount: 0,
        errorCount: 1,
        errors: [error.message],
      };
    }
  }

  function generateLocations(payload, targetState) {
    // Power Apps: after validation passes, ForAll active shelves/levels/boxes and
    // Collect(colGeneratedLocations, ...) or Patch(SI_Location_Master,...).
    const workingState = targetState || state;
    const { zone, activeShelves } = validateBeforeGenerate(payload || {}, workingState);
    const seen = new Set();
    const locations = [];

    activeShelves.forEach((shelf) => {
      const row = findRow(shelf.rowId, workingState);
      for (let level = 1; level <= row.levelCount; level += 1) {
        const shelfBox = workingState.shelfBoxes.find(
          (item) => item.shelfId === shelf.id && item.level === level
        );
        for (let boxNo = 1; boxNo <= shelfBox.boxCount; boxNo += 1) {
          const boxCode = normalizeBoxCode(boxNo);
          const locationCode = buildLocationCode(
            zone.zoneCode,
            shelf.rowCode,
            shelf.shelfCode,
            level,
            boxCode
          );
          if (seen.has(locationCode)) {
            throw new Error(`Duplicate generated location code: ${locationCode}`);
          }
          seen.add(locationCode);
          locations.push({
            id: nextId("loc", workingState),
            zoneCode: zone.zoneCode,
            rowInput: shelf.rowInput,
            rowCode: shelf.rowCode,
            shelfNo: shelf.shelfNo,
            shelfCode: shelf.shelfCode,
            level,
            boxNo,
            boxCode,
            locationCode,
            isSelectable: true,
          });
        }
      }
    });

    checkExistingLocationCodes(locations, payload && payload.existingCodes);
    workingState.generatedLocations = workingState.generatedLocations.filter(
      (location) => location.zoneCode !== zone.zoneCode
    );
    workingState.generatedLocations.push(...locations);
    return locations;
  }

  function exportLayoutMaster(targetState) {
    // Power Apps: target shape for Patch(SI_Layout_Master,...).
    const workingState = targetState || state;
    return workingState.shelves.map((shelf) => {
      const zone = findZone(shelf.zoneId, workingState);
      const row = findRow(shelf.rowId, workingState);
      return {
        Title: `${zone.zoneCode}-${buildDisplayName(shelf.rowInput, shelf.shelfNo)}`,
        f_zone: zone.zoneCode,
        f_row_input: shelf.rowInput,
        f_row_code: shelf.rowCode,
        f_shelf_no: shelf.shelfNo,
        f_shelf_code: shelf.shelfCode,
        f_display_name: buildDisplayName(shelf.rowInput, shelf.shelfNo),
        f_grid_index: shelf.gridIndex,
        f_grid_row: shelf.gridRow,
        f_grid_col: shelf.gridCol,
        f_level_count: row.levelCount,
        f_is_placed: shelf.isPlaced,
        f_is_active: shelf.isActive,
        f_is_visible: shelf.isVisible !== false,
        f_is_selectable: shelf.isActive,
      };
    });
  }

  function exportLocationMaster(targetState) {
    // Power Apps: target shape for Patch(SI_Location_Master,...).
    const workingState = targetState || state;
    return workingState.generatedLocations.map((location) => ({
      Title: location.locationCode,
      f_location_code: location.locationCode,
      f_zone: location.zoneCode,
      f_row_input: location.rowInput,
      f_row_code: location.rowCode,
      f_shelf_no: location.shelfNo,
      f_shelf_code: location.shelfCode,
      f_level: location.level,
      f_box: location.boxNo,
      f_box_code: location.boxCode,
      f_is_selectable: location.isSelectable,
    }));
  }

  function positiveInteger(value, label) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) {
      throw new Error(`${label} must be a positive number.`);
    }
    return number;
  }

  function findZone(zoneId, workingState) {
    const zone = (workingState || state).zones.find((item) => item.id === zoneId);
    if (!zone) throw new Error("Zone is missing.");
    return zone;
  }

  function findRow(rowId, workingState) {
    const row = (workingState || state).rows.find((item) => item.id === rowId);
    if (!row) throw new Error("Row is missing.");
    return row;
  }

  function findShelf(shelfId, workingState) {
    const shelf = (workingState || state).shelves.find((item) => item.id === shelfId);
    if (!shelf) throw new Error("Shelf is missing.");
    return shelf;
  }

  function getShelvesForRow(rowId, workingState) {
    return (workingState || state).shelves.filter((shelf) => shelf.rowId === rowId);
  }

  function initBrowserApp() {
    if (typeof document === "undefined") return;
    seedDemoData();
    bindEvents();
    render();
  }

  function seedDemoData() {
    if (state.zones.length) return;
    const zone = createZone({ zoneCode: "A", gridSize: 8 }, state);
    const rowB = createRowShelves(
      { zoneId: zone.id, rowInput: "B", shelfCount: 5, levelCount: 4 },
      state
    );
    const rowG = createRowShelves(
      { zoneId: zone.id, rowInput: "G", shelfCount: 1, levelCount: 4 },
      state
    );
    moveRowLayout(
      { rowId: rowB.id, startGridIndex: 10, direction: "horizontal", stackOrder: "1-x" },
      state
    );
    moveRowLayout(
      { rowId: rowG.id, startGridIndex: 33, direction: "horizontal", stackOrder: "1-x" },
      state
    );
    state.shelves.forEach((shelf) => {
      const row = findRow(shelf.rowId, state);
      for (let level = 1; level <= row.levelCount; level += 1) {
        setShelfBoxCount(
          {
            shelfId: shelf.id,
            level,
            boxCount: shelf.rowInput === "G" ? 38 : 1,
          },
          state
        );
      }
    });
    const b2 = state.shelves.find((shelf) => shelf.rowInput === "B" && shelf.shelfNo === 2);
    const g1 = state.shelves.find((shelf) => shelf.rowInput === "G" && shelf.shelfNo === 1);
    if (b2) {
      setBoxItem(
        { shelfId: b2.id, level: 1, boxNo: 1, itemCode: "SKU-TAPE", itemName: "Packing Tape" },
        state
      );
      setBoxItem(
        { shelfId: b2.id, level: 2, boxNo: 1, itemCode: "SKU-LABEL", itemName: "Barcode Label" },
        state
      );
    }
    if (g1) {
      setBoxItem(
        { shelfId: g1.id, level: 4, boxNo: 38, itemCode: "SKU-QR", itemName: "QR Sticker Roll" },
        state
      );
    }
    state.activeTab = "topView";
    state.selectedZoneId = zone.id;
    state.selectedRowId = rowB.id;
  }

  function bindEvents() {
    // Power Apps mapping: each listener here represents a control OnSelect/OnChange.
    // Keep validation in the formula before Patch/Collect, then update local collections.
    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTab = button.dataset.tab;
        render();
      });
    });

    document.getElementById("zoneForm").addEventListener("submit", (event) => {
      event.preventDefault();
      runAction(() => {
        createZone(
          {
            zoneCode: document.getElementById("zoneCode").value,
            gridSize: Number(document.getElementById("zoneGridSize").value),
          },
          state
        );
      });
    });

    document.getElementById("rowForm").addEventListener("submit", (event) => {
      event.preventDefault();
      runAction(() => {
        const zoneId = state.selectedZoneId;
        createRowShelves(
          {
            zoneId,
            rowInput: document.getElementById("rowInput").value,
            shelfCount: Number(document.getElementById("shelfCount").value),
            levelCount: Number(document.getElementById("levelCount").value),
          },
          state
        );
        if (event.submitter && event.submitter.dataset.next === "layout") {
          state.activeTab = "editLayout";
        }
      });
    });

    document.getElementById("layoutForm").addEventListener("submit", (event) => {
      event.preventDefault();
      runAction(() => {
        moveRowLayout(
          {
            rowId: document.getElementById("layoutRow").value,
            startGridIndex: Number(document.getElementById("startGrid").value),
            direction: document.getElementById("direction").value,
            stackOrder: document.getElementById("stackOrder").value,
          },
          state
        );
      });
    });

    document.querySelectorAll("[data-layout-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        state.layoutEditMode = button.dataset.layoutMode;
        render();
      });
    });

    document.getElementById("singleShelfForm").addEventListener("submit", (event) => {
      event.preventDefault();
      runAction(() => {
        placeShelf(
          {
            shelfId: document.getElementById("layoutShelf").value,
            gridIndex: Number(document.getElementById("singleShelfGrid").value),
          },
          state
        );
      });
    });

    document.getElementById("clearRow").addEventListener("click", () => {
      runAction(() => clearRowPlacement(document.getElementById("layoutRow").value, state));
    });

    document.getElementById("boxForm").addEventListener("submit", (event) => {
      event.preventDefault();
      runAction(() => {
        const rowId = document.getElementById("boxRow").value;
        const level = Number(document.getElementById("boxLevel").value);
        const boxCount = Number(document.getElementById("boxCountInput").value);
        setShelfBoxCount({
          shelfId: document.getElementById("boxShelf").value,
          level,
          boxCount,
        }, state);
      });
    });

    document.getElementById("generateButton").addEventListener("click", () => {
      runAction(() => {
        generateLocations({ zoneId: state.selectedZoneId }, state);
        state.messages.unshift({ type: "success", text: "Generate complete. Output is ready." });
      });
    });

    document.getElementById("closeShelfDetail").addEventListener("click", closeShelfDetail);
    document.getElementById("shelfDetailModal").addEventListener("click", (event) => {
      if (event.target.id === "shelfDetailModal") closeShelfDetail();
    });
  }

  function runAction(action) {
    try {
      action();
      render();
    } catch (error) {
      state.messages.unshift({ type: "error", text: error.message });
      render();
    }
  }

  function render() {
    // Power Apps: this is equivalent to recalculating visible Galleries/Containers
    // after each OnSelect updates local collections or variables.
    renderTabs();
    renderSelectors();
    renderSummary();
    renderGrid();
    renderRows();
    renderShelfControls();
    renderBoxTab();
    renderGenerateSummary();
    renderOutputs();
    renderMessages();
  }

  function renderTabs() {
    // Power Apps: tab buttons set varActiveTab; each screen section uses
    // Visible = varActiveTab = "topView" / "editLayout" / ...
    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.tab === state.activeTab);
    });
    document.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.panel === state.activeTab);
    });
  }

  function renderSelectors() {
    // Power Apps: dropdown Items formulas come from filtered collections,
    // e.g. Filter(colRows, ZoneId = varSelectedZoneId).
    fillSelect(
      document.getElementById("zoneSelect"),
      state.zones,
      (zone) => zone.id,
      (zone) => `Zone ${zone.zoneCode} (${zone.gridSize}x${zone.gridSize})`,
      state.selectedZoneId
    );
    document.getElementById("zoneSelect").onchange = (event) => {
      state.selectedZoneId = event.target.value;
      render();
    };

    const rows = state.rows.filter((row) => row.zoneId === state.selectedZoneId);
    fillSelect(
      document.getElementById("layoutRow"),
      rows,
      (row) => row.id,
      (row) => `Row ${row.rowInput} / ${row.shelfCount} shelves`,
      state.selectedRowId
    );
    fillSelect(
      document.getElementById("boxRow"),
      rows,
      (row) => row.id,
      (row) => `Row ${row.rowInput}`,
      state.selectedRowId
    );
    const shelves = state.shelves.filter((shelf) => shelf.zoneId === state.selectedZoneId);
    fillSelect(
      document.getElementById("layoutShelf"),
      shelves,
      (shelf) => shelf.id,
      (shelf) =>
        `${buildDisplayName(shelf.rowInput, shelf.shelfNo)}${
          shelf.isPlaced ? ` / Grid ${shelf.gridIndex}` : " / Not Placed"
        }`,
      state.selectedShelfId || (shelves[0] && shelves[0].id)
    );
    document.getElementById("layoutRow").onchange = (event) => {
      state.selectedRowId = event.target.value;
      render();
    };
    document.getElementById("layoutShelf").onchange = (event) => {
      state.selectedShelfId = event.target.value;
      const shelf = state.shelves.find((item) => item.id === event.target.value);
      if (shelf) state.selectedRowId = shelf.rowId;
      render();
    };
    document.getElementById("boxRow").onchange = (event) => {
      state.selectedRowId = event.target.value;
      const firstShelf = state.shelves.find((shelf) => shelf.rowId === state.selectedRowId);
      if (firstShelf) state.selectedShelfId = firstShelf.id;
      render();
    };
    document.querySelectorAll("[data-layout-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.layoutMode === state.layoutEditMode);
    });
    document.querySelectorAll("[data-layout-section]").forEach((section) => {
      section.classList.toggle("is-hidden", section.dataset.layoutSection !== state.layoutEditMode);
    });
  }

  function fillSelect(select, items, valueGetter, labelGetter, selectedValue) {
    // Power Apps: generic dropdown binding helper. In Canvas this becomes Items,
    // DefaultSelectedItems, and OnChange = Set(varSelected..., Self.Selected.Id).
    select.innerHTML = "";
    items.forEach((item) => {
      const option = document.createElement("option");
      option.value = valueGetter(item);
      option.textContent = labelGetter(item);
      option.selected = option.value === selectedValue;
      select.appendChild(option);
    });
  }

  function renderSummary() {
    // Power Apps: bind these cards to CountRows(Filter(...)) formulas.
    const zone = state.zones.find((item) => item.id === state.selectedZoneId);
    const rows = state.rows.filter((row) => row.zoneId === state.selectedZoneId);
    const shelves = state.shelves.filter((shelf) => shelf.zoneId === state.selectedZoneId);
    const activeShelves = shelves.filter((shelf) => shelf.isActive);
    document.getElementById("summary").innerHTML = `
      <div><strong>${zone ? `Zone ${zone.zoneCode}` : "No Zone"}</strong><span>Selected zone</span></div>
      <div><strong>${rows.length}</strong><span>Rows</span></div>
      <div><strong>${shelves.length}</strong><span>Shelves</span></div>
      <div><strong>${activeShelves.length}</strong><span>Active shelves</span></div>
      <div><strong>${state.generatedLocations.length}</strong><span>Locations</span></div>
    `;
  }

  function renderGrid() {
    // Power Apps: grid Gallery Items = Sequence(varGridSize * varGridSize).
    // TemplateFill/label checks LookUp(colShelves, gridIndex = ThisItem.Value).
    const grid = document.getElementById("grid");
    const zone = state.zones.find((item) => item.id === state.selectedZoneId);
    grid.innerHTML = "";
    if (!zone) return;
    grid.style.gridTemplateColumns = `repeat(${zone.gridSize}, 1fr)`;
    const shelvesByIndex = new Map(
      state.shelves
        .filter((shelf) => shelf.zoneId === zone.id && shelf.isPlaced && shelf.isVisible !== false)
        .map((shelf) => [shelf.gridIndex, shelf])
    );
    for (let index = 1; index <= zone.totalCells; index += 1) {
      const cell = document.createElement("button");
      const shelf = shelvesByIndex.get(index);
      cell.className = "grid-cell";
      cell.type = "button";
      cell.textContent = String(index);
      if (shelf) {
        cell.textContent = buildDisplayName(shelf.rowInput, shelf.shelfNo);
        cell.classList.add("is-shelf");
        cell.classList.toggle("is-muted", !shelf.isActive);
        cell.onclick = () => {
          runAction(() => {
            state.selectedShelfId = shelf.id;
            state.selectedRowId = shelf.rowId;
            handleGridSelection(index, shelf.id);
          });
        };
      } else {
        cell.onclick = () => runAction(() => handleGridSelection(index));
      }
      grid.appendChild(cell);
    }
  }

  function handleGridSelection(gridIndex, clickedShelfId) {
    // Power Apps: grid cell OnSelect branches by varActiveTab and varLayoutMode.
    // Top View opens detail; Edit Layout either selects/moves one shelf or moves a row.
    if (state.activeTab !== "editLayout") {
      if (clickedShelfId) openShelfDetail(clickedShelfId);
      return;
    }
    if (state.layoutEditMode === "row") {
      if (state.selectedRowId) {
        moveRowLayout({
          rowId: state.selectedRowId,
          startGridIndex: gridIndex,
          direction: document.getElementById("direction").value,
          stackOrder: document.getElementById("stackOrder").value,
        }, state);
      }
      return;
    }
    if (clickedShelfId) {
      state.selectedShelfId = clickedShelfId;
      return;
    }
    if (state.selectedShelfId) {
      placeShelf({ shelfId: state.selectedShelfId, gridIndex }, state);
    }
  }

  function renderRows() {
    // Power Apps: Row lists are Galleries. OnSelect sets varSelectedRowId.
    const rowsEl = document.getElementById("rowList");
    const rows = state.rows.filter((row) => row.zoneId === state.selectedZoneId);
    rowsEl.innerHTML = rows
      .map((row) => {
        const shelves = getShelvesForRow(row.id, state);
        const placed = shelves.filter((shelf) => shelf.isPlaced).length;
        return `
          <button class="row-card ${row.id === state.selectedRowId ? "is-active" : ""}" data-row="${row.id}" type="button">
            <strong>Row ${row.rowInput}</strong>
            <span>${row.rowCode} / ${placed}-${shelves.length} placed / Level ${row.levelCount}</span>
          </button>
        `;
      })
      .join("");
    rowsEl.querySelectorAll("[data-row]").forEach((button) => {
      button.onclick = () => {
        state.selectedRowId = button.dataset.row;
        render();
      };
    });
    const createRowList = document.getElementById("createRowList");
    if (createRowList) {
      createRowList.innerHTML = rows.length
        ? rows
            .map((row) => {
              const shelves = getShelvesForRow(row.id, state);
              return `<button class="row-card" data-row="${row.id}" type="button"><strong>Row ${row.rowInput}</strong><span>${shelves.length} shelves / ${row.levelCount} levels</span></button>`;
            })
            .join("")
        : `<p class="empty-text">No rows yet.</p>`;
    }
  }

  function renderShelfControls() {
    // Power Apps: shelf action list is a Gallery. Active button patches IsActive;
    // Show/Hide patches IsVisible without affecting generate eligibility.
    const shelfPanel = document.getElementById("shelfControls");
    const rowId = state.selectedRowId;
    const shelves = rowId ? getShelvesForRow(rowId, state) : [];
    shelfPanel.innerHTML = shelves
      .map(
        (shelf) => `
          <div class="shelf-row">
            <button type="button" data-select-shelf="${shelf.id}" class="${shelf.id === state.selectedShelfId ? "is-selected" : ""}">
              ${buildDisplayName(shelf.rowInput, shelf.shelfNo)}
            </button>
            <span>${shelf.isPlaced ? `Grid ${shelf.gridIndex}` : "Not Placed"}</span>
            <button type="button" data-toggle-active="${shelf.id}">${shelf.isActive ? "Active" : "Inactive"}</button>
            <button type="button" data-toggle-visible="${shelf.id}">${shelf.isVisible === false ? "Show" : "Hide"}</button>
          </div>
        `
      )
      .join("");
    shelfPanel.querySelectorAll("[data-select-shelf]").forEach((button) => {
      button.onclick = () => {
        state.selectedShelfId = button.dataset.selectShelf;
        render();
      };
    });
    shelfPanel.querySelectorAll("[data-toggle-active]").forEach((button) => {
      button.onclick = () => runAction(() => toggleShelfActive(button.dataset.toggleActive, state));
    });
    shelfPanel.querySelectorAll("[data-toggle-visible]").forEach((button) => {
      button.onclick = () => runAction(() => toggleShelfVisible(button.dataset.toggleVisible, state));
    });
  }

  function renderBoxTab() {
    // Power Apps: Shelf/Box tab selects exactly one Shelf, then patches one
    // shelf+level record in colShelfBoxes.
    const row = state.rows.find((item) => item.id === state.selectedRowId);
    const shelves = row ? getShelvesForRow(row.id, state) : [];
    fillSelect(
      document.getElementById("boxShelf"),
      shelves,
      (shelf) => shelf.id,
      (shelf) => buildDisplayName(shelf.rowInput, shelf.shelfNo),
      state.selectedShelfId || (shelves[0] && shelves[0].id)
    );
    document.getElementById("boxShelf").onchange = (event) => {
      state.selectedShelfId = event.target.value;
      render();
    };
    const levelSelect = document.getElementById("boxLevel");
    levelSelect.innerHTML = "";
    if (row) {
      for (let level = 1; level <= row.levelCount; level += 1) {
        const option = document.createElement("option");
        option.value = String(level);
        option.textContent = `Level ${level}`;
        levelSelect.appendChild(option);
      }
    }
    renderBoxShelfList(shelves);
    document.getElementById("codePreview").textContent = previewCodes();
  }

  function renderBoxShelfList(shelves) {
    // Power Apps: Items = Filter(colShelves, RowId = varSelectedRowId).
    // OnSelect = Set(varSelectedShelfId, ThisItem.Id).
    const list = document.getElementById("boxShelfList");
    if (!list) return;
    list.innerHTML = shelves.length
      ? shelves
          .map(
            (shelf) => `
              <button class="row-card ${shelf.id === state.selectedShelfId ? "is-active" : ""}" data-box-shelf="${shelf.id}" type="button">
                <strong>${buildDisplayName(shelf.rowInput, shelf.shelfNo)}</strong>
                <span>${shelf.isActive ? "Active" : "Inactive"} / ${shelf.isPlaced ? `Grid ${shelf.gridIndex}` : "Not Placed"}</span>
              </button>
            `
          )
          .join("")
      : `<p class="empty-text">Select a row first.</p>`;
    list.querySelectorAll("[data-box-shelf]").forEach((button) => {
      button.onclick = () => {
        state.selectedShelfId = button.dataset.boxShelf;
        render();
      };
    });
  }

  function renderGenerateSummary() {
    // Power Apps: use CountRows + validation collections to show this summary
    // before running ForAll/Patch into SharePoint.
    const summary = getGenerateSummary({ zoneId: state.selectedZoneId }, state);
    const summaryEl = document.getElementById("generateSummary");
    if (!summaryEl) return;
    summaryEl.innerHTML = `
      <div><strong>${summary.zoneCount}</strong><span>Zone</span></div>
      <div><strong>${summary.rowCount}</strong><span>Rows</span></div>
      <div><strong>${summary.shelfCount}</strong><span>Shelves</span></div>
      <div><strong>${summary.locationCount}</strong><span>Locations</span></div>
      <div><strong>${summary.errorCount}</strong><span>Errors</span></div>
      ${summary.errors.length ? `<p>${summary.errors.join("<br>")}</p>` : ""}
    `;
  }

  function previewCodes() {
    // Power Apps: preview Gallery can use the same generated collection before Patch.
    try {
      const working = cloneState(state);
      const generated = generateLocations({ zoneId: working.selectedZoneId }, working).slice(0, 20);
      return generated.map((location) => location.locationCode).join("\n") || "No preview yet";
    } catch (error) {
      return error.message;
    }
  }

  function cloneState(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function renderOutputs() {
    // Demo-only JSON preview. In Power Apps, these shapes become Patch payloads.
    document.getElementById("layoutOutput").textContent = JSON.stringify(
      exportLayoutMaster(state).slice(0, 10),
      null,
      2
    );
    document.getElementById("locationOutput").textContent = JSON.stringify(
      exportLocationMaster(state).slice(0, 20),
      null,
      2
    );
  }

  function renderMessages() {
    // Power Apps: replace message list with Notify() or a status container.
    document.getElementById("messages").innerHTML = state.messages
      .slice(0, 4)
      .map((message) => `<div class="message ${message.type}">${message.text}</div>`)
      .join("");
  }

  function openShelfDetail(shelfId) {
    // Power Apps: Top View shelf OnSelect = Set(varSelectedShelfId, ThisItem.Id);
    // UpdateContext({locShowShelfPopup:true}). The popup galleries bind to
    // getShelfDetail-equivalent filtered collections.
    const detail = getShelfDetail(shelfId, state);
    const modal = document.getElementById("shelfDetailModal");
    const body = document.getElementById("shelfDetailBody");
    if (!modal || !body) return;
    body.innerHTML = `
      <div class="detail-head">
        <div>
          <span>Shelf</span>
          <strong>${detail.displayName}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>${detail.status}</strong>
        </div>
        <div>
          <span>Grid</span>
          <strong>${detail.gridIndex || "Not Placed"}</strong>
        </div>
      </div>
      <div class="detail-meta">
        Zone ${detail.zoneCode} / RowCode ${detail.rowCode} / ShelfCode ${detail.shelfCode}
        / ${detail.levelCount} Levels / ${detail.boxCount} Boxes
      </div>
      ${detail.levels
        .map(
          (level) => `
            <section class="level-detail">
              <h4>Level ${level.level}</h4>
              ${
                level.boxes.length
                  ? level.boxes
                      .map(
                        (box) => `
                          <div class="box-detail">
                            <strong>Box ${box.boxNo}</strong>
                            <code>${box.locationCode}</code>
                            <span>${box.itemCode ? `${box.itemCode} - ${box.itemName}` : box.itemName}</span>
                          </div>
                        `
                      )
                      .join("")
                  : `<p>No box setup for this level.</p>`
              }
            </section>
          `
        )
        .join("")}
    `;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeShelfDetail() {
    const modal = document.getElementById("shelfDetailModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initBrowserApp);
  }

  return {
    GRID_SIZES,
    state,
    createInitialState,
    normalizeZone,
    normalizeRowCode,
    normalizeShelfCode,
    normalizeBoxCode,
    buildDisplayName,
    buildLocationCode,
    gridPositionFromIndex,
    gridIndexFromPosition,
    createZone,
    createRowShelves,
    placeShelf,
    moveRowLayout,
    clearRowPlacement,
    validateNoOverlap,
    toggleShelfActive,
    toggleShelfVisible,
    setShelfBoxCount,
    setBoxItem,
    getShelfDetail,
    validateBeforeGenerate,
    checkExistingLocationCodes,
    getGenerateSummary,
    generateLocations,
    exportLayoutMaster,
    exportLocationMaster,
  };
});
