import { theme as defaultTheme } from "@chakra-ui/react";
import { colors } from "./colors";
import { customIcons } from "./icons";

const font = "Arial, Helvetica, sans-serif";

const fonts = {
  heading: font,
  body: font,
  mono: font,
};

export const theme = {
  ...defaultTheme,
  colors,
  fonts,
  icons: {
    ...customIcons,
  },
};
