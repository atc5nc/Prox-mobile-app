// Date estimation service with heuristic fallback and LLM integration

interface EstimateDatesInput {
  name: string;
  category: string;
  purchasedAt: string; // ISO date string
}

interface EstimateDatesOutput {
  estimatedExpirationAt: string;
  estimatedRestockAt: string;
  source: 'heuristic' | 'llm';
}

// Heuristic rules by category and keywords
const HEURISTIC_RULES = {
  'Produce': {
    default: { shelf_life: 5, restock: 7 },
    keywords: {
      'apple': { shelf_life: 14, restock: 14 },
      'banana': { shelf_life: 7, restock: 7 },
      'lettuce': { shelf_life: 5, restock: 7 },
      'spinach': { shelf_life: 3, restock: 7 },
      'tomato': { shelf_life: 7, restock: 10 },
      'avocado': { shelf_life: 5, restock: 7 },
      'carrot': { shelf_life: 21, restock: 14 },
      'onion': { shelf_life: 30, restock: 21 },
      'potato': { shelf_life: 30, restock: 21 },
    }
  },
  'Dairy': {
    default: { shelf_life: 7, restock: 10 },
    keywords: {
      'milk': { shelf_life: 7, restock: 7 },
      'cheese': { shelf_life: 14, restock: 14 },
      'yogurt': { shelf_life: 14, restock: 10 },
      'butter': { shelf_life: 30, restock: 30 },
      'eggs': { shelf_life: 25, restock: 14 },
      'cream': { shelf_life: 5, restock: 10 },
    }
  },
  'Meat': {
    default: { shelf_life: 2, restock: 7 },
    keywords: {
      'chicken': { shelf_life: 2, restock: 7 },
      'beef': { shelf_life: 3, restock: 10 },
      'pork': { shelf_life: 3, restock: 10 },
      'fish': { shelf_life: 1, restock: 7 },
      'ground': { shelf_life: 1, restock: 7 },
      'frozen': { shelf_life: 90, restock: 30 },
    }
  },
  'Pantry': {
    default: { shelf_life: 180, restock: 60 },
    keywords: {
      'bread': { shelf_life: 7, restock: 7 },
      'pasta': { shelf_life: 365, restock: 90 },
      'rice': { shelf_life: 365, restock: 90 },
      'cereal': { shelf_life: 60, restock: 30 },
      'flour': { shelf_life: 180, restock: 90 },
      'oil': { shelf_life: 365, restock: 180 },
      'canned': { shelf_life: 730, restock: 90 },
    }
  },
  'Frozen': {
    default: { shelf_life: 90, restock: 30 },
    keywords: {
      'ice cream': { shelf_life: 60, restock: 30 },
      'vegetables': { shelf_life: 180, restock: 60 },
      'fruit': { shelf_life: 180, restock: 60 },
      'pizza': { shelf_life: 90, restock: 30 },
    }
  },
  'Beverages': {
    default: { shelf_life: 90, restock: 30 },
    keywords: {
      'juice': { shelf_life: 7, restock: 14 },
      'soda': { shelf_life: 90, restock: 30 },
      'water': { shelf_life: 365, restock: 30 },
      'coffee': { shelf_life: 180, restock: 60 },
      'tea': { shelf_life: 365, restock: 90 },
    }
  },
  'Household': {
    default: { shelf_life: 365, restock: 90 },
    keywords: {
      'paper': { shelf_life: 365, restock: 60 },
      'detergent': { shelf_life: 365, restock: 90 },
      'soap': { shelf_life: 365, restock: 60 },
    }
  },
  'Personal Care': {
    default: { shelf_life: 365, restock: 90 },
    keywords: {
      'toothpaste': { shelf_life: 730, restock: 90 },
      'shampoo': { shelf_life: 365, restock: 90 },
      'deodorant': { shelf_life: 365, restock: 90 },
    }
  },
  'Baby': {
    default: { shelf_life: 30, restock: 14 },
    keywords: {
      'formula': { shelf_life: 30, restock: 14 },
      'diapers': { shelf_life: 365, restock: 30 },
      'food': { shelf_life: 14, restock: 14 },
    }
  },
  'Pet': {
    default: { shelf_life: 90, restock: 30 },
    keywords: {
      'food': { shelf_life: 90, restock: 30 },
      'treats': { shelf_life: 180, restock: 60 },
      'litter': { shelf_life: 365, restock: 30 },
    }
  }
};

function getHeuristicEstimate(name: string, category: string): { shelf_life: number; restock: number } {
  const categoryRules = HEURISTIC_RULES[category as keyof typeof HEURISTIC_RULES];
  if (!categoryRules) {
    return { shelf_life: 30, restock: 30 }; // Default fallback
  }

  const nameLower = name.toLowerCase();
  
  // Check for keyword matches
  for (const [keyword, rule] of Object.entries(categoryRules.keywords || {})) {
    if (nameLower.includes(keyword)) {
      return rule;
    }
  }
  
  return categoryRules.default;
}

async function getLLMEstimate(input: EstimateDatesInput): Promise<{ shelf_life: number; restock: number } | null> {
  try {
    const response = await fetch('https://wpelfofnestzbtziaggk.supabase.co/functions/v1/estimate-dates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('LLM estimation failed');
    }

    const data = await response.json();
    return {
      shelf_life: data.shelfLifeDays,
      restock: data.restockDays,
    };
  } catch (error) {
    console.warn('LLM estimation failed, falling back to heuristics:', error);
    return null;
  }
}

export async function estimateDates(input: EstimateDatesInput): Promise<EstimateDatesOutput> {
  const purchaseDate = new Date(input.purchasedAt);
  
  // Try LLM first, fall back to heuristics
  let estimate = await getLLMEstimate(input);
  let source: 'heuristic' | 'llm' = 'llm';
  
  if (!estimate) {
    estimate = getHeuristicEstimate(input.name, input.category);
    source = 'heuristic';
  }

  // Calculate dates
  const expirationDate = new Date(purchaseDate);
  expirationDate.setDate(expirationDate.getDate() + estimate.shelf_life);

  const restockDate = new Date(purchaseDate);
  restockDate.setDate(restockDate.getDate() + estimate.restock);

  // Cap expiration within 365 days
  const maxExpirationDate = new Date(purchaseDate);
  maxExpirationDate.setDate(maxExpirationDate.getDate() + 365);
  
  if (expirationDate > maxExpirationDate) {
    expirationDate.setTime(maxExpirationDate.getTime());
  }

  return {
    estimatedExpirationAt: expirationDate.toISOString().split('T')[0],
    estimatedRestockAt: Math.min(expirationDate.getTime(), restockDate.getTime()) === restockDate.getTime() 
      ? restockDate.toISOString().split('T')[0]
      : expirationDate.toISOString().split('T')[0],
    source,
  };
}