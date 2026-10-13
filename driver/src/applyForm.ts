// Driver application form: state, prefill and validation.
// The rules mirror the server (web/src/app/api/driver/apply/route.ts) so errors show before upload.
import type { Application } from './api';
import { ymdIST } from './format';
import type { PickedPhoto } from './photos';

export type ApplyForm = {
  name: string;
  address: string;
  emergencyContact: string;
  experienceYears: string;
  licenceNo: string;
  /** YYYY-MM-DD, or '' when not picked yet. */
  licenceExpiry: string;
  aadhaarLast4: string;
};

export type PhotoField = 'photo' | 'licencePhoto' | 'aadhaarPhoto';
/** Newly picked photos (sent with the form). */
export type NewPhotos = Record<PhotoField, PickedPhoto | null>;
/** Photos already on the server from an earlier application (server paths; kept unless replaced). */
export type ExistingPhotos = Record<PhotoField, string | null>;

export const STEPS = [
  { key: 'personal', label: 'Personal', title: 'Personal details' },
  { key: 'licence', label: 'Licence', title: 'Driving licence' },
  { key: 'identity', label: 'Identity', title: 'Identity & photo' },
  { key: 'review', label: 'Review', title: 'Review & submit' },
] as const;

export type Errors = Partial<Record<keyof ApplyForm | PhotoField | 'consent', string>>;

const PHONE = /^[6-9]\d{9}$/;

export function initialForm(app: Application | null, fallbackName: string): ApplyForm {
  return {
    name: app?.name ?? fallbackName ?? '',
    address: app?.address ?? '',
    emergencyContact: app?.emergencyContact ?? '',
    experienceYears: app?.experienceYears != null ? String(app.experienceYears) : '',
    licenceNo: app?.licenceNo ?? '',
    licenceExpiry: app?.licenceExpiry ? ymdIST(new Date(app.licenceExpiry)) : '',
    aadhaarLast4: app?.aadhaarLast4 ?? '',
  };
}

export const existingPhotos = (app: Application | null): ExistingPhotos => ({
  photo: app?.photoUrl ?? null,
  licencePhoto: app?.licencePhotoUrl ?? null,
  aadhaarPhoto: app?.aadhaarPhotoUrl ?? null,
});

/** Tomorrow's IST date: the earliest expiry the server accepts (a licence expiring today counts as expired). */
export const minExpiry = () => ymdIST(new Date(Date.now() + 86_400_000));

export const cleanLicence = (v: string) => v.toUpperCase().replace(/[^A-Z0-9 -]/g, '');

export function validateStep(step: number, f: ApplyForm, photos: NewPhotos, existing: ExistingPhotos, consent = false): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (f.name.trim().length < 2) e.name = 'Enter your full name';
    if (f.address.trim().length < 5) e.address = 'Enter your address';
    const yrs = f.experienceYears.trim();
    if (!/^\d{1,2}$/.test(yrs) || Number(yrs) > 50) e.experienceYears = 'Enter your years of driving experience (0 to 50)';
    if (f.emergencyContact && !PHONE.test(f.emergencyContact)) e.emergencyContact = 'Enter a valid 10-digit mobile number';
  }
  if (step === 1) {
    if (f.licenceNo.trim().length < 8) e.licenceNo = 'Enter your driving licence number';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.licenceExpiry)) e.licenceExpiry = 'Enter the licence expiry date';
    else if (f.licenceExpiry < minExpiry()) e.licenceExpiry = 'Your driving licence has expired.';
    if (!photos.licencePhoto && !existing.licencePhoto) e.licencePhoto = 'Please add a photo of your driving licence.';
  }
  if (step === 2) {
    if (f.aadhaarLast4 && !/^\d{4}$/.test(f.aadhaarLast4)) e.aadhaarLast4 = 'Enter the last 4 digits of your Aadhaar';
    if (!photos.photo && !existing.photo) e.photo = 'Please add your photo.';
  }
  if (step === 3) {
    if (!consent) e.consent = 'Please confirm the details to submit.';
  }
  return e;
}

/** First step (0..2) with an error, or -1 when every step is valid. */
export function firstInvalidStep(f: ApplyForm, photos: NewPhotos, existing: ExistingPhotos) {
  for (let i = 0; i < 3; i++) if (Object.keys(validateStep(i, f, photos, existing)).length) return i;
  return -1;
}

/** Which step a server error message belongs to, so the form can jump there. */
export function stepForServerError(message: string) {
  const m = message.toLowerCase();
  if (/licen[cs]e/.test(m)) return 1;
  if (/aadhaar|your photo|add your photo/.test(m)) return 2;
  if (/name|address|mobile|experience|expected number/.test(m)) return 0;
  return -1;
}

export function buildFormData(f: ApplyForm, photos: NewPhotos) {
  const fd = new FormData();
  fd.append('name', f.name.trim());
  fd.append('address', f.address.trim());
  fd.append('experienceYears', String(Number(f.experienceYears.trim())));
  fd.append('emergencyContact', f.emergencyContact.trim());
  fd.append('licenceNo', f.licenceNo.trim().toUpperCase());
  fd.append('licenceExpiry', f.licenceExpiry);
  fd.append('aadhaarLast4', f.aadhaarLast4.trim());
  // React Native's FormData takes { uri, name, type } file objects. Photos not re-picked are left out,
  // and the server keeps the files from the earlier application.
  (Object.keys(photos) as PhotoField[]).forEach((k) => {
    const p = photos[k];
    if (p) fd.append(k, { uri: p.uri, name: p.name, type: p.type } as unknown as Blob);
  });
  return fd;
}
