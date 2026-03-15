import { Flex, useColorMode } from "@chakra-ui/react";
import { useRouter } from "next/router";

export interface PrimaryNavigationLink {
  hrefPath: string;
  displayText: string;
}

export interface PrimaryNavigationProps {
  navLinks: PrimaryNavigationLink[];
}

export const PrimaryNavigation = ({ navLinks }) => {
  const { pathname } = useRouter();
  const { colorMode } = useColorMode();

  const bgColor = { light: "white", dark: "gray.100" };
  const color = { light: "black", dark: "gray.900" };
  return (
    <Flex
      display="block"
      width="100%"
      minHeight="3rem"
      boxShadow="md"
      backgroundColor={bgColor[colorMode]}
    >
      <Flex
        direction="row"
        width="100%"
        padding="1rem"
        justifyContent="space-between"
      >
        <Flex
          direction="row"
          width="100%"
          padding="0.1rem"
          justifyContent="flex-start"
        >
          <Flex justifyContent="space-evenly" width="500px">
            {navLinks.map(({ hrefPath, displayText }) => (
              <Flex
                key={`nav-link-${hrefPath.replace("/", "")}`}
                color={pathname === hrefPath ? "orange.400" : color[colorMode]}
              >
                <a href={hrefPath}>{displayText}</a>
              </Flex>
            ))}
          </Flex>
        </Flex>
      </Flex>
    </Flex>
  );
};
