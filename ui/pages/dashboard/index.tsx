import { AuthenticatedTemplate, useMsal } from "@azure/msal-react";
import { LockIcon, PlusSquareIcon, UnlockIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  Heading,
  HStack,
  IconButton,
  Link,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import useSwr from "swr";
import { OwnedApplicationList } from "../../components/application";
import { MemberGroupList, OwnedGroupList } from "../../components/groups";
import { OwnedPendingPermissionRequestList } from "../../components/permission-request";
import { useImpersonation } from "../../hooks/useImpersonation";
import { createOrReadUser } from "../../resources";

const Dashboard = () => {
  const { accounts } = useMsal();
  const username = accounts[0].name;
  const oid = accounts[0].idTokenClaims.oid;
  const router = useRouter();
  const impersonation = useImpersonation();
  const { data, error, isLoading, mutate } = useSwr(
    `/api/users/create`,
    createOrReadUser()
  );

  if (isLoading) {
    return <Text>Loading dashboard...</Text>;
  }

  return (
    <AuthenticatedTemplate>
      <VStack p={5}>
        <Heading as={"h1"}>
          {impersonation.isImpersonating
            ? impersonation.impersonatingUsername
            : username}
          &apos;s Dashboard
        </Heading>
        <SimpleGrid columns={2}>
          <VStack
            m="5"
            rounded="lg"
            borderWidth="1px"
            boxShadow="xl"
            padding={5}
          >
            <Flex
              alignItems={"center"}
              justifyContent={"space-between"}
              width={"100%"}
            >
              <Heading as={"h3"} fontSize={"lg"}>
                Owned Applications
              </Heading>
              <IconButton
                aria-label="Create Application"
                colorScheme={"green"}
                size={"md"}
                icon={<PlusSquareIcon />}
                onClick={() => router.push("/applications/create")}
              />
            </Flex>
            <OwnedApplicationList />
          </VStack>
          <OwnedPendingPermissionRequestList />
          <VStack
            m="5"
            rounded="lg"
            borderWidth="1px"
            boxShadow="xl"
            padding={5}
          >
            <Flex
              alignItems={"center"}
              justifyContent={"space-between"}
              width={"100%"}
            >
              <Heading as={"h3"} fontSize={"lg"}>
                Owned Groups
              </Heading>
              <IconButton
                aria-label="Create Group"
                colorScheme={"green"}
                size={"md"}
                icon={<PlusSquareIcon />}
                onClick={() => router.push("/groups/create")}
              />
            </Flex>
            <OwnedGroupList />
          </VStack>
          <VStack
            m="5"
            rounded="lg"
            borderWidth="1px"
            boxShadow="xl"
            padding={5}
          >
            <Heading width="100%" as={"h3"} fontSize={"lg"}>
              Groups with Membership
            </Heading>
            <MemberGroupList />
          </VStack>
        </SimpleGrid>
      </VStack>
    </AuthenticatedTemplate>
  );
};

export default Dashboard;
