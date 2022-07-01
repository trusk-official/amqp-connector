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
});

const subscribeChannel = amqpconnection.buildChannelIfNotExists({
  name: "subscribeChannel",
});

beforeAll(async () => subscribeChannel.waitForConnect());

afterAll(async () => {
  await subscribeChannel.addSetup((channel) =>
    Promise.resolve()
      .then(() => Promise.all(cTags.map((t) => channel.cancel(t))))
      .then(() => channel.deleteQueue("my-rpc-function-4"))
  );
  return Promise.all([publishChannel.close(), publishChannel.close()]).then(
    () => Promise.all([amqpconnection.close()])
  );
});

test("invoke subscribe RPC function", async () => {
  const { consumerTag } = await subscribeChannel.listen(
    "my-rpc-function-4",
    async () => {
      throw new Error("an_error_happened");
    }
  );
  cTags.push(consumerTag);
  const result = await new Promise((resolve) => {
    publishChannel
      .invoke("my-rpc-function-4", Buffer.from(JSON.stringify({ value: 45 })))
      .catch((response) => {
        resolve(JSON.parse(response.content).message);
      });
  });
  expect(result).toBe("an_error_happened");
});
