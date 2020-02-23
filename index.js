'use strict';

const hl = require('highland');
const { MongoClient } = require('mongodb');

const url = 'mongodb://localhost:27017/highland_node_12_test';

const promiseTimeout = (toRace, delay) => {
  const timer = new Promise((resolve, reject) => {
    console.log('timeout set')
    setTimeout(() => reject(new Error('time is up!')), delay);
  });

  return Promise.race([toRace, timer]);
};

async function run() {
  const client = new MongoClient(url, { useUnifiedTopology: true });

  await client.connect();
  console.info('Connected successfully to server');
  const collection = client.db().collection('test');

  await collection.deleteMany({});

  for (let counter = 0; counter < 8000; counter++) {
    await collection.insertOne({ foo: 'bar', counter });
  }

  await collection.count({}).then(r => console.info('Inserted documents:', r));

  const mongoStream = collection
    .find()
    .batchSize(100)
    .stream();

  const stream = hl(mongoStream)
    .batch(300)
    .map(r => (console.count('seen'), Promise.resolve(r)))
    .flatMap(hl)
    .collect()
    .toPromise(Promise);

  await promiseTimeout(stream, 10000)
    .catch(async (e) => {
      console.error(e.message);
      await client.close();
      process.exit(128);
    });

  await client.close();
}

run();
