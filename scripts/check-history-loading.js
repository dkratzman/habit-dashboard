const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "script.js"), "utf8");
const start = source.indexOf("async function fetchAllDailyEntries(");
const end = source.indexOf('window.addEventListener("load",', start);
assert(start >= 0 && end > start);
const context = {};
vm.runInNewContext(source.slice(start, end), context);

function mockClient(rows, { cap = 500, failPage = -1, emptyPage = -1 } = {}) {
  const requests = [];
  return {
    requests,
    from(table) {
      assert.strictEqual(table, "daily_entries");
      const request = { orders: [] };
      const query = {
        select(columns, options) { assert.strictEqual(columns, "*"); request.options = options; return query; },
        eq(column, user) { assert.strictEqual(column, "user_id"); request.user = user; return query; },
        order(column) { request.orders.push(column); return query; },
        async range(first, last) {
          const page = requests.length;
          requests.push({ ...request, first, last });
          if (page === failPage) return { error: new Error("Network failed") };
          return {
            data: page === emptyPage ? [] : rows.filter(row => row.user_id === request.user).slice(first, Math.min(last + 1, first + cap)),
            count: request.options.count === "exact" ? rows.filter(row => row.user_id === request.user).length : null,
            error: null,
          };
        },
      };
      return query;
    },
  };
}

async function check() {
  const entries = Array.from({ length: 1072 }, (_, id) => ({ id, user_id: "owner" }));
  const otherUser = { id: "private", user_id: "other" };
  for (const cap of [500, 200]) {
    const client = mockClient([...entries, otherUser], { cap });
    const result = await context.fetchAllDailyEntries(client, "owner");
    assert.strictEqual(result.error, null);
    assert.deepStrictEqual(Array.from(result.data), entries, "History must include the newest entries beyond row 1000, without duplicates or other accounts");
    client.requests.forEach(request => assert.deepStrictEqual(request.orders, ["timestamp", "id"]));
  }
  for (const size of [0, 1, 500, 1000]) {
    const result = await context.fetchAllDailyEntries(mockClient(entries.slice(0, size)), "owner");
    assert.strictEqual(result.error, null);
    assert.strictEqual(result.data.length, size);
  }
  const failed = await context.fetchAllDailyEntries(mockClient(entries, { failPage: 1 }), "owner");
  assert.strictEqual(failed.data, null, "Do not render partial history after a later-page failure");
  assert(failed.error);
  const incomplete = await context.fetchAllDailyEntries(mockClient(entries, { emptyPage: 1 }), "owner");
  assert.strictEqual(incomplete.data, null);
  assert(incomplete.error);
  console.log("Complete history loading checks passed.");
}
check().catch(error => { console.error(error); process.exitCode = 1; });
