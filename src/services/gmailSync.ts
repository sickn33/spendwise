import { bulkAddTransactions, db } from '../db/database';
import type { Transaction } from '../types';
import { classifyTransaction } from './classifier';
import { parseIsybankEmailText } from './isybankEmailParser';

const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const GMAIL_TOKEN_STORAGE_KEY = 'spendwise-gmail-token';
const GMAIL_SETTINGS_STORAGE_KEY = 'spendwise-gmail-settings';

export interface GmailSyncSettings {
  googleClientId: string;
  senderEmail: string;
  maxResults: number;
  autoSync: boolean;
  pollingMinutes: number;
}

export interface GmailAccessToken {
  accessToken: string;
  expiresAt: number;
}

export interface GmailSyncResult {
  success: boolean;
  scanned: number;
  imported: number;
  skipped: number;
  errors: string[];
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
}

interface GoogleWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: GoogleTokenResponse) => void;
        }) => GoogleTokenClient;
      };
    };
  };
}

interface GmailMessageRef {
  id: string;
}

interface GmailMessageListResponse {
  messages?: GmailMessageRef[];
}

interface GmailMessageBody {
  data?: string;
}

interface GmailMessagePayload {
  mimeType?: string;
  body?: GmailMessageBody;
  parts?: GmailMessagePayload[];
}

interface GmailMessageDetail {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePayload;
}

export const DEFAULT_GMAIL_SYNC_SETTINGS: GmailSyncSettings = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  senderEmail: 'comunicazioni@isybank.com',
  maxResults: 25,
  autoSync: false,
  pollingMinutes: 10
};

export function loadGmailSyncSettings(): GmailSyncSettings {
  const raw = localStorage.getItem(GMAIL_SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_GMAIL_SYNC_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<GmailSyncSettings>;
    return {
      googleClientId: parsed.googleClientId ?? DEFAULT_GMAIL_SYNC_SETTINGS.googleClientId,
      senderEmail: parsed.senderEmail ?? DEFAULT_GMAIL_SYNC_SETTINGS.senderEmail,
      maxResults: parsed.maxResults ?? DEFAULT_GMAIL_SYNC_SETTINGS.maxResults,
      autoSync: parsed.autoSync ?? DEFAULT_GMAIL_SYNC_SETTINGS.autoSync,
      pollingMinutes: parsed.pollingMinutes ?? DEFAULT_GMAIL_SYNC_SETTINGS.pollingMinutes
    };
  } catch {
    return DEFAULT_GMAIL_SYNC_SETTINGS;
  }
}

export function saveGmailSyncSettings(settings: GmailSyncSettings): void {
  localStorage.setItem(GMAIL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function loadGmailToken(): GmailAccessToken | null {
  const raw = localStorage.getItem(GMAIL_TOKEN_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GmailAccessToken;
    if (!parsed.accessToken || typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveGmailToken(token: GmailAccessToken): void {
  localStorage.setItem(GMAIL_TOKEN_STORAGE_KEY, JSON.stringify(token));
}

export function clearGmailToken(): void {
  localStorage.removeItem(GMAIL_TOKEN_STORAGE_KEY);
}

export function isGmailTokenValid(token: GmailAccessToken | null): boolean {
  if (!token) return false;
  return token.expiresAt > Date.now() + 30_000;
}

export function buildGmailSearchQuery(senderEmail: string): string {
  return `from:${senderEmail.trim().toLowerCase()}`;
}

export function generateTransactionHash(
  date: Date,
  amount: number,
  description: string,
  details: string
): string {
  const dateStr = date.toISOString().split('T')[0];
  const normalizedDescription = description.toLowerCase().trim();
  const normalizedDetails = details.toLowerCase().trim();
  return `${dateStr}|${amount}|${normalizedDescription}|${normalizedDetails}`;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const decoded = atob(padded);
  const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function findBodyData(payload: GmailMessagePayload | undefined, mimeType: string): string | null {
  if (!payload) return null;

  if (payload.mimeType === mimeType && payload.body?.data) {
    return payload.body.data;
  }

  if (!payload.parts?.length) {
    return null;
  }

  for (const part of payload.parts) {
    const found = findBodyData(part, mimeType);
    if (found) return found;
  }

  return null;
}

export function extractMessageBody(payload: GmailMessagePayload | undefined): string {
  const plainText = findBodyData(payload, 'text/plain');
  if (plainText) {
    return decodeBase64Url(plainText);
  }

  const htmlText = findBodyData(payload, 'text/html');
  if (htmlText) {
    return stripHtml(decodeBase64Url(htmlText));
  }

  return '';
}

async function gmailGet<T>(
  accessToken: string,
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query.set(key, String(value));
  }

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

export async function loadGoogleIdentityScript(): Promise<void> {
  const googleWindow = window as GoogleWindow;
  if (googleWindow.google?.accounts?.oauth2) {
    return;
  }

  const existing = document.querySelector<HTMLScriptElement>(
    'script[data-spendwise-google-identity="true"]'
  );

  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Google Identity script')), {
        once: true
      });
    });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.dataset.spendwiseGoogleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Google Identity script'));
    document.head.appendChild(script);
  });
}

