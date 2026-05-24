# ChatGPT Project Handoff: Node Location Phase 1

เอกสารนี้เป็นไฟล์หลักสำหรับส่งเข้า ChatGPT Project เพื่อเริ่มทำ Power Apps Canvas App จริงใน Phase 1 ของ Stock Inventory / Warehouse Management เฉพาะส่วน Node Location เท่านั้น

## 1. Scope ที่ต้องยึด

- ทำเฉพาะ Node Location / Location Master
- ไม่ออกแบบหรือแก้ SharePoint Lists อื่นของระบบ Stock Inventory ในรอบนี้
- SharePoint Lists หลักของ Phase 1 มี 2 Lists:
  - `SI_Layout_Master`
  - `SI_Location_Master`
- Lists อื่น เช่น `SI_Product_Master` และ `SI_Item_Transaction_Barcode` เป็น future relation / context only เพื่ออธิบายว่าในอนาคต item ใน box จะเชื่อมผ่าน product หรือ transaction list
- Demo ปัจจุบันเป็น HTML/CSS/JavaScript สำหรับแปลง logic ไปเป็น Power Apps Canvas App
- ห้ามเปลี่ยน location code format:

```text
{Zone}{RowCode}{ShelfCode}-{Level}{BoxCode}
```

ตัวอย่างที่ต้องถูกเสมอ:

```text
A + B0 + 01 + 1 + 01 = AB001-101
A + AB + 12 + 3 + 05 = AAB12-305
A + G0 + 01 + 4 + 38 = AG001-438
```

## 2. Source Files ที่ ChatGPT Project ต้องอ่าน

ให้อ่าน source ใน project ตามลำดับนี้ก่อนแนะนำ Power Apps implementation:

```text
docs/requirements/node-location-demo-requirements.md
docs/prompts/agent-handoff-node-location-demo.md
node-location-demo/README.md
node-location-demo/app.js
node-location-demo/index.html
node-location-demo/style.css
tests/node-location-demo.test.js
```

Reference files:

```text
docs/reference/Finish แบบปรับปรุง of New QR code.xlsx
docs/reference/qr-code-format-reference.svg
```

## 3. Demo State To Power Apps Collections

JavaScript state ใน `node-location-demo/app.js` ให้แปลงเป็น Power Apps collections ดังนี้:

| JavaScript state | Power Apps collection | Purpose |
|---|---|---|
| `zones` | `colZones` | เก็บ Zone และ grid preset |
| `rows` | `colRows` | เก็บ Row config, RowCode, ShelfCount, LevelCount |
| `shelves` | `colShelves` | เก็บ Shelf แต่ละตัว, grid position, active/visible status |
| `shelfBoxes` | `colShelfBoxes` | เก็บ BoxCount แยกตาม Shelf และ Level |
| `generatedLocations` | `colGeneratedLocations` | เก็บ preview/output location ก่อน Patch เข้า SharePoint |

ตัวแปร Canvas App ที่ควรมี:

| Variable | Purpose |
|---|---|
| `varActiveTab` | tab ปัจจุบัน เช่น Top View, Edit Layout, Create Zone |
| `varSelectedZoneId` | Zone ที่ user กำลังทำงาน |
| `varSelectedRowId` | Row ที่ user กำลังเลือก |
| `varSelectedShelfId` | Shelf ที่ user กำลังเลือก |
| `varLayoutEditMode` | `"shelf"` หรือ `"row"` สำหรับแก้ layout |
| `locShowShelfPopup` | เปิด/ปิด popup รายละเอียด Shelf ใน Top View |

## 4. SharePoint Lists For Node Location Phase 1

### 4.1 `SI_Layout_Master`

Purpose:

- เก็บตำแหน่ง Shelf บนแผนผัง Top View
- ไม่ใช่ตำแหน่งเก็บของจริงระดับ Box
- ใช้ render layout, validate overlap, และ join กลับไปหา generated locations

Recommended list settings:

