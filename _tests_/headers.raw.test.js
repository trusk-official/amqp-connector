jest.setTimeout(30000);

const Promise = require("bluebird");
const amqpconnector = require("../src/index");

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
  await publishChannel.addSetup(channel => {
    return Promise.all([
      channel.deleteExchange("my-headers-exchange-3"),
      channel.deleteExchange("my-headers-exchange-4"),
      channel.deleteQueue("my-headers-queue-3"),
      channel.deleteQueue("my-headers-queue-4")
    ]);
  });

  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
});

test("publish subscribe Buffer json on raw channel", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "headers/my-headers-exchange-3/my-headers-queue-3",
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
            "headers/my-headers-exchange-3",
            Buffer.from(
              JSON.stringify({
                value: "my.routing.key"
              })
            ),
            { headers: { foo: "bar", fiz: "biz", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-3",
            Buffer.from(
              JSON.stringify({
                value: "my.stuff.thing"
              })
            ),
            { headers: { foo: "bar", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-3",
            Buffer.from(
              JSON.stringify({
                value: "my.thing"
              })
            ),
            { headers: { foo: "bar", fiz: "bzz", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-3",
            Buffer.from(
              JSON.stringify({
                value: "your.stuff.thing"
              })
            ),
            { headers: { foo: "bir", fiz: "buz", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-3",
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
  const values = result.map(m => JSON.parse(Buffer.from(m.content)).value);
  expect(values.length).toBe(3);
  expect(values.includes("my.routing.key")).toBe(true);
  expect(values.includes("my.stuff.thing")).toBe(true);
  expect(values.includes("my.thing")).toBe(true);
});

test("publish subscribe headers json on raw channel", async () => {
  const result = await new Promise(resolve => {
    const messagesReceived = [];
    setTimeout(() => {
      resolve(messagesReceived);
    }, 1000);
    subscribeChannel
      .subscribeToMessages(
        "headers/my-headers-exchange-4/my-headers-queue-4",
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
            "headers/my-headers-exchange-4",
            {
              value: "my.routing.key"
            },
            { headers: { foo: "bar", fiz: "biz", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-4",
            {
              value: "my.stuff.thing"
            },
            { headers: { foo: "bar", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-4",
            {
              value: "my.thing"
            },
            { headers: { foo: "bar", fiz: "bzz", number: 2 } }
          ),
          publishChannel.publishMessage(
            "headers/my-headers-exchange-4",
            {
              value: "your.stuff.thing"
            },
            { headers: { foo: "bir", fiz: "buz", number: 2 } }
          ),
          publishChannel.publishMessage("headers/my-headers-exchange-4", {
            value: "your.stuff"
          })
        ]);
      })
      .catch(e => {
        messagesReceived.push(e);
      });
  });
  expect(result.length).toBe(1);
  expect(result[0].message).toBe("content is not a buffer");
});
