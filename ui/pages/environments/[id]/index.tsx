import { useMsal } from "@azure/msal-react";
import { DeleteIcon, PlusSquareIcon, QuestionIcon, WarningIcon } from "@chakra-ui/icons";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  IconButton,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Radio,
  RadioGroup,
  Spacer,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Tooltip,
  VStack,
  useDisclosure,
  useToast,
  Box,
  Icon,
  Alert,
  AlertIcon
} from "@chakra-ui/react";
import axios from "axios";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { docco } from "react-syntax-highlighter/dist/cjs/styles/hljs";
import useSwr from "swr";
import {
  Config,
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";
import { RolesList } from "../../../components/roles";
import { PasswordList } from "../../../components/passwords";
import { PermissionRequestByEnvIdList } from "../../../components/permission-request";
import { ScopesList } from "../../../components/scopes";
import { StandaloneTokenGroupList } from "../../../components/token-group";
import { useIsApplicationOwner, useIsOwner } from "../../../hooks/useIsOwner";
import { readEnvironment } from "../../../resources";
import {
  clientCredentialsHelpText,
  clientIdHelpText,
  inboundPermissionRequestsHelpText,
  outboundPermissionRequestsHelpText,
  rolesHelpText,
  scopesHelpText,
  tokenGroupsHelpText,
  tooManyClientCredentialsHelpText,
} from "../../../strings";
import { confirm } from "../../../utils/confirm/Confirm";
import { ErrorBoundary } from "react-error-boundary";

const customConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: "-",
  length: 3,
};

const EnvironmentDetails = () => {
  const router = useRouter();
  const [id, setId] = useState("");
  useEffect(() => {
    if (router.isReady) {
      setId(router.query.id as string);
    }
  }, [router.isReady, router.query.id]);

  return <>{id ? <Environment id={id} /> : null}</>;
};

function CardErrorFallback({ error }) {
  return (
    <Box>
      <Alert status="error" borderRadius="md" boxShadow="sm" flexDirection="column" alignItems="center" justifyContent="center" textAlign="center">
        <AlertIcon />
        <Text fontWeight="medium">Something went wrong. Please try again later.</Text>
      </Alert>
    </Box>
  );
}

