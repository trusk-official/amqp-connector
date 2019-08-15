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
        name: "publishChannel"
      });
      subscribeChannel = amqpconnection.buildChannelIfNotExists({
        name: "subscribeChannel"
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
      channel.deleteExchange("my-direct-exchange-3"),
      channel.deleteExchange("my-direct-exchange-4"),
      channel.deleteQueue("my-queue-3"),
      channel.deleteQueue("my-queue-4")
    ]);
  });

  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
});

test("publish subscribe direct buffer on raw channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    subscribeChannel
      .subscribeToMessages(
        "direct/my-direct-exchange-3/my.routing.key/my-queue-3",
        async ({ message }) => {
          messagesReceived.push(message);
          resolve(messagesReceived);
        }
      )
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage(
            "direct/my-direct-exchange-3/my.routing.key",
            Buffer.from(
              JSON.stringify({
                foo: "bar"
              })
            )
          ),
          publishChannel.publishMessage(
            "direct/my-direct-exchange-3/my.routing.stuff",
            Buffer.from(
              JSON.stringify({
                foo: "biz"
              })
            )
          )
        ]);
      })
      .catch(reject);
  });
  expect(result.length).toBe(1);
  expect(JSON.parse(Buffer.from(result[0].content))).toStrictEqual({
    foo: "bar"
  });
  expect(R.pick(["exchange", "routingKey"], result[0].fields)).toStrictEqual({
    exchange: "my-direct-exchange-3",
    routingKey: "my.routing.key"
  });
  expect(
    R.pick(["contentType", "deliveryMode"], result[0].properties)
  ).toStrictEqual({
    contentType: undefined,
    deliveryMode: 2
  });
  expect(result[0].properties.headers["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(result[0].properties.headers["x-timestamp"]).toBeLessThan(
    +new Date() + 1000
  );
});

test("publish subscribe direct json on raw channel", async () => {
  const result = await new Promise(resolve => {
    const messagesReceived = [];
    subscribeChannel
      .subscribeToMessages(
        "direct/my-direct-exchange-4/my.routing.key/my-queue-4",
        async ({ message }) => {
          messagesReceived.push(message);
          resolve(messagesReceived);
        }
      )
      .then(() => {
        return publishChannel.publishMessage(
          "direct/my-direct-exchange-4/my.routing.key",
          { foo: "bar" }
        );
      })
      .catch(e => {
        messagesReceived.push(e);
        resolve(messagesReceived);
      });
  });
  expect(result.length).toBe(1);
  expect(result[0].message).toBe("content is not a buffer");
});
