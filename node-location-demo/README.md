# Node Location Demo

Power Apps friendly HTML/CSS/JavaScript prototype for the Stock Inventory `Node Location` module.

## Run

Open `index.html` directly in a browser, or serve this folder with any static file server.

```powershell
cd "C:\Demo Stock inv Location"
python -m http.server 4173
```

Then open `http://localhost:4173/node-location-demo/`.

## Fixed QR / Location Code

The code format must not change:

```text
{Zone}{RowCode}{ShelfCode}-{Level}{BoxCode}
```

Examples:

```text
A + B0 + 01 + 1 + 01 = AB001-101
A + AB + 12 + 3 + 05 = AAB12-305
A + G0 + 01 + 4 + 38 = AG001-438
```

Normalization:

- Zone is exactly 1 letter or number.
- Row input is 1 or 2 letters/numbers. A 1-character row appends `0`, so `B -> B0`.
- Shelf and Box are numeric and padded to 2 digits.
- Level is numeric and limited to 1 digit for this phase.
- Display name is calculated as `rowInput + shelfNo`, for example `B1`.

## Power Apps Mapping

The JavaScript state maps to these collections:

```powerapps
colZones
colRows
colShelves
colShelfBoxes
colGeneratedLocations
```

SharePoint output targets:

- `SI_Layout_Master`: Zone, Row, Shelf, grid position, active/visible/placed status.
- `SI_Location_Master`: generated location code at Box level.

## Demo Rules

- Fixed tablet canvas: `1366 x 768`.
- Plain HTML/CSS/JS only.
- Grid sizes are square presets only: `8x8`, `10x10`, `12x12`, `15x15`.
- Generate validates before writing output.
- Generate Summary previews Zone, Row, Shelf, Location, duplicate, and error counts before output.
- Duplicate Zone, Row, Shelf, overlap, missing Box setup, and duplicate LocationCode are prevented.
- Inactive shelves are not generated into `SI_Location_Master`.
- Hidden shelves are not shown on Top View but remain usable when Active.

## Debug / Conversion Helper

In a browser, the demo API is exposed as:

```javascript
window.NodeLocationDemo
```

This makes it easier to inspect the state model and map functions to Power Apps formulas.

## Canvas App Formula Mapping

- `App.OnStart` or screen `OnVisible`: initialize `colZones`, `colRows`, `colShelves`, `colShelfBoxes`, `colGeneratedLocations`, `varActiveTab`, `varSelectedZoneId`, `varSelectedRowId`, `varSelectedShelfId`, and `varLayoutEditMode`.
- Top tab buttons `OnSelect`: `Set(varActiveTab, "topView")`, `Set(varActiveTab, "editLayout")`, and so on.
- Top View grid gallery `Items`: `Sequence(varGridSize * varGridSize)`.
- Top View grid cell `OnSelect`: if `varActiveTab="topView"` open the Shelf popup; if `varActiveTab="editLayout"` use `varLayoutEditMode` to either move one Shelf or place a whole Row.
- Shelf Mode button `OnSelect`: `Set(varLayoutEditMode, "shelf")`.
- Row Mode button `OnSelect`: `Set(varLayoutEditMode, "row")`.
- Create Zone button `OnSelect`: validate then `Collect(colZones, {...})`.
- Create Row button `OnSelect`: validate then `Collect(colRows, {...})` and `ForAll(Sequence(ShelfCount), Collect(colShelves, {...}))`.
- Active button `OnSelect`: `Patch(colShelves, ThisItem, {IsActive: !ThisItem.IsActive})`.
- Show/Hide button `OnSelect`: `Patch(colShelves, ThisItem, {IsVisible: !ThisItem.IsVisible})`.
- Shelf/Box save button `OnSelect`: patch one selected shelf+level record in `colShelfBoxes`.
- Generate button `OnSelect`: run validation first, then `ClearCollect(colGeneratedLocations, ...)`, then later `Patch(SI_Layout_Master, ...)` and `Patch(SI_Location_Master, ...)`.
- Shelf detail popup `Visible`: `locShowShelfPopup`; its level/box galleries filter by `varSelectedShelfId`.

## Tests

Run the logic tests from the project root:

```powershell
node --test tests/node-location-demo.test.js
```
