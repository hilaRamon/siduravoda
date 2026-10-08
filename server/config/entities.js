export const entityDefinitions = {
  User: {
    required: ["email", "role"],
    schema: {
      email: { type: String, required: true, trim: true, lowercase: true },
      password_hash: { type: String, required: true, select: false },
      full_name: { type: String, trim: true, default: "" },
      role: {
        type: String,
        enum: ["admin", "user", "workplace_manager", "reporter"],
        required: true,
        default: "user",
      },
      is_active: { type: Boolean, default: true },
    },
    indexes: [{ fields: { email: 1 }, options: { unique: true } }],
  },
  Role: {
    required: ["name"],
    schema: {
      name: { type: String, required: true, trim: true },
      description: { type: String },
      color: { type: String },
    },
  },
  Workplace: {
    required: ["name"],
    schema: {
      name: { type: String, required: true, trim: true },
      farm_name: { type: String },
      address: { type: String },
      company_id: { type: String },
      contact_phone: { type: String },
      accounting_phone: { type: String },
      accounting_email: { type: String },
      has_agreement: { type: Boolean, default: false },
    },
  },
  BackupSettings: {
    required: [],
    schema: {
      emails: [{ type: String }],
      last_backup_at: { type: Date },
      last_backup_filename: { type: String },
    },
  },
  AppSettings: {
    required: [],
    schema: {
      pricing_method: {
        type: String,
        enum: ["hourly", "daily"],
        default: "hourly",
      },
      default_rate: { type: Number },
      default_hours: { type: Number },
      default_daily_rate: { type: Number },
      hours_per_daily_unit: { type: Number },
      default_start_time: { type: String },
      default_end_time: { type: String },
    },
  },
};

export const entityNames = Object.keys(entityDefinitions);
