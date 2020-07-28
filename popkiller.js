'use strict';

const config = require('./config');
const SMTPServer = require('smtp-server').SMTPServer;
const simpleParser = require('mailparser').simpleParser;
const amqp = require('amqplib');
const BJSON = require('buffer-json');

const server = new SMTPServer({
  logger: false,
  banner: 'POPKiller smtp server',

  size: 10 * 1024 * 1024,

  // No auth
  authOptional: true,
  onAuth (auth, session, callback) {
    return callback(new Error('No auth here'), null);
  },

  onRcptTo (address, session, callback) {
    if (!getQueueForAddress(address.address)) {
      return callback(new Error('Not allowed'));
    }

    callback();
  },

  async onData (stream, session, callback) {
    const toAddress = session.envelope.rcptTo[0].address;
    const queue = getQueueForAddress(toAddress);

    await broker.channel.assertQueue(queue, { durable: true });

    const parsed = await simpleParser(stream);
    parsed.tags = parseAddress(toAddress).tags;

    await broker.channel.sendToQueue(queue, Buffer.from(BJSON.stringify(parsed)));

    return callback(null, 'Message queued as ' + Date.now());
  }
});

var broker = {
  connection: null,
  channel: null
};

server.on('error', err => {
  console.log('Error occurred');
  console.log(err);
});

function getQueueForAddress (address) {
  const pa = parseAddress(address);

  if (config.routes[pa.canonical] !== undefined) {
    return config.routes[pa.canonical] || pa.canonical;
  }

  if (config.routes[pa.domain] === undefined) {
    return null;
  }

  return config.routes[pa.domain] || pa.domain;
}

function parseAddress (address) {
  const [localPart, domain] = address.split('@');

  const user = localPart.split('+')[0];
  const tags = localPart.split('+').slice(1);
  const canonical = user + '@' + domain;

  return {
    user: user,
    tags: tags,
    domain: domain,
    canonical: canonical
  };
}

async function start () {
  try {
    broker.connection = await amqp.connect(config.broker_url);
    broker.channel = await broker.connection.createChannel();
  } catch (error) {
    console.error('Error connecting to broker: %s', error);
    throw error;
  }

  return server.listen(config.server.port, config.server.host);
}

async function stop (callback) {
  await broker.channel.close();
  await broker.connection.close();

  return server.close(callback);
}

exports.start = start;
exports.stop = stop;
