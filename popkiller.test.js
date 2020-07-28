/* eslint-env jest */

'use strict';

const config = require('./config');
const server = require('./popkiller');
const nodemailer = require('nodemailer');
const BJSON = require('buffer-json');

const rabbitMock = require('./mocks/rabbit');
const message = require('./mocks/messages').simpleMessage;

jest.mock('amqplib');

const transport = nodemailer.createTransport({
  host: config.server.host,
  port: config.server.port,
  tls: {
    rejectUnauthorized: false
  }
}, {
  from: 'tests@example.com'
});

describe('The SMTP server', () => {
  beforeAll(() => server.start());
  afterAll(done => {
    server.stop(done);
  });

  beforeEach(() => {
    config.routes = {
      'example.org': 'somequeue'
    };
    jest.clearAllMocks();
  });

  it('should accept messages sent to it', () => {
    return transport.sendMail(message);
  });

  it('should reject authentication attempts', () => {
    const authenticatedMessage = Object.assign({}, message, {
      auth: {
        user: 'user',
        pass: 'password1'
      }
    });

    expect.assertions(1);

    return transport.sendMail(authenticatedMessage).catch(e => expect(e.toString()).toMatch('No auth'));
  });

  it('should add messages to the queue', async () => {
    await transport.sendMail(message);

    expect(rabbitMock.channel.sendToQueue.mock.calls.length).toBe(1);
  });

  it('should use a buffer to send the message to rabbit', async () => {
    await transport.sendMail(message);

    const buffer = rabbitMock.channel.sendToQueue.mock.calls[0][1];

    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  it('should serialize messages as a json dict', async () => {
    await transport.sendMail(message);

    const queueBuffer = rabbitMock.channel.sendToQueue.mock.calls[0][1];
    const queuedMessage = JSON.parse(queueBuffer.toString());

    expect(queuedMessage).toEqual(
      expect.objectContaining({
        subject: 'test message',
        text: 'simple text message\n'
      })
    );

    expect(queuedMessage.from.value[0].address).toEqual('tests@example.com');
    expect(queuedMessage.to.value[0].address).toEqual('popkiller@example.org');
  });

  it('should include attachments in message', async () => {
    const messageWithAttachment = Object.assign({}, message, {
      attachments: [{
        filename: 'hello.txt',
        content: 'Hello world!'
      }]
    });

    await transport.sendMail(messageWithAttachment);

    const queueBuffer = rabbitMock.channel.sendToQueue.mock.calls[0][1];
    const queuedMessage = BJSON.parse(queueBuffer.toString());

    expect(queuedMessage.attachments.length).toEqual(1);
    expect(queuedMessage.attachments[0].filename).toEqual('hello.txt');
    expect(queuedMessage.attachments[0].content.toString()).toEqual('Hello world!');
  });

  it('should route messages based on destination domain', async () => {
    config.routes = {
      'example.org': 'example-org',
      'example.com': null
    };

    const exampleOrgMessage = message;
    await transport.sendMail(exampleOrgMessage);
    let queue = rabbitMock.channel.sendToQueue.mock.calls[0][0];
    expect(queue).toBe('example-org');

    const exampleComMessage = Object.assign({}, message, {
      to: 'popki_test@example.com'
    });
    await transport.sendMail(exampleComMessage);
    queue = rabbitMock.channel.sendToQueue.mock.calls[1][0];
    expect(queue).toBe('example.com');
  });

  it('should route messages based on destination address', async () => {
    config.routes = {
      'example.org': 'domain-queue',
      'special@example.org': 'full-address-queue'
    };

    await transport.sendMail(message);
    let queue = rabbitMock.channel.sendToQueue.mock.calls.pop()[0];
    expect(queue).toBe('domain-queue');

    const fullAddressQueueMessage = Object.assign({}, message, {
      to: 'special@example.org'
    });

    await transport.sendMail(fullAddressQueueMessage);
    queue = rabbitMock.channel.sendToQueue.mock.calls.pop()[0];
    expect(queue).toBe('full-address-queue');
  });

  it('should reject messages for unknown domains', async () => {
    config.routes = {
      'example.com': 'example-com'
    };

    expect.assertions(1);

    try {
      await transport.sendMail(message);
    } catch (e) {
      expect(e.toString()).toMatch('Not allowed');
    }
  });

  it('should add a tags property to the message', async () => {
    await transport.sendMail(message);

    const queueBuffer = rabbitMock.channel.sendToQueue.mock.calls[0][1];
    const queuedMessage = BJSON.parse(queueBuffer.toString());

    expect(queuedMessage.tags).toEqual([]);
  });

  it('should extract tags from destinatary', async () => {
    const singleTagMessage = Object.assign({}, message, {
      to: 'test+tag1@example.org'
    });

    await transport.sendMail(singleTagMessage);

    let queueBuffer = rabbitMock.channel.sendToQueue.mock.calls[0][1];
    let queuedMessage = BJSON.parse(queueBuffer.toString());

    expect(queuedMessage.tags).toEqual(['tag1']);

    const multiTagMessage = Object.assign({}, message, {
      to: 'test+tag1+tag2+tag3@example.org'
    });

    await transport.sendMail(multiTagMessage);

    queueBuffer = rabbitMock.channel.sendToQueue.mock.calls[1][1];
    queuedMessage = BJSON.parse(queueBuffer.toString());

    expect(queuedMessage.tags).toEqual(['tag1', 'tag2', 'tag3']);
  });

  it('should not consider tags for routing', async () => {
    config.routes['popkiller@example.org'] = 'anotherqueue';

    await transport.sendMail(message);
    const noTagsQueue = rabbitMock.channel.sendToQueue.mock.calls.pop()[0];

    const singleTagMessage = Object.assign({}, message, {
      to: 'popkiller+tag1@example.org'
    });

    await transport.sendMail(singleTagMessage);
    const singleTagQueue = rabbitMock.channel.sendToQueue.mock.calls.pop()[0];

    expect(noTagsQueue).toEqual(singleTagQueue);
  });

  it('should close the channel and connection on shutdown', done => {
    expect(rabbitMock.channel.close.mock.calls.length).toEqual(0);
    server.stop(() => {
      expect(rabbitMock.channel.close.mock.calls.length).toEqual(1);
      expect(rabbitMock.connection.close.mock.calls.length).toEqual(1);
      done();
    });
  });
});