export async function requestGmailAccessToken(clientId: string): Promise<GmailAccessToken> {
  if (!clientId.trim()) {
    throw new Error('Google Client ID mancante');
  }

  await loadGoogleIdentityScript();
  const googleWindow = window as GoogleWindow;
  const oauth2 = googleWindow.google?.accounts?.oauth2;

  if (!oauth2) {
    throw new Error('Google Identity non disponibile');
  }

  return new Promise<GmailAccessToken>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: GMAIL_SCOPE,
      callback: (response: GoogleTokenResponse) => {
        if (response.error || !response.access_token || !response.expires_in) {
          reject(new Error(response.error_description ?? response.error ?? 'Autorizzazione Gmail fallita'));
          return;
        }

        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + response.expires_in * 1000
        });
      }
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

export async function syncIsybankTransactionsFromGmail(options: {
  accessToken: string;
  senderEmail: string;
  maxResults?: number;
}): Promise<GmailSyncResult> {
  const query = buildGmailSearchQuery(options.senderEmail);
  const maxResults = options.maxResults ?? 25;

  const listResponse = await gmailGet<GmailMessageListResponse>(options.accessToken, 'messages', {
    q: query,
    maxResults
  });

  const messageRefs = listResponse.messages ?? [];
  if (!messageRefs.length) {
    return {
      success: true,
      scanned: 0,
      imported: 0,
      skipped: 0,
      errors: []
    };
  }

  const existingTransactions = await db.transactions.toArray();
  const existingHashes = new Set(
    existingTransactions.map(transaction =>
      generateTransactionHash(transaction.date, transaction.amount, transaction.description, transaction.details)
    )
  );

  const toAdd: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const messageRef of messageRefs) {
    try {
      const detail = await gmailGet<GmailMessageDetail>(options.accessToken, `messages/${messageRef.id}`, {
        format: 'full'
      });

      const fallbackDate = detail.internalDate ? new Date(Number.parseInt(detail.internalDate, 10)) : new Date();
      const bodyText = extractMessageBody(detail.payload);
      const parsed = parseIsybankEmailText(bodyText || detail.snippet || '', fallbackDate);

      if (!parsed) {
        skipped++;
        continue;
      }

      const details = parsed.details.slice(0, 400);
      const hash = generateTransactionHash(parsed.date, parsed.amount, parsed.merchant, details);

      if (existingHashes.has(hash)) {
        skipped++;
        continue;
      }

      const classification = await classifyTransaction(parsed.merchant, details, parsed.amount);

      existingHashes.add(hash);
      toAdd.push({
        date: parsed.date,
        description: parsed.merchant,
        details,
        amount: parsed.amount,
        currency: parsed.currency,
        categoryId: classification.categoryId,
        subcategoryId: undefined,
        isRecurring: false,
        tags: ['gmail', 'isybank'],
        account: 'Carta Isybank (email)',
        isContabilized: false
      });
    } catch (error) {
      errors.push(
        `Messaggio ${messageRef.id}: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
      );
    }
  }

  if (toAdd.length > 0) {
    await bulkAddTransactions(toAdd);
  }

  return {
    success: errors.length === 0,
    scanned: messageRefs.length,
    imported: toAdd.length,
    skipped,
    errors
  };
}
