#!/usr/bin/env node
/**
 * End-to-end smoke test against a running API (dev mode: OTP_DEV_ECHO=true, PAYMENT_GATEWAY=mock).
 *   node scripts/smoke.mjs [baseUrl]
 * Requires the seed data. Creates a fresh patient each run.
 */
const BASE = (process.argv[2] ?? 'http://localhost:4000') + '/api/v1';
let passed = 0;
let failed = 0;

async function api(method, path, body, token, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400)}` : ''}`);
  }
}

const must = (r, name) => {
  check(name, r.status < 300, r.body);
  if (r.status >= 300) throw new Error(`${name} failed`);
  return r.body;
};

const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const addDays = (d, n) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
};

async function staffLogin(phone, password) {
  const r = must(await api('POST', '/auth/login', { phone, password, client: 'mobile', device: { deviceId: `smoke-${phone}`, platform: 'android' } }), `login ${phone}`);
  const s = must(await api('POST', '/auth/quick-login/setup', { setupToken: r.setupToken, method: 'PASSCODE', passcode: '1357', device: { deviceId: `smoke-${phone}`, platform: 'android' } }), `quick setup ${phone}`);
  return s.tokens.accessToken;
}

async function newPatient(name) {
  const phone = '6' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const deviceId = `smoke-device-${phone}`;
  const su = must(await api('POST', '/auth/signup', { phone, password: 'Smoke1234', name, role: 'PATIENT', language: 'en', consent: true }), `sign up ${name}`);
  const v = must(await api('POST', '/auth/verify-otp', { challengeToken: su.challengeToken, code: su.devOtp }), `verify ${name}`);
  const s = must(await api('POST', '/auth/quick-login/setup', { setupToken: v.setupToken, method: 'PASSCODE', passcode: '2468', device: { deviceId, platform: 'android' } }), `passcode ${name}`);
  return s.tokens.accessToken;
}

