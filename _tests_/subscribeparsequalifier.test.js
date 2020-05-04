jest.setTimeout(30000);

const { subscribeQualifierParser } = require("../src/utils");

const { EXCHANGE_TYPE, DEFAULT_EXCHANGE } = require("../src/constants");

test("subscribe parse qualifier direct 1", () => {
  expect(subscribeQualifierParser("direct")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.DIRECT],
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier direct 2", () => {
  expect(subscribeQualifierParser("direct/")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.DIRECT],
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier direct 3", () => {
  expect(subscribeQualifierParser("direct//")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.DIRECT],
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier direct 4", () => {
  expect(subscribeQualifierParser("direct/exchange")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: "exchange",
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier direct 5", () => {
  expect(subscribeQualifierParser("direct/exchange/")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: "exchange",
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier direct 6", () => {
  expect(subscribeQualifierParser("direct/exchange/routingkey")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: "exchange",
    queue: "",
    routingKey: "routingkey",
  });
});

test("subscribe parse qualifier direct 7", () => {
  expect(subscribeQualifierParser("direct/exchange/routingkey/")).toStrictEqual(
    {
      type: EXCHANGE_TYPE.DIRECT,
      exchange: "exchange",
      queue: "",
      routingKey: "routingkey",
    }
  );
});

test("subscribe parse qualifier direct 8", () => {
  expect(subscribeQualifierParser("direct/exchange//queue")).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: "exchange",
    queue: "queue",
    routingKey: "",
  });
});

test("subscribe parse qualifier direct 8", () => {
  expect(
    subscribeQualifierParser("direct/exchange/routingkey/queue")
  ).toStrictEqual({
    type: EXCHANGE_TYPE.DIRECT,
    exchange: "exchange",
    queue: "queue",
    routingKey: "routingkey",
  });
});

test("subscribe parse qualifier topic 1", () => {
  expect(subscribeQualifierParser("topic")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.TOPIC],
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier topic 2", () => {
  expect(subscribeQualifierParser("topic/")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.TOPIC],
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier topic 3", () => {
  expect(subscribeQualifierParser("topic//")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.TOPIC],
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier topic 4", () => {
  expect(subscribeQualifierParser("topic/exchange")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: "exchange",
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier topic 5", () => {
  expect(subscribeQualifierParser("topic/exchange/")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: "exchange",
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier topic 6", () => {
  expect(subscribeQualifierParser("topic/exchange/routingkey")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: "exchange",
    queue: "",
    routingKey: "routingkey",
  });
});

test("subscribe parse qualifier topic 7", () => {
  expect(subscribeQualifierParser("topic/exchange/routingkey/")).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: "exchange",
    queue: "",
    routingKey: "routingkey",
  });
});

test("subscribe parse qualifier topic 8", () => {
  expect(
    subscribeQualifierParser("topic/exchange/routingkey/queue")
  ).toStrictEqual({
    type: EXCHANGE_TYPE.TOPIC,
    exchange: "exchange",
    queue: "queue",
    routingKey: "routingkey",
  });
});

test("subscribe parse qualifier fanout 1", () => {
  expect(subscribeQualifierParser("fanout")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.FANOUT],
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier fanout 2", () => {
  expect(subscribeQualifierParser("fanout/")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.FANOUT],
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier fanout 3", () => {
  expect(subscribeQualifierParser("fanout/exchange")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: "exchange",
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier fanout 4", () => {
  expect(subscribeQualifierParser("fanout/exchange/")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: "exchange",
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier fanout 5", () => {
  expect(subscribeQualifierParser("fanout/exchange/queue")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: "exchange",
    queue: "queue",
    routingKey: "",
  });
});

test("subscribe parse qualifier fanout 6", () => {
  expect(subscribeQualifierParser("fanout/exchange/queue/")).toStrictEqual({
    type: EXCHANGE_TYPE.FANOUT,
    exchange: "exchange",
    queue: "queue",
    routingKey: "",
  });
});

test("subscribe parse qualifier fanout 7", () => {
  expect(subscribeQualifierParser("fanout/exchange/queue/stuff")).toStrictEqual(
    {
      type: EXCHANGE_TYPE.FANOUT,
      exchange: "exchange",
      queue: "queue",
      routingKey: "",
    }
  );
});

test("subscribe parse qualifier header 1", () => {
  expect(subscribeQualifierParser("headers")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.HEADERS],
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier header 2", () => {
  expect(subscribeQualifierParser("headers/")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: DEFAULT_EXCHANGE[EXCHANGE_TYPE.HEADERS],
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier header 3", () => {
  expect(subscribeQualifierParser("headers/exchange")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: "exchange",
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier header 4", () => {
  expect(subscribeQualifierParser("headers/exchange/")).toStrictEqual({
    type: "headers",
    exchange: "exchange",
    queue: "",
    routingKey: "",
  });
});

test("subscribe parse qualifier header 5", () => {
  expect(subscribeQualifierParser("headers/exchange/queue")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: "exchange",
    queue: "queue",
    routingKey: "",
  });
});

test("subscribe parse qualifier header 6", () => {
  expect(subscribeQualifierParser("headers/exchange/queue/")).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: "exchange",
    queue: "queue",
    routingKey: "",
  });
});

test("subscribe parse qualifier header 7", () => {
  expect(
    subscribeQualifierParser("headers/exchange/queue/stuff")
  ).toStrictEqual({
    type: EXCHANGE_TYPE.HEADERS,
    exchange: "exchange",
    queue: "queue",
    routingKey: "",
  });
});

test("subscribe parse qualifier malformed 1", () => {
  try {
    subscribeQualifierParser("other");
  } catch (e) {
    expect(e.message).toBe("qualifier_malformed");
  }
});

test("subscribe parse qualifier malformed 1", () => {
  try {
    subscribeQualifierParser("q");
  } catch (e) {
    expect(e.message).toBe("qualifier_malformed");
  }
});
