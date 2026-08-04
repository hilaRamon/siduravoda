import mongoose from 'mongoose';
import { entityDefinitions } from '../config/entities.js';
import { baseSchemaOptions } from './schemaOptions.js';

export { baseSchemaOptions };

const modelCache = {};

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
