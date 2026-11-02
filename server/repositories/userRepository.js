import User from "../models/User.js";

function withPassword(query, includePassword) {
  return includePassword ? query.select("+password_hash") : query;
}

export function findByEmail(email, { withPassword: includePassword = false } = {}) {
  return withPassword(User.findOne({ email }), includePassword).exec();
}

export function findById(id, { withPassword: includePassword = false } = {}) {
  return withPassword(User.findById(id), includePassword).exec();
}

export function listActiveEmails() {
  return User.find({ is_active: { $ne: false } }).select("email").lean().exec();
}

export function listAll() {
  return User.find().sort({ created_date: -1 }).exec();
}

export function create(data) {
  return User.create(data);
}

export function updateById(id, data) {
  return User.findByIdAndUpdate(id, data, {
    returnDocument: "after",
    runValidators: true,
  });
}

export function deleteById(id) {
  return User.findByIdAndDelete(id);
}
