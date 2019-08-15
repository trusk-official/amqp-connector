const { publishQualifierParser } = require("../src/utils");

const { EXCHANGE_TYPE, DEFAULT_EXCHANGE } = require("../src/constants");

test("subscribe parse qualifier direct 1", () => {
  expect(publishQualifierParser("direct")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.DIRECT],
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier direct 2", () => {
  expect(publishQualifierParser("direct/")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.DIRECT],
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier direct 3", () => {
  expect(publishQualifierParser("direct/exchange")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier direct 4", () => {
  expect(publishQualifierParser("direct/exchange/")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier direct 5", () => {
  expect(publishQualifierParser("direct/exchange/routingkey")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: "exchange",
    queue: "",
    routingKey: "routingkey"
  });
});

test("subscribe parse qualifier direct 6", () => {
  expect(publishQualifierParser("direct/exchange/routingkey/")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: "exchange",
    queue: "",
    routingKey: "routingkey"
  });
});

test("subscribe parse qualifier direct 6", () => {
  expect(
    publishQualifierParser("direct/exchange/routingkey/stuff")
  ).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: "exchange",
    queue: "",
    routingKey: "routingkey"
  });
});

test("subscribe parse qualifier topic 1", () => {
  expect(publishQualifierParser("topic")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.TOPIC],
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier topic 2", () => {
  expect(publishQualifierParser("topic/")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.TOPIC],
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier topic 3", () => {
  expect(publishQualifierParser("topic/exchange")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier topic 4", () => {
  expect(publishQualifierParser("topic/exchange/")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier topic 5", () => {
  expect(publishQualifierParser("topic/exchange/routingkey")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: "exchange",
    queue: "",
    routingKey: "routingkey"
  });
});

test("subscribe parse qualifier topic 6", () => {
  expect(publishQualifierParser("topic/exchange/routingkey/")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: "exchange",
    queue: "",
    routingKey: "routingkey"
  });
});

test("subscribe parse qualifier topic 7", () => {
  expect(
    publishQualifierParser("topic/exchange/routingkey/stuff")
  ).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: "exchange",
    queue: "",
    routingKey: "routingkey"
  });
});

test("subscribe parse qualifier fanout 1", () => {
  expect(publishQualifierParser("fanout")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.FANOUT],
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier fanout 2", () => {
  expect(publishQualifierParser("fanout/")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.FANOUT],
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier fanout 3", () => {
  expect(publishQualifierParser("fanout/exchange")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier fanout 4", () => {
  expect(publishQualifierParser("fanout/exchange/")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier fanout 5", () => {
  expect(publishQualifierParser("fanout/exchange/routingkey")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier fanout 6", () => {
  expect(publishQualifierParser("fanout/exchange/routingkey/")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier fanout 7", () => {
  expect(
    publishQualifierParser("fanout/exchange/routingkey/stuff")
  ).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier headers 1", () => {
  expect(publishQualifierParser("headers")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.HEADERS],
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier headers 2", () => {
  expect(publishQualifierParser("headers/")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.HEADERS],
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier headers 3", () => {
  expect(publishQualifierParser("headers/exchange")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier headers 4", () => {
  expect(publishQualifierParser("headers/exchange/")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier headers 5", () => {
  expect(publishQualifierParser("headers/exchange/stuff")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier headers 3", () => {
  expect(publishQualifierParser("headers/exchange/stuff/")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier headers 6", () => {
  expect(
    publishQualifierParser("headers/exchange/stuff/morestuff")
  ).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: "exchange",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier q 1", () => {
  expect(publishQualifierParser("q")).toStrictEqual({
    type: "q",
    exchange: "",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier q 2", () => {
  expect(publishQualifierParser("q/")).toStrictEqual({
    type: "q",
    exchange: "",
    queue: "",
    routingKey: ""
  });
});

test("subscribe parse qualifier q 3", () => {
  expect(publishQualifierParser("q/queue")).toStrictEqual({
    type: "q",
    exchange: "",
    queue: "queue",
    routingKey: ""
  });
});

test("subscribe parse qualifier q 4", () => {
  expect(publishQualifierParser("q/queue/")).toStrictEqual({
    type: "q",
    exchange: "",
    queue: "queue",
    routingKey: ""
  });
});

test("subscribe parse qualifier q 5", () => {
  expect(publishQualifierParser("q/queue/stuff")).toStrictEqual({
    type: "q",
    exchange: "",
    queue: "queue",
    routingKey: ""
  });
});

test("subscribe parse qualifier malformed 1", () => {
  try {
    publishQualifierParser("other");
  } catch (e) {
    expect(e.message).toBe("qualifier_malformed");
  }
});
