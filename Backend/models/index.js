import mongoose from 'mongoose';
import { newId } from '../../shared/memoryStore.js';

const { Schema } = mongoose;

// Ids are plain strings (the same shape the browser-only Live preview uses), so the shared routes
// work unchanged on top of either store. Collections are prefixed "fs_" to stay clear of other apps.
const make = (name, fields, extra = {}) => {
  const schema = new Schema({ _id: { type: String, default: newId }, ...fields }, { versionKey: false, timestamps: { createdAt: false, updatedAt: false }, ...extra });
  return mongoose.models[name] || mongoose.model(name, schema, `fs_${name}`);
};

const Iso = { type: Date, default: Date.now };

export const User = make('users', {
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  password: { type: String, required: true, select: true },
  role: { type: String, enum: ['customer', 'kitchen', 'admin'], default: 'customer' },
  active: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 },
  phone: { type: String, default: '' },
  favorites: { type: [String], default: [] },
  addresses: { type: [Schema.Types.Mixed], default: [] },
  createdAt: Iso,
});
export const Category = make('categories', { name: { type: String, required: true, unique: true }, order: { type: Number, default: 0 } });
export const Dish = make('dishes', {
  slug: String, name: { type: String, required: true }, categoryId: { type: String, required: true, index: true }, price: { type: Number, required: true, min: 0 },
  veg: { type: Boolean, default: true }, image: { type: String, default: '' }, desc: { type: String, default: '' },
  available: { type: Boolean, default: true }, featured: { type: Boolean, default: false }, createdAt: Iso,
});
export const Coupon = make('coupons', {
  code: { type: String, required: true, unique: true, uppercase: true }, kind: { type: String, enum: ['percent', 'flat', 'freeship'], required: true },
  value: { type: Number, default: 0 }, min: { type: Number, default: 0 }, active: { type: Boolean, default: true }, expiresAt: { type: String, default: '' },
  label: { type: String, default: '' }, uses: { type: Number, default: 0 },
});
export const Order = make('orders', {
  code: { type: String, required: true, unique: true }, user: { type: String, required: true, index: true }, userName: String,
  items: { type: [Schema.Types.Mixed], default: [] }, mode: String, pay: String, name: String, phone: String, address: String,
  slotDate: { type: String, default: '' }, slotTime: { type: String, default: '' }, note: { type: String, default: '' }, coupon: { type: String, default: null },
  sub: Number, disc: Number, ship: Number, tax: Number, total: Number,
  status: { type: String, enum: ['placed', 'preparing', 'ready', 'delivered', 'cancelled'], default: 'placed', index: true },
  history: { type: [Schema.Types.Mixed], default: [] }, createdAt: Iso,
});
export const Review = make('reviews', {
  dish: { type: String, required: true, index: true }, user: { type: String, required: true }, userName: String,
  rating: { type: Number, min: 1, max: 5, required: true }, comment: { type: String, default: '' }, createdAt: Iso,
});
export const Message = make('messages', { name: String, email: String, message: String, read: { type: Boolean, default: false }, createdAt: Iso });
export const Notification = make('notifications', {
  user: { type: String, required: true, index: true }, title: String, body: String, link: { type: String, default: '' }, read: { type: Boolean, default: false }, createdAt: Iso,
});
export const Booking = make('bookings', {
  user: { type: String, required: true, index: true }, userName: String, name: String, phone: String, date: String, time: String, guests: Number,
  note: { type: String, default: '' }, status: { type: String, default: 'confirmed' }, createdAt: Iso,
});
export const Counter = make('counters', { _id: String, value: { type: Number, default: 0 } });
export const MODELS = { users: User, categories: Category, dishes: Dish, coupons: Coupon, orders: Order, reviews: Review, messages: Message, notifications: Notification, bookings: Booking };