async function main() {
  console.log(`Okidoc smoke test → ${BASE}\n`);

  // ---------------------------------------------------------------- auth
  console.log('Auth (AUTH-04..08)');
  const phone = '7' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const deviceId = `smoke-device-${phone}`;
  const su = must(await api('POST', '/auth/signup', { phone, password: 'Smoke1234', name: 'Smoke Patient', role: 'PATIENT', language: 'en', consent: true }), 'signup returns OTP challenge');
  check('dev OTP echoed', /^\d{6}$/.test(su.devOtp ?? ''));
  const bad = await api('POST', '/auth/verify-otp', { challengeToken: su.challengeToken, code: su.devOtp === '000000' ? '111111' : '000000' });
  check('wrong OTP rejected', bad.status === 400 && bad.body.code === 'OTP_WRONG', bad.body);
  const v = must(await api('POST', '/auth/verify-otp', { challengeToken: su.challengeToken, code: su.devOtp }), 'OTP verifies');
  check('quick-login setup required (no tokens yet)', !!v.setupToken && !v.tokens);
  check('backup code issued', /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/.test(v.backupCode ?? ''), v.backupCode);
  const setup = must(
    await api('POST', '/auth/quick-login/setup', { setupToken: v.setupToken, method: 'PASSCODE', passcode: '2468', device: { deviceId, platform: 'android', deviceName: 'Smoke phone' } }),
    'passcode quick login set up',
  );
  const userId = setup.user.id;
  const wrong = await api('POST', '/auth/quick-login', { userId, deviceId, method: 'PASSCODE', passcode: '1111' });
  check('wrong passcode rejected', wrong.status === 401 && wrong.body.code === 'BAD_PASSCODE', wrong.body);
  const q = must(await api('POST', '/auth/quick-login', { userId, deviceId, method: 'PASSCODE', passcode: '2468' }), 'passcode quick login');
  let pt = q.tokens.accessToken;
  const bio = must(await api('POST', '/me/biometric', { deviceId, enabled: true }, pt), 'enable biometric');
  const bq = must(await api('POST', '/auth/quick-login', { userId, deviceId, method: 'BIOMETRIC', deviceSecret: bio.deviceSecret }), 'biometric (device-secret) quick login');
  const stale = await api('POST', '/auth/refresh', { refreshToken: q.tokens.refreshToken });
  check('earlier refresh token invalidated by new login', stale.status === 401);
  const ref = must(await api('POST', '/auth/refresh', { refreshToken: bq.tokens.refreshToken }), 'refresh token rotates');
  pt = ref.accessToken;
  const reuse = await api('POST', '/auth/refresh', { refreshToken: bq.tokens.refreshToken });
  check('used refresh token no longer valid', reuse.status === 401);
  const dup = await api('POST', '/auth/signup', { phone, password: 'Smoke1234', name: 'X', role: 'PATIENT', consent: true });
  check('duplicate sign-up blocked', dup.status === 409);

  // ---------------------------------------------------------------- discovery
  console.log('\nDiscovery (PAT-01..09)');
  const areas = must(await api('GET', '/areas?q=Barasat'), 'areas search');
  const barasat = areas.find((a) => a.name === 'Barasat');
  check('West Bengal areas seeded', !!barasat && barasat.region.state === 'West Bengal');
  await api('PATCH', '/me', { areaId: barasat.id }, pt);
  const sum = must(await api('GET', `/discover/summary?areaId=${barasat.id}`), 'area summary');
  check('summary counts clinics & doctors', sum.clinics > 0 && sum.doctors > 0, sum);
  const home = must(await api('GET', `/discover/home?areaId=${barasat.id}`), 'home rails');
  check('home has clinics near you', home.clinicsNear.length > 0);
  const search = must(await api('GET', '/search?q=jwor'), 'transliterated symptom search');
  check('"jwor" (fever) finds General Physician', search.specialties.some((s) => s.slug === 'general-physician'));
  const bn = must(await api('GET', `/search?q=${encodeURIComponent('জ্বর')}`), 'Bengali symptom search');
  check('Bengali "জ্বর" finds a specialty', bn.specialties.length > 0);
  const clinic = must(await api('GET', '/clinics/by-code/OK-SNJV1'), 'clinic by QR code');
  const farhan = clinic.doctors.find((d) => d.name === 'Farhan Ali');
  check('clinic shows doctors', !!farhan);
  const slots = must(await api('GET', `/doctors/${farhan.id}/slots?days=15`), 'doctor slots');
  const today = istToday();
  const bookable = slots.filter((s) => s.bookable === 'OK' && s.clinicId === clinic.id);
  check('bookable slots exist', bookable.length > 0, slots.slice(0, 3));
  // pick the two earliest bookable Sanjeevani sittings (for the no-show test we need 3 bookings at one clinic)
  const s1 = bookable[0];
  const s2 = bookable.find((s) => s.sittingId !== s1.sittingId || s.date !== s1.date);

  // ---------------------------------------------------------------- booking
  console.log('\nBooking (PAT-10, BR-05, BR-15, PAY-04)');
  const fam = must(await api('POST', '/me/family', { name: 'Smoke Child', relation: 'Son' }, pt), 'add family member');
  const quote = must(await api('POST', '/bookings/quote', { sittingId: s1.sittingId, date: s1.date }, pt), 'quote');
  check('pilot default = pay at clinic, nothing payable now', quote.paymentMode === 'PAY_AT_CLINIC' && quote.breakdown.payableNow === 0, quote);
  const b1 = must(await api('POST', '/bookings', { sittingId: s1.sittingId, date: s1.date }, pt), 'book for self');
  check('token issued', b1.booking.tokenNo >= 1 && b1.booking.status === 'BOOKED');
  const again = await api('POST', '/bookings', { sittingId: s1.sittingId, date: s1.date }, pt);
  check('same person cannot book same sitting twice', again.status === 400 && again.body.code === 'ALREADY_BOOKED', again.body);
  const b2 = must(await api('POST', '/bookings', { sittingId: s1.sittingId, date: s1.date, memberId: fam.id }, pt), 'book for family member');
  const stranger = await api('POST', '/bookings', { sittingId: s1.sittingId, date: s1.date, memberId: 'not-mine' }, pt);
  check('cannot book for someone outside the account (BR-15)', stranger.status === 403, stranger.body);
  const b3 = must(await api('POST', '/bookings', { sittingId: s2.sittingId, date: s2.date }, pt), 'third booking');
  const fourth = bookable.find((s) => ![s1, s2].some((x) => x.sittingId === s.sittingId && x.date === s.date));
  if (fourth) {
    const r4 = await api('POST', '/bookings', { sittingId: fourth.sittingId, date: fourth.date, memberId: fam.id }, pt);
    check('max 3 active bookings (BR-05)', r4.status === 400 && r4.body.code === 'MAX_ACTIVE_BOOKINGS', r4.body);
  }
  const live = must(await api('GET', `/bookings/${b1.booking.id}/live`, null, pt), 'live queue view');
  check('live view has ETA fields', 'patientsAhead' in live && live.myToken === b1.booking.tokenNo);

  // ---------------------------------------------------------------- clinic queue
  console.log('\nClinic queue console (CLN-08..14)');
  const ct = await staffLogin('9000000101', 'Clinic@1234');
  const qv = must(await api('GET', `/clinic/${clinic.id}/queue?date=${s1.date}`, null, ct), 'clinic queue for the date');
  const inst1 = qv.doctors.find((d) => d.snapshot.sittingId === s1.sittingId);
  check('instance visible in console', !!inst1);
  const notOnline = await api('POST', `/clinic/${clinic.id}/instances/${inst1.snapshot.instanceId}/action`, { action: 'CALL_NEXT' }, ct);
  check('cannot call next before doctor is online', notOnline.status === 400 && notOnline.body.code === 'NOT_ONLINE');
  must(await api('POST', `/clinic/${clinic.id}/instances/${inst1.snapshot.instanceId}/action`, { action: 'ONLINE' }, ct), 'put doctor online');
  const wi = must(await api('POST', `/clinic/${clinic.id}/instances/${inst1.snapshot.instanceId}/walk-ins`, { name: 'Walk-in Ramesh', phone: '9830012345' }, ct), 'add walk-in');
  check('walk-in gets token and is present', wi.booking.status === 'PRESENT');
  const called = must(await api('POST', `/clinic/${clinic.id}/instances/${inst1.snapshot.instanceId}/action`, { action: 'CALL_NEXT' }, ct), 'call next');
  check('not-present online tokens moved to Late, walk-in called', called.bookings.find((b) => b.id === wi.booking.id)?.status === 'IN_CONSULTATION', called.bookings.map((b) => `${b.tokenNo}:${b.status}`));
  const qmt = await staffLogin('9000000111', 'Queue@1234');
  must(await api('POST', `/clinic/${clinic.id}/bookings/${wi.booking.id}/action`, { action: 'COMPLETE' }, qmt), 'queue manager completes visit');
  const qmFees = await api('GET', `/clinic/${clinic.id}/payment-settings`, null, qmt);
  check('queue manager cannot open payment settings', qmFees.status === 403);
  must(await api('POST', `/clinic/${clinic.id}/bookings/${wi.booking.id}/action`, { action: 'PAID_AT_CLINIC', paidVia: 'UPI' }, ct), 'mark paid at clinic');

  // ---------------------------------------------------------------- no-show blocking
  console.log('\nNo-show blocking (BR-07)');
  must(await api('POST', `/clinic/${clinic.id}/instances/${inst1.snapshot.instanceId}/action`, { action: 'END' }, ct), 'end sitting → sweep');
  let standing = must(await api('GET', '/me/standing', null, pt), 'standing');
  check('2 no-shows recorded at clinic', standing.clinics.find((c) => c.clinicId === clinic.id)?.count === 2, standing);
  const qv2 = must(await api('GET', `/clinic/${clinic.id}/queue?date=${s2.date}`, null, ct), 'queue for 2nd sitting');
  const inst2 = qv2.doctors.find((d) => d.snapshot.sittingId === s2.sittingId);
  must(await api('POST', `/clinic/${clinic.id}/instances/${inst2.snapshot.instanceId}/action`, { action: 'ONLINE' }, ct), 'second sitting online');
  must(await api('POST', `/clinic/${clinic.id}/instances/${inst2.snapshot.instanceId}/action`, { action: 'END' }, ct), 'second sitting ended');
  standing = must(await api('GET', '/me/standing', null, pt), 'standing after 3rd no-show');
  const block = standing.blocks.find((b) => b.scope === 'CLINIC' && b.clinicId === clinic.id);
  check('3 no-shows at one clinic → clinic block', !!block, standing);
  const nextSlot = (await api('GET', `/doctors/${farhan.id}/slots?days=15`)).body.find((s) => s.bookable === 'OK' && s.clinicId === clinic.id);
  if (nextSlot) {
    const blocked = await api('POST', '/bookings', { sittingId: nextSlot.sittingId, date: nextSlot.date }, pt);
    check('blocked patient cannot book at that clinic', blocked.status === 403 && blocked.body.code === 'PATIENT_BLOCKED', blocked.body);
  }
  const otherClinic = must(await api('GET', '/clinics/by-code/OK-SHYP4'), 'another clinic');
  const otherSlots = otherClinic.slots.filter((s) => s.bookable === 'OK');
  if (otherSlots.length) {
    const ok = await api('POST', '/bookings/quote', { sittingId: otherSlots[0].sittingId, date: otherSlots[0].date }, pt);
    check('clinic block does not apply at other clinics', ok.status === 200 && !ok.body.blocked, ok.body);
  }
  const clinicLift = await api('POST', `/clinic/${clinic.id}/blocks/${block.id}/lift`, { reason: 'Patient explained' }, ct);
  check('clinic cannot lift block by default', clinicLift.status === 403 && clinicLift.body.code === 'CLINIC_LIFT_DISABLED', clinicLift.body);

  // ---------------------------------------------------------------- admin
  console.log('\nAdmin portal (ADM-02/05/15/17, AUTH-14 2FA)');
  const al = must(await api('POST', '/auth/web/login', { identifier: 'admin@okidoc.local', password: 'Admin@1234' }), 'admin web login');
  check('admin requires OTP 2FA', !!al.challengeToken && !al.tokens);
  const av = must(await api('POST', '/auth/verify-otp', { challengeToken: al.challengeToken, code: al.devOtp }), 'admin 2FA');
  const at = av.tokens.accessToken;
  const dash = must(await api('GET', '/admin/dashboard', null, at), 'dashboard');
  check('dashboard shows active blocks', (dash.activeBlocks.CLINIC ?? 0) >= 1, dash.activeBlocks);
  must(await api('POST', `/admin/blocks/${block.id}/lift`, { reason: 'Smoke test appeal accepted' }, at), 'admin lifts block');
  standing = must(await api('GET', '/me/standing', null, pt), 'standing after lift');
  check('block lifted, counts kept', standing.blocks.length === 0 && standing.total >= 3, standing);
  const patientAdmin = await api('GET', '/admin/dashboard', null, pt);
  check('patient cannot access admin API', patientAdmin.status === 403);

  // Payment configuration: enable full online prepayment for this clinic, clinic selects it.
  const ent = must(await api('GET', `/admin/clinics/${clinic.id}`, null, at), 'admin clinic detail');
  const locked = await api('PUT', `/clinic/${clinic.id}/payment-settings`, { defaultMode: 'ONLINE_FULL' }, ct);
  check('clinic cannot choose a mode it is not entitled to', locked.status === 403, locked.body);
  must(
    await api('PUT', `/admin/clinics/${clinic.id}/entitlements`, { overrides: [...ent.featureOverrides.map((o) => ({ key: o.key, enabled: o.enabled, limit: o.limit })), { key: 'PAYMENT_ONLINE_FULL', enabled: true }] }, at),
    'admin enables online prepayment feature',
  );
  must(await api('PUT', `/clinic/${clinic.id}/payment-settings`, { defaultMode: 'ONLINE_FULL' }, ct), 'clinic selects ONLINE_FULL');
  const paidSlot = (await api('GET', `/doctors/${farhan.id}/slots?days=15`)).body.find((s) => s.bookable === 'OK' && s.clinicId === clinic.id);
  const pq = must(await api('POST', '/bookings/quote', { sittingId: paidSlot.sittingId, date: paidSlot.date }, pt), 'quote with online mode');
  check('mode resolves to ONLINE_FULL, fee payable now', pq.paymentMode === 'ONLINE_FULL' && pq.breakdown.payableNow === pq.breakdown.consultationFee, pq);
  // Free up an active-booking slot first.
  await api('POST', `/bookings/${b3.booking.id}/cancel`, {}, pt);
  const pb = must(await api('POST', '/bookings', { sittingId: paidSlot.sittingId, date: paidSlot.date }, pt), 'paid booking created');
  check('booking waits for payment', pb.booking.status === 'PENDING_PAYMENT' && pb.payment?.gateway === 'MOCK', pb.booking.status);
  must(await api('POST', '/payments/mock/complete', { gatewayOrderId: pb.payment.orderId, success: true }, pt), 'mock checkout success');
  const afterPay = must(await api('GET', `/bookings/${pb.booking.id}`, null, pt), 'booking after payment');
  check('payment confirms booking', afterPay.status === 'BOOKED' && afterPay.paidOnline === pq.breakdown.payableNow, afterPay.status);
  const cancel = must(await api('POST', `/bookings/${pb.booking.id}/cancel`, {}, pt), 'patient cancels');
  check('refund per policy (BR-12)', typeof cancel.refundedPaise === 'number', cancel);
  // Admin lock (PAY-02): lock clinic to pay-at-clinic
  must(await api('PUT', '/admin/payment-configs', { scope: 'CLINIC', scopeId: clinic.id, selectedMode: 'PAY_AT_CLINIC', locked: true }, at), 'admin locks clinic payment mode');
  const afterLock = await api('PUT', `/clinic/${clinic.id}/payment-settings`, { defaultMode: 'ONLINE_FULL' }, ct);
  check('locked setting cannot be changed by clinic', afterLock.status === 403 && afterLock.body.code === 'PAYMENT_LOCKED', afterLock.body);
  // restore
  const cfgs = must(await api('GET', '/admin/payment-configs', null, at), 'list configs');
  const clinicCfg = cfgs.find((c) => c.scope === 'CLINIC' && c.scopeId === clinic.id);
  await api('DELETE', `/admin/payment-configs/${clinicCfg.id}`, null, at);
  await api('PUT', `/admin/clinics/${clinic.id}/entitlements`, { overrides: [] }, at);

  // Entitlements enforcement (ADM-02/BR-11)
  must(await api('PUT', `/admin/clinics/${clinic.id}/entitlements`, { overrides: [{ key: 'WALK_IN', enabled: false }] }, at), 'admin disables walk-in');
  const qv3 = must(await api('GET', `/clinic/${clinic.id}/queue`, null, ct), 'queue today');
  if (qv3.doctors[0]) {
    const lockedWi = await api('POST', `/clinic/${clinic.id}/instances/${qv3.doctors[0].snapshot.instanceId}/walk-ins`, { name: 'X' }, ct);
    check('disabled feature rejected by API', lockedWi.status === 403 && lockedWi.body.code === 'FEATURE_LOCKED', lockedWi.body);
  }
  await api('PUT', `/admin/clinics/${clinic.id}/entitlements`, { overrides: [] }, at);

  // Revenue switches & ads (MON-01/02)
  const rev = must(await api('GET', '/admin/revenue-settings', null, at), 'revenue settings');
  check('pilot: ads on, commission & subscriptions off', rev.platform.find((p) => p.stream === 'ADS').enabled && !rev.platform.find((p) => p.stream === 'COMMISSION').enabled && !rev.platform.find((p) => p.stream === 'CLINIC_SUBSCRIPTION').enabled);
  const ad = must(await api('GET', `/ads/slot?placement=HOME_BANNER&areaId=${barasat.id}&platform=android`), 'ad slot');
  check('house ad served', ad.enabled && ad.type === 'HOUSE', ad);
  must(await api('PUT', '/admin/revenue-settings', { stream: 'ADS', scope: 'PLATFORM', enabled: false }, at), 'admin turns ads off');
  const noAd = must(await api('GET', '/ads/slot?placement=HOME_BANNER'), 'ad slot after switch-off');
  check('no ads when stream off', noAd.enabled === false);
  await api('PUT', '/admin/revenue-settings', { stream: 'ADS', scope: 'PLATFORM', enabled: true }, at);
  const sub = must(await api('GET', `/clinic/${clinic.id}/subscription`, null, ct), 'clinic subscription view');
  check('plan page says Free, with no talk of charging later', sub.enabled === false && /^Free/.test(sub.message ?? '') && !/pilot|later|for now/i.test(sub.message ?? ''), sub.message);

  // ---------------------------------------------------------------- assistant & misc
  console.log('\nAssistant, doctor app, records');
  const asst = must(await api('POST', '/assistant/chat', { messages: [{ role: 'user', content: 'I have knee pain and back pain' }], language: 'en' }), 'assistant');
  check('assistant suggests orthopedics', asst.specialties.some((s) => s.slug === 'orthopedics'), asst.specialties);
  check('assistant always shows disclaimer', /not a doctor/.test(asst.disclaimer));
  const emer = must(await api('POST', '/assistant/chat', { messages: [{ role: 'user', content: 'severe chest pain and sweating' }], language: 'en' }), 'assistant red flag');
  check('red-flag symptoms → emergency', emer.emergency === true);
  const dt = await staffLogin('9000000201', 'Doctor@1234');
  const sched = must(await api('GET', '/doctor/schedule', null, dt), 'doctor schedule');
  check('doctor schedule summary', sched.summary.chambers >= 2 && sched.summary.sittings >= 2, sched.summary);
  const roster = must(await api('GET', `/clinic/${clinic.id}/doctors`, null, ct), 'clinic roster');
  check('roster shows pending request', roster.requests.some((r) => r.status === 'PENDING'));
  const poster = must(await api('GET', `/clinic/${clinic.id}/poster`, null, ct), 'doctors poster');
  check('poster has QR', poster.qrDataUrl.startsWith('data:image/png'));
  const notes = must(await api('GET', '/notifications', null, pt), 'notifications');
  check('patient got notifications', notes.items.length > 0 && notes.items.some((n) => n.type === 'PATIENT_BLOCKED'), notes.items.map((n) => n.type));

  // ---------------------------------------------------------------- ratings
  console.log('\nRatings: doctor and clinic (PAT-16, ADM-13)');
  const rs = otherSlots[0];
  if (!rs) check('a bookable slot at OK-SHYP4 for the rating test', false);
  else {
    const kt = await staffLogin('9000000102', 'Clinic@1234');
    const rb = must(await api('POST', '/bookings', { sittingId: rs.sittingId, date: rs.date }, pt), 'book at second clinic');
    const early = await api('POST', `/bookings/${rb.booking.id}/review`, { rating: 5, clinicRating: 5 }, pt);
    check('cannot rate before the visit is served', early.status === 400 && early.body.code === 'NOT_SERVED', early.body);
    const rq = must(await api('GET', `/clinic/${otherClinic.id}/queue?date=${rs.date}`, null, kt), 'second clinic queue');
    const rInst = rq.doctors.find((d) => d.snapshot.sittingId === rs.sittingId).snapshot.instanceId;
    must(await api('POST', `/clinic/${otherClinic.id}/instances/${rInst}/action`, { action: 'ONLINE' }, kt), 'doctor online at second clinic');
    must(await api('POST', `/clinic/${otherClinic.id}/bookings/${rb.booking.id}/action`, { action: 'PRESENT' }, kt), 'patient marked present');
    must(await api('POST', `/clinic/${otherClinic.id}/instances/${rInst}/action`, { action: 'CALL_NEXT' }, kt), 'patient called');
    must(await api('POST', `/clinic/${otherClinic.id}/bookings/${rb.booking.id}/action`, { action: 'COMPLETE' }, kt), 'visit completed');
    const empty = await api('POST', `/bookings/${rb.booking.id}/review`, { comment: 'no stars' }, pt);
    check('a review needs a doctor or clinic rating', empty.status === 400, empty.body);
    const other = await api('POST', `/bookings/${rb.booking.id}/review`, { rating: 4 }, ct);
    check("cannot rate someone else's visit", other.status === 403, other.body);
    const note = `Good doctor, long wait (${phone.slice(-4)})`; // unique per run
    const before = must(await api('GET', `/clinics/${otherClinic.id}`), 'clinic before rating');
    must(await api('POST', `/bookings/${rb.booking.id}/review`, { rating: 4, clinicRating: 2, comment: note }, pt), 'patient rates doctor 4 and clinic 2');
    const after = must(await api('GET', `/clinics/${otherClinic.id}`), 'clinic after rating');
    check('clinic rating count goes up', after.ratingCount === before.ratingCount + 1, { before: before.ratingCount, after: after.ratingCount });
    check('clinic page lists the review (first name only)', after.reviews[0]?.rating === 2 && after.reviews[0]?.comment === note && !after.reviews[0].by.includes(' '), after.reviews[0]);
    check('clinic card in listings carries the rating', (await api('GET', '/clinics')).body.find((c) => c.id === otherClinic.id)?.ratingCount === after.ratingCount);
    const rDoc = must(await api('GET', `/doctors/${rb.booking.doctor.id}`), 'doctor after rating');
    check('doctor rating recorded and shown', rDoc.ratingCount >= 1 && rDoc.ratingAvg != null && rDoc.reviews.some((r) => r.rating === 4), rDoc.ratingCount);
    must(await api('POST', `/bookings/${rb.booking.id}/review`, { clinicRating: 4 }, pt), 'patient edits clinic rating only');
    const view = must(await api('GET', `/bookings/${rb.booking.id}`, null, pt), 'booking shows my review');
    check('edit keeps the doctor rating and comment', view.review?.rating === 4 && view.review?.clinicRating === 4 && view.review?.comment === note, view.review);
    const own = must(await api('GET', `/clinic/${otherClinic.id}/reviews`, null, kt), 'clinic owner sees reviews');
    check('owner view has breakdown and doctor name', own.breakdown['4'] >= 1 && own.reviews.some((r) => r.clinicRating === 4 && r.doctor), own.breakdown);
    const strangerClinic = await api('GET', `/clinic/${otherClinic.id}/reviews`, null, ct);
    check("another clinic's owner cannot see these reviews", strangerClinic.status === 403, strangerClinic.status);
    const adminList = must(await api('GET', '/admin/reviews', null, at), 'admin review list');
    const mine = adminList.find((r) => r.bookingId === rb.booking.id);
    check('admin sees clinic and doctor rating', !!mine?.clinic?.name && mine.clinicRating === 4 && mine.rating === 4, mine);
    must(await api('PATCH', `/admin/reviews/${mine.id}`, { hidden: true }, at), 'admin hides review');
    const hidden = must(await api('GET', `/clinics/${otherClinic.id}`), 'clinic after hide');
    check('hidden review leaves clinic rating and list', hidden.ratingCount === before.ratingCount && !hidden.reviews.some((r) => r.comment === note), hidden.ratingCount);
    must(await api('PATCH', `/admin/reviews/${mine.id}`, { hidden: false }, at), 'admin restores review');
  }

  // ---------------------------------------------------------------- missed turn
  console.log('\nMissed turn: late arrival and move to next sitting (BR-06a)');
  {
    const kt = await staffLogin('9000000102', 'Clinic@1234');
    const oc = otherClinic;
    let pick = null;
    for (const d of oc.doctors) {
      const ds = (await api('GET', `/doctors/${d.id}/slots?days=15`)).body.filter((x) => x.clinicId === oc.id && x.bookable === 'OK' && x.status === 'SCHEDULED' && !(rs && x.sittingId === rs.sittingId && x.date === rs.date));
      if (ds.length >= 2) {
        pick = ds[0];
        break;
      }
    }
    if (!pick) check('a doctor with two upcoming sittings at OK-SHYP4', false);
    else {
      must(await api('PATCH', `/clinic/${oc.id}`, { lateRejoinAfter: 1 }, kt), 'clinic sets "late patients rejoin after 1"');
      const mt = await newPatient('Late Lata');
      const mFam = must(await api('POST', '/me/family', { name: 'Late Mother', relation: 'Mother' }, mt), 'add family member');
      const lb = must(await api('POST', '/bookings', { sittingId: pick.sittingId, date: pick.date }, mt), 'late patient books');
      const mb = must(await api('POST', '/bookings', { sittingId: pick.sittingId, date: pick.date, memberId: mFam.id }, mt), 'family member books');
      const mq = must(await api('GET', `/clinic/${oc.id}/queue?date=${pick.date}`, null, kt), 'queue for the sitting');
      const iid = mq.doctors.find((d) => d.snapshot.sittingId === pick.sittingId).snapshot.instanceId;
      const act = (action, extra = {}) => api('POST', `/clinic/${oc.id}/instances/${iid}/action`, { action, ...extra }, kt);
      const bact = (bid, action) => api('POST', `/clinic/${oc.id}/bookings/${bid}/action`, { action }, kt);
      const before = must(await api('GET', `/bookings/${lb.booking.id}/live`, null, mt), 'live view before the sitting starts');
      check('patient can cancel before the sitting starts (BR-12a)', before.canCancel === true && !!before.cancelUntil, before.canCancel);
      must(await act('ONLINE'), 'doctor online');
      const lateCancel = await api('POST', `/bookings/${lb.booking.id}/cancel`, {}, mt);
      check('no patient cancellation once the sitting has started (BR-12a)', lateCancel.status === 400 && lateCancel.body.code === 'CANCEL_CLOSED', lateCancel.body);
      const after = must(await api('GET', `/bookings/${lb.booking.id}/live`, null, mt), 'live view after start');
      check('live view says cancelling is closed', after.canCancel === false);
      const fb = must(await api('POST', '/me/family', { name: 'Late Father', relation: 'Father' }, mt), 'add second family member');
      const xb = must(await api('POST', '/bookings', { sittingId: pick.sittingId, date: pick.date, memberId: fb.id }, mt), 'book while the sitting runs');
      const cv = must(await api('POST', `/clinic/${oc.id}/bookings/${xb.booking.id}/action`, { action: 'CANCEL', reason: 'Doctor called away' }, kt), 'clinic cancels after the start');
      check('clinics can still cancel after the sitting started', cv.bookings.find((b) => b.id === xb.booking.id)?.status === 'CANCELLED');
      const xv = must(await api('GET', `/bookings/${xb.booking.id}`, null, mt), 'cancelled booking view');
      check('patient sees the clinic cancelled it, with the reason', xv.cancelledBy === 'CLINIC' && xv.cancelReason === 'Doctor called away', { by: xv.cancelledBy, reason: xv.cancelReason });
      const cn = must(await api('GET', '/notifications', null, mt), 'notifications after clinic cancel');
      check('patient notified of the clinic cancellation', cn.items.some((n) => n.type === 'BOOKING_CANCELLED' && /Doctor called away/.test(n.body)), cn.items.map((n) => n.type));
      const w1 = must(await api('POST', `/clinic/${oc.id}/instances/${iid}/walk-ins`, { name: 'Walk-in One' }, kt), 'walk-in 1').booking;
      const w2 = must(await api('POST', `/clinic/${oc.id}/instances/${iid}/walk-ins`, { name: 'Walk-in Two' }, kt), 'walk-in 2').booking;
      const w3 = must(await api('POST', `/clinic/${oc.id}/instances/${iid}/walk-ins`, { name: 'Walk-in Three' }, kt), 'walk-in 3').booking;
      let v = must(await act('CALL_NEXT'), 'call next');
      const st = (id) => v.bookings.find((b) => b.id === id)?.status;
      check('patients not here when their token came up move to Late', st(lb.booking.id) === 'LATE' && st(mb.booking.id) === 'LATE', v.bookings.map((b) => `${b.tokenNo}:${b.status}`));
      check('first walk-in is called', st(w1.id) === 'IN_CONSULTATION');
      const notes = must(await api('GET', '/notifications', null, mt), 'late patient notifications');
      check('patient told they missed their turn', notes.items.some((n) => n.type === 'MISSED_TURN'), notes.items.map((n) => n.type));
      let lv = must(await api('GET', `/bookings/${lb.booking.id}/live`, null, mt), 'late live view');
      check('live view: late, can move, clinic rule shown', lv.myStatus === 'LATE' && lv.canMove === true && lv.lateRejoinAfter === 1, lv);
      lv = must(await api('POST', `/bookings/${lb.booking.id}/check-in`, {}, mt), "patient taps I'm here");
      check('check-in recorded', !!lv.checkInAt);
      v = must(await api('GET', `/clinic/${oc.id}/instances/${iid}`, null, kt), 'staff view');
      check('reception sees the check-in', !!v.bookings.find((b) => b.id === lb.booking.id)?.checkInAt);
      v = must(await bact(lb.booking.id, 'PRESENT'), 'reception confirms arrival');
      const back = v.bookings.find((b) => b.id === lb.booking.id);
      check("returned patient rejoins after the clinic's number", back.status === 'PRESENT' && back.rejoinAfter === 1 && !!back.recalledAt, back);
      lv = must(await api('GET', `/bookings/${lb.booking.id}/live`, null, mt), 'live view after return');
      check('live view: rejoined with 1 patient ahead', lv.rejoined === true && lv.patientsAhead === 1, { rejoined: lv.rejoined, ahead: lv.patientsAhead });
      v = must(await act('CALL_NEXT'), 'call next (after return)');
      check('one more patient is seen before the late patient', st(w2.id) === 'IN_CONSULTATION' && st(lb.booking.id) === 'PRESENT', v.bookings.map((b) => `${b.tokenNo}:${b.status}`));
      v = must(await act('CALL_NEXT'), 'call next again');
      check('then the late patient is called', st(lb.booking.id) === 'IN_CONSULTATION' && st(w3.id) === 'PRESENT', v.bookings.map((b) => `${b.tokenNo}:${b.status}`));
      const pre = must(await api('GET', `/bookings/${mb.booking.id}/next-sitting`, null, mt), 'preview next sitting');
      check('next sitting found', !!pre.next && `${pre.next.date} ${pre.next.startTime}` > `${pick.date} ${pick.startTime}`, pre);
      const mv = must(await api('POST', `/bookings/${mb.booking.id}/move-next`, {}, mt), 'patient moves missed visit to next sitting');
      check('moved to the previewed sitting with a token', mv.date === pre.next.date && mv.startTime === pre.next.startTime && mv.tokenNo >= 1, mv);
      const moved = must(await api('GET', `/bookings/${mb.booking.id}`, null, mt), 'moved booking');
      check('moved booking is booked again and remembers where it came from', moved.status === 'BOOKED' && moved.live.movedFrom === `${pick.date} ${pick.startTime}` && moved.live.canMove === false, { status: moved.status, from: moved.live.movedFrom });
      const twice = await api('POST', `/bookings/${mb.booking.id}/move-next`, {}, mt);
      check('patient can move a visit only once', twice.status === 400 && twice.body.code === 'MOVE_LIMIT', twice.body);
      v = must(await api('GET', `/clinic/${oc.id}/instances/${iid}`, null, kt), 'staff view after move');
      check('moved booking left this sitting', !v.bookings.some((b) => b.id === mb.booking.id));
      must(await api('POST', `/bookings/${mb.booking.id}/cancel`, {}, mt), 'clean up moved booking');
      // A late walk-in at the end of the sitting is carried over instead of becoming a no-show.
      const w4 = must(await api('POST', `/clinic/${oc.id}/instances/${iid}/walk-ins`, { name: 'Walk-in Four', phone: '9830099999' }, kt), 'walk-in 4').booking;
      must(await bact(w4.id, 'LATE'), 'walk-in 4 stepped out (late)');
      v = must(await act('END', { moveLate: true }), 'end sitting, moving late patients');
      check('late patient not marked no-show at end', !v.bookings.some((b) => b.id === w4.id), v.bookings.map((b) => `${b.tokenNo}:${b.status}`));
      must(await api('PATCH', `/clinic/${oc.id}`, { lateRejoinAfter: 2 }, kt), 'restore clinic rule');
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('\nSmoke test aborted:', e.message);
  console.log(`${passed} passed, ${failed + 1} failed`);
  process.exit(1);
});
