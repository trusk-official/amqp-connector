jest.setTimeout(30000);

const Promise = require("bluebird");
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
        json: "true",
        realm: "space."
      });
      subscribeChannel = amqpconnection.buildChannelIfNotExists({
        name: "subscribeChannel",
        json: "true",
        realm: "space."
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
      channel.deleteExchange("space.my-direct-exchange-dead-1"),
      channel.deleteExchange("space.dl_500"),
      channel.deleteQueue("space.my-direct-queue-dead-1"),
      channel.deleteQueue("space.dl_500"),
      channel.deleteQueue("space.the_dump_queue")
    ]);
  });

  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
});

test("publish json on deadlettered subscribe", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    let c = 0;
    setTimeout(() => {
      resolve(messagesReceived);
    }, 5000);
    subscribeChannel
      .subscribeToMessages(
        "direct/my-direct-exchange-dead-1/dead/my-direct-queue-dead-1",
        async ({ message }) => {
          c += 1;
          messagesReceived.push(`${message.content.value}_${c}`);
          throw new Error();
        },
        {
          retry: 500,
          maxTries: 4,
          dumpQueue: "the_dump_queue"
        }
      )
      .then(() => {
        return publishChannel.publishMessage(
          "direct/my-direct-exchange-dead-1/dead",
          { value: "bar" }
        );
      })
      .catch(reject);
  });
  expect(result.length).toBe(4);
  expect(result.includes("bar_1")).toBe(true);
  expect(result.includes("bar_2")).toBe(true);
  expect(result.includes("bar_3")).toBe(true);
  expect(result.includes("bar_4")).toBe(true);
});
