# Okidoc — Product Requirements Document (PRD)

> **Know your queue. Skip the wait.**

| Field | Value |
|---|---|
| Product | Okidoc |
| Document version | 0.4 |
| Date | 2026-11-18 |
| Status | Draft, for review |
| Owner | Product Owner, Okidoc |
| Surfaces | React Native app (Android, iOS, phone and tablet), Node.js web app (Admin portal and Clinic console), Node.js API |

### Change log

| Version | Date | Author | Notes |
|---|---|---|---|
| 0.1 | 2026-11-18 | Product | First draft, based on the proposed UI screenshots |
| 0.2 | 2026-11-18 | Product | Revenue model: ads are the main income, clinic subscriptions are the business model, every revenue stream is configurable, and commission is off. Added the no-show blocking rules for pay-at-clinic bookings. Pilot set to West Bengal. Booking only for the account holder or saved family members. |
| 0.3 | 2026-11-18 | Product | Mobile app moves from Expo to bare React Native (React Native CLI). |
| 0.4 | 2026-11-18 | Product | Patients rate the clinic as well as the doctor (PAT-16, PAT-07, CLN-29, ADM-13). |
| 0.5 | 2026-11-19 | Product | Missed turn: late patients rejoin after a clinic-set number of patients, can tap "I'm here", or move to the doctor's next sitting (BR-06a, PAT-11a, CLN-20a). Public landing page on the web. |
| 0.6 | 2026-11-19 | Product | No patient cancellation after the sitting starts; patients who do not visit are marked absent and notified (BR-12a, PAT-13). |
| 0.7 | 2026-11-22 | Product | Clinics add their own area when it is not listed, anywhere in India (CLN-01b). Day-by-day opening hours with "Open now" and a warning for sittings outside them (CLN-01a). |
| 0.8 | 2026-11-22 | Product | Admins add and edit areas one at a time and upload many from a CSV, with a preview before saving (ADM-10a). |

---

## Table of contents

