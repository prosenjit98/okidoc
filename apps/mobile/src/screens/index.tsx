import { Redirect } from '@/lib/nav';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { C } from '@/lib/theme';

/** Sends a signed-in user to the home of their active role. */
export default function Index() {
  const { status, appRole, clinicId, logout } = useAuth();
  if (status !== 'signedIn') return <View style={{ flex: 1, backgroundColor: C.navy900 }} />;
  if (appRole === 'patient') return <Redirect href="/p/home" />;
  if (appRole === 'doctor') return <Redirect href="/dr/queue" />;
  if (appRole === 'clinic') return <Redirect href={clinicId ? '/console/queue' : '/k/select'} />;
  return (
    <View style={{ flex: 1, backgroundColor: C.navy900, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ color: C.white, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
        This account is for the Okidoc admin portal. Please use the web portal in a browser.
      </Text>
      <Button title="Log out" onPress={logout} style={{ marginTop: 20, alignSelf: 'stretch' }} />
    </View>
  );
}
