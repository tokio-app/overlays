import { z } from "zod";

// A copy of what Tokio checks when it imports an overlay, so builds fail here instead of in
// the app. Keep in sync with tokio-app/tokio:
// - SCRIPT_REGEX: src/main/services/overlay/common/index.ts
// - OverlayMetaSchema: src/common/schemas/store.ts
// - OverlayConfigSchema: src/common/schemas/overlay.ts (FONT_MAX_LENGTH: src/common/schemas/timer.ts)

// Where Tokio writes the overlay's ID, and its settings when it has them.
export const SCRIPT_REGEX = /<script id="tokio-setup">[\s\S]*?<\/script>/i;

export const OverlayMetaSchema = z.object({
  name: z.string(),
  version: z.string(),
  external: z.boolean().optional(),
  config: z.boolean(),
});

const SectionSchema = z.object({
  name: z.string(),
  id: z.string(),
});

const BaseSetting = {
  name: z.string(),
  id: z.string(),
  section: z.string(),
};

const InputValue = z.union([z.string().default(""), z.number().default(0)]);

const InputSetting = z.object({
  ...BaseSetting,
  type: z.literal("input"),
  attributes: z.object({
    mode: z.enum(["text", "number"]),
    placeholder: z.string().optional(),
    value: InputValue,
    default: InputValue,
  }),
});

const DropValue = z.union([
  z.string(),
  z.array(z.string()),
  z.number(),
  z.array(z.number()),
]);

const DropdownSetting = z.object({
  ...BaseSetting,
  type: z.literal("dropdown"),
  attributes: z.object({
    multiple: z.boolean().default(false),
    searchable: z.boolean().default(false),
    value: DropValue,
    default: DropValue,
    options: z.array(
      z.object({
        value: z.union([z.string(), z.number()]),
        label: z.union([z.string(), z.number()]),
        img: z.string().optional(),
      }),
    ),
  }),
});

const ColorValue = z
  .string()
  .regex(/^[0-9a-f]{6}([0-9a-f]{2})?$/i, "Must be a 6 or 8-character hex code");

const ColorSetting = z.object({
  ...BaseSetting,
  type: z.literal("color"),
  attributes: z.object({
    value: ColorValue,
    default: ColorValue,
  }),
});

const CheckSetting = z.object({
  ...BaseSetting,
  type: z.literal("check"),
  attributes: z.object({
    value: z.boolean(),
    default: z.boolean(),
  }),
});

const ToggleSetting = z.object({
  ...BaseSetting,
  type: z.literal("toggle"),
  attributes: z.object({
    value: z.boolean(),
    default: z.boolean(),
  }),
});

const GiftsSetting = z.object({
  ...BaseSetting,
  type: z.literal("gifts"),
  attributes: z.object({
    multiple: z.boolean().default(false),
    value: z.union([z.number(), z.array(z.number())]),
    default: z.union([z.number(), z.array(z.number())]),
  }),
});

const SliderSetting = z.object({
  ...BaseSetting,
  type: z.literal("slider"),
  attributes: z.object({
    value: z.number(),
    default: z.number(),
    min: z.number(),
    max: z.number(),
  }),
});

// A font's name, "" for the overlay's own font. 60 is FONT_MAX_LENGTH in
// tokio/src/common/schemas/timer.ts.
const FontValue = z.string().max(60);

const FontSetting = z.object({
  ...BaseSetting,
  type: z.literal("font"),
  attributes: z.object({
    value: FontValue,
    default: FontValue,
  }),
});

// A table's column: a field without its section and value, whose default
// fills the cell of a new row. A slider has no room for its number in a cell.
const ColumnSchema = z.discriminatedUnion("type", [
  InputSetting.omit({ section: true }).extend({
    attributes: InputSetting.shape.attributes.omit({ value: true }),
  }),
  DropdownSetting.omit({ section: true }).extend({
    attributes: DropdownSetting.shape.attributes.omit({ value: true }),
  }),
  ColorSetting.omit({ section: true }).extend({
    attributes: ColorSetting.shape.attributes.omit({ value: true }),
  }),
  CheckSetting.omit({ section: true }).extend({
    attributes: CheckSetting.shape.attributes.omit({ value: true }),
  }),
  ToggleSetting.omit({ section: true }).extend({
    attributes: ToggleSetting.shape.attributes.omit({ value: true }),
  }),
  GiftsSetting.omit({ section: true }).extend({
    attributes: GiftsSetting.shape.attributes.omit({ value: true }),
  }),
  FontSetting.omit({ section: true }).extend({
    attributes: FontSetting.shape.attributes.omit({ value: true }),
  }),
]);

