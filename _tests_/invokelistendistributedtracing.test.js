const Promise = require("bluebird");
const amqpconnector = require("../src/index");

let amqpconnection1 = null;
let amqpconnection2 = null;
let publishChannel1 = null;
let subscribeChannel1 = null;
let publishChannel2 = null;
let subscribeChannel2 = null;
const cTags = [];

beforeAll(async () => {
  amqpconnection1 = amqpconnector({
    urls: ["amqp://localhost:5672"],
    serviceName: "my_service_1",
    serviceVersion: "1.2.3"
  }).connect();
  amqpconnection2 = amqpconnector({
    urls: ["amqp://localhost:5672"],
    serviceName: "my_service_2",
    serviceVersion: "4.5.6"
  }).connect();

  return Promise.all([
    new Promise(resolve => {
      amqpconnection1.on("connect", async () => {
        publishChannel1 = amqpconnection1.buildChannelIfNotExists({
          name: "publishChannel1",
          json: true
        });
        subscribeChannel1 = amqpconnection1.buildChannelIfNotExists({
          name: "subscribeChannel1",
          json: true
        });
        Promise.all([
          publishChannel1.waitForConnect(),
          subscribeChannel1.waitForConnect()
        ]).then(resolve);
      });
    }),
    new Promise(resolve => {
      amqpconnection2.on("connect", async () => {
        publishChannel2 = amqpconnection2.buildChannelIfNotExists({
          name: "publishChannel2",
          json: true
        });
        subscribeChannel2 = amqpconnection2.buildChannelIfNotExists({
          name: "subscribeChannel2",
          json: true
        });
        Promise.all([
          publishChannel2.waitForConnect(),
          subscribeChannel2.waitForConnect()
        ]).then(resolve);
      });
    })
  ]);
});

afterAll(async () => {
  await subscribeChannel2.addSetup(channel => {
    return Promise.resolve()
      .then(() => {
        return Promise.all(cTags.map(t => channel.cancel(t)));
      })
      .then(() => {
        return Promise.all([
          channel.deleteQueue("my-traced-rpc-function-1"),
          channel.deleteQueue("my-traced-rpc-function-2"),
          channel.deleteQueue("my-traced-rpc-function-3"),
          channel.deleteQueue("my-traced-rpc-function-4")
        ]);
      });
  });
  return Promise.all([
    publishChannel1.close(),
    subscribeChannel1.close(),
    publishChannel2.close(),
    subscribeChannel2.close()
  ]).then(() =>
    Promise.all([amqpconnection1.close(), amqpconnection2.close()])
  );
});

test("invoke listen RPC function traced", async () => {
  const headerStack = [];

  const { consumerTag: fn4ct } = await subscribeChannel1.listen(
    "my-traced-rpc-function-4",
    async ({ message }) => {
      headerStack.push(message.properties.headers);
      return { value: 5 * message.content.value };
    }
  );

  const { consumerTag: fn3ct } = await subscribeChannel2.listen(
    "my-traced-rpc-function-3",
    async ({ message, invoke }) => {
      headerStack.push(message.properties.headers);
      const mess = await invoke("my-traced-rpc-function-4", {
        value: 4 * message.content.value
      });
      return mess.content;
    }
  );

  const { consumerTag: fn2ct } = await subscribeChannel2.listen(
    "my-traced-rpc-function-2",
    async ({ message, invoke }) => {
      headerStack.push(message.properties.headers);
      const mess = await invoke("my-traced-rpc-function-3", {
        value: 3 * message.content.value
      });
      return mess.content;
    }
  );

  const { consumerTag: fn1ct } = await subscribeChannel1.listen(
    "my-traced-rpc-function-1",
    async ({ message, invoke }) => {
      headerStack.push(message.properties.headers);
      const mess = await invoke("my-traced-rpc-function-2", {
        value: 2 * message.content.value
      });
      return mess.content;
    }
  );

  cTags.push(fn1ct, fn2ct, fn3ct, fn4ct);

  const result = await publishChannel1
    .invoke("my-traced-rpc-function-1", { value: 42 })
    .then(response => {
      return response.content.value;
    });

  expect(result).toBe(42 * 2 * 3 * 4 * 5);
  expect(headerStack.length).toBe(4);
  expect(headerStack[0]["x-service"]).toBe("my_service_1");
  expect(headerStack[0]["x-service-version"]).toBe("1.2.3");
  expect(headerStack[0]["x-consumer"]).toBe("my-traced-rpc-function-1");
  expect(headerStack[0]["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(headerStack[0]["x-timestamp"]).toBeLessThan(+new Date() + 1000);
  expect(headerStack[0]["x-transaction-stack"].length).toBe(1);
  expect(headerStack[1]["x-service"]).toBe("my_service_1");
  expect(headerStack[1]["x-service-version"]).toBe("1.2.3");
  expect(headerStack[1]["x-consumer"]).toBe("my-traced-rpc-function-2");
  expect(headerStack[1]["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(headerStack[1]["x-timestamp"]).toBeLessThan(+new Date() + 1000);
  expect(headerStack[1]["x-transaction-stack"].length).toBe(2);
  expect(headerStack[2]["x-service"]).toBe("my_service_2");
  expect(headerStack[2]["x-service-version"]).toBe("4.5.6");
  expect(headerStack[2]["x-consumer"]).toBe("my-traced-rpc-function-3");
  expect(headerStack[2]["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(headerStack[2]["x-timestamp"]).toBeLessThan(+new Date() + 1000);
  expect(headerStack[2]["x-transaction-stack"].length).toBe(3);
  expect(headerStack[3]["x-service"]).toBe("my_service_2");
  expect(headerStack[3]["x-service-version"]).toBe("4.5.6");
  expect(headerStack[3]["x-consumer"]).toBe("my-traced-rpc-function-4");
  expect(headerStack[3]["x-timestamp"]).toBeGreaterThanOrEqual(
    +new Date() - 1000
  );
  expect(headerStack[3]["x-timestamp"]).toBeLessThan(+new Date() + 1000);
  expect(headerStack[3]["x-transaction-stack"].length).toBe(4);
});
