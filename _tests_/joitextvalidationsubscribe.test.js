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
      channel.deleteExchange("my-direct-text-validated-exchange-1"),
      channel.deleteExchange("my-direct-text-validated-exchange-2"),
      channel.deleteExchange("my-direct-text-validated-exchange-3"),
      channel.deleteExchange("my-direct-text-validated-exchange-4"),
      channel.deleteQueue("my-text-validated-queue-1"),
      channel.deleteQueue("my-text-validated-queue-2"),
      channel.deleteQueue("my-text-validated-queue-3"),
      channel.deleteQueue("my-text-validated-queue-4")
    ]);
  });

  return Promise.all([publishChannel.close(), subscribeChannel.close()]).then(
    () => amqpconnection.close()
  );
});

test("message format text validation on subscribe (1)", async () => {
  const result = await new Promise((resolve, reject) => {
    const messagesReceived_1 = [];
    const messagesReceived_2 = [];
    Promise.all([
      subscribeChannel.subscribeToMessages(
        "direct/my-direct-text-validated-exchange-1/my.routing.key/my-text-validated-queue-1",
        async ({ message }) => {
          messagesReceived_1.push(message);
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
      ),
      subscribeChannel.subscribeToMessages(
        "direct/my-direct-text-validated-exchange-2/my.routing.key/my-text-validated-queue-2",
        async ({ message }) => {
          messagesReceived_2.push(message);
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
      )
    ])
      .then(() => {
        return Promise.all([
          publishChannel.publishMessage(
            "direct/my-direct-text-validated-exchange-1/my.routing.key",
            {
              foo: "bar"
            }
          ),
          publishChannel.publishMessage(
            "direct/my-direct-text-validated-exchange-2/my.routing.key",
            {
              foo: "biz"
            }
          )
        ]);
      })
      .catch(reject);
    setTimeout(() => {
      resolve([messagesReceived_1, messagesReceived_2]);
    }, 2000);
  });
  expect(result[0].length).toBe(1);
  expect(result[1].length).toBe(0);
});
