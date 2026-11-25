import type { LinkingOptions, ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState, type ComponentType } from 'react';
import { Linking } from 'react-native';
import { BrandSplash } from '@/components/Brand';
import { prefs } from '@/lib/storage';
import { useAuth } from '@/lib/auth';
import { router } from '@/lib/nav';
import { useI18n } from '@/lib/i18n';
import { C } from '@/lib/theme';
import AccountFamily from '@/screens/account/family';
import AccountNotificationSettings from '@/screens/account/notification-settings';
import AccountPrivacy from '@/screens/account/privacy';
import AccountProfile from '@/screens/account/profile';
import AccountRoles from '@/screens/account/roles';
import AccountSecurity from '@/screens/account/security';
import AccountStanding from '@/screens/account/standing';
import AreaPicker from '@/screens/area';
import Backup from '@/screens/auth/backup';
import Forgot from '@/screens/auth/forgot';
import Language from '@/screens/auth/language';
import Login from '@/screens/auth/login';
import Otp from '@/screens/auth/otp';
import QuickSetup from '@/screens/auth/quick-setup';
import RoleSelect from '@/screens/auth/role';
import Signup from '@/screens/auth/signup';
import Unlock from '@/screens/auth/unlock';
import Welcome from '@/screens/auth/welcome';
import Intro, { INTRO_SEEN_KEY } from '@/screens/auth/intro';
import Book from '@/screens/book';
import BookingLive from '@/screens/booking/live';
import ClinicPage from '@/screens/clinic/detail';
import DayOff from '@/screens/d/dayoff';
import DoctorFreeHours from '@/screens/d/freehours';
import DoctorOpenSlots from '@/screens/d/openslots';
import DoctorSitting from '@/screens/d/sitting';
import OwnChamber from '@/screens/d/chamber';
import Verify from '@/screens/d/verify';
import DoctorPage from '@/screens/doctor/detail';
import Index from '@/screens/index';
import ClinicAccount from '@/screens/k/account';
import AddDoctor from '@/screens/k/add-doctor';
import Blocks from '@/screens/k/blocks';
import ClinicReviews from '@/screens/k/reviews';
import Bonuses from '@/screens/k/bonuses';
import ClinicEarnings from '@/screens/k/earnings';
import Fees from '@/screens/k/fees';
import LinkDetail from '@/screens/k/link';
import ClinicOpenSlots from '@/screens/k/openslots';
import PosterScreen from '@/screens/k/poster';
import ClinicProfile from '@/screens/k/profile';
import RegisterClinic from '@/screens/k/register';
import SelectClinic from '@/screens/k/select';
import StaffScreen from '@/screens/k/staff';
import Subscription from '@/screens/k/subscription';
import Notifications from '@/screens/notifications';
import Scan from '@/screens/scan';
import Search from '@/screens/search';
import Support from '@/screens/support';
import { ClinicTabs, DoctorTabs, PatientTabs } from './tabs';

const Stack = createNativeStackNavigator();

const AUTH: Record<string, ComponentType> = {
  intro: Intro,
  welcome: Welcome,
  language: Language,
  role: RoleSelect,
  signup: Signup,
  otp: Otp,
  backup: Backup,
  'quick-setup': QuickSetup,
  login: Login,
  unlock: Unlock,
  forgot: Forgot,
};

