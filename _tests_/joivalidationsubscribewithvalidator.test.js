jest.setTimeout(30000);

const Promise = require("bluebird");
const Joi = require("@hapi/joi");

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
      channel.deleteExchange("my-direct-validated-exchange-1"),
      channel.deleteExchange("my-direct-validated-exchange-2"),
      channel.deleteExchange("my-direct-validated-exchange-3"),
      channel.deleteExchange("my-direct-validated-exchange-4"),
      channel.deleteQueue("my-validated-queue-1"),
      channel.deleteQueue("my-validated-queue-2"),
      channel.deleteQueue("my-validated-queue-3"),
      channel.deleteQueue("my-validated-queue-4"),
    ]);
  });

  return Promise.all([
    publishChannel.close(),
    subscribeChannel.close(),
  ]).then(() => amqpconnection.close());
});

test("message format validation on subscribe (1)", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived_1 = [];
    const messagesReceived_2 = [];
    const schema1 = Joi.object({
      content: Joi.object(),
      properties: Joi.object({
        headers: Joi.object({
          "x-service-version": Joi.string().valid("1.2.3"),
        }).unknown(),
      }).unknown(),
    }).unknown();
    const schema2 = Joi.object({
      content: Joi.object(),
      properties: Joi.object({
        headers: Joi.object({
          "x-service-version": Joi.string().valid("4.5.6"),
        }).unknown(),
      }).unknown(),
    }).unknown();

    Promise.all([
      subscribeChannel.subscribeToMessages(
        "direct/my-direct-validated-exchange-1/my.routing.key/my-validated-queue-1",
        async ({ message }) => {
          messagesReceived_1.push(message);
        },
        {
          validator: schema1.validate.bind(schema1),
        }
      ),
      subscribeChannel.subscribeToMessages(
        "direct/my-direct-validated-exchange-2/my.routing.key/my-validated-queue-2",
        async ({ message }) => {
          messagesReceived_2.push(message);
        },
        {
          validator: schema2.validate.bind(schema2),
        }
      ),
    ])
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage(
            "direct/my-direct-validated-exchange-1/my.routing.key",
            {
              foo: "bar",
            }
          ),
          publishChannel.publishMessage(
            "direct/my-direct-validated-exchange-2/my.routing.key",
            {
              foo: "biz",
            }
          ),
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