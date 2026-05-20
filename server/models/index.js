import mongoose from 'mongoose';
import { entityDefinitions } from '../config/entities.js';

const modelCache = {};

const baseSchemaOptions = {
  timestamps: { createdAt: 'created_date', updatedAt: 'updated_date' },
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      return ret;
    },
  },
};

function buildModel(name, definition) {
  const schema = new mongoose.Schema(definition.schema, baseSchemaOptions);

  for (const index of definition.indexes || []) {
    schema.index(index.fields, index.options || {});
  }

  return mongoose.models[name] || mongoose.model(name, schema);
}

export function getModel(name) {
  if (!entityDefinitions[name]) {
    throw new Error(`Unknown entity: ${name}`);
  }

  if (!modelCache[name]) {
    modelCache[name] = buildModel(name, entityDefinitions[name]);
  }

  return modelCache[name];
}
