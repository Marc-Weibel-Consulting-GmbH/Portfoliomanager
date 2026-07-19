// Entscheidet, ob ein eingeloggter Nutzer in den Onboarding-Wizard geleitet
// werden soll. Einzige Bedingung: Onboarding noch nicht abgeschlossen und der
// Nutzer ist nicht bereits auf der Onboarding-Seite. (Früher zusätzlich an
// `hasCompletedRegistration` gekoppelt — das war ein fragiles, faktisch totes
// Zweit-Gate.)
export function needsOnboardingRedirect(args: {
  hasUser: boolean;
  onboardingLoaded: boolean;
  hasCompletedOnboarding: boolean;
  location: string;
}): boolean {
  const { hasUser, onboardingLoaded, hasCompletedOnboarding, location } = args;
  return hasUser && onboardingLoaded && !hasCompletedOnboarding && location !== "/onboarding";
}
