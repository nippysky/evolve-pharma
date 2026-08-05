import { type NextRequest } from 'next/server';
import { db } from './db';

interface AuditLogParams {
  userId?:      number;
  userType:     string;       // 'ADMIN' | 'STAFF' | 'DRIVER' | 'CUSTOMER' | 'SYSTEM'
  userName?:    string;
  email?:       string;
  action:       string;       // e.g. 'CREATE_PRODUCT', 'APPROVE_CUSTOMER', 'BULK_IMPORT'
  entityType?:  string;       // e.g. 'Product', 'Customer', 'Order'
  entityId?:    string;
  description?: string;
  req?:         NextRequest;
}

export function writeAuditLog(params: AuditLogParams): void {
  const ip        = params.req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? params.req?.headers.get('x-real-ip')
    ?? undefined;
  const userAgent = params.req?.headers.get('user-agent') ?? undefined;

  db.auditLog.create({
    data: {
      user_id:     params.userId,
      user_type:   params.userType,
      user_name:   params.userName,
      email:       params.email,
      action:      params.action,
      entity_type: params.entityType,
      entity_id:   params.entityId,
      description: params.description,
      ip_address:  ip,
      user_agent:  userAgent,
    },
  }).catch((err: unknown) => console.error('[audit] write failed:', err));
}

type LoginEvent = 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'TOKEN_REFRESHED';

interface LoginHistoryParams {
  userId?:          number;
  userType:         string;
  userName?:        string;
  email?:           string;
  event:            LoginEvent;
  req?:             NextRequest;
}

export function writeLoginHistory(params: LoginHistoryParams): void {
  const ua        = params.req?.headers.get('user-agent') ?? '';
  const ip        = params.req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? params.req?.headers.get('x-real-ip')
    ?? undefined;

  // Lightweight browser/OS sniffing without a heavy dependency
  const browser = ua.includes('Chrome')  ? 'Chrome'
                : ua.includes('Firefox') ? 'Firefox'
                : ua.includes('Safari')  ? 'Safari'
                : ua.includes('Edge')    ? 'Edge'
                : 'Unknown';

  const os = ua.includes('Windows') ? 'Windows'
           : ua.includes('Mac')     ? 'macOS'
           : ua.includes('Linux')   ? 'Linux'
           : ua.includes('Android') ? 'Android'
           : ua.includes('iPhone') || ua.includes('iPad') ? 'iOS'
           : 'Unknown';

  db.loginHistory.create({
    data: {
      user_id:          params.userId,
      user_type:        params.userType,
      user_name:        params.userName,
      email:            params.email,
      event:            params.event,
      ip_address:       ip,
      browser,
      operating_system: os,
      device_name:      ua.substring(0, 200) || undefined,
    },
  }).catch((err: unknown) => console.error('[login-history] write failed:', err));
}
