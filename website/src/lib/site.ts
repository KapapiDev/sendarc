export const SITE_NAME = "SendArc";
export const SITE_DESCRIPTION =
  "Send email from legacy Windows applications through Gmail without replacing the software your team already depends on.";
export const SUPPORT_EMAIL = "maxtop9843@gmail.com";
export const REPOSITORY_URL = "https://github.com/kapapi-dev/sendarc";
export const RELEASES_URL = `${REPOSITORY_URL}/releases`;
export const BUG_REPORT_URL = `${REPOSITORY_URL}/issues/new?template=bug_report.yml`;
export const COMPATIBILITY_REPORT_URL = `${REPOSITORY_URL}/issues/new?template=compatibility_report.yml`;
export const FEATURE_REQUEST_URL = `${REPOSITORY_URL}/issues/new?template=feature_request.yml`;
export const SECURITY_ADVISORY_URL = `${REPOSITORY_URL}/security/advisories/new`;
export const AFFIXA_RETIREMENT_URL = "https://help.affixa.com/article/100-sunsetting-and-retirement-of-affixa";

export const DOWNLOAD_ROUTE = "/download/";

export const buildCanonical = (site: URL | undefined, path: string): string =>
  new URL(path, site ?? new URL("https://sendarc.pages.dev")).toString();
