jest.setTimeout(30000);

const { isFn } = require("../src/utils");

test("is fonction", () => {
  const isFunction = () => {};
  const isNotFunction1 = true;
  const isNotFunction2 = "foo";
  const isNotFunction3 = { foo: "bar" };

  expect(isFn(isFunction)).toBe(true);
  expect(isFn(isNotFunction1)).toBe(false);
  expect(isFn(isNotFunction2)).toBe(false);
  expect(isFn(isNotFunction3)).toBe(false);
});
