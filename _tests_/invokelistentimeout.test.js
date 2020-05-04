jest.setTimeout(30000);

const Promise = require("bluebird");
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

beforeAll(async () => {
  return subscribeChannel.waitForConnect();
});

afterAll(async () => {
  await subscribeChannel.addSetup((channel) => {
    return Promise.resolve()
      .then(() => {
        return Promise.all(cTags.map((t) => channel.cancel(t)));
      })
      .then(() => channel.deleteQueue("my-rpc-timeout-function"));
  });
  return Promise.all([
    publishChannel.close(),
    publishChannel.close(),
  ]).then(() => Promise.all([amqpconnection.close()]));
});

test("invoke subscribe RPC function", async () => {
  const { consumerTag } = await subscribeChannel.listen(
    "my-rpc-timeout-function",
    async ({ message }) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ value: 10 * message.content.value });
        }, 2000);
      });
    }
  );
  cTags.push(consumerTag);
  const result = await new Promise((resolve) => {
    publishChannel
      .invoke("my-rpc-timeout-function", { value: 45 }, { timeout: 1000 })
      .then((response) => {
        resolve(response.content.value);
      })
      .catch((e) => {
        resolve(e);
      });
  });
  expect(result.message).toBe("timeout_1000ms");
});
