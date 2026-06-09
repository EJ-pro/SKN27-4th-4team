# Mobile UI Audit

Date: 2026-06-10, before 09:00 KST
Scope: 320px, 344px, 360px, and 390px mobile viewport checks on the local Vite app.
Rule: Do not push. Do not mark mobile UI as done while known risks remain.

## Latest Check

Checked routes:
- `/`
- `/exercise`
- `/routine`
- `/login`
- `/register`
- `/consult`

Current numeric result:
- `/exercise`, `/routine`, `/login`, `/register`, `/consult`: no meaningful horizontal overflow at 360px or 390px.
- `/exercise` detail modal: no meaningful horizontal overflow after mobile modal layout fix.
- `/register`: panel is contained at 360px; previous right-edge clipping is resolved.
- `/`: no page-level horizontal scroll and no undersized touch targets in the latest 360px/390px audit, but the page is still long on mobile.
- Additional tiny-width audit found `/exercise` card overflow at 320px. Fixed by adding `/exercise` page-specific mobile classes and reducing the list grid to `minmax(0, 1fr)` on mobile. Rechecked at 320px: page and modal overflow are now clear.
- Desktop auth regression check: auth single-column override was scoped back into mobile media rules. Rechecked 1440px: login/register use the desktop 920px two-column shell again, while 320px/390px auth remains one-column with no overflow.
- Routine completion flow check: auto setup -> AI routine generation -> approved routine view was tested at 320px. Found overflow in approved routine day tabs/cards and a 26px completion checkbox. Fixed with approved-routine mobile classes, 3-column day grid, single-column dashboard, and 36px checkbox. Rechecked at 320px: overflow and undersized touch targets are clear.
- Consult offline send flow check: backend-offline first message send was tested at 320px. Found that session creation could fail before the user message was rendered. Fixed with a local session fallback and mobile-safe local guidance response. Rechecked at 320px after sending a message: user text visible, fallback response visible, page `scrollWidth` is 320, no horizontal overflow, and no undersized touch targets.
- Full 320px route smoke after the latest pass: `/`, `/exercise`, `/routine`, `/login`, `/register`, and `/consult` all reported `scrollWidth` 320, horizontal overflow count 0, and undersized touch target count 0.
- Exercise interaction check: typed a search query and opened filters at 320px. Found a hidden 16px `필터 초기화` button. Fixed reset/search/filter controls and rechecked the interaction: overflow 0 and undersized touch targets 0.
- Home density pass: measured the 320px home page at 6723px tall before this round. Found the weekly planner demo and workout library preview were carrying most of the mobile length. Reduced the mobile-only routine preview to 3 visible days plus a `+2일` indicator, and reduced the mobile-only workout library preview to 3 cards with shorter media height. Rechecked: home is 4618px tall, 6-route 320px smoke still reports overflow 0 and undersized touch targets 0.
- Consult empty-state visual pass: the mobile consult screen still reserved space for an empty history area, pushing the main question/input lower than necessary. Added consult shell/sidebar/history/empty-state classes and collapsed empty history only on mobile. Rechecked at 320px: empty history hidden, sidebar is 141px tall, first question is visible higher on the screen, offline send still renders a local response, and 6-route smoke remains overflow 0 / undersized touch targets 0.
- Exercise detail interaction pass: opening the mobile detail modal could show a large native video spinner when video assets were slow or unavailable. Added a local static thumbnail fallback for the exercise detail media area. During verification, a missing fallback component reference briefly caused a modal runtime error; fixed it by defining the fallback inside `ExercisePage.jsx`. Rechecked at 320px: detail media renders a visible exercise-name thumbnail instead of a spinner, no page errors, modal overflow 0, undersized touch targets 0, and 6-route smoke remains clean.
- Auth offline interaction pass: login submit and register duplicate-check buttons could remain in `진행 중...` / `확인 중...` long enough to feel stuck when the backend was unavailable. Added a 4.5s timeout and friendly Korean network error in the shared auth API client. Rechecked at 320px: buttons recover to their normal labels, error text is visible without overflow, page errors 0, and the 6-route smoke remains clean.
- Navigation and routine loading pass: opened the mobile hamburger menu on home, exercise, and routine after loading. Home/exercise menu height is 274px with overflow 0 and undersized touch targets 0. Routine initially showed the loading card while backend requests were pending, so routine API calls now use a 4.5s timeout and local fallback path. Rechecked at 320px: routine moves from loading to the survey screen within the check window, routine menu opens to 274px, overflow 0, undersized touch targets 0, page errors 0.
- Short-height mobile pass: rechecked the core routes at 320x568. Found `/exercise` could remain on the loading text while backend requests were pending. Added 4.5s timeout fallbacks to the exercise page and home workout preview API calls. Rechecked at 320x568: exercise library shows fallback data after the timeout window, and `/`, `/exercise`, `/routine`, `/login`, `/register`, `/consult` all report overflow 0, undersized touch targets 0, and page errors 0.
- Landscape mobile pass: checked 568x320 across the core routes. Found auth screens spent too much first-viewport height on logo/title before the form. Added a `max-height: 420px` mobile auth compact rule that hides secondary copy and tightens brand/title/form spacing only on short screens. Rechecked at 568x320: login/register forms appear much earlier, and `/`, `/exercise`, `/routine`, `/login`, `/register`, `/consult` all report overflow 0, undersized touch targets 0, and page errors 0. Rechecked 320x568 auth afterward: still overflow 0 and undersized touch targets 0.
- Keyboard-height mobile pass: checked 320x420 to approximate a reduced viewport while inputs are focused. Consult input and auth focus states stayed usable. Routine survey card was vertically centered by inline layout and clipped the `기본 정보` title under the fixed nav. Forced mobile routine survey pages to `justify-content: flex-start` and tightened short-height card spacing. Rechecked at 320x420: routine card starts below the nav, title is visible, and all core routes report overflow 0, undersized touch targets 0, and page errors 0.
- Consult after-send short-height pass: checked `/consult` at 320x420 after sending a local/offline message. Found the textarea and send button clipped below the viewport (`top 407`, `bottom 449` on a 420px-tall screen). Added short-height mobile compression for the consult shell and hid quick prompt buttons once a session exists. Rechecked at 320x420 after sending: textarea is fully inside the viewport (`top 335`, `bottom 377`), overflow 0, clipped controls 0, undersized touch targets 0, page errors 0.
- Home mobile density pass: rechecked `/` at 320x420 section by section. The weekly planner section still felt too desktop-stacked at 1343px tall, and the full page measured 4511px. Tightened only the mobile planner card spacing and limited each visible day preview to two exercises. Rechecked: weekly planner is 1013px tall, full home page is 4153px, horizontal overflow 0, undersized touch targets 0. Build passed after the change.
- Home workout preview pass: rechecked the mobile home workout-library section at 320x420. The section was still 1226px tall and looked like a long dark loading block while the backend was offline. Reduced the home preview API timeout to 2.2s, limited mobile preview to two cards, shortened mobile card media/skeleton height, and tightened section spacing. Rechecked: workout-library section is 654px, full home page is 3581px, and `/`, `/exercise`, `/routine`, `/consult`, `/login`, `/register` all report overflow 0, undersized touch targets 0, page errors 0 at 320x420. Build passed.
- Encyclopedia compact pass: rechecked the home planner-to-encyclopedia transition at 320x420. The planner still had a dark tail before the encyclopedia section, and the encyclopedia preview had a large empty message area. Reduced the planner bottom padding, made the encyclopedia gold title solid/brighter on mobile, and lowered the mobile encyclopedia message preview from 340px to 220px. Rechecked: planner section is 981px, encyclopedia section is 838px, full home page is 3429px at 320x420, overflow 0, undersized touch targets 0.
- Ultra-short consult pass: checked 320x360 after the compact home changes. Found the empty consult textarea/send button could sit at `328-370px`, clipping below the 360px viewport. Added a `max-height: 380px` consult layout that collapses the empty-state quick prompts and prioritizes the input. Rechecked: empty consult textarea is `221-263px`, clipped controls 0. Final `/`, `/exercise`, `/routine`, `/consult`, `/login`, `/register` smoke at both 320x420 and 320x360: overflow 0, undersized touch targets 0, page errors 0. Build passed.
- Routine ultra-short interaction pass: checked the routine survey at 320x360 while actually inspecting the first-step controls. The survey did not horizontally overflow, but the body/action regions could visually overlap and hide the lower choices on the first screen. Changed only the `max-height: 380px` mobile routine layout so the card itself scrolls, the body no longer creates a nested clipped region, secondary helper copy is hidden, and the auto-setup link is collapsed. Rechecked at 320x360: the card is scrollable, all first-step choices plus the `다음 단계` button are reachable, touch targets remain 42-48px, overflow 0, undersized touch targets 0. Final `/`, `/exercise`, `/routine`, `/consult`, `/login`, `/register` smoke at 320x420 and 320x360: overflow 0, undersized touch targets 0, page errors 0. Build passed.
- Mobile menu and auth-error pass: checked 320x360 opened mobile nav on home/routine and auth backend-offline error states. Found the open nav could visually mix with content underneath, especially routine choices behind the menu. Added a mobile open-menu fade shield below the nav. Also found login/register offline error states were too tall on 320x360. Added a `max-height: 380px` auth compact rule that hides the brand, tightens error copy/field spacing, and preserves 36-40px controls. Rechecked: menu no longer visually blends with the page, login 320x360 height is 495px, register 320x360 height is 618px, auth error controls have bottom clipping 0, overflow 0, undersized touch targets 0. Final `/`, `/exercise`, `/routine`, `/consult`, `/login`, `/register` smoke at 320x420 and 320x360: overflow 0, undersized touch targets 0, page errors 0. Build passed.
- Strict touch-target pass: re-audited `/`, `/exercise`, `/routine`, `/consult`, `/login`, and `/register` at 320x420 and 320x360 using a stricter 40px minimum target check instead of only the previous 32px check. Found remaining 36-38px controls in the mobile nav, home planner controls, home encyclopedia quick prompts, footer policy links, exercise category chips, consult quick prompts, and auth inputs/actions. Raised those mobile controls to at least 40px while preserving no horizontal overflow. Rechecked both viewport sizes: overflow 0, small32 0, under40 0, page errors 0 across all six routes. Build passed.

