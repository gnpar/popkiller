/* eslint-env jest */
'use strict';

const amqp = require('amqplib');
jest.mock('amqplib');

const channel = {
  assertQueue: (queue, opts) => Promise.resolve(),
  sendToQueue: jest.fn(),
  close: jest.fn().mockResolvedValue()
};

const connection = {
  createChannel: jest.fn().mockResolvedValue(channel),
  close: jest.fn()
};

amqp.connect.mockResolvedValue(connection);

exports.channel = channel;
exports.connection = connection;
