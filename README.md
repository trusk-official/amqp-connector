# AMQP connector

## Run tests
```sh
# Launch RabbitMQ
docker run -d -p 5672:5672 -p 15672:15672 --name rabbit rabbitmq:3-management

# Launch tests
npm run test
```