const APP: Record<string, ComponentType> = {
  index: Index,
  p: PatientTabs,
  dr: DoctorTabs,
  console: ClinicTabs,
  area: AreaPicker,
  search: Search,
  scan: Scan,
  'clinic/:id': ClinicPage,
  'doctor/:id': DoctorPage,
  book: Book,
  'booking/:id': BookingLive,
  notifications: Notifications,
  support: Support,
  'account/profile': AccountProfile,
  'account/family': AccountFamily,
  'account/standing': AccountStanding,
  'account/security': AccountSecurity,
  'account/notification-settings': AccountNotificationSettings,
  'account/roles': AccountRoles,
  'account/privacy': AccountPrivacy,
  'd/verify': Verify,
  'd/sitting': DoctorSitting,
  'd/chamber': OwnChamber,
  'd/dayoff': DayOff,
  'd/freehours': DoctorFreeHours,
  'd/openslots': DoctorOpenSlots,
  'k/select': SelectClinic,
  'k/register': RegisterClinic,
  'k/add-doctor': AddDoctor,
  'k/link/:linkId': LinkDetail,
  'k/staff': StaffScreen,
  'k/earnings': ClinicEarnings,
  'k/profile': ClinicProfile,
  'k/fees': Fees,
  'k/poster': PosterScreen,
  'k/openslots': ClinicOpenSlots,
  'k/bonuses': Bonuses,
  'k/subscription': Subscription,
  'k/blocks': Blocks,
  'k/reviews': ClinicReviews,
  'k/account': ClinicAccount,
};

const screenOptions = { headerShown: false, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' as const };

/**
 * Auth-gated root stack (AUTH-01..08). The navigator is remounted (keyed by auth status) so signing in,
 * locking, or signing out always lands on the right first screen.
 */
export function RootNavigator() {
  const { status, appRole, clinicId } = useAuth();
  const { ready } = useI18n();
  useDeepLinkGate(status === 'signedIn');
  // Start the signed-in stack on the role's home directly. A redirect from `index` would fire before the freshly
  // mounted navigator can handle actions (child effects run first) and be dropped, leaving a blank screen.
  const home = appRole === 'patient' ? 'p' : appRole === 'doctor' ? 'dr' : appRole === 'clinic' ? (clinicId ? 'console' : 'k/select') : 'index';
  // First launch after install shows the introduction before Welcome.
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  useEffect(() => {
    prefs.get(INTRO_SEEN_KEY, false).then(setIntroSeen);
  }, [status]);
  if (status === 'loading' || !ready || introSeen === null) return <BrandSplash />;
  if (status === 'signedIn') {
    return (
      <Stack.Navigator key="app" initialRouteName={home} screenOptions={screenOptions}>
        {Object.entries(APP).map(([name, component]) => (
          <Stack.Screen key={name} name={name} component={component} />
        ))}
      </Stack.Navigator>
    );
  }
  return (
    <Stack.Navigator key={status} initialRouteName={status === 'locked' ? 'unlock' : introSeen ? 'welcome' : 'intro'} screenOptions={screenOptions}>
      {Object.entries(AUTH).map(([name, component]) => (
        <Stack.Screen key={name} name={name} component={component} />
      ))}
    </Stack.Navigator>
  );
}

// ---------------------------------------------------------------- deep links

/**
 * The link targets (clinic, booking) only exist in the signed-in stack. A link that arrives while the app is
 * locked or signed out (cold start from a QR scan, a notification tap) is held and opened right after sign-in,
 * instead of being dropped as an unhandled navigation.
 */
let linkGateOpen = false;
let heldUrl: string | null = null;

export function useDeepLinkGate(open: boolean) {
  useEffect(() => {
    linkGateOpen = open;
    if (!open || !heldUrl) return;
    // Next frame: the signed-in navigator has mounted and can handle the navigation.
    const id = requestAnimationFrame(() => {
      const url = heldUrl;
      heldUrl = null;
      if (url) router.push(url.replace(/^okidoc:\/\//, '/'));
    });
    return () => cancelAnimationFrame(id);
  }, [open]);
}

/** Deep links: okidoc://clinic/OK-XXXXX (poster QR), okidoc://booking/<id>. */
export const linking: LinkingOptions<ParamListBase> = {
  prefixes: ['okidoc://'],
  config: {
    screens: {
      'clinic/:id': 'clinic/:id',
      'booking/:id': 'booking/:id',
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url && !linkGateOpen) {
      heldUrl = url;
      return null;
    }
    return url;
  },
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (linkGateOpen) listener(url);
      else heldUrl = url;
    });
    return () => sub.remove();
  },
};
