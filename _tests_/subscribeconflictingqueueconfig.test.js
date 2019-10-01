jest.setTimeout(30000);

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
        channel.deleteExchange("my-conflicting-exchange-2"),
        channel.deleteQueue("my-conflicting-queue-2")
      ]);
    });
  });

  return Promise.all([subscribeChannel.close(), channelcleanup.close()]).then(
    () => Promise.all([amqpconnection.close(), amqpconnectioncleanup.close()])
  );
});

test("subscribe conflicting exchange config", async () => {
  let failsToSubscribeWithConflictingQueueConfig = false;
  await subscribeChannel
    .subscribeToMessages(
      "direct/my-conflicting-exchange-2/my.routing.key/my-conflicting-queue-2",
      async () => {},
      {
        queue: {
          exclusive: true
        }
      }
    )
    .then(() => {
      return subscribeChannel
        .subscribeToMessages(
          "direct/my-conflicting-exchange-2/my.routing.key/my-conflicting-queue-2",
          async () => {},
          {
            queue: {
              exclusive: false
            }
          }
        )
        .catch(() => {
          failsToSubscribeWithConflictingQueueConfig = true;
        });
    });
  expect(failsToSubscribeWithConflictingQueueConfig).toBe(true);
});
