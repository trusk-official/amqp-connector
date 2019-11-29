jest.setTimeout(30000);

const Promise = require("bluebird");
const amqpconnector = require("../src/index");

const cTags = [];

const amqpconnection = amqpconnector({
  urls: ["amqp://localhost:5672"],
  serviceName: "my_service",
  serviceVersion: "1.2.3"
}).connect();

const publishChannel = amqpconnection.buildChannelIfNotExists({
  name: "publishChannel"
});

const subscribeChannel = amqpconnection.buildChannelIfNotExists({
  name: "subscribeChannel"
});

beforeAll(async () => {
  return subscribeChannel.waitForConnect();
});

afterAll(async () => {
  await subscribeChannel.addSetup(channel => {
    return Promise.resolve()
      .then(() => {
        return Promise.all(cTags.map(t => channel.cancel(t)));
      })
      .then(() => channel.deleteQueue("my-rpc-function-2"));
  });
  return Promise.all([publishChannel.close(), publishChannel.close()]).then(
    () => Promise.all([amqpconnection.close()])
  );
});

test("invoke subscribe RPC function", async () => {
  const { consumerTag } = await subscribeChannel.listen(
    "my-rpc-function-2",
    async ({ message }) => {
      return Buffer.from(
        JSON.stringify({ value: 10 * JSON.parse(message.content).value })
      );
    }
  );
  cTags.push(consumerTag);
  const result = await new Promise(resolve => {
    publishChannel
      .invoke("my-rpc-function-2", Buffer.from(JSON.stringify({ value: 45 })))
      .then(response => {
        resolve(JSON.parse(response.content).value);
      });
  });
  expect(result).toBe(450);
});
