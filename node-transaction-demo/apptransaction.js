(function (root, factory) {
  let mockDb = root.StockTransactionMockDb;
  if (typeof module === "object" && module.exports) {
    mockDb = require("./mock-dbtransaction.js");
    module.exports = factory(mockDb);
  } else {
    root.StockTransactionDemo = factory(mockDb);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (mockDb) {
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const DB_DECIMAL_PLACES = 6;
  const DB_DECIMAL_FACTOR = 10 ** DB_DECIMAL_PLACES;

  function roundDbDecimal(value) {
    // Power Apps / SharePoint mapping:
    // Use this rule before Patch() for every Number column that stores weight or stock.
    // The SharePoint DB convention for this project is 6 decimal places for both kg and g fields.
    return Math.round((Number(value) + Number.EPSILON) * DB_DECIMAL_FACTOR) / DB_DECIMAL_FACTOR;
  }

  function roundKg(value) {
    // Backend stock movement uses kg. All balances, f_qty, f_qty_effect,
    // f_before_on_hand, and f_after_on_hand must pass through 6-decimal rounding.
    return roundDbDecimal(value);
  }

  function roundG(value) {
    // User-facing input is grams, but audit fields such as f_input_weight_g and
    // f_unit_weight_g are still stored as DB numbers, so they also use 6 decimals.
    return roundDbDecimal(value);
  }

  function normalizeCode(value, fieldName) {
    const code = String(value || "").trim().toUpperCase();
    if (!code) throw new Error(`${fieldName} is required.`);
    return code;
  }

  function createInitialState(seed) {
    const source = seed || mockDb;
    return {
      items: clone(source.itemMaster),
      locations: clone(source.locationMaster),
      mappings: clone(source.itemLocationMappings),
      transactions: clone(source.transactions),
      pendingConfirmation: null,
      selectedItemCode: "001-0041-05-0",
      selectedLocationCode: "AD001-101",
      inputWeightG: 800,
      messages: [],
      transactionSeed: 1,
    };
  }

  function toItem(row) {
    const usageKg = Number(row.usage_kg);
    if (!Number.isFinite(usageKg) || usageKg <= 0) {
      throw new Error(`Invalid usage_kg for item ${row.item_code}.`);
    }
    return {
      itemCode: row.item_code,
      itemName: row.item_name,
      usageKg,
      unitWeightG: roundG(usageKg * 1000),
      raw: row,
    };
  }

  function toLocation(row) {
    return {
      locationCode: row.f_location_code,
      zone: row.f_zone,
      row: row.f_row,
      shelf: row.f_shelf,
      level: Number(row.f_level),
      box: row.f_box,
      rowInput: row.f_row_input,
      rowCode: row.f_row_code,
      shelfNo: Number(row.f_shelf_no),
      shelfCode: row.f_shelf_code,
      boxCode: row.f_box_code,
      layoutKey: row.f_layout_key,
      raw: row,
    };
  }

  function normalizeMapping(row) {
    return {
      itemLocationKey: row.f_item_location_key,
      itemCode: row.f_item_code,
      itemName: row.f_item_name,
      locationCode: row.f_location_code,
      zone: row.f_zone,
      row: row.f_row,
      shelf: row.f_shelf,
      level: Number(row.f_level),
      box: row.f_box,
      openBalanceKg: roundKg(row.f_open_balance || 0),
      receiptQtyKg: roundKg(row.f_receipt_qty || 0),
      issueQtyKg: roundKg(row.f_issue_qty || 0),
      adjustInQtyKg: roundKg(row.f_adjust_in_qty || 0),
      adjustOutQtyKg: roundKg(row.f_adjust_out_qty || 0),
      onHandKg: roundKg(row.f_on_hand_qty || 0),
      maxCapacityKg: row.f_max_capacity === "" ? "" : roundKg(row.f_max_capacity || 0),
      lastTransactionNo: row.f_last_transaction_no || "",
      lastTransactionDate: row.f_last_transaction_date || "",
    };
  }

  function exportMapping(row) {
    return {
      f_item_location_key: row.itemLocationKey,
      f_item_code: row.itemCode,
      f_item_name: row.itemName,
      f_location_code: row.locationCode,
      f_zone: row.zone,
      f_row: row.row,
      f_shelf: row.shelf,
      f_level: row.level,
      f_box: row.box,
      f_open_balance: row.openBalanceKg,
      f_receipt_qty: row.receiptQtyKg,
      f_issue_qty: row.issueQtyKg,
      f_adjust_in_qty: row.adjustInQtyKg,
      f_adjust_out_qty: row.adjustOutQtyKg,
      f_on_hand_qty: row.onHandKg,
      f_max_capacity: row.maxCapacityKg,
      f_last_transaction_no: row.lastTransactionNo,
      f_last_transaction_date: row.lastTransactionDate,
      "Item Type": "Item",
      Path: "sites/ADMIN/General/Lists/SI_Item_Mapping_Location",
    };
  }

  function findItemByCode(itemCode, state) {
    const code = normalizeCode(itemCode, "Item code");
    const row = state.items.find((item) => normalizeCode(item.item_code, "Item code") === code);
    if (!row) throw new Error(`Item code not found: ${code}`);
    return toItem(row);
  }

  function findLocationByCode(locationCode, state) {
    const code = normalizeCode(locationCode, "Location code");
    const row = state.locations.find((location) => normalizeCode(location.f_location_code, "Location code") === code);
    if (!row) throw new Error(`Location code not found: ${code}`);
    return toLocation(row);
  }

  function mappingKey(itemCode, locationCode) {
    return `${normalizeCode(itemCode, "Item code")}|${normalizeCode(locationCode, "Location code")}`;
  }

  function getMapping(itemCode, locationCode, state) {
    const key = mappingKey(itemCode, locationCode);
    const row = state.mappings.find((mapping) => mapping.f_item_location_key === key);
    return row ? normalizeMapping(row) : null;
  }

  function calculateTransactionWeight(payload) {
    // Power Apps formula shape:
    // Set(varInputWeightG, Round(Value(txtTotalWeight.Text), 6));
    // Set(varUnitWeightG, Round(Value(varItem.usage_kg) * 1000, 6));
    // Set(varTransactionWeightKg, Round(varInputWeightG / 1000, 6));
    // Set(varCalculatedPcs, Round(varInputWeightG / varUnitWeightG, 0));
    const totalWeightG = Number(payload.totalWeightG);
    const unitWeightKg = Number(payload.unitWeightKg);
    if (!Number.isFinite(totalWeightG) || totalWeightG <= 0) {
      throw new Error("Total weight must be greater than 0 g.");
    }
    if (!Number.isFinite(unitWeightKg) || unitWeightKg <= 0) {
      throw new Error("Unit weight must be greater than 0 kg.");
    }
    const unitWeightG = roundG(unitWeightKg * 1000);
    return {
      inputWeightG: roundG(totalWeightG),
      unitWeightG,
      transactionWeightKg: roundKg(totalWeightG / 1000),
      calculatedPcs: Math.round(totalWeightG / unitWeightG),
    };
  }

  function kgToPcs(kg, unitWeightKg) {
    if (!unitWeightKg) return 0;
    return Math.round(roundKg(kg) / unitWeightKg);
  }

  function getMonthlyAccum(itemCode, state, date) {
    const code = normalizeCode(itemCode, "Item code");
    const target = date ? new Date(date) : new Date();
    const month = target.getMonth();
    const year = target.getFullYear();
    return state.transactions.reduce(
      (acc, transaction) => {
        const trxDate = new Date(transaction.f_transaction_date);
        if (
          transaction.f_item_code === code &&
          trxDate.getMonth() === month &&
          trxDate.getFullYear() === year &&
          transaction.f_status === "POSTED"
        ) {
          if (transaction.f_transaction_type === "IN") acc.inKg = roundKg(acc.inKg + transaction.f_qty);
          if (transaction.f_transaction_type === "OUT") acc.outKg = roundKg(acc.outKg + transaction.f_qty);
        }
        return acc;
      },
      { inKg: 0, outKg: 0 }
    );
  }

  function createMapping(item, location) {
    return {
      f_item_location_key: mappingKey(item.itemCode, location.locationCode),
      f_item_code: item.itemCode,
      f_item_name: item.itemName,
      f_location_code: location.locationCode,
      f_zone: location.zone,
      f_row: location.row,
      f_shelf: location.shelf,
      f_level: location.level,
      f_box: location.box,
      f_open_balance: 0,
      f_receipt_qty: 0,
      f_issue_qty: 0,
      f_adjust_in_qty: 0,
      f_adjust_out_qty: 0,
      f_on_hand_qty: 0,
      f_max_capacity: "",
      f_last_transaction_no: "",
      f_last_transaction_date: "",
    };
  }

  function buildConfirmation(mode, item, location, mapping, calculation, state, now) {
    const sign = mode === "IN" ? 1 : -1;
    const beforeKg = mapping ? mapping.onHandKg : 0;
    const changeKg = roundKg(calculation.transactionWeightKg * sign);
    const afterKg = roundKg(beforeKg + changeKg);
    const monthlyBefore = getMonthlyAccum(item.itemCode, state, now);
    const monthlyAfter = {
      inKg: roundKg(monthlyBefore.inKg + (mode === "IN" ? calculation.transactionWeightKg : 0)),
      outKg: roundKg(monthlyBefore.outKg + (mode === "OUT" ? calculation.transactionWeightKg : 0)),
    };

    return {
      mode,
      item,
      location,
      input: calculation,
      onHand: {
        beforeKg,
        beforePcs: kgToPcs(beforeKg, item.usageKg),
        changeKg,
        changePcs: calculation.calculatedPcs * sign,
        afterKg,
        afterPcs: kgToPcs(afterKg, item.usageKg),
      },
      monthly: {
        beforeInKg: monthlyBefore.inKg,
        beforeInPcs: kgToPcs(monthlyBefore.inKg, item.usageKg),
        beforeOutKg: monthlyBefore.outKg,
        beforeOutPcs: kgToPcs(monthlyBefore.outKg, item.usageKg),
        afterInKg: monthlyAfter.inKg,
        afterInPcs: kgToPcs(monthlyAfter.inKg, item.usageKg),
        afterOutKg: monthlyAfter.outKg,
        afterOutPcs: kgToPcs(monthlyAfter.outKg, item.usageKg),
      },
    };
  }

  function prepareTransaction(payload, state) {
    // Power Apps / Canvas App equivalent:
    // IN/OUT button OnSelect should only build varPendingTransaction and open the popup.
    // Do not Patch SI_Item_Mapping_Location or SI_Item_Transaction_Barcode here.
    const mode = normalizeCode(payload.mode, "Transaction mode");
    if (mode !== "IN" && mode !== "OUT") throw new Error("Transaction mode must be IN or OUT.");
    const item = findItemByCode(payload.itemCode, state);
    const location = findLocationByCode(payload.locationCode, state);
    const mapping = getMapping(item.itemCode, location.locationCode, state);
    const calculation = calculateTransactionWeight({
      totalWeightG: payload.inputWeightG,
      unitWeightKg: item.usageKg,
    });

    if (mode === "OUT" && !mapping) {
      throw new Error("Insufficient on-hand: item has no balance in this location.");
    }
    if (mode === "OUT" && mapping.onHandKg < calculation.transactionWeightKg) {
      throw new Error("Insufficient on-hand for OUT transaction.");
    }

    state.pendingConfirmation = {
      ...buildConfirmation(mode, item, location, mapping, calculation, state, payload.now),
      referenceNo: payload.referenceNo || "",
      remark: payload.remark || "",
      createdByEmail: payload.createdByEmail || "demo.user@local",
      createdByName: payload.createdByName || "Demo User",
      preparedAt: payload.now || new Date().toISOString(),
    };
    return state.pendingConfirmation;
  }

  function cancelPendingTransaction(state) {
    if (!state.pendingConfirmation) return false;
    state.pendingConfirmation = null;
    return true;
  }

  function nextTransactionNo(state) {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const no = `TRX-${stamp}-${String(state.transactionSeed).padStart(4, "0")}`;
    state.transactionSeed += 1;
    return no;
  }

  function confirmPendingTransaction(state) {
    // Power Apps / Canvas App equivalent:
    // Confirm button OnSelect runs this phase. It patches mapping balance first,
    // then patches one SI_Item_Transaction_Barcode row with before/after audit fields.
    const pending = state.pendingConfirmation;
    if (!pending) throw new Error("No pending transaction to confirm.");
    let mappingRow = state.mappings.find(
      (row) => row.f_item_location_key === mappingKey(pending.item.itemCode, pending.location.locationCode)
    );
    if (!mappingRow) {
      if (pending.mode === "OUT") throw new Error("Cannot issue stock from missing mapping.");
      mappingRow = createMapping(pending.item, pending.location);
      state.mappings.push(mappingRow);
    }

    const beforeKg = roundKg(mappingRow.f_on_hand_qty || 0);
    const qtyKg = pending.input.transactionWeightKg;
    const signedKg = roundKg(qtyKg * (pending.mode === "IN" ? 1 : -1));
    const afterKg = roundKg(beforeKg + signedKg);
    if (afterKg < 0) throw new Error("Insufficient on-hand for OUT transaction.");

    mappingRow.f_on_hand_qty = afterKg;
    if (pending.mode === "IN") mappingRow.f_receipt_qty = roundKg((mappingRow.f_receipt_qty || 0) + qtyKg);
    if (pending.mode === "OUT") mappingRow.f_issue_qty = roundKg((mappingRow.f_issue_qty || 0) + qtyKg);

    const transactionNo = nextTransactionNo(state);
    const transactionDate = pending.preparedAt || new Date().toISOString();
    mappingRow.f_last_transaction_no = transactionNo;
    mappingRow.f_last_transaction_date = transactionDate;

    const transaction = {
      // SI_Item_Transaction_Barcode Patch shape.
      // Keep kg as the authoritative movement quantity, but store the original gram input too.
      f_transaction_no: transactionNo,
      f_transaction_type: pending.mode,
      f_item_code: pending.item.itemCode,
      f_item_name: pending.item.itemName,
      f_location_code: pending.location.locationCode,
      f_qty: qtyKg,
      f_qty_sign: pending.mode === "IN" ? 1 : -1,
      f_qty_effect: signedKg,
      f_before_on_hand: beforeKg,
      f_after_on_hand: afterKg,
      f_reference_no: pending.referenceNo,
      f_remark: pending.remark,
      f_transaction_date: transactionDate,
      f_created_by_email: pending.createdByEmail,
      f_created_by_name: pending.createdByName,
      f_status: "POSTED",
      f_input_weight_g: pending.input.inputWeightG,
      f_unit_weight_g: pending.input.unitWeightG,
      f_transaction_weight_kg: qtyKg,
      f_calculated_pcs: pending.input.calculatedPcs,
      "Item Type": "Item",
      Path: "sites/ADMIN/General/Lists/SI_Item_Transaction_Barcode",
    };

    state.transactions.push(transaction);
    state.pendingConfirmation = null;
    return transaction;
  }

  function exportItemMappingLocation(state) {
    return state.mappings.map((row) => exportMapping(normalizeMapping(row)));
  }

  function exportTransactions(state) {
    return state.transactions.map((row) => ({ ...row }));
  }

  function getItemLocationBalances(itemCode, state) {
    const code = normalizeCode(itemCode, "Item code");
    return state.mappings
      .filter((mapping) => mapping.f_item_code === code)
      .map((mapping) => {
        const item = findItemByCode(mapping.f_item_code, state);
        return {
          ...normalizeMapping(mapping),
          onHandPcs: kgToPcs(mapping.f_on_hand_qty || 0, item.usageKg),
        };
      });
  }

  function initBrowser() {
    const state = createInitialState();
    const $ = (id) => document.getElementById(id);

    function fmtKg(value) {
      return `${roundKg(value).toLocaleString(undefined, { maximumFractionDigits: 6 })} kg`;
    }

    function fmtG(value) {
      return `${roundG(value).toLocaleString(undefined, { maximumFractionDigits: 6 })} g`;
    }

    function fillOptions(select, items, getValue, getLabel, selected) {
      select.innerHTML = items
        .map((item) => {
          const value = getValue(item);
          return `<option value="${value}" ${value === selected ? "selected" : ""}>${getLabel(item)}</option>`;
        })
        .join("");
    }

    function selectedItem() {
      return findItemByCode($("itemCode").value, state);
    }

    function selectedLocation() {
      return findLocationByCode($("locationCode").value, state);
    }

    function renderItemLocation() {
      const item = selectedItem();
      const location = selectedLocation();
      const mapping = getMapping(item.itemCode, location.locationCode, state);
      const calculation = calculateTransactionWeight({
        totalWeightG: Number($("totalWeightG").value || 0),
        unitWeightKg: item.usageKg,
      });

      $("itemDescription").textContent = item.itemName;
      $("unitWeightG").value = item.unitWeightG;
      $("calculatedPcs").value = calculation.calculatedPcs;
      $("locationRow").textContent = location.row;
      $("locationShelf").textContent = location.shelf;
      $("locationLevel").textContent = location.level;
      $("locationBox").textContent = location.box;
      $("onHandPcs").textContent = kgToPcs(mapping ? mapping.onHandKg : 0, item.usageKg).toLocaleString();
      $("onHandKg").textContent = fmtKg(mapping ? mapping.onHandKg : 0);
      renderRightPanel(item);
    }

    function renderRightPanel(item) {
      const monthly = getMonthlyAccum(item.itemCode, state);
      $("monthlyIn").textContent = kgToPcs(monthly.inKg, item.usageKg).toLocaleString();
      $("monthlyOut").textContent = kgToPcs(monthly.outKg, item.usageKg).toLocaleString();
      const balances = getItemLocationBalances(item.itemCode, state);
      $("balanceList").innerHTML = balances.length
        ? balances
            .map(
              (row) => `
                <div class="balance-row">
                  <strong>${row.locationCode}</strong>
                  <span>${row.onHandPcs.toLocaleString()} pcs</span>
                  <small>${fmtKg(row.onHandKg)}</small>
                </div>`
            )
            .join("")
        : `<p class="empty">No stock mapping for this item yet.</p>`;
    }

    function showMessage(text, type) {
      $("message").className = `message ${type || ""}`;
      $("message").textContent = text;
    }

    function renderConfirm() {
      const pending = state.pendingConfirmation;
      const modal = $("confirmModal");
      if (!pending) {
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        return;
      }
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      $("confirmCard").className = `confirm-card ${pending.mode === "IN" ? "is-in" : "is-out"}`;
      $("confirmTitle").textContent = `${pending.mode} / ${pending.mode === "IN" ? "รับเข้า" : "นำออก"}`;
      $("confirmBody").innerHTML = `
        <section>
          <h3>Item</h3>
          <p><strong>${pending.item.itemCode}</strong></p>
          <p>${pending.item.itemName}</p>
          <p>Unit Weight: ${fmtG(pending.item.unitWeightG)} / Pcs</p>
        </section>
        <section>
          <h3>Location</h3>
          <p><strong>${pending.location.locationCode}</strong></p>
          <p>Row ${pending.location.row} / Shelf ${pending.location.shelf} / Level ${pending.location.level} / Box ${pending.location.box}</p>
        </section>
        <section class="confirm-grid">
          <div><span>User Input</span><strong>${fmtG(pending.input.inputWeightG)}</strong></div>
          <div><span>Transaction</span><strong>${fmtKg(pending.input.transactionWeightKg)}</strong></div>
          <div><span>Calculated</span><strong>${pending.input.calculatedPcs.toLocaleString()} pcs</strong></div>
        </section>
        <section class="confirm-grid">
          <div><span>Before</span><strong>${pending.onHand.beforePcs.toLocaleString()} pcs</strong><small>${fmtKg(pending.onHand.beforeKg)}</small></div>
          <div><span>Change</span><strong>${pending.onHand.changePcs > 0 ? "+" : ""}${pending.onHand.changePcs.toLocaleString()} pcs</strong><small>${pending.onHand.changeKg > 0 ? "+" : ""}${fmtKg(pending.onHand.changeKg)}</small></div>
          <div><span>After</span><strong>${pending.onHand.afterPcs.toLocaleString()} pcs</strong><small>${fmtKg(pending.onHand.afterKg)}</small></div>
        </section>
        <section class="confirm-grid">
          <div><span>Accum IN Before</span><strong>${pending.monthly.beforeInPcs.toLocaleString()} pcs</strong><small>${fmtKg(pending.monthly.beforeInKg)}</small></div>
          <div><span>Accum OUT Before</span><strong>${pending.monthly.beforeOutPcs.toLocaleString()} pcs</strong><small>${fmtKg(pending.monthly.beforeOutKg)}</small></div>
          <div><span>Accum After</span><strong>IN ${pending.monthly.afterInPcs.toLocaleString()} / OUT ${pending.monthly.afterOutPcs.toLocaleString()} pcs</strong><small>${fmtKg(pending.monthly.afterInKg)} / ${fmtKg(pending.monthly.afterOutKg)}</small></div>
        </section>
      `;
    }

    function submitMode(mode) {
      try {
        prepareTransaction(
          {
            mode,
            itemCode: $("itemCode").value,
            locationCode: $("locationCode").value,
            inputWeightG: Number($("totalWeightG").value),
            referenceNo: $("referenceNo").value,
            remark: $("remark").value,
          },
          state
        );
        showMessage("Please confirm transaction before posting.", "info");
        renderConfirm();
      } catch (error) {
        showMessage(error.message, "error");
      }
    }

    fillOptions($("itemCode"), state.items, (item) => item.item_code, (item) => `${item.item_code} - ${item.item_name}`, state.selectedItemCode);
    fillOptions(
      $("locationCode"),
      state.locations,
      (location) => location.f_location_code,
      (location) => location.f_location_code,
      state.selectedLocationCode
    );

    $("itemCode").addEventListener("change", renderItemLocation);
    $("locationCode").addEventListener("change", renderItemLocation);
    $("totalWeightG").addEventListener("input", renderItemLocation);
    $("inButton").addEventListener("click", () => submitMode("IN"));
    $("outButton").addEventListener("click", () => submitMode("OUT"));
    $("cancelConfirm").addEventListener("click", () => {
      cancelPendingTransaction(state);
      renderConfirm();
      showMessage("Transaction canceled. No stock changed.", "info");
    });
    $("confirmPost").addEventListener("click", () => {
      try {
        const transaction = confirmPendingTransaction(state);
        renderConfirm();
        renderItemLocation();
        showMessage(`${transaction.f_transaction_no} posted successfully.`, "success");
      } catch (error) {
        showMessage(error.message, "error");
      }
    });

    renderItemLocation();
    globalThis.StockTransactionState = state;
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initBrowser);
  }

  return {
    createInitialState,
    findItemByCode,
    findLocationByCode,
    getMapping,
    calculateTransactionWeight,
    prepareTransaction,
    cancelPendingTransaction,
    confirmPendingTransaction,
    getMonthlyAccum,
    getItemLocationBalances,
    exportItemMappingLocation,
    exportTransactions,
    roundKg,
    roundG,
    roundDbDecimal,
    DB_DECIMAL_PLACES,
  };
});
