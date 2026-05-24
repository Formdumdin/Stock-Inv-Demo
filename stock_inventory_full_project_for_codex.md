# Stock Inventory / Warehouse Management - Full Project Context for Codex

เอกสารนี้คือ Context รวมของโปรเจค Stock Inventory ทั้งหมด เพื่อส่งต่อให้ Codex ช่วยพัฒนาต่อ

Platform เป้าหมายหลัก:

- Power Apps
- SharePoint Lists
- Power Automate

Demo ที่ต้องการตอนนี้:

- HTML + CSS + JavaScript แบบปกติ
- Fixed size 1366 x 768
- ไม่ต้อง Responsive
- ใช้เป็น Prototype เพื่อแปลง Logic ไป Power Apps

---

# 1. Project Goal

สร้างระบบ Stock Inventory / Warehouse Management ที่สามารถ:

```text
- จัดการ Product Master
- จัดการ Location Master
- จัดการ Layout Master แบบ Top View
- รับสินค้าเข้า Stock In
- เบิกสินค้าออก Stock Out
- ตรวจสอบ Stock Card
- Scan/Search Item
- มี Transaction History
- รองรับ Adjustment สำหรับ Admin
- รองรับ Dashboard และ Report ในอนาคต
```

Core concept:

```text
Stock = SUM(Transaction)
```

ห้ามแก้ยอดคงเหลือโดยตรง

```text
❌ Product.Stock = Product.Stock - Qty
✅ Balance = Sum(Transaction)
```

ระบบต้องเป็น:

```text
Transaction-based
Traceable
Expandable
Immutable
```

---

# 2. Current Development Status

สถานะล่าสุด:

```text
✅ SharePoint Setup เสร็จแล้ว
✅ มี SharePoint Lists หลัก 5 Lists
✅ กำลังเริ่ม Phase 1
✅ งานแรกคือหน้าสร้าง Location Master
✅ งานที่สองคือหน้าสร้าง Layout Master
✅ Top View Concept แก้ล่าสุดแล้ว
```

Phase ปัจจุบัน:

```text
Phase 1 - Master Setup
```

Req ปัจจุบัน:

```text
Req 1:
1. Generate SI_Location_Master
2. Generate SI_Layout_Master
3. ทำ Top View Grid
4. ทำ Select Location
5. ทำ Scan/Search Item
```

ตอนนี้ให้เริ่มจาก:

```text
A. หน้าสร้าง Location Master
B. หน้าสร้าง Layout Master
```

---

# 3. Current SharePoint Lists

ระบบล่าสุดใช้ 5 Lists หลัก:

```text
1. EBoard_Admin_Master
2. SI_Product_Master
3. SI_Location_Master
4. SI_Layout_Master
5. SI_Item_Transaction_Barcode
```

---

# 4. SharePoint List Details

## 4.1 EBoard_Admin_Master

ใช้เก็บผู้ใช้ที่เป็น Admin หรือมีสิทธิ์พิเศษ

Purpose:

```text
- ตรวจสอบสิทธิ์ Admin
- เปิด/ซ่อนเมนู Adjustment
- กำหนดสิทธิ์ผู้ใช้
```

Suggested Fields:

```text
Title                 Text
f_user_mail           Text
f_user_name           Text
f_role                Choice/Text
f_is_active           Yes/No
f_created_date        DateTime
f_remark              Multiple lines
```

Role Example:

```text
Admin
Warehouse
Viewer
```

---

## 4.2 SI_Product_Master

ใช้เก็บข้อมูลสินค้า

Suggested Fields:

```text
Title                 Text
f_sku                 Text
f_product_name        Text
f_barcode             Text
f_category            Text
f_unit                Text
f_min_stock           Number
f_max_stock           Number
f_reorder_point       Number
f_is_active           Yes/No
f_remark              Multiple lines
```

Purpose:

```text
- ใช้สำหรับ Scan/Search Item
- ใช้เป็น Master ใน Stock In / Stock Out
- ใช้ผูกกับ Transaction
```

