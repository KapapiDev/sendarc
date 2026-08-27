const qs = <T extends Element>(selector: string, root: ParentNode = document): T | null =>
  root.querySelector<T>(selector);

const qsa = <T extends Element>(selector: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll<T>(selector));

const navToggle = qs<HTMLButtonElement>("[data-nav-toggle]");
const nav = qs<HTMLElement>("[data-nav]");

const setNavOpen = (open: boolean): void => {
  if (!navToggle || !nav) return;
  navToggle.setAttribute("aria-expanded", String(open));
  navToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  nav.toggleAttribute("data-open", open);
  document.body.classList.toggle("nav-open", open);
};

navToggle?.addEventListener("click", () => {
  setNavOpen(navToggle.getAttribute("aria-expanded") !== "true");
});

qsa<HTMLAnchorElement>("a", nav ?? document.createElement("nav")).forEach((link) => {
  link.addEventListener("click", () => setNavOpen(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setNavOpen(false);
});

window.matchMedia("(min-width: 841px)").addEventListener("change", (event) => {
  if (event.matches) setNavOpen(false);
});

qsa<HTMLDetailsElement>("[data-faq-list] details").forEach((detail) => {
  detail.addEventListener("toggle", () => {
    if (!detail.open) return;
    qsa<HTMLDetailsElement>("[data-faq-list] details").forEach((peer) => {
      if (peer !== detail) peer.open = false;
    });
  });
});

const ALLOWED_EVENTS = new Set([
  "landing_view",
  "affixa_view",
  "download_cta",
  "business_beta_cta",
  "business_beta_submit",
  "release_download",
]);

const currentCampaign = (): { utmSource: string; utmCampaign: string } => {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: (params.get("utm_source") ?? "").slice(0, 100),
    utmCampaign: (params.get("utm_campaign") ?? "").slice(0, 100),
  };
};

const track = (event: string): void => {
  if (!ALLOWED_EVENTS.has(event)) return;
  const payload = {
    event,
    pathname: window.location.pathname.slice(0, 160),
    referrer: document.referrer.slice(0, 300),
    ...currentCampaign(),
  };
  const body = new Blob([JSON.stringify(payload)], { type: "text/plain;charset=UTF-8" });
  navigator.sendBeacon?.("/api/events", body);
};

const pageEvent = document.body.dataset.pageEvent;
if (pageEvent) track(pageEvent);

qsa<HTMLElement>("[data-track]").forEach((element) => {
  element.addEventListener("click", () => {
    const event = element.dataset.track;
    if (event) track(event);
  });
});

const betaForm = qs<HTMLFormElement>("[data-beta-form]");
const startedAt = qs<HTMLInputElement>("[data-form-started-at]", betaForm ?? document);
if (startedAt) startedAt.value = String(Date.now());

const buildFallback = (formData: FormData): string => {
  const body = [
    `Work email: ${String(formData.get("email") ?? "")}`,
    `Company: ${String(formData.get("company") ?? "")}`,
    `Approximate seats: ${String(formData.get("seats") ?? "")}`,
    `Current workflow: ${String(formData.get("workflow") ?? "")}`,
    "",
    "Optional note:",
    String(formData.get("note") ?? ""),
  ].join("\n");
  const params = new URLSearchParams({
    subject: "SendArc Business Beta interest",
    body,
  });
  return `mailto:maxtop9843@gmail.com?${params.toString()}`;
};

betaForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!betaForm.reportValidity()) return;

  const submit = qs<HTMLButtonElement>("button[type='submit']", betaForm);
  const submitLabel = qs<HTMLElement>("[data-submit-label]", betaForm);
  const status = qs<HTMLElement>("[data-form-status]", betaForm);
  const fallback = qs<HTMLAnchorElement>("[data-form-fallback]", betaForm);
  const formData = new FormData(betaForm);
  const { utmSource, utmCampaign } = currentCampaign();
  const payload = Object.fromEntries(formData.entries());
  Object.assign(payload, { utmSource, utmCampaign });

  if (submit) {
    submit.disabled = true;
    submit.setAttribute("aria-busy", "true");
  }
  if (submitLabel) submitLabel.textContent = "Joining…";
  if (status) status.textContent = "Submitting your beta request…";
  if (fallback) fallback.hidden = true;

  try {
    const response = await fetch("/api/business-beta", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      throw new Error(result?.message ?? "The beta form is temporarily unavailable.");
    }

    betaForm.reset();
    if (startedAt) startedAt.value = String(Date.now());
    if (status) status.textContent = "Thanks — your Business Beta request has been recorded.";
  } catch {
    if (status) {
      status.textContent =
        "The form could not store your request. You can still send the same details directly to the operator.";
    }
    if (fallback) {
      fallback.href = buildFallback(formData);
      fallback.hidden = false;
    }
  } finally {
    if (submit) {
      submit.disabled = false;
      submit.removeAttribute("aria-busy");
    }
    if (submitLabel) submitLabel.textContent = "Join Business Beta";
  }
});

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute("data-revealed", "true");
        revealObserver.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 },
  );
  qsa<HTMLElement>("[data-reveal]").forEach((element) => revealObserver.observe(element));
} else {
  qsa<HTMLElement>("[data-reveal]").forEach((element) => element.setAttribute("data-revealed", "true"));
}
