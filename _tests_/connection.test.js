jest.setTimeout(30000);

const amqpconnector = require("../src/index");

test("connects properly", async () => {
  const amqpconnection = amqpconnector({
    urls: ["amqp://localhost:5672"],
    serviceName: "my_service",
    serviceVersion: "1.2.3",
  }).connect();
  expect(amqpconnection.constructor.name).toBe("AmqpConnectionManager");

  expect(
    new Promise((resolve) => {
      amqpconnection.on("connect", async () => {
        await amqpconnection.close();
        resolve("connect_then_closed");
      });
    })
  ).resolves.toBe("connect_then_closed");
});

test("disconnects properly", async () => {
  const amqpconnection = amqpconnector({
    urls: ["amqp://localhost:5672"],
    serviceName: "my_service",
    serviceVersion: "1.2.3",
  }).connect();
  expect(amqpconnection.constructor.name).toBe("AmqpConnectionManager");

  expect(
    new Promise((resolve) => {
      amqpconnection.on("disconnect", async () => {
        resolve("disconnect_then_closed");
      });
      amqpconnection.on("connect", async () => {
        await amqpconnection.close();
      });
    })
  ).resolves.toBe("disconnect_then_closed");
});

test("keeps current connection", async () => {
  const connector = amqpconnector({
    urls: ["amqp://localhost:5672"],
    serviceName: "my_service",
    serviceVersion: "1.2.3",
  });
  const amqpconnection = connector.connect();

  expect(
    new Promise((resolve) => {
      amqpconnection.on("connect", async () => {
        resolve();
      });
    }).then(async () => {
      const co = connector.connect();
      await amqpconnection.close();
      return co;
    })
  ).resolves.toStrictEqual(amqpconnection);
});
