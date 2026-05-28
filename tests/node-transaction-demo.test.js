const assert = require("node:assert/strict");
const test = require("node:test");

const demo = require("../node-transaction-demo/apptransaction.js");

function freshState() {
  return demo.createInitialState();
}

test("converts usage kg to unit grams and rounds calculated pieces", () => {
  const state = freshState();
  const item = demo.findItemByCode("001-0041-05-0", state);
  const calculation = demo.calculateTransactionWeight({
    totalWeightG: 800,
    unitWeightKg: item.usageKg,
  });

  assert.equal(item.unitWeightG, 1.721);
  assert.equal(calculation.transactionWeightKg, 0.8);
  assert.equal(calculation.calculatedPcs, 465);
});

test("pressing IN creates a pending confirmation without mutating stock", () => {
  const state = freshState();
  const beforeTransactions = state.transactions.length;
  const beforeMapping = demo.getMapping("001-0041-05-0", "AD001-101", state);

  const pending = demo.prepareTransaction(
    {
      mode: "IN",
      itemCode: "001-0041-05-0",
      locationCode: "AD001-101",
      inputWeightG: 800,
    },
    state
  );

  assert.equal(pending.mode, "IN");
  assert.equal(state.pendingConfirmation.mode, "IN");
  assert.equal(state.transactions.length, beforeTransactions);
  assert.equal(demo.getMapping("001-0041-05-0", "AD001-101", state).onHandKg, beforeMapping.onHandKg);
  assert.equal(pending.onHand.beforeKg, beforeMapping.onHandKg);
  assert.equal(pending.onHand.changeKg, 0.8);
  assert.equal(pending.onHand.afterKg, beforeMapping.onHandKg + 0.8);
});

test("canceling confirmation does not change mapping or append transaction", () => {
  const state = freshState();
  const beforeMapping = demo.getMapping("001-0041-05-0", "AD001-101", state);

  demo.prepareTransaction(
    {
      mode: "IN",
      itemCode: "001-0041-05-0",
      locationCode: "AD001-101",
      inputWeightG: 800,
    },
    state
  );
  const result = demo.cancelPendingTransaction(state);

  assert.equal(result, true);
  assert.equal(state.pendingConfirmation, null);
  assert.equal(state.transactions.length, 0);
  assert.equal(demo.getMapping("001-0041-05-0", "AD001-101", state).onHandKg, beforeMapping.onHandKg);
});

test("confirming IN creates mapping when missing and records grams plus kg", () => {
  const state = freshState();
  assert.equal(demo.getMapping("001-0041-05-0", "AD004-201", state), null);

  demo.prepareTransaction(
    {
      mode: "IN",
      itemCode: "001-0041-05-0",
      locationCode: "AD004-201",
      inputWeightG: 500,
      referenceNo: "RCV-001",
      remark: "first receipt",
    },
    state
  );
  const transaction = demo.confirmPendingTransaction(state);
  const mapping = demo.getMapping("001-0041-05-0", "AD004-201", state);

  assert.equal(mapping.onHandKg, 0.5);
  assert.equal(mapping.receiptQtyKg, 0.5);
  assert.equal(transaction.f_transaction_type, "IN");
  assert.equal(transaction.f_qty, 0.5);
  assert.equal(transaction.f_qty_sign, 1);
  assert.equal(transaction.f_qty_effect, 0.5);
  assert.equal(transaction.f_input_weight_g, 500);
  assert.equal(transaction.f_unit_weight_g, 1.721);
  assert.equal(transaction.f_transaction_weight_kg, 0.5);
  assert.equal(transaction.f_calculated_pcs, 291);
});

test("OUT greater than on hand is blocked before confirmation", () => {
  const state = freshState();

  assert.throws(
    () =>
      demo.prepareTransaction(
        {
          mode: "OUT",
          itemCode: "001-0041-05-0",
          locationCode: "AD001-101",
          inputWeightG: 999999,
        },
        state
      ),
    /insufficient on-hand/i
  );
  assert.equal(state.pendingConfirmation, null);
  assert.equal(state.transactions.length, 0);
});

test("confirming OUT subtracts stock and records signed kg effect", () => {
  const state = freshState();
  const before = demo.getMapping("001-0041-05-0", "AD001-101", state).onHandKg;

  demo.prepareTransaction(
    {
      mode: "OUT",
      itemCode: "001-0041-05-0",
      locationCode: "AD001-101",
      inputWeightG: 100,
    },
    state
  );
  const transaction = demo.confirmPendingTransaction(state);
  const after = demo.getMapping("001-0041-05-0", "AD001-101", state).onHandKg;

  assert.equal(after, demo.roundKg(before - 0.1));
  assert.equal(transaction.f_transaction_type, "OUT");
  assert.equal(transaction.f_qty, 0.1);
  assert.equal(transaction.f_qty_sign, -1);
  assert.equal(transaction.f_qty_effect, -0.1);
  assert.equal(transaction.f_before_on_hand, before);
  assert.equal(transaction.f_after_on_hand, after);
});

test("confirmation summary includes before change after and monthly accum", () => {
  const state = freshState();
  demo.prepareTransaction(
    {
      mode: "IN",
      itemCode: "001-0041-05-0",
      locationCode: "AD001-101",
      inputWeightG: 800,
    },
    state
  );
  const pending = state.pendingConfirmation;

  assert.equal(pending.item.itemCode, "001-0041-05-0");
  assert.equal(pending.location.locationCode, "AD001-101");
  assert.equal(pending.location.row, "D0");
  assert.equal(pending.location.shelf, "01");
  assert.equal(pending.location.level, 1);
  assert.equal(pending.location.box, "01");
  assert.equal(pending.onHand.changePcs, 465);
  assert.equal(pending.monthly.beforeInPcs, 0);
  assert.equal(pending.monthly.afterInPcs, 465);
  assert.equal(pending.monthly.beforeOutPcs, 0);
  assert.equal(pending.monthly.afterOutPcs, 0);
});

test("stores all decimal DB quantities at 6 decimal places", () => {
  const state = freshState();

  const calculation = demo.calculateTransactionWeight({
    totalWeightG: 123.4567894,
    unitWeightKg: 0.0017211234,
  });

  assert.equal(calculation.inputWeightG, 123.456789);
  assert.equal(calculation.unitWeightG, 1.721123);
  assert.equal(calculation.transactionWeightKg, 0.123457);

  demo.prepareTransaction(
    {
      mode: "IN",
      itemCode: "001-0041-05-0",
      locationCode: "AD004-201",
      inputWeightG: 123.4567894,
    },
    state
  );
  const transaction = demo.confirmPendingTransaction(state);
  const mapping = demo.getMapping("001-0041-05-0", "AD004-201", state);

  assert.equal(transaction.f_input_weight_g, 123.456789);
  assert.equal(transaction.f_unit_weight_g, 1.721);
  assert.equal(transaction.f_qty, 0.123457);
  assert.equal(transaction.f_qty_effect, 0.123457);
  assert.equal(transaction.f_transaction_weight_kg, 0.123457);
  assert.equal(mapping.onHandKg, 0.123457);
});