- ใช้ SharePoint List ชื่อ `SI_Layout_Master`
- Create columns ด้วย internal name ที่ final แล้ว เช่น `f_zone`, `f_row_code`
- หลีกเลี่ยงการสร้าง column ที่มี space แล้ว rename ภายหลัง เพราะ internal name จะไม่ตรงกับสูตร Power Apps
- Index column: `f_layout_key`, `f_grid_key`, `f_zone`
- Unique column: `f_layout_key` ถ้า SharePoint tenant อนุญาต
- `f_grid_key` อาจตั้ง unique ได้ถ้าต้องการบังคับห้ามวาง Shelf ทับ grid cell เดิมใน SharePoint ด้วย แต่ logic หลักยังต้อง validate ใน Power Apps ก่อน Patch

Columns:

| Internal name | Display name | SharePoint type | Required | Index/Unique | Source | Power Apps usage |
|---|---|---|---|---|---|---|
| `Title` | Title | Single line of text | Yes | Optional index | `exportLayoutMaster().Title` | ใช้ label อ่านง่าย เช่น `A-B1` |
| `f_zone` | Zone | Single line of text | Yes | Index | `shelf.zoneCode` | `Filter(SI_Layout_Master, f_zone = varZone)` |
| `f_row_input` | Row Input | Single line of text | Yes | No | `shelf.rowInput` | แสดงชื่อ Row ตามที่ user กรอก |
| `f_row_code` | Row Code | Single line of text | Yes | Index | `shelf.rowCode` | สร้าง code และ filter row |
| `f_shelf_no` | Shelf No | Number | Yes | No | `shelf.shelfNo` | sort / display |
| `f_shelf_code` | Shelf Code | Single line of text | Yes | No | `shelf.shelfCode` | สร้าง location code |
| `f_display_name` | Display Name | Single line of text | Yes | Optional index | `buildDisplayName(rowInput, shelfNo)` | label บน grid เช่น `B1` |
| `f_grid_index` | Grid Index | Number | No | Optional index | `shelf.gridIndex` | ใช้หา cell ใน Gallery |
| `f_grid_row` | Grid Row | Number | No | No | `shelf.gridRow` | ใช้คำนวณตำแหน่ง |
| `f_grid_col` | Grid Col | Number | No | No | `shelf.gridCol` | ใช้คำนวณตำแหน่ง |
| `f_level_count` | Level Count | Number | Yes | No | `row.levelCount` | ใช้ generate level |
| `f_is_placed` | Is Placed | Yes/No | Yes | No | `shelf.isPlaced` | block generate ถ้ายังไม่ได้วาง |
| `f_is_active` | Is Active | Yes/No | Yes | Index | `shelf.isActive` | active เท่านั้นที่ generate |
| `f_is_visible` | Is Visible | Yes/No | Yes | No | `shelf.isVisible` | ซ่อนใน Top View แต่ยังใช้งานได้ |
| `f_is_selectable` | Is Selectable | Yes/No | Yes | Optional index | `shelf.isActive` | เลือกใช้ใน flow อื่นได้ |
| `f_layout_key` | Layout Key | Single line of text | Recommended | Index + Unique | `zone & "|" & rowCode & "|" & shelfCode` | ใช้กัน duplicate shelf layout |
| `f_grid_key` | Grid Key | Single line of text | Recommended | Index | `zone & "|" & gridIndex` | ใช้เช็ก overlap ต่อ Zone |

Power Apps Patch shape:

