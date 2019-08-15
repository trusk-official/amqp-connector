const Promise = require("bluebird");
const R = require("ramda");
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
      channel.deleteExchange("my-headers-exchange-1"),
      channel.deleteExchange("my-headers-exchange-2"),
      channel.deleteQueue("my-headers-queue-1"),
      channel.deleteQueue("my-headers-queue-2")
    ]);
  });

  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
});

test("publish subscribe headers json on json channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "headers/my-headers-exchange-1/my-headers-queue-1",
        async ({ message }) => {
          messagesReceived.push(message);
        },
        {
          headers: {
            foo: "bar",
            fiz: "biz",
            "x-match": "any"
          }
        }
      )
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage(
            "headers/my-headers-exchange-1",
            {
              value: "my.routing.key"
            },
            { headers: { foo: "bar", fiz: "biz", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-1",
            {
              value: "my.stuff.thing"
            },
            { headers: { foo: "bar", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-1",
            {
              value: "my.thing"
            },
            { headers: { foo: "bar", fiz: "bzz", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-1",
            {
              value: "your.stuff.thing"
            },
            { headers: { foo: "bir", fiz: "buz", number: 2 } }
          ),
          publishChannel.publishMessage("headers/my-headers-exchange-1", {
            value: "your.stuff"
          })
        ]);
      })
      .catch(reject);
  });
  const values = result.map(m => m.content.value);
  expect(values.length).toBe(3);
  expect(values.includes("my.routing.key")).toBe(true);
  expect(values.includes("my.stuff.thing")).toBe(true);
  expect(values.includes("my.thing")).toBe(true);
});

test("publish subscribe headers buffer on json channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "headers/my-headers-exchange-2/my-headers-queue-2",
        async ({ message }) => {
          messagesReceived.push(message);
        },
        {
          headers: {
            foo: "bar",
            fiz: "biz",
            "x-match": "any"
          }
        }
      )
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage(
            "headers/my-headers-exchange-2",
            Buffer.from(
              JSON.stringify({
                value: "my.routing.key"
              })
            ),
            { headers: { foo: "bar", fiz: "biz", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-2",
            Buffer.from(
              JSON.stringify({
                value: "my.stuff.thing"
              })
            ),
            { headers: { foo: "bar", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-2",
            Buffer.from(
              JSON.stringify({
                value: "my.thing"
              })
            ),
            { headers: { foo: "bar", fiz: "bzz", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-2",
            Buffer.from(
              JSON.stringify({
                value: "your.stuff.thing"
              })
            ),
            { headers: { foo: "bir", fiz: "buz", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-2",
            Buffer.from(
              JSON.stringify({
                value: "your.stuff"
              })
            )
          )
        ]);
      })
      .catch(reject);
  });
  const contentType = result.map(m => m.content.type);
  expect(contentType.length).toBe(3);
  expect(R.uniq(contentType).length).toBe(1);
  expect(contentType[0]).toBe("Buffer");
});
