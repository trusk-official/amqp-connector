# AMQP connector


[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/facebook/react/blob/master/LICENSE) [![CircleCI](https://circleci.com/gh/trusk-official/amqp-connector.svg?style=svg)](https://circleci.com/gh/trusk-official/amqp-connector) [![npm version](https://badge.fury.io/js/%40trusk%2Famqp-connector.svg)](https://badge.fury.io/js/%40trusk%2Famqp-connector) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://reactjs.org/docs/how-to-contribute.html#your-first-pull-request)

An middle level [amqp.node](https://github.com/squaremo/amqp.node) wrapper for every day use. It requires **node.js >= 6**.

**Features**:

- Promise based
- Compatible with direct/topic/fanout/headers exchanges and send to queue
- Built-in RPC
- Based on [node-amqp-connection-manager](https://github.com/trusk-official/node-amqp-connection-manager)
  - Automatically reconnect when your amqplib broker dies in a fire
  - Round-robin connections between multiple brokers in a cluster
  - If messages are sent while the broker is unavailable, queues messages in memory until we reconnect
  - Queued message are persisted to disk in case of unexpected crash/reboot, and recovered in memory
- Built-in distributed tracing
- Joi message structure validation on message reception (`listen`, `subscribeToMessage`)
- Provide your own transport to log every microservice message

## Install

```sh
npm install @trusk/amqp-connector
```

## Run tests

```sh
# Launch RabbitMQ with docker (guest:guest)
docker run -d -p 5672:5672 -p 15672:15672 --name rabbit rabbitmq:3-management

# Launch tests
npm test
```

## Usage

### Connection

```js
// see http://www.squaremobius.net/amqp.node/channel_api.html#connect
const connection = amqpconnector({
  urls: ["amqp://localhost:5672"],
  serviceName: "default",
  serviceVersion: "1.2.3",
  transport: console // or any logger instance ex https://github.com/winstonjs/winston
}).connect();
```

### Channel

```js
const connection = amqpconnector().connect();

// see https://github.com/trusk-official/node-amqp-connection-manager#amqpconnectionmanagercreatechanneloptions
const channel = connection.buildChannelIfNotExists({
  name: "default",
  json: true, // use false to work with Buffers
  swap_path: path.resolve("./swap/my_channel"),
  swap_size: 50000,
  prefetchCount: 5,
  prefetchGlobal: 10
});
```

### Direct Exchange (with message validation)

```js
const connection = amqpconnector({
  serviceVersion: "1.2.3"
}).connect();

const channel = connection.buildChannelIfNotExists({ json: true });

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
 * @return {Promise<object>} A promise that resolves { consumerTag }, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_consume
 */
channel.subscribeToMessages(
  "direct/my-direct-exchange/my.routing.key/my-queue",
  async ({ message }) => {
    // handle message
  }, {
    schema: Joi.object({
      content: Joi.object(),
      properties: Joi.object({
        headers: Joi.object({
          "x-service-version": Joi.string().regex(/^1.2.\d$/) // validates every 1.2 patches
        }).unknown()
      }).unknown()
    }).unknown()
  }
);

/**
 * Publish to an exchange
 * @param {string} qualifier - the publish string, see Publish qualifier
 * @param {object|Buffer} message - The message
 * @param {object} options - The subscribe options
 * @param {object} options.headers - Additional headers for the message
 * @return {Promise<Bool>} A promise that resolves Bool, see http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish
 */
channel.publishMessage("direct/my-direct-exchange/my.routing.key", {
  foo: "bar"
});
```

### Topic Exchange

```js
const connection = amqpconnector().connect();
const channel = connection.buildChannelIfNotExists({ json: true });

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
 * @return {Promise<object>} A promise that resolves { consumerTag }, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_consume
 */
channel.subscribeToMessages(
  "topic/my-topic-exchange/my.routing.key/my-queue",
  async ({ message }) => {
    // handle message
  }
);

/**
 * Publish to an exchange
 * @param {string} qualifier - the publish string, see Publish qualifier
 * @param {object|Buffer} message - The message
 * @param {object} options - The subscribe options
 * @param {object} options.headers - Additional headers for the message
 * @return {Promise<Bool>} A promise that resolves Bool, see http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish
 */
channel.publishMessage("topic/my-topic-exchange/my.routing.*", {
  foo: "bar"
});
```

### Fanout Exchange

```js
const connection = amqpconnector().connect();
const channel = connection.buildChannelIfNotExists({ json: true });

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
 * @return {Promise<object>} A promise that resolves { consumerTag }, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_consume
 */
channel.subscribeToMessages(
  "fanout/my-fanout-exchange/my-queue",
  async ({ message }) => {
    // handle message
  }
);

/**
 * Publish to an exchange
 * @param {string} qualifier - the publish string, see Publish qualifier
 * @param {object|Buffer} message - The message
 * @param {object} options - The subscribe options
 * @param {object} options.headers - Additional headers for the message
 * @return {Promise<Bool>} A promise that resolves Bool, see http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish
 */
channel.publishMessage("fanout/my-fanout-exchange", {
  foo: "bar"
});
```

### Headers Exchange

```js
const connection = amqpconnector().connect();
const channel = connection.buildChannelIfNotExists({ json: true });

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
 * @return {Promise<object>} A promise that resolves { consumerTag }, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_consume
 */
channel.subscribeToMessages(
  "headers/my-headers-exchange/my-queue",
  async ({ message }) => {
    // handle message
  },
  {
    headers: {
      customheader: "my-header",
      "x-match": "any"
    }
  }
);

/**
 * Publish to an exchange
 * @param {string} qualifier - the publish string, see Publish qualifier
 * @param {object|Buffer} message - The message
 * @param {object} options - The subscribe options
 * @param {object} options.headers - Additional headers for the message
 * @return {Promise<Bool>} A promise that resolves Bool, see http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish
 */
channel.publishMessage("headers/my-headers-exchange", {
  foo: "bar"
}, {
  headers: {
    customheader: "my-header"
  }
});
```

### Send To Queue

```js
const connection = amqpconnector().connect();
const channel = connection.buildChannelIfNotExists({ json: true });

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
 * @return {Promise<object>} A promise that resolves { consumerTag }, see https://www.squaremobius.net/amqp.node/channel_api.html#channel_consume
 */
channel.subscribeToMessages(
  "direct/any-exchange//my-queue",
  async ({ message }) => {
    // handle message
  }
);

/**
 * Publish to a queue
 * @param {string} qualifier - the publish string, see Publish qualifier
 * @param {object|Buffer} message - The message
 * @param {object} options - The subscribe options
 * @param {object} options.headers - Additional headers for the message
 * @return {Promise<Bool>} A promise that resolves Bool, see http://www.squaremobius.net/amqp.node/channel_api.html#channel_publish
 */
channel.publishMessage("q/my-queue", {
  foo: "bar"
});
```

### RPC

  - call a remote function through `amqp` (note that `invoke` is *fail fast* and does not benefit of [node-amqp-connection-manager](https://github.com/trusk-official/node-amqp-connection-manager)'s features)

```js
const connection = amqpconnector().connect();
const channel = connection.buildChannelIfNotExists({ json: true });

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
channel.listen("my-rpc-function", async ({ message }) => {
  return { value: message.content.value * 42 };
});

/**
 * Invoke an RPC function
 * @param {string} qualifier - the queue string
 * @param {object|Buffer} message - The message
 * @param {object} options - The subscribe options
 * @param {integer} options.timeout - the timeout (ms) for the call
 * @param {object} options.headers - Additional headers for the message
 * @return {Promise} A promise that resolves the function response
 */
const result = await channel.invoke("my-rpc-function", { value: 1337 }); // { value: 57491 }
```

### Distributed tracing

  - By using the contextual `invoke` and `publishMessage` functions you can easily trace the journey of a message

```js
channel.listen("my-traced-rpc-function-4", async ({ message }) => {
  // message.properties.headers["x-transaction-stack"] === ["qSdeF", "hYud7", "GTynl", "zQwfG"]
  return { value: 5 * message.content.value };
});

channel.listen("my-traced-rpc-function-3", async ({ message, invoke }) => {
  // message.properties.headers["x-transaction-stack"] === ["qSdeF", "hYud7", "GTynl"]
  const mess = await invoke("my-traced-rpc-function-4", {
    value: 4 * message.content.value
  });
  return mess.content;
});

channel.listen("my-traced-rpc-function-2", async ({ message, invoke }) => {
  // message.properties.headers["x-transaction-stack"] === ["qSdeF", "hYud7"]
  const mess = await invoke("my-traced-rpc-function-3", {
    value: 3 * message.content.value
  });
  return mess.content;
});

channel.listen("my-traced-rpc-function-1", async ({ message, invoke }) => {
  // message.properties.headers["x-transaction-stack"] === ["qSdeF"]
  const mess = await invoke("my-traced-rpc-function-2", {
    value: 2 * message.content.value
  });
  return mess.content;
});

const result = await channel
  .invoke("my-traced-rpc-function-1", { value: 42 })
  .then(response => {
    // response.content.value === 42 * 2 * 3 * 4 * 5;
  });
```

### Qualifier structure

**Publish qualifiers**

    direct/exchange/routingkey
    direct// => type: direct, exchange: amqp.direct, routing key: ""

    topic/exchange/routingkey
    topic// => type: topic, exchange: amqp.topic, routing key: ""

    fanout/exchange
    fanout/ => type: fanout, exchange: amqp.fanout

    headers/exchange
    headers/ => type: headers, exchange: amqp.headers

    q/queue
    q/ => type: queue, queue: anonymous

**Subscribe qualifiers**

    direct/exchange/routingkey/queue
    direct/// => type: direct, exchange: amqp.direct, routing key: "", queue: anonymous

    topic/exchange/routingkey/queue
    topic/// => type: topic, exchange: amqp.topic, routing key: "", queue: anonymous

    fanout/exchange/queue
    fanout// => type: fanout, exchange: amqp.fanout, queue: anonymous

    headers/exchange/queue
    headers// => type: headers, exchange: amqp.headers, queue: anonymous
