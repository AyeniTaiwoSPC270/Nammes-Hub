import heroHome from '../assets/illustrations/hero-home.png'
import categoryAcademics from '../assets/illustrations/category-academics.png'
import categoryGovernance from '../assets/illustrations/category-governance.png'
import categoryWelfare from '../assets/illustrations/category-welfare.png'
import categoryIndustry from '../assets/illustrations/category-industry.png'
import categoryCallForPapers from '../assets/illustrations/category-call-for-papers.png'
import categoryResources from '../assets/illustrations/category-resources.png'
import level100 from '../assets/illustrations/level-100.png'
import level200 from '../assets/illustrations/level-200.png'
import level300 from '../assets/illustrations/level-300.png'
import level400 from '../assets/illustrations/level-400.png'
import level500 from '../assets/illustrations/level-500.png'
import eventGreen from '../assets/illustrations/event-green.png'
import eventOrange from '../assets/illustrations/event-orange.png'

export const HERO_ILLUSTRATION = heroHome

export const CATEGORY_ICONS = {
  Academics: categoryAcademics,
  Governance: categoryGovernance,
  Welfare: categoryWelfare,
  Industry: categoryIndustry,
  'Call for papers': categoryCallForPapers,
  Resources: categoryResources,
}

export const LEVEL_ICONS = {
  '100': level100,
  '200': level200,
  '300': level300,
  '400': level400,
  '500': level500,
}

export const EVENT_TONE_ICONS = {
  green: eventGreen,
  orange: eventOrange,
}

export function categoryImage(category) {
  const src = CATEGORY_ICONS[category]
  return src ? { src } : undefined
}
