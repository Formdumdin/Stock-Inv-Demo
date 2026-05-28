const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("location node links to transaction node", () => {
  const html = read("node-location-demo/indexlocation.html");

  assert.match(html, /href=["']\.\.\/node-transaction-demo\/["']/);
  assert.match(html, />Transaction<\/a>/);
});

test("transaction node links back to location node", () => {
  const html = read("node-transaction-demo/indextransaction.html");

  assert.match(html, /href=["']\.\.\/node-location-demo\/["']/);
  assert.match(html, />Node Location<\/a>/);
  assert.match(html, />Stock Action<\/a>/);
});
