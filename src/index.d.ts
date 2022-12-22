export as namespace AmqpConnector;

export = AmqpConnector;
declare function AmqpConnector(config: AmqpConnector.AmqpConfig): AmqpConnector.AmqpInstance;

declare namespace AmqpConnector {
  type ConnectionConfig = {
    url: string;
    connectionOptions: {
      servername: string;
    };
  };

  type AmqpConfig = {
    urls: ConnectionConfig[];
    serviceName: string;
    serviceVersion: string;
  };

  type AmqpInstance = {
    connect: () => AmqpConnection;
  };

  type AmqpConnection = {
    on: (event: 'disconnect' | 'error', hdl: (error: Error) => void) => void;
    buildChannelIfNotExists: ({
                                name: string,
                                json: boolean,
                                prefetchCount: number,
                              }) => AmqpChannel;
    close: () => Promise<void>;
  };

  type AmqpChannel = {
    name: string;
    subscribeToMessages: (
      queue: string,
      handler: <T>(msg: { message: AmqpMessage<T> }) => void,
      options: {
        retry: number;
        maxTries: number;
        dumpQueue: string;
      },
    ) => void;
    publishMessage: <T>(
      path: string,
      data: T,
      amqpOpts?: Record<string, unknown>,
    ) => Promise<void>;
    addSetup: (builder: (c: AmqpChannel) => Promise<void>) => void;
    assertExchange: (
      exchange: string,
      type,
      options: { durable: boolean; autoDelete: boolean },
    ) => Promise<void>;
    waitForConnect: () => Promise<void>;
    close: () => Promise<void>;
  };

  type AmqpMessage<T> = {
    message: {
      properties?: {
        headers?: AmqpMessageHeader;
      };
      content: T;
    };
  };

  type AmqpMessageHeader = {
    'x-death'?: XDeath[];
  };

  type AmqpError = {
    message: string;
    response?: {
      status?: number;
    };
  };

  type XDeath = {
    count: number;
    reason: 'rejected' | 'expired' | 'maxlen';
  };
}