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
        channel.deleteExchange("my-conflicting-exchange-1"),
        channel.deleteQueue("my-conflicting-queue-1"),
      ])
    )
  );

  return Promise.all([subscribeChannel.close(), channelcleanup.close()]).then(
    () => Promise.all([amqpconnection.close(), amqpconnectioncleanup.close()])
  );
});

test("subscribe conflicting exchange config", async () => {
  let failsToSubscribeWithConflictingExchangeConfig = false;
  await subscribeChannel
    .subscribeToMessages(
      "direct/my-conflicting-exchange-1/my.routing.key/my-conflicting-queue-1",
      async () => {},
      {
        exchange: {
          durable: true,
        },
      }
    )
    .then(() =>
      subscribeChannel
        .subscribeToMessages(
          "direct/my-conflicting-exchange-1/my.routing.key/my-conflicting-queue-1",
          async () => {},
          {
            exchange: {
              durable: false,
            },
          }
        )
        .catch(() => {
          failsToSubscribeWithConflictingExchangeConfig = true;
        })
    );
  expect(failsToSubscribeWithConflictingExchangeConfig).toBe(true);
});
