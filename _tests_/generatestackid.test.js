jest.setTimeout(30000);

const R = require("ramda");
const { generateStackId } = require("../src/utils");

test("constants", () => {
  const ids = [
    generateStackId(),
    generateStackId(),
    generateStackId(),
    generateStackId(7),
    generateStackId(8),
    generateStackId(9),
  ].filter((_) => _);

  expect(ids.length).toBe(6);
  expect(R.uniq(ids).length).toBe(6);
  expect(ids.every((s) => typeof s === "string")).toBe(true);
  expect(ids[0].length).toBe(5);
  expect(ids[1].length).toBe(5);
  expect(ids[2].length).toBe(5);
  expect(ids[3].length).toBe(7);
  expect(ids[4].length).toBe(8);
  expect(ids[5].length).toBe(9);
});