// Each row's cells by column id. The config's check fits them to the columns.
const Rows = z.array(
  z.record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.string()),
      z.array(z.number()),
    ]),
  ),
);

const TableSetting = z.object({
  ...BaseSetting,
  type: z.literal("table"),
  attributes: z.object({
    columns: z.array(ColumnSchema).min(1),
    // The most rows the streamer can add, no limit without it
    max: z.number().int().min(1).optional(),
    value: Rows,
    default: Rows,
  }),
});

const FieldsSchema = z.discriminatedUnion("type", [
  InputSetting,
  DropdownSetting,
  ColorSetting,
  CheckSetting,
  ToggleSetting,
  GiftsSetting,
  SliderSetting,
  FontSetting,
  TableSetting,
]);

export const OverlayConfigSchema = z
  .object({
    sections: z.array(SectionSchema),
    fields: z.array(FieldsSchema),
  })
  .superRefine((data, ctx) => {
    const seenSectionIds = new Set();
    const seenFieldIds = new Set();

    data.sections.forEach((section, index) => {
      if (seenSectionIds.has(section.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate section ID found: '${section.id}'. Each section must have a unique ID.`,
          path: ["sections", index, "id"],
        });
      }
      seenSectionIds.add(section.id);
    });

    data.fields.forEach((field, index) => {
      if (!seenSectionIds.has(field.section)) {
        ctx.addIssue({
          code: "custom",
          message: `Invalid section: '${field.section}' is not defined in the sections array.`,
          path: ["fields", index, "section"],
        });
      }

      if (seenFieldIds.has(field.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate field ID found: '${field.id}'. Each field must have a unique ID.`,
          path: ["fields", index, "id"],
        });
      }

      seenFieldIds.add(field.id);

      if (field.type === "table") checkTable(field, index, ctx);
    });
  });

/**
 * A table's column ids are its own, it has no more rows than its max, and each
 * row fits its columns.
 * @param {z.infer<typeof TableSetting>} table
 * @param {number} index
 * @param {z.RefinementCtx} ctx
 */
function checkTable({ attributes }, index, ctx) {
  const path = ["fields", index, "attributes"];
  const seenColumnIds = new Set();

  attributes.columns.forEach((column, c) => {
    if (seenColumnIds.has(column.id)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate column ID found: '${column.id}'. Each column of a table must have a unique ID.`,
        path: [...path, "columns", c, "id"],
      });
    }
    seenColumnIds.add(column.id);
  });

  for (const key of /** @type {const} */ (["value", "default"])) {
    const rows = attributes[key];
    if (attributes.max !== undefined && rows.length > attributes.max) {
      ctx.addIssue({
        code: "custom",
        message: `Too many rows: ${rows.length}, but the table allows ${attributes.max}.`,
        path: [...path, key],
      });
    }

    rows.forEach((row, r) => {
      if (!fitsColumns(row, attributes.columns)) {
        ctx.addIssue({
          code: "custom",
          message:
            "Invalid row: it needs a value of its column's kind for each column, keyed by the column's ID, and nothing else.",
          path: [...path, key, r],
        });
      }
    });
  }
}

/**
 * Whether a row has a cell for each column, each one a value the column could
 * have as its default, and no other cell.
 * @param {Record<string, unknown>} row
 * @param {z.infer<typeof ColumnSchema>[]} columns
 */
function fitsColumns(row, columns) {
  return (
    Object.keys(row).length === columns.length &&
    columns.every(
      (column) =>
        Object.hasOwn(row, column.id) &&
        ColumnSchema.safeParse({
          ...column,
          attributes: { ...column.attributes, default: row[column.id] },
        }).success,
    )
  );
}
