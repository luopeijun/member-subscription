import { describe, expect, it } from 'vitest'
import { groupPlansByService } from '@/utils/plan'
import { makePlan } from './fixtures'

describe('groupPlansByService', () => {
  it('groups plans by service and sorts groups by service name', () => {
    const plans = [
      makePlan({ id: 1, serviceId: 1, serviceName: 'Beta', name: 'Basic' }),
      makePlan({ id: 2, serviceId: 2, serviceName: 'Alpha', name: 'Pro' }),
      makePlan({ id: 3, serviceId: 1, serviceName: 'Beta', name: 'Premium' }),
    ]

    const groups = groupPlansByService(plans, '')

    expect(groups.map((group) => group.serviceName)).toEqual(['Alpha', 'Beta'])
    expect(groups[1].plans.map((plan) => plan.id)).toEqual([1, 3])
  })

  it('matches the keyword against service and plan names', () => {
    const plans = [
      makePlan({ id: 1, serviceName: 'Netflix', name: 'Standard' }),
      makePlan({ id: 2, serviceName: 'Spotify', name: 'Premium' }),
    ]

    expect(groupPlansByService(plans, 'net').map((group) => group.serviceName)).toEqual([
      'Netflix',
    ])
    expect(groupPlansByService(plans, 'prem').map((group) => group.serviceName)).toEqual([
      'Spotify',
    ])
  })

  it('returns all groups for an empty keyword', () => {
    const plans = [
      makePlan({ id: 1, serviceName: 'Alpha' }),
      makePlan({ id: 2, serviceName: 'Beta' }),
    ]
    expect(groupPlansByService(plans, '')).toHaveLength(2)
  })

  it('returns an empty list when nothing matches', () => {
    const plans = [makePlan({ serviceName: 'Netflix', name: 'Standard' })]
    expect(groupPlansByService(plans, 'youtube')).toEqual([])
  })

  it('keeps the category from the first plan in a group', () => {
    const plans = [
      makePlan({ id: 1, serviceName: 'Netflix', category: '影音娱乐' }),
      makePlan({ id: 2, serviceName: 'Netflix', category: '其他' }),
    ]
    expect(groupPlansByService(plans, '')[0].category).toBe('影音娱乐')
  })
})
