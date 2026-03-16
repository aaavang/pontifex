import {
  InteractionType,
  PublicClientApplication
} from "@azure/msal-browser";
import {
  AuthenticatedTemplate,
  MsalAuthenticationTemplate,
  MsalProvider,
} from "@azure/msal-react";
import { CloseIcon, WarningIcon } from "@chakra-ui/icons";
import { ChakraProvider } from "@chakra-ui/react";
import {
  Alert,
  AlertIcon,
  Box,
  Flex,
  IconButton,
  Text,
  VStack,
  Heading,
  Icon,
  createStandaloneToast
} from "@chakra-ui/react";
import axios from "axios";
import axiosRetry from "axios-retry";
import { AppProps } from "next/app";
import Head from "next/head";
import { useState } from "react";
import { Footer } from "../components/Footer";
import { Container } from "../components/container";
import { AccountMenu, GlobalNavigation } from "../components/global-navigation";
import { User } from "../components/global-navigation/user";
import {
  PrimaryNavigation,
  PrimaryNavigationLink,
} from "../components/primary-navigation";
import { loginRequest } from "../config/authConfig";
import { ErrorBoundary } from "react-error-boundary";
import "../styles/globals.css";
import { theme } from "../theme";

const { ToastContainer } = createStandaloneToast();

axiosRetry(axios, {
  retries: 5, // number of retries
  retryDelay: (...arg) => axiosRetry.exponentialDelay(...arg, 1000),
  retryCondition(error) {
    switch (error.response.status) {
      //retry only if status is 500 or 501
      case 500:
      case 501:
        return true;
      default:
        return false;
    }
  },
});

function ApplicationErrorFallback() {
  return (
    <ChakraProvider theme={theme}>
      <Flex direction="column" height="100vh" width="100vw" align="center" justify="center" background="gray.800">
        <VStack spacing={6} textAlign="center">
          <Box>
            <Icon as={WarningIcon} w={24} h={24} color="red" />
          </Box>
          <VStack spacing={6}>
            <Heading as="h1" size="2xl" color="gray.50">
              Oops, something went wrong!
            </Heading>
            <Text fontSize="2xl" color="gray.50">
              An unexpected error has occurred.
            </Text>
            <Text fontSize="2xl" color="gray.50">
              If the issue persists, please contact Platform Engineering
            </Text>
          </VStack>
        </VStack>
      </Flex>
    </ChakraProvider>
  );
}

function ComponentErrorFallback({ error }) {
  return (
    <Flex direction="column" align="center" justify="center">
      <VStack spacing={6} textAlign="center">
        <Box>
          <Icon as={WarningIcon} w={24} h={24} color="red.600" />
        </Box>
        <VStack spacing={6}>
          <Heading as="h1" size="2xl">
            Oops, something went wrong!
          </Heading>
          <Text fontSize="2xl">
            An unexpected error has occurred.
          </Text>
          <Text fontSize="xl" color="red.600" as='i'>
            Error: {error.message}
          </Text>
          <Text fontSize="2xl">
            If the issue persists, please contact Platform Engineering
          </Text>
        </VStack>
      </VStack>
    </Flex>
  );
}

function MaintenanceMode() {
  return (
    <ChakraProvider theme={theme}>
      <Container background="gray" height="100vh">
        <VStack
          m="5"
          rounded="lg"
          borderWidth="1px"
          boxShadow="xl"
          padding={5}
          bg="white"
        >
          <Box p={4} rounded="md">
            <Text fontSize="xl">
              Pontifex is currently undergoing scheduled maintenance and will be temporarily unavailable.
            </Text>
          </Box>
        </VStack>
      </Container>
    </ChakraProvider>
  );
}

const accountMenu: AccountMenu = {
  signInPath: "/openid/signin",
  signOutPath: "/openid/signout",
  userInfoPath: "/openid/userinfo",
  profilePath: "/profile",
  userFromInfo: (userInfo: any): User => {
    const { family_name, given_name, email, status_code } = userInfo;
    const isAuthenticated =
      !status_code || (status_code !== 500 && status_code !== 401);
    return {
      firstName: given_name,
      lastName: family_name,
      email,
      isAuthenticated,
    };
  },
};

function getPrimaryLinks(roles: string[] = []): PrimaryNavigationLink[] {
  const links: PrimaryNavigationLink[] = [
    { hrefPath: "/", displayText: "Home" },
    { hrefPath: "/dashboard", displayText: "My Dashboard" },
  ];

  if (roles.includes("Admin")) {
    links.push({ hrefPath: "/admin/gremlin", displayText: "Admin" });
  }

  return links;
}

type MyAppProps = {
  authConfig: any;
  globalBannerMessage: {
    showBanner: boolean;
    text: string;
    status: "error" | "info" | "warning" | "success" | "loading";
    uuid: string;
  };
};

let msalInstance;

