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

beforeAll(async () => subscribeChannel.waitForConnect());

afterAll(async () => {
  await publishChannel.addSetup((channel) =>
    Promise.all([
      channel.deleteExchange("any-exchange-1"),
      channel.deleteExchange("any-exchange-2"),
      channel.deleteQueue("my-q-queue-1"),
      channel.deleteQueue("my-q-queue-2"),
    ])
  );

  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
});

test("publish subscribe q json on json channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "direct/any-exchange-1//my-q-queue-1",
        async ({ message }) => {
          messagesReceived.push(message);
        }
      )
      .then(() =>
        Promise.all([
          publishChannel.publishMessage("q/my-q-queue-1", {
            value: "my.routing.key",
          }),
          publishChannel.publishMessage("q/my-q-queue-1", {
            value: "my.stuff.thing",
          }),
          publishChannel.publishMessage("q/my-q-queue-1", {
            value: "my.thing",
          }),
          publishChannel.publishMessage("q/my-q-queue-1", {
            value: "your.stuff.thing",
          }),
          publishChannel.publishMessage("q/my-q-queue-1", {
            value: "your.stuff",
          }),
        ])
      )
      .catch(reject);
  });
  const values = result.map((m) => m.content.value);
  expect(values.length).toBe(5);
  expect(values.includes("my.routing.key")).toBe(true);
  expect(values.includes("my.stuff.thing")).toBe(true);
  expect(values.includes("my.thing")).toBe(true);
  expect(values.includes("your.stuff.thing")).toBe(true);
  expect(values.includes("your.stuff")).toBe(true);
  expect(result[0].properties.headers["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(result[0].properties.headers["x-timestamp"]).toBeLessThan(
    +new Date() + 1000
  );
});

test("publish subscribe q buffer on json channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "direct/any-exchange-2//my-q-queue-2",
        async ({ message }) => {
          messagesReceived.push(message);
        }
      )
      .then(() =>
        Promise.all([
          publishChannel.publishMessage(
            "q/my-q-queue-2",
            Buffer.from(
              JSON.stringify({
                value: "my.routing.key",
              })
            )
          ),
          publishChannel.publishMessage(
            "q/my-q-queue-2",
            Buffer.from(
              JSON.stringify({
                value: "my.stuff.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "q/my-q-queue-2",
            Buffer.from(
              JSON.stringify({
                value: "my.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "q/my-q-queue-2",
            Buffer.from(
              JSON.stringify({
                value: "your.stuff.thing",
              })
            )
          ),
          publishChannel.publishMessage(
            "q/my-q-queue-2",
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
  const contentType = result.map((m) => m.content.type);
  expect(contentType.length).toBe(5);
  expect(R.uniq(contentType).length).toBe(1);
  expect(contentType[0]).toBe("Buffer");
  expect(result[0].properties.headers["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(result[0].properties.headers["x-timestamp"]).toBeLessThan(
    +new Date() + 1000
  );
});
