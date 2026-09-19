import 'dotenv/config';
import mongoose from 'mongoose';
import { Item, ItemSchema } from './schemas/item.schema.js';

const SPORTS_ITEMS = [
  {
    name: 'Football',
    code: 'SPT-001',
    imageUrl: '/img/football.png',
    price: 5400,
  },
  {
    name: 'Basketball',
    code: 'SPT-002',
    imageUrl: '/img/basketball.png',
    price: 4900,
  },
  {
    name: 'Tennis Racket',
    code: 'SPT-003',
    imageUrl: '/img/tennis-racket.png',
    price: 8900,
  },
  {
    name: 'Badminton Racket',
    code: 'SPT-004',
    imageUrl: '/img/badminton-racket.png',
    price: 6500,
  },
  {
    name: 'Cricket Bat',
    code: 'SPT-005',
    imageUrl: '/img/cricket-bat.png',
    price: 12000,
  },
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(uri);
  const ItemModel = mongoose.model(Item.name, ItemSchema);

  const existingCount = await ItemModel.countDocuments();
  if (existingCount > 0) {
    console.log(
      `items collection already has ${existingCount} document(s) — skipping seed.`,
    );
    await mongoose.disconnect();
    return;
  }

  await ItemModel.insertMany(SPORTS_ITEMS);
  console.log(`Seeded ${SPORTS_ITEMS.length} items.`);
  await mongoose.disconnect();
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
