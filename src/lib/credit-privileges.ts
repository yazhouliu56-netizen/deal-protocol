export interface CreditTier {
  level: 1 | 2 | 3 | 4 | 5;
  name: string;
  minScore: number;
  maxScore: number;
  matchingWeight: number;
  dailyGrabLimit: number;
  fastWithdrawal: boolean;
  manualReviewRequired: boolean;
}

export function getCreditTierPrivileges(score: number): CreditTier {
  if (score >= 900) {
    return { level: 5, name: '王者/VIP', minScore: 900, maxScore: 1000, matchingWeight: 1.5, dailyGrabLimit: -1, fastWithdrawal: true, manualReviewRequired: false };
  } else if (score >= 750) {
    return { level: 4, name: '钻石', minScore: 750, maxScore: 899, matchingWeight: 1.2, dailyGrabLimit: 50, fastWithdrawal: true, manualReviewRequired: false };
  } else if (score >= 600) {
    return { level: 3, name: '黄金', minScore: 600, maxScore: 749, matchingWeight: 1.0, dailyGrabLimit: 20, fastWithdrawal: false, manualReviewRequired: false };
  } else if (score >= 500) {
    return { level: 2, name: '青铜', minScore: 500, maxScore: 599, matchingWeight: 0.8, dailyGrabLimit: 5, fastWithdrawal: false, manualReviewRequired: false };
  } else {
    return { level: 1, name: '受限', minScore: 0, maxScore: 499, matchingWeight: 0.5, dailyGrabLimit: 1, fastWithdrawal: false, manualReviewRequired: true };
  }
}

export const TIER_LABELS: Record<number, string> = {
  1: '受限',
  2: '青铜',
  3: '黄金',
  4: '钻石',
  5: '王者/VIP',
}
