jest.setTimeout(30000);

const Promise = require("bluebird");
const Joi = require("joi");

const amqpconnector = require("../src/index");

const cTags = [];

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
  await subscribeChannel.addSetup((channel) =>
    Promise.resolve()
      .then(() => Promise.all(cTags.map((t) => channel.cancel(t))))
      .then(() =>
        Promise.all([
          channel.deleteQueue("my-validated-rpc-function-5"),
          channel.deleteQueue("my-validated-rpc-function-6"),
        ])
      )
  );
  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
});

test("message format validation on listen 1", async () => {
  const schema = Joi.object({
    content: Joi.object(),
    properties: Joi.object({
      headers: Joi.object({
        "x-service-version": Joi.string().valid("1.2.3"),
      }).unknown(),
    }).unknown(),
  }).unknown();
  const { consumerTag: ct1 } = await subscribeChannel.listen(
    "my-validated-rpc-function-5",
    async ({ message }) => message.content,
    {
      validator: schema.validate.bind(schema),
    }
  );
  cTags.push(ct1);
  const result = await publishChannel.invoke("my-validated-rpc-function-5", {
    value: 42,
  });
  expect(result.content.value).toBe(42);
});

test("message format validation on listen 2", async () => {
  const schema = Joi.object({
    content: Joi.object(),
    properties: Joi.object({
      headers: Joi.object({
        "x-service-version": Joi.string().valid("4.5.6"),
      }).unknown(),
    }).unknown(),
  }).unknown();
  const { consumerTag: ct2 } = await subscribeChannel.listen(
    "my-validated-rpc-function-6",
    async ({ message }) => message.content,
    {
      validator: schema.validate.bind(schema),
    }
  );
  cTags.push(ct2);
  const result = await publishChannel
    .invoke("my-validated-rpc-function-6", {
      value: 42,
    })
    .catch((e) => e);
  expect(result.content.stack.split(":")[0]).toBe("ValidationError");
  expect(result.content.details[0].message).toBe(
    `"properties.headers.x-service-version" must be [4.5.6]`
  );
});