```powerapps
ForAll(
    colShelves As shelf,
    Patch(
        SI_Layout_Master,
        Defaults(SI_Layout_Master),
        {
            Title: shelf.ZoneCode & "-" & shelf.DisplayName,
            f_zone: shelf.ZoneCode,
            f_row_input: shelf.RowInput,
            f_row_code: shelf.RowCode,
            f_shelf_no: shelf.ShelfNo,
            f_shelf_code: shelf.ShelfCode,
            f_display_name: shelf.DisplayName,
            f_grid_index: shelf.GridIndex,
            f_grid_row: shelf.GridRow,
            f_grid_col: shelf.GridCol,
            f_level_count: shelf.LevelCount,
            f_is_placed: shelf.IsPlaced,
            f_is_active: shelf.IsActive,
            f_is_visible: shelf.IsVisible,
            f_is_selectable: shelf.IsActive,
            f_layout_key: shelf.ZoneCode & "|" & shelf.RowCode & "|" & shelf.ShelfCode,
            f_grid_key: shelf.ZoneCode & "|" & Text(shelf.GridIndex)
        }
    )
)
```

### 4.2 `SI_Location_Master`

Purpose:

- เก็บ Location จริงระดับ Box
- ใช้เลือกตำแหน่งรับของ / จ่ายของ / query stock ภายหลัง
- สร้างจาก active shelf เท่านั้น
- Inactive shelf ไม่ถูก generate เข้า list นี้

Recommended list settings:

- ใช้ SharePoint List ชื่อ `SI_Location_Master`
- Index column: `f_location_code`, `f_zone`, `f_layout_key`
- Unique column: `f_location_code` ถ้า SharePoint tenant อนุญาต
- ก่อน Patch ต้อง `LookUp()` หรือโหลด existing codes มาตรวจ duplicate ก่อนเสมอ
- ถ้าเจอ duplicate ให้ block ทั้ง batch: ไม่ append และไม่ replace

Columns:

| Internal name | Display name | SharePoint type | Required | Index/Unique | Source | Power Apps usage |
|---|---|---|---|---|---|---|
| `Title` | Title | Single line of text | Yes | Optional index | `location.locationCode` | แสดง code หลัก |
| `f_location_code` | Location Code | Single line of text | Yes | Index + Unique | `buildLocationCode(...)` | key หลัก ห้ามซ้ำ |
| `f_zone` | Zone | Single line of text | Yes | Index | `location.zoneCode` | filter location ต่อ Zone |
| `f_row_input` | Row Input | Single line of text | Yes | No | `location.rowInput` | display/search |
| `f_row_code` | Row Code | Single line of text | Yes | Index | `location.rowCode` | search/filter |
| `f_shelf_no` | Shelf No | Number | Yes | No | `location.shelfNo` | display/sort |
| `f_shelf_code` | Shelf Code | Single line of text | Yes | No | `location.shelfCode` | join/code |
| `f_level` | Level | Number | Yes | No | `location.level` | filter level |
| `f_box` | Box | Number | Yes | No | `location.boxNo` | filter box |
| `f_box_code` | Box Code | Single line of text | Yes | No | `location.boxCode` | code display |
| `f_is_selectable` | Is Selectable | Yes/No | Yes | Optional index | `location.isSelectable` | dropdown/search location |
| `f_layout_key` | Layout Key | Single line of text | Recommended | Index | `zone & "|" & rowCode & "|" & shelfCode` | join กลับไป `SI_Layout_Master` |
| `f_generated_batch_id` | Generated Batch Id | Single line of text | Recommended | Optional index | generate timestamp/GUID | trace รอบการ generate |
| `f_created_by_app` | Created By App | Single line of text | Recommended | No | `"NodeLocationDemo"` | trace source |

Power Apps Patch shape:

```powerapps
ForAll(
    colGeneratedLocations As loc,
    Patch(
        SI_Location_Master,
        Defaults(SI_Location_Master),
        {
            Title: loc.LocationCode,
            f_location_code: loc.LocationCode,
            f_zone: loc.ZoneCode,
            f_row_input: loc.RowInput,
            f_row_code: loc.RowCode,
            f_shelf_no: loc.ShelfNo,
            f_shelf_code: loc.ShelfCode,
            f_level: loc.Level,
            f_box: loc.BoxNo,
            f_box_code: loc.BoxCode,
            f_is_selectable: true,
            f_layout_key: loc.ZoneCode & "|" & loc.RowCode & "|" & loc.ShelfCode,
            f_generated_batch_id: varGeneratedBatchId,
            f_created_by_app: "NodeLocationDemo"
        }
    )
)
```

