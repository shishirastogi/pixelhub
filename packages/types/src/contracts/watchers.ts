import { z } from "zod";

export const exchangeWatcherSchema = z.object({
  code: z.string().min(1).max(32),
  deviceName: z.string().min(1).max(120),
});
export type ExchangeWatcherInput = z.infer<typeof exchangeWatcherSchema>;