---

## 4.3 SI_Location_Master

ใช้เก็บตำแหน่งจัดเก็บจริงที่สามารถเอาสินค้าไปวางได้

Location จริงจะถูก Generate จาก:

```text
Row + Shelf + Level + Box
```

Example Location Code:

```text
ROW-A-S01-L01-B01
ROW-A-S01-L01-B02
ROW-A-S01-L02-B01
ROW-B-S03-L04-B10
```

Suggested Fields:

```text
Title                 Text
f_location_code       Text
f_row                 Text
f_shelf               Number/Text
f_level               Number
f_box                 Number
f_is_selectable       Yes/No
f_is_blocked          Yes/No
f_layout_id           Lookup/Number/Text
f_remark              Multiple lines
```

Important Default:

```text
f_is_blocked     Default = No
f_is_selectable  Default = Yes
```

Purpose:

```text
- ใช้เป็น Location จริงในการรับของเข้า
- ใช้เป็น Location จริงในการตัดของออก
- ใช้เลือกช่องเก็บของ
```

---

## 4.4 SI_Layout_Master

ใช้เก็บตำแหน่งการวาง Row และ Shelf บน Top View

Important:

```text
SI_Layout_Master ไม่ใช่ช่องเก็บของจริง
มันคือ Layout Position ของ Shelf บนแผนผังคลัง
```

Suggested Fields:

```text
Title                  Text
f_layout_code          Text
f_row_name             Text
f_shelf_no             Number
f_pos_x                Number
f_pos_y                Number
f_width                Number
f_height               Number
f_direction            Text/Choice
f_level                Number
f_box_per_shelf        Number
f_is_blocked           Yes/No
f_is_selectable        Yes/No
f_sort_order           Number
f_remark               Multiple lines
```

Purpose:

```text
- Render Top View
- เก็บตำแหน่ง Shelf บน Empty Grid
- ใช้ Generate SI_Location_Master
```

---

## 4.5 SI_Item_Transaction_Barcode

ใช้เก็บ Transaction เข้า/ออก/ปรับยอด

Transaction Types:

```text
IN
OUT
ADJUST_IN
ADJUST_OUT
```

ระบบนี้ไม่มี Transfer:

```text
❌ ไม่มี Transfer
```

Suggested Fields:

```text
Title                   Text
f_doc_no                Text
f_transaction_type      Text/Choice
f_sku                   Text
f_product_id            Lookup/Number/Text
f_product_name          Text
f_barcode               Text
f_location_code         Text
f_location_id           Lookup/Number/Text
f_qty                   Number
f_qty_sign              Number
f_transaction_date      DateTime
f_created_by_mail       Text
f_created_by_name       Text
f_ref_doc_no            Text
f_reason                Multiple lines
f_status                Text/Choice
```

Qty Sign:

```text
IN          = +1
OUT         = -1
ADJUST_IN   = +1
ADJUST_OUT  = -1
```

Balance Formula:

```text
Current Stock = Sum(f_qty * f_qty_sign)
```

---

# 5. Important Requirement Decisions

## 5.1 No Transfer

ระบบนี้ไม่เอา Transfer

```text
❌ ไม่ต้องทำ Stock Transfer
```

## 5.2 Adjustment

Adjustment ยังต้องมี แต่:

```text
- ซ่อนเมนูไว้
- ใช้เฉพาะ Admin
- ต้องระบุเหตุผล
- ใช้ในกรณีของหาย / ชำรุด / นับสต็อกผิด
```

---

# 6. Latest Correct Warehouse Layout Concept

## 6.1 Top View

Top View ไม่ใช่ช่อง Location รายตัว

Top View คือ:

```text
พื้นที่สำหรับวาง Row และ Shelf
```

Grid ใน Top View คือ:

```text
Empty Space
```

ใช้สำหรับกำหนดตำแหน่งแถวและ Shelf เท่านั้น

Top View ต้องแสดง:

