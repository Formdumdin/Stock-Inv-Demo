# Node Transaction Demo

One-page Power Apps friendly prototype for Stock Action `IN / รับเข้า` and `OUT / นำออก`.

## Run

Open `index.html` directly in a browser, or run `Run Node Transaction Demo.bat` from the repository root.

## Source Data

Mock data is based on:

```text
All Soruce/DB_Stock_Inv.xlsx
```

Relevant sheets:

- `EBoard_Admin_Master`: item master and `usage_kg`.
- `SI_Location_Master`: box-level location code.
- `SI_Item_Mapping_Location`: item/location balance.
- `SI_Item_Transaction_Barcode`: transaction history target.

## Transaction Rules

- User enters weight in grams.
- The transaction engine stores and moves stock in kilograms.
- Every DB-facing weight/stock number is rounded to 6 decimal places.
- The transaction log stores both:
  - `f_input_weight_g`
  - `f_transaction_weight_kg`
- Unit weight comes from `usage_kg`.
- Display unit weight is `usage_kg * 1000`.
- Calculated pcs is `Math.round(totalWeightG / unitWeightG)`.
- IN creates a missing item/location mapping.
- OUT is blocked when the item/location on-hand kg is insufficient.
- IN/OUT never posts immediately. A confirmation popup must be accepted first.

## Power Apps Mapping

- `App.OnStart` / screen `OnVisible`: load item, location, mapping, and transaction collections.
- Item ComboBox `Items`: `EBoard_Admin_Master`.
- Location ComboBox `Items`: `SI_Location_Master`.
- IN/OUT button `OnSelect`: build a pending confirmation object.
- Confirm button `OnSelect`: patch `SI_Item_Mapping_Location` and collect/patch `SI_Item_Transaction_Barcode`.
- Cancel button `OnSelect`: clear pending confirmation only.

## Tests

Run from the project root:

```powershell
node --test tests/node-transaction-demo.test.js
```
