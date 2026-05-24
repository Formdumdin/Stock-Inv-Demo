# Prompt For Next Agent

You are continuing a Stock Inventory / Warehouse Management prototype project.

Your task is to build or refactor the `Node Location` demo only. This demo must look close to a real Power Apps tablet screen and must be easy to translate into Power Apps later.

## Start Here

Read these files in this order:

1. `docs/requirements/node-location-demo-requirements.md`
2. `docs/reference/Finish แบบปรับปรุง of New QR code.xlsx`
3. `docs/reference/qr-code-format-reference.svg`
4. `stock_inventory_full_project_for_codex.md`
5. `stock_inventory_layout_demo.html`

The main source of truth is:

```text
docs/requirements/node-location-demo-requirements.md
```

The real Excel QR/location code reference is:

```text
docs/reference/Finish แบบปรับปรุง of New QR code.xlsx
```

The visual code format reference is:

```text
docs/reference/qr-code-format-reference.svg
```

## Fixed Requirement

The location/QR code format must not change:

```text
{Zone}{RowCode}{ShelfCode}-{Level}{BoxCode}
```

Examples:

```text
A + B0 + 01 + 1 + 01 = AB001-101
A + C0 + 05 + 1 + 01 = AC005-101
A + G0 + 01 + 4 + 38 = AG001-438
```

Normalization rules:

- Zone is exactly 1 character.
- Row input can be letter or number.
- If Row input is 1 character, append `0` after it.
- Shelf is number only and must become 2 digits.
- Box is number only and must become 2 digits.
- Display name is generated from raw input, for example `B + 1 = B1`.
- Do not store Shelf display name as a separate source field.

## Build Target

- Build fixed tablet layout: `1366 x 768 px`.
- Use plain HTML/CSS/JavaScript unless the user explicitly asks for another stack.
- Do not use React for this prototype.
- UI should resemble Power Apps:
  - dark green left sidebar
  - top tablist
  - light content canvas
  - active tab underline
  - Node menu focused on Location

## Required Tabs

1. `Top View รวม`
   - Default tab.
   - Shows selected Zone grid and placed shelves.
   - Shelf cell text displays job-site display name such as `B1`.

2. `แก้ Layout`
   - Move one shelf or a whole row.
   - Placement direction: horizontal/vertical.
   - Stack order: `1 -> x` or `x -> 1`.
   - Prevent overlapping grid cells.

3. `สร้าง Zone`
   - Zone is 1 digit letter/number.
   - Grid size presets only: `8x8`, `10x10`, `12x12`, `15x15`.
   - Default `8x8`.
   - After create, navigate to `สร้าง Row / Shelf / Level`.

4. `สร้าง Row / Shelf / Level`
   - Create Row by Row.
   - User defines Row, Shelf count, and Level count.
   - All shelves in a Row share the same Level count.
   - User can choose to go place layout now or continue creating rows.

5. `จัดการ Shelf / Box`
   - Filter by Row/Shelf/Level.
   - Set Box count.
   - Preview generated location codes.
   - Generate immediately after validation passes.

## Required Functions

Implement these functions or equivalent clearly named functions:

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

## Validation Rules

Block invalid actions:

- duplicate Zone
- duplicate Row in the same Zone
- duplicate Shelf in the same Row
- overlapping shelf placement
- invalid grid size
- invalid Row/Shelf/Level/Box values
- missing box setup before generate
- duplicate generated location code

## Output Expected

Produce a complete working demo and keep it understandable for conversion to Power Apps.

Recommended final structure:

```text
node-location-demo/
  index.html
  style.css
  app.js
  README.md
```

If modifying the existing single-file demo instead, keep a clear note explaining what changed and why.

## Acceptance Tests

- `A`, `B`, `1`, `1`, `1` generates `AB001-101`.
- `A`, `AB`, `12`, `3`, `5` generates `AAB12-305`.
- `A`, `G`, `1`, `4`, `38` generates `AG001-438`.
- `8x8` grid creates coordinates `1-64`.
- Shelf overlap is impossible.
- Generate is blocked when required Box setup is missing.
- Exported data separates `SI_Layout_Master` and `SI_Location_Master`.

