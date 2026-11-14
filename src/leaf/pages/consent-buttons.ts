/**
 * Accept buttons of common consent tools: the crawl looks for them (readers/consent.ts), and every
 * generated suite clicks one when the site's own isn't found (through the suite model).
 */
/** Accept buttons of common consent tools, as CSS selectors. Checked first; not required. */
export const CONSENT_SELECTORS = [
  '#onetrust-accept-btn-handler', // OneTrust
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', // Cookiebot
  '#CybotCookiebotDialogBodyButtonAccept',
  '#didomi-notice-agree-button', // Didomi
  '#truste-consent-button', // TrustArc
  '[data-testid="uc-accept-all-button"]', // Usercentrics
  '.cky-btn-accept', // CookieYes
  '#wt-cli-accept-all-btn',
  '#cookie_action_close_header',
  '.cmplz-btn.cmplz-accept', // Complianz
  '#cn-accept-cookie', // Cookie Notice
  '#axeptio_btn_acceptAll', // Axeptio
  '[data-cookiefirst-action="accept"]', // CookieFirst
  '.osano-cm-accept-all', // Osano
  '.cc-btn.cc-allow', // Cookie Consent (Osano's open-source banner)
  '.fc-cta-consent', // Google consent messages
  '.iubenda-cs-accept-btn', // iubenda
  '#hs-eu-confirmation-button', // HubSpot
  '.brlbs-btn-accept-all', // Borlabs
  '.moove-gdpr-infobar-allow-all', // GDPR Cookie Compliance
];
