import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ApiError, errorMessage, fileSource, uploadForm } from '../api';
import {
  ApplyForm,
  buildFormData,
  cleanLicence,
  Errors,
  existingPhotos,
  firstInvalidStep,
  initialForm,
  minExpiry,
  NewPhotos,
  PhotoField,
  stepForServerError,
  STEPS,
  validateStep,
} from '../applyForm';
import { useAuth } from '../auth';
import { fmtYmd } from '../format';
import { pickPhoto } from '../photos';
import { colors, fonts, radius, shadow, space } from '../theme';
import {
  Badge,
  BottomBar,
  Button,
  Card,
  confirm,
  Field,
  haptic,
  Header,
  IconButton,
  IconName,
  Ionicons,
  MaterialCommunityIcons,
  Notice,
  Sheet,
  showError,
  T,
} from '../ui';

const PHOTO_INFO: Record<PhotoField, { title: string; hint: string; icon: IconName; selfie?: boolean }> = {
  licencePhoto: { title: 'Licence photo', hint: 'Front side, all text readable, no glare', icon: 'card-outline' },
  aadhaarPhoto: { title: 'Aadhaar photo', hint: 'Optional. You can mask the first 8 digits', icon: 'finger-print-outline' },
  photo: { title: 'Your photo', hint: 'A clear selfie: face the camera, good light, no sunglasses', icon: 'person-circle-outline', selfie: true },
};

