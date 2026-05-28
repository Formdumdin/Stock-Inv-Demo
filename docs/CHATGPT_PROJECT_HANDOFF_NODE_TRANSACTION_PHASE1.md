# ChatGPT Project Handoff: Node Transaction Phase 1

This file is the source handoff for translating the Transaction demo into Power Apps Canvas App formulas.

## Read These Files First

```text
docs/requirements/node-transaction-demo-requirements.md
node-transaction-demo/README.md
node-transaction-demo/app.js
node-transaction-demo/index.html
node-transaction-demo/style.css
tests/node-transaction-demo.test.js
```

## Fixed Dependencies

- Location Code comes from `SI_Location_Master`.
- Location Code format remains `{Zone}{RowCode}{ShelfCode}-{Level}{BoxCode}`.
- Transaction balances use kg internally.
- User input and display use grams where the operator enters weight.
- Every stock/weight DB number must be rounded to 6 decimal places before Patch.
- `All Soruce` is the folder for user-provided source files such as SharePoint exported Excel workbooks.

## SharePoint Lists

### `EBoard_Admin_Master`

Use:

- `item_code`
- `item_name`
- `usage_kg`

Power Apps display:

```powerapps
UnitWeightG = Value(ThisItem.usage_kg) * 1000
```

### `SI_Location_Master`

Use:

- `f_location_code`
- `f_zone`
- `f_row`
- `f_shelf`
- `f_level`
- `f_box`

### `SI_Item_Mapping_Location`

Use `f_item_code & "|" & f_location_code` as the item/location key.

Quantities are kg:

- `f_open_balance`
- `f_receipt_qty`
- `f_issue_qty`
- `f_adjust_in_qty`
- `f_adjust_out_qty`
- `f_on_hand_qty`

### `SI_Item_Transaction_Barcode`

Patch one record after confirmation:

- `f_transaction_no`
- `f_transaction_type`
- `f_item_code`
- `f_item_name`
- `f_location_code`
- `f_qty`
- `f_qty_sign`
- `f_qty_effect`
- `f_before_on_hand`
- `f_after_on_hand`
- `f_reference_no`
- `f_remark`
- `f_transaction_date`
- `f_created_by_email`
- `f_created_by_name`
- `f_status`

Recommended additional fields:

- `f_input_weight_g`
- `f_unit_weight_g`
- `f_transaction_weight_kg`
- `f_calculated_pcs`

Use `Round(value, 6)` for every gram/kg DB number.

## Confirm Flow

1. User selects item and location.
2. User enters total weight in grams.
3. User presses IN or OUT.
4. Validate required data.
5. Convert grams to kg.
6. Calculate pcs using nearest rounding.
7. For OUT, block if on-hand kg is insufficient.
8. Show confirmation popup.
9. Confirm patches mapping and transaction.
10. Cancel clears pending confirmation only.
