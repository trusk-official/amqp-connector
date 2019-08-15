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
      .then(() => channel.deleteQueue("my-rpc-function-3"));
  });
  return Promise.all([publishChannel.close(), publishChannel.close()]).then(
    () => Promise.all([amqpconnection.close()])
  );
});

test("invoke subscribe RPC function", async () => {
  const { consumerTag } = await subscribeChannel.listen(
    "my-rpc-function-3",
    async () => {
      throw new Error("an_error_happened");
    }
  );
  cTags.push(consumerTag);
  const result = await new Promise(resolve => {
    publishChannel
      .invoke("my-rpc-function-3", { value: 45 })
      .catch(response => {
        resolve(response.content.message);
      });
  });
  expect(result).toBe("an_error_happened");
});