const Environment = ({ id }) => {
  const { data, error, isLoading, mutate } = useSwr(
    `/api/environments/${id}`,
    readEnvironment(id)
  );
  const { accounts } = useMsal();
  const userOid = accounts[0].idTokenClaims.oid;
  const toast = useToast();
  const router = useRouter();
  const { isOwner } = useIsOwner();
  const { isOwner: isApplicationOwner } = useIsApplicationOwner(
    data?.application.id
  );
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newRedirectURL, setNewRedirectUrl] = useState("");
  const [newRedirectURLType, setNewRedirectUrlType] = useState("SPA");

  if (isLoading) {
    return <Text>Loading environment...</Text>;
  }

  const createClientCredential = async () => {
    const displayName = uniqueNamesGenerator(customConfig);
    toast({
      title: "Creating Client Credential",
      description: `Creating client credential, ${displayName}`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    await axios.post(`/api/environments/${data?.environment.id}/addPassword`, {
      displayName,
    });
    toast({
      title: "Created Client Credential",
      description: `Created client credential, ${displayName}`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    mutate();
  };

  const copyClientId = async () => {
    await navigator.clipboard.writeText(data?.environment.clientId);
    toast({
      title: "Client ID Copied",
      description: `Copied client ID to clipboard`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  const removeRedirectUrl = async (url: string, type: string) => {
    let spaRedirectUrls = [...data.environment.spaRedirectUrls];
    let webRedirectUrls = [...data.environment.webRedirectUrls];

    if (type === "SPA") {
      spaRedirectUrls = spaRedirectUrls.filter((u) => u !== url);
    } else {
      webRedirectUrls = webRedirectUrls.filter((u) => u !== url);
    }

    toast({
      title: "Removing Redirect URL",
      description: `Removing ${url} from the environment`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    await axios.patch(`/api/environments/${id}`, {
      redirectUrlConfig: {
        spa: spaRedirectUrls,
        web: webRedirectUrls,
      },
    });
    toast({
      title: "Removed Redirect URL",
      description: `Removed ${url} from the environment`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    mutate();
  };

  const addRedirectUrl = async () => {
    if (
      (newRedirectURLType === "SPA"
        ? data.environment.spaRedirectUrls
        : data.environment.webRedirectUrls
      ).includes(newRedirectURL)
    ) {
      toast({
        title: "Can't add duplicate redirect URL",
        description: `This redirect URL already exists on the environment`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    if (newRedirectURL === null) {
      toast({
        title: "Can't add empty redirect URL",
        description: `The entered redirect URL is not valid`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });

      return;
    }

    const spaRedirectUrls = [...data.environment.spaRedirectUrls];
    const webRedirectUrls = [...data.environment.webRedirectUrls];

    if (newRedirectURLType === "SPA") {
      spaRedirectUrls.push(newRedirectURL);
    } else {
      webRedirectUrls.push(newRedirectURL);
    }

    toast({
      title: "Adding Redirect URL",
      description: `Adding ${newRedirectURL} to the environment`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    await axios.patch(`/api/environments/${id}`, {
      redirectUrlConfig: {
        spa: spaRedirectUrls,
        web: webRedirectUrls,
      },
    });
    toast({
      title: "Added Redirect URL",
      description: `Added ${newRedirectURL} to the environment`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    onClose();
    mutate();
  };

  const msalClientExample = `
      import { ConfidentialClientApplication } from '@azure/msal-node';

      const config = {
          auth: {
              clientId: process.env.CLIENT_ID, // this should be '${data?.environment.clientId}' for this environment
              clientSecret: process.env.CLIENT_SECRET, // read client secret from env variable or vault
              authority: 'https://login.microsoftonline.com/00e1df3d-9626-410c-898c-16aaa8c2afc9',
          },
      };

      const confidentialClientApplication = new ConfidentialClientApplication(config);

      const clientCredentialRequest = {
          scopes: ['<TARGET_API_ENV_CLIENT_ID>/.default'],
      };

      const token = await confidentialClientApplication.acquireTokenByClientCredential(clientCredentialRequest);
  `;

  const joseServiceExample = `
    import { createRemoteJWKSet, jwtVerify } from 'jose';
    
    const jwks = createRemoteJWKSet(new URL('https://login.microsoftonline.com/00e1df3d-9626-410c-898c-16aaa8c2afc9/discovery/v2.0/keys'));
    
    const jwt = req.headers.authorization.split(' ')[1]; // in the format 'Bearer <JWT>'
    const validationResponse = await jwtVerify(jwt, jwks, {
                    issuer: '${process.env.NEXT_PUBLIC_AUTHORITY}', // issuer for Credit Acceptance Azure Entra tenant
                    audience: '${data?.environment.clientId}',  // client ID for ${data?.environment.name}
                });
    const token = validationResponse.payload;
    
    // check if token contains the correct role to call this service
    const requiredRole = 'awesome-api';
    
    const tokenRoles = token.roles ?? [];
    const authorized = tokenRoles.includes(requiredRole);
  `;

  return (
    <Flex gap={"10px"}>
      <Card variant={"outline"} flexShrink={0}>
        <CardHeader>
          <Heading as={"h1"} fontSize={"lg"}>
            {data?.environment.name}
          </Heading>
        </CardHeader>
        <CardBody>
          <VStack alignItems={"start"}>
            <Flex gap={"5px"} alignItems={"center"}>
              <Heading as={"h2"} fontSize={"md"}>
                Client ID:{" "}
                <Link onClick={copyClientId} color={"blue"}>
                  {data?.environment.clientId}
                </Link>
              </Heading>
              <Tooltip label={clientIdHelpText} fontSize="md" hasArrow>
                <QuestionIcon color="gray" />
              </Tooltip>
            </Flex>
            <Heading as={"h2"} fontSize={"md"}>
              IDP Resource:{" "}
              <Link
                isExternal
                color="blue"
                href={`https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/${data?.environment.clientId}/isMSAApp~/false`}
              >
                Azure AD
              </Link>
            </Heading>
            <Heading as={"h2"} fontSize={"md"}>
              Application:{" "}
              <Link color="blue" href={`/applications/${data?.application.id}`}>
                {data?.application.name}
              </Link>
            </Heading>
            <Button
              width={"100%"}
              colorScheme={"blue"}
              variant={"outline"}
              onClick={() => router.push(`/environments/${id}/token-tester`)}
            >
              Token Tester
            </Button>
          </VStack>
        </CardBody>
      </Card>

      <VStack spacing={4} align="stretch" width={"100%"}>
        <Card variant={"outline"}>
          <CardHeader>
            <Flex alignItems="center">
              <Heading as={"h2"} fontSize={"md"} mr={"5px"}>
                Roles{" "}
              </Heading>
              <Tooltip label={rolesHelpText} fontSize="md" hasArrow>
                <QuestionIcon color={"gray"} />
              </Tooltip>
            </Flex>
          </CardHeader>
          <CardBody>
            <ErrorBoundary FallbackComponent={CardErrorFallback}>
              <RolesList
                roles={data?.roles}
                isOwner={
                  isOwner(data?.application.creator) || isApplicationOwner()
                }
              />
            </ErrorBoundary>
          </CardBody>
        </Card>
        <Card variant={"outline"}>
          <CardHeader>
            <Flex alignItems="center">
              <Heading as={"h2"} fontSize={"md"} mr={"5px"}>
                Scopes{" "}
              </Heading>
              <Tooltip label={scopesHelpText} fontSize="md" hasArrow>
                <QuestionIcon color={"gray"} />
              </Tooltip>
            </Flex>
          </CardHeader>
          <CardBody>
            <ErrorBoundary FallbackComponent={CardErrorFallback}>
              <ScopesList
                scopes={data?.scopes}
                isOwner={
                  isOwner(data?.application.creator) || isApplicationOwner()
                }
              />
            </ErrorBoundary>
          </CardBody>
        </Card>
        <Card variant={"outline"}>
          <CardHeader>
            <Flex alignItems="center">
              <Heading as={"h2"} fontSize={"md"} mr={"5px"}>
                Token Groups{" "}
              </Heading>
              <Tooltip label={tokenGroupsHelpText} fontSize="md" hasArrow>
                <QuestionIcon color={"gray"} />
              </Tooltip>
            </Flex>
          </CardHeader>
          <CardBody>
            <ErrorBoundary FallbackComponent={CardErrorFallback}>
              <StandaloneTokenGroupList tokenGroups={data.tokenGroups ?? []} />
            </ErrorBoundary>
          </CardBody>
        </Card>
        <Card variant={"outline"}>
          <CardHeader>
            <Flex>
              <Flex alignItems="center">
                <Heading as={"h2"} fontSize={"md"} mr="5px">
                  Outbound Permission Requests
                </Heading>
                <Tooltip
                  label={outboundPermissionRequestsHelpText}
                  fontSize="md"
                  hasArrow
                >
                  <QuestionIcon color={"gray"} />
                </Tooltip>
              </Flex>
              <Spacer />
              {isOwner(data?.application.creator) || isApplicationOwner() ? (
                <IconButton
                  aria-label="Create Permission Request"
                  colorScheme={"green"}
                  icon={<PlusSquareIcon />}
                  onClick={() =>
                    router.push({
                      pathname: "/connections/update",
                      query: {
                        sourceApplication: data?.application.id,
                        sourceEnvironment: data?.environment.id,
                        sourceEnvironmentLevel: data?.environment.level,
                      },
                    })
                  }
                />
              ) : null}
            </Flex>
          </CardHeader>
          <CardBody>
            <ErrorBoundary FallbackComponent={CardErrorFallback}>
              {isOwner(data?.application.creator) || isApplicationOwner() ? (
                <PermissionRequestByEnvIdList
                  direction={"outbound"}
                  environmentId={data?.environment.id}
                />
              ) : (
                <p>You are not authorized to see permission requests</p>
              )}
            </ErrorBoundary>
          </CardBody>
        </Card>
        <Card variant={"outline"}>
          <CardHeader>
            <Flex>
              <Flex alignItems="center">
                <Heading as={"h2"} fontSize={"md"} mr="5px">
                  Inbound Permission Requests
                </Heading>
                <Tooltip
                  label={inboundPermissionRequestsHelpText}
                  fontSize="md"
                  hasArrow
                >
                  <QuestionIcon color={"gray"} />
                </Tooltip>
              </Flex>
            </Flex>
          </CardHeader>
          <CardBody>
            <ErrorBoundary FallbackComponent={CardErrorFallback}>
              {isOwner(data?.application.creator) || isApplicationOwner() ? (
                <PermissionRequestByEnvIdList
                  direction={"inbound"}
                  environmentId={data?.environment.id}
                />
              ) : (
                <p>You are not authorized to see permission requests</p>
              )}
            </ErrorBoundary>
          </CardBody>
        </Card>

        <Card variant={"outline"}>
          <CardHeader>
            <Flex>
              <Flex alignItems="center">
                <Heading as={"h2"} fontSize={"md"} mr="5px">
                  Client Credentials
                </Heading>
                <Tooltip
                  label={clientCredentialsHelpText}
                  fontSize="md"
                  hasArrow
                >
                  <QuestionIcon color={"gray"} />
                </Tooltip>
              </Flex>
              <Spacer />
              {isOwner(data?.application.creator) || isApplicationOwner() ? (
                data?.passwords.length < 2 ? (
                  <IconButton
                    aria-label="Add Role"
                    colorScheme={"green"}
                    icon={<PlusSquareIcon />}
                    onClick={createClientCredential}
                  />
                ) : (
                  <Tooltip
                    label={tooManyClientCredentialsHelpText}
                    fontSize="md"
                    hasArrow
                  >
                    <Badge variant={"outline"}>
                      <p>Why can&apos;t I create more client credentials?</p>
                    </Badge>
                  </Tooltip>
                )
              ) : null}
            </Flex>
          </CardHeader>
          <CardBody>
            <ErrorBoundary FallbackComponent={CardErrorFallback}>
              {isOwner(data?.application.creator) || isApplicationOwner() ? (
                <PasswordList
                  passwords={data?.passwords}
                  environment={data?.environment}
                />
              ) : (
                <p>You are not authorized to see client credentials</p>
              )}
            </ErrorBoundary>
          </CardBody>
        </Card>

        {(isOwner(data?.application.creator) || isApplicationOwner()) ? (
          <Card variant={"outline"}>
            <CardHeader>
              <Flex justifyContent={"space-between"} alignItems={"center"}>
                <Heading as={"h2"} fontSize={"md"} mr="5px">
                  Redirect URLs
                </Heading>
                {isOwner(data?.application.creator) || isApplicationOwner() ? (
                  <IconButton
                    aria-label="Create Redirect URL"
                    colorScheme={"green"}
                    icon={<PlusSquareIcon />}
                    onClick={onOpen}
                  />
                ) : null}
              </Flex>
            </CardHeader>
            <CardBody>
              <ErrorBoundary FallbackComponent={CardErrorFallback}>
                <Card variant={"outline"} mb={5}>
                  <CardHeader>
                    <Heading as={"h3"} fontSize={"sm"} mr="5px">
                      SPA
                    </Heading>
                  </CardHeader>
                  <CardBody>
                    {data.environment.spaRedirectUrls.length === 0 ? (
                      <Text>No SPA redirect URLs</Text>
                    ) : null}
                    {data.environment.spaRedirectUrls.map((url) => (
                      <Flex
                        justifyContent={"space-between"}
                        alignItems={"center"}
                        width={"100%"}
                        key={url}
                      >
                        <Text>{url}</Text>
                        <IconButton
                          aria-label="Delete Redirect URL"
                          colorScheme={"red"}
                          variant={"outline"}
                          icon={<DeleteIcon />}
                          onClick={confirm(
                            "Are you sure you want to remove this redirect URL?",
                            () => removeRedirectUrl(url, "SPA")
                          )}
                        />
                      </Flex>
                    ))}
                  </CardBody>
                </Card>
                <Card variant={"outline"}>
                  <CardHeader>
                    <Heading as={"h3"} fontSize={"sm"} mr="5px">
                      Web
                    </Heading>
                  </CardHeader>
                  <CardBody>
                    {data.environment.webRedirectUrls.length === 0 ? (
                      <Text>No Web redirect URLs</Text>
                    ) : null}
                    {data.environment.webRedirectUrls.map((url) => (
                      <Flex
                        justifyContent={"space-between"}
                        alignItems={"center"}
                        width={"100%"}
                        key={url}
                      >
                        <Text>{url}</Text>
                        <IconButton
                          aria-label="Delete Redirect URL"
                          colorScheme={"red"}
                          variant={"outline"}
                          icon={<DeleteIcon />}
                          onClick={confirm(
                            "Are you sure you want to remove this redirect URL?",
                            () => removeRedirectUrl(url, "WEB")
                          )}
                        />
                      </Flex>
                    ))}
                  </CardBody>
                </Card>
              </ErrorBoundary>
            </CardBody>
          </Card>
        ) : null}

        {isOwner(data?.application.creator) || isApplicationOwner() ? (
          <Accordion allowToggle>
            <AccordionItem>
              <h2>
                <AccordionButton>
                  <Heading as={"h2"} fontSize={"md"}>
                    Code Examples
                  </Heading>
                  <AccordionIcon />
                </AccordionButton>
              </h2>
              <AccordionPanel pb={4}>
                <Tabs>
                  <TabList>
                    <Tab>Node</Tab>
                  </TabList>

                  <TabPanels>
                    <TabPanel>
                      <Card mb={"15px"} variant={"outline"}>
                        <CardHeader>Requesting a token as a client</CardHeader>
                        <CardBody>
                          <SyntaxHighlighter
                            language={"javascript"}
                            style={docco}
                          >
                            {msalClientExample}
                          </SyntaxHighlighter>
                        </CardBody>
                      </Card>
                      <Card variant={"outline"}>
                        <CardHeader>Validating a token as a service</CardHeader>
                        <CardBody>
                          <SyntaxHighlighter
                            language={"javascript"}
                            style={docco}
                          >
                            {joseServiceExample}
                          </SyntaxHighlighter>
                        </CardBody>
                      </Card>
                    </TabPanel>
                  </TabPanels>
                </Tabs>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        ) : null}
      </VStack>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Redirect URL</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex justifyContent="space-between" pl="15px" pr="15px">
              <Stack spacing={3}>
                <Heading as={"h4"} fontSize={"md"}>
                  Add new redirect URL
                </Heading>
                <Input
                  type="text"
                  name="name"
                  placeholder="http://localhost:3000"
                  onChange={(e) => {
                    setNewRedirectUrl(e.target.value);
                  }}
                />
                <RadioGroup
                  onChange={setNewRedirectUrlType}
                  value={newRedirectURLType}
                >
                  <Stack direction="row">
                    <Radio value="SPA">SPA</Radio>
                    <Radio value="WEB">WEB</Radio>
                  </Stack>
                </RadioGroup>
              </Stack>
            </Flex>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="green" mr={3} onClick={addRedirectUrl}>
              Add
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
};

export default EnvironmentDetails;
