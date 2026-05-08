import { jsx as _jsx } from "react/jsx-runtime";
import { ThemeProvider as NextThemesProvider } from "next-themes";
export function ThemeProvider({ children, ...props }) {
    return (_jsx(NextThemesProvider, { attribute: "class", defaultTheme: "light", enableSystem: true, disableTransitionOnChange: true, ...props, children: children }));
}
export { useTheme } from "next-themes";
