import { z } from 'zod';

export const payFrequencyValues = ['weekly', 'fortnightly', 'monthly', 'quarterly'] as const;

export type PayFrequency = (typeof payFrequencyValues)[number];

const roundingSchema = z.object({
  precision: z.number().positive(),
  mode: z.enum(['half_up'])
});

const frequencySchema = z.object({
  annual_factor: z.number().positive(),
  rounding: roundingSchema
});

const taxRateBandSchema = z.object({
  threshold: z.number().min(0),
  rate: z.number().min(0),
  base: z.number().min(0)
});

const litoSchema = z.object({
  maximum: z.number().min(0),
  full_threshold: z.number().min(0),
  middle_threshold: z.number().min(0),
  phase_out: z.number().min(0),
  phase_out_rate_low: z.number().min(0),
  phase_out_rate_high: z.number().min(0),
  middle_offset: z.number().min(0)
});

const medicareSchema = z.object({
  type: z.literal('flat_rate'),
  rate: z.number().min(0)
});

export const schedule1Schema = z.object({
  schedule: z.string(),
  effective_from: z.string(),
  source_url: z.string().optional(),
  retrieved_at: z.string().optional(),
  notes: z.array(z.string()).default([]),
  frequencies: z.record(z.enum(payFrequencyValues), frequencySchema),
  resident: z.object({
    tax_free_threshold: z.object({
      tax_rates: z.array(taxRateBandSchema).min(1),
      lito: litoSchema
    }),
    no_tax_free_threshold: z.object({
      tax_rates: z.array(taxRateBandSchema).min(1)
    }),
    medicare_levy: z.object({
      standard: medicareSchema,
      half_exempt: medicareSchema,
      full_exempt: medicareSchema
    })
  }),
  non_resident: z.object({
    tax_rates: z.array(taxRateBandSchema).min(1)
  })
});

export type Schedule1Data = z.infer<typeof schedule1Schema>;

const schedule8ThresholdSchema = z.object({
  minimum: z.number().min(0),
  rate: z.number().min(0)
});

export const schedule8Schema = z.object({
  schedule: z.string(),
  effective_from: z.string(),
  source_url: z.string().optional(),
  retrieved_at: z.string().optional(),
  notes: z.array(z.string()).default([]),
  rounding: roundingSchema,
  thresholds: z.array(schedule8ThresholdSchema).min(1)
});

export type Schedule8Data = z.infer<typeof schedule8Schema>;

export type RoundingRule = z.infer<typeof roundingSchema>;

export type TaxRateBand = z.infer<typeof taxRateBandSchema>;

export type LitoConfig = z.infer<typeof litoSchema>;

export type MedicareConfig = z.infer<typeof medicareSchema>;
