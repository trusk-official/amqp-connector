jest.setTimeout(30000);

const { invokeQualifier } = require("../src/utils");

const { INVOKE_TYPE } = require("../src/constants");

test("invoke parse qualifier rpc", () => {
  expect(invokeQualifier("my_fn")).toStrictEqual({
    type: INVOKE_TYPE.RPC,
    function: "my_fn"
  });
});

test("invoke parse qualifier stream", () => {
  expect(invokeQualifier("stream/my_fn")).toStrictEqual({
    type: INVOKE_TYPE.STREAM,
    function: "my_fn"
  });
});
