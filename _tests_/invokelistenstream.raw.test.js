jest.setTimeout(30000);

const Promise = require("bluebird");
const fs = require("fs");
const path = require("path");
const amqpconnector = require("../src/index");

const cTags = [];

const amqpconnection = amqpconnector({
  urls: ["amqp://localhost:5672"],
  serviceName: "my_service",
  serviceVersion: "1.2.3",
}).connect();

const publishChannel = amqpconnection.buildChannelIfNotExists({
  name: "publishChannel",
});

const subscribeChannel = amqpconnection.buildChannelIfNotExists({
  name: "subscribeChannel",
});

beforeAll(async () => {
  return subscribeChannel.waitForConnect();
});

afterAll(async () => {
  await subscribeChannel.addSetup((channel) => {
    return Promise.resolve()
      .then(() => {
        return Promise.all(cTags.map((t) => channel.cancel(t)));
      })
      .then(() => channel.deleteQueue("my-rpc-function-stream-1"));
  });
  return Promise.all([
    publishChannel.close(),
    publishChannel.close(),
  ]).then(() => Promise.all([amqpconnection.close()]));
});

test.skip("invoke subscribe stream function", async () => {
  const to_stream_path_file = path.resolve(`${__dirname}/data/text_file.txt`);
  const streamed_path_file = path.resolve(`${__dirname}/data/text_file_2.txt`);
  await new Promise((resolve) => {
    subscribeChannel
      .listen("my-rpc-function-stream-1", async () => {
        return fs.createReadStream(to_stream_path_file);
      })
      .then(({ consumerTag }) => {
        cTags.push(consumerTag);
        const stream = publishChannel.invoke(
          "stream/my-rpc-function-stream-1",
          Buffer.from(JSON.stringify({ value: 45 }))
        );
        const closeHandler = () => {
          stream.removeListener("close", closeHandler);
          resolve();
        };
        stream.on("close", closeHandler);
        stream.pipe(fs.createWriteStream(streamed_path_file));
      });
  });
  const fileToStream = fs.readFileSync(to_stream_path_file, "utf-8");
  const fileStreamed = fs.readFileSync(streamed_path_file, "utf-8");
  expect(fileToStream === fileStreamed).toBe(true);
  fs.unlinkSync(streamed_path_file);
});
