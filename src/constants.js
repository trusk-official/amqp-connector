const EXCHANGE_TYPE = {
  DIRECT: "direct",
  HEADERS: "headers",
  FANOUT: "fanout",
  TOPIC: "topic"
};

const EXCHANGES_AVAILABLE = [
  EXCHANGE_TYPE.DIRECT,
  EXCHANGE_TYPE.HEADERS,
  EXCHANGE_TYPE.FANOUT,
  EXCHANGE_TYPE.TOPIC
];

const DEFAULT_EXCHANGE = {
  [EXCHANGE_TYPE.DIRECT]: "amq.direct",
  [EXCHANGE_TYPE.HEADERS]: "amq.headers",
  [EXCHANGE_TYPE.FANOUT]: "amq.fanout",
  [EXCHANGE_TYPE.TOPIC]: "amq.topic"
};

const INVOKE_TYPE = {
  RPC: "rpc",
  STREAM: "stream"
};

module.exports = {
  EXCHANGES_AVAILABLE,
  EXCHANGE_TYPE,
  DEFAULT_EXCHANGE,
  INVOKE_TYPE
};
