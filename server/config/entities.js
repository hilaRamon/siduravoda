export const entityDefinitions = {
  User: {
    required: ["role"],
    schema: {
      role: { type: String, enum: ["admin", "user"], required: true },
    },
  },
  Student: {
    required: ["full_name"],
    schema: {
      full_name: { type: String, required: true, trim: true },
      phone: { type: String, trim: true },
      cohort: { type: String, trim: true },
      free_day: { type: String, enum: ["א", "ב", "ג", "ד", "ה", null] },
      distance_status: {
        type: String,
        enum: ["קרוב", "רחוק", "אאא - לפני שיבוץ", "תתת - לא עובד", null],
      },
      is_active: { type: Boolean, default: true },
      forbidden_workplaces: [{ type: String }],
      notes: { type: String },
    },
  },
  Assignment: {
    required: ["date", "student_id", "workplace_id"],
    schema: {
      date: { type: String, required: true },
      student_id: { type: String, required: true },
      student_name: { type: String },
      workplace_id: { type: String, required: true },
      workplace_name: { type: String },
      role: { type: String },
      rate: { type: Number, default: 40 },
      hours: { type: Number, default: 4.5 },
      bonus: { type: Number },
      notes: { type: String },
    },
    indexes: [{ fields: { date: 1, student_id: 1 } }],
  },
  Vehicle: {
    required: ["name"],
    schema: {
      name: { type: String, required: true, trim: true },
      license_plate: { type: String, trim: true },
      insurance: { type: String },
      notes: { type: String },
    },
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
    },
  },
  WorkplaceLogistics: {
    required: ["date", "workplace_id"],
    schema: {
      date: { type: String, required: true },
      workplace_id: { type: String, required: true },
      workplace_name: { type: String },
      driver_student_id: { type: String },
      driver_student_name: { type: String },
      vehicle_id: { type: String },
      vehicle_name: { type: String },
      vehicle_id_2: { type: String },
      vehicle_name_2: { type: String },
      vehicle_id_3: { type: String },
      vehicle_name_3: { type: String },
      exit_time: { type: String },
      notes: { type: String },
    },
    indexes: [{ fields: { date: 1, workplace_id: 1 } }],
  },
  PublishedSchedule: {
    required: ["date", "file_url"],
    schema: {
      date: { type: String, required: true },
      file_url: { type: String, required: true },
    },
  },
  BackupSettings: {
    required: [],
    schema: {
      emails: [{ type: String }],
    },
  },
  IncomingSMS: {
    required: [],
    schema: {
      message: { type: String, default: "" },
      phone: { type: String, trim: true },
      sms_date: { type: String, trim: true },
      parsed_date: { type: String, trim: true },
      parsed_reason: { type: String, trim: true },
      parsed_student_name: { type: String, trim: true },
      status: {
        type: String,
        enum: ["ממתין", "אושר", "נדחה"],
        default: "ממתין",
      },
      notes: { type: String },
      student_id: { type: String },
      student_name: { type: String, trim: true },
    },
    indexes: [{ fields: { status: 1, created_date: -1 } }],
  },
  FarmerRequest: {
    required: ["date", "workplace_id"],
    schema: {
      date: { type: String, required: true },
      workplace_id: { type: String, required: true },
      workplace_name: { type: String, trim: true },
      requested_volunteers: { type: Number, default: null },
    },
    indexes: [{ fields: { date: 1 } }],
  },
};

export const entityNames = Object.keys(entityDefinitions);