```text
- Row
- Shelf
- ตำแหน่งของ Shelf
- ขนาดของ Shelf
- สถานะ Block / Selectable
```

Top View ไม่ควรแสดงเป็น Grid Cell:

```text
❌ Level
❌ Box
❌ Location รายช่อง
```

Level และ Box เป็น Property ของ Shelf / Row

---

# 7. Row / Shelf / Level / Box Rule

## 7.1 Row

Row คือแถวใหญ่ในคลัง

Example:

```text
ROW-A
ROW-B
ROW-C
```

ใน 1 Row:

```text
Level ต้องเหมือนกันทั้งแถว
```

Example:

```text
ROW-A = Level 4
ROW-B = Level 6
ROW-C = Level 3
```

## 7.2 Shelf

Shelf คือชั้นหรือ Block ที่วางอยู่ใน Row

Example:

```text
ROW-A-S01
ROW-A-S02
ROW-A-S03
```

Shelf มีข้อมูล:

```text
- Shelf No
- Position X
- Position Y
- Width
- Height
- Direction
- Level จาก Row
- Box per Shelf
```

## 7.3 Level

Level ไม่ใช่ Cell บน Top View

Level เป็นจำนวนชั้นในแนวตั้งของ Row/Shelf

Rule:

```text
1 Row มี Level เหมือนกันทั้ง Row
```

## 7.4 Box

Box คือจำนวนช่องย่อยในแต่ละ Shelf/Level

Box ไม่ได้วางบน Top View

Box ใช้ Generate Location

---

# 8. Location Generation Logic

Input:

```text
Row Name        = ROW-A
Shelf No        = 01
Level           = 4
Box Per Shelf   = 8
```

Output:

```text
ROW-A-S01-L01-B01
ROW-A-S01-L01-B02
ROW-A-S01-L01-B03
...
ROW-A-S01-L04-B08
```

Pseudo Code:

```javascript
for each shelf in shelves:
  for level = 1 to shelf.level:
    for box = 1 to shelf.boxPerShelf:
      create locationCode =
        shelf.rowName + "-S" + shelfNo + "-L" + level + "-B" + box
```

---

# 9. SI_Layout_Master vs SI_Location_Master

## 9.1 SI_Layout_Master

เก็บ:

```text
ROW-A-S01 อยู่ตำแหน่ง X/Y ไหน
กว้างเท่าไหร่
สูงเท่าไหร่
มี Level กี่ชั้น
มี Box ต่อ Shelf กี่ช่อง
Blocked หรือไม่
```

## 9.2 SI_Location_Master

เก็บ Location จริง:

```text
ROW-A-S01-L01-B01
ROW-A-S01-L01-B02
ROW-A-S01-L02-B01
```

---

# 10. UI/UX Requirement

Screen Size:

```text
1366 x 768
```

ยังไม่ต้อง Responsive:

```text
No Responsive
Fixed Layout
```

Visual Theme:

```text
Natural Web3
Green
Brown
White
Soft Natural
```

Color Direction:

```text
Dark Green
Light Green
Earth Brown
Warm White
Soft Gray
```

---

# 11. Demo Technology Recommendation

ควรทำ Demo ด้วย:

```text
HTML + CSS + JavaScript ปกติ
```

ไม่ใช้ React ในช่วงนี้

เหตุผล:

```text
- กิน Token Codex น้อยกว่า React
- Logic ตรงกว่า Power Apps
- Event Function อ่านง่าย
- แปลงเป็น Power Apps Formula ได้ง่ายกว่า
- ไม่ต้องมี Component / Import / Build Tool
```

React เหมาะกับ Web App จริง แต่ตอนนี้เป้าหมายคือ Prototype เพื่อแปลงเป็น Power Apps

Recommended file structure:

```text
/location-layout-demo
  ├── index.html
  ├── style.css
  ├── app.js
  └── README.md
```

---

# 12. Demo Screen Requirement

Page:

```text
Location & Layout Master Setup
```

ต้องมี 3 ส่วนหลัก:

