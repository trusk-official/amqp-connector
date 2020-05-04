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
});

const subscribeChannel = amqpconnection.buildChannelIfNotExists({
  name: "subscribeChannel",
  json: true,
});

beforeAll(async () => {
  return subscribeChannel.waitForConnect();
});

afterAll(async () => {
  await publishChannel.addSetup((channel) => {
    return Promise.all([
      channel.deleteExchange("my-topic-exchange-1"),
      channel.deleteExchange("my-topic-exchange-2"),
      channel.deleteQueue("my-topic-queue-1"),
      channel.deleteQueue("my-topic-queue-2"),
    ]);
  });

  return Promise.all([
    publishChannel.close(),
    subscribeChannel.close(),
  ]).then(() => amqpconnection.close());
});

test("publish subscribe topic json on json channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "topic/my-topic-exchange-1/my.*.#/my-topic-queue-1",
        async ({ message }) => {
          messagesReceived.push(message);
        }
      )
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage(
            "topic/my-topic-exchange-1/my.routing.key",
            {
              value: "my.routing.key",
            }
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-1/my.stuff.thing",
            {
              value: "my.stuff.thing",
            }
          ),
          publishChannel.publishMessage("topic/my-topic-exchange-1/my.thing", {
            value: "my.thing",
          }),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-1/your.stuff.thing",
            {
              value: "your.stuff.thing",
            }
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-1/your.stuff",
            {
              value: "your.stuff",
            }
          ),
        ]);
      })
      .catch(reject);
  });
  const values = result.map((m) => m.content.value);
  expect(values.length).toBe(3);
  expect(values.includes("my.routing.key")).toBe(true);
  expect(values.includes("my.stuff.thing")).toBe(true);
  expect(values.includes("my.thing")).toBe(true);
});

test("publish subscribe topic buffer on json channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "topic/my-topic-exchange-2/my.*.#/my-topic-queue-2",
        async ({ message }) => {
          messagesReceived.push(message);
        }
      )
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage(
            "topic/my-topic-exchange-2/my.routing.key",
            Buffer.from(
              JSON.stringify({
                value: "my.routing.key",
              })
            )
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-2/my.stuff.thing",
            Buffer.from(
              JSON.stringify({
                value: "my.stuff.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-2/my.thing",
            Buffer.from(
              JSON.stringify({
                value: "my.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-2/your.stuff.thing",
            Buffer.from(
              JSON.stringify({
                value: "your.stuff.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "topic/my-topic-exchange-2/your.stuff",
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
  const contentType = result.map((m) => m.content.type);
  expect(contentType.length).toBe(3);
  expect(R.uniq(contentType).length).toBe(1);
  expect(contentType[0]).toBe("Buffer");
});