1. [Overview](#1-overview)
2. [Personas and roles](#2-personas-and-roles)
3. [Platforms and surfaces](#3-platforms-and-surfaces)
4. [Functional requirements](#4-functional-requirements)
   - 4.1 [Onboarding and authentication](#41-onboarding-and-authentication-auth)
   - 4.2 [Patient app](#42-patient-app-pat)
   - 4.3 [Doctor app](#43-doctor-app-doc)
   - 4.4 [Clinic / Pharmacy app and web console](#44-clinic--pharmacy-app-and-web-console-cln)
   - 4.5 [Payments](#45-payments-pay)
   - 4.6 [Super-admin web portal](#46-super-admin-web-portal-adm)
   - 4.7 [Monetization](#47-monetization-mon)
5. [Core domain model](#5-core-domain-model)
6. [Key user flows](#6-key-user-flows)
7. [Business rules](#7-business-rules)
8. [Notifications](#8-notifications-ntf)
9. [Non-functional requirements](#9-non-functional-requirements-nfr)
10. [Compliance and legal](#10-compliance-and-legal)
11. [Proposed technical architecture](#11-proposed-technical-architecture)
12. [Design system notes](#12-design-system-notes)
13. [Success metrics](#13-success-metrics)
14. [Release plan](#14-release-plan)
15. [Risks, assumptions and open questions](#15-risks-assumptions-and-open-questions)
16. [Appendix](#16-appendix)

---

## 1. Overview

### 1.1 Problem

Outpatient (OPD) care in India runs mostly in **doctor chambers**. Many sit inside pharmacies or small clinics, and a doctor often visits several chambers a week. Patients face these problems:

- They don't know **which doctor sits where and when**.
- They have to visit in person or phone ahead to get a **serial number**.
- They wait **hours** in crowded waiting rooms because they can't see how the queue is moving.

Clinics and pharmacies have their own problems:

- They manage serials on paper registers and by phone.
- They can't easily tell patients when a doctor is late or has cancelled.
- They have no clear view of fees, commission splits or doctor schedules.

Doctors find it hard to manage sittings across several chambers and to see what each sitting earned.

### 1.2 Vision

Okidoc is **one app with three ways to care**:

- **Patients** find a nearby doctor or clinic, book a serial, and follow the live queue. They arrive just in time.
- **Clinics and pharmacies** run the day's OPD queue, walk-ins and doctor roster from a phone, tablet or browser.
- **Doctors** keep every chamber and every sitting in one calm view.

### 1.3 Goals

| # | Goal |
|---|---|
| G1 | Cut patient time in the waiting room by showing a live, accurate queue position and ETA. |
| G2 | Replace paper serial registers with a digital queue that handles online bookings and walk-ins together. |
| G3 | Give doctors one schedule across all their chambers. |
| G4 | Let Okidoc admins control which features each clinic gets and how payments work, with clinics choosing within those limits. |
| G5 | Work well across India: many languages, low-end Android phones, weak networks. **The pilot launches in West Bengal.** |
| G6 | Earn sustainably without taking commission from clinics or doctors. **In-app advertising is the main income at launch**, and **clinic subscriptions** are the long-term model. Admins can turn each revenue stream on or off as usage grows (section 4.7). |

### 1.4 Non-goals (v1)

- Telemedicine or video consultation
- E-prescriptions or EMR beyond simple record uploads
- Insurance claims
- Ordering medicines or delivering from the pharmacy
- Lab test booking

---

## 2. Personas and roles

| Role | Who | Primary needs |
|---|---|---|
| **Patient** | Anyone booking for themselves or a family member | Find a doctor nearby, book a serial, know when to leave home, keep records |
| **Clinic / Pharmacy owner** | Owner or admin of a clinic, polyclinic or pharmacy chamber | Register the clinic, add doctors and sittings, run the daily queue, manage walk-ins, fees and earnings |
| **Queue Manager** | Front-desk staff at a clinic, on a restricted sub-account | Run the queue and take walk-ins and offline bookings. No access to finance or settings |
| **Doctor** | Registered medical practitioner who sits in one or more chambers | Manage sittings and days off, accept clinic links, see the live queue and earnings |
| **Okidoc Super-admin** | Okidoc operations team | Verify doctors and clinics, control clinic features and payment settings, run campaigns, handle support |
| **Okidoc Support agent** | Okidoc support staff (a limited admin) | Handle tickets and look up bookings. Cannot change commission or entitlements |

---

## 3. Platforms and surfaces

- **Okidoc mobile app (React Native):** one app binary for Android and iOS, phone and tablet. After sign-up the user picks a role: Patient, Clinic / Pharmacy or Doctor. Tablet layouts suit clinic front desks.
- **Okidoc web app (Node.js):**
  - **Clinic console (web):** the clinic queue console, roster, walk-ins and settings in a desktop browser.
  - **Admin portal (web):** internal portal for Okidoc staff.
- **Okidoc API (Node.js):** REST plus WebSocket backend used by every client.

### 3.1 Role and surface matrix

| Role | Mobile: phone | Mobile: tablet | Web: Clinic console | Web: Admin portal |
|---|:-:|:-:|:-:|:-:|
| Patient | ✅ | ✅ | — | — |
| Doctor | ✅ | ✅ | — | — |
| Clinic / Pharmacy owner | ✅ | ✅ (optimised) | ✅ | — |
| Queue Manager | ✅ | ✅ (optimised) | ✅ | — |
| Super-admin / Support | — | — | — | ✅ |

---

## 4. Functional requirements

Priority: **P0** is needed for MVP, **P1** comes soon after MVP (Phase 1.5), and **P2** is later.

### 4.1 Onboarding and authentication (AUTH)

**User stories**
- As a new user, I want to choose my language and role so the app fits how I'll use it.
- As a patient, I want to sign up with my phone number and a password, then log in later with a passcode or my fingerprint, so I don't type my password every time.

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | **Welcome screen:** Okidoc logo, tagline "Know your queue. Skip the wait.", **Get started**, **I already have an account**, a "How to sign up · 2 min" help link, and "Need help? Contact Okidoc". | P0 |
| AUTH-02 | **Language picker** on first launch, which can be changed later in Account. Launch languages: **Bengali**, English and Hindi. In the West Bengal pilot, Bengali is the default when the device locale is Bengali or the area is in West Bengal. The i18n framework must let us add more (see NFR-08). | P0 |
| AUTH-03 | **Role selection** ("Are you a…"): Patient ("Book a serial and track the live queue"), Clinic / Pharmacy ("Run your OPD queue and your doctors"), Doctor ("Your chambers, your queue, your profile"). Then **Continue**. | P0 |
| AUTH-04 | **Sign-up:** mobile number (+91 by default), password (at least 8 characters, letters and digits) and confirm password. Show a password strength hint. Accept terms and privacy consent (DPDP). | P0 |
| AUTH-05 | **Phone verification:** a one-time 6-digit OTP is sent by SMS (or WhatsApp) **at sign-up only**, to prove the user owns the number. The OTP is valid for 5 minutes. Resend is allowed after 30 seconds, up to 3 times. | P0 |
| AUTH-06 | **Quick-login setup (required):** after sign-up the user must set up one of: (a) a **4–6 digit app passcode**, or (b) **device authentication**: fingerprint, face, or the device's screen lock (pattern or PIN) through the OS biometric prompt. If the device has no biometrics, only the passcode is offered. | P0 |
| AUTH-07 | **Daily login:** on a registered device, opening the app asks for the passcode or the biometric/device prompt. The user can always fall back from biometric to passcode. | P0 |
| AUTH-08 | **Full login:** phone + password is required on a new device, after logout, after the refresh token expires (30 days idle), or after 5 wrong passcode attempts. After a full login, quick login is set up again (AUTH-06). | P0 |
| AUTH-09 | **Forgot password:** reset with a phone OTP. Resetting signs out all devices, and quick login must be set up again. | P0 |
| AUTH-10 | **Backup Code:** a one-time 10-character recovery code is shown once after sign-up, and the user can regenerate it under Account security. It lets the user recover the account when they can't receive an OTP. | P1 |
| AUTH-11 | **Account security settings:** change password, change passcode, turn biometric login on or off, see and revoke logged-in devices, regenerate the Backup Code. | P0 |
| AUTH-12 | **Profile setup by role:** Patient (name, gender, year of birth, area/PIN, family members); Doctor (name, registration number and council, degrees, specialty, years of experience, photo); Clinic (clinic name, type, address, area/PIN, GPS pin, contact, photos). | P0 |
| AUTH-13 | **Multiple roles:** one phone number can hold more than one role (for example, a doctor who is also a patient). The user switches role from Account. | P1 |
| AUTH-14 | **Web login (Clinic console and Admin portal):** phone or email + password. **Admins must use OTP 2FA** on every new browser. The web session times out after 30 minutes idle. | P0 |

**Acceptance criteria (examples)**
- A user can't reach the home screen until the phone is verified and quick login is set up.
- Biometric data never leaves the device. The app only receives a pass or fail from the OS.
- After 5 wrong passcode attempts, the device's quick-login token is revoked and phone + password is required.

### 4.2 Patient app (PAT)

Bottom tabs: **Home · Bookings · Assistant · Records · Account**. A floating notification bell is shown on main screens.

**User stories**
- As a patient, I want to see which doctors are sitting near me right now or later today, so I can choose quickly.
- As a patient, I want to book a sitting and follow my queue position live, so I arrive just before my turn.

| ID | Requirement | Priority |
|---|---|---|
| PAT-01 | **Area picker ("Choose area"):** choose by GPS, PIN code or a list of areas/districts. The header shows a summary such as "4 clinics · 7 doctors near this area". | P0 |
| PAT-02 | **Universal search:** one box for doctor name, specialty, problem/symptom, clinic, area or PIN. Results are grouped by type, and the search tolerates typos and transliteration (for example, "hriday" or "dil" finds Cardiology). | P0 |
| PAT-03 | **QR scan:** scanning a clinic QR code (from the poster, CLN-24) opens that clinic's page. | P0 |
| PAT-04 | **Home toggle:** **Doctors** or **Pharmacies / clinics**. | P0 |
| PAT-05 | **Doctors view:** a "Search by speciality" chip rail (All, Women's doctor, Brain & nerves, Surgery, Cancer care, General, …). A **Live now** rail shows doctors sitting right now, with an empty state such as "No doctor is sitting right now…". **Clinics near you** and **Available later today** rails each have "See all". | P0 |
| PAT-06 | **Clinics view:** "Clinics near you · N" list with clinic photo, name, area and status ("1 doctor sitting today" or "View weekly schedule"). **Browse by clinic type:** Pharmacy chamber, Women's clinic, Child clinic, Dental clinic, Eye clinic, Bone & joint. | P0 |
| PAT-07 | **Clinic detail:** photos, address and map, contact, timings, about, clinic rating and recent reviews (PAT-16), today's doctors and the weekly schedule, then go to a doctor's slots. Clinic cards in lists show the clinic's average rating. | P0 |
| PAT-08 | **Doctor profile:** name, verified badge, degrees, specialty, years of experience, rating (or "Not rated"), number of chambers, and "Tap to read more about the doctor". | P0 |
| PAT-09 | **Slot list ("This week — starting now — tick a slot"):** sittings grouped by day (Later today, Tomorrow, then dates). Each row shows the clinic and time range. Full or closed sittings are disabled. The patient ticks a sitting, then taps **Book a visit**. | P0 |
| PAT-10 | **Booking:** choose a patient. Only the account holder or a family member saved on their profile can be chosen (BR-15). Add an optional note or reason. A **blocked** patient (BR-07) can't book, and sees the reason and how to appeal. Checkout depends on the payment mode that applies (PAY-05). On success the patient gets a **serial/token number**, the sitting date and time, and the clinic address. | P0 |
| PAT-11 | **Live queue tracking:** for an active booking, show **now serving**, **your number**, **patients ahead**, the estimated time of your turn, and the doctor's status (not arrived, online, on break, delayed). Updates arrive in real time. | P0 |
| PAT-11a | **Missed your turn:** when a booking is Late, the live screen explains what happened and offers **I'm here** (tells reception) and **Move to next sitting** (shows the new date and time before confirming). After reception confirms arrival it shows "Welcome back" with the patients still ahead (BR-06a). | P0 |
| PAT-12 | **"Turn is near" alerts:** a push alert when N patients are ahead (N can be set; default 3), and again when the patient is next. | P0 |
| PAT-13 | **Bookings tab:** upcoming, live and past bookings. Patients can cancel **only until the doctor's sitting starts** (BR-12a), and online payments are refunded per the refund policy (BR-12). After that the booking shows "Cancellation closed". They can rebook from past bookings. | P0 |
| PAT-14 | **Records tab:** upload and view prescriptions, reports and images for each family member, tagged by date and doctor, and share them with a doctor at booking time. | P1 |
| PAT-15 | **Assistant tab:** an AI helper that suggests a specialty from symptoms and links to search results. It shows a medical disclaimer every time and never diagnoses. Red-flag symptoms show an emergency (call 108/112) message. | P1 |
| PAT-16 | **Ratings and reviews:** after a visit is marked served, the patient can rate **the doctor** (1–5), **the clinic** (1–5: waiting time, cleanliness, staff, queue handling), or both, and leave one optional comment. There is one review per visit; the patient can edit it later. Only the account holder who booked can rate, and only served visits can be rated. Averages and counts are kept separately for the doctor and the clinic, and hidden reviews are excluded from both. Reviewers are shown publicly by first name only. Admins moderate reviews (ADM-13). | P1 |
| PAT-17 | **Notification centre** (bell): a list of all notifications with read and unread state. | P0 |
| PAT-18 | **Account:** profile, family members, language, notification settings, account security (AUTH-11), help and support, privacy, **delete account**. | P0 |
| PAT-19 | **No-show standing:** Account shows the patient's no-show count for each clinic and in total, the limits (3 at one clinic, 7 overall), and any active block. A warning appears after each no-show and again when the patient is one away from a block. | P0 |
| PAT-20 | **Ads:** ad placements in the patient app as allowed by MON-02 (for example, a Home banner, a native card between rails, or a sponsored result in search marked "Sponsored"). Ads never cover the live queue number, the booking button, or a payment screen. | P0 |

### 4.3 Doctor app (DOC)

Bottom tabs: **Queue · Schedule · Earnings · Patients · Profile**.

**User stories**
- As a doctor, I want to see every chamber and every sitting in one calm view.
- As a doctor, I want to control how far ahead patients can book.

| ID | Requirement | Priority |
|---|---|---|
| DOC-01 | **Verification:** the doctor uploads their registration number, council and degree certificate. The profile shows "Approved by Okidoc" once an admin approves it (ADM-03). Unverified doctors can set things up but can't be booked. | P0 |
| DOC-02 | **My schedule:** a "My week" header card, plus summary counts for **Chambers**, **Sittings** and **Days a week**. Tapping a chamber shows its contact details and fee. | P0 |
| DOC-03 | **Add a sitting:** choose a clinic (only linked clinics), weekday(s), start and end time, an optional maximum number of patients, and recurrence (weekly, alternate weeks, specific dates). | P0 |
| DOC-04 | **Days off and exceptions:** mark a date or range as off for one sitting or all of them. Patients already booked are notified (NTF matrix). | P0 |
| DOC-05 | **This week view:** Mon–Sun list of sittings with clinic and time. | P0 |
| DOC-06 | **Advance online booking limit:** the doctor's default booking window is 24 hours, 3 days, 7 days or 15 days. A clinic can set its own limit, and that wins (BR-03). | P0 |
| DOC-07 | **Clinic connection requests:** accept or decline requests from clinics to add the doctor. The doctor can also ask to join a clinic. | P0 |
| DOC-08 | **Queue tab:** the live queue for today's sittings: now serving, waiting, completed. The doctor can mark themselves arrived, on break or delayed (with minutes). Whether a doctor may run the queue themselves is a clinic setting. | P0 |
| DOC-09 | **Earnings:** per-chamber and per-sitting fees, the split with the clinic, Okidoc commission, history by week and month, and an export. | P1 |
| DOC-10 | **Patients:** a list of patients seen (with consent), visit history, and records the patient shared. | P1 |
| DOC-11 | **Profile:** public profile fields, photo, about, languages spoken, and the public profile preview. | P0 |
| DOC-12 | **Open slots:** the doctor posts free hours so clinics with an empty chamber can send a request (CLN-25). | P1 |

### 4.4 Clinic / Pharmacy app and web console (CLN)

Bottom tabs on mobile and tablet: **Queue · Walk-in · Doctors · Records · More**. The web console offers the same modules in a side navigation.

> Every CLN feature is subject to **admin feature entitlements** (ADM-02). If a clinic isn't entitled to a feature, the feature is hidden or shown as locked with "Contact Okidoc to enable", and the API rejects any calls to it.

**User stories**
- As a clinic owner, I want to register my clinic and add doctors so patients can book.
- As front-desk staff, I want to run today's queue and add walk-ins quickly on a tablet.

| ID | Requirement | Priority |
|---|---|---|
| CLN-01 | **Clinic registration:** name, type (Pharmacy chamber, Clinic, Polyclinic, Women's, Child, Dental, Eye, Bone & joint, …), address, GPS pin, area/PIN, contact, opening hours, photos. The clinic gets a unique **clinic code** (`OK-XXXXX`). | P0 |
| CLN-01a | **Opening hours (day by day):** each weekday is closed or has up to 3 time ranges (e.g. Mon–Wed 10 AM–10 PM; Fri 7–9 AM and 5–8 PM; open till midnight allowed). Overlapping or backwards ranges are rejected. Patients see the week (days with the same hours grouped) and "Open now · closes 10 PM" / "Closed · opens Fri 7 AM" on clinic cards and the clinic page. A sitting saved outside the hours is kept but flagged to whoever saved it; the clinic is told when a doctor adds one. Clinics that only have the older free-text hours keep them until they switch. | P1 |
| CLN-01b | **Add my area:** when the clinic's locality is not in the area list, the owner adds it (locality, PIN, district, state — any state or UT of India). A matching area (same name and PIN in that district) is reused instead of duplicated. Limit: 5 new areas per account per day. Admins can rename or deactivate areas (Taxonomy → Areas). | P0 |
| CLN-02 | **Registered empty state:** "<Clinic> is registered ✓" with the code, the text "Your queue console opens as soon as your first doctor is added…", and **Add your first doctor**. | P0 |
| CLN-03 | **Doctors & sittings roster:** a "Chamber roster" header card; summary counts for **Doctors**, **Scheduled** and **Active days**; search by doctor or specialty; a **Your doctors** list (avatar, name, specialty, degrees, status, number of sittings). Each row expands. | P0 |
| CLN-04 | **Add doctor:** search existing Okidoc doctors by name, phone or registration number and send a connection request. If the doctor isn't on Okidoc, invite them by SMS or WhatsApp. | P0 |
| CLN-05 | **Doctor link status:** each doctor shows one of **Approved by Okidoc · Sitting needed**, **Approved · N sittings**, **Verified**, **Not approved**, **Pending**, or **Declined**. A **Requests & changes** section lists declined or pending items with the reason ("This connection was declined, so no queue can run here…"). | P0 |
| CLN-06 | **Weekly chamber plan:** tap a doctor to see or change their weekly sittings at this clinic. Changes made by the clinic or the doctor sync both ways, and the doctor is notified. | P0 |
| CLN-07 | **Real-time roster sync:** saved changes refresh the Walk-in roster and queue console automatically, with no restart needed. | P0 |
| CLN-08 | **Queue console (tablet-first):** header with clinic name, "Clinic · Run today's queue", a **Today** date selector and a live clock (IST). It shows the selected doctor's sitting and status, plus **Now serving**, **Waiting** and **Completed** counters. | P0 |
| CLN-09 | **Doctor cards:** a horizontal list of today's doctors, each with a time range, an online/offline toggle and its status (Starts in 2 h 29 min, Online, Sitting over). | P0 |
| CLN-10 | **Put doctor online:** a "Selected doctor's upcoming sitting" card with **Put Dr X online**. Patients can only join the live queue once the doctor is online. The patient app shows offline status. | P0 |
| CLN-11 | **Queue actions:** **Call next**, **Mark present**, **Mark late**, **Skip / hold**, **Recall skipped**, **Mark no-show**, **Complete**. Advanced controls cover pause and resume queue, stop new bookings, delay the sitting by N minutes (patients are notified), end the sitting, and reorder for an emergency. | P0 |
| CLN-12 | **Walk-in entry:** quick add with name and phone (phone is optional for walk-ins). The patient gets the next token in the same queue as online bookings, and an SMS or WhatsApp token message is sent if a phone number was given. | P0 |
| CLN-13 | **Offline-tolerant walk-in:** if the network drops, walk-ins are queued locally and synced when the connection returns. Conflicts are resolved on the server (NFR-05). | P1 |
| CLN-14 | **Today's bookings tiles:** **Total**, **Online**, **Walk-in**, **Present** (green), **Late** (amber), **Cancelled** (red). Tapping a tile lists those patients, with one-tap **Call** or **WhatsApp**. | P0 |
| CLN-15 | **Records tab:** a daily register of visits by doctor and sitting, with search, date range filters and CSV export. | P1 |
| CLN-16 | **More › Queue Manager account:** create restricted staff logins for the clinic-wide queue and offline bookings. They have no access to finance, payment or profile settings. | P0 |
| CLN-17 | **More › Earnings & history:** per-chamber fees, the split, and what each sitting made. Filter by doctor and date. | P1 |
| CLN-18 | **More › Pharmacy / clinic profile & photos:** name, area, hours, about, and the photos patients see. | P0 |
| CLN-19 | **More › Fees & payment settings:** consultation fee per doctor, plus the **payment mode** chosen from the modes the admin allows (PAY-03). The mode can be overridden per doctor or per sitting. The applicable commission is shown read-only. Payout bank account or UPI details are captured with KYC. | P0 |
| CLN-20 | **More › Clinic booking limit:** an advance online-booking window that overrides the doctor default (BR-03). There is also a daily booking cut-off (for example, close online booking 30 minutes before the sitting ends). | P0 |
| CLN-20a | **More › Clinic profile › Late arrivals:** how many more patients a late patient waits behind once they arrive (0–5, default 2), see BR-06a. The queue console shows a **Missed their turn** list with Arrived, Recall now, Next sitting, Call and No-show, and highlights patients who tapped "I'm here". | P0 |
| CLN-21 | **More › Contact & support:** email or call Okidoc about bookings, the clinic or the account, plus in-app tickets. | P0 |
| CLN-22 | **More › Account, security & privacy:** sign-in security, Backup Code, your data (export), and account deletion. | P0 |
| CLN-23 | **More › Bonuses & Prizes:** progress in incentive campaigns run by Okidoc (for example, "0 patients · 0 doctors completed · Payable ₹0") (ADM-09). | P1 |
| CLN-24 | **More › Today's doctors poster:** a shareable image card listing today's sitting doctors and times, with the clinic QR code. It can be shared on WhatsApp or printed. | P1 |
| CLN-25 | **More › Open slots:** post an empty chamber or chair, see doctors' free hours (DOC-12), and send a connection request. | P1 |
| CLN-26 | **No-show handling:** at the end of a sitting, or by marking manually, unattended pay-at-clinic bookings are recorded as **no-show**. These records feed BR-07. The front desk can correct a wrong no-show on the same day; the correction is logged in the audit trail. | P0 |
| CLN-27 | **Blocked patients (clinic level):** a list of patients blocked at this clinic, with their no-show history. If the admin allows it (ADM-17), the clinic owner can lift a block **at their own clinic only**. | P1 |
| CLN-28 | **More › Subscription & billing:** shown only when subscriptions are turned on (MON-04). It shows the current plan, the features it includes, usage against limits, upgrade or downgrade, invoices, and payment method (Razorpay Subscriptions / UPI AutoPay). During a free period it shows "Free during pilot". | P1 |
| CLN-29 | **More › Ratings & reviews (owner only):** the clinic's average rating, a 5-to-1 star breakdown, and recent reviews with the clinic rating, the doctor rating and the patient's comment (first name only). Clinics cannot edit or hide reviews; they can raise a support ticket (CLN-21). | P1 |

### 4.5 Payments (PAY)

Payment behaviour is **configurable at two levels**:

1. **Admin level:** Okidoc decides what is allowed.
2. **Clinic level:** the clinic chooses within those limits.

> **Launch defaults (pilot):** Okidoc takes **no commission**, and the **booking fee is off**. The default mode is **Pay at clinic**. Online modes and fees stay available so the admin can switch them on later without a new release (section 4.7). The consultation fee always belongs to the clinic and doctor.

**Supported payment modes**

| Mode | Code | What the patient pays in the app | What the patient pays at the clinic |
|---|---|---|---|
| Pay at clinic | `PAY_AT_CLINIC` | Nothing | Full consultation fee. Okidoc only tracks it |
| Online booking fee | `ONLINE_BOOKING_FEE` | Booking / platform fee | Consultation fee |
| Full online prepayment | `ONLINE_FULL` | Consultation fee + booking fee (if any) | Nothing |

| ID | Requirement | Priority |
|---|---|---|
| PAY-01 | **Admin, platform settings:** the payment modes enabled on the platform, the default mode, the booking/platform fee (flat ₹ or %, **default off**), commission rules (flat or % for each mode, **default 0% / disabled**), GST settings, and the refund and cancellation policy. | P0 |
| PAY-02 | **Admin, scoped overrides:** any platform setting can be overridden **per region (state/district)** or **per clinic**. The admin can **lock** a setting so the clinic can't change it. | P0 |
| PAY-03 | **Clinic, mode selection:** the clinic chooses its default payment mode from the modes the admin allows, and can optionally override it **per doctor** or **per sitting**. Locked settings are read-only and show "Set by Okidoc". | P0 |
| PAY-04 | **Mode resolution:** the effective mode for a booking follows BR-09. The patient always sees the result clearly before confirming. | P0 |
| PAY-05 | **Patient checkout:** a fee breakdown (consultation fee, booking fee, taxes, total payable now, payable at clinic). Payment via **Razorpay** (UPI, cards, netbanking, wallets). Booking is confirmed only after payment succeeds (verified by webhook). An unpaid hold is released after 10 minutes. | P0 |
| PAY-06 | **Receipts:** an in-app receipt and invoice (PDF) for every online payment, also sent by SMS or WhatsApp. | P0 |
| PAY-07 | **Refunds:** automatic refunds according to BR-12, plus manual refunds by an admin with a reason. Refund status is shown to the patient. | P0 |
| PAY-08 | **Ledger:** every booking writes earning ledger entries (fee, clinic share, doctor share, Okidoc commission, booking fee, refund) in **all** modes, including pay at clinic, so reporting stays consistent. | P0 |
| PAY-09 | **Pay-at-clinic tracking:** the front desk can mark "Paid at clinic" (cash or UPI) for each visit, which feeds the earnings reports. | P1 |
| PAY-10 | **Settlements:** a settlement report per clinic and per doctor (due, paid, pending). In v1 payouts are manual and recorded by an admin. **Automated split payouts (Razorpay Route) come in Phase 2.** | P0 (report) / P2 (auto) |

### 4.6 Super-admin web portal (ADM)

| ID | Requirement | Priority |
|---|---|---|
| ADM-01 | **Dashboard:** live counts of clinics, doctors, today's sittings, bookings, online vs walk-in, and no-show rate. Revenue by stream: ads, subscriptions, booking fees, commission. | P0 |
| ADM-02 | **Clinic feature entitlements:** turn features **on or off per clinic**, or through **plans/tiers** (for example, Free, Standard, Pro) applied to many clinics, with per-clinic overrides. Features that can be controlled: online booking, walk-in, Queue Manager accounts (with a maximum count), Records, Earnings, payment modes (PAY-02), WhatsApp messaging, Today's doctors poster, Open slots, Bonuses & Prizes, web console access, and the maximum number of doctors and sittings. Changes apply in real time. | P0 |
| ADM-03 | **Verification queues:** review doctor KYC (registration number and council, degree) and clinic KYC (address proof, drug licence for pharmacies, photos). Approve, reject or ask for more information, with a reason sent to the user. | P0 |
| ADM-04 | **Clinic–doctor links:** view, approve or force-unlink connections, and resolve disputes. | P0 |
| ADM-05 | **Payment configuration:** the UI for PAY-01 and PAY-02, with a full change history. | P0 |
| ADM-06 | **Transactions:** search payments and refunds, issue manual refunds, and run reconciliation with Razorpay. | P0 |
| ADM-07 | **Settlements:** view what is due to each clinic and doctor, mark payouts as paid with a reference, and export. | P0 |
| ADM-08 | **User management:** search any user, block or unblock, force logout, reset quick login, and view audit history. | P0 |
| ADM-09 | **Bonuses & Prizes campaigns:** define a campaign (target metric such as patients onboarded or doctors added, reward ₹, period, eligible clinics), track progress and approve payouts. | P1 |
| ADM-10 | **Taxonomy and content:** specialties and their patient-friendly names, the clinic types, symptom-to-specialty mapping (used by search and the Assistant), areas and PIN codes, and banner content. | P0 |
| ADM-10a | **Areas and PIN codes:** the admin searches every area (active and inactive, by name, PIN, district or state) and sees how many clinics and people use each. The admin adds an area or edits one: name, Bengali name, PIN, district and state (moving it to that district), map location, and active. **CSV upload:** columns `area, pin, district, state` (required) and `area_bn, lat, lng, active` (optional); loose headers and state spellings are accepted. A preview lists each row as new, update, already listed or problem (bad PIN, unknown state, repeated row, half a location) before anything is saved; problem rows are skipped and a report can be downloaded. An area is identified by name + PIN + district, so re-uploading a file never creates duplicates. Areas are never deleted, only made inactive. | P0 |
| ADM-11 | **Localization:** manage translation strings for each language, with a missing-translation report. | P1 |
| ADM-12 | **Support tickets:** a ticket inbox with statuses, assignment and canned replies. | P1 |
| ADM-13 | **Reviews moderation:** see each review's doctor rating, clinic rating and comment; hide or restore reviews and handle reports. Hiding or restoring recalculates both the doctor and the clinic averages. | P1 |
| ADM-14 | **Admin RBAC and audit log:** admin roles (Super-admin, Ops, Finance, Support), with every change logged (who, what, when, before and after). | P0 |
| ADM-15 | **Revenue settings:** one screen with a switch for each revenue stream (MON-01). Each stream can be on or off globally, per region and per clinic, can have a start date, and every change is logged in the audit trail. | P0 |
| ADM-16 | **Ads manager:** set up ad networks, placements, frequency caps, category block lists and direct sponsored campaigns (MON-02, MON-03), with reports on impressions, clicks, eCPM and revenue. | P0 |
| ADM-17 | **No-show and block management:** view blocked patients and their history (clinic-level and platform-wide blocks), lift or extend a block with a reason, handle appeals, and set the thresholds in BR-07 and whether clinics may lift their own clinic-level blocks. | P0 |
| ADM-18 | **Subscription plans:** create plans (name, monthly or yearly price, included features and limits linked to ADM-02, trial length), assign plans or grant free periods to clinics or regions, and handle dunning (failed renewal leads to a grace period, then a downgrade to the Free plan). | P1 |

### 4.7 Monetization (MON)

**Model:**
- **In-app advertising is the main revenue at launch.**
- **Clinic subscriptions** are the long-term business model.
- Okidoc takes **no commission** on consultations.
- Every revenue stream is **configurable** (ADM-15). Streams that are off at launch can be switched on once the app has enough users and clinics, without an app release.

| Stream | What it is | Pilot default |
|---|---|---|
| **Ads** | Ad network ads plus direct sponsored placements in the patient app | **On** |
| **Clinic subscription** | Paid plans for clinics (feature tiers through ADM-02 / ADM-18) | **Off.** All clinics are on Free during the pilot |
| **Doctor subscription** | Optional premium for doctors (for example, profile boost or advanced analytics) | Off |
| **Patient booking fee** | Fee per online booking (PAY-01) | Off |
| **Commission** | Share of the consultation fee (BR-10) | Off (0%) |
| **Sponsored listings** | Clinics or doctors pay to appear at the top of search or rails, labelled "Sponsored" | Off |

| ID | Requirement | Priority |
|---|---|---|
| MON-01 | **Revenue stream switches:** every stream in the table above is controlled by the admin (ADM-15). When a stream is off, its UI is hidden everywhere: no subscription screen, no fee line at checkout, no sponsored badge. | P0 |
| MON-02 | **Ad placements (patient app):** Home banner, a native card between Home rails, an interstitial after a completed booking (capped at once a day), and a "Sponsored" slot in search results. Each placement can be turned on or off and given a frequency cap. **No ads** on the live queue screen, checkout, payment, OTP, passcode or Records screens. **No ads** in the Doctor app, the Clinic console or the Admin portal by default (this can be changed). | P0 |
| MON-03 | **Ad sources:** Google AdMob (or Ad Manager) first, with Okidoc's own server for direct sponsored campaigns (pharma-neutral health brands, diagnostics, local businesses). Ad categories can be blocked (for example, prescription drugs, alcohol, betting, unproven cures). | P0 |
| MON-04 | **Clinic subscriptions:** when switched on, each clinic is on a plan (Free / Standard / Pro). The plan sets entitlements (ADM-02). Billing is through Razorpay Subscriptions (UPI AutoPay, cards) with GST invoices. Plans include a trial and a grace period. A downgrade never deletes data; it only locks features. | P1 |
| MON-05 | **Ad privacy:** ads are contextual or non-personalised by default. Personalised ads need separate DPDP consent. **Health data (symptoms, records, specialties searched) is never shared with ad networks.** | P0 |
| MON-06 | **Ad-free option (future):** an optional paid "Okidoc Plus" for patients that removes ads. Controlled by MON-01 and off at launch. | P2 |
| MON-07 | **Sponsored listings:** when switched on, clinics or doctors can buy boosted placement by area or specialty. These are always labelled "Sponsored", and only verified, bookable providers are eligible (BR-14). | P2 |

---

## 5. Core domain model

| Entity | Key fields / notes |
|---|---|
| **User** | id, phone (unique), email?, name, language, status |
| **Credential** | userId, passwordHash, passcodeHash?, backupCodeHash?, failedAttempts |
| **Device / Session** | userId, deviceId, platform, biometricEnabled, devicePublicKey, refreshTokenHash, lastSeen |
| **RoleAssignment** | userId, role (PATIENT / DOCTOR / CLINIC_OWNER / QUEUE_MANAGER / ADMIN_*), clinicId? |
| **Plan / FeatureEntitlement** | plan → feature flags and limits; clinic → plan plus per-feature overrides |
| **PatientProfile / FamilyMember** | userId, members (name, gender, year of birth, relation) |
| **Doctor** | userId, registrationNo, council, degrees, specialties[], experienceYears, verification status, defaultBookingWindow |
| **Clinic** | code (OK-XXXXX), name, type, address, geo, area/PIN, hours, photos, verification status, bookingWindow?, cutoffMinutes, ratingAvg, ratingCount |
| **ClinicDoctorLink** | clinicId, doctorId, status (PENDING / APPROVED / DECLINED / REMOVED), fee, split |
| **Sitting** (recurring rule) | linkId, weekday(s), start, end, recurrence rule, maxPatients? |
| **SittingException** | sittingId or doctorId, date range, type (OFF / CHANGED_TIME) |
| **SittingInstance** | sittingId, date, status (SCHEDULED / ONLINE / PAUSED / ENDED / CANCELLED), delayMinutes, nowServingToken |
| **Booking / Token** | instanceId, patient/member, source (ONLINE / WALK_IN / OFFLINE), tokenNo, status (BOOKED / PRESENT / LATE / SKIPPED / SERVED / NO_SHOW / CANCELLED), paymentMode |
| **QueueEvent** | instanceId, type, actor, timestamp (event log used for ETA calculation and audit) |
| **PaymentConfig** | scope (PLATFORM / REGION / CLINIC / DOCTOR / SITTING), scopeId, allowedModes[], selectedMode, bookingFee, commission rules, locked |
| **Payment / Refund** | bookingId, gateway ids, amount, status, webhook log |
| **EarningLedger** | bookingId, entry type, party (clinic / doctor / Okidoc), amount |
| **Settlement** | party, period, amount due, amount paid, reference |
| **BonusCampaign / BonusProgress** | rules, period, clinic progress, payable |
| **Notification** | userId, channel, template, payload, status |
| **Review** | bookingId (one per visit), doctorId, clinicId, doctor rating?, clinic rating? (at least one), text, moderation status |
| **Record** | ownerId/memberId, type, file URL, doctorId?, date |
| **Area / PIN** | state, district, area name, PIN, geo |
| **NoShowRecord** | userId (account holder), memberId?, bookingId, clinicId, date, paymentMode, corrected? |
| **PatientBlock** | userId, phone, scope (CLINIC / PLATFORM), clinicId?, reason, noShowCount, createdAt, liftedBy?, liftedAt?, liftReason? |
| **RevenueSetting** | stream (ADS / CLINIC_SUB / DOCTOR_SUB / BOOKING_FEE / COMMISSION / SPONSORED), scope, enabled, effectiveFrom |
| **AdPlacement / AdCampaign** | placement key, enabled, frequency cap, network unit id; campaign: advertiser, creative, targeting (area, placement), dates, blocked categories |
| **SubscriptionPlan / ClinicSubscription** | plan: price, period, entitlements, trial; subscription: clinicId, planId, status (TRIAL / ACTIVE / GRACE / CANCELLED), gateway subscription id, invoices |

**Relationships:**
- A Clinic has many ClinicDoctorLinks.
- Each link has many Sittings.
- Each Sitting produces one SittingInstance per date.
- Each instance holds many Bookings/Tokens and QueueEvents.
- PaymentConfig and FeatureEntitlement apply from the broadest scope to the narrowest.

---

## 6. Key user flows

### 6.1 Patient sign-up and quick login
1. Open the app. Welcome screen › **Get started** › pick a language › **Patient**.
2. Enter phone + password, then verify the OTP.
3. Set up a passcode, or turn on fingerprint or device lock.
4. Fill in a basic profile, then land on Home.
5. Next launch: the passcode or biometric prompt opens Home.

### 6.2 Patient booking and live queue
1. Home › choose an area › search or browse › doctor profile.
2. Tick a sitting › **Book a visit** › choose a family member.
3. The app works out the payment mode (BR-09):
   - *Pay at clinic:* confirm.
   - *Online:* Razorpay checkout, then the webhook confirms the payment.
4. The patient gets a token number and a notification.
5. On the day:
   - When the doctor goes online, the patient is notified.
   - The live queue screen shows now serving and the ETA.
   - "Your turn is near" alert.
6. At the clinic the front desk marks the patient present, then calls them, then marks the visit complete.
7. The patient is asked to rate the visit.

### 6.3 Clinic onboarding
1. Sign up › **Clinic / Pharmacy** › clinic details and KYC › the clinic code is issued.
2. Empty state › **Add your first doctor** › search or invite.
3. The doctor accepts the link (or the admin approves it), then the weekly sittings are set up.
4. The admin approves the clinic KYC. The clinic now appears in patient search, and the queue console opens.

### 6.4 Running today's queue (front desk)
1. Open the Queue tab and choose a doctor card.
2. When the doctor arrives, tap **Put Dr X online**.
3. Add walk-ins as they come. Mark online patients present or late as they arrive.
4. **Call next** repeatedly. Skip, recall or mark no-show as needed.
5. Use the tiles to call or WhatsApp late patients.
6. **End sitting**. Pay-at-clinic tokens not marked present are recorded as **no-shows** (CLN-26), which may trigger a block (BR-07).

### 6.5 Doctor delayed or cancels a sitting
1. The doctor or clinic sets "Delayed by 30 min" or cancels the sitting instance.
2. All booked patients get a bulk notification by push, SMS or WhatsApp.
3. For a cancellation, online payments are refunded automatically (BR-12), and the patient is offered the next available sitting.

### 6.6 Admin enables a feature for a clinic
1. Admin portal › Clinics › select a clinic › Entitlements.
2. Turn on, for example, "Online full prepayment" and "Today's doctors poster".
3. The change is saved and recorded in the audit log.
4. The clinic app updates in real time, and the new options appear under More › Fees & payment settings.

---

## 7. Business rules

| ID | Rule |
|---|---|
| BR-01 | **Tokens are numbered per sitting instance**, starting at 1. Online bookings and walk-ins share one sequence. The clinic can reserve a block of numbers for walk-ins (for example, odd numbers or every 3rd), which can be configured. |
| BR-02 | A patient can join the live queue only when the doctor is **online** for that sitting. Advance bookings are allowed before then, but the queue doesn't move. |
| BR-03 | **Booking window:** patients can book up to N days ahead. The clinic setting (if set) wins over the doctor default (24 hours, 3, 7 or 15 days). |
| BR-04 | **Booking cut-off:** online booking closes X minutes before the sitting ends, or when maxPatients is reached. Walk-ins can still be added by the front desk. |
| BR-05 | **Active booking limit:** a patient can hold at most 3 active bookings at once, and at most 1 per sitting per family member. |
| BR-06 | **Late:** a patient not marked present by the time their token is called is moved to the "Late" bucket, and can be recalled after the current patient. |
| BR-06a | **Missed turn — attend later:** a patient who missed their turn is never simply dropped. <br>• The moment their token is passed they are told (push + SMS): "You missed your turn". <br>• **Rejoin:** when they reach the clinic they tap **"I'm here"** in the app (reception sees it) and reception taps **Arrived**. They are then called after **N more patients** — a clinic setting (CLN-20a, default 2; 0 = right after the current patient). Staff can still **Recall now** to call them next. If nobody else is waiting they are seen at once. <br>• **Move to next sitting:** the patient (once per booking, while Booked or Late) or the clinic (any waiting booking) can move the visit to the doctor's **next sitting at the same clinic** within 14 days. The same booking moves with a new token, so any online payment carries over; the patient is notified with the new date, time and token. <br>• **Ending a sitting** offers to move patients still marked Late to the next sitting instead of recording a no-show (BR-07). |
| BR-07 | **No-show blocking (pay-at-clinic bookings):** a booking made in **Pay at clinic** mode that is still not marked present when the sitting ends becomes a **no-show**. Counts are kept **for the lifetime of the account** and do not reset. <br>• **3 no-shows at the same clinic:** the patient is **blocked from booking at that clinic**. <br>• **7 no-shows in total, across all clinics:** the patient is **blocked from booking on the whole platform**. <br>Both thresholds can be changed by the admin (ADM-17). |
| BR-07a | **What counts:** only pay-at-clinic bookings. Bookings cancelled within the cancellation window, sittings cancelled by the doctor or clinic, and no-shows the front desk corrects on the same day **do not count**. No-shows on online-paid bookings don't count either, because the payment already covers the clinic. A no-show booked for a family member counts against the **account holder**. |
| BR-07b | **Effects of a block:** a blocked patient can't make online bookings (at that clinic, or anywhere for a platform block) but can still see the app and their history. Existing future bookings at the blocked scope are cancelled, and the patient is notified. They can still be seen as a **walk-in** at the clinic desk. Blocks are linked to the **verified phone number**, so deleting the account and signing up again doesn't remove them. |
| BR-07c | **Lifting a block:** a platform block can be lifted only by an Okidoc admin. A clinic block can be lifted by an admin, or by the clinic owner if the admin allows it (CLN-27). Every lift has a reason, is logged in the audit trail, and the counts stay on record. The patient can appeal through Contact & support. |
| BR-08 | **ETA:** based on the rolling average consultation time for that doctor and sitting (default 7 minutes), the number of patients ahead, and any delay. It is shown as a range. |
| BR-09 | **Payment mode resolution:** the most specific scope wins, in this order: **Sitting › Doctor › Clinic › Region › Platform default**. The result must be in the admin's allowed-modes list for that clinic. A setting the admin has **locked** at a broader scope can't be overridden by a narrower one. |
| BR-10 | **Commission (off at launch, 0%):** when the admin turns it on (MON-01), it is computed per booking from the commission rule for its payment mode. Shares are clinic share = fee × clinic split, doctor share = fee − clinic share − commission (if commission is charged to the fee), and the booking fee goes to Okidoc. The formulas are set by the admin. |
| BR-11 | **Feature entitlement** is checked by the API on every request. Turning a feature off mid-day doesn't cancel existing bookings. |
| BR-12 | **Refunds (default, set by the admin):** doctor or clinic cancels: 100% refund. Patient cancels at least 2 hours before the sitting: 100% minus the booking fee. Patient cancels less than 2 hours before, or doesn't show: no refund. |
| BR-12a | **Cancellation window and absence:** a patient can cancel a booking only **until the sitting's scheduled start time** (or until the doctor goes online, if earlier). After that the cancel option is removed and the API refuses it. A patient who does not visit is **marked absent** when the sitting ends (by the clinic, or automatically 60 minutes after the end time) and is notified. Absence counts toward the no-show limits only for pay-at-clinic bookings (BR-07). An unpaid payment hold can still be dropped. **Clinics can still cancel** any waiting booking at any time, including after the sitting has started: staff give a reason (for example "Doctor unavailable" or "Patient asked to cancel"), online payments are refunded in full, and the patient is notified by push and SMS with the reason (walk-ins with a phone number get an SMS). The patient's "Cancellation closed" message points them to call the clinic. A patient who missed their turn can still move once to the next sitting (BR-06a). |
| BR-13 | **Bonus payout:** campaign rewards are payable only after the admin approves them and the targets are verified (for example, the patient completed a visit). |
| BR-14 | **Verification gating:** only verified doctors at verified clinics with an approved link can be booked online. |
| BR-15 | **Who can be booked for:** only the logged-in account holder or a family member saved on their profile. Okidoc doesn't support booking for someone outside the account, or booking by phone call on a patient's behalf. People without the app are served only as **walk-ins** at the clinic desk. |
| BR-16 | **Revenue stream switch:** turning a stream on or off affects only new bookings and billing periods. Existing bookings keep the fees shown when they were made. |

---

## 8. Notifications (NTF)

Channels:
- **Push:** Firebase Cloud Messaging (FCM) for Android, APNs for iOS.
- **SMS:** fallback and OTP.
- **WhatsApp Business:** template messages.
- **In-app:** the notification centre.

Notifications follow the user's chosen language.

| Trigger | Patient | Doctor | Clinic | Channels |
|---|:-:|:-:|:-:|---|
| Booking confirmed (token number) | ✅ | — | ✅ (feed) | Push, WhatsApp/SMS |
| Payment success / refund | ✅ | — | — | Push, SMS |
| Reminder (evening before and 1 hour before) | ✅ | — | — | Push, WhatsApp |
| Doctor is online / queue started | ✅ | — | — | Push |
| Your turn is near (N ahead) / you're next | ✅ | — | — | Push, SMS fallback |
| Doctor delayed (N min) | ✅ | — | ✅ | Push, WhatsApp/SMS |
| Sitting cancelled | ✅ | ✅ | ✅ | Push, WhatsApp/SMS |
| Clinic connection request / response | — | ✅ | ✅ | Push |
| Sitting changed by the other party | — | ✅ | ✅ | Push |
| Verification approved / rejected | — | ✅ | ✅ | Push, SMS |
| Feature entitlement changed | — | — | ✅ | Push, in-app |
| Rate your visit | ✅ | — | — | Push |
| Bonus milestone reached | — | — | ✅ | Push |
| No-show recorded / one away from a block | ✅ | — | — | Push, SMS |
| Patient blocked (clinic or platform) / block lifted | ✅ | — | ✅ (clinic blocks) | Push, SMS |
| Subscription trial ending / renewal failed / plan changed | — | — | ✅ | Push, WhatsApp, email |

Users can turn off non-critical notifications. OTPs, payment messages and cancellations are always sent.

---

## 9. Non-functional requirements (NFR)

| ID | Requirement |
|---|---|
| NFR-01 | **Real-time:** a queue change appears on patient devices within **2 seconds** (p95) over WebSocket. Clients fall back to polling every 15 seconds. |
| NFR-02 | **Availability:** 99.5% monthly uptime for the API. Planned maintenance happens outside OPD peak hours (09:00–13:00 and 17:00–21:00 IST). |
| NFR-03 | **Performance:** API p95 under 300 ms for reads. App cold start under 3 seconds on a 2 GB RAM Android device. Home screen usable on 3G. |
| NFR-04 | **Scale:** the **West Bengal pilot** plans for 1,500 clinics, 5,000 doctors, 300,000 patients and 20,000 bookings a day. The architecture must scale to the **year-1 India-wide target** without a redesign: 10,000 clinics, 30,000 doctors, 2 million patients, 200,000 bookings a day, and 50,000 concurrent live-queue viewers at peak. |
| NFR-05 | **Offline tolerance:** walk-in entry and queue actions are buffered on the device during short outages and synced with server-side conflict resolution. Patient screens show the last-updated time. |
| NFR-06 | **Device support:** Android 8+ and iOS 15+. Phone and tablet layouts for both orientations. Web console supports the latest 2 versions of Chrome, Edge and Firefox. |
| NFR-07 | **Accessibility:** WCAG 2.1 AA contrast, dynamic text size, screen-reader labels, touch targets of at least 44 pt. |
| NFR-08 | **Localization:** i18n from day one, with every string externalised. Launch languages are Bengali, English and Hindi (all fully translated for the West Bengal pilot). The next wave, after the pilot, is Tamil, Telugu, Marathi, Kannada, Gujarati, Malayalam, Odia and Punjabi. Formats follow Indian conventions (₹, lakh/crore, DD MMM, 12-hour clock with IST). Fonts must render every supported script. The layout is ready for right-to-left text (Urdu). |
| NFR-09 | **Security:** passwords hashed with argon2id. The passcode is never stored on the device; it is checked on the server against a salted hash and bound to the device. Biometric login unlocks a device-bound key in the Android Keystore or iOS Keychain, which signs the refresh request, so biometric data never leaves the device. Short-lived JWT access tokens (15 minutes) and rotating refresh tokens. Rate limits on OTP and login. TLS 1.2+ everywhere. AES-256 encryption at rest for PII and records. Role-based access control plus entitlement checks. OWASP MASVS and ASVS L2 as the baseline. |
| NFR-10 | **Privacy:** collect only the data needed. Records are visible only to the patient and the doctors they share with. Patient phone numbers are masked from doctors unless needed for the visit. |
| NFR-11 | **Observability:** structured logs, metrics, tracing, error tracking (for example, Sentry), and alerts on queue lag and payment webhook failures. |
| NFR-12 | **Backup and disaster recovery:** daily database backups plus point-in-time recovery. RPO 15 minutes, RTO 4 hours. Data hosted in India. |

---

## 10. Compliance and legal

- **Digital Personal Data Protection (DPDP) Act 2023:**
  - Explicit, purpose-specific consent, with a consent record.
  - Notice in the user's language.
  - The rights to access, correct and delete data, and to withdraw consent.
  - A named grievance officer and published contact details.
  - Data breach notification process.
- **Health data:** treated as sensitive. Records are encrypted, and there is an access log.
- **Doctor verification:** check against the **National Medical Commission (NMC)** or state medical council registration. Doctors may only be listed with a valid registration.
- **Pharmacy clinics:** collect a drug licence number for pharmacy-type clinics.
- **Payments:** Razorpay handles card data under PCI-DSS, so Okidoc never stores card data. GST invoices for platform and booking fees.
- **AI Assistant:** clear "not medical advice" disclaimer, no diagnosis, emergency redirection, and conversation logs kept with consent only.
- **ABHA / ABDM** (India's national digital health ID): optional linking of a patient's health ID and health records, planned for Phase 2.
- **App stores:** follow Google Play and Apple health-app policies, with in-app account deletion.
- **Advertising:**
  - Follow the ASCI code and its healthcare guidelines, and the Drugs and Magic Remedies (Objectionable Advertisements) Act. Block prescription-drug and "miracle cure" ads.
  - Label ads and sponsored listings clearly.
  - Follow Google Play's Ads and health-content policies and the AdMob policies.
  - Apple App Tracking Transparency prompt on iOS before any personalised ads.
  - DPDP consent for personalised ads, and no health data is ever used for ad targeting (MON-05).
- **No-show blocks:** the terms of use state the no-show policy (BR-07). Patients are told before their first pay-at-clinic booking, and there is an appeal route through the grievance officer.
- **Subscriptions:** GST invoices for clinic plans. UPI AutoPay mandates follow RBI e-mandate rules (pre-debit notification).

---

## 11. Proposed technical architecture

### 11.1 Stack

| Layer | Choice |
|---|---|
| Mobile | **Bare React Native (React Native CLI, TypeScript, no Expo)**, React Navigation, TanStack Query, Zustand, Socket.IO client, `react-native-keychain` for biometric/device-lock and passcode login, `react-native-vision-camera` for QR scanning, Firebase Cloud Messaging for push, `react-native-google-mobile-ads` for AdMob, `react-native-razorpay` for checkout |
| Web | **Next.js (React, TypeScript)** for the Admin portal and Clinic console, sharing UI tokens with mobile |
| API | **Node.js (TypeScript) on NestJS** (modular, guards for RBAC and entitlements), REST + OpenAPI, **Socket.IO** gateway for live queues |
| Data | **PostgreSQL** (via Prisma), **Redis** (queue state cache, pub/sub across socket nodes, rate limits), **BullMQ** (notifications, reminders, settlements) |
| Search | PostgreSQL full-text search + trigram (with transliteration synonyms) for v1. Move to Meilisearch or OpenSearch if needed |
| Files | S3-compatible object storage, hosted in India, with signed URLs |
| Payments | **Razorpay** (Orders, Payments, Refunds, webhooks), **Razorpay Subscriptions** for clinic plans (when enabled). Route for split payouts in Phase 2 |
| Ads | **Google AdMob** through `react-native-google-mobile-ads` (banner, native, interstitial), with Google UMP for consent. An Okidoc ad-serving module in the API for direct sponsored campaigns, with remote config for placements and caps |
| Config / feature flags | Revenue settings, entitlements and ad placements stored in PostgreSQL, cached in Redis, and pushed to clients over the socket. No app release needed to change them |
| Messaging | FCM / APNs, SMS and WhatsApp Business through an Indian provider (for example, MSG91 or Gupshup) |
| AI Assistant (P1) | An LLM API behind an Okidoc service, limited to mapping symptoms to specialties |
| Infra | Docker containers, a managed Kubernetes or container service in an India region, CI/CD |
| Source control | Internal Azure DevOps (`*.amat.com`), the approved git host |

### 11.2 Monorepo layout

```
okidoc/
├── apps/
│   ├── mobile/        # Bare React Native (CLI) – Patient, Doctor, Clinic
│   ├── web/           # Next.js – Clinic console + Admin portal
│   └── api/           # NestJS – REST + WebSocket + jobs
├── packages/
│   ├── shared/        # Types, zod schemas, constants, business-rule utils
│   ├── ui-tokens/     # Colors, typography, spacing
│   └── i18n/          # Translation bundles
└── infra/             # Docker, IaC, CI pipelines
```

### 11.3 High-level diagram

```
 ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐
 │ RN app       │  │ Web: Clinic  │  │ Web: Admin portal  │
 │ Pt/Dr/Clinic │  │ console      │  │                    │
 └──────┬───────┘  └──────┬───────┘  └─────────┬──────────┘
        │ HTTPS / WSS     │                    │
        └────────┬────────┴─────────┬──────────┘
                 ▼                  ▼
          ┌─────────────┐   ┌──────────────┐
          │ API (NestJS)│◄─►│ Socket.IO GW │
          │ REST + RBAC │   └──────┬───────┘
          │ Entitlements│          │ pub/sub
          └──┬───┬───┬──┘   ┌──────▼──────┐
             │   │   └─────►│   Redis     │
             │   │          └──────▲──────┘
             │   ▼                 │
             │ ┌─────────────┐  ┌──┴─────────┐
             │ │ PostgreSQL  │  │ BullMQ jobs│──► FCM/APNs, SMS, WhatsApp
             │ └─────────────┘  └────────────┘
             ▼
     Razorpay (orders, webhooks)   S3 storage (photos, records)
```

---

## 12. Design system notes

These notes come from the proposed screens:

- **Brand feel:** calm, clinical, modern. "Every doctor. Every sitting. One calm view."
- **Colours:**
  - Deep navy/teal gradient headers (around `#0B2A3A` to `#0E3B4A`).
  - **Teal primary** (around `#14B8A6`) for primary buttons and active chips.
  - Light mint-white content area (around `#F3FAF9`) with white cards.
  - Status colours: green for present, approved and online; amber for late and starting soon; red for cancelled, declined and not approved.
- **Typography:** a geometric sans serif (for example, Inter or Plus Jakarta Sans) plus Noto Sans fonts for Indic scripts.
- **Components:**
  - Rounded cards (16 px radius) and pill toggles (Doctors / Pharmacies-clinics).
  - Chip rails for specialties.
  - Summary stat strips (three counters).
  - A **floating pill bottom navigation** with a highlighted active tab.
  - A **floating circular notification bell**.
  - Header "hero" cards with an icon (for example, "My week", "Chamber roster").
  - Empty states with an illustration, a short explanation and one primary action.
  - Live analog clock with IST time on the clinic console.
- **Tablet:** the clinic console and roster use wider multi-column layouts (doctor cards in a horizontal row, a grid of booking tiles).
- **Dark welcome and role screens:** dark teal background with glowing curves, and a large primary CTA at the bottom.

---

## 13. Success metrics

| Metric | Target (6 months after launch) |
|---|---|
| Verified clinics live (West Bengal pilot) | 1,000 |
| Weekly active sittings (with at least 1 booking) | 5,000 |
| Online bookings as a share of all tokens | ≥ 35% |
| Reduction in average patient wait (self-reported or measured at check-in) | ≥ 40% |
| Patient D30 retention | ≥ 25% |
| No-show rate on pay-at-clinic bookings | ≤ 12% |
| Patients blocked (platform-wide) as a share of active patients | ≤ 1% |
| Monthly ad revenue / eCPM (patient app) | Set after the first month (baseline), then grow 15% month on month |
| Ad fill rate | ≥ 85% |
| Readiness to turn on subscriptions | ≥ 1,000 active clinics and ≥ 60% weekly-active clinics (the trigger for MON-04) |
| Queue update latency p95 | < 2 s |
| Online payment success rate | ≥ 95% |
| Crash-free sessions | ≥ 99.5% |

---

## 14. Release plan

| Phase | Scope |
|---|---|
| **MVP (P0)** | Auth (phone + password, OTP verification, passcode and biometric quick login). Patient discovery, search, QR, booking, live queue, bookings tab. Doctor verification, schedule, sittings, booking window, clinic links, queue view. Clinic registration, roster, queue console (phone, tablet and web), walk-ins, booking tiles, Queue Manager, fees and payment settings. **Configurable payment modes at admin and clinic level with Razorpay**, refunds, ledger, settlement report. **No-show tracking and blocking (BR-07)**. **Ads in the patient app (AdMob + sponsored) and the revenue settings switches**, with commission and booking fee off. Admin portal: entitlements, verification, payment config, revenue settings, ads manager, block management, transactions, users, taxonomy, audit. Notifications. Bengali, English and Hindi. **Pilot: West Bengal.** |
| **Phase 1.5 (P1)** | Assistant, Records (patient and clinic), ratings and reviews, Earnings screens, Open slots, Today's doctors poster, Bonuses & Prizes, Backup Code, offline walk-in sync, multi-role accounts, support tickets, localization admin, clinic-level block lifting, **clinic subscription plans and billing (built, then switched on when the readiness metric is met)**. Expansion beyond West Bengal and the next wave of languages. |
| **Phase 2 (P2)** | Automated split settlements (Razorpay Route), ABHA/ABDM linking, teleconsultation, pharmacy order hand-off, lab bookings, sponsored listings, ad-free "Okidoc Plus", doctor subscriptions. |

---

## 15. Risks, assumptions and open questions

### Risks
- **Clinic adoption:** front-desk staff used to paper registers may resist the change. *Mitigation:* tablet-first quick UI, walk-in entry in about 5 seconds, on-site onboarding, Bonuses & Prizes.
- **No-shows on free (pay-at-clinic) bookings** could disrupt queues. *Mitigation:* reminders, warnings, automatic blocks at 3 no-shows per clinic and 7 overall (BR-07), and online booking fees as an optional later step.
- **Wrongful blocks** (for example, the front desk forgot to mark a patient present) could anger patients. *Mitigation:* same-day correction (CLN-26), warnings before a block, and an appeal and admin lift (ADM-17).
- **Ad-dependent revenue** is small until there are many users, and too many ads could hurt trust in a health app. *Mitigation:* strict placement rules (MON-02), category blocking, frequency caps, and turning on subscriptions once there is traction.
- **ETA accuracy:** consultation times vary. *Mitigation:* show a range and learn from the QueueEvent history.
- **Payment complexity:** layered configuration can confuse users. *Mitigation:* always show the effective mode and the "Set by Okidoc" lock state.
- **Connectivity:** rural chambers have weak networks. *Mitigation:* offline buffer and an SMS fallback.

### Assumptions
- Clinics will have at least one smartphone or tablet at the front desk.
- Doctors will accept a clinic-managed schedule that they can review.
- At launch Okidoc earns from **in-app ads**. **Clinic subscriptions** are switched on once there are enough users and clinics. Commission and booking fees stay off but are available.
- The pilot runs in **West Bengal**. Area/PIN data and specialty names are seeded for West Bengal first (including Bengali names).

### Open questions
1. What are the subscription plan prices and features (Free / Standard / Pro), and how long is the free period for pilot clinics?
2. Does the doctor's earning split get settled directly between clinic and doctor, with Okidoc only recording it? (Assumed yes, since there is no commission.)
3. Should walk-in token blocks (BR-01) be on by default?
4. What are the exact rules and budget for Bonuses & Prizes?
5. How long are records and queue history kept (retention policy)?
6. How much offline mode does v1 need: walk-in only, or the full queue?
7. Can a clinic owner lift their own clinic-level blocks by default, or only an admin? (Assumed: admin only at launch, with clinic lifting switchable.)
8. Should a platform-wide block ever expire on its own (for example, after 12 months), or stay until an admin lifts it? (Assumed: it stays until lifted.)
9. Which districts come first in the West Bengal pilot (for example, Kolkata, North 24 Parganas, Nadia)?
10. Are ads also allowed in the Doctor app or Clinic console later, or only ever in the patient app?

**Resolved in v0.2:**
- Pilot state: West Bengal.
- Revenue: ads first and subscriptions as the model. Commission is off.
- Booking for people outside the account: **not allowed** (BR-15).

---

## 16. Appendix

### 16.1 Screen inventory (from the proposed UI)

| # | Screen (marketing caption) | Role / surface | Requirement IDs |
|---|---|---|---|
| 1 | "Explore clinics nearby": Home, Pharmacies/clinics view | Patient · phone | PAT-01, PAT-02, PAT-03, PAT-04, PAT-06, PAT-17 |
| 2 | "Find care close to you": Home, Doctors view | Patient · phone | PAT-04, PAT-05 |
| 3 | "See when your doctor is available": doctor profile and slot list | Patient · phone | PAT-08, PAT-09, PAT-10 |
| 4 | "Your week, at a glance": My schedule | Doctor · phone | DOC-02, DOC-03, DOC-05, DOC-06 |
| 5 | "Know your queue. Skip the wait.": Welcome | All · phone | AUTH-01 |
| 6 | "Start your clinic on Okidoc": console empty state | Clinic · phone | CLN-01, CLN-02 |
| 7 | "Build your chamber roster": roster empty state | Clinic · phone | CLN-03, CLN-04, CLN-07 |
| 8 | "One app. Three ways to care.": role selection | All · tablet | AUTH-03 |
| 9 | "Run today's queue with clarity.": queue console | Clinic · tablet | CLN-08, CLN-09, CLN-10, CLN-11, CLN-12, CLN-14 |
| 10 | "Every doctor. Every sitting. One calm view.": populated roster | Clinic · tablet | CLN-03, CLN-05, CLN-06, CLN-07 |
| 11 | "All your clinic tools, in one place.": More menu | Clinic · tablet | CLN-16 to CLN-25, PAY-03 |

### 16.2 Glossary

| Term | Meaning |
|---|---|
| **OPD** | Outpatient department: consultations without admission |
| **Chamber** | A place (often inside a pharmacy or clinic) where a doctor regularly sees patients |
| **Sitting** | A recurring time block when a doctor sits at a chamber (for example, Mon 6–8 PM) |
| **Sitting instance** | One dated occurrence of a sitting |
| **Serial / Token** | The patient's queue number for a sitting instance |
| **Walk-in** | A patient registered at the clinic desk instead of booking online |
| **Queue Manager** | A restricted clinic staff account that runs the queue |
| **Entitlement** | A feature or limit that the Okidoc admin turns on for a clinic |
| **Payment mode** | How a booking is paid: at the clinic, online booking fee, or full online |
| **Clinic code** | A unique Okidoc identifier for a clinic (`OK-XXXXX`) |