```text
Left Panel   = Row/Shelf Setup Form
Center       = Top View Empty Grid
Right Panel  = Summary / Selected Shelf Info
```

## 12.1 Left Panel

ใช้สำหรับสร้าง Row และ Shelf

Fields:

```text
Grid Space
Row Name
Row Level
Box Per Shelf
Start X
Start Y
Shelf Count
Direction
Shelf Width
Shelf Height
```

Actions:

```text
Create Row
Clear
```

## 12.2 Center Top View

ใช้แสดง Empty Space Grid

Features:

```text
- ปรับขนาด Empty Space ได้
- Render Shelf เป็น Object
- Shelf มีขนาดตาม Width/Height
- Shelf มีตำแหน่ง X/Y
- Click Shelf เพื่อ Select
- Double Click Shelf เพื่อ Block/Unblock
```

Important:

```text
Grid = Empty Space
Shelf = Object
Location จริงไม่ได้แสดงเป็น Cell
```

## 12.3 Right Panel

แสดง:

```text
- จำนวน Rows
- จำนวน Shelves
- จำนวน Empty Grid Cells
- Selected Shelf Info
- Row
- Level
- Box/Shelf
- Location Preview
```

---

# 13. Required JavaScript Functions

Codex ควรสร้าง Function เหล่านี้

## 13.1 State

```javascript
const state = {
  gridCols: 16,
  gridRows: 10,
  rows: [],
  shelves: [],
  locations: [],
  selectedShelfId: null
};
```

## 13.2 changeGrid()

```javascript
function changeGrid(cols, rows) {
  state.gridCols = cols;
  state.gridRows = rows;
  renderTopView();
}
```

## 13.3 createRow()

```javascript
function createRow(payload) {
  // Validate row name
  // Validate boundary
  // Create row
  // Create shelf objects
  // Push to state.rows and state.shelves
  // Render
}
```

## 13.4 createShelfObjects()

```javascript
function createShelfObjects(row) {
  const shelves = [];

  for (let i = 1; i <= row.shelfCount; i++) {
    shelves.push({
      rowName: row.rowName,
      shelfNo: i,
      level: row.level,
      boxPerShelf: row.boxPerShelf,
      x: calculatedX,
      y: calculatedY,
      w: row.shelfWidth,
      h: row.shelfHeight
    });
  }

  return shelves;
}
```

## 13.5 generateLocations()

```javascript
function generateLocations() {
  const locations = [];

  state.shelves.forEach(shelf => {
    for (let level = 1; level <= shelf.level; level++) {
      for (let box = 1; box <= shelf.boxPerShelf; box++) {
        locations.push({
          f_location_code: `${shelf.rowName}-S${pad(shelf.shelfNo)}-L${pad(level)}-B${pad(box)}`,
          f_row: shelf.rowName,
          f_shelf: shelf.shelfNo,
          f_level: level,
          f_box: box,
          f_is_selectable: !shelf.blocked,
          f_is_blocked: shelf.blocked
        });
      }
    }
  });

  return locations;
}
```

## 13.6 saveLayout()

```javascript
function saveLayout() {
  const layoutRecords = state.shelves.map(shelf => ({
    f_row_name: shelf.rowName,
    f_shelf_no: shelf.shelfNo,
    f_pos_x: shelf.x,
    f_pos_y: shelf.y,
    f_width: shelf.w,
    f_height: shelf.h,
    f_level: shelf.level,
    f_box_per_shelf: shelf.boxPerShelf,
    f_is_blocked: shelf.blocked
  }));

  const locationRecords = generateLocations();

  console.log("SI_Layout_Master", layoutRecords);
  console.log("SI_Location_Master", locationRecords);
}
```

## 13.7 renderTopView()

```javascript
function renderTopView() {
  // set css grid background size
  // render shelves with absolute position
}
```

## 13.8 selectShelf()

```javascript
function selectShelf(id) {
  state.selectedShelfId = id;
  renderSelectedShelf();
}
```

## 13.9 toggleBlocked()

