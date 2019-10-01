jest.setTimeout(30000);

const constants = require("../src/constants");

test("constants", () => {
  expect(constants.EXCHANGE_TYPE).toBeDefined();
  expect(constants.EXCHANGE_TYPE.DIRECT).toBeDefined();
  expect(constants.EXCHANGE_TYPE.FANOUT).toBeDefined();
  expect(constants.EXCHANGE_TYPE.TOPIC).toBeDefined();
  expect(constants.EXCHANGE_TYPE.HEADERS).toBeDefined();
  expect(constants.EXCHANGES_AVAILABLE).toBeDefined();
  expect(constants.INVOKE_TYPE).toBeDefined();
  expect(
    constants.EXCHANGES_AVAILABLE.includes(constants.EXCHANGE_TYPE.DIRECT)
  );
  expect(
    constants.EXCHANGES_AVAILABLE.includes(constants.EXCHANGE_TYPE.FANOUT)
  );
  expect(constants.EXCHANGES_AVAILABLE.includes(constants.EXCHANGE_TYPE.TOPIC));
  expect(
    constants.EXCHANGES_AVAILABLE.includes(constants.EXCHANGE_TYPE.HEADERS)
  );
});
