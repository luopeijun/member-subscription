import type { Plan } from '@/types'

export type PlanGroup = {
  serviceName: string
  category: string
  plans: Plan[]
}

export function groupPlansByService(plans: Plan[], keyword: string): PlanGroup[] {
  const map = new Map<string, PlanGroup>()

  for (const plan of plans) {
    if (
      keyword &&
      !plan.serviceName.toLowerCase().includes(keyword) &&
      !plan.name.toLowerCase().includes(keyword)
    ) {
      continue
    }
    const group = map.get(plan.serviceName) ?? {
      serviceName: plan.serviceName,
      category: plan.category,
      plans: [],
    }
    group.plans.push(plan)
    map.set(plan.serviceName, group)
  }

  return [...map.values()].sort((a, b) => a.serviceName.localeCompare(b.serviceName))
}
