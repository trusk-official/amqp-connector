const url = require("url");
const uuidv4 = require("uuid/v4");
const stringify = require("json-stringify-safe");
const R = require("ramda");
const Joi = require("@hapi/joi");
const amqp = require("@trusk/amqp-connection-manager");
const {
  subscribeQualifierParser,
  publishQualifierParser,
  promiseTimeout,
  generateStackId
} = require("./utils");
const { version } = require("../package.json");

/**
 * Build an amqp-connector instance
 * @param {object} conf - The configuration object
 * @param {array} conf.url - an array of connection URLs
 * @param {string} conf.serviceName - The service name
 * @param {string} conf.serviceVersion - the service version
 * @param {object} transport - a logger instance
 * @return {object} An object containing the connect function to open an amqp connection
 */
const amqpconnector = conf => {
  const config = {
    urls: ["amqp://localhost:5672"],
    serviceName: "default",
    transport: {
      log: () => {},
      info: () => {},
      error: () => {},
      warn: () => {},
      silly: () => {}
    },
    ...conf
  };
  // todo validate config format
  config.urls = config.urls.map(u => url.parse(u));
  config.connection = {
    noDelay: true,
    clientProperties: {},
    ...config.connection
  };
  config.connection.clientProperties = {
    ...{
      "amqp-connector-version": version,
      "service-name": config.serviceName,
      "service-version": config.serviceVersion
    }
  };

  const ctx = {
    connection: null,
    channels: {}
  };

  const callWithContextHeaders = fn => headers => (
    qualifierOrFn,
    messageOrPayload,
    params = { timeout: 5000, headers: {} }
  ) => {
    return fn(qualifierOrFn, messageOrPayload, {
      ...params,
      ...{
        headers: {
          ...params.headers,
          "x-origin-service": headers["x-service"],
          "x-origin-consumer": headers["x-consumer"],
          "x-transaction-stack": headers["x-transaction-stack"]
        }
      }
    });
  };

  const publishMessage =
    /**
     * @param {object} chan - an amqplib channel object https://www.squaremobius.net/amqp.node/channel_api.html#channel
     */
    chan =>
      /**
       * Publish to an exchange
       * @param {string} qualifier - the publish string, see Publish qualifier
       * @param {object|Buffer} message - The message
       * @param {object} options - The subscribe options
       * @param {object} options.headers - Additional headers for the message
       * @return {Promise<Bool>} A promise that resolves Bool, see http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish
       */
      async (qualifier, message, params = { headers: {} }) => {
        const q = publishQualifierParser(qualifier, { realm: chan.realm });
        const args = [
          ...(q.type === "q" ? [q.queue] : [q.exchange, q.routingKey]),
          ...[
            chan.handleMessageContentForPublish(message),
            {
              deliveryMode: 2,
              ...(chan.json ? { contentType: "application/json" } : {}),
              ...params,
              headers: {
                ...params.headers,
                "x-timestamp": +new Date(),
                "x-service": config.connection.clientProperties["service-name"],
                "x-service-version":
                  config.connection.clientProperties["service-version"],
                "x-transaction-stack": [
                  ...((params.headers || {})["x-transaction-stack"] || []),
                  generateStackId()
                ]
              }
            }
          ]
        ];
        return chan[q.type === "q" ? "_sendToQueue" : "_publish"](...args);
      };

  const subscribeToMessages =
    /**
     * @param {object} chan - an amqplib channel object https://www.squaremobius.net/amqp.node/channel_api.html#channel
     */
    chan =>
      /**
   * @callback subscribeCallback
   * @param {object} message - an amqp message, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_consume
   * @param {function} invoke - a contextual invoke function
   * @param {function} publishMessage - a contextual publishMessage function

   * Subscribes an exchange
   * @param {string} qualifier - the subscription string, see Subscribe qualifier
   * @param {subscribeCallback} callback - The message handler
   * @param {object} options - The subscribe options
   * @param {object} options.exchange - The exchange parameters, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_assertExchange
   * @param {object} options.queue - The queue parameters, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue
   * @param {object} options.headers - The subscribe headers, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_bindQueue
   * @param {object} options.schema - a Joi validation schema, see https://github.com/hapijs/joi/blob/v16.0.0-rc2/API.md#object---inherits-from-any
   * @param {object} options.nack - a message nack arguments object
   * @param {bool} options.nack.allUpTo - defaults to false, see allUpTo https://www.squaremobius.net/amqp.node/channel_api.html#channel_nack
   * @param {bool} options.nack.requeue - defaults to false, see requeue https://www.squaremobius.net/amqp.node/channel_api.html#channel_nack
   * @param {number} options.retry - the ttl for retrying the message on top of the queue. Will create a dead letter exchange and no consumer queue to enable it
   * @param {number} options.dlPrefix - the prefix for the dead letter exchange and no consumer queue
   * @param {number} options.maxTries - The number of tries when sent to deadletter (defaults to none (unlimited retries))
   * @param {string} options.dumpQueue - the queue where to send the message when the maxTries is reached (defaults to none (discards if maxTries is set))
   * @return {Promise<object>} A promise that resolves { consumerTag }, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_consume
   */
      async (
        qualifier,
        cb,
        params = {
          exchange: {},
          queue: {},
          headers: {},
          nack: { allUpTo: false, requeue: false },
          retry: undefined,
          dumpQueue: undefined
        }
      ) => {
        const dlPrefix = `${chan.realm || ""}${params.dlPrefix || "dl_"}`;
        const dumpQueue = `${chan.realm || ""}${params.dumpQueue}`;
        const q = subscribeQualifierParser(qualifier, { realm: chan.realm });
        const retry = Number.isInteger(params.retry)
          ? Math.max(params.retry, 1)
          : null;
        const maxTries = Number.isInteger(params.maxTries)
          ? Math.max(params.maxTries, 1)
          : null;
        const schema = params.schema && Joi.compile(params.schema);

        // eslint-disable-next-line no-underscore-dangle
        const _cb = async (...args) => {
          config.transport.log(
            "subscribe_message_received",
            qualifier,
            args[0].message
          );
          return cb(...args)
            .then(o => {
              config.transport.log(
                "subscribe_message_handled",
                qualifier,
                args[0].message,
                o
              );
              return o;
            })
            .catch(e => {
              config.transport.log(
                "subscribe_message_rejected",
                qualifier,
                args[0].message,
                e
              );
              throw e;
            });
        };

        return chan.addSetup(channel => {
          return (retry
            ? Promise.all([
                channel.assertExchange(`${dlPrefix}${retry}`, "fanout", {
                  durable: true,
                  autoDelete: false
                }),
                channel.assertQueue(`${dlPrefix}${retry}`, {
                  exclusive: false,
                  autoDelete: false,
                  messageTtl: retry,
                  deadLetterExchange: ""
                }),
                ...(dumpQueue
                  ? [
                      channel.assertQueue(dumpQueue, {
                        exclusive: false,
                        autoDelete: false
                      })
                    ]
                  : [])
              ]).then(() => {
                return channel.bindQueue(
                  `${dlPrefix}${retry}`,
                  `${dlPrefix}${retry}`,
                  ""
                );
              })
            : Promise.resolve()
          ).then(() => {
            return Promise.all([
              q.exchange
                ? channel.assertExchange(q.exchange, q.type, {
                    durable: true,
                    autoDelete: false,
                    ...params.exchange
                  })
                : Promise.resolve(),
              channel.assertQueue(q.queue, {
                exclusive: false,
                autoDelete: false,
                ...params.queue,
                ...(retry
                  ? {
                      deadLetterExchange: `${dlPrefix}${retry}`,
                      deadLetterRoutingKey: q.queue
                    }
                  : {})
              })
            ])
              .then(() =>
                q.exchange
                  ? channel.bindQueue(
                      q.queue,
                      q.exchange,
                      q.routingKey,
                      params.headers
                    )
                  : Promise.resolve()
              )
              .then(() => {
                return channel.consume(q.queue, async message => {
                  try {
                    if (message) {
                      let mess = {
                        ...message,
                        content: chan.handleMessageContentOnReception(
                          message.content
                        )
                      };
                      if (schema) {
                        const { error, value } = Joi.validate(mess, schema);
                        if (error) {
                          config.transport.log(
                            "subscribe_message_fails_validation",
                            qualifier,
                            mess,
                            error
                          );
                          chan.ack(message);
                          return;
                        }
                        mess = value;
                      }
                      // eslint-disable-next-line no-underscore-dangle
                      await _cb({
                        message: mess,
                        invoke: callWithContextHeaders(chan.invoke)({
                          ...message.properties.headers,
                          "x-consumer": qualifier,
                          "x-service":
                            config.connection.clientProperties["service-name"],
                          "x-service-version":
                            config.connection.clientProperties[
                              "service-version"
                            ]
                        }),
                        publishMessage: callWithContextHeaders(
                          chan.publishMessage
                        )({
                          ...message.properties.headers,
                          "x-consumer": qualifier,
                          "x-service":
                            config.connection.clientProperties["service-name"],
                          "x-service-version":
                            config.connection.clientProperties[
                              "service-version"
                            ]
                        })
                      });
                      chan.ack(message);
                    }
                  } catch (e) {
                    const deathCounts = (
                      (message.properties.headers["x-death"] || []).find(
                        death => death.queue === q.queue
                      ) || {}
                    ).count;
                    if (
                      deathCounts &&
                      maxTries &&
                      deathCounts >= maxTries - 1
                    ) {
                      config.transport.log(
                        "message_nack_stop_retrying",
                        qualifier,
                        message,
                        e
                      );
                      chan.ack(message);
                      if (dumpQueue) {
                        chan.sendToQueue(
                          dumpQueue,
                          chan.payloadToBufferForPublish(message.content),
                          {
                            headers: message.properties.headers
                          }
                        );
                        config.transport.log(
                          "message_ack_sent_to_dump_queue",
                          qualifier,
                          message,
                          e
                        );
                      }
                    } else {
                      setTimeout(() => {
                        config.transport.log(
                          "message_nack",
                          qualifier,
                          message,
                          e
                        );
                        return chan.nack(
                          message,
                          !!R.path(["nack", "allUpTo"], params),
                          !!R.path(["nack", "requeue"], params)
                        );
                      }, chan.rejectTimeout);
                    }
                  }
                });
              });
          });
        });
      };

  const invoke =
    /**
     * @param {object} chan - an amqplib channel object https://www.squaremobius.net/amqp.node/channel_api.html#channel
     */
    chan =>
      /**
       * Invoke an RPC function
       * @param {string} qualifier - the queue string
       * @param {object|Buffer} message - The message
       * @param {object} options - The subscribe options
       * @param {integer} options.timeout - the timeout (ms) for the call
       * @param {object} options.headers - Additional headers for the message
       * @return {Promise} A promise that resolves the function response
       */
      (fnName, payload, params = { timeout: 5000, headers: {} }) => {
        return new Promise((resolve, reject) => {
          const correlationId = uuidv4();
          let cTag = null;
          // eslint-disable-next-line no-underscore-dangle
          const c = chan._channel;
          // eslint-disable-next-line no-underscore-dangle
          c._sendToQueue = (...args) => {
            config.transport.log(
              "invoke_send_message_to_rpc_queue",
              fnName,
              ...args
            );
            return c.sendToQueue(...args);
          };
          // eslint-disable-next-line no-underscore-dangle
          c._consume = (fn, cb, cparams) => {
            return c.consume(
              fn,
              (...cbargs) => {
                config.transport.log(
                  "invoke_rpc_message_returned",
                  fnName,
                  ...cbargs
                );
                cb(...cbargs);
              },
              cparams
            );
          };
          return promiseTimeout(params.timeout, () => {
            return new Promise((res, rej) => {
              return c
                ? c
                    .assertQueue("", { exclusive: true, autoDelete: true })
                    .then(queue => {
                      return (
                        c &&
                        c // eslint-disable-line no-underscore-dangle
                          ._consume(
                            queue.queue,
                            async message => {
                              if (!message) {
                                return rej(new Error("message_empty"));
                              }
                              const data = JSON.parse(
                                message.content.toString()
                              );
                              const m = {
                                ...message,
                                content: chan.handleMessageContentOnReception(
                                  Buffer.from(stringify(data))
                                )
                              };
                              if (
                                m.properties.headers["x-correlation-id"] ===
                                correlationId
                              ) {
                                if (m.properties.headers["x-error"]) {
                                  return rej(m);
                                }
                                return res(m);
                              }
                              return rej(m);
                            },
                            { noAck: true }
                          )
                          .then(({ consumerTag }) => {
                            cTag = consumerTag;
                            return c // eslint-disable-next-line no-underscore-dangle
                              ? c._sendToQueue(
                                  fnName,
                                  chan.payloadToBufferForPublish(payload),
                                  {
                                    headers: {
                                      ...params.headers,
                                      "x-timestamp": +new Date(),
                                      "x-reply-to": queue.queue,
                                      "x-correlation-id": correlationId,
                                      "x-service":
                                        config.connection.clientProperties[
                                          "service-name"
                                        ],
                                      "x-service-version":
                                        config.connection.clientProperties[
                                          "service-version"
                                        ],

                                      "x-consumer": fnName,
                                      "x-transaction-stack": [
                                        ...((params.headers || {})[
                                          "x-transaction-stack"
                                        ] || []),
                                        generateStackId()
                                      ]
                                    }
                                  }
                                )
                              : rej(new Error("no_channel_available"));
                          })
                      );
                    })
                : rej(new Error("no_channel_available"));
            });
          })
            .then(resolve)
            .catch(e => {
              reject(e);
            })
            .finally(() => {
              return (
                cTag && chan._channel && chan._channel.cancel(cTag, _ => _) // eslint-disable-line no-underscore-dangle
              );
            });
        });
      };

  const listen =
    /**
     * @param {object} chan - an amqplib channel object https://www.squaremobius.net/amqp.node/channel_api.html#channel
     */
    chan =>
      /**
     * @callback listenCallback
     * @param {object} message - an amqp message, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_consume
     * @param {function} invoke - a contextual invoke function
     * @param {function} publishMessage - a contextual publishMessage function

     * Listens to an RPC queue
     * @param {string} qualifier - the subscription string, see Subscribe qualifier
     * @param {listenCallback} callback - The message handler
     * @param {object} options - The subscribe options
     * @param {object} options.queue - The queue parameters, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_assertQueue
     * @param {object} options.schema - a Joi validation schema, see https://github.com/hapijs/joi/blob/v16.0.0-rc2/API.md#object---inherits-from-any
     * @return {Promise<object>} A promise that resolves { consumerTag }, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_consume
     */
      async (fnName, callback, params = { queue: {} }) => {
        const schema = params.schema && Joi.compile(params.schema);

        return chan.addSetup(channel => {
          // eslint-disable-next-line no-underscore-dangle
          const _consume = (fn, cb, cparams) => {
            return channel.consume(
              fn,
              (...cbargs) => {
                config.transport.log(
                  "listen_rpc_message_received",
                  fnName,
                  ...cbargs
                );
                return cb(...cbargs);
              },
              cparams
            );
          };
          return channel.assertQueue(fnName, params.queue).then(() => {
            return _consume(fnName, message => {
              let mess = {
                ...message,
                content: chan.handleMessageContentOnReception(message.content)
              };
              return Promise.resolve()
                .then(() => {
                  if (schema) {
                    const { error, value } = Joi.validate(mess, schema);
                    if (error) {
                      config.transport.log(
                        "listen_rpc_message_fails_validation",
                        fnName,
                        mess,
                        error
                      );
                      throw error;
                    }
                    mess = value;
                  }
                  return callback({
                    message: mess,
                    invoke: callWithContextHeaders(chan.invoke)(
                      message.properties.headers
                    ),
                    publishMessage: callWithContextHeaders(chan.publishMessage)(
                      message.properties.headers
                    )
                  });
                })
                .then(data => {
                  chan.ack(message);
                  // eslint-disable-next-line no-underscore-dangle
                  return chan._sendToQueue(
                    message.properties.headers["x-reply-to"],
                    data,
                    {
                      headers: {
                        ...message.properties.headers,
                        "x-timestamp": +new Date(),
                        "x-error": false
                      }
                    }
                  );
                })
                .catch(error => {
                  chan.ack(message);
                  const erroro = R.pick(
                    ["message", "stack", ...Object.keys(error)].filter(Boolean),
                    error
                  );
                  // eslint-disable-next-line no-underscore-dangle
                  return chan._sendToQueue(
                    message.properties.headers["x-reply-to"],
                    chan.json ? erroro : Buffer.from(JSON.stringify(erroro)),
                    {
                      headers: {
                        ...message.properties.headers,
                        "x-timestamp": +new Date(),
                        "x-error": true
                      }
                    }
                  );
                });
            });
          });
        });
      };

  const buildChannel =
    /**
     * @param {object} conn - an amqplib connection object https://www.squaremobius.net/amqp.node/channel_api.html#connect
     */
    conn =>
      /**
       * @param {object} params - the channel params object. Accepts also amqplib channel params https://www.squaremobius.net/amqp.node/channel_api.html#channel
       * @param {string} params.name - the channel name
       * @param {bool} params.json - whether it is a json or raw channel
       * @param {string} params.swap_path - the path for the swap (disk persistance for unpublished messages)
       * @param {integer} params.swap_size - the swap size (ko)
       * @param {integer} params.prefetchCount - the prefetch count
       * @param {bool} params.prefetchGlobal - whether the prefetch is global
       * @param {integer} params.rejectTimeout - the reject timeout
       * @param {string} params.realm - The realm of the channel
       * @return {object} An ChannelWrapper object
       */
      p => {
        const params = { name: "default", rejectTimeout: 0, ...p };
        if (params.name in ctx.channels) {
          throw new Error("channel_already_exists");
        }
        const chan = conn.createChannel(params);
        chan.rejectTimeout = params.rejectTimeout;
        chan.realm = params.realm;
        chan.json = !!p.json;
        chan.addSetup(channel => {
          return Number.isInteger(params.prefetchCount)
            ? channel.prefetch(params.prefetchCount, !!params.prefetchGlobal)
            : Promise.resolve();
        });
        chan.handleMessageContentForPublish = m => m;

        chan.payloadToBufferForPublish = o =>
          !Buffer.isBuffer(o) ? Buffer.from(JSON.stringify(o)) : o;

        chan.handleMessageContentOnReception = m =>
          chan.json ? JSON.parse(Buffer.from(m)) : m;

        ctx.channels[params.name] = chan;
        // eslint-disable-next-line no-underscore-dangle
        chan._publish = (...args) => {
          config.transport.log("publish_publish_message", ...args);
          return chan.publish(...args);
        };
        // eslint-disable-next-line no-underscore-dangle
        chan._sendToQueue = (...args) => {
          config.transport.log("send_to_queue_send_message_to_queue", ...args);
          return chan.sendToQueue(...args);
        };
        chan.publishMessage = publishMessage(chan);
        chan.subscribeToMessages = subscribeToMessages(chan);
        chan.invoke = invoke(chan);
        chan.listen = listen(chan);
        return chan;
      };

  const buildChannelIfNotExists =
    /**
     * @param {object} conn - an amqplib connection object https://www.squaremobius.net/amqp.node/channel_api.html#connect
     */
    conn =>
      /**
       * @param {object} params - the channel params object. Accepts also amqplib channel params https://www.squaremobius.net/amqp.node/channel_api.html#channel
       * @param {string} params.name - the channel name
       * @param {bool} params.json - whether it is a json or raw channel
       * @param {string} params.swap_path - the path for the swap (disk persistance for unpublished messages)
       * @param {integer} params.swap_size - the swap size (ko)
       * @param {integer} params.prefetchCount - the prefetch count
       * @param {bool} params.prefetchGlobal - whether the prefetch is global
       * @param {integer} params.rejectTimeout - the reject timeout
       * @param {string} params.realm - The realm of the channel
       * @return {object} An ChannelWrapper object
       */
      params => {
        const name = params.name || "default";
        return name in ctx.channels
          ? ctx.channels[name]
          : conn.buildChannel(params);
      };

  return {
    connect: () => {
      if (!ctx.connection) {
        ctx.connection = amqp.connect(
          config.urls.map(u => u.href),
          config.connection
        );
        ctx.connection.buildChannel = buildChannel(ctx.connection);
        ctx.connection.buildChannelIfNotExists = buildChannelIfNotExists(
          ctx.connection
        );
      }
      return ctx.connection;
    }
  };
};

module.exports = amqpconnector;
