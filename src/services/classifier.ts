// Auto-classification service for SpendWise
import { db, getCategories } from '../db/database';


interface ClassificationResult {
    categoryId: number;
    confidence: number;
    method: 'keyword' | 'merchant' | 'isybank' | 'default';
}

// Store merchant -> category mappings for learning
const merchantCache = new Map<string, number>();

// Normalize text for matching
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Extract merchant name from description
function extractMerchant(description: string): string {
    // Remove common suffixes like dates, card numbers, etc.
    const normalized = normalizeText(description);
    // Take first few words as merchant identifier
    return normalized.split(' ').slice(0, 3).join(' ');
}

// Classify a transaction based on its description and details
export async function classifyTransaction(
    description: string,
    details: string,
    amount: number,
    isybankCategory?: string
): Promise<ClassificationResult> {
    const categories = await getCategories();
    const searchText = normalizeText(`${description} ${details}`);
    const merchant = extractMerchant(description);

    // 1. Check if we have a cached merchant mapping
    if (merchantCache.has(merchant)) {
        const categoryId = merchantCache.get(merchant)!;
        return { categoryId, confidence: 0.9, method: 'merchant' };
    }

    // 2. Try to match Isybank category directly
    if (isybankCategory) {
        const matchedCategory = categories.find(
            c => c.name.toLowerCase() === isybankCategory.toLowerCase()
        );
        if (matchedCategory?.id) {
            // Cache this merchant for future use
            merchantCache.set(merchant, matchedCategory.id);
            return { categoryId: matchedCategory.id, confidence: 1.0, method: 'isybank' };
        }
    }

    // 3. Keyword matching
    let bestMatch: { categoryId: number; score: number } | null = null;

    for (const category of categories) {
        if (!category.id || !category.keywords.length) continue;

        for (const keyword of category.keywords) {
            const normalizedKeyword = normalizeText(keyword);
            if (searchText.includes(normalizedKeyword)) {
                const score = normalizedKeyword.length / searchText.length;
                if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { categoryId: category.id, score };
                }
            }
        }
    }

    if (bestMatch && bestMatch.score > 0.05) {
        merchantCache.set(merchant, bestMatch.categoryId);
        return {
            categoryId: bestMatch.categoryId,
            confidence: Math.min(0.8, bestMatch.score * 10),
            method: 'keyword'
        };
    }

    // 4. Default to income or expense based on amount
    const defaultCategory = categories.find(c =>
        amount > 0 ? c.name === 'Bonifici ricevuti' : c.name === 'Altre uscite'
    );

    return {
        categoryId: defaultCategory?.id || 1,
        confidence: 0.3,
        method: 'default'
    };
}

// Learn from user corrections
export function learnFromCorrection(description: string, categoryId: number): void {
    const merchant = extractMerchant(description);
    merchantCache.set(merchant, categoryId);
}

// Clear the merchant cache
export function clearMerchantCache(): void {
    merchantCache.clear();
}

// Build merchant cache from existing transactions
export async function buildMerchantCacheFromHistory(): Promise<void> {
    const transactions = await db.transactions.toArray();

    for (const transaction of transactions) {
        const merchant = extractMerchant(transaction.description);
        // Only cache if we haven't seen this merchant before or if the transaction is newer
        if (!merchantCache.has(merchant)) {
            merchantCache.set(merchant, transaction.categoryId);
        }
    }

    console.log(`Built merchant cache with ${merchantCache.size} entries`);
}

// Get classification suggestions for a partial description
export async function getSuggestions(
    partialDescription: string
): Promise<Array<{ description: string; categoryId: number }>> {
    const normalized = normalizeText(partialDescription);
    if (normalized.length < 2) return [];

    const transactions = await db.transactions
        .orderBy('date')
        .reverse()
        .limit(1000)
        .toArray();

    const seen = new Set<string>();
    const suggestions: Array<{ description: string; categoryId: number }> = [];

    for (const t of transactions) {
        const tNormalized = normalizeText(t.description);
        if (tNormalized.includes(normalized) && !seen.has(tNormalized)) {
            seen.add(tNormalized);
            suggestions.push({
                description: t.description,
                categoryId: t.categoryId
            });
            if (suggestions.length >= 5) break;
        }
    }

    return suggestions;
}
