jest.setTimeout(30000);

const Promise = require("bluebird");
const R = require("ramda");
const amqpconnector = require("../src/index");

const amqpconnection = amqpconnector({
  urls: ["amqp://localhost:5672"],
  serviceName: "my_service",
  serviceVersion: "1.2.3",
}).connect();

const publishChannel = amqpconnection.buildChannelIfNotExists({
  name: "publishChannel",
  json: true,
  realm: "space.",
});

const subscribeChannel = amqpconnection.buildChannelIfNotExists({
  name: "subscribeChannel",
  json: true,
  realm: "space.",
});

beforeAll(async () => {
  return subscribeChannel.waitForConnect();
});

afterAll(async () => {
  await publishChannel.addSetup((channel) => {
    return Promise.all([
      channel.deleteExchange("space.my-direct-exchange-1"),
      channel.deleteExchange("space.my-direct-exchange-2"),
      channel.deleteQueue("space.my-queue-1"),
      channel.deleteQueue("space.my-queue-2"),
    ]);
  });

  return Promise.all([
    publishChannel.close(),
    subscribeChannel.close(),
  ]).then(() => amqpconnection.close());
});

test("publish subscribe direct json on json channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    subscribeChannel
      .subscribeToMessages(
        "direct/my-direct-exchange-1/my.routing.key/my-queue-1",
        async ({ message }) => {
          messagesReceived.push(message);
          resolve(messagesReceived);
        }
      )
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage(
            "direct/my-direct-exchange-1/my.routing.key",
            {
              foo: "bar",
            }
          ),
          publishChannel.publishMessage(
            "direct/my-direct-exchange-1/my.routing.stuff",
            {
              foo: "biz",
            }
          ),
        ]);
      })
      .catch(reject);
  });
  expect(result.length).toBe(1);
  expect(result[0].content).toStrictEqual({
    foo: "bar",
  });
  expect(R.pick(["exchange", "routingKey"], result[0].fields)).toStrictEqual({
    exchange: "space.my-direct-exchange-1",
    routingKey: "space.my.routing.key",
  });
  expect(
    R.pick(["contentType", "deliveryMode"], result[0].properties)
  ).toStrictEqual({
    contentType: "application/json",
    deliveryMode: 2,
  });
});

test("publish subscribe direct Buffer on json channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    subscribeChannel
      .subscribeToMessages(
        "direct/my-direct-exchange-2/my.routing.key/my-queue-2",
        async ({ message }) => {
          messagesReceived.push(message);
          resolve(messagesReceived);
        }
      )
      .then(() => {
        return publishChannel.publishMessage(
          "direct/my-direct-exchange-2/my.routing.key",
          Buffer.from(JSON.stringify({ foo: "bar" }))
        );
      })
      .catch(reject);
  });
  const contentType = result.map((m) => m.content.type);
  expect(contentType.length).toBe(1);
  expect(R.uniq(contentType).length).toBe(1);
  expect(contentType[0]).toBe("Buffer");
  expect(result[0].properties.headers["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(result[0].properties.headers["x-timestamp"]).toBeLessThan(
    +new Date() + 1000
  );
});