## 5. Validation ก่อน Patch

Power Apps ต้อง validate ก่อน Patch ทุกครั้ง:

- Zone ห้ามซ้ำ
- Row ห้ามซ้ำใน Zone เดียวกัน
- Shelf ห้ามซ้ำใน Row เดียวกัน
- Shelf ต้องไม่วางทับ grid cell เดิม
- Shelf ที่ Active ต้องมี box setup ครบทุก level
- Shelf ที่ Active ต้องถูกวางบน grid ก่อน generate
- Inactive shelf อยู่ใน `SI_Layout_Master` ได้ แต่ไม่ generate เข้า `SI_Location_Master`
- Hidden shelf ไม่แสดงใน Top View แต่ถ้า Active ยัง generate ได้
- `f_location_code` ห้ามซ้ำทั้งใน `colGeneratedLocations` และใน SharePoint เดิม
- ถ้ามี duplicate หรือ error ใด ๆ ให้ block ทั้ง batch ไม่ Patch record ใด ๆ

Power Apps pattern:

```powerapps
If(
    CountRows(colGenerateErrors) > 0,
    Notify("Generate blocked. Please fix errors first.", NotificationType.Error),
    /* Patch SI_Layout_Master and SI_Location_Master only after validation passes */
)
```

## 6. UI / Screen Flow For Canvas App

Demo มี 5 tabs ที่ควรแปลงเป็น Canvas App screens หรือ tab containers:

| Demo tab | Power Apps target | Notes |
|---|---|---|
| Top View รวม | `scrTopView` หรือ tab container | แสดง grid + popup shelf detail |
| แก้ Layout | `scrEditLayout` | เลือก Shelf Mode / Row Mode แล้วคลิก grid เพื่อย้าย |
| สร้าง Zone | `scrCreateZone` | สร้าง Zone และเลือก grid preset |
| สร้าง Row / Shelf / Level | `scrCreateRow` | สร้าง Row และ auto-generate shelves |
| จัดการ Shelf / Box | `scrShelfBox` | เลือก Shelf แล้วกำหนด Box ต่อ Level |

สำคัญ:

- grid ใช้ preset square เท่านั้น: `8x8`, `10x10`, `12x12`, `15x15`
- fixed tablet target: `1366 x 768`
- content ด้านใน scroll ได้
- Top View click Shelf ต้องเปิด popup แสดง Level / Box / Location / Item preview
- Edit Layout ไม่ต้องแสดง detail popup ให้ใช้ click select แล้ว click grid เพื่อย้าย

## 7. Function Mapping จาก JavaScript ไป Power Apps

| JavaScript function | Power Apps equivalent | ใช้ที่ |
|---|---|---|
| `createInitialState()` | `App.OnStart` / `Screen.OnVisible` | initialize collections/variables |
| `normalizeZone()` | formula validation | Create Zone button |
| `normalizeRowCode()` | formula validation | Create Row button |
| `normalizeShelfCode()` | formula / `Text(Value,"00")` | Create Row / Generate |
| `normalizeBoxCode()` | formula / `Text(Value,"00")` | Generate |
| `buildDisplayName()` | calculated label | Grid cell / list |
| `buildLocationCode()` | calculated text | Generate |
| `createZone()` | `Collect(colZones, ...)` | Create Zone `OnSelect` |
| `createRowShelves()` | `Collect(colRows, ...); ForAll(Sequence(...), Collect(colShelves,...))` | Create Row `OnSelect` |
| `placeShelf()` | `Patch(colShelves, selectedShelf, {...})` | Grid cell `OnSelect` in Shelf Mode |
| `moveRowLayout()` | `ForAll(row shelves, Patch(colShelves,...))` | Grid cell `OnSelect` in Row Mode |
| `setShelfBoxCount()` | `Patch(colShelfBoxes, ...)` | Shelf/Box save button |
| `validateBeforeGenerate()` | validation formulas before Patch | Generate button |
| `getGenerateSummary()` | summary container formulas | Generate Summary UI |
| `generateLocations()` | `ClearCollect(colGeneratedLocations, ForAll(...))` | Generate button |
| `exportLayoutMaster()` | `Patch(SI_Layout_Master, ...)` payload | SharePoint write |
| `exportLocationMaster()` | `Patch(SI_Location_Master, ...)` payload | SharePoint write |
| `getShelfDetail()` | popup gallery source | Top View shelf popup |

