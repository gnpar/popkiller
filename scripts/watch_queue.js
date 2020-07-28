const amqp = require('amqplib');

async function consume (queue) {
  const conn = await amqp.connect(process.env.BROKER_URL);
  const channel = await conn.createChannel();

  await channel.assertQueue(queue, { durable: true });

  await channel.consume(queue, msg => {
    const msgContent = JSON.parse(msg.content.toString());
    console.log('---------------------------------');
    console.log('BEGN MESSAGE FROM %s', queue);
    console.log(JSON.stringify(msgContent, null, 2));
    console.log('END MESSAGE FROM %s', queue);
    console.log('---------------------------------');
    console.log('');
  }, { noAck: true });
}

process.argv.slice(2).forEach(queue => consume(queue).catch(console.error));
