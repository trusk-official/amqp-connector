jest.setTimeout(30000);

const Promise = require("bluebird");
const Joi = require("@hapi/joi");

const amqpconnector = require("../src/index");

let amqpconnection = null;
let publishChannel = null;
let subscribeChannel = null;

beforeAll(async () => {
  amqpconnection = amqpconnector({
    urls: ["amqp://localhost:5672"],
    serviceName: "my_service",
    serviceVersion: "1.2.3"
  }).connect();
  return new Promise(resolve => {
    amqpconnection.on("connect", async () => {
      publishChannel = amqpconnection.buildChannelIfNotExists({
        name: "publishChannel",
        json: true
      });
      subscribeChannel = amqpconnection.buildChannelIfNotExists({
        name: "subscribeChannel",
        json: true
      });
      Promise.all([
        publishChannel.waitForConnect(),
        subscribeChannel.waitForConnect()
      ]).then(resolve);
    });
  });
});

afterAll(async () => {
  await publishChannel.addSetup(channel => {
    return Promise.all([
      channel.deleteExchange("my-direct-validated-exchange-1"),
      channel.deleteExchange("my-direct-validated-exchange-2"),
        channel.deleteExchange("my-direct-validated-exchange-3"),
        channel.deleteExchange("my-direct-validated-exchange-4"),
      channel.deleteQueue("my-validated-queue-1"),
      channel.deleteQueue("my-validated-queue-2"),
      channel.deleteQueue("my-validated-queue-3"),
      channel.deleteQueue("my-validated-queue-4")
    ]);
  });

  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
});

test("message format validation on subscribe", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived_1 = [];
    const messagesReceived_2 = [];
    Promise.all([
      subscribeChannel.subscribeToMessages(
        "direct/my-direct-validated-exchange-1/my.routing.key/my-validated-queue-1",
        async ({ message }) => {
          messagesReceived_1.push(message);
        },
        {
          schema: Joi.object({
            content: Joi.object(),
            properties: Joi.object({
              headers: Joi.object({
                "x-service-version": Joi.string().valid("1.2.3")
              }).unknown()
            }).unknown()
          }).unknown()
        }
      ),
      subscribeChannel.subscribeToMessages(
        "direct/my-direct-validated-exchange-2/my.routing.key/my-validated-queue-2",
        async ({ message }) => {
          messagesReceived_2.push(message);
        },
        {
          schema: Joi.object({
            content: Joi.object(),
            properties: Joi.object({
              headers: Joi.object({
                "x-service-version": Joi.string().valid("4.5.6")
              }).unknown()
            }).unknown()
          }).unknown()
        }
      )
    ])
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage(
            "direct/my-direct-validated-exchange-1/my.routing.key",
            {
              foo: "bar"
            }
          ),
          publishChannel.publishMessage(
            "direct/my-direct-validated-exchange-2/my.routing.key",
            {
              foo: "biz"
            }
          )
        ]);
      })
      .catch(reject);
    setTimeout(() => {
      resolve([messagesReceived_1, messagesReceived_2]);
    }, 2000);
  });
  expect(result[0].length).toBe(1);
  expect(result[1].length).toBe(0);
});