## 8. Future Relation Only

ยังไม่ต้องสร้าง column เพิ่มใน Phase 1 นี้ แต่ควรเข้าใจ relation ภายหลัง:

- `SI_Product_Master` จะเก็บ master data ของสินค้า
- `SI_Item_Transaction_Barcode` หรือ transaction list จะเก็บการเคลื่อนไหว stock เข้า/ออก
- popup ที่แสดง item ต่อ Box ใน demo ตอนนี้เป็น preview/demo data
- ของจริงควร query item/stock ด้วย `f_location_code` จาก transaction list ไม่ควรเก็บ item list ซ้ำใน `SI_Location_Master`

## 9. Prompt สำหรับ ChatGPT Project

ใช้ prompt นี้เมื่ออัปไฟล์ทั้งหมดเข้า ChatGPT Project:

```text
คุณคือผู้ช่วยพัฒนา Power Apps Canvas App สำหรับ Stock Inventory / Warehouse Management เฉพาะ Phase 1: Node Location

ให้อ่านไฟล์ source ใน project ก่อนตอบทุกครั้ง โดยเริ่มจาก:
- docs/CHATGPT_PROJECT_HANDOFF_NODE_LOCATION_PHASE1.md
- docs/requirements/node-location-demo-requirements.md
- node-location-demo/README.md
- node-location-demo/app.js
- node-location-demo/index.html
- node-location-demo/style.css
- tests/node-location-demo.test.js

เป้าหมายคือแปลง demo HTML/CSS/JavaScript เป็น Power Apps Canvas App fixed tablet 1366x768

ข้อห้าม:
- ห้ามเปลี่ยน code format: {Zone}{RowCode}{ShelfCode}-{Level}{BoxCode}
- ห้ามออกแบบ Lists อื่นนอกจาก Location-related Lists ใน Phase 1
- ห้าม Patch ถ้า validation ไม่ผ่าน
- ห้าม append/replace บางส่วนถ้าเจอ duplicate location code

SharePoint Lists ที่ใช้ใน Phase 1:
- SI_Layout_Master
- SI_Location_Master

ให้แนะนำสูตร Power Apps โดยระบุ control property ให้ชัด เช่น OnVisible, OnSelect, Items, Visible, DisplayMode, Default, Text, TemplateFill และ Patch mapping

ถ้าต้องพูดถึง SI_Product_Master หรือ SI_Item_Transaction_Barcode ให้พูดเป็น future relation/context only เท่านั้น ยังไม่ต้องออกแบบ column เพิ่มใน Phase 1
```

## 10. Acceptance Checklist

- `SI_Layout_Master` มี column สำหรับ layout/grid/status ครบ
- `SI_Location_Master` มี column สำหรับ location code ระดับ Box ครบ
- มี unique/index recommendation สำหรับ `f_location_code`
- มี key สำหรับ join layout/location: `f_layout_key`
- มี grid overlap helper key: `f_grid_key`
- เอกสารระบุชัดว่า Phase 1 ไม่ยุ่งกับ List อื่น
- มี Power Apps Patch shape สำหรับทั้ง 2 Lists
- มี validation rule ก่อน Patch
- มี prompt สำหรับ ChatGPT Project

