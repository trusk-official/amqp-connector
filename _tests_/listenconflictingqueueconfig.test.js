const Promise = require("bluebird");
const amqpconnector = require("../src/index");

let amqpconnection = null;
let subscribeChannel = null;

beforeAll(async () => {
  amqpconnection = amqpconnector({
    urls: ["amqp://localhost:5672"],
    serviceName: "my_service",
    serviceVersion: "1.2.3"
  }).connect();
  return new Promise(resolve => {
    amqpconnection.on("connect", async () => {
      subscribeChannel = amqpconnection.buildChannelIfNotExists({
        name: "subscribeChannel",
        json: true
      });
      Promise.all([subscribeChannel.waitForConnect()]).then(resolve);
    });
  });
});

afterAll(async () => {
  const amqpconnectioncleanup = amqpconnector({
    urls: ["amqp://localhost:5672"],
    serviceName: "my_service",
    serviceVersion: "1.2.3"
  }).connect();
  let channelcleanup = null;
  await new Promise(resolve => {
    amqpconnectioncleanup.on("connect", async () => {
      channelcleanup = amqpconnectioncleanup.buildChannelIfNotExists({
        name: "cleanupChannel",
        json: true
      });
      channelcleanup.waitForConnect().then(resolve);
    });
  }).then(() => {
    return channelcleanup.addSetup(channel => {
      return Promise.all([
        channel.deleteQueue("my-conflicting-rpc-function-1"),
        channel.deleteQueue("my-conflicting-rpc-function-2")
      ]);
    });
  });

  return Promise.all([subscribeChannel.close(), channelcleanup.close()]).then(
    () => Promise.all([amqpconnection.close(), amqpconnectioncleanup.close()])
  );
});

test("listen conflicting exchange config", async () => {
  let failsToListenWithConflictingQueueConfig = false;
  await subscribeChannel
    .listen(
      "my-conflicting-rpc-function-1",
      async ({ message }) => {
        return { value: 10 * message.content.value };
      },
      {
        queue: {
          exclusive: true
        }
      }
    )
    .then(() => {
      return subscribeChannel
        .listen(
          "my-conflicting-rpc-function-1",
          async ({ message }) => {
            return { value: 5 * message.content.value };
          },
          {
            queue: {
              exclusive: false
            }
          }
        )
        .catch(() => {
          failsToListenWithConflictingQueueConfig = true;
        });
    });
  expect(failsToListenWithConflictingQueueConfig).toBe(true);
});
