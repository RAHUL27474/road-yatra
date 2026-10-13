import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { fmtDateShort, fmtTime, relativeDay, ymdIST } from './format';
import { colors, spacing, tabular, type } from './theme';
import { IonName } from './ui';

const IST_TZ = 'Asia/Kolkata';

/** Keeps the IST date of `day` and the IST time of `time`. */
const combine = (day: Date, time: Date) => new Date(`${ymdIST(day)}T${fmtTime(time)}:00+05:30`);

/** Opens the native Android date (and then time) dialogs. Exported so other rows can trigger it. */
export function openAndroidPicker({
  value,
  onChange,
  mode,
  minimumDate,
}: {
  value: Date;
  onChange: (d: Date) => void;
  mode: 'date' | 'datetime';
  minimumDate?: Date;
}) {
  DateTimePickerAndroid.open({
    value,
    mode: 'date',
    minimumDate,
    timeZoneName: IST_TZ,
    onValueChange: (_e, day) => {
      if (mode === 'date') return onChange(combine(day, value));
      DateTimePickerAndroid.open({
        value: combine(day, value),
        mode: 'time',
        is24Hour: true,
        timeZoneName: IST_TZ,
        onValueChange: (_e2, t) => onChange(t),
      });
    },
  });
}

/**
 * Date or date+time field in the search-card style: small caps caption, the date large, the time beside it.
 * Android opens the native dialogs (date, then time); iOS shows the compact inline picker.
 * All values are picked in IST. (The web preview build only displays the value.)
 */
export function DateTimeField({
  label,
  value,
  onChange,
  mode,
  minimumDate,
  icon = 'calendar-outline',
  style,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  mode: 'date' | 'datetime';
  minimumDate?: Date;
  icon?: IonName;
  style?: StyleProp<ViewStyle>;
}) {
  const caption = (
    <Text style={[type('xs', 'semibold', colors.textMuted), { letterSpacing: 0.6 }]} numberOfLines={1}>
      {label.toUpperCase()}
    </Text>
  );
  if (Platform.OS === 'ios') {
    return (
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm }, style]}>
        <View style={{ flex: 1 }}>{caption}</View>
        <View style={{ marginRight: -spacing.sm }}>
          <DateTimePicker
            value={value}
            mode={mode}
            display="compact"
            minimumDate={minimumDate}
            minuteInterval={15}
            timeZoneName={IST_TZ}
            accentColor={colors.brand}
            onValueChange={(_e, d) => onChange(mode === 'date' ? combine(d, value) : d)}
          />
        </View>
      </View>
    );
  }
  return (
    <Pressable
      onPress={Platform.OS === 'android' ? () => openAndroidPicker({ value, onChange, mode, minimumDate }) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${fmtDateShort(value)}${mode === 'datetime' ? ' ' + fmtTime(value) : ''}`}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm }, pressed && { opacity: 0.7 }, style]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {caption}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: 2 }}>
          <Text style={[type('xl', 'extrabold'), { letterSpacing: -0.3 }]} numberOfLines={1}>
            {fmtDateShort(value)}
          </Text>
          {mode === 'datetime' ? (
            <Text style={[type('md', 'bold', colors.brand), tabular]}>{fmtTime(value)}</Text>
          ) : (
            <Text style={type('xs', 'medium', colors.textMuted)}>{relativeDay(ymdIST(value))}</Text>
          )}
        </View>
      </View>
      <Ionicons name={icon} size={22} color={colors.brand} />
    </Pressable>
  );
}
