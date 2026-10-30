import { useEffect, useState } from 'react';
import { View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { getConfig } from './api';
import { inr } from './format';
import { colors, space } from './theme';
import { Button, Sheet, T } from './ui';

/** The office UPI ID and payee name from /api/config, or null when none is set (or the config could not load). */
export function useOfficeUpi() {
  const [upi, setUpi] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => {
    getConfig().then(
      (c) => setUpi(c.upiId ? { id: c.upiId, name: c.upiName || c.brandName } : null),
      () => {},
    );
  }, []);
  return upi;
}

export type UpiRequest = { name: string; amount: number; code: string };

/**
 * A QR the passenger scans with any UPI app to pay the office account, with the amount and booking code filled in.
 * "Payment received" records it as UPI (after the driver has seen the success screen).
 */
export function UpiQrSheet({
  upi,
  request,
  onClose,
  onReceived,
}: {
  upi: { id: string; name: string };
  request: UpiRequest | null;
  onClose: () => void;
  onReceived: () => void;
}) {
  const link = request
    ? `upi://pay?${new URLSearchParams({ pa: upi.id, pn: upi.name, am: request.amount.toFixed(2), cu: 'INR', tn: `Booking ${request.code}` }).toString()}`
    : '';
  return (
    <Sheet visible={!!request} title={request ? `Collect ${inr(request.amount)}` : ''} subtitle={request ? `${request.name} scans this with any UPI app` : undefined} icon="qr-code-outline" onClose={onClose}>
      {request ? (
        <View style={{ alignItems: 'center', gap: space.md }}>
          <View style={{ padding: space.md, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border }}>
            <QRCode value={link} size={220} color={colors.text} />
          </View>
          <T v="label" color={colors.textMuted} center>
            {upi.id} · note “{request.code}”{'\n'}Check the passenger's success screen before you tap below.
          </T>
          <Button title="Payment received by UPI" icon="checkmark-circle" variant="success" onPress={onReceived} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : null}
    </Sheet>
  );
}
