import { prisma } from "../db";

export async function getPolicySettings() {
  let settings = await prisma.policySettings.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!settings) {
    settings = await prisma.policySettings.create({
      data: {
        accrualRate0To5: 10,
        accrualRate6To10: 13.33,
        accrualRateOver10: 16.67,
        rolloverCapHours: 80,
      },
    });
  }

  return settings;
}