jest.setTimeout(30000);

const Promise = require("bluebird");
const amqpconnector = require("../src/index");

const amqpconnection1 = amqpconnector({
  urls: ["amqp://localhost:5672"],
  serviceName: "my_service_1",
  serviceVersion: "1.2.3",
}).connect();

const amqpconnection2 = amqpconnector({
  urls: ["amqp://localhost:5672"],
  serviceName: "my_service_2",
  serviceVersion: "4.5.6",
}).connect();

const publishChannel1 = amqpconnection1.buildChannelIfNotExists({
  name: "publishChannel1",
  json: true,
});

const subscribeChannel1 = amqpconnection1.buildChannelIfNotExists({
  name: "subscribeChannel1",
  json: true,
});

const publishChannel2 = amqpconnection2.buildChannelIfNotExists({
  name: "publishChannel2",
  json: true,
});

const subscribeChannel2 = amqpconnection2.buildChannelIfNotExists({
  name: "subscribeChannel2",
  json: true,
});

beforeAll(async () =>
  Promise.all([
    subscribeChannel1.waitForConnect(),
    subscribeChannel2.waitForConnect(),
  ])
);

afterAll(async () => {
  await Promise.all([
    publishChannel1.addSetup((channel) =>
      Promise.all([
        channel.deleteExchange("my-direct-traced-exchange-1"),
        channel.deleteExchange("my-direct-traced-exchange-2"),
        channel.deleteQueue("my-traced-queue-1"),
        channel.deleteQueue("my-traced-queue-2"),
      ])
    ),
    subscribeChannel2.addSetup((channel) =>
      Promise.all([channel.deleteQueue("my-traced-rpc-function-5")])
    ),
  ]);

  return Promise.all([
    publishChannel1.close(),
    subscribeChannel1.close(),
    publishChannel2.close(),
    subscribeChannel2.close(),
  ]).then(() =>
    Promise.all([amqpconnection1.close(), amqpconnection2.close()])
  );
});

test("publish subscribe RPC function traced", async () => {
  const headerStack = [];

  const result = await new Promise((resolve, reject) => {
    subscribeChannel2.listen(
      "my-traced-rpc-function-5",
      async ({ message, publishMessage }) => {
        headerStack.push(message.properties.headers);
        await publishMessage(
          "direct/my-direct-traced-exchange-2/my.routing.key",
          {
            value: 3 * message.content.value,
          }
        );
        return "ok";
      }
    );

    Promise.all([
      subscribeChannel1.subscribeToMessages(
        "direct/my-direct-traced-exchange-2/my.routing.key/my-traced-queue-2",
        async ({ message }) => {
          headerStack.push(message.properties.headers);
          resolve(message.content.value);
        }
      ),
      subscribeChannel1.subscribeToMessages(
        "direct/my-direct-traced-exchange-1/my.routing.key/my-traced-queue-1",
        async ({ message, invoke }) => {
          headerStack.push(message.properties.headers);
          await invoke("my-traced-rpc-function-5", {
            value: 2 * message.content.value,
          });
        }
      ),
    ])
      .then(() =>
        publishChannel1.publishMessage(
          "direct/my-direct-traced-exchange-1/my.routing.key",
          {
            value: 42,
          }
        )
      )
      .catch(reject);
  });

  expect(result).toBe(42 * 2 * 3);
  expect(headerStack.length).toBe(3);
  expect(headerStack[0]["x-service"]).toBe("my_service_1");
  expect(headerStack[0]["x-service-version"]).toBe("1.2.3");
  expect(headerStack[0]["x-transaction-stack"].length).toBe(1);
  expect(headerStack[0]["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(headerStack[0]["x-timestamp"]).toBeLessThan(+new Date() + 1000);
  expect(headerStack[1]["x-service"]).toBe("my_service_1");
  expect(headerStack[1]["x-service-version"]).toBe("1.2.3");
  expect(headerStack[1]["x-consumer"]).toBe("my-traced-rpc-function-5");
  expect(headerStack[1]["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(headerStack[1]["x-timestamp"]).toBeLessThan(+new Date() + 1000);
  expect(headerStack[1]["x-transaction-stack"].length).toBe(2);
  expect(headerStack[1]["x-origin-service"]).toBe("my_service_1");
  expect(headerStack[1]["x-origin-consumer"]).toBe(
    "direct/my-direct-traced-exchange-1/my.routing.key/my-traced-queue-1"
  );
  expect(headerStack[2]["x-service"]).toBe("my_service_2");
  expect(headerStack[2]["x-service-version"]).toBe("4.5.6");
  expect(headerStack[2]["x-origin-service"]).toBe("my_service_1");
  expect(headerStack[2]["x-origin-consumer"]).toBe("my-traced-rpc-function-5");
  expect(headerStack[2]["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(headerStack[2]["x-timestamp"]).toBeLessThan(+new Date() + 1000);
  expect(headerStack[2]["x-transaction-stack"].length).toBe(3);
});
