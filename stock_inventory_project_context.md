# Stock Inventory System - Current Project Context

## Project Goal

สร้างระบบ Stock Inventory / Warehouse Management บน:

- Power Apps
- SharePoint Lists
- Power Automate

Core Concept:

```text
Stock = SUM(Transaction)
```

ระบบจะเป็นแบบ:

```text
Transaction-based
Traceable
Expandable
Immutable Data
```

---

# Current Development Phase

ตอนนี้อยู่ใน:

```text
Phase 1 - Master Setup
```

ลำดับงานปัจจุบัน:

```text
Req 1:
1. Generate SI_Location_Master
2. Generate SI_Layout_Master
3. ทำ Top View Grid
4. ทำ Select Location
5. ทำ Scan/Search Item
```

---

# Current SharePoint Lists

## 1. EBoard_Admin_Master

ใช้เก็บข้อมูลสิทธิ์และผู้ดูแลระบบ

---

## 2. SI_Product_Master

ใช้เก็บ Product Master

ตัวอย่าง Field:

```text
f_sku
f_product_name
f_barcode
f_category
f_unit
f_is_active
```

---

## 3. SI_Location_Master

ใช้เก็บ Location จริงของคลัง

ตัวอย่าง:

```text
ROW-A-S01-L01-B01
```

Field หลัก:

```text
f_location_code
f_row
f_shelf
f_level
f_box
f_is_selectable
f_is_blocked
```

Rule สำคัญ:

```text
Level เหมือนกันทั้ง Row
```

---

## 4. SI_Layout_Master

ใช้เก็บ Layout / Position ของ Shelf บน Top View

ไม่ได้เก็บ Box จริง

เก็บแค่:

```text
Row Position
Shelf Position
Width
Height
Direction
```

Field หลัก:

```text
f_row_name
f_shelf_no
f_pos_x
f_pos_y
f_width
f_height
f_level
f_box_per_shelf
f_is_blocked
```

---

## 5. SI_Item_Transaction_Barcode

ใช้เก็บ Transaction

Core Concept:

```text
IN
OUT
ADJUST
```

ไม่มี Transfer

Adjustment ซ่อนสำหรับ Admin

---

# IMPORTANT DESIGN CONCEPT

## Top View Concept

Top View = พื้นที่วาง Row และ Shelf

Grid ไม่ใช่ Location จริง

Grid คือ:

```text
Empty Space สำหรับจัดวางแถว
```

---

# Correct Warehouse Concept

## Top View

ใช้สำหรับ:

```text
- วาง Row
- วาง Shelf
- กำหนดขนาด Shelf
- กำหนด Position
```

ไม่ใช่:

```text
❌ Box
❌ Level Cell
❌ Bin Cell
```

---

# Row Rule

ใน 1 Row:

```text
Level ต้องเหมือนกันทั้งแถว
```

เช่น:

```text
ROW-A = Level 4 ทั้งแถว
ROW-B = Level 6 ทั้งแถว
```

---

# Shelf Concept

Shelf คือ Object ที่อยู่ใน Top View

Shelf มี:

```text
- Shelf No
- Width
- Height
- Level
- Box Per Shelf
- Position X/Y
```

---

# Box Concept

Box ไม่อยู่ใน Top View

Box ถูก Generate จาก:

```text
Shelf + Level + Box Count
```

เช่น:

```text
ROW-A-S01
Level = 4
Box/Shelf = 8
```

ระบบจะ Generate:

```text
ROW-A-S01-L01-B01
ROW-A-S01-L01-B02
...
ROW-A-S01-L04-B08
```

---

# Current UI Direction

Theme:

```text
Natural Web3 Style
```

Color Direction:

```text
Green
Brown
White
Natural Soft Tone
```

Fixed Size:

```text
1366 × 768
```

No Responsive for now.

---

# Current Demo Direction

## Demo 1 (Wrong Concept)

สิ่งที่ผิด:

```text
Grid ถูกใช้แทน Location จริง
```

ซึ่งไม่ตรง Requirement

---

## Demo 2 (Correct Concept)

แก้เป็น:

```text
Top View = Row + Shelf Placement
```

Features:

```text
- Adjustable Empty Grid
- Create Row
- Create Shelf
- Horizontal / Vertical
- Set Level per Row
- Set Box per Shelf
- Block / Unblock Shelf
- Generate Location Code
```

---

# Layout Logic

## Empty Grid

Grid เป็นพื้นที่ว่าง:

```text
12x8
16x10
20x12
24x14
```

ใช้สำหรับ:

```text
Positioning Only
```

---

# Shelf Placement Logic

Shelf มี:

```text
X
Y
Width
Height
```

และถูก Render บน Top View

---

# Generate Location Logic

Pseudo Logic:

```javascript
for each shelf:
    for level:
        for box:
            generate location
```

Example:

```text
ROW-A-S01-L01-B01
```

---

# Power Apps Direction

## Screen 1

Location Master Setup

ประกอบด้วย:

```text
- Top View
- Row Setup
- Shelf Setup
- Generate Location
```

---

# Recommended Power Apps Structure

## Collections

```powerapps
colRows
colShelves
colLocations
```

---

# Save Flow

## Save Layout

Patch ไป:

```text
SI_Layout_Master
```

---

## Generate Locations

Patch ไป:

```text
SI_Location_Master
```

---

# Important Architecture Rules

## Do NOT

```text
❌ Update Stock ตรง ๆ
❌ ใช้ Grid เป็น Box
❌ แก้ย้อนหลัง
```

---

## Correct

```text
✅ Transaction-based
✅ Generate Location
✅ Immutable Data
✅ Row-Based Level
```

---

# Future Development

## Next Phase

หลังจบ Master Setup:

```text
1. Select Location
2. Scan/Search Item
3. Stock In
4. Stock Out
5. Stock Card
```

---

# Long-term Plan

## Future Modules

```text
- Dashboard
- Low Stock
- Approval
- Audit Log
- Power BI
- FIFO
- QR Scan
```

---

# Current Status Summary

ตอนนี้:

```text
✅ SharePoint Setup เสร็จ
✅ Master Table พร้อม
✅ เข้าเริ่ม Phase 1
✅ เริ่มออกแบบ Location Master
✅ Top View Concept ชัดแล้ว
✅ Row/Shelf Logic ชัดแล้ว
```

