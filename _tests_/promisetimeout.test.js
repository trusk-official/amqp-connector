jest.setTimeout(30000);

const { promiseTimeout } = require("../src/utils");

test("promise timeout resolve on time", async () => {
  const p = promiseTimeout(
    1000,
    () =>
      new Promise(resolve => {
        resolve("done_on_time");
      })
  ).then(
    s =>
      new Promise(resolve =>
        setTimeout(() => {
          resolve(s);
        }, 2000)
      )
  );
  const r = await p;
  expect(r).toBe("done_on_time");
});

test("promise timeout rejects on time", async () => {
  const p = promiseTimeout(
    1000,
    () =>
      new Promise((_, reject) => {
        reject(new Error("reject_on_time"));
      })
  );
  const r = await p.catch(e => e.message);
  expect(r).toBe("reject_on_time");
});

test("promise timeout resolves too late", async () => {
  const p = promiseTimeout(
    1000,
    () =>
      new Promise(resolve => {
        setTimeout(() => resolve("resolve_too_late"), 1500);
      })
  );
  const r = await p.catch(e => e.message);
  expect(r).toBe("timeout_1000ms");
});

test("promise timeout rejects too late", async () => {
  const p = promiseTimeout(
    1000,
    () =>
      new Promise(resolve => {
        setTimeout(() => resolve("rejects_too_late"), 1500);
      })
  );
  const r = await p.catch(e => e.message);
  expect(r).toBe("timeout_1000ms");
});
