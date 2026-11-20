import type { NotificationType } from '@okidoc/shared';

type Vars = Record<string, string | number | undefined>;
type T = { title: string; body: string };
type Lang = 'en' | 'bn' | 'hi';

const fill = (s: string, v: Vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

/** Localised notification copy (PRD §8). Missing languages fall back to English. */
const TEMPLATES: Partial<Record<NotificationType, Partial<Record<Lang, T>>>> = {
  BOOKING_CONFIRMED: {
    en: { title: 'Booking confirmed · Token #{token}', body: '{doctor} at {clinic}, {date} {time}. We will alert you when your turn is near.' },
    bn: { title: 'বুকিং নিশ্চিত · টোকেন #{token}', body: '{doctor}, {clinic}, {date} {time}। আপনার পালা কাছে এলে আমরা জানাব।' },
    hi: { title: 'बुकिंग पक्की · टोकन #{token}', body: '{doctor}, {clinic}, {date} {time}। आपकी बारी पास आने पर हम सूचित करेंगे।' },
  },
  PAYMENT_SUCCESS: {
    en: { title: 'Payment received', body: '{amount} paid for token #{token} with {doctor}.' },
    bn: { title: 'পেমেন্ট পাওয়া গেছে', body: '{doctor}-এর টোকেন #{token}-এর জন্য {amount} প্রদান করা হয়েছে।' },
    hi: { title: 'भुगतान प्राप्त', body: '{doctor} के टोकन #{token} के लिए {amount} का भुगतान हुआ।' },
  },
  REFUND_ISSUED: {
    en: { title: 'Refund issued', body: '{amount} will be credited to your original payment method in 5–7 days.' },
    bn: { title: 'রিফান্ড করা হয়েছে', body: '{amount} ৫–৭ দিনের মধ্যে আপনার পেমেন্ট মাধ্যমে ফেরত যাবে।' },
    hi: { title: 'रिफंड जारी', body: '{amount} 5–7 दिनों में आपके भुगतान माध्यम में वापस आ जाएगा।' },
  },
  REMINDER: {
    en: { title: 'Visit reminder', body: 'Token #{token} with {doctor} at {clinic} starts {time}.' },
    bn: { title: 'ভিজিটের রিমাইন্ডার', body: '{clinic}-এ {doctor}-এর টোকেন #{token}, শুরু {time}।' },
    hi: { title: 'विज़िट रिमाइंडर', body: '{clinic} में {doctor} के साथ टोकन #{token}, शुरू {time}।' },
  },
  DOCTOR_ONLINE: {
    en: { title: '{doctor} is now sitting', body: 'The queue at {clinic} has started. Track your turn live.' },
    bn: { title: '{doctor} এখন বসেছেন', body: '{clinic}-এ লাইন শুরু হয়েছে। লাইভ দেখুন।' },
    hi: { title: '{doctor} अब बैठे हैं', body: '{clinic} में कतार शुरू हो गई है। लाइव देखें।' },
  },
  TURN_NEAR: {
    en: { title: 'Your turn is near', body: '{ahead} patients ahead of token #{token}. Please reach {clinic}.' },
    bn: { title: 'আপনার পালা কাছে', body: 'টোকেন #{token}-এর আগে {ahead} জন। দয়া করে {clinic}-এ পৌঁছান।' },
    hi: { title: 'आपकी बारी पास है', body: 'टोकन #{token} से पहले {ahead} मरीज़। कृपया {clinic} पहुँचें।' },
  },
  YOU_ARE_NEXT: {
    en: { title: "You're next!", body: 'Token #{token} — please be ready at {clinic}.' },
    bn: { title: 'এরপর আপনি!', body: 'টোকেন #{token} — {clinic}-এ প্রস্তুত থাকুন।' },
    hi: { title: 'अगली बारी आपकी!', body: 'टोकन #{token} — {clinic} में तैयार रहें।' },
  },
  MISSED_TURN: {
    en: { title: 'You missed your turn · Token #{token}', body: 'Your token was called at {clinic}. Still coming? Tap “I’m here” or tell reception — you will rejoin the queue. Can’t come today? Move to the next sitting in the app.' },
    bn: { title: 'আপনার পালা চলে গেছে · টোকেন #{token}', body: '{clinic}-এ আপনার টোকেন ডাকা হয়েছে। আসছেন? অ্যাপে “আমি এসেছি” চাপুন বা রিসেপশনে বলুন — আবার লাইনে যুক্ত হবেন। আজ আসতে না পারলে পরের বসায় সরিয়ে নিন।' },
    hi: { title: 'आपकी बारी निकल गई · टोकन #{token}', body: '{clinic} में आपका टोकन बुलाया गया। आ रहे हैं? ऐप में “मैं आ गया” दबाएँ या रिसेप्शन पर बताएँ — आप फिर कतार में जुड़ेंगे। आज नहीं आ सकते? अगली सिटिंग में बदलें।' },
  },
  BOOKING_CANCELLED: {
    en: { title: '{clinic} cancelled token #{token}', body: '{doctor}, {when}. Reason: {reason}. {extra}' },
    bn: { title: '{clinic} টোকেন #{token} বাতিল করেছে', body: '{doctor}, {when}। কারণ: {reason}। {extra}' },
    hi: { title: '{clinic} ने टोकन #{token} रद्द किया', body: '{doctor}, {when}। कारण: {reason}। {extra}' },
  },
  BOOKING_MOVED: {
    en: { title: 'Visit moved · Token #{token}', body: '{doctor} at {clinic}, {when}. Any payment carries over.' },
    bn: { title: 'ভিজিট সরানো হয়েছে · টোকেন #{token}', body: '{doctor}, {clinic}, {when}। পেমেন্ট একই থাকবে।' },
    hi: { title: 'विज़िट बदली गई · टोकन #{token}', body: '{doctor}, {clinic}, {when}। भुगतान वही रहेगा।' },
  },
  DOCTOR_DELAYED: {
    en: { title: '{doctor} is running late', body: 'Expected delay {minutes} min at {clinic}. Your ETA has been updated.' },
    bn: { title: '{doctor} দেরি করছেন', body: '{clinic}-এ আনুমানিক {minutes} মিনিট দেরি।' },
    hi: { title: '{doctor} देर से हैं', body: '{clinic} में लगभग {minutes} मिनट की देरी।' },
  },
  SITTING_CANCELLED: {
    en: { title: 'Sitting cancelled', body: "{doctor}'s sitting at {clinic} on {date} is cancelled. {extra}" },
    bn: { title: 'বসা বাতিল', body: '{date}-এ {clinic}-এ {doctor}-এর বসা বাতিল হয়েছে। {extra}' },
    hi: { title: 'सिटिंग रद्द', body: '{date} को {clinic} में {doctor} की सिटिंग रद्द है। {extra}' },
  },
  NO_SHOW_RECORDED: {
    en: { title: 'Marked absent · Token #{token}', body: 'You missed token #{token} at {clinic}. No-shows: {clinicCount}/{clinicLimit} here, {totalCount}/{totalLimit} overall.' },
    bn: { title: 'অনুপস্থিত · টোকেন #{token}', body: '{clinic}-এ টোকেন #{token} মিস হয়েছে। এখানে {clinicCount}/{clinicLimit}, মোট {totalCount}/{totalLimit}।' },
    hi: { title: 'अनुपस्थित · टोकन #{token}', body: '{clinic} में टोकन #{token} छूट गया। यहाँ {clinicCount}/{clinicLimit}, कुल {totalCount}/{totalLimit}।' },
  },
  MARKED_ABSENT: {
    en: { title: 'Marked absent · Token #{token}', body: 'You did not visit {clinic} for token #{token}, so the visit is marked absent. Bookings can be cancelled only before the sitting starts.' },
    bn: { title: 'অনুপস্থিত · টোকেন #{token}', body: 'টোকেন #{token}-এ আপনি {clinic}-এ আসেননি, তাই অনুপস্থিত দেখানো হয়েছে। বসা শুরু হওয়ার আগেই শুধু বুকিং বাতিল করা যায়।' },
    hi: { title: 'अनुपस्थित · टोकन #{token}', body: 'टोकन #{token} के लिए आप {clinic} नहीं आए, इसलिए विज़िट अनुपस्थित दर्ज हुई। बुकिंग सिर्फ़ सिटिंग शुरू होने से पहले रद्द हो सकती है।' },
  },
  NO_SHOW_WARNING: {
    en: { title: 'One more missed visit will block booking', body: '{scope}. Cancel in time if you cannot come.' },
    bn: { title: 'আর একবার মিস করলে বুকিং বন্ধ হবে', body: '{scope}। আসতে না পারলে সময়মতো বাতিল করুন।' },
    hi: { title: 'एक और अनुपस्थिति पर बुकिंग बंद', body: '{scope}। न आ सकें तो समय पर रद्द करें।' },
  },
  PATIENT_BLOCKED: {
    en: { title: 'Online booking blocked', body: '{scope} after {count} missed visits. You can still visit as a walk-in, or appeal via Contact & support.' },
    bn: { title: 'অনলাইন বুকিং বন্ধ', body: '{count}টি মিস হওয়ায় {scope}। ওয়াক-ইন হিসেবে যেতে পারেন বা সাপোর্টে আবেদন করুন।' },
    hi: { title: 'ऑनलाइन बुकिंग बंद', body: '{count} अनुपस्थितियों के बाद {scope}। वॉक-इन कर सकते हैं या सपोर्ट में अपील करें।' },
  },
  BLOCK_LIFTED: {
    en: { title: 'Booking restored', body: 'You can book online again{scope}.' },
    bn: { title: 'বুকিং চালু হয়েছে', body: 'আপনি আবার অনলাইনে বুক করতে পারবেন{scope}।' },
    hi: { title: 'बुकिंग बहाल', body: 'आप फिर से ऑनलाइन बुक कर सकते हैं{scope}।' },
  },
  RATE_VISIT: {
    en: { title: 'How was your visit?', body: 'Rate {doctor} — it helps other patients.' },
    bn: { title: 'আপনার ভিজিট কেমন ছিল?', body: '{doctor}-কে রেটিং দিন।' },
    hi: { title: 'आपकी विज़िट कैसी रही?', body: '{doctor} को रेटिंग दें।' },
  },
};

export function renderTemplate(type: NotificationType, lang: string, vars: Vars, fallback?: T): T {
  const set = TEMPLATES[type];
  const t = set?.[(lang as Lang) ?? 'en'] ?? set?.en ?? fallback ?? { title: String(vars.title ?? 'Okidoc'), body: String(vars.body ?? '') };
  return { title: fill(t.title, vars), body: fill(t.body, vars) };
}

/** Types that are always delivered and also sent by SMS/WhatsApp (PRD §8). */
export const CRITICAL_TYPES: NotificationType[] = [
  'BOOKING_CONFIRMED',
  'PAYMENT_SUCCESS',
  'REFUND_ISSUED',
  'DOCTOR_DELAYED',
  'SITTING_CANCELLED',
  'PATIENT_BLOCKED',
  'BLOCK_LIFTED',
  'NO_SHOW_RECORDED',
  'VERIFICATION_RESULT',
];