```javascript
function toggleBlocked(id) {
  const shelf = state.shelves.find(x => x.id === id);
  shelf.blocked = !shelf.blocked;
  renderTopView();
}
```

---

# 14. Power Apps Conversion Direction

หลังจาก Demo HTML เสร็จ ต้องแปลงเป็น Power Apps

## 14.1 Collections

ใช้ Collections:

```powerapps
colRows
colShelves
colLocations
```

## 14.2 Create Row Concept

```powerapps
Collect(
    colRows,
    {
        RowName: txtRowName.Text,
        Level: Value(txtRowLevel.Text),
        BoxPerShelf: Value(txtBoxPerShelf.Text),
        StartX: Value(txtStartX.Text),
        StartY: Value(txtStartY.Text),
        ShelfCount: Value(txtShelfCount.Text),
        Direction: drpDirection.Selected.Value,
        ShelfWidth: Value(txtShelfWidth.Text),
        ShelfHeight: Value(txtShelfHeight.Text)
    }
);
```

## 14.3 Generate Shelves Concept

```powerapps
ForAll(
    Sequence(Value(txtShelfCount.Text)),
    Collect(
        colShelves,
        {
            RowName: txtRowName.Text,
            ShelfNo: Value,
            Level: Value(txtRowLevel.Text),
            BoxPerShelf: Value(txtBoxPerShelf.Text),
            PosX: If(
                drpDirection.Selected.Value = "H",
                Value(txtStartX.Text) + ((Value - 1) * Value(txtShelfWidth.Text)),
                Value(txtStartX.Text)
            ),
            PosY: If(
                drpDirection.Selected.Value = "V",
                Value(txtStartY.Text) + ((Value - 1) * Value(txtShelfHeight.Text)),
                Value(txtStartY.Text)
            ),
            Width: Value(txtShelfWidth.Text),
            Height: Value(txtShelfHeight.Text),
            IsBlocked: false,
            IsSelectable: true
        }
    )
);
```

## 14.4 Generate Locations Concept

```powerapps
ForAll(
    colShelves As shelf,
    ForAll(
        Sequence(shelf.Level) As lv,
        ForAll(
            Sequence(shelf.BoxPerShelf) As bx,
            Collect(
                colLocations,
                {
                    LocationCode:
                        shelf.RowName &
                        "-S" & Text(shelf.ShelfNo, "00") &
                        "-L" & Text(lv.Value, "00") &
                        "-B" & Text(bx.Value, "00"),
                    RowName: shelf.RowName,
                    ShelfNo: shelf.ShelfNo,
                    Level: lv.Value,
                    Box: bx.Value,
                    IsBlocked: shelf.IsBlocked,
                    IsSelectable: !shelf.IsBlocked
                }
            )
        )
    )
);
```

## 14.5 Patch Layout Master

```powerapps
ForAll(
    colShelves As shelf,
    Patch(
        SI_Layout_Master,
        Defaults(SI_Layout_Master),
        {
            Title: shelf.RowName & "-S" & Text(shelf.ShelfNo, "00"),
            f_row_name: shelf.RowName,
            f_shelf_no: shelf.ShelfNo,
            f_pos_x: shelf.PosX,
            f_pos_y: shelf.PosY,
            f_width: shelf.Width,
            f_height: shelf.Height,
            f_level: shelf.Level,
            f_box_per_shelf: shelf.BoxPerShelf,
            f_is_blocked: shelf.IsBlocked,
            f_is_selectable: !shelf.IsBlocked
        }
    )
);
```

## 14.6 Patch Location Master

```powerapps
ForAll(
    colLocations As loc,
    Patch(
        SI_Location_Master,
        Defaults(SI_Location_Master),
        {
            Title: loc.LocationCode,
            f_location_code: loc.LocationCode,
            f_row: loc.RowName,
            f_shelf: loc.ShelfNo,
            f_level: loc.Level,
            f_box: loc.Box,
            f_is_blocked: loc.IsBlocked,
            f_is_selectable: loc.IsSelectable
        }
    )
);
```

