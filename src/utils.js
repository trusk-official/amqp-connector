const {
  EXCHANGE_TYPE,
  EXCHANGES_AVAILABLE,
  DEFAULT_EXCHANGE,
  INVOKE_TYPE,
} = require("./constants");

/**
 * A function parses an amqp subscribe qualifier string
 * @param {string} qualifier - the qualifier string
 * @param {object} params - the params object
 * @param {string} params.realm - the channel realm
 * @return {object} an object of the parsed results
 */
const subscribeQualifierParser = (qualifier, params = { realm: null }) => {
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
    exchange: `${params.realm || ""}${
      !exchange ? DEFAULT_EXCHANGE[type] : exchange
    }`,
    routingKey: `${params.realm || ""}${
      routingKey === undefined ? "" : routingKey
    }`,
    queue: `${params.realm || ""}${queue || ""}`,
  };
};

/**
 * A function parses an amqp publish qualifier string
 * @param {string} qualifier - the qualifier string
 * @param {object} params - the params object
 * @param {string} params.realm - the channel realm
 * @return {object} an object of the parsed results
 */
const publishQualifierParser = (qualifier, params = { realm: null }) => {
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
    exchange: `${params.realm || ""}${
      !exchange ? DEFAULT_EXCHANGE[type] || "" : exchange
    }`,
    routingKey: `${params.realm || ""}${
      routingKey === undefined ? "" : routingKey
    }`,
    queue: `${params.realm || ""}${queue || ""}`,
  };
};

/**
 * A function parses an amqp invoke qualifier string
 * @param {string} qualifier - the qualifier string
 * @param {object} params - the params object
 * @param {string} params.realm - the channel realm
 * @return {object} an object of the parsed results
 */
const invokeQualifier = (qualifier, params = { realm: null }) => {
  const matchresult = qualifier.match(`^${INVOKE_TYPE.STREAM}/(.+)`);
  return {
    type: `${matchresult ? INVOKE_TYPE.STREAM : INVOKE_TYPE.RPC}`,
    function: `${params.realm || ""}${
      matchresult ? matchresult[1] : qualifier
    }`,
  };
};

/**
 * A function that times out a promise
 * @param {integer} ms - the timeout milliseconds
 * @param {function} promisef - a function that returns a promise
 * @return {Promise} The timouted promise
 */
const promiseTimeout = (ms, promisef) => {
  let id = null;
  const timeoutf = () =>
    new Promise((resolve, reject) => {
      id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error(`timeout_${ms}ms`));
      }, ms);
    });
  return Promise.race([
    promisef().finally(() => {
      clearTimeout(id);
    }),
    timeoutf(),
  ]);
};

/**
 * A function that generates an id
 * @param {integer} size - the size of the id
 * @param {string} id - The id
 */
const generateStackId = (size = 5) => {
  const CHARS =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(Array(size)).reduce(
    (acc) => acc + CHARS.charAt(Math.floor(Math.random() * CHARS.length)),
    ""
  );
};

const isFn = (fn) => fn && {}.toString.call(fn) === "[object Function]";

module.exports = {
  subscribeQualifierParser,
  publishQualifierParser,
  invokeQualifier,
  promiseTimeout,
  generateStackId,
  isFn,
};
