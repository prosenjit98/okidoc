import type { AuthResult, Language, MeUser, Role, SignupRole } from '@okidoc/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { api, ApiError, session } from './api';
import { biometricSecret, getDeviceId, prefs, quickState, type QuickLoginState } from './storage';

export type AppRole = 'patient' | 'doctor' | 'clinic';
export type AuthStatus = 'loading' | 'signedOut' | 'locked' | 'signedIn';

export interface Challenge {
  token: string;
  to?: string;
  devOtp?: string;
  purpose: 'SIGNUP' | 'RESET';
  phone: string;
}

interface Flow {
  role?: SignupRole;
  challenge?: Challenge;
  setupToken?: string;
  backupCode?: string;
  pendingUser?: MeUser;
}

interface AuthValue {
  status: AuthStatus;
  user: MeUser | null;
  quick: QuickLoginState | null;
  flow: Flow;
  appRole: AppRole | null;
  clinicId: string | null;
  setFlow: (f: Partial<Flow>) => void;
  signup: (d: { phone: string; password: string; name: string; role: SignupRole; language: Language }) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  login: (phone: string, password: string) => Promise<'SETUP' | 'OTP'>;
  completeSetup: (method: 'PASSCODE' | 'BIOMETRIC', passcode?: string) => Promise<void>;
  unlockWithPasscode: (passcode: string) => Promise<void>;
  unlockWithBiometric: () => Promise<void>;
  logout: () => Promise<void>;
  forgetDevice: () => Promise<void>;
  refreshMe: () => Promise<MeUser | null>;
  setAppRole: (r: AppRole) => void;
  setClinicId: (id: string | null) => void;
  updateQuick: (patch: Partial<QuickLoginState>) => Promise<void>;
}

const Ctx = createContext<AuthValue>(null as unknown as AuthValue);
export const useAuth = () => useContext(Ctx);

/** Roles available to this user in the app (admins use the web portal). */
export function appRolesOf(u: MeUser | null): AppRole[] {
  if (!u) return [];
  const r = new Set<AppRole>();
  if (u.roles.includes('PATIENT')) r.add('patient');
  if (u.roles.includes('DOCTOR')) r.add('doctor');
  if (u.roles.some((x: Role) => x === 'CLINIC_OWNER' || x === 'QUEUE_MANAGER')) r.add('clinic');
  return [...r];
}

const LOCK_AFTER_MS = 5 * 60_000;

function deviceName(): string {
  const c = Platform.constants as unknown as { Model?: string; Brand?: string; Manufacturer?: string; systemName?: string; interfaceIdiom?: string };
  if (Platform.OS === 'android') return [c.Brand ?? c.Manufacturer, c.Model].filter(Boolean).join(' ') || 'Android phone';
  return c.interfaceIdiom === 'pad' ? 'iPad' : 'iPhone';
}