function MyApp({
  Component,
  pageProps,
  authConfig,
  globalBannerMessage,
}: AppProps & MyAppProps) {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(authConfig);
  }

  const [bannerAcked, setBannerAcked] = useState(false);

  const refreshAccessToken = async () => {
    const accounts = msalInstance.getAllAccounts();
    msalInstance.setActiveAccount(accounts[0]);
    const account = msalInstance.getActiveAccount();
    try {
      const expDate = new Date(account.idTokenClaims.exp * 1000);
      const forceRefresh = expDate < new Date();
      const token = await msalInstance.acquireTokenSilent({
        scopes: authConfig.auth.scopes,
        account,
        forceRefresh,
      });
      return token.idToken;
    } catch (error) {
      console.error("got error when refreshing token", error);
      msalInstance["browserStorage"].clear();
      const token = await msalInstance.acquireTokenRedirect(loginRequest);
      return token.idToken;
    }
  };

  axios.interceptors.request.use(async (config) => {
    // refreshAccessToken method is the one which makes acquireTokenSilent call .
    const token = await refreshAccessToken();
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    } else {
      console.error("couldn't attach bearer token");
    }
    return config;
  });

  axios.interceptors.response.use(
    (response) => {
      return response;
    },
    async function (error) {
      console.error("got error", error);
      const originalRequest = error.config;
      if (error.response.status === 401 && !originalRequest._retry
      ) {
        originalRequest._retry = true;
        const access_token = await refreshAccessToken();
        axios.defaults.headers.common["Authorization"] =
          "Bearer " + access_token;
        return axios(originalRequest);
      }
      return Promise.reject(error);
    }
  );

  let lastBannerUuid = null;
  if (typeof window !== "undefined") {
    const impersonatingOid = localStorage.getItem("pfx-impersonate");
    lastBannerUuid = localStorage.getItem("pfx-banner-uuid");
    if (impersonatingOid) {
      axios.defaults.headers["pfx-impersonate"] =
        localStorage.getItem("pfx-impersonate");
    }
  }

  return (
    <ErrorBoundary 
      FallbackComponent={ApplicationErrorFallback}>
      <MsalProvider instance={msalInstance}>
        <MsalAuthenticationTemplate
          interactionType={InteractionType.Redirect}
          authenticationRequest={loginRequest}
        >
          <AuthenticatedTemplate>
            <ChakraProvider theme={theme}>
              <Head>
                <title>Pontifex</title>
              </Head>
              <Container>
                <GlobalNavigation
                  accountMenu={accountMenu}
                  navLinks={[]}
                  applicationName="Pontifex"
                />
                <PrimaryNavigation navLinks={getPrimaryLinks((msalInstance?.getActiveAccount()?.idTokenClaims as any)?.roles)} />

                {!bannerAcked &&
                  globalBannerMessage?.showBanner &&
                  (!lastBannerUuid ||
                    lastBannerUuid !== globalBannerMessage?.uuid) ? (
                  <Alert status={globalBannerMessage.status}>
                    <Flex
                      justifyContent={"space-between"}
                      w={"100%"}
                      alignItems={"center"}
                    >
                      <Flex>
                        <AlertIcon />
                        {globalBannerMessage.text}
                      </Flex>
                      <IconButton
                        icon={<CloseIcon />}
                        variant={"ghost"}
                        aria-label={"close the alert"}
                        onClick={() => {
                          localStorage.setItem(
                            "pfx-banner-uuid",
                            globalBannerMessage.uuid
                          );
                          setBannerAcked(true);
                        }}
                      />
                    </Flex>
                  </Alert>
                ) : null}
                <Flex
                  width={"100%"}
                  justify={"center"}
                  grow={1}
                  shrink={0}
                  basis={"auto"}
                  direction={"column"}
                  padding={5}
                >
                  <ErrorBoundary
                    FallbackComponent={ComponentErrorFallback}
                  >
                    <Component {...pageProps} />
                  </ErrorBoundary>
                </Flex>
                <Footer />
              </Container>
            </ChakraProvider>
          </AuthenticatedTemplate>
        </MsalAuthenticationTemplate>
      </MsalProvider>
      <ToastContainer />
    </ErrorBoundary>
  );
}

MyApp.getInitialProps = async (ctx): Promise<MyAppProps> => {
  return {
    authConfig: {
      auth: {
        clientId: process.env.NEXT_PUBLIC_CLIENT_ID,
        authority: process.env.NEXT_PUBLIC_AUTHORITY,
        redirectUri: "/dashboard",
        scopes: ["User.Read"],
      },
      cache: {
        cacheLocation: "sessionStorage", // This configures where your cache will be stored
        storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
      },
    },
    globalBannerMessage: {
      showBanner: process.env.NEXT_PUBLIC_SHOW_BANNER?.toLowerCase() === "true",
      text: process.env.NEXT_PUBLIC_GLOBAL_BANNER_TEXT,
      status: process.env.NEXT_PUBLIC_GLOBAL_BANNER_STATUS as any,
      uuid: process.env.NEXT_PUBLIC_GLOBAL_BANNER_UUID as any,
    },
  };
};

export default MyApp;
