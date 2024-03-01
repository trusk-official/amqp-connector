const url = require("url");
const { v4: uuidv4 } = require("uuid");
const stringify = require("json-stringify-safe");
const R = require("ramda");
const Joi = require("joi");
const amqp = require("@trusk/amqp-connection-manager");
const Stream = require("stream");

const {
  subscribeQualifierParser,
  publishQualifierParser,
  invokeQualifier,
  promiseTimeout,
  generateStackId,
  isFn,
} = require("./utils");

const { INVOKE_TYPE } = require("./constants");

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
const amqpconnector = (conf) => {
  const config = {
    urls: ["amqp://localhost:5672"],
    serviceName: "default",
    transport: {
      log: () => {},
      info: () => {},
      error: () => {},
      warn: () => {},
      silly: () => {},
      debug: () => {},
    },
    ...conf,
  };
  // todo validate config format
  config.urls = config.urls
    .map((u) => (typeof u === "string" ? { url: u } : u))
    .map((uo) => Object.assign(uo, { url: url.parse(uo.url) }));
  config.connection = {
    noDelay: true,
    clientProperties: {},
    ...config.connection,
  };
  config.connection.clientProperties = {
    ...{
      "amqp-connector-version": version,
      "service-name": config.serviceName,
      "service-version": config.serviceVersion,
    },
  };

  const ctx = {
    connection: null,
    channels: {},
  };

  const callWithContextHeaders =
    (fn) =>
    (headers) =>
    (
      qualifierOrFn,
      messageOrPayload,
      params = { timeout: 5000, headers: {} }
    ) =>
      fn(qualifierOrFn, messageOrPayload, {
        ...params,
        ...{
          headers: {
            ...params.headers,
            "x-origin-service": headers["x-service"],
            "x-origin-consumer": headers["x-consumer"],
            "x-transaction-stack": headers["x-transaction-stack"],
          },
        },
      });

  const publishMessage =
    /**
     * @param {object} chan - an amqplib channel object https://www.squaremobius.net/amqp.node/channel_api.html#channel
     */


      (chan) =>
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
                  generateStackId(),
                ],
              },
            },
          ],
        ];
        return chan[q.type === "q" ? "_sendToQueue" : "_publish"](...args);
      };

  const subscribeToMessages =
    /**
     * @param {object} chan - an amqplib channel object https://www.squaremobius.net/amqp.node/channel_api.html#channel
     */


      (chan) =>
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
          dumpQueue: undefined,
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

        let schema = null;
        if (params.schema) {
          schema = Joi.isSchema(params.schema)
            ? params.schema
            : Joi.build(params.schema);
        }

        // eslint-disable-next-line no-underscore-dangle
        const _cb = async (...args) => {
          config.transport.debug("subscribe_message_received", {
            qualifier,
            message: args[0].message,
          });
          return cb(...args)
            .then((o) => {
              config.transport.debug("subscribe_message_handled", {
                qualifier,
                message: args[0].message,
                object: o,
              });
              return o;
            })
            .catch((e) => {
              config.transport.debug("subscribe_message_rejected", {
                qualifier,
                message: args[0].message,
                error: e,
              });
              throw e;
            });
        };

        return chan.addSetup((channel) =>
          (retry
            ? Promise.all([
                channel.assertExchange(`${dlPrefix}${retry}`, "fanout", {
                  durable: true,
                  autoDelete: false,
                }),
                channel.assertQueue(`${dlPrefix}${retry}`, {
                  exclusive: false,
                  autoDelete: false,
                  messageTtl: retry,
                  deadLetterExchange: "",
                }),
                ...(dumpQueue
                  ? [
                      channel.assertQueue(dumpQueue, {
                        exclusive: false,
                        autoDelete: false,
                      }),
                    ]
                  : []),
              ]).then(() =>
                channel.bindQueue(
                  `${dlPrefix}${retry}`,
                  `${dlPrefix}${retry}`,
                  ""
                )
              )
            : Promise.resolve()
          ).then(() =>
            Promise.all([
              q.exchange
                ? channel.assertExchange(q.exchange, q.type, {
                    durable: true,
                    autoDelete: false,
                    ...params.exchange,
                  })
                : Promise.resolve(),
              channel.assertQueue(q.queue, {
                exclusive: false,
                autoDelete: false,
                ...params.queue,
                ...(retry
                  ? {
                      deadLetterExchange: `${dlPrefix}${retry}`,
                      deadLetterRoutingKey: q.queue,
                    }
                  : {}),
              }),
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
              .then(() =>
                channel.consume(q.queue, async (message) => {
                  try {
                    if (message) {
                      let mess = {
                        ...message,
                        content: chan.handleMessageContentOnReception(
                          message.content
                        ),
                      };
                      if (
                        schema ||
                        (params.validator && isFn(params.validator))
                      ) {
                        const { error, value } = schema
                          ? schema.validate(mess)
                          : params.validator(mess);
                        if (error) {
                          config.transport.warn(
                            "subscribe_message_fails_validation",
                            {
                              qualifier,
                              message: mess,
                              error,
                            }
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
                            ],
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
                            ],
                        }),
                      });
                      chan.ack(message);
                    }
                  } catch (e) {
                    const deathCounts = (
                      (message.properties.headers["x-death"] || []).find(
                        (death) => death.queue === q.queue
                      ) || {}
                    ).count;
                    if (
                      deathCounts &&
                      maxTries &&
                      deathCounts >= maxTries - 1
                    ) {
                      config.transport.debug("message_nack_stop_retrying", {
                        qualifier,
                        message,
                        error: e,
                      });
                      chan.ack(message);
                      if (dumpQueue) {
                        chan.sendToQueue(
                          dumpQueue,
                          chan.payloadToBufferForPublish(message.content),
                          {
                            headers: message.properties.headers,
                          }
                        );
                        config.transport.debug(
                          "message_ack_sent_to_dump_queue",
                          {
                            qualifier,
                            message,
                            error: e,
                          }
                        );
                      }
                    } else {
                      setTimeout(() => {
                        config.transport.debug("message_nack", {
                          qualifier,
                          message,
                          error: e,
                        });
                        return chan.nack(
                          message,
                          !!R.path(["nack", "allUpTo"], params),
                          !!R.path(["nack", "requeue"], params)
                        );
                      }, chan.rejectTimeout);
                    }
                  }
                })
              )
          )
        );
      };

  const invokefn =
    /**
     * @param {object} chan - an amqplib channel object https://www.squaremobius.net/amqp.node/channel_api.html#channel
     */


      (chan) =>
      /**
       * Invoke an RPC function
       * @param {string} qualifier - the queue string
       * @param {object|Buffer} message - The message
       * @param {object} options - The subscribe options
       * @param {integer} options.timeout - the timeout (ms) for the call
       * @param {object} options.headers - Additional headers for the message
       * @return {Promise} A promise that resolves the function response
       */
      (fnName, payload, params = { timeout: 5000, headers: {} }) =>
        new Promise((resolve, reject) => {
          const correlationId = uuidv4();
          let cTag = null;
          // eslint-disable-next-line no-underscore-dangle
          const c = chan._channel;
          if (!c) {
            throw new Error("no_channel_available");
          }
          // eslint-disable-next-line no-underscore-dangle
          c._sendToQueue = (...args) => {
            config.transport.debug("invoke_send_message_to_rpc_queue", {
              fnName,
              ...args,
            });
            return c.sendToQueue(...args);
          };
          // eslint-disable-next-line no-underscore-dangle
          c._consume = (fn, cb, cparams) =>
            c.consume(
              fn,
              (...cbargs) => {
                config.transport.debug("invoke_rpc_message_returned", {
                  fnName,
                  ...cbargs,
                });
                cb(...cbargs);
              },
              cparams
            );
          promiseTimeout(
            params.timeout,
            () =>
              new Promise((res, rej) => {
                if (!c) {
                  rej(new Error("no_channel_available"));
                } else {
                  c.assertQueue("", { exclusive: true, autoDelete: true }).then(
                    (queue) =>
                      c &&
                      c // eslint-disable-line no-underscore-dangle
                        ._consume(
                          queue.queue,
                          async (message) => {
                            if (!message) {
                              return rej(new Error("message_empty"));
                            }
                            const data = JSON.parse(message.content.toString());
                            const m = {
                              ...message,
                              content: chan.handleMessageContentOnReception(
                                Buffer.from(stringify(data))
                              ),
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
                                      generateStackId(),
                                    ],
                                  },
                                }
                              )
                            : rej(new Error("no_channel_available"));
                        })
                  );
                }
              })
          )
            .then(resolve)
            .catch((e) => {
              reject(e);
            })
            .finally(
              () =>
                cTag && chan._channel && chan._channel.cancel(cTag, (_) => _) // eslint-disable-line no-underscore-dangle
            );
        });

  const invokeStream =
    /**
     * @param {object} chan - an amqplib channel object https://www.squaremobius.net/amqp.node/channel_api.html#channel
     */


      (chan) =>
      /**
       * Invoke an RPC function
       * @param {string} qualifier - the queue string
       * @param {object|Buffer} message - The message
       * @param {object} options - The subscribe options
       * @param {integer} options.timeout - the timeout (ms) for the call
       * @param {object} options.headers - Additional headers for the message
       * @return {Promise} A promise that resolves the function response
       */
      (fnName, payload, params = { timeout: 0, headers: {} }) => {
        const stream = new Stream();
        const correlationId = uuidv4();
        let cTag = null;
        const destroyConsumer = () => {
          // eslint-disable-next-line no-underscore-dangle
          if (cTag && chan._channel) {
            // eslint-disable-next-line no-underscore-dangle
            chan._channel.cancel(cTag, (_) => _);
          }
        };
        if (params.timeout) {
          setTimeout(() => {
            destroyConsumer();
          }, params.timeout);
        }
        // eslint-disable-next-line no-underscore-dangle
        const c = chan._channel;
        if (!c) {
          throw new Error("no_channel_available");
        }
        // eslint-disable-next-line no-underscore-dangle
        c._sendToQueue = (...args) => {
          config.transport.debug("invoke_send_message_to_rpc_queue", {
            fnName,
            ...args,
          });
          return c.sendToQueue(...args);
        };
        // eslint-disable-next-line no-underscore-dangle
        c._consume = (fn, cb, cparams) =>
          c.consume(
            fn,
            (...cbargs) => {
              config.transport.debug("invoke_rpc_message_returned", {
                fnName,
                ...cbargs,
              });
              cb(...cbargs);
            },
            cparams
          );
        c.assertQueue("", { exclusive: true, autoDelete: true }).then(
          (queue) =>
            c &&
            c // eslint-disable-line no-underscore-dangle
              ._consume(
                queue.queue,
                async (message) => {
                  if (!message) {
                    return;
                  }
                  const data = message.content.toString();
                  const m = {
                    ...message,
                    content: chan.handleMessageContentOnReception(data),
                  };
                  if (
                    m.properties.headers["x-correlation-id"] === correlationId
                  ) {
                    if (
                      m.properties.headers["x-stream-close"] ||
                      m.properties.headers["x-error"]
                    ) {
                      if (m.properties.headers["x-stream-close"]) {
                        stream.emit("close");
                      }
                      if (m.properties.headers["x-stream-error"]) {
                        stream.emit("error", m.content);
                      }
                      destroyConsumer();
                    }
                    if (m.properties.headers["x-stream-end"]) {
                      stream.emit("end");
                    }
                    if (m.properties.headers["x-stream-chunk"]) {
                      stream.emit("data", m.content);
                    }
                  }
                },
                { noAck: true }
              )
              .then(({ consumerTag }) => {
                cTag = consumerTag;
                if (!c) {
                  throw new Error("no_channel_available");
                }
                // eslint-disable-next-line no-underscore-dangle
                return c._sendToQueue(
                  fnName,
                  chan.payloadToBufferForPublish(payload),
                  {
                    headers: {
                      ...params.headers,
                      "x-timestamp": +new Date(),
                      "x-reply-to": queue.queue,
                      "x-correlation-id": correlationId,
                      "x-service":
                        config.connection.clientProperties["service-name"],
                      "x-service-version":
                        config.connection.clientProperties["service-version"],

                      "x-consumer": fnName,
                      "x-transaction-stack": [
                        ...((params.headers || {})["x-transaction-stack"] ||
                          []),
                        generateStackId(),
                      ],
                    },
                  }
                );
              })
        );
        return stream;
      };

  const invoke =
    (chan) =>
    (fnName, payload, params = { timeout: 5000, headers: {} }) => {
      const qualifier = invokeQualifier(fnName);
      return (qualifier.type === INVOKE_TYPE.STREAM ? invokeStream : invokefn)(
        chan
      )(qualifier.function, payload, params);
    };

  const listen =
    /**
     * @param {object} chan - an amqplib channel object https://www.squaremobius.net/amqp.node/channel_api.html#channel
     */


      (chan) =>
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
        let schema = null;
        if (params.schema) {
          schema = Joi.isSchema(params.schema)
            ? params.schema
            : Joi.build(params.schema);
        }

        return chan.addSetup((channel) => {
          // eslint-disable-next-line no-underscore-dangle
          const _consume = (fn, cb, cparams) =>
            channel.consume(
              fn,
              (...cbargs) => {
                config.transport.debug("listen_rpc_message_received", {
                  fnName,
                  ...cbargs,
                });
                return cb(...cbargs);
              },
              cparams
            );
          return channel.assertQueue(fnName, params.queue).then(() =>
            _consume(fnName, (message) => {
              let mess = {
                ...message,
                content: chan.handleMessageContentOnReception(message.content),
              };
              return Promise.resolve()
                .then(() => {
                  if (schema || (params.validator && isFn(params.validator))) {
                    const { error, value } = schema
                      ? schema.validate(mess)
                      : params.validator(mess);
                    if (error) {
                      config.transport.warn(
                        "listen_rpc_message_fails_validation",
                        {
                          fnName,
                          message: mess,
                          error,
                        }
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
                    ),
                  });
                })
                .then((data) => {
                  chan.ack(message);
                  if (data instanceof Stream.Readable) {
                    return new Promise((resolve, reject) => {
                      data.on("data", (chunk) => {
                        // eslint-disable-next-line no-underscore-dangle
                        chan._sendToQueue(
                          message.properties.headers["x-reply-to"],
                          chunk,
                          {
                            headers: {
                              ...message.properties.headers,
                              "x-timestamp": +new Date(),
                              "x-error": false,
                              "x-stream-chunk": true,
                            },
                          }
                        );
                      });
                      data.on("end", () => {
                        // eslint-disable-next-line no-underscore-dangle
                        chan._sendToQueue(
                          message.properties.headers["x-reply-to"],
                          Buffer.from(""),
                          {
                            headers: {
                              ...message.properties.headers,
                              "x-timestamp": +new Date(),
                              "x-error": false,
                              "x-stream-end": true,
                            },
                          }
                        );
                      });
                      data.on("close", () => {
                        // eslint-disable-next-line no-underscore-dangle
                        chan
                          ._sendToQueue(
                            message.properties.headers["x-reply-to"],
                            Buffer.from(""),
                            {
                              headers: {
                                ...message.properties.headers,
                                "x-timestamp": +new Date(),
                                "x-error": false,
                                "x-stream-close": true,
                              },
                            }
                          )
                          .then(resolve);
                      });
                      data.on("error", reject);
                    });
                  }
                  // eslint-disable-next-line no-underscore-dangle
                  return chan._sendToQueue(
                    message.properties.headers["x-reply-to"],
                    data,
                    {
                      headers: {
                        ...message.properties.headers,
                        "x-timestamp": +new Date(),
                        "x-error": false,
                      },
                    }
                  );
                })
                .catch((error) => {
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
                        "x-error": true,
                      },
                    }
                  );
                });
            })
          );
        });
      };

  const buildChannel =
    /**
     * @param {object} conn - an amqplib connection object https://www.squaremobius.net/amqp.node/channel_api.html#connect
     */


      (conn) =>
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
      (p) => {
        const params = { name: "default", rejectTimeout: 0, ...p };
        if (params.name in ctx.channels) {
          throw new Error("channel_already_exists");
        }
        const chan = conn.createChannel(params);
        chan.rejectTimeout = params.rejectTimeout;
        chan.realm = params.realm;
        chan.json = !!p.json;
        chan.addSetup((channel) =>
          Number.isInteger(params.prefetchCount)
            ? channel.prefetch(params.prefetchCount, !!params.prefetchGlobal)
            : Promise.resolve()
        );
        chan.handleMessageContentForPublish = (m) => m;

        chan.payloadToBufferForPublish = (o) =>
          !Buffer.isBuffer(o) ? Buffer.from(JSON.stringify(o)) : o;

        chan.handleMessageContentOnReception = (m) =>
          chan.json ? JSON.parse(Buffer.from(m)) : m;

        ctx.channels[params.name] = chan;
        // eslint-disable-next-line no-underscore-dangle
        chan._publish = (...args) => {
          config.transport.debug("publish_publish_message", { ...args });
          return chan.publish(...args);
        };
        // eslint-disable-next-line no-underscore-dangle
        chan._sendToQueue = (...args) => {
          config.transport.debug("send_to_queue_send_message_to_queue", {
            ...args,
          });
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


      (conn) =>
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
      (params) => {
        const name = params.name || "default";
        return name in ctx.channels
          ? ctx.channels[name]
          : conn.buildChannel(params);
      };

  return {
    connect: () => {
      if (!ctx.connection) {
        ctx.connection = amqp.connect(
          config.urls.map((uo) => ({ ...uo, url: uo.url.href })),
          config.connection
        );
        ctx.connection.buildChannel = buildChannel(ctx.connection);
        ctx.connection.buildChannelIfNotExists = buildChannelIfNotExists(
          ctx.connection
        );
      }
      return ctx.connection;
    },
  };
};

module.exports = amqpconnector;
