/**
 * Single source for discount rules (happy hour, limits, approval). Read/write from localStorage.
 * Used by DiscountRulesPage and HappyHourContext so we don't duplicate load logic.
 */

export const DISCOUNT_RULES_KEY = 'kingg-discount-rules';

export interface DiscountRulesConfig {
  timeBasedEnabled: boolean;
  startTime: string;
  endTime: string;
  defaultPercent: number;
  maxPercent: number;
  approvalThresholdPercent: number;
  happyHourProductIds: string[];
}

export const defaultDiscountRules: DiscountRulesConfig = {
  timeBasedEnabled: false,
  startTime: '17:00',
  endTime: '19:00',
  defaultPercent: 10,
  maxPercent: 30,
  approvalThresholdPercent: 25,
  happyHourProductIds: [],
};

export function loadDiscountRules(): DiscountRulesConfig {
  try {
    const raw =
      typeof localStorage !== 'undefined' ? localStorage.getItem(DISCOUNT_RULES_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DiscountRulesConfig>;
      const loaded = { ...defaultDiscountRules, ...parsed };
      if (!Array.isArray(loaded.happyHourProductIds)) loaded.happyHourProductIds = [];
      return loaded;
    }
  } catch {
    // ignore
  }
  return defaultDiscountRules;
}

export function saveDiscountRules(config: DiscountRulesConfig): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(DISCOUNT_RULES_KEY, JSON.stringify(config));
  }
}