const ymdToDate = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const dateToYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Apply() {
  const { user, application, access, refreshAccess, logout } = useAuth();
  // Re-applying after a rejection prefills everything from the earlier application.
  // Captured once, so the screen doesn't change while it closes after submitting.
  const [prior] = useState(() => (access === 'rejected' ? application : null));
  const existing = useMemo(() => existingPhotos(prior), [prior]);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ApplyForm>(() => initialForm(prior, user?.name ?? ''));
  const [photos, setPhotos] = useState<NewPhotos>({ photo: null, licencePhoto: null, aadhaarPhoto: null });
  const [errors, setErrors] = useState<Errors>({});
  const [consent, setConsent] = useState(false);
  const [iosDateOpen, setIosDateOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const scroll = useRef<ScrollView>(null);
  const submitting = progress !== null;

  const set = <K extends keyof ApplyForm>(k: K, v: ApplyForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const goStep = (n: number) => {
    setStep(n);
    setErrors({});
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: 0, animated: false }));
  };

  const back = () => {
    if (submitting) return true;
    if (step > 0) {
      goStep(step - 1);
      return true;
    }
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    return false;
  };

  // Android back button: previous step first.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  });

  const next = () => {
    const e = validateStep(step, form, photos, existing);
    setErrors(e);
    if (Object.keys(e).length) {
      haptic.warning();
      return;
    }
    goStep(step + 1);
  };

  const choosePhoto = async (k: PhotoField) => {
    try {
      const info = PHOTO_INFO[k];
      const p = await pickPhoto({ field: k, title: info.title, message: info.hint, selfie: info.selfie });
      if (!p) return;
      setPhotos((ph) => ({ ...ph, [k]: p }));
      setErrors((e) => ({ ...e, [k]: undefined }));
      haptic.success();
    } catch (e) {
      showError(e, 'Could not add the photo');
    }
  };

  const openDate = () => {
    const value = form.licenceExpiry ? ymdToDate(form.licenceExpiry) : ymdToDate(minExpiry());
    const minimumDate = ymdToDate(minExpiry());
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: value < minimumDate ? minimumDate : value,
        mode: 'date',
        minimumDate,
        maximumDate: new Date(new Date().getFullYear() + 40, 11, 31),
        onValueChange: (_e, d) => set('licenceExpiry', dateToYmd(d)),
      });
    } else setIosDateOpen(true);
  };

  const submit = async () => {
    const bad = firstInvalidStep(form, photos, existing);
    if (bad >= 0) {
      goStep(bad);
      setErrors(validateStep(bad, form, photos, existing));
      haptic.warning();
      return;
    }
    const e = validateStep(3, form, photos, existing, consent);
    setErrors(e);
    if (Object.keys(e).length) {
      haptic.warning();
      return;
    }
    setProgress(0);
    try {
      await uploadForm<{ status: string }>('/api/driver/apply', buildFormData(form, photos), setProgress);
      setProgress(1);
      haptic.success();
      // Status is now PENDING: the guards in _layout move straight to the Under-review screen.
      const now = await refreshAccess().catch(() => null);
      if (now !== 'pending') setProgress(null);
    } catch (err) {
      setProgress(null);
      // Already submitted elsewhere, or approved meanwhile: just re-route.
      if (err instanceof ApiError && /already/i.test(err.message)) {
        await refreshAccess().catch(() => {});
        return;
      }
      const s = stepForServerError(errorMessage(err));
      if (s >= 0) goStep(s);
      showError(err, 'Application not sent');
    }
  };

  const rightAction =
    access === 'apply' ? (
      <IconButton icon="log-out-outline" tone="neutral" size={44} label="Log out" onPress={() => confirm('Log out?', 'Your answers on this form will be lost.', 'Log out', () => logout().catch(showError), true)} style={{ backgroundColor: 'rgba(255,255,255,0.16)' }} />
    ) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={prior ? 'Fix and re-apply' : 'Apply to drive'}
        subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step].title}`}
        back={step > 0 || router.canGoBack()}
        onBack={() => back()}
        right={rightAction}
      >
        <Stepper step={step} onPress={(i) => i < step && !submitting && goStep(i)} />
      </Header>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              {prior?.rejectReason ? <Notice tone="danger" icon="alert-circle" text={`Office note: ${prior.rejectReason}`} style={{ marginBottom: space.lg }} /> : null}
              <Card>
                <StepIntro icon="person-outline" text="Tell us about yourself. Use your name exactly as it is on your driving licence." />
                <Field label="Full name" icon="person-outline" value={form.name} onChangeText={(v) => set('name', v)} autoCapitalize="words" autoComplete="name" maxLength={80} placeholder="e.g. Ramesh Kumar" />
                <FieldError text={errors.name} />
                <Field
                  label="Address"
                  icon="home-outline"
                  value={form.address}
                  onChangeText={(v) => set('address', v)}
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                  placeholder="House no., street, village / town, district, PIN"
                  style={{ fontSize: 17, minHeight: 88, textAlignVertical: 'top' }}
                />
                <FieldError text={errors.address} />
                <Field
                  label="Driving experience (years)"
                  icon="speedometer-outline"
                  value={form.experienceYears}
                  onChangeText={(v) => set('experienceYears', v.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="e.g. 5"
                />
                <FieldError text={errors.experienceYears} />
                <Field
                  label="Emergency contact (optional)"
                  prefix="+91"
                  value={form.emergencyContact}
                  onChangeText={(v) => set('emergencyContact', v.replace(/\D/g, '').slice(-10))}
                  keyboardType="phone-pad"
                  maxLength={10}
                  placeholder="Family member's mobile"
                />
                <FieldError text={errors.emergencyContact} last />
              </Card>
            </>
          )}

          {step === 1 && (
            <Card>
              <StepIntro icon="card-outline" text="We verify every licence with the transport department before approval." />
              <Field
                label="Driving licence number"
                icon="card-outline"
                value={form.licenceNo}
                onChangeText={(v) => set('licenceNo', cleanLicence(v))}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
                placeholder="e.g. UK0620210012345"
                style={{ fontFamily: fonts.mono, fontWeight: '700', letterSpacing: 1 }}
              />
              <FieldError text={errors.licenceNo} />

              <T v="label" color={colors.textMuted} style={{ marginBottom: space.sm }}>
                Licence valid till
              </T>
              <Pressable
                onPress={openDate}
                accessibilityRole="button"
                accessibilityLabel="Licence expiry date"
                style={({ pressed }) => [st.dateBox, errors.licenceExpiry ? { borderColor: colors.danger } : null, pressed && { borderColor: colors.brand }]}
              >
                <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
                <T style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 20, color: form.licenceExpiry ? colors.text : '#94A3B8' }}>
                  {form.licenceExpiry ? fmtYmd(form.licenceExpiry) : 'Pick the expiry date'}
                </T>
                <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
              </Pressable>
              <FieldError text={errors.licenceExpiry} />
              <View style={{ height: space.lg }} />

              <PhotoSlot k="licencePhoto" picked={photos.licencePhoto?.uri} existing={existing.licencePhoto} error={errors.licencePhoto} onPick={choosePhoto} aspect={1.6} />
            </Card>
          )}

          {step === 2 && (
            <>
              <Card>
                <StepIntro icon="camera-outline" text="Passengers see your photo when you are assigned to their trip." />
                <PhotoSlot k="photo" picked={photos.photo?.uri} existing={existing.photo} error={errors.photo} onPick={choosePhoto} round />
              </Card>
              <Card style={{ marginTop: space.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
                  <T v="h2" style={{ flex: 1 }}>
                    Aadhaar
                  </T>
                  <Badge label="Optional" tone="neutral" />
                </View>
                <Field
                  label="Last 4 digits of Aadhaar"
                  icon="finger-print-outline"
                  value={form.aadhaarLast4}
                  onChangeText={(v) => set('aadhaarLast4', v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="1234"
                  style={{ letterSpacing: 6, fontFamily: fonts.bold }}
                />
                <FieldError text={errors.aadhaarLast4} />
                <PhotoSlot
                  k="aadhaarPhoto"
                  picked={photos.aadhaarPhoto?.uri}
                  existing={existing.aadhaarPhoto}
                  onPick={choosePhoto}
                  onRemove={photos.aadhaarPhoto ? () => setPhotos((p) => ({ ...p, aadhaarPhoto: null })) : undefined}
                  aspect={1.6}
                />
              </Card>
            </>
          )}

          {step === 3 && (
            <>
              <ReviewCard title="Personal details" icon="person-outline" onEdit={() => goStep(0)}>
                <ReviewRow label="Full name" value={form.name.trim()} />
                <ReviewRow label="Mobile" value={user?.phone ? `+91 ${user.phone}` : '—'} />
                <ReviewRow label="Address" value={form.address.trim()} />
                <ReviewRow label="Experience" value={`${Number(form.experienceYears) || 0} year${Number(form.experienceYears) === 1 ? '' : 's'}`} />
                <ReviewRow label="Emergency contact" value={form.emergencyContact ? `+91 ${form.emergencyContact}` : 'Not added'} />
              </ReviewCard>
              <ReviewCard title="Driving licence" icon="card-outline" onEdit={() => goStep(1)}>
                <ReviewRow label="Licence no." value={form.licenceNo.trim()} mono />
                <ReviewRow label="Valid till" value={form.licenceExpiry ? fmtYmd(form.licenceExpiry) : '—'} />
                <Thumbs items={[{ label: 'Licence', uri: photos.licencePhoto?.uri, path: existing.licencePhoto }]} />
              </ReviewCard>
              <ReviewCard title="Identity & photo" icon="camera-outline" onEdit={() => goStep(2)}>
                <ReviewRow label="Aadhaar" value={form.aadhaarLast4 ? `XXXX XXXX ${form.aadhaarLast4}` : 'Not added'} />
                <Thumbs
                  items={[
                    { label: 'Your photo', uri: photos.photo?.uri, path: existing.photo, round: true },
                    { label: 'Aadhaar', uri: photos.aadhaarPhoto?.uri, path: existing.aadhaarPhoto },
                  ]}
                />
              </ReviewCard>

              <Pressable
                onPress={() => {
                  haptic.tap();
                  setConsent((c) => !c);
                  setErrors((e) => ({ ...e, consent: undefined }));
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                style={[st.consent, errors.consent ? { borderColor: colors.danger } : consent ? { borderColor: colors.brand } : null]}
              >
                <View style={[st.checkbox, consent && { backgroundColor: colors.brand, borderColor: colors.brand }]}>{consent ? <Ionicons name="checkmark" size={20} color={colors.white} /> : null}</View>
                <T v="body" style={{ flex: 1 }}>
                  I confirm the details are correct and agree to background verification.
                </T>
              </Pressable>
              <FieldError text={errors.consent} />
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.md, paddingHorizontal: space.xs }}>
                <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                <T v="caption" color={colors.textMuted} style={{ flex: 1 }}>
                  Your licence and Aadhaar photos are only seen by the Road Yatra office.
                </T>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomBar>
        {step < 3 ? (
          <Button title={step === 2 ? 'Review application' : 'Continue'} icon="arrow-forward" onPress={next} />
        ) : (
          <Button title={prior ? 'Re-submit application' : 'Submit application'} icon="paper-plane-outline" variant="success" onPress={submit} loading={submitting} />
        )}
      </BottomBar>

      {/* iOS: inline calendar in a sheet. Android uses the native dialog (DateTimePickerAndroid). */}
      {Platform.OS === 'ios' ? (
        <Sheet visible={iosDateOpen} title="Licence valid till" icon="calendar-outline" onClose={() => setIosDateOpen(false)}>
          <DateTimePicker
            value={form.licenceExpiry ? ymdToDate(form.licenceExpiry) : ymdToDate(minExpiry())}
            mode="date"
            display="inline"
            minimumDate={ymdToDate(minExpiry())}
            onValueChange={(_e, d) => set('licenceExpiry', dateToYmd(d))}
          />
          <Button title="Done" onPress={() => setIosDateOpen(false)} style={{ marginTop: space.md }} />
        </Sheet>
      ) : null}

      <UploadOverlay progress={progress} />
    </View>
  );
}

// ---------------------------------------------------------------- pieces

function Stepper({ step, onPress }: { step: number; onPress: (i: number) => void }) {
  return (
    <View style={st.stepper} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: STEPS.length, now: step + 1 }}>
      {STEPS.map((s, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <View key={s.key} style={{ flex: 1, alignItems: 'center' }}>
            {i > 0 ? <View style={[st.stepLine, { right: '50%' }, (done || current) && { backgroundColor: colors.white }]} /> : null}
            <Pressable
              onPress={() => onPress(i)}
              disabled={!done}
              hitSlop={8}
              accessibilityLabel={`Step ${i + 1}: ${s.label}${done ? ', done' : current ? ', current' : ''}`}
              style={[st.stepDot, done && { backgroundColor: colors.white, borderColor: colors.white }, current && { backgroundColor: colors.white, borderColor: colors.white, transform: [{ scale: 1.1 }] }]}
            >
              {done ? (
                <Ionicons name="checkmark" size={18} color={colors.brand} />
              ) : (
                <T style={{ fontFamily: fonts.bold, fontSize: 15, color: current ? colors.brand : colors.onBrandMuted }}>{i + 1}</T>
              )}
            </Pressable>
            <T v="caption" color={current ? colors.onBrand : colors.onBrandMuted} style={[{ marginTop: 6 }, current && { fontFamily: fonts.bold }]}>
              {s.label}
            </T>
          </View>
        );
      })}
    </View>
  );
}

function StepIntro({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center', marginBottom: space.lg }}>
      <View style={st.introIcon}>
        <Ionicons name={icon} size={22} color={colors.brand} />
      </View>
      <T v="label" color={colors.textMuted} style={{ flex: 1, fontFamily: fonts.medium }}>
        {text}
      </T>
    </View>
  );
}

function FieldError({ text, last }: { text?: string; last?: boolean }) {
  if (!text) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: -space.sm, marginBottom: last ? 0 : space.lg }}>
      <Ionicons name="alert-circle" size={16} color={colors.danger} />
      <T v="label" color={colors.danger} style={{ flex: 1 }}>
        {text}
      </T>
    </View>
  );
}

/** Empty "add photo" box, or the preview with Retake (and Remove for optional photos). */
function PhotoSlot({
  k,
  picked,
  existing,
  error,
  onPick,
  onRemove,
  round,
  aspect = 1.4,
}: {
  k: PhotoField;
  picked?: string;
  existing: string | null;
  error?: string;
  onPick: (k: PhotoField) => void;
  onRemove?: () => void;
  round?: boolean;
  aspect?: number;
}) {
  const info = PHOTO_INFO[k];
  const source = picked ? { uri: picked } : fileSource(existing);
  const label = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm }}>
      <T v="label" color={colors.textMuted} style={{ flex: 1 }}>
        {info.title}
      </T>
      {picked ? <Badge label="New" tone="brand" icon="sparkles-outline" /> : existing ? <Badge label="Uploaded earlier" tone="success" icon="cloud-done-outline" /> : null}
    </View>
  );

  if (!source) {
    return (
      <View>
        {label}
        <Pressable
          onPress={() => onPick(k)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${info.title.toLowerCase()}`}
          style={({ pressed }) => [st.photoEmpty, round && { aspectRatio: undefined, paddingVertical: space.xxl }, !round && { aspectRatio: aspect }, error ? { borderColor: colors.danger, backgroundColor: colors.dangerLight } : null, pressed && { backgroundColor: colors.brandLight }]}
        >
          <View style={[st.photoEmptyIcon, round && { width: 96, height: 96, borderRadius: 48 }]}>
            <Ionicons name={round ? 'happy-outline' : 'camera-outline'} size={round ? 44 : 30} color={colors.brand} />
          </View>
          <T v="bodyStrong" color={colors.brand} style={{ marginTop: space.md }}>
            {round ? 'Take a selfie' : 'Add photo'}
          </T>
          <T v="caption" color={colors.textMuted} center style={{ marginTop: 4, paddingHorizontal: space.lg }}>
            {info.hint}
          </T>
        </Pressable>
        <View style={{ height: space.sm }} />
        <FieldError text={error} last />
      </View>
    );
  }

  return (
    <View>
      {label}
      <View style={[st.photoFilled, round && { alignItems: 'center', paddingVertical: space.lg }]}>
        <Image
          source={source}
          resizeMode="cover"
          style={round ? { width: 160, height: 160, borderRadius: 80, backgroundColor: colors.border } : { width: '100%', aspectRatio: aspect, borderRadius: radius.input, backgroundColor: colors.border }}
          accessibilityLabel={info.title}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        <Button title={picked ? 'Retake' : 'Replace'} icon="camera-reverse-outline" variant="outline" small onPress={() => onPick(k)} style={{ flex: 1 }} />
        {onRemove ? <Button title="Remove" icon="trash-outline" variant="outlineDanger" small onPress={onRemove} style={{ flex: 1 }} /> : null}
      </View>
      {existing && !picked ? (
        <T v="caption" color={colors.textMuted} style={{ marginTop: space.sm }}>
          Already uploaded. Replace it only if you want to change it.
        </T>
      ) : null}
      <View style={{ height: space.sm }} />
      <FieldError text={error} last />
    </View>
  );
}

