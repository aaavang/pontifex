import { useMsal } from "@azure/msal-react";
import { Flex, HStack, Text, useColorMode } from "@chakra-ui/react";
import Image from "next/image.js";
import { useRouter } from "next/router";
import { useImpersonation } from "../../hooks/useImpersonation";
import { User } from "./user";

export interface GlobalNavigationLink {
  hrefPath: string;
  displayText: string;
  disableGlobalSearch?: boolean;
}

export interface AccountMenu {
  signInPath: string;
  signOutPath: string;
  userInfoPath: string;
  profilePath: string;
  userFromInfo: (userInfo: any) => User;
}

export interface AccountMenuProps {
  accountMenu: AccountMenu;
  pathname: string;
  color: string;
  isDark: boolean;
}

export interface AccountMenuListItem {
  href: string;
  text: string;
}

export interface AccountMenuListProps {
  items: AccountMenuListItem[];
}

export interface GlobalNavigationProps {
  accountMenu: AccountMenu;
  navLinks: GlobalNavigationLink[];
  applicationName?: string;
}

export const GlobalNavigation = ({
  accountMenu,
  navLinks,
  applicationName,
}) => {
  const { pathname } = useRouter();
  const { colorMode } = useColorMode();
  const { accounts } = useMsal();
  const roles = accounts[0].idTokenClaims.roles ?? [];
  const {
    isImpersonating,
    impersonatingUsername,
    impersonatingId,
    setImpersonating,
    canImpersonate,
  } = useImpersonation();

  const bgColor = { light: "gray.900", dark: "gray.300" };
  const color = { light: "gray.100", dark: "gray.900" };
  return (
    <Flex
      direction="column"
      width="100%"
      minHeight="1rem"
      backgroundColor={bgColor[colorMode]}
      borderTopWidth="2px"
    >
      <Flex pl={5} direction="row" width="100%" justifyContent="space-between">
        <HStack justifyContent="center" alignItems="center">
          <Image
            src="/pontifex-white.png"
            title="Pontifex"
            height={68}
            width={90}
            alt={"pontifex logo white"}
          />
          <Text
            fontSize="2xl"
            fontWeight="semibold"
            lineHeight="taller"
            color={colorMode === "dark" ? color.dark : color.light}
          >
            {applicationName}
          </Text>
        </HStack>
        {canImpersonate ? (
          <Text
            fontSize="2xl"
            fontWeight="semibold"
            lineHeight="taller"
            color={colorMode === "dark" ? color.dark : color.light}
            onClick={() => setImpersonating(prompt("Enter ID to impersonate"))}
            paddingRight={"15px"}
          >
            {`Impersonating: ${
              isImpersonating ? impersonatingUsername : "nobody"
            } (${isImpersonating ? impersonatingId : ""})`}
          </Text>
        ) : null}
      </Flex>
    </Flex>
  );
};