export async function deviceInfo() {
  return {
    deviceId: await getDeviceId(),
    deviceName: deviceName(),
    platform: (Platform.OS === 'ios' ? 'ios' : 'android') as 'android' | 'ios',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<MeUser | null>(null);
  const [quick, setQuick] = useState<QuickLoginState | null>(null);
  const [flow, setFlowState] = useState<Flow>({});
  const [appRole, setAppRoleState] = useState<AppRole | null>(null);
  const [clinicId, setClinicIdState] = useState<string | null>(null);
  const backgroundAt = useRef<number | null>(null);

  const setFlow = useCallback((f: Partial<Flow>) => setFlowState((x) => ({ ...x, ...f })), []);

  // ---- bootstrap
  useEffect(() => {
    (async () => {
      const q = await quickState.get();
      setQuick(q);
      setStatus(q ? 'locked' : 'signedOut');
    })();
  }, []);

  // ---- session lost (refresh failed) → lock or sign out
  useEffect(() => {
    session.onLost(() => {
      setStatus((s) => (s === 'signedIn' ? (quick ? 'locked' : 'signedOut') : s));
    });
  }, [quick]);

  // ---- relock after 5 minutes in background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background') backgroundAt.current = Date.now();
      if (st === 'active' && backgroundAt.current && Date.now() - backgroundAt.current > LOCK_AFTER_MS && quick && status === 'signedIn') {
        session.set(null);
        setStatus('locked');
      }
      if (st === 'active') backgroundAt.current = null;
    });
    return () => sub.remove();
  }, [quick, status]);

  const chooseRole = useCallback(async (u: MeUser) => {
    const roles = appRolesOf(u);
    const saved = await prefs.get<AppRole | null>(`role.${u.id}`, null);
    const role = saved && roles.includes(saved) ? saved : roles.includes('clinic') ? 'clinic' : roles.includes('doctor') ? 'doctor' : roles[0] ?? null;
    setAppRoleState(role);
    const savedClinic = await prefs.get<string | null>(`clinic.${u.id}`, null);
    setClinicIdState(savedClinic && u.clinicIds.includes(savedClinic) ? savedClinic : u.clinicIds[0] ?? null);
  }, []);

  const enter = useCallback(
    async (r: AuthResult) => {
      if (!r.tokens) throw new ApiError(500, 'NO_TOKENS', 'Login did not complete');
      session.set(r.tokens);
      setUser(r.user);
      await chooseRole(r.user);
      setStatus('signedIn');
    },
    [chooseRole],
  );

  // ---- sign-up & OTP (AUTH-04/05)
  const signup: AuthValue['signup'] = useCallback(async (d) => {
    const r = await api<AuthResult>('/auth/signup', { body: { ...d, consent: true }, auth: false });
    setFlow({ role: d.role, challenge: { token: r.challengeToken!, to: r.otpSentTo, devOtp: r.devOtp, purpose: 'SIGNUP', phone: d.phone } });
  }, [setFlow]);

  const verifyOtp = useCallback(
    async (code: string) => {
      const c = flow.challenge;
      if (!c) throw new ApiError(400, 'NO_CHALLENGE', 'Start again');
      const r = await api<AuthResult>('/auth/verify-otp', { body: { challengeToken: c.token, code }, auth: false });
      setFlow({ setupToken: r.setupToken, backupCode: r.backupCode, pendingUser: r.user, challenge: undefined });
    },
    [flow.challenge, setFlow],
  );

  const resendOtp = useCallback(async () => {
    const c = flow.challenge;
    if (!c) return;
    const r = await api<AuthResult>('/auth/otp/resend', { body: { challengeToken: c.token }, auth: false });
    setFlow({ challenge: { ...c, token: r.challengeToken ?? c.token, devOtp: r.devOtp, to: r.otpSentTo ?? c.to } });
  }, [flow.challenge, setFlow]);

  // ---- full login (AUTH-08)
  const login = useCallback(
    async (phone: string, password: string) => {
      const device = await deviceInfo();
      const r = await api<AuthResult>('/auth/login', { body: { phone, password, client: 'mobile', device }, auth: false });
      await quickState.clear();
      setQuick(null);
      if (r.challengeToken) {
        setFlow({ challenge: { token: r.challengeToken, to: r.otpSentTo, devOtp: r.devOtp, purpose: 'SIGNUP', phone }, pendingUser: r.user });
        return 'OTP' as const;
      }
      setFlow({ setupToken: r.setupToken, pendingUser: r.user, backupCode: undefined });
      return 'SETUP' as const;
    },
    [setFlow],
  );

  // ---- quick-login setup (AUTH-06)
  const completeSetup = useCallback(
    async (method: 'PASSCODE' | 'BIOMETRIC', passcode?: string) => {
      if (!flow.setupToken) throw new ApiError(400, 'SETUP_EXPIRED', 'Please log in again');
      if (method === 'BIOMETRIC' && !(await biometricSecret.available())) {
        throw new ApiError(400, 'BIOMETRIC_UNAVAILABLE', 'Set up a fingerprint, face or screen lock on this phone first, or use a passcode.');
      }
      const device = await deviceInfo();
      const r = await api<AuthResult>('/auth/quick-login/setup', { body: { setupToken: flow.setupToken, device, method, passcode }, auth: false });
      if (r.deviceSecret) await biometricSecret.save(r.deviceSecret);
      const q: QuickLoginState = { userId: r.user.id, name: r.user.name, method, hasPasscode: !!passcode };
      await quickState.set(q);
      setQuick(q);
      setFlowState({});
      await enter(r);
    },
    [flow.setupToken, enter],
  );

  const handleQuickError = useCallback(async (e: unknown) => {
    if (e instanceof ApiError && ['QUICK_LOGIN_LOCKED', 'FULL_LOGIN_REQUIRED', 'ACCOUNT_BLOCKED'].includes(e.code)) {
      await quickState.clear();
      setQuick(null);
      setStatus('signedOut');
    }
    throw e;
  }, []);

  // ---- daily unlock (AUTH-07)
  const unlockWithPasscode = useCallback(
    async (passcode: string) => {
      if (!quick) throw new ApiError(400, 'NO_DEVICE', 'Log in first');
      try {
        const r = await api<AuthResult>('/auth/quick-login', { body: { userId: quick.userId, deviceId: await getDeviceId(), method: 'PASSCODE', passcode }, auth: false });
        await enter(r);
      } catch (e) {
        await handleQuickError(e);
      }
    },
    [quick, enter, handleQuickError],
  );

  const unlockWithBiometric = useCallback(async () => {
    if (!quick) throw new ApiError(400, 'NO_DEVICE', 'Log in first');
    // Reading the Keychain item shows the OS biometric / screen-lock prompt (ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE).
    const secret = await biometricSecret.read();
    if (!secret) throw new ApiError(400, 'BIOMETRIC_CANCELLED', 'Unlock was cancelled. Use your passcode or password.');
    try {
      const r = await api<AuthResult>('/auth/quick-login', { body: { userId: quick.userId, deviceId: await getDeviceId(), method: 'BIOMETRIC', deviceSecret: secret }, auth: false });
      await enter(r);
    } catch (e) {
      await handleQuickError(e);
    }
  }, [quick, enter, handleQuickError]);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } catch {
      /* ignore */
    }
    session.set(null);
    await quickState.clear();
    setQuick(null);
    setUser(null);
    setFlowState({});
    setStatus('signedOut');
  }, []);

  const forgetDevice = useCallback(async () => {
    await quickState.clear();
    setQuick(null);
    setStatus('signedOut');
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api<MeUser>('/me');
      setUser(me);
      if (quick && quick.name !== me.name) {
        const q = { ...quick, name: me.name };
        setQuick(q);
        await quickState.set(q);
      }
      return me;
    } catch {
      return null;
    }
  }, [quick]);

  const setAppRole = useCallback(
    (r: AppRole) => {
      setAppRoleState(r);
      if (user) prefs.set(`role.${user.id}`, r);
    },
    [user],
  );
  const setClinicId = useCallback(
    (id: string | null) => {
      setClinicIdState(id);
      if (user) prefs.set(`clinic.${user.id}`, id);
    },
    [user],
  );

  const updateQuick = useCallback(
    async (patch: Partial<QuickLoginState>) => {
      if (!quick) return;
      const q = { ...quick, ...patch };
      setQuick(q);
      await quickState.set(q);
    },
    [quick],
  );

  const value = useMemo<AuthValue>(
    () => ({
      status, user, quick, flow, appRole, clinicId, setFlow, signup, verifyOtp, resendOtp, login, completeSetup,
      unlockWithPasscode, unlockWithBiometric, logout, forgetDevice, refreshMe, setAppRole, setClinicId, updateQuick,
    }),
    [status, user, quick, flow, appRole, clinicId, setFlow, signup, verifyOtp, resendOtp, login, completeSetup, unlockWithPasscode, unlockWithBiometric, logout, forgetDevice, refreshMe, setAppRole, setClinicId, updateQuick],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