function ReviewCard({ title, icon, onEdit, children }: { title: string; icon: IconName; onEdit: () => void; children: ReactNode }) {
  return (
    <Card padded={false} style={{ marginBottom: space.lg, overflow: 'hidden' }}>
      <View style={st.reviewTop}>
        <Ionicons name={icon} size={20} color={colors.brand} />
        <T v="overline" color={colors.brand} style={{ flex: 1 }}>
          {title}
        </T>
        <Pressable onPress={onEdit} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Edit ${title}`} style={({ pressed }) => [st.editBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="create-outline" size={16} color={colors.brand} />
          <T v="label" color={colors.brand} style={{ fontFamily: fonts.bold }}>
            Edit
          </T>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: space.lg, paddingVertical: space.sm }}>{children}</View>
    </Card>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
      <T v="caption" color={colors.textMuted}>
        {label}
      </T>
      <T v="bodyStrong" style={[{ marginTop: 2 }, mono && { fontFamily: fonts.mono, fontWeight: '700', letterSpacing: 1 }]}>
        {value || '—'}
      </T>
    </View>
  );
}

function Thumbs({ items }: { items: { label: string; uri?: string; path: string | null; round?: boolean }[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md }}>
      {items.map((it) => {
        const source = it.uri ? { uri: it.uri } : fileSource(it.path);
        return (
          <View key={it.label} style={{ alignItems: 'center', gap: 6 }}>
            {source ? (
              <Image source={source} style={[st.thumb, it.round && { borderRadius: 36 }]} />
            ) : (
              <View style={[st.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="image-outline" size={24} color={colors.textMuted} />
              </View>
            )}
            <T v="caption" color={colors.textMuted}>
              {source ? it.label : `${it.label}: none`}
            </T>
          </View>
        );
      })}
    </View>
  );
}

function UploadOverlay({ progress }: { progress: number | null }) {
  const pct = Math.round((progress ?? 0) * 100);
  return (
    <Modal visible={progress !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={st.overlay}>
        <Card style={[{ width: '100%', maxWidth: 360, padding: space.xxl, alignItems: 'center' }, shadow.raised]}>
          <View style={st.uploadIcon}>
            <MaterialCommunityIcons name={pct >= 100 ? 'check-decagram' : 'cloud-upload-outline'} size={40} color={pct >= 100 ? colors.success : colors.brand} />
          </View>
          <T v="h2" center style={{ marginTop: space.lg }}>
            {pct >= 100 ? 'Finishing up…' : 'Sending your application'}
          </T>
          <T v="label" color={colors.textMuted} center style={{ marginTop: 4, fontFamily: fonts.medium }}>
            Uploading photos. Please keep the app open.
          </T>
          <View style={st.bar}>
            <View style={[st.barFill, { width: `${Math.max(4, pct)}%` }]} />
          </View>
          <T v="bodyStrong" color={colors.brand} style={{ marginTop: space.sm, fontVariant: ['tabular-nums'] }}>
            {pct}%
          </T>
        </Card>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  stepper: { flexDirection: 'row', marginTop: space.lg },
  stepLine: { position: 'absolute', top: 17, left: '-50%', height: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: colors.brandDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  dateBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 58,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.input,
    paddingHorizontal: space.md,
    backgroundColor: '#F8FAFC',
    marginBottom: space.sm,
  },
  photoEmpty: {
    width: '100%',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#93C5FD',
    borderRadius: radius.card,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.lg,
  },
  photoEmptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  photoFilled: { borderRadius: radius.card, backgroundColor: colors.background, padding: space.sm },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.brandLight, paddingHorizontal: space.lg, paddingVertical: space.md },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.white },
  thumb: { width: 72, height: 72, borderRadius: radius.input, backgroundColor: colors.border },
  consent: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: space.lg,
  },
  checkbox: { width: 28, height: 28, borderRadius: 6, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center', marginTop: -2 },
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: space.xxl },
  uploadIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.brandLight, alignItems: 'center', justifyContent: 'center' },
  bar: { alignSelf: 'stretch', height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: space.xl, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5, backgroundColor: colors.brand },
});
