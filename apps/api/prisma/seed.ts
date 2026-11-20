/* eslint-disable no-console */
/**
 * Okidoc seed — West Bengal pilot reference data + demo accounts (idempotent).
 *   npm run seed -w @okidoc/api
 *
 * Demo logins (local development only):
 *   Admin         9000000001 / admin@okidoc.local  ·  Admin@1234   (OTP 2FA code is printed in the API log)
 *   Clinic owner  9000000101  ·  Clinic@1234       (Sanjeevani Pharmacy Chamber)
 *   Queue manager 9000000111  ·  Queue@1234
 *   Doctor        9000000201  ·  Doctor@1234       (Dr. Ananya Ghosh)
 *   Patient       9000000301  ·  Patient@123       (Riya Das)
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();
const pw = (p: string) => hash(p, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const REGIONS: { district: string; areas: [string, string, string, number, number][] }[] = [
  {
    district: 'North 24 Parganas',
    areas: [
      ['Barasat', 'বারাসাত', '700124', 22.7224, 88.4804],
      ['Madhyamgram', 'মধ্যমগ্রাম', '700129', 22.6981, 88.4532],
      ['Dum Dum', 'দমদম', '700028', 22.6355, 88.4227],
      ['Barrackpore', 'ব্যারাকপুর', '700120', 22.7676, 88.3711],
      ['Habra', 'হাবড়া', '743263', 22.8323, 88.6297],
      ['Bongaon', 'বনগাঁ', '743235', 23.0466, 88.8204],
      ['Salt Lake', 'সল্টলেক', '700091', 22.5867, 88.4171],
    ],
  },
  {
    district: 'Kolkata',
    areas: [
      ['Shyambazar', 'শ্যামবাজার', '700004', 22.6016, 88.3727],
      ['Gariahat', 'গড়িয়াহাট', '700019', 22.5186, 88.3667],
      ['Behala', 'বেহালা', '700034', 22.4983, 88.3108],
      ['Park Circus', 'পার্ক সার্কাস', '700017', 22.5398, 88.3685],
    ],
  },
  {
    district: 'Nadia',
    areas: [
      ['Ranaghat', 'রানাঘাট', '741201', 23.1765, 88.5627],
      ['Krishnanagar', 'কৃষ্ণনগর', '741101', 23.4058, 88.4916],
      ['Kalyani', 'কল্যাণী', '741235', 22.9751, 88.4345],
    ],
  },
  {
    district: 'Howrah',
    areas: [
      ['Howrah', 'হাওড়া', '711101', 22.5958, 88.2636],
      ['Shibpur', 'শিবপুর', '711102', 22.5726, 88.3043],
    ],
  },
  {
    district: 'Hooghly',
    areas: [
      ['Chinsurah', 'চুঁচুড়া', '712101', 22.9012, 88.3899],
      ['Serampore', 'শ্রীরামপুর', '712201', 22.7505, 88.3406],
    ],
  },
  {
    district: 'South 24 Parganas',
    areas: [
      ['Sonarpur', 'সোনারপুর', '700150', 22.4429, 88.4319],
      ['Baruipur', 'বারুইপুর', '700144', 22.3567, 88.4325],
    ],
  },
];

const SPECIALTIES: { slug: string; name: string; patientName: string; nameBn: string; nameHi: string; icon: string; keywords: string[] }[] = [
  { slug: 'general-physician', name: 'General Physician', patientName: 'General doctor', nameBn: 'জেনারেল ফিজিশিয়ান', nameHi: 'सामान्य चिकित्सक', icon: 'stethoscope', keywords: ['fever', 'cold', 'cough', 'body ache', 'weakness', 'jor', 'jwor', 'জ্বর', 'কাশি', 'সর্দি', 'बुखार', 'खांसी', 'medicine', 'md'] },
  { slug: 'gynecology', name: 'Gynecology & Obstetrics', patientName: "Women's doctor", nameBn: 'স্ত্রীরোগ বিশেষজ্ঞ', nameHi: 'स्त्री रोग विशेषज्ञ', icon: 'female', keywords: ['pregnancy', 'period', 'periods', 'menstrual', 'pcos', 'pcod', 'white discharge', 'gynae', 'gyno', 'গর্ভাবস্থা', 'মাসিক', 'गर्भावस्था', 'माहवारी'] },
  { slug: 'pediatrics', name: 'Pediatrics', patientName: 'Child specialist', nameBn: 'শিশু বিশেষজ্ঞ', nameHi: 'बाल रोग विशेषज्ञ', icon: 'child', keywords: ['child', 'baby', 'kid', 'infant', 'vaccination', 'vaccine', 'শিশু', 'বাচ্চা', 'बच्चा', 'टीका'] },
  { slug: 'neurology', name: 'Neurology', patientName: 'Brain & nerves', nameBn: 'স্নায়ুরোগ বিশেষজ্ঞ', nameHi: 'न्यूरोलॉजी', icon: 'brain', keywords: ['headache', 'migraine', 'numbness', 'tingling', 'paralysis', 'dizziness', 'memory', 'মাথাব্যথা', 'মাথা ঘোরা', 'सिरदर्द', 'चक्कर'] },
  { slug: 'general-surgery', name: 'General Surgery', patientName: 'Surgery', nameBn: 'সার্জারি', nameHi: 'सर्जरी', icon: 'scalpel', keywords: ['hernia', 'piles', 'fissure', 'appendix', 'gallstone', 'lump', 'surgery', 'অর্শ', 'হার্নিয়া', 'बवासीर'] },
  { slug: 'oncology', name: 'Oncology', patientName: 'Cancer care', nameBn: 'ক্যান্সার বিশেষজ্ঞ', nameHi: 'कैंसर विशेषज्ञ', icon: 'ribbon', keywords: ['cancer', 'tumour', 'tumor', 'chemotherapy', 'chemo', 'ক্যান্সার', 'कैंसर'] },
  { slug: 'orthopedics', name: 'Orthopedics', patientName: 'Bone & joint', nameBn: 'হাড় ও জোড় বিশেষজ্ঞ', nameHi: 'हड्डी रोग विशेषज्ञ', icon: 'bone', keywords: ['back pain', 'knee pain', 'joint pain', 'fracture', 'arthritis', 'sprain', 'hor', 'কোমর ব্যথা', 'হাঁটু ব্যথা', 'জোড়ে ব্যথা', 'कमर दर्द', 'घुटने'] },
  { slug: 'dermatology', name: 'Dermatology', patientName: 'Skin & hair', nameBn: 'চর্মরোগ বিশেষজ্ঞ', nameHi: 'त्वचा रोग विशेषज्ञ', icon: 'skin', keywords: ['rash', 'itching', 'acne', 'pimples', 'hair fall', 'dandruff', 'eczema', 'চুলকানি', 'ব্রণ', 'চুল পড়া', 'खुजली', 'मुंहासे'] },
  { slug: 'ent', name: 'ENT', patientName: 'Ear, nose & throat', nameBn: 'নাক-কান-গলা বিশেষজ্ঞ', nameHi: 'नाक-कान-गला', icon: 'ear', keywords: ['ear pain', 'sore throat', 'tonsil', 'sinus', 'hearing', 'nose block', 'কান ব্যথা', 'গলা ব্যথা', 'कान दर्द', 'गले में दर्द'] },
  { slug: 'ophthalmology', name: 'Ophthalmology', patientName: 'Eye doctor', nameBn: 'চক্ষু বিশেষজ্ঞ', nameHi: 'नेत्र रोग विशेषज्ञ', icon: 'eye', keywords: ['eye', 'vision', 'blurry', 'cataract', 'red eye', 'spectacles', 'চোখ', 'छानि', 'आँख'] },
  { slug: 'dentistry', name: 'Dentistry', patientName: 'Dentist', nameBn: 'দন্ত চিকিৎসক', nameHi: 'दंत चिकित्सक', icon: 'tooth', keywords: ['tooth', 'teeth', 'toothache', 'gum', 'cavity', 'dental', 'দাঁত', 'दांत'] },
  { slug: 'cardiology', name: 'Cardiology', patientName: 'Heart specialist', nameBn: 'হৃদরোগ বিশেষজ্ঞ', nameHi: 'हृदय रोग विशेषज्ञ', icon: 'heart', keywords: ['heart', 'palpitation', 'blood pressure', 'bp', 'hypertension', 'hriday', 'dil', 'হার্ট', 'প্রেসার', 'दिल', 'बीपी'] },
  { slug: 'gastroenterology', name: 'Gastroenterology', patientName: 'Stomach & liver', nameBn: 'পেটের রোগ বিশেষজ্ঞ', nameHi: 'पेट रोग विशेषज्ञ', icon: 'stomach', keywords: ['stomach', 'acidity', 'gas', 'vomiting', 'diarrhoea', 'loose motion', 'constipation', 'liver', 'jaundice', 'পেট ব্যথা', 'অম্বল', 'পেটখারাপ', 'पेट दर्द', 'एसिडिटी'] },
  { slug: 'psychiatry', name: 'Psychiatry', patientName: 'Mind & mood', nameBn: 'মনোরোগ বিশেষজ্ঞ', nameHi: 'मनोचिकित्सक', icon: 'mind', keywords: ['anxiety', 'depression', 'stress', 'sleep', 'insomnia', 'panic', 'দুশ্চিন্তা', 'ঘুম', 'तनाव', 'नींद'] },
  { slug: 'pulmonology', name: 'Pulmonology', patientName: 'Chest & lungs', nameBn: 'বক্ষরোগ বিশেষজ্ঞ', nameHi: 'फेफड़ा रोग विशेषज्ञ', icon: 'lungs', keywords: ['asthma', 'wheezing', 'breathlessness', 'tb', 'tuberculosis', 'chronic cough', 'হাঁপানি', 'दमा'] },
  { slug: 'endocrinology', name: 'Endocrinology', patientName: 'Diabetes & thyroid', nameBn: 'ডায়াবেটিস ও থাইরয়েড', nameHi: 'मधुमेह व थायराइड', icon: 'drop', keywords: ['diabetes', 'sugar', 'thyroid', 'hormone', 'ডায়াবেটিস', 'সুগার', 'থাইরয়েড', 'शुगर', 'थायराइड'] },
  { slug: 'urology', name: 'Urology', patientName: 'Urine & kidney stones', nameBn: 'মূত্ররোগ বিশেষজ্ঞ', nameHi: 'मूत्र रोग विशेषज्ञ', icon: 'kidney', keywords: ['urine', 'burning urine', 'kidney stone', 'prostate', 'প্রস্রাব', 'पेशाब'] },
];

const FREE_FEATURES = {
  ONLINE_BOOKING: true,
  WALK_IN: true,
  QUEUE_MANAGER: true,
  RECORDS: true,
  EARNINGS: true,
  PAYMENT_ONLINE_BOOKING_FEE: false,
  PAYMENT_ONLINE_FULL: false,
  WHATSAPP: true,
  DOCTORS_POSTER: true,
  OPEN_SLOTS: true,
  BONUSES: true,
  WEB_CONSOLE: true,
};

/** SEED_DEMO=false (production): reference data + an admin from ADMIN_PHONE / ADMIN_PASSWORD, no demo accounts. */
const DEMO = process.env.SEED_DEMO !== 'false';