---

# 15. Navigation / Power Apps Notes

เคยมีปัญหา Navigation Component

หลักการที่ควรใช้:

```text
Component ส่งค่า TargetScreen
Screen เป็นคน Handle Navigate
```

อย่าให้ Component Navigate เองซับซ้อนเกินไป

ตัวอย่าง:

```powerapps
Switch(
    TargetScreen,
    "Scr_Dashboard", Navigate(Scr_Dashboard, ScreenTransition.Fade),
    "Scr_Product", Navigate(Scr_Product, ScreenTransition.Fade),
    "Scr_Location", Navigate(Scr_Location, ScreenTransition.Fade),
    "Scr_StockIn", Navigate(Scr_StockIn, ScreenTransition.Fade),
    "Scr_StockOut", Navigate(Scr_StockOut, ScreenTransition.Fade)
)
```

สำหรับ Sub Menu:

```powerapps
Switch(
    TargetScreen,
    "Scr_Location", Navigate(Scr_Location, ScreenTransition.Fade),
    "Scr_Layout_Master", Navigate(Scr_Layout_Master, ScreenTransition.Fade),
    "Scr_TopView_Grid", Navigate(Scr_TopView_Grid, ScreenTransition.Fade)
)
```

---

# 16. Screen Plan

Core Screens:

```text
Scr_Dashboard
Scr_Product
Scr_Location
Scr_Layout_Master
Scr_TopView_Grid
Scr_StockIn
Scr_StockOut
Scr_StockCard
Scr_Adjustment_Admin
```

Current screen to build first:

```text
Scr_Location
Scr_Layout_Master
```

หรือรวมเป็นหน้าเดียวก่อนก็ได้:

```text
Scr_Location_Setup
```

---

# 17. UI Fixed Layout Recommendation

สำหรับ Demo 1366 x 768:

```text
Sidebar: 76px
Main Area: 1290px
Topbar: 74px
Content Height: ~662px
```

Layout:

```text
App 1366 x 768
├── Sidebar 76px
└── Main
    ├── Topbar 74px
    └── Content
        ├── Left Panel 360px
        ├── Center Panel flexible
        └── Right Panel 330px
```

---

# 18. Validation Rules

## Row Validation

```text
- Row Name ห้ามว่าง
- Row Name ห้ามซ้ำ
- Level ต้องมากกว่า 0
- Box per Shelf ต้องมากกว่า 0
- Shelf Count ต้องมากกว่า 0
```

## Boundary Validation

```text
- Shelf ต้องไม่เกินขอบ Empty Grid
- Position X/Y ต้องไม่ต่ำกว่า 1
- Width/Height ต้องมากกว่า 0
```

## Future Validation

```text
- Shelf ห้ามทับกัน
- Row ห้ามซ้ำตำแหน่ง
- Location Code ห้ามซ้ำใน SharePoint
```

---

# 19. Future Enhancement for Layout

หลังจาก Prototype ทำงานแล้ว อาจเพิ่ม:

```text
- Drag & Drop Shelf
- Resize Shelf
- Rotate Shelf
- Duplicate Row
- Import Layout
- Export Layout
- Search Row/Shelf
- Click Shelf แล้วเปิด Front View
```

---

# 20. Front View Concept - Future

Top View แสดง Row/Shelf เท่านั้น

ถ้าต้องดู Level/Box รายละเอียด อาจทำ Front View ภายหลัง

Front View จะแสดง:

```text
Shelf
Level
Box
```

Example:

```text
Shelf S01
Level 4
Box 8
```

Front View Grid:

```text
L04: B01 B02 B03 ... B08
L03: B01 B02 B03 ... B08
L02: B01 B02 B03 ... B08
L01: B01 B02 B03 ... B08
```

---

# 21. Stock Flow

## 21.1 Stock In

Flow:

```text
Scan/Search Product
Select Location
Input Qty
Validate
Create Transaction IN
```

Transaction:

