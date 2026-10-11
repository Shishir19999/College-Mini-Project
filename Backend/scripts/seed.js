// Seeds the FoodShop sample data (menu, accounts, coupons, a fortnight of orders, reviews, messages).
//   npm run seed            seeds an empty database (refuses to touch existing data)
//   npm run seed -- --reset empties only this app's collections (fs_*) first, then seeds
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { MODELS, Counter } from '../models/index.js';
import { buildDataset } from '../../shared/seed.js';

dotenv.config();
const reset = process.argv.includes('--reset');

await mongoose.connect(process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/foodshop');
const existing = await MODELS.users.estimatedDocumentCount();
if (existing && !reset) {
  console.log(`"${mongoose.connection.name}" already has data. Run "npm run seed -- --reset" to replace the FoodShop collections.`);
  await mongoose.disconnect();
  process.exit(0);
}
if (reset) {
  for (const model of Object.values(MODELS)) await model.deleteMany({});
  await Counter.deleteMany({});
}
const { counters, ...collections } = buildDataset({ now: new Date() });
for (const u of collections.users) u.password = await bcrypt.hash(u.password, 10);
for (const [name, docs] of Object.entries(collections)) if (docs.length) await MODELS[name].insertMany(docs);
for (const [name, value] of Object.entries(counters)) await Counter.updateOne({ _id: name }, { $set: { value } }, { upsert: true });
console.log(`Seeded "${mongoose.connection.name}": ${Object.entries(collections).map(([k, v]) => `${v.length} ${k}`).join(', ')}.`);
await mongoose.disconnect();
