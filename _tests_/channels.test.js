jest.setTimeout(30000);

const amqpconnector = require("../src/index");

const amqpconnection = amqpconnector({
  urls: ["amqp://localhost:5672"],
  serviceName: "my_service",
  serviceVersion: "1.2.3"
}).connect();

beforeAll(async () => {
  return new Promise(resolve => {
    amqpconnection.on("connect", async () => {
      resolve();
    });
  });
});

afterAll(async () => {
  return amqpconnection.close();
});

let channeldefault = null;
let channel1 = null;

test("creates an unnamed channel properly", async () => {
  channeldefault = amqpconnection.buildChannelIfNotExists({
    json: true,
    prefetchCount: 0
  });
  expect(channeldefault.constructor.name).toBe("ChannelWrapper");
  expect(channeldefault.name).toBe("default");
  expect(channeldefault.json).toBe(true);
  // eslint-disable-next-line no-underscore-dangle
  expect(channeldefault._json).toBe(true);
});

test("retrieves a named channel properly", async () => {
  channeldefault = amqpconnection.buildChannelIfNotExists({
    json: true,
    prefetchCount: 0
  });
  expect(channeldefault.constructor.name).toBe("ChannelWrapper");
  expect(channeldefault.name).toBe("default");
});

test("creates a named channel properly", async () => {
  channel1 = amqpconnection.buildChannelIfNotExists({
    name: "channel1",
    json: true,
    prefetchCount: 0
  });
  expect(channel1.constructor.name).toBe("ChannelWrapper");
  expect(channel1.name).toBe("channel1");
  expect(channel1.json).toBe(true);
  // eslint-disable-next-line no-underscore-dangle
  expect(channel1._json).toBe(true);
});

test("retrieves a named channel properly", async () => {
  const channel = amqpconnection.buildChannelIfNotExists({
    name: "channel1",
    json: true,
    prefetchCount: 0
  });
  expect(channel).toStrictEqual(channel1);
});

test("try to recreate a channel with different properties", async () => {
  const channel = amqpconnection.buildChannelIfNotExists({
    name: "channel1",
    json: false
  });
  expect(channel.constructor.name).toBe("ChannelWrapper");
  expect(channel.name).toBe("channel1");
  expect(channel.json).toBe(true);
  // eslint-disable-next-line no-underscore-dangle
  expect(channel._json).toBe(true);
});

test("fails to create a channel twice", async () => {
  try {
    amqpconnection.buildChannel({
      name: "channel1",
      json: true,
      prefetchCount: 0
    });
  } catch (e) {
    expect(e.message).toBe("channel_already_exists");
  }
});