## Remaining Gaps

1. Home page is too long on mobile.
   - Latest 320x420 audit reduced the home page from 3581px to 3429px.
   - The weekly planner section is 981px, and the workout library section is now 654px instead of 1226px.
   - The encyclopedia section is now 838px instead of 958px after reducing the chat preview height.
   - It is much closer to a mobile landing flow now, but the first planner-to-encyclopedia boundary can still feel dark during fast scrolling.
   - Next improvement: only if manual review still dislikes it, add a small mobile section divider/anchor cue between planner and encyclopedia.

2. Backend-offline console noise remains, but the worst UI failure is fixed.
   - Exercise, routine, and consult pages recover visually with fallback data, local routines, or local consult responses.
   - Consult no longer throws an unhandled page error on first send when the backend is unavailable.
   - Auth requests now time out with a visible error instead of leaving mobile buttons stuck in loading states.
   - Routine data/recommendation requests now time out into local fallback instead of leaving the mobile loading card indefinitely.
   - Exercise library and home workout preview requests now time out into local fallback data.
   - Browser resource failure logs still appear when local backend is not running.
   - Next improvement: centralize API calls behind a small client helper so expected offline fallbacks are quieter and consistent.

3. Consult history with existing sessions is usable but still visually heavy.
   - Empty history is now collapsed on mobile.
   - After a local/offline send at 320x420, the input is no longer clipped and touch targets remain safe.
   - Empty consult at 320x360 now collapses quick prompts so the textarea is fully visible.
   - The top session area is compressed on short screens, but it still feels more utilitarian than polished.
   - Next improvement: consider a horizontal compact session strip for mobile if many consult sessions are expected.

