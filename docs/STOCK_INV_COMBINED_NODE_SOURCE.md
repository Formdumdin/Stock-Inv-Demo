# Stock Inv Combined Node Source

ไฟล์นี้คือ source/handoff แบบรวมสำหรับให้ ChatGPT หรือผู้พัฒนา Power Apps อ่านก่อนเริ่ม implement `Node Location` และ `Node Transaction`.

## Source Files

```text
node-location-demo/index.html
node-location-demo/app.js
node-location-demo/style.css

node-transaction-demo/index.html
node-transaction-demo/app.js
node-transaction-demo/mock-db.js
node-transaction-demo/style.css

All Soruce/DB_Stock_Inv.xlsx
```

## Navigation Structure

ทั้งสอง Node อยู่แยก folder แต่มี navigation ข้ามหน้ากัน:

```text
node-location-demo/       -> ../node-transaction-demo/
node-transaction-demo/    -> ../node-location-demo/
```

Power Apps equivalent:

```powerapps
// Location menu
Navigate(Scr_Location, ScreenTransition.Fade)

// Transaction menu
Navigate(Scr_Stock_ACtion, ScreenTransition.Fade)
```

## Node Location Responsibility

Node Location เป็น source สำหรับสร้างตำแหน่งเก็บของจริงระดับ Box

```text
LocationCode = {Zone}{RowCode}{ShelfCode}-{Level}{BoxCode}
Example: AD001-101
```

SharePoint targets:

```text
SI_Layout_Master
SI_Location_Master
```

Power Apps collections:

```powerapps
colZones
colRows
colShelves
colShelfBoxes
colGeneratedLocations
```

สิ่งที่ต้องคงเดิม:

- ห้ามเปลี่ยน format Location Code
- `SI_Location_Master` เป็น source หลักให้ Node Transaction scan/select location
- Location final แล้ว จึงไม่ควรแก้ logic หากไม่ได้ตั้งใจเปลี่ยน layout generation

## Node Transaction Responsibility

Node Transaction เป็นหน้าเดียวสำหรับรับเข้าและนำออก

SharePoint sources:

```text
EBoard_Admin_Master
SI_Location_Master
SI_Item_Mapping_Location
SI_Item_Transaction_Barcode
```

Power Apps collections ที่แนะนำ:

```powerapps
ClearCollect(colItemMaster, EBoard_Admin_Master);
ClearCollect(colLocationMaster, SI_Location_Master);
ClearCollect(colItemLocationBalance, SI_Item_Mapping_Location);
ClearCollect(colTransactionHistory, SI_Item_Transaction_Barcode);
```

## Decimal Rule

ทุกค่าที่เป็น DB number ของ stock/weight ต้องใช้ทศนิยม 6 ตำแหน่ง

```text
DB_DECIMAL_PLACES = 6
```

JavaScript source:

```javascript
roundDbDecimal(value)
roundKg(value)
roundG(value)
```

Power Apps formula pattern:

```powerapps
Set(varInputWeightG, Round(Value(txtTotalWeight.Text), 6));
Set(varUnitWeightG, Round(Value(varSelectedItem.usage_kg) * 1000, 6));
Set(varTransactionWeightKg, Round(varInputWeightG / 1000, 6));
Set(varCalculatedPcs, Round(varInputWeightG / varUnitWeightG, 0));
```

Important:

- User กรอกเป็น grams
- หลังบ้านเดิน stock เป็น kg
- เก็บ audit ทั้ง grams และ kg
- คำนวณจำนวนชิ้นด้วย nearest rounding

## Transaction Confirm Flow

ปุ่ม IN/OUT ห้าม Patch ทันที

```powerapps
// IN/OUT OnSelect
Set(varPendingTransaction, {...});
UpdateContext({ locShowConfirmTransaction: true });
```

Confirm เท่านั้นที่ Patch:

