jest.setTimeout(30000);

const Promise = require("bluebird");
const amqpconnector = require("../src/index");

let amqpconnection = null;
let publishChannel = null;
let subscribeChannel = null;
const cTags = [];

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
  await subscribeChannel.addSetup(channel => {
    return Promise.resolve()
      .then(() => {
        return Promise.all(cTags.map(t => channel.cancel(t)));
      })
      .then(() => channel.deleteQueue("my-rpc-timeout-function"));
  });
  return Promise.all([publishChannel.close(), publishChannel.close()]).then(
    () => Promise.all([amqpconnection.close()])
  );
});

test("invoke subscribe RPC function", async () => {
  const { consumerTag } = await subscribeChannel.listen(
    "my-rpc-timeout-function",
    async ({ message }) => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ value: 10 * message.content.value });
        }, 2000);
      });
    }
  );
  cTags.push(consumerTag);
  const result = await new Promise(resolve => {
    publishChannel
      .invoke("my-rpc-timeout-function", { value: 45 }, { timeout: 1000 })
      .then(response => {
        resolve(response.content.value);
      })
      .catch(e => {
        resolve(e);
      });
  });
  expect(result.message).toBe("timeout_1000ms");
});
