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
      .then(() => {
        return Promise.all([
          channel.deleteQueue("my-text-validated-rpc-function-1"),
          channel.deleteQueue("my-text-validated-rpc-function-2"),
          channel.deleteQueue("my-text-validated-rpc-function-3"),
          channel.deleteQueue("my-text-validated-rpc-function-4")
        ]);
      });
  });
  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
});

test("message format text validation on listen 1", async () => {
  const { consumerTag: ct1 } = await subscribeChannel.listen(
    "my-text-validated-rpc-function-1",
    async ({ message }) => {
      return message.content;
    },
    {
      schema: {
        type: "object",
        flags: {
          unknown: true
        },
        keys: {
          content: {
            type: "object"
          },
          properties: {
            type: "object",
            flags: {
              unknown: true
            },
            keys: {
              headers: {
                type: "object",
                flags: {
                  unknown: true
                },
                keys: {
                  "x-service-version": {
                    type: "string",
                    flags: {
                      only: true
                    },
                    allow: ["1.2.3"]
                  }
                }
              }
            }
          }
        }
      }
    }
  );
  cTags.push(ct1);
  const result = await publishChannel.invoke(
    "my-text-validated-rpc-function-1",
    {
      value: 42
    }
  );
  expect(result.content.value).toBe(42);
});

test("message format text validation on listen 2", async () => {
  const { consumerTag: ct2 } = await subscribeChannel.listen(
    "my-text-validated-rpc-function-2",
    async ({ message }) => {
      return message.content;
    },
    {
      schema: {
        type: "object",
        flags: {
          unknown: true
        },
        keys: {
          content: {
            type: "object"
          },
          properties: {
            type: "object",
            flags: {
              unknown: true
            },
            keys: {
              headers: {
                type: "object",
                flags: {
                  unknown: true
                },
                keys: {
                  "x-service-version": {
                    type: "string",
                    flags: {
                      only: true
                    },
                    allow: ["4.5.6"]
                  }
                }
              }
            }
          }
        }
      }
    }
  );
  cTags.push(ct2);
  const result = await publishChannel
    .invoke("my-text-validated-rpc-function-2", {
      value: 42
    })
    .catch(e => e);
  expect(result.content.stack.split(":")[0]).toBe("ValidationError");
  expect(result.content.details[0].message).toBe(
    `"properties.headers.x-service-version" must be [4.5.6]`
  );
});
