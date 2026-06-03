export type CashCutRow = {
  total_cash: number | string;
  total_transfer: number | string;
  total_card: number | string;
  total_income: number | string;
  difference?: number | string | null;
  leakage_flag?: boolean | null;
};

export type CashMovementRow = {
  direction: string;
  amount: number | string;
};

export type CashCutPeriodStats = {
  cutCount: number;
  totalIncome: number;
  totalCash: number;
  totalTransfer: number;
  totalCard: number;
  leakageCount: number;
  totalDifference: number;
};

export type CashMovementPeriodStats = {
  movementCount: number;
  incomeCount: number;
  expenseCount: number;
  incomeTotal: number;
  expenseTotal: number;
};

export function aggregateCashCutStats(cuts: CashCutRow[] | null): CashCutPeriodStats {
  let totalIncome = 0;
  let totalCash = 0;
  let totalTransfer = 0;
  let totalCard = 0;
  let totalDifference = 0;
  let leakageCount = 0;

  for (const cut of cuts ?? []) {
    totalIncome += Number(cut.total_income);
    totalCash += Number(cut.total_cash);
    totalTransfer += Number(cut.total_transfer);
    totalCard += Number(cut.total_card);
    totalDifference += Number(cut.difference ?? 0);
    if (cut.leakage_flag) leakageCount += 1;
  }

  return {
    cutCount: cuts?.length ?? 0,
    totalIncome: Number(totalIncome.toFixed(2)),
    totalCash: Number(totalCash.toFixed(2)),
    totalTransfer: Number(totalTransfer.toFixed(2)),
    totalCard: Number(totalCard.toFixed(2)),
    leakageCount,
    totalDifference: Number(totalDifference.toFixed(2)),
  };
}

export function aggregateCashMovementStats(
  movements: CashMovementRow[] | null,
): CashMovementPeriodStats {
  let incomeTotal = 0;
  let expenseTotal = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const movement of movements ?? []) {
    const amount = Number(movement.amount);
    if (movement.direction === "income") {
      incomeTotal += amount;
      incomeCount += 1;
    } else {
      expenseTotal += amount;
      expenseCount += 1;
    }
  }

  return {
    movementCount: movements?.length ?? 0,
    incomeCount,
    expenseCount,
    incomeTotal: Number(incomeTotal.toFixed(2)),
    expenseTotal: Number(expenseTotal.toFixed(2)),
  };
}
