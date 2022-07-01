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

beforeAll(async () => subscribeChannel.waitForConnect());

afterAll(async () => {
  await publishChannel.addSetup((channel) =>
    Promise.all([
      channel.deleteExchange("my-topic-exchange-3"),
      channel.deleteExchange("my-topic-exchange-4"),
      channel.deleteQueue("my-topic-queue-3"),
      channel.deleteQueue("my-topic-queue-4"),
    ])
  );

  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
});

test("publish subscribe topic Buffer on raw channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "topic/my-topic-exchange-3/my.*.#/my-topic-queue-3",
        async ({ message }) => {
          messagesReceived.push(message);
        }
      )
      .then(() =>
        Promise.all([
          publishChannel.publishMessage(
            "topic/my-topic-exchange-3/my.routing.key",
            Buffer.from(
              JSON.stringify({
                value: "my.routing.key",
              })
            )
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-3/my.stuff.thing",
            Buffer.from(
              JSON.stringify({
                value: "my.stuff.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-3/my.thing",
            Buffer.from(
              JSON.stringify({
                value: "my.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-3/your.stuff.thing",
            Buffer.from(
              JSON.stringify({
                value: "your.stuff.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-3/your.stuff",
            Buffer.from(
              JSON.stringify({
                value: "your.stuff",
              })
            )
          ),
        ])
      )
      .catch(reject);
  });
  const values = result.map((m) => JSON.parse(Buffer.from(m.content)).value);
  expect(values.length).toBe(3);
  expect(values.includes("my.routing.key")).toBe(true);
  expect(values.includes("my.stuff.thing")).toBe(true);
  expect(values.includes("my.thing")).toBe(true);
});

test("publish subscribe topic json on raw channel", async () => {
  const result = await new Promise((resolve) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "topic/my-topic-exchange-4/my.*.#/my-topic-queue-4",
        async ({ message }) => {
          messagesReceived.push(message);
        }
      )
      .then(() =>
        Promise.all([
          publishChannel.publishMessage(
            "topic/my-topic-exchange-4/my.routing.key",
            {
              value: "my.routing.key",
            }
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-4/my.stuff.thing",
            {
              value: "my.stuff.thing",
            }
          ),
          publishChannel.publishMessage("topic/my-topic-exchange-4/my.thing", {
            value: "my.thing",
          }),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-4/your.stuff.thing",
            {
              value: "your.stuff.thing",
            }
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-4/your.stuff",
            {
              value: "your.stuff",
            }
          ),
        ])
      )
      .catch((e) => {
        messagesReceived.push(e);
      });
  });
  expect(result.length).toBe(1);
  expect(result[0].message).toBe("content is not a buffer");
});
