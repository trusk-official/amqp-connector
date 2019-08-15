const {
  EXCHANGE_TYPE,
  EXCHANGES_AVAILABLE,
  DEFAULT_EXCHANGE
} = require("../src/constants");

const subscribeQualifierParser = qualifier => {
  let type = null;
  let exchange = null;
  let routingKey;
  let queue;
  [type, exchange, routingKey, queue] = qualifier.split("/");
  if (!EXCHANGES_AVAILABLE.includes(type)) {
    throw new Error("qualifier_malformed");
  }
  if ([EXCHANGE_TYPE.FANOUT, EXCHANGE_TYPE.HEADERS].includes(type)) {
    queue = routingKey;
  }
  if ([EXCHANGE_TYPE.FANOUT, EXCHANGE_TYPE.HEADERS].includes(type)) {
    routingKey = "";
  }
  return {
    type,
    exchange: !exchange ? DEFAULT_EXCHANGE[type] : exchange,
    routingKey: routingKey === undefined ? "" : routingKey,
    queue: queue || ""
  };
};

const publishQualifierParser = qualifier => {
  let type = null;
  let exchange = null;
  let routingKey;
  let queue;
  [type, exchange, routingKey] = qualifier.split("/");
  if (!["q", ...EXCHANGES_AVAILABLE].includes(type)) {
    throw new Error("qualifier_malformed");
  }
  if ([EXCHANGE_TYPE.FANOUT, EXCHANGE_TYPE.HEADERS].includes(type)) {
    routingKey = "";
  }
  if (["q"].includes(type)) {
    queue = exchange;
    exchange = "";
    routingKey = "";
  }
  return {
    type,
    exchange: !exchange ? DEFAULT_EXCHANGE[type] || "" : exchange,
    routingKey: routingKey === undefined ? "" : routingKey,
    queue: queue || ""
  };
};

const promiseTimeout = (ms, promisef) => {
  let id = null;
  const timeout = new Promise((resolve, reject) => {
    id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`timeout_${ms}ms`));
    }, ms);
  });
  return Promise.race([
    promisef().finally(() => {
      clearTimeout(id);
    }),
    timeout
  ]);
};

const generateStackId = (size = 5) => {
  const CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(Array(size)).reduce(
    acc => acc + CHARS.charAt(Math.floor(Math.random() * CHARS.length)),
    ""
  );
};

module.exports = {
  subscribeQualifierParser,
  publishQualifierParser,
  promiseTimeout,
  generateStackId
};
