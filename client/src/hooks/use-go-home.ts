import { useCallback } from "react";
import { useRootNavigation, useRootNavigationState, useRouter } from "expo-router";

interface NavState {
  key?: string;
  routes?: { name: string; state?: NavState }[];
}

/** Finds the navigator state whose routes include `name` (the app's main stack). */
function findStackWith(state: NavState | undefined, name: string): NavState | null {
  if (!state?.routes) return null;
  if (state.routes.some((r) => r.name === name)) return state;
  for (const r of state.routes) {
    const hit = findStackWith(r.state, name);
    if (hit) return hit;
  }
  return null;
}

/**
 * Returns to Home without stacking a second copy of it: pops the main stack
 * back to the existing Home if it's there, otherwise replaces the current screen.
 */
export function useGoHome() {
  const router = useRouter();
  const rootNavigation = useRootNavigation();
  const rootState = useRootNavigationState() as NavState | undefined;

  return useCallback(() => {
    const stack = findStackWith(rootState, "home");
    if (stack?.key && rootNavigation) {
      // Targeted at the main stack so nested flow stacks (reading/, writing/) close too.
      rootNavigation.dispatch({ type: "POP_TO", payload: { name: "home" }, target: stack.key });
    } else {
      router.replace("/home");
    }
  }, [router, rootNavigation, rootState]);
}
