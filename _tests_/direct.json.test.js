const Promise = require("bluebird");
const R = require("ramda");
const amqpconnector = require("../src/index");

let amqpconnection = null;
let publishChannel = null;
let subscribeChannel = null;

beforeAll(async () => {
  amqpconnection = amqpconnector({
    urls: ["amqp://localhost:5672"],
    serviceName: "my_service",
    serviceVersion: "1.2.3"
  }).connect();
  return new Promise(resolve => {
    amqpconnection.on("connect", async () => {
      publishChannel = amqpconnection.buildChannelIfNotExists({
        name: "publishChannel",
        json: true
      });
      subscribeChannel = amqpconnection.buildChannelIfNotExists({
        name: "subscribeChannel",
        json: true
      });
      Promise.all([
        publishChannel.waitForConnect(),
        subscribeChannel.waitForConnect()
      ]).then(resolve);
    });
  });
});

afterAll(async () => {
  await publishChannel.addSetup(channel => {
    return Promise.all([
      channel.deleteExchange("my-direct-exchange-1"),
      channel.deleteExchange("my-direct-exchange-2"),
      channel.deleteQueue("my-queue-1"),
      channel.deleteQueue("my-queue-2")
    ]);
  });

  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
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
              foo: "bar"
            }
          ),
          publishChannel.publishMessage(
            "direct/my-direct-exchange-1/my.routing.stuff",
            {
              foo: "biz"
            }
          )
        ]);
      })
      .catch(reject);
  });
  expect(result.length).toBe(1);
  expect(result[0].content).toStrictEqual({
    foo: "bar"
  });
  expect(R.pick(["exchange", "routingKey"], result[0].fields)).toStrictEqual({
    exchange: "my-direct-exchange-1",
    routingKey: "my.routing.key"
  });
  expect(
    R.pick(["contentType", "deliveryMode"], result[0].properties)
  ).toStrictEqual({
    contentType: "application/json",
    deliveryMode: 2
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
  const contentType = result.map(m => m.content.type);
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
