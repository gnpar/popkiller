![Tests](https://github.com/gnpar/popkiller/workflows/Tests/badge.svg)
![Build](https://github.com/gnpar/popkiller/workflows/Build/badge.svg)

# Popkiller

A simple SMTP server to receive emails and queue them for later processing.

## What is the point of this?

If you want to receive emails that should be automatically processed there are two options:

1. Setup an actual email account and poll it over POP3/IMAP to get new emails
2. Use a third party service for inbound email, like Mailgun

Option 1 doesn't work very well for distributed processing of incoming emails. It also involves polling and POP3, both horrible things.

Option 2 is probably the best in most cases, but sometimes you can't delegate your MX to such services or just need something simpler to setup.

This packages is a simple solution to roll your own receiver.

The main purpose of this project was to learn javascript and Node in a real application that solved an actual problem I had.

## How to use

The simplest way is to use the docker image:

```
docker run -d \
    --name popkiller \
    -e BROKER_URL=amqp://rabbitmq \
    -e POPKILLER_ROUTES='{"example.org": "defaultqueue"}' \
    -p 2525:2525 \
    gnpar/popkiller
```

```
docker run -d \
    --name popkiller \
    --network node-amqpspike_default \
    -e BROKER_URL=amqp://rabbit \
    -e POPKILLER_ROUTES='{"example.org": "defaultqueue"}' \
    -p 2525:2525 \
    gnpar/popkiller
```

Once started, connect with an SMTP client to port 2525 and send an email:

```
# sudo apt-get install sendemail
sendEmail -s localhost:2525 \
    -f gnpar@example.org \
    -t test@example.org \
    -u "Hello world!" \
    -m "Test message"
```

The messages should be added to the queue defined in the routes, which can be inspected with the provided queue watch script:

```
docker exec -it popkiller node scripts/watch_queue.js defaultqueue
```

## Configuration variables

- `BROKER_URL`: RabbitMQ broker URL. The full format is `amqp://<user>:<password>@<host>:<port>/<vhost>` but any element can be ommited.
- `POPKILLER_HOST`: Address to listen on. Defaults to `127.0.0.1`.
- `POPKILLER_PORT`: Port to listen on. Defaults to 2525.
- `POPKILLER_ROUTES`: Mapping of domains/addresses to queues. Must be valid JSON.

## Mail serialization

The received emails are parsed using [Nodemailer's mailparser](https://nodemailer.com/extras/mailparser/) and serialized with JSON.

To deserialize attachments you will need to use [buffer-json](https://www.npmjs.com/package/buffer-json) in your consumer. Checkout [the queue watch script](scripts/watch_queue.js) for an example.

Consumers written in other languages will have to implement the logic to deserialize buffers.

TODO: Add Python example

## Email tags

Anything after a `+` sign in the destination address is considered a tag and multiple tags can be set.

For example, an email addressed to `someone+tag1+tag2@example.org` will have tags `tag1` and `tag2`.

The tags will be available in the `tags` property of the queued object.
