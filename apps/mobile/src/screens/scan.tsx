import { useIsFocused } from '@react-navigation/native';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import { CodeScanner } from 'react-native-vision-camera-barcode-scanner';
import { Button, Input, Screen, T } from '@/components/ui';
import { router } from '@/lib/nav';
import { C } from '@/lib/theme';

/** Extract an Okidoc clinic code from a poster QR (URL, deep link or bare code). */
export const clinicCodeFrom = (data: string) => data.toUpperCase().match(/OK-[A-Z0-9]{5}/)?.[0] ?? null;

/** PAT-03 QR scan → clinic page (VisionCamera + ML Kit barcode scanner). */
export default function Scan() {
  const { hasPermission, requestPermission, canRequestPermission } = useCameraPermission();
  const focused = useIsFocused();
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  const open = (code: string) => {
    if (handled.current) return;
    handled.current = true;
    router.replace(`/clinic/${code}`);
  };

  return (
    <Screen back tabs={false} title="Scan clinic QR" subtitle="Point at the Okidoc poster at the clinic desk">
      {!hasPermission ? (
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <T variant="muted" style={{ textAlign: 'center', marginBottom: 12 }}>
            {canRequestPermission ? 'Okidoc needs camera access to scan the clinic QR code.' : 'Camera access is off. Enable it for Okidoc in your phone Settings.'}
          </T>
          {canRequestPermission && <Button title="Allow camera" onPress={() => requestPermission()} />}
        </View>
      ) : (
        <View style={{ height: 360, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' }}>
          <CodeScanner
            style={{ flex: 1 }}
            isActive={focused && !handled.current}
            barcodeFormats={['qr-code']}
            onBarcodeScanned={(codes) => {
              for (const c of codes) {
                const code = clinicCodeFrom(c.rawValue ?? c.displayValue ?? '');
                if (code) return open(code);
              }
            }}
            onError={(e) => setError(String((e as Error)?.message ?? e))}
          />
          <View pointerEvents="none" style={{ position: 'absolute', top: 70, left: 60, right: 60, bottom: 70, borderWidth: 3, borderColor: C.tealGlow, borderRadius: 20 }} />
        </View>
      )}
      {!!error && <T color={C.bad}>{error}</T>}
      <Text style={{ color: C.muted, marginVertical: 14, textAlign: 'center' }}>or enter the clinic code</Text>
      <Input value={manual} onChangeText={setManual} placeholder="OK-XXXXX" autoCapitalize="characters" />
      <Button title="Open clinic" disabled={!clinicCodeFrom(manual)} onPress={() => open(clinicCodeFrom(manual)!)} />
    </Screen>
  );
}