async function main() {
  console.log(`Seeding Okidoc (West Bengal pilot)${DEMO ? ' with demo accounts' : ' — reference data only'}…`);

  // ---------------- geography
  const areaIds: Record<string, string> = {};
  for (const r of REGIONS) {
    const region = await prisma.region.upsert({
      where: { state_district: { state: 'West Bengal', district: r.district } },
      create: { state: 'West Bengal', district: r.district, name: r.district },
      update: {},
    });
    for (const [name, nameBn, pin, lat, lng] of r.areas) {
      const existing = await prisma.area.findFirst({ where: { regionId: region.id, name } });
      const a = existing ?? (await prisma.area.create({ data: { regionId: region.id, name, nameBn, pin, lat, lng } }));
      areaIds[name] = a.id;
    }
  }

  // ---------------- specialties
  const spec: Record<string, string> = {};
  for (const [i, s] of SPECIALTIES.entries()) {
    const row = await prisma.specialty.upsert({ where: { slug: s.slug }, create: { ...s, sortOrder: i }, update: { ...s, sortOrder: i } });
    spec[s.slug] = row.id;
  }

  // ---------------- plans & platform configuration
  await prisma.plan.upsert({
    where: { code: 'FREE' },
    create: { code: 'FREE', name: 'Free', priceMonthlyPaise: 0, features: FREE_FEATURES, limits: { MAX_DOCTORS: 15, MAX_SITTINGS: 60, MAX_QUEUE_MANAGERS: 2 }, sortOrder: 0 },
    update: {},
  });
  await prisma.plan.upsert({
    where: { code: 'STANDARD' },
    create: { code: 'STANDARD', name: 'Standard', priceMonthlyPaise: 49900, priceYearlyPaise: 499900, trialDays: 30, features: { ...FREE_FEATURES, PAYMENT_ONLINE_BOOKING_FEE: true }, limits: { MAX_DOCTORS: 30, MAX_SITTINGS: 150, MAX_QUEUE_MANAGERS: 5 }, sortOrder: 1 },
    update: {},
  });
  await prisma.plan.upsert({
    where: { code: 'PRO' },
    create: { code: 'PRO', name: 'Pro', priceMonthlyPaise: 99900, priceYearlyPaise: 999900, trialDays: 30, features: { ...FREE_FEATURES, PAYMENT_ONLINE_BOOKING_FEE: true, PAYMENT_ONLINE_FULL: true }, limits: { MAX_DOCTORS: null, MAX_SITTINGS: null, MAX_QUEUE_MANAGERS: 20 }, sortOrder: 2 },
    update: {},
  });
  await prisma.platformSetting.upsert({ where: { key: 'defaultPlanCode' }, create: { key: 'defaultPlanCode', value: 'FREE' }, update: {} });
  await prisma.paymentConfig.upsert({
    where: { scope_scopeId: { scope: 'PLATFORM', scopeId: 'GLOBAL' } },
    create: {
      scope: 'PLATFORM',
      scopeId: 'GLOBAL',
      allowedModes: ['PAY_AT_CLINIC', 'ONLINE_BOOKING_FEE', 'ONLINE_FULL'],
      selectedMode: 'PAY_AT_CLINIC',
      bookingFeePaise: 2000,
      commissionPercent: 0,
      commissionFlatPaise: 0,
      taxPercent: 18,
      patientFullRefundMinutes: 120,
    },
    update: {},
  });
  const streams: [string, boolean][] = [
    ['ADS', true],
    ['CLINIC_SUBSCRIPTION', false],
    ['DOCTOR_SUBSCRIPTION', false],
    ['BOOKING_FEE', false],
    ['COMMISSION', false],
    ['SPONSORED_LISTINGS', false],
  ];
  for (const [stream, enabled] of streams) {
    await prisma.revenueSetting.upsert({
      where: { stream_scope_scopeId: { stream, scope: 'PLATFORM', scopeId: 'GLOBAL' } },
      create: { stream, scope: 'PLATFORM', scopeId: 'GLOBAL', enabled },
      update: {},
    });
  }

  // Google's public AdMob test unit IDs — replace with Okidoc's real units before release.
  const placements = [
    { key: 'HOME_BANNER', admobUnitAndroid: 'ca-app-pub-3940256099942544/6300978111', admobUnitIos: 'ca-app-pub-3940256099942544/2934735716', frequencyCapPerDay: 0 },
    { key: 'HOME_NATIVE', admobUnitAndroid: 'ca-app-pub-3940256099942544/2247696110', admobUnitIos: 'ca-app-pub-3940256099942544/3986624511', frequencyCapPerDay: 0 },
    { key: 'POST_BOOKING_INTERSTITIAL', admobUnitAndroid: 'ca-app-pub-3940256099942544/1033173712', admobUnitIos: 'ca-app-pub-3940256099942544/4411468910', frequencyCapPerDay: 1 },
    { key: 'SEARCH_SPONSORED', admobUnitAndroid: null, admobUnitIos: null, frequencyCapPerDay: 0 },
  ];
  for (const p of placements) {
    await prisma.adPlacement.upsert({ where: { key: p.key }, create: { ...p, enabled: true, source: p.key === 'SEARCH_SPONSORED' ? 'HOUSE' : 'HOUSE_THEN_ADMOB' }, update: {} });
  }
  if (DEMO && !(await prisma.adCampaign.count())) {
    const now = new Date();
    const later = new Date(Date.now() + 180 * 86400_000);
    await prisma.adCampaign.createMany({
      data: [
        { advertiser: 'Suraksha Path Lab (demo)', title: 'Full body check-up at ₹999', body: 'Home sample collection across North 24 Parganas.', ctaLabel: 'Know more', ctaUrl: 'https://example.com/lab', category: 'DIAGNOSTICS', placements: ['HOME_BANNER', 'HOME_NATIVE'], startsAt: now, endsAt: later, priority: 20 },
        { advertiser: 'Arogya Health Cover (demo)', title: 'Family health insurance from ₹25/day', body: 'Cashless at 500+ hospitals in West Bengal.', ctaLabel: 'Get a quote', ctaUrl: 'https://example.com/insurance', category: 'INSURANCE', placements: ['HOME_NATIVE', 'POST_BOOKING_INTERSTITIAL'], startsAt: now, endsAt: later, priority: 10 },
      ],
    });
  }
  await prisma.platformSetting.upsert({ where: { key: 'rules' }, create: { key: 'rules', value: {} }, update: {} });

  // ---------------- users
  const user = async (phone: string, name: string, password: string, roles: string[], extra: Record<string, unknown> = {}) => {
    const u = await prisma.user.upsert({
      where: { phone },
      create: { phone, name, phoneVerifiedAt: new Date(), language: 'bn', credential: { create: { passwordHash: await pw(password) } }, ...extra },
      update: {},
    });
    for (const role of roles) {
      const has = await prisma.roleAssignment.findFirst({ where: { userId: u.id, role: role as any, clinicId: null } });
      if (!has) await prisma.roleAssignment.create({ data: { userId: u.id, role: role as any } });
    }
    return u;
  };

  if (!DEMO) {
    // Production: reference data above only, plus one super-admin from the environment. No demo accounts.
    const phone = process.env.ADMIN_PHONE?.trim();
    const password = process.env.ADMIN_PASSWORD ?? '';
    if (phone && password) {
      if (!/^[6-9]\d{9}$/.test(phone)) throw new Error('ADMIN_PHONE must be a 10-digit Indian mobile number');
      if (password.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters');
      await user(phone, process.env.ADMIN_NAME?.trim() || 'Okidoc Admin', password, ['ADMIN_SUPER'], {
        email: process.env.ADMIN_EMAIL?.trim() || undefined,
        language: 'en',
      });
      console.log(`Seed complete (reference data + super-admin ${phone}).`);
    } else {
      console.log('Seed complete (reference data only). Set ADMIN_PHONE and ADMIN_PASSWORD to create the super-admin.');
    }
    return;
  }

  await user('9000000001', 'Okidoc Admin', 'Admin@1234', ['ADMIN_SUPER'], { email: 'admin@okidoc.local', language: 'en' });
  const patient = await user('9000000301', 'Riya Das', 'Patient@123', ['PATIENT'], { areaId: areaIds['Barasat'], gender: 'FEMALE', birthYear: 1994 });
  if (!(await prisma.familyMember.count({ where: { ownerId: patient.id } }))) {
    await prisma.familyMember.create({ data: { ownerId: patient.id, name: 'Arnab Das', relation: 'Son', gender: 'MALE', birthYear: 2019 } });
  }
  await user('9000000302', 'Sourav Mondal', 'Patient@123', ['PATIENT'], { areaId: areaIds['Ranaghat'] });

  // ---------------- doctors
  const doctors: { phone: string; name: string; reg: string; degrees: string; exp: number; specs: string[]; about: string }[] = [
    { phone: '9000000201', name: 'Ananya Ghosh', reg: 'WBMC-61234', degrees: 'MBBS, MS (OBG)', exp: 12, specs: ['gynecology'], about: "Women's health, pregnancy care and PCOS." },
    { phone: '9000000202', name: 'Sourav Banerjee', reg: 'WBMC-55821', degrees: 'MBBS, MD (Oncology)', exp: 10, specs: ['oncology'], about: 'Medical oncologist; chemotherapy follow-ups.' },
    { phone: '9000000203', name: 'Rituparna Sen', reg: 'WBMC-70412', degrees: 'MBBS, DCH, MD (Paediatrics)', exp: 8, specs: ['pediatrics'], about: 'Child health, vaccination and growth.' },
    { phone: '9000000204', name: 'Debashis Roy', reg: 'WBMC-48210', degrees: 'MBBS, MS (Ortho)', exp: 15, specs: ['orthopedics'], about: 'Back, knee and joint pain; sports injuries.' },
    { phone: '9000000205', name: 'Farhan Ali', reg: 'WBMC-80117', degrees: 'MBBS, MD (Medicine)', exp: 6, specs: ['general-physician'], about: 'Fever, diabetes and BP follow-ups.' },
    { phone: '9000000206', name: 'Moumita Das', reg: 'WBMC-77345', degrees: 'MBBS, MD (Dermatology)', exp: 7, specs: ['dermatology'], about: 'Skin, hair and allergy.' },
    { phone: '9000000207', name: 'Pritam Saha', reg: 'WBMC-52096', degrees: 'MBBS, MD, DM (Neurology)', exp: 11, specs: ['neurology'], about: 'Headache, seizures and stroke follow-up.' },
  ];
  const doctorIds: Record<string, string> = {};
  for (const d of doctors) {
    const u = await user(d.phone, d.name, 'Doctor@1234', ['DOCTOR']);
    const doc = await prisma.doctor.upsert({
      where: { userId: u.id },
      create: {
        userId: u.id,
        registrationNo: d.reg,
        council: 'West Bengal Medical Council',
        degrees: d.degrees,
        experienceYears: d.exp,
        about: d.about,
        languagesSpoken: ['Bengali', 'English', 'Hindi'],
        verification: 'APPROVED',
        verifiedAt: new Date(),
        defaultBookingWindowHours: 168,
        specialties: { connect: d.specs.map((s) => ({ id: spec[s] })) },
      },
      update: {},
    });
    doctorIds[d.phone] = doc.id;
  }
  // One unverified doctor to show the admin verification queue.
  const pending = await user('9000000208', 'Tara Bose', 'Doctor@1234', ['DOCTOR']);
  await prisma.doctor.upsert({
    where: { userId: pending.id },
    create: { userId: pending.id, registrationNo: 'WBMC-90001', council: 'West Bengal Medical Council', degrees: 'MBBS', experienceYears: 2, verification: 'PENDING', specialties: { connect: [{ id: spec['general-physician'] }] } },
    update: {},
  });

  // ---------------- clinics
  const owner = await user('9000000101', 'Subrata Pal', 'Clinic@1234', ['CLINIC_OWNER']);
  const owner2 = await user('9000000102', 'Mitali Chatterjee', 'Clinic@1234', ['CLINIC_OWNER']);
  const clinics = [
    { code: 'OK-SNJV1', name: 'Sanjeevani Pharmacy Chamber', type: 'PHARMACY_CHAMBER', area: 'Barasat', address: '12 Jessore Road, near Barasat Station', owner: owner.id },
    { code: 'OK-BRSH2', name: 'Barasat Health Clinic', type: 'CLINIC', area: 'Madhyamgram', address: '45 Station Road, Madhyamgram', owner: owner.id },
    { code: 'OK-RNGM3', name: 'Ranaghat Medical Centre', type: 'POLYCLINIC', area: 'Ranaghat', address: '8 Court Road, Ranaghat', owner: owner2.id },
    { code: 'OK-SHYP4', name: 'Shyambazar Polyclinic', type: 'POLYCLINIC', area: 'Shyambazar', address: '102 Bidhan Sarani, Shyambazar', owner: owner2.id },
    { code: 'OK-MATR5', name: "Matri Women's Clinic", type: 'WOMENS_CLINIC', area: 'Dum Dum', address: '3 Nagerbazar Main Road, Dum Dum', owner: owner2.id },
  ];
  const clinicIds: Record<string, string> = {};
  for (const c of clinics) {
    const row = await prisma.clinic.upsert({
      where: { code: c.code },
      create: {
        code: c.code,
        name: c.name,
        type: c.type,
        addressLine: c.address,
        areaId: areaIds[c.area],
        pin: (await prisma.area.findUniqueOrThrow({ where: { id: areaIds[c.area] } })).pin,
        phone: '9000000999',
        about: 'Demo clinic for the Okidoc West Bengal pilot.',
        openingHours: 'Mon–Sat 9 AM – 9 PM',
        verification: 'APPROVED',
        verifiedAt: new Date(),
        ownerId: c.owner,
      },
      update: {},
    });
    clinicIds[c.code] = row.id;
    const has = await prisma.roleAssignment.findFirst({ where: { userId: c.owner, role: 'CLINIC_OWNER', clinicId: row.id } });
    if (!has) await prisma.roleAssignment.create({ data: { userId: c.owner, role: 'CLINIC_OWNER', clinicId: row.id } });
  }
  const qm = await user('9000000111', 'Rakhi Biswas', 'Queue@1234', []);
  if (!(await prisma.roleAssignment.findFirst({ where: { userId: qm.id, role: 'QUEUE_MANAGER', clinicId: clinicIds['OK-SNJV1'] } }))) {
    await prisma.roleAssignment.create({ data: { userId: qm.id, role: 'QUEUE_MANAGER', clinicId: clinicIds['OK-SNJV1'] } });
  }

  // ---------------- chamber roster: [clinic, doctor phone, fee ₹, split %, sittings]
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const roster: [string, string, number, number, { days: number[]; start: string; end: string; max?: number }[]][] = [
    ['OK-SNJV1', '9000000205', 300, 20, [{ days: ALL_DAYS, start: '09:00', end: '13:00' }, { days: [1, 3, 5], start: '18:00', end: '21:00' }]],
    ['OK-SNJV1', '9000000201', 500, 20, [{ days: [0, 2, 4, 6], start: '17:00', end: '20:00', max: 30 }]],
    ['OK-SNJV1', '9000000206', 400, 20, [{ days: [1, 4], start: '16:00', end: '19:00' }]],
    ['OK-BRSH2', '9000000202', 700, 15, [{ days: [1, 3, 5], start: '18:00', end: '20:00' }, { days: [6], start: '11:00', end: '14:00' }]],
    ['OK-BRSH2', '9000000204', 500, 15, [{ days: [0, 2, 4, 6], start: '10:00', end: '13:00' }]],
    ['OK-RNGM3', '9000000203', 400, 25, [{ days: ALL_DAYS, start: '10:00', end: '13:00' }]],
    ['OK-RNGM3', '9000000202', 700, 15, [{ days: [0, 2, 4], start: '17:00', end: '19:00' }]],
    ['OK-SHYP4', '9000000207', 800, 20, [{ days: [1, 2, 3, 4, 5], start: '18:30', end: '21:00' }]],
    ['OK-SHYP4', '9000000205', 300, 20, [{ days: [0, 6], start: '17:00', end: '20:00' }]],
    ['OK-MATR5', '9000000201', 600, 25, [{ days: [1, 3, 5], start: '10:00', end: '13:00' }]],
  ];
  for (const [code, phone, feeRupees, split, sittings] of roster) {
    const clinicId = clinicIds[code];
    const doctorId = doctorIds[phone];
    const link = await prisma.clinicDoctorLink.upsert({
      where: { clinicId_doctorId: { clinicId, doctorId } },
      create: { clinicId, doctorId, status: 'APPROVED', initiatedBy: 'CLINIC', consultationFee: feeRupees * 100, clinicSplitPercent: split, respondedAt: new Date() },
      update: {},
    });
    if (!(await prisma.sitting.count({ where: { linkId: link.id } }))) {
      for (const s of sittings) {
        await prisma.sitting.create({ data: { linkId: link.id, weekdays: s.days, startTime: s.start, endTime: s.end, maxPatients: s.max ?? null, validFrom: today, specificDates: [] } });
      }
    }
  }
  // A pending request from the unverified doctor (shows "Requests & changes").
  const pendingDoc = await prisma.doctor.findUniqueOrThrow({ where: { userId: pending.id } });
  await prisma.clinicDoctorLink.upsert({
    where: { clinicId_doctorId: { clinicId: clinicIds['OK-SNJV1'], doctorId: pendingDoc.id } },
    create: { clinicId: clinicIds['OK-SNJV1'], doctorId: pendingDoc.id, status: 'PENDING', initiatedBy: 'DOCTOR' },
    update: {},
  });

  // ---------------- bonus campaign
  if (!(await prisma.bonusCampaign.count())) {
    const end = new Date(Date.now() + 90 * 86400_000 + 330 * 60_000).toISOString().slice(0, 10);
    await prisma.bonusCampaign.create({
      data: { name: 'Pilot launch: serve 100 patients', description: 'Serve 100 patients through Okidoc during the pilot.', metric: 'PATIENTS_SERVED', target: 100, rewardPaise: 100000, startsAt: today, endsAt: end },
    });
  }

  console.log('Seed complete.');
  console.log('  Admin 9000000001 / Admin@1234 · Clinic 9000000101 / Clinic@1234 · Doctor 9000000201 / Doctor@1234 · Patient 9000000301 / Patient@123 · Queue manager 9000000111 / Queue@1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
