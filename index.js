'use strict';

const hl = require('highland');
const { MongoClient } = require('mongodb');

const url = 'mongodb://localhost:27017/highland_node_12_test';
const shouldBatch = !!process.env.SHOULD_BATCH;

const promiseTimeout = (toRace, delay) => {
  const timer = new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('time is up!')), delay);
  });

  return Promise.race([toRace, timer]);
};

async function run() {
  const client = new MongoClient(url, {
    useUnifiedTopology: true,
  });

  async function exit(error) {
    if (error) console.log(error.message);
    else console.log('Successfully finished');

    await client.close();
    process.exit(error ? 128 : 0);
  }

  await client.connect();
  console.info('Connected successfully to server');
  const collection = client.db().collection('test');

  await collection.deleteMany({});

  for (let counter = 0; counter < 1500; counter++) {
    await collection.insertOne({
      foo: 'bar',
      counter,
    });
  }

  await collection
    .count({})
    .then(r => console.info('Inserted documents:', r, 'Batched:', shouldBatch));

  const mongoStream = collection.find().stream();

  const getStream = () =>
    shouldBatch ? hl(mongoStream).batch(300) : hl(mongoStream);

  const stream = getStream()
    .flatten()
    .map(r => (console.count('Processed document'), Promise.resolve(r)))
    .flatMap(hl)
    .collect()
    .toPromise(Promise);

  return promiseTimeout(stream, 5000)
    .catch(exit)
    .then(r => exit());
}

run();
