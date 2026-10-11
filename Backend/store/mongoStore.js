import mongoose from 'mongoose';
import { MODELS, Counter } from '../models/index.js';
import { HttpError } from '../../shared/engine.js';

// Documents leave the store as plain JSON (ids are strings, dates are ISO strings), exactly like the
// in-memory store used by the browser-only Live preview.
const plain = (doc) => (doc == null ? doc : JSON.parse(JSON.stringify(doc)));

function translate(err) {
  if (err instanceof HttpError) return err;
  if (err?.code === 11000) return new HttpError(409, 'That record already exists');
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) return new HttpError(400, err.message);
  return err;
}

// Async document store with the same interface as shared/memoryStore.js, backed by Mongoose.
export function createMongoStore() {
  const model = (col) => {
    const m = MODELS[col];
    if (!m) throw new Error(`Unknown collection ${col}`);
    return m;
  };
  const guard = async (fn) => {
    try {
      return await fn();
    } catch (err) {
      throw translate(err);
    }
  };
  return {
    find: (col, filter = {}, { sort, skip = 0, limit = 0 } = {}) =>
      guard(async () => {
        let q = model(col).find(filter);
        if (sort) q = q.sort(sort);
        if (skip) q = q.skip(skip);
        if (limit) q = q.limit(limit);
        return plain(await q.lean());
      }),
    count: (col, filter = {}) => guard(() => model(col).countDocuments(filter)),
    get: (col, id) => guard(async () => plain(await model(col).findById(String(id)).lean())),
    insert: (col, doc) => guard(async () => plain((await model(col).create(doc)).toObject())),
    insertMany: (col, docs) => guard(async () => { await model(col).insertMany(docs); }),
    update: (col, id, patch) => guard(async () => plain(await model(col).findByIdAndUpdate(String(id), { $set: patch }, { returnDocument: 'after', runValidators: true }).lean())),
    updateMany: (col, filter, patch) => guard(async () => (await model(col).updateMany(filter, { $set: patch })).modifiedCount),
    remove: (col, id) => guard(async () => plain(await model(col).findByIdAndDelete(String(id)).lean())),
    removeMany: (col, filter) => guard(async () => (await model(col).deleteMany(filter)).deletedCount),
    nextSeq: (name) => guard(async () => (await Counter.findOneAndUpdate({ _id: name }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' }).lean()).value),
  };
}
