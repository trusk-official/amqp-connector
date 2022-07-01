jest.setTimeout(30000);

const Promise = require("bluebird");
const amqpconnector = require("../src/index");

const amqpconnection = amqpconnector({
  urls: ["amqp://localhost:5672"],
  serviceName: "my_service",
  serviceVersion: "1.2.3",
}).connect();

const subscribeChannel = amqpconnection.buildChannelIfNotExists({
  name: "subscribeChannel",
  json: true,
});

beforeAll(async () => subscribeChannel.waitForConnect());

afterAll(async () => {
  const amqpconnectioncleanup = amqpconnector({
    urls: ["amqp://localhost:5672"],
    serviceName: "my_service",
    serviceVersion: "1.2.3",
  }).connect();
  let channelcleanup = null;
  await new Promise((resolve) => {
    amqpconnectioncleanup.on("connect", async () => {
      channelcleanup = amqpconnectioncleanup.buildChannelIfNotExists({
        name: "cleanupChannel",
        json: true,
      });
      channelcleanup.waitForConnect().then(resolve);
    });
  }).then(() =>
    channelcleanup.addSetup((channel) =>
      Promise.all([
        channel.deleteQueue("my-conflicting-rpc-function-1"),
        channel.deleteQueue("my-conflicting-rpc-function-2"),
      ])
    )
  );

  return Promise.all([subscribeChannel.close(), channelcleanup.close()]).then(
    () => Promise.all([amqpconnection.close(), amqpconnectioncleanup.close()])
  );
});

test("listen conflicting exchange config", async () => {
  let failsToListenWithConflictingQueueConfig = false;
  await subscribeChannel
    .listen(
      "my-conflicting-rpc-function-1",
      async ({ message }) => ({ value: 10 * message.content.value }),
      {
        queue: {
          exclusive: true,
        },
      }
    )
    .then(() =>
      subscribeChannel
        .listen(
          "my-conflicting-rpc-function-1",
          async ({ message }) => ({ value: 5 * message.content.value }),
          {
            queue: {
              exclusive: false,
            },
          }
        )
        .catch(() => {
          failsToListenWithConflictingQueueConfig = true;
        })
    );
  expect(failsToListenWithConflictingQueueConfig).toBe(true);
});
