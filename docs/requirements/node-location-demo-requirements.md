# Node Location Demo Requirements

## Purpose

Build a fixed-size HTML/CSS/JavaScript prototype for the `Node Location` module only. The prototype must look and behave close to the real Power Apps tablet experience so it can be translated into Power Apps later.

The demo is not a full stock system. It covers only location setup, warehouse layout, shelf/level/box definition, and location QR code generation.

## Fixed UI Target

- Canvas size: `1366 x 768 px`
- Power Apps tablet style
- Left sidebar like the provided reference UI:
  - dark green navigation
  - active menu highlight
  - top tablist in the content area
  - light gray/white workspace
- No responsive layout required for this phase.

## Source Of Truth Files

- Main summarized requirements: `docs/requirements/node-location-demo-requirements.md`
- Real QR/location code Excel reference: `docs/reference/Finish แบบปรับปรุง of New QR code.xlsx`
- Code format visual reference: `docs/reference/qr-code-format-reference.svg`
- Agent handoff prompt: `docs/prompts/agent-handoff-node-location-demo.md`
- Older project context:
  - `stock_inventory_full_project_for_codex.md`
  - `stock_inventory_project_context.md`
- Current old demo file:
  - `stock_inventory_layout_demo.html`

## Fixed Location Code Format

The location/QR code structure is fixed:

```text
{Zone}{RowCode}{ShelfCode}-{Level}{BoxCode}
```

Example from the real Excel reference:

```text
Zone=A
RowInput=B
RowCode=B0
ShelfNo=1
ShelfCode=01
Level=1
BoxCode=01

LocationCode = AB001-101
```

More examples:

```text
A + B0 + 01 + 1 + 01 = AB001-101
A + C0 + 05 + 1 + 01 = AC005-101
A + G0 + 01 + 4 + 38 = AG001-438
```

This fixed format is the only part that must not change. Internal field names and UI details may be adjusted if they make Power Apps implementation easier.

## Code Normalization Rules

- `Zone`
  - 1 character only.
  - Can be letter or number.
  - Example: `A`.
- `RowInput`
  - Can be letter or number.
  - If 1 character, append `0` after it.
  - Example: `B -> B0`.
  - If already 2 characters, keep as-is.
  - Example: `AB -> AB`.
- `ShelfNo`
  - Number only.
  - Convert to 2 digits by adding `0` in front.
  - Example: `1 -> 01`, `12 -> 12`.
- `Level`
  - Number only.
  - Displayed and stored as 1 digit in the code for this phase.
- `BoxNo`
  - Number only.
  - Convert to 2 digits by adding `0` in front.
  - Example: `1 -> 01`, `38 -> 38`.
- Display name for the job site is generated, not stored:
  - `displayName = rowInput + shelfNo`
  - Example: `B + 1 = B1`.
- System code for location generation uses normalized code:
  - `rowCode + shelfCode`
  - Example: `B0 + 01 = B001`.

## Demo Tabs

The Node Location module must have a top tablist/component tablist. The default tab is `Top View รวม`.

### 1. Top View รวม

Purpose:

- Show an overview of the selected Zone layout.
- Render a grid based on the Zone size.
- Show placed shelves as cells on the grid.
- Each shelf cell displays the job-site display name such as `B1`, `B2`, or `AB12`.
- Users can see which Row is located where, and which Shelf belongs to each Row.

Important:

- Top View is a 2D layout view.
- It shows Row/Shelf placement only.
- It does not show Level or Box as top-view cells.

### 2. แก้ Layout

Purpose:

- Place or move shelves on the grid.
- 1 Shelf occupies exactly 1 grid cell.
- User can move:
  - one shelf only
  - a full row of shelves
- Placement direction:
  - horizontal
  - vertical
- Stack order:
  - `1 -> x`
  - `x -> 1`
- It must prevent overlap with shelves from other rows or the same row.
- It must show:
  - total rows
  - shelves per row
  - placed/unplaced status
  - active/inactive status
  - blocked/open status

Useful actions:

- Place selected shelf
- Place full row
- Clear selected row placement
- Toggle shelf active
- Toggle shelf blocked

### 3. สร้าง Zone

Purpose:

- Create a Zone and its grid.

Rules:

- Zone code is exactly 1 character.
- Zone can be letter or number.
- Grid size must be square only.
- Allowed sizes:
  - `8x8`
  - `10x10`
  - `12x12`
  - `15x15`
- Default size is `8x8`.
- After a Zone is created, automatically navigate to tab 4: `สร้าง Row / Shelf / Level`.

Grid coordinate:

- `gridIndex` is a number from `1` to total cells.
- Example:
  - `8x8 = 1-64`
  - `10x10 = 1-100`
