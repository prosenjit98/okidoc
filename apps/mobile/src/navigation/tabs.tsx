import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { tabBarScreenOptions, tabOptions } from '@/components/common';
import { useAuth } from '@/lib/auth';
import { useClinic } from '@/lib/clinic';
import { useT } from '@/lib/i18n';
import { Redirect } from '@/lib/nav';
import ClinicDoctors from '@/screens/console/doctors';
import More from '@/screens/console/more';
import ClinicQueue from '@/screens/console/queue';
import ClinicRecords from '@/screens/console/records';
import WalkIn from '@/screens/console/walkin';
import DoctorEarnings from '@/screens/dr/earnings';
import DoctorPatients from '@/screens/dr/patients';
import DoctorProfileTab from '@/screens/dr/profile';
import DoctorQueue from '@/screens/dr/queue';
import DoctorSchedule from '@/screens/dr/schedule';
import Account from '@/screens/p/account';
import Assistant from '@/screens/p/assistant';
import Bookings from '@/screens/p/bookings';
import Home from '@/screens/p/home';
import Records from '@/screens/p/records';

const PTab = createBottomTabNavigator();
const DTab = createBottomTabNavigator();
const CTab = createBottomTabNavigator();

/** Patient tabs: Home · Bookings · Assistant · Records · Account (PAT-*). */
export function PatientTabs() {
  const t = useT();
  return (
    <PTab.Navigator screenOptions={tabBarScreenOptions}>
      <PTab.Screen name="home" component={Home} options={tabOptions('home', t('tab.home'))} />
      <PTab.Screen name="bookings" component={Bookings} options={tabOptions('ticket-outline', t('tab.bookings'))} />
      <PTab.Screen name="assistant" component={Assistant} options={tabOptions('compass-outline', t('tab.assistant'))} />
      <PTab.Screen name="records" component={Records} options={tabOptions('document-text-outline', t('tab.records'))} />
      <PTab.Screen name="account" component={Account} options={tabOptions('person-circle-outline', t('tab.account'))} />
    </PTab.Navigator>
  );
}

/** Doctor tabs: Queue · Schedule · Earnings · Patients · Profile (DOC-*). */
export function DoctorTabs() {
  const t = useT();
  return (
    <DTab.Navigator screenOptions={tabBarScreenOptions}>
      <DTab.Screen name="queue" component={DoctorQueue} options={tabOptions('people-outline', t('tab.queue'))} />
      <DTab.Screen name="schedule" component={DoctorSchedule} options={tabOptions('calendar-outline', t('tab.schedule'))} />
      <DTab.Screen name="earnings" component={DoctorEarnings} options={tabOptions('wallet-outline', t('tab.earnings'))} />
      <DTab.Screen name="patients" component={DoctorPatients} options={tabOptions('person-outline', t('tab.patients'))} />
      <DTab.Screen name="profile" component={DoctorProfileTab} options={tabOptions('person-circle-outline', t('tab.profile'))} />
    </DTab.Navigator>
  );
}

/** Clinic tabs: Queue · Walk-in · Doctors · Records · More. Queue Managers get Queue / Walk-in / Records only (CLN-16). */
export function ClinicTabs() {
  const t = useT();
  const { clinicId } = useAuth();
  const { clinic } = useClinic();
  if (!clinicId) return <Redirect href="/k/select" />;
  const qm = clinic?.myRole === 'QUEUE_MANAGER';
  return (
    <CTab.Navigator screenOptions={tabBarScreenOptions}>
      <CTab.Screen name="queue" component={ClinicQueue} options={tabOptions('add-circle-outline', t('tab.queue'))} />
      <CTab.Screen name="walkin" component={WalkIn} options={tabOptions('person-add-outline', t('tab.walkin'))} />
      {!qm && <CTab.Screen name="doctors" component={ClinicDoctors} options={tabOptions('people-outline', t('tab.doctors'))} />}
      <CTab.Screen name="records" component={ClinicRecords} options={tabOptions('folder-open-outline', t('tab.records'))} />
      {!qm && <CTab.Screen name="more" component={More} options={tabOptions('ellipsis-horizontal-circle-outline', t('tab.more'))} />}
    </CTab.Navigator>
  );
}