4. Home footer legal links had undersized touch targets.
   - Found at 16px height in the audit.
   - Fixed by adding `.footer-policy-link` mobile min-height.
   - Rechecked after build: links are now 36px tall at 360px and 390px.

5. Homepage visual density is still high.
   - Text overload is reduced in the encyclopedia section.
   - The planner demo and library preview are now mobile previews instead of full desktop stacks.
   - Workout preview now shows two compact mobile cards and falls back faster when the backend is offline.
   - Background glow elements that visually crossed mobile edges were hidden on mobile.
   - Next improvement: review visual contrast between the encyclopedia and workout sections; individual workout cards are now shorter and clearer.

6. Fallback exercise coverage is minimal.
   - The fallback set has 8 exercises, enough to avoid empty UI.
   - It is not equivalent to a full 900-exercise library.
   - Next improvement: add broader fallback samples by category if backend availability is uncertain for demos.

7. Exercise library at 320px is no longer broken, but still visually tight.
   - Header, search, category chips, and first card fit after the grid fix.
   - Detail modal media now has a static fallback when video is unavailable.
   - The page is usable, but the title/search area is dense on very small devices.
   - Next improvement: reduce the 320px header type scale or hide secondary helper copy.

8. Approved routine view is functionally fixed but dense at 320px.
   - Overflow and small checkbox target are resolved.
   - The overview headline and action buttons still feel tight on the smallest width.
   - Next improvement: shorten overview copy or split secondary metadata/actions into a calmer stacked layout.