- Store `gridRow` and `gridCol` too for easier layout logic.

### 4. สร้าง Row / Shelf / Level

Purpose:

- Create rows one by one.
- The user enters a Row, Shelf count, and Level count.

Rules:

- Row creation is Row-by-Row.
- Row input can be letter or number.
- Shelf count is number only.
- Level count is number only.
- All shelves in the same Row share the same Level count.
- After creating a Row, user chooses:
  - create and go to layout placement
  - create and stay here to add more rows

### 5. จัดการ Shelf / Box

Purpose:

- Define how many Boxes exist inside each Shelf/Level.
- This is the final step before generating real location codes.

Concept:

- Think of the warehouse as 3D:
  - Row = long storage row
  - Shelf = adjacent section in the row
  - Level = vertical layer in each shelf
  - Box = sub-slot inside each level

UI needs:

- Show all active shelves.
- Filter by:
  - Row
  - Shelf
  - Level
- Set Box count for the selected Row/Shelf/Level.
- Preview generated location codes.
- Generate immediately after validation passes.

## Data Model For Demo

Use simple arrays/collections in JavaScript that map cleanly to Power Apps collections later.

```javascript
state = {
  activeTab: "topView",
  selectedZoneId: null,
  selectedRowId: null,
  selectedShelfId: null,
  zones: [],
  rows: [],
  shelves: [],
  shelfBoxes: [],
  generatedLocations: []
};
```

### Zone

```javascript
{
  id,
  zoneCode,
  gridSize,
  totalCells
}
```

### Row

```javascript
{
  id,
  zoneId,
  rowInput,
  rowCode,
  shelfCount,
  levelCount,
  isActive
}
```

### Shelf

```javascript
{
  id,
  zoneId,
  rowId,
  rowInput,
  rowCode,
  shelfNo,
  shelfCode,
  gridIndex,
  gridRow,
  gridCol,
  isPlaced,
  isActive,
  isBlocked
}
```

### Shelf Box

```javascript
{
  id,
  zoneId,
  rowId,
  shelfId,
  level,
  boxCount
}
```

### Generated Location

```javascript
{
  id,
  zoneCode,
  rowInput,
  rowCode,
  shelfNo,
  shelfCode,
  level,
  boxNo,
  boxCode,
  locationCode,
  isBlocked,
  isSelectable
}
```

## Power Apps Friendly Collections

The prototype should map to these Power Apps collections:

```powerapps
colZones
colRows
colShelves
colShelfBoxes
colGeneratedLocations
```

Target SharePoint lists:

- `SI_Layout_Master`
  - Zone, Row, Shelf, grid position, active/blocked/placed status.
- `SI_Location_Master`
  - Generated location code at Box level.

## Required Functions

```javascript
normalizeZone(value)
normalizeRowCode(rowInput)
normalizeShelfCode(shelfNo)
normalizeBoxCode(boxNo)
buildDisplayName(rowInput, shelfNo)
buildLocationCode(zone, rowCode, shelfCode, level, boxCode)
createZone()
createRowShelves()
placeShelf()
moveRowLayout()
validateNoOverlap()
toggleShelfActive()
toggleShelfBlocked()
generateLocations()
exportLayoutMaster()
exportLocationMaster()
```

## Validation

Block the user from generating if:

- Zone is missing or duplicate.
- Row is missing or duplicate inside the same Zone.
- Shelf is duplicate inside the same Row.
- Shelf count, Level count, or Box count is not a positive number.
- Any active shelf is missing box setup.
- Any active shelf that should be used is not placed on the grid.
- Any two shelves are placed in the same grid cell.
- Any generated location code is duplicate.

## Generate Behavior

- No Draft flow.
- User presses Generate.
- System validates everything first.
- If validation passes:
  - generate `SI_Layout_Master` output
  - generate `SI_Location_Master` output
- The demo can show the outputs as JSON/table/preview.
- It does not need to connect to SharePoint yet.

## Acceptance Tests

- Zone `A`, Row `B`, Shelf `1`, Level `1`, Box `1` must generate `AB001-101`.
- Zone `A`, Row `AB`, Shelf `12`, Level `3`, Box `5` must generate `AAB12-305`.
- Zone `A`, Row `G`, Shelf `1`, Level `4`, Box `38` must generate `AG001-438`.
- Grid `8x8` must create coordinates `1-64`.
- Two shelves cannot occupy the same grid cell.
- Duplicate Row in the same Zone must be blocked.
- Duplicate Shelf in the same Row must be blocked.
- Generate must be blocked when required box setup is missing.
- Exported layout and location data must be clearly separated.

