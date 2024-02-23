import useRGS from "r18gs";
import type { SetStateAction } from "r18gs/use-rgs";
import * as React from "react";
import type { ColorSchemePreference, ThemeState } from "../../hooks/use-theme";
import { DEFAULT_ID } from "../../constants";

export interface ThemeSwitcherProps {
	/** id of target element to apply classes to. This is useful when you want to apply theme only to specific container. */
	targetId?: string;
	/** To stop persisting and syncing theme between tabs. */
	dontSync?: boolean;
	/** force apply CSS transition property to all the elements during theme switching. E.g., `all .3s` */
	themeTransition?: string;
}

function useMediaQuery(setThemeState: SetStateAction<ThemeState>) {
	React.useEffect(() => {
		// set event listener for media
		const media = matchMedia("(prefers-color-scheme: dark)");
		const updateSystemColorScheme = () => {
			setThemeState(state => ({ ...state, systemColorScheme: media.matches ? "dark" : "light" }));
		};
		media.addEventListener("change", updateSystemColorScheme);
		return () => {
			media.removeEventListener("change", updateSystemColorScheme);
		};
	}, [setThemeState]);
}

export interface LoadSyncedStateProps extends ThemeSwitcherProps {
	setThemeState: SetStateAction<ThemeState>;
}

function parseState(str?: string | null): ThemeState {
	const parts = (str ?? ",system,light").split(",") as [
		string,
		ColorSchemePreference,
		"light" | "dark",
	];
	return { theme: parts[0], colorSchemePreference: parts[1], systemColorScheme: parts[2] };
}

function useLoadSyncedState({ dontSync, targetId, setThemeState }: LoadSyncedStateProps) {
	React.useEffect(() => {
		if (dontSync) return;
		const key = targetId ?? DEFAULT_ID;
		setThemeState(parseState(localStorage.getItem(key)));
		const storageListener = (e: StorageEvent) => {
			if (e.key === key) setThemeState(parseState(e.newValue));
		};
		window.addEventListener("storage", storageListener);
		return () => {
			window.removeEventListener("storage", storageListener);
		};
	}, [dontSync, setThemeState, targetId]);
}

function modifyTransition(themeTransition = "none") {
	const css = document.createElement("style");
	/** split by ';' to prevent CSS injection */
	const transition = `transition: ${themeTransition.split(";")[0]} !important;`;
	css.appendChild(
		document.createTextNode(
			`*{-webkit-${transition}-moz-${transition}-o-${transition}-ms-${transition}${transition}}`,
		),
	);
	document.head.appendChild(css);

	return () => {
		// Force restyle
		(() => window.getComputedStyle(document.body))();
		// Wait for next tick before removing
		setTimeout(() => {
			document.head.removeChild(css);
		}, 1);
	};
}

export interface UpdateDOMProps {
	targetId?: string;
	themeState: ThemeState;
	dontSync?: boolean;
}

function updateDOM({ targetId, themeState, dontSync }: UpdateDOMProps) {
	const { theme, colorSchemePreference: csp, systemColorScheme: scs } = themeState;
	const resolvedColorScheme = csp === "system" ? scs : csp;
	const key = targetId ?? DEFAULT_ID;
	// update DOM
	let shoulCreateCookie = false;
	const target = document.getElementById(key);
	shoulCreateCookie = !dontSync && target?.getAttribute("data-nth") === "next";

	/** do not update documentElement for local targets */
	const targets = targetId ? [target] : [target, document.documentElement];

	targets.forEach(t => {
		t?.classList.remove("dark");
		t?.classList.remove("light");
		t?.classList.forEach(cls => {
			if (cls.startsWith("th-")) t.classList.remove(cls);
		});
		t?.classList.add(`th-${theme}`);
		t?.classList.add(resolvedColorScheme);
	});

	if (shoulCreateCookie)
		document.cookie = `${key}=${theme},${resolvedColorScheme}; max-age=31536000; SameSite=Strict;`;
}

export function ThemeSwitcher({ targetId, dontSync, themeTransition }: ThemeSwitcherProps) {
	if (targetId === "") throw new Error("id can not be an empty string");
	const [themeState, setThemeState] = useRGS<ThemeState>(targetId ?? DEFAULT_ID);

	useMediaQuery(setThemeState);

	useLoadSyncedState({ dontSync, targetId, setThemeState });

	/** update DOM and storage */
	React.useEffect(() => {
		const restoreTransitions = modifyTransition(themeTransition);
		updateDOM({ targetId, themeState, dontSync });
		if (!dontSync) {
			// save to localStorage
			const { theme, colorSchemePreference: csp, systemColorScheme: scs } = themeState;
			const stateToSave = [theme, csp, scs].join(",");
			const key = targetId ?? DEFAULT_ID;
			localStorage.setItem(key, stateToSave);
		}
		restoreTransitions();
	}, [dontSync, targetId, themeState, themeTransition]);
	return null;
}
