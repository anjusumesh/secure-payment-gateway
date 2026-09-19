import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface PaypalTokenResponse {
  access_token: string;
  expires_in: number;
}

export class PaypalApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`PayPal API error (${status})`);
  }
}

/**
 * Thin wrapper over PayPal's REST API using Node's built-in `fetch` — no
 * PayPal SDK dependency (specs/backend-spec.md Tech Stack). Handles the
 * OAuth2 client-credentials token, caching it in memory until near expiry.
 */
@Injectable()
export class PaypalClientService {
  private cachedToken: { accessToken: string; expiresAt: number } | null = null;

  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    return this.configService.getOrThrow<string>('PAYPAL_API_BASE');
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAt > now) {
      return this.cachedToken.accessToken;
    }

    const clientId = this.configService.getOrThrow<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>(
      'PAYPAL_CLIENT_SECRET',
    );
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );

    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new PaypalApiError(
        response.status,
        await response.json().catch(() => null),
      );
    }

    const data = (await response.json()) as PaypalTokenResponse;
    // Refresh a little early to avoid a request racing against the token's actual expiry.
    this.cachedToken = {
      accessToken: data.access_token,
      expiresAt: now + (data.expires_in - 60) * 1000,
    };
    return this.cachedToken.accessToken;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const accessToken = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new PaypalApiError(response.status, body);
    }

    return body as T;
  }
}