9. Routine survey on ultra-short screens is now usable but intentionally scrollable.
   - At 320x360, the first step cannot honestly fit age, gender, level, and actions without becoming cramped.
   - The card now scrolls internally instead of clipping or overlapping controls.
   - Next improvement: consider splitting age/gender/level into separate micro-steps if product wants no internal scroll at all.

10. Auth error states are compact at 320x360 but dense.
   - Backend-offline errors now fit without clipping primary controls.
   - Brand is hidden only on ultra-short auth screens to keep the form usable.
   - Inputs/actions are now at least 40px tall in the tested mobile states.
   - Next improvement: if product wants a more premium error state, use a one-line toast instead of an inline error block on very short screens.

## Fixed In This Pass

- Register mobile right clipping.
- Login/register vertical mobile auth layout.
- Routine mobile survey controls and secondary button height.
- Exercise library empty state through fallback data.
- Exercise detail modal mobile horizontal overflow.
- Exercise library card overflow at 320px.
- Approved routine day tabs/card overflow and 26px checkbox at 320px.
- Consult backend-offline first-send failure through local session and fallback response.
- Consult session history edit/delete mobile touch targets.
- Consult empty-history area collapsed on mobile so the first question/input sits higher.
- Home algorithm pain/time controls mobile touch targets.
- Home oversized background glow elements hidden on mobile.
- Home weekly planner preview shortened to 3 visible days plus `+2일` on mobile.
- Home workout library preview shortened to 3 cards with shorter card media on mobile.
- Exercise category/filter/search/reset controls mobile touch targets, including the search+filter interaction state.
- Exercise detail modal video loading fallback through a local static thumbnail.
- Auth API timeout for login/register duplicate-check offline states.
- Auth compact layout for short landscape mobile viewports.
- Routine API timeout for initial loading, generation, review, and save paths.
- Routine survey top alignment fixed for keyboard-height mobile viewports.
- Exercise API timeout for library, home preview, and detail fetch paths.
- Consult after-send input clipping at 320x420.
- Home weekly planner mobile density tightened from a 1343px section to 1013px.
- Home workout library mobile preview tightened from a 1226px section to 654px.
- Home workout preview backend-offline wait reduced from 4.5s to 2.2s.
- Home encyclopedia mobile preview tightened from a 958px section to 838px.
- Consult empty-state input clipping fixed at 320x360.
- Routine survey first-step control overlap fixed at 320x360 with card-level scrolling.
- Mobile opened-nav visual bleed over page content reduced with an open-menu fade shield.
- Auth backend-offline error states compacted at 320x360.
- Strict 40px touch target pass completed for home, exercise, routine, consult, login, and register at 320x420 and 320x360.
- Mobile hamburger menu opened and verified on home, exercise, and routine.
- Chat and consult quick button touch target sizes.
- Home encyclopedia mobile text overload.
- Navbar mobile hamburger layout.
- Desktop auth layout restored after mobile-only scoping check.

## Verification Commands

```bash
npm run build
```

Playwright mobile audit was run locally against:

```text
http://127.0.0.1:5173/
```

Temporary Playwright dependency must be removed after audits so `package.json` and `package-lock.json` stay unchanged.

## Next Pass Checklist

- Re-run 360px audit after any additional home/footer CSS change.
- Scroll home section-by-section and judge visual quality, not just overflow numbers.
- Re-check the approved routine view after any routine dashboard CSS change.
- Open exercise filters and detail modal again after any CSS change.
- Continue testing 320px or 344px width after any `/exercise` or global mobile CSS change; 360px passing is not enough for older Android devices.
