import { NextRequest } from 'next/server';
import { getTokenPayload } from '@/lib/auth';
import {
  apiSuccess,
  apiUnauthorized,
  apiInternalError,
} from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const payload = await getTokenPayload(req);

    if (!payload || payload.type !== 'access') {
      return apiUnauthorized('No valid session found. Please sign in.');
    }

    // Build SessionUser shape from the verified JWT payload.
    // uuid and avatar_url are not embedded in the token (they're rarely needed
    // for navigation); the client can fetch full profile via /api/profile if needed.
    return apiSuccess({
      user: {
        id:         payload.userId,
        uuid:       '',
        first_name: payload.first_name,
        last_name:  payload.last_name,
        email:      payload.email,
        role:       payload.role,
        status:     'ACTIVE' as const,
        avatar_url: null,
      },
    });
  } catch (err) {
    console.error('[GET /api/auth/me]', err);
    return apiInternalError();
  }
}
