jest.setTimeout(30000);

const Promise = require("bluebird");
const amqpconnector = require("../src/index");

const amqpconnection = amqpconnector({
  urls: ["amqp://localhost:5672"],
  serviceName: "my_service",
  serviceVersion: "1.2.3",
}).connect();

const publishChannel = amqpconnection.buildChannelIfNotExists({
  name: "publishChannel",
});

const subscribeChannel = amqpconnection.buildChannelIfNotExists({
  name: "subscribeChannel",
});

beforeAll(async () => {
  return subscribeChannel.waitForConnect();
});

afterAll(async () => {
  await publishChannel.addSetup((channel) => {
    return Promise.all([
      channel.deleteExchange("my-fanout-exchange-3"),
      channel.deleteExchange("my-fanout-exchange-4"),
      channel.deleteQueue("my-fanout-queue-3"),
      channel.deleteQueue("my-fanout-queue-4"),
    ]);
  });
  return Promise.all([
    publishChannel.close(),
    subscribeChannel.close(),
  ]).then(() => amqpconnection.close());
});

test("publish subscribe fanout buffer on raw channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "fanout/my-fanout-exchange-3/my-fanout-queue-3",
        async ({ message }) => {
          messagesReceived.push(message);
        }
      )
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage(
            "fanout/my-fanout-exchange-3/my.routing.key",
            Buffer.from(
              JSON.stringify({
                value: "my.routing.key",
              })
            )
          ),
          publishChannel.publishMessage(
            "fanout/my-fanout-exchange-3/my.stuff.thing",
            Buffer.from(
              JSON.stringify({
                value: "my.stuff.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "fanout/my-fanout-exchange-3/my.thing",
            Buffer.from(
              JSON.stringify({
                value: "my.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "fanout/my-fanout-exchange-3/your.stuff.thing",
            Buffer.from(
              JSON.stringify({
                value: "your.stuff.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "fanout/my-fanout-exchange-3/your.stuff",
            Buffer.from(
              JSON.stringify({
                value: "your.stuff",
              })
            )
          ),
        ]);
      })
      .catch(reject);
  });
  const values = result.map((m) => JSON.parse(Buffer.from(m.content)).value);
  expect(values.length).toBe(5);
  expect(values.includes("my.routing.key")).toBe(true);
  expect(values.includes("my.stuff.thing")).toBe(true);
  expect(values.includes("my.thing")).toBe(true);
  expect(values.includes("your.stuff.thing")).toBe(true);
  expect(values.includes("your.stuff")).toBe(true);
});

test("publish subscribe fanout json on raw channel", async () => {
  const result = await new Promise((resolve) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "fanout/my-fanout-exchange-4/my-fanout-queue-4",
        async ({ message }) => {
          messagesReceived.push(message);
        }
      )
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage("fanout/my-fanout-exchange-4", {
            value: "my.routing.key",
          }),
          publishChannel.publishMessage("fanout/my-fanout-exchange-4", {
            value: "my.stuff.thing",
          }),
          publishChannel.publishMessage("fanout/my-fanout-exchange-4", {
            value: "my.thing",
          }),
          publishChannel.publishMessage("fanout/my-fanout-exchange-4", {
            value: "your.stuff.thing",
          }),
          publishChannel.publishMessage("fanout/my-fanout-exchange-4", {
            value: "your.stuff",
          }),
        ]);
      })
      .catch((e) => {
        messagesReceived.push(e);
      });
  });
  expect(result.length).toBe(1);
  expect(result[0].message).toBe("content is not a buffer");
});