```text
f_transaction_type = IN
f_qty_sign = +1
```

## 21.2 Stock Out

Flow:

```text
Scan/Search Product
Select Location
Check Current Stock
Input Qty
Validate Stock Not Negative
Create Transaction OUT
```

Transaction:

```text
f_transaction_type = OUT
f_qty_sign = -1
```

## 21.3 Adjustment

Admin Only

Flow:

```text
Select Product
Select Location
Input Qty
Select ADJUST_IN / ADJUST_OUT
Input Reason
Create Transaction
```

---

# 22. Stock Card

Stock Card ต้องแสดง:

```text
Product
Location
Date
Transaction Type
Qty In
Qty Out
Balance
User
Reference
```

Balance คำนวณจาก Transaction

---

# 23. Search / Scan Requirement

Scan/Search Item ต้องรองรับ:

```text
- Barcode
- QR Code
- SKU
- Product Name
```

QR/Barcode อ่านแล้วได้รหัสชุด เช่น SKU หรือ Barcode

---

# 24. Permission

Admin:

```text
- ใช้ Adjustment ได้
- Setup Master ได้
- ดู Report ได้
```

Warehouse User:

```text
- Stock In
- Stock Out
- Scan/Search
```

Viewer:

```text
- View Only
```

---

# 25. Current Development Recommendation

ให้ Codex ทำต่อจากนี้:

## Step 1

สร้าง Demo HTML/CSS/JS:

```text
Location Layout Setup
Fixed 1366x768
Natural Green/Brown Theme
```

## Step 2

Function ต้องครบ:

```text
changeGrid()
createRow()
createShelfObjects()
generateLocations()
renderTopView()
selectShelf()
toggleBlocked()
saveLayout()
clearAll()
```

## Step 3

แยกไฟล์:

```text
index.html
style.css
app.js
README.md
```

## Step 4

ใน README.md ให้เขียนวิธีแปลงเป็น Power Apps

---

# 26. Codex Prompt Recommendation

ใช้ Prompt นี้ส่งให้ Codex:

```text
You are helping me continue a Stock Inventory / Warehouse Management project.

Build a fixed 1366x768 HTML/CSS/JavaScript prototype, no React, no framework.

The screen is Location & Layout Master Setup.

Important concept:
Top View is not real location cells.
Top View is only an empty space grid used to place Rows and Shelves.
Level and Box are properties, not visual top-view grid cells.

Rules:
- One Row has the same Level for every Shelf in that Row.
- Each Shelf has BoxPerShelf.
- Generate SI_Layout_Master from Shelf positions.
- Generate SI_Location_Master from Row + Shelf + Level + Box.
- Location code format: ROW-A-S01-L01-B01.
- Use a natural Web3 theme: green, brown, white.
- Fixed screen size: 1366x768.
- Split files into index.html, style.css, app.js, README.md.

Required functions:
changeGrid()
createRow()
createShelfObjects()
generateLocations()
renderTopView()
selectShelf()
toggleBlocked()
saveLayout()
clearAll()

Panels:
Left = Row/Shelf setup form.
Center = Top View Empty Grid.
Right = Summary and selected shelf info.
```

---

# 27. Final Summary

ตอนนี้โปรเจคอยู่จุดนี้:

```text
SharePoint พร้อมแล้ว
5 Lists พร้อมแล้ว
เริ่ม Phase 1
ทำ Location Master + Layout Master ก่อน
Top View Concept ชัดเจนแล้ว
Grid = Empty Space
Row/Shelf = Object บน Top View
Level/Box = Property ใช้ Generate Location
Demo ควรใช้ HTML/CSS/JS ปกติ
```

สิ่งที่ต้องทำต่อทันที:

```text
1. ทำ Demo HTML/CSS/JS แบบแยกไฟล์
2. ทดสอบ Logic Generate Layout
3. ทดสอบ Logic Generate Location
4. แปลงเป็น Power Apps Formula
5. Patch เข้า SI_Layout_Master
6. Patch เข้า SI_Location_Master
```