```powerapps
// Confirm OnSelect
Patch(SI_Item_Mapping_Location, ...);
Patch(SI_Item_Transaction_Barcode, ...);
UpdateContext({ locShowConfirmTransaction: false });
Set(varPendingTransaction, Blank());
```

Cancel:

```powerapps
UpdateContext({ locShowConfirmTransaction: false });
Set(varPendingTransaction, Blank());
```

## Patch Shape: SI_Item_Transaction_Barcode

```powerapps
Patch(
    SI_Item_Transaction_Barcode,
    Defaults(SI_Item_Transaction_Barcode),
    {
        f_transaction_no: varTransactionNo,
        f_transaction_type: varModeStock,
        f_item_code: varSelectedItem.item_code,
        f_item_name: varSelectedItem.item_name,
        f_location_code: varSelectedLocation.f_location_code,
        f_qty: varTransactionWeightKg,
        f_qty_sign: If(varModeStock = "IN", 1, -1),
        f_qty_effect: If(varModeStock = "IN", varTransactionWeightKg, -varTransactionWeightKg),
        f_before_on_hand: varBeforeOnHandKg,
        f_after_on_hand: varAfterOnHandKg,
        f_reference_no: txtReferenceNo.Text,
        f_remark: txtRemark.Text,
        f_transaction_date: Now(),
        f_created_by_email: User().Email,
        f_created_by_name: User().FullName,
        f_status: "POSTED",
        f_input_weight_g: varInputWeightG,
        f_unit_weight_g: varUnitWeightG,
        f_transaction_weight_kg: varTransactionWeightKg,
        f_calculated_pcs: varCalculatedPcs
    }
)
```

## Patch Shape: SI_Item_Mapping_Location

IN:

- ถ้า item/location ไม่มี mapping ให้สร้าง record ใหม่
- เพิ่ม `f_receipt_qty`
- เพิ่ม `f_on_hand_qty`

OUT:

- ต้องมี mapping เดิม
- ถ้า `f_on_hand_qty < varTransactionWeightKg` ให้ block
- เพิ่ม `f_issue_qty`
- ลด `f_on_hand_qty`

Power Apps guard:

```powerapps
If(
    varModeStock = "OUT" && varBeforeOnHandKg < varTransactionWeightKg,
    Notify("Insufficient on-hand for OUT transaction.", NotificationType.Error),
    UpdateContext({ locShowConfirmTransaction: true })
)
```

## Confirm Popup Content

Popup ต้องแสดง:

- Mode: IN หรือ OUT
- Item Code / Item Name / Unit Weight
- Location Code / Row / Shelf / Level / Box
- Input Weight G
- Transaction Weight KG
- Calculated Pcs
- Before / Change / After on-hand ทั้ง kg และ pcs
- Accum IN/OUT เดือนปัจจุบัน ก่อนและหลัง transaction

## Implementation Notes For ChatGPT

เมื่อต้องแปลงเป็น Power Apps:

1. อ่าน `node-location-demo/app.js` เพื่อเข้าใจ Location Code generation
2. อ่าน `node-transaction-demo/app.js` เพื่อเข้าใจ transaction engine
3. ใช้ comment ใน `node-transaction-demo/app.js` เป็น guide สำหรับ `OnSelect`, `Patch`, `ClearCollect`, `Set`, และ `UpdateContext`
4. อย่า Patch stock ตอนกด IN/OUT ทันที ให้เปิด confirm popup ก่อน
5. ทุก field ที่เป็นน้ำหนักหรือ stock ต้อง `Round(..., 6)`
6. ใช้ `SI_Location_Master.f_location_code` เป็น key เชื่อม Location กับ Transaction
7. ใช้ `f_item_code & "|" & f_location_code` เป็น mapping key สำหรับ item/location balance

## Current Verification

```powershell
node --test tests/node-navigation.test.js tests/node-location-demo.test.js tests/node-transaction-demo.test.js
```
