import { z } from "zod";

// A copy of what Tokio checks when it imports an overlay, so builds fail here instead of in
// the app. Keep in sync with tokio-app/tokio:
// - SCRIPT_REGEX: src/main/services/overlay/common/index.ts
// - OverlayMetaSchema: src/common/schemas/store.ts
// - OverlayConfigSchema: src/common/schemas/overlay.ts

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
  .regex(
    /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/i,
    "Must be a 6 or 8-character hex code",
  );

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

const FieldsSchema = z.discriminatedUnion("type", [
  InputSetting,
  DropdownSetting,
  ColorSetting,
  CheckSetting,
  ToggleSetting,
  GiftsSetting,
  SliderSetting,
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
          path: ["config", index, "section"],
        });
      }

      if (seenFieldIds.has(field.id)) {
        ctx.addIssue({
          code: "custom",
          message: `Duplicate field ID found: '${field.id}'. Each field must have a unique ID.`,
          path: ["config", index, "id"],
        });
      }

      seenFieldIds.add(field.id);
    });
  });
