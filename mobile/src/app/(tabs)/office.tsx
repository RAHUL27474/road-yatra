import { Redirect } from 'expo-router';

/**
 * "Office" tab, shown to ADMIN accounts only. Pressing the tab opens the admin stack (see the tab listener in
 * _layout.tsx); this screen only renders if the tab is reached another way, and then hands over to /admin.
 */
export default function OfficeTab() {
  return <Redirect href="/admin" />;
}
