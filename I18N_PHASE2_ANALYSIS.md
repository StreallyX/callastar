# Callastar - Phase 2 Internationalization Analysis

## Date: December 29, 2025

---

## 1. Pages Already Translated (Phase 1) ✅

The following 8 priority pages in `app/[locale]` are fully translated:

1. **Homepage** - `app/[locale]/page.tsx`
2. **Login** - `app/[locale]/auth/login/page.tsx`
3. **Register** - `app/[locale]/auth/register/page.tsx`
4. **Creators List** - `app/[locale]/creators/page.tsx`
5. **Creator Profile** - `app/[locale]/creators/[id]/page.tsx`
6. **Booking** - `app/[locale]/book/[offerId]/page.tsx`
7. **Call Room** - `app/[locale]/call/[bookingId]/page.tsx`
8. **Call Summary** - `app/[locale]/call/[bookingId]/summary/page.tsx`

### Legal Pages (with TODO markers)
- **Terms of Service** - `app/[locale]/legal/terms/page.tsx`
- **Privacy Policy** - `app/[locale]/legal/privacy/page.tsx`
- **Legal Notice** - `app/[locale]/legal/notice/page.tsx`

---

## 2. Pages NOT Yet Translated ❌

### Dashboard Pages (31 pages outside app/[locale] directory)

#### Admin Dashboard (13 pages)
1. `app/dashboard/admin/page.tsx` - Admin Overview
2. `app/dashboard/admin/creators/[id]/stripe/page.tsx` - Stripe Setup for Creator
3. `app/dashboard/admin/logs/page.tsx` - System Logs
4. `app/dashboard/admin/notifications/page.tsx` - Admin Notifications
5. `app/dashboard/admin/payments/page.tsx` - Payments Management
6. `app/dashboard/admin/payouts/page.tsx` - Payouts Overview
7. `app/dashboard/admin/payouts/dashboard/page.tsx` - Payouts Dashboard
8. `app/dashboard/admin/refunds-disputes/page.tsx` - Refunds & Disputes
9. `app/dashboard/admin/refunds/page.tsx` - Refunds Management
10. `app/dashboard/admin/settings/page.tsx` - Admin Settings
11. `app/dashboard/admin/system-logs/page.tsx` - System Logs
12. `app/dashboard/admin/testing/page.tsx` - Testing Tools
13. `app/dashboard/admin/fees/page.tsx` - Fees Management

#### Creator Dashboard (11 pages)
1. `app/dashboard/creator/page.tsx` - Creator Overview
2. `app/dashboard/creator/calls/page.tsx` - Calls Management
3. `app/dashboard/creator/earnings/page.tsx` - Earnings Overview
4. `app/dashboard/creator/fees/page.tsx` - Fees Information
5. `app/dashboard/creator/notifications/page.tsx` - Creator Notifications
6. `app/dashboard/creator/offers/page.tsx` - Offers Management
7. `app/dashboard/creator/payment-setup/page.tsx` - Payment Setup
8. `app/dashboard/creator/payments/page.tsx` - Payments History
9. `app/dashboard/creator/payouts/page.tsx` - Payouts Overview
10. `app/dashboard/creator/payouts/request/page.tsx` - Request Payout
11. `app/dashboard/creator/payouts/settings/page.tsx` - Payout Settings
12. `app/dashboard/creator/requests/page.tsx` - Booking Requests
13. `app/dashboard/creator/reviews/page.tsx` - Reviews & Ratings
14. `app/dashboard/creator/settings/page.tsx` - Creator Settings

#### User Dashboard (6 pages)
1. `app/dashboard/user/page.tsx` - User Overview
2. `app/dashboard/user/calls/page.tsx` - My Calls
3. `app/dashboard/user/history/page.tsx` - Call History
4. `app/dashboard/user/notifications/page.tsx` - User Notifications
5. `app/dashboard/user/requests/page.tsx` - My Requests
6. `app/dashboard/user/settings/page.tsx` - User Settings

---

## 3. Phase 2 Implementation Plan

### Priority Tasks (Must Complete)

#### Task 2: Improve Homepage Content ✅
- Rewrite homepage to better explain Callastar platform
- Add comprehensive features section
- Add user journey section
- Improve call-to-action
- Translate all content to FR and EN

#### Task 3: Create Footer Component ✅
- Create `components/footer.tsx`
- Add links to legal pages (CGU, Privacy, Legal Notice)
- Make it discreet but accessible
- Translate to FR and EN

#### Task 4: Add Footer to Layout ✅
- Add Footer component to `app/[locale]/layout.tsx`
- Ensure it appears on all pages

#### Task 5: Add Terms Acceptance on Register ✅
- Add checkbox "I accept the terms and conditions"
- Link to `/legal/terms`
- Client-side validation
- Server-side validation
- Error messages
- Translate to FR and EN

### Extended Tasks (Dashboard Translation)

#### Task 6: Translate Dashboard Pages 🔄
This is a massive undertaking that requires:
1. Moving all dashboard pages from `app/dashboard/` to `app/[locale]/dashboard/`
2. Converting all pages to use i18n
3. Adding all translation keys to `messages/fr.json` and `messages/en.json`
4. Testing all functionality still works
5. Updating all navigation links

**Estimated Complexity:** High - This would require translating 31 pages with complex components, forms, tables, and business logic.

---

## 4. Recommendations

### For Immediate Phase 2 Completion:
1. ✅ Complete Tasks 2-5 (Homepage, Footer, Terms Acceptance)
2. ✅ Commit these changes
3. 📋 Create a separate Phase 3 plan for dashboard translation

### For Phase 3 (Dashboard Translation):
- This should be a separate, dedicated phase
- Requires careful planning to avoid breaking existing functionality
- Should be done incrementally (one dashboard section at a time)
- Requires extensive testing

---

## 5. Technical Notes

- All pages in `app/[locale]` use `next-intl` with `useTranslations()` or `getTranslations()`
- Dashboard pages currently use hardcoded English text
- Moving dashboard pages to `app/[locale]/dashboard/` will require:
  - Route updates in all navigation components
  - Middleware adjustments
  - Auth guard updates
  - API route adjustments

---

## Status: Analysis Complete ✅

**Next Step:** Proceed with Tasks 2-5 (Homepage improvements, Footer, Terms acceptance)
