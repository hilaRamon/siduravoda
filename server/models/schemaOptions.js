export const baseSchemaOptions = {
  timestamps: { createdAt: "created_date", updatedAt: "updated_date" },
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.password_hash;
      return ret;
    },
  },
};
