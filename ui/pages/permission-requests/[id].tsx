import { CheckIcon, WarningIcon } from "@chakra-ui/icons";
import {
  Badge,
  Button,
  Flex,
  HStack,
  Heading,
  Link,
  List,
  ListItem,
  Skeleton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from "@chakra-ui/react";
import axios from "axios";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useSwr, { mutate } from "swr";
import { TargetPermissionLink } from "../../components/permission-request";
import { User } from "../../components/user";
import { useIsOwner } from "../../hooks/useIsOwner";
import {
  PontifexGetOwnersResponse,
  PontifexGetPermissionRequestResponse
} from "../../models/axios";
import { readRole, readPermissionRequest } from "../../resources";

const PermissionRequestDetailsPage = () => {
  const router = useRouter();
  const [id, setId] = useState("");
  useEffect(() => {
    if (router.isReady) {
      setId(router.query.id as string);
    }
  }, [router.isReady, router.query.id]);

  return <>{id ? <PermissionRequestDetails id={id} /> : null}</>;
};

const PermissionRequestDetails = ({ id }) => {
  const { data, error, isLoading } = useSwr(
    `/api/permission-requets/${id}`,
    readPermissionRequest(id)
  );

  const [owners, setOwners] = useState([]);

  const { isOwner } = useIsOwner();

  const {
    permissionRequest,
    sourceEnvironment,
    targetEnvironment,
    targetRole,
    targetScope,
  }: PontifexGetPermissionRequestResponse =
    data ?? ({} as PontifexGetPermissionRequestResponse);

  useEffect(() => {
    const getIsOwner = async () => {
      if (targetRole) {
        const { data } = await axios.get<PontifexGetOwnersResponse>(
          `/api/roles/${targetRole?.id}/owners`
        );
        setOwners(data.owners);
      } else if (targetScope) {
        const { data } = await axios.get<PontifexGetOwnersResponse>(
          `/api/scopes/${targetScope?.id}/owners`
        );
        setOwners(data.owners);
      }
    };

    if (!isLoading) {
      getIsOwner();
    }
  }, [targetRole?.id, targetScope?.id, isLoading]);

  if (isLoading) {
    return <Text>Loading permission request...</Text>;
  }

  const getBadgeColor = (status: "PENDING" | "APPROVED" | "REJECTED") => {
    switch (status) {
      case "PENDING":
        return "yellow";
      case "APPROVED":
        return "green";
      case "REJECTED":
        return "red";
    }
  };

  const ownersItems = owners.map((owner) => (
    <ListItem key={owner}>
      <User id={owner.id} />
    </ListItem>
  ));

  return (
    <>
      <VStack>
        <VStack>
          <Heading>Permission Request Details</Heading>
          <h3>ID: {permissionRequest.id}</h3>
          <h3>Create Date: {permissionRequest.createDate}</h3>
          <h3>
            Status:{" "}
            <Badge colorScheme={getBadgeColor(permissionRequest.status)}>
              {permissionRequest.status}
            </Badge>
          </h3>
        </VStack>

        <Flex alignItems={"beginning"}>
          <VStack m={2} p={5} shadow="md" borderWidth="1px" rounded="lg">
            <Heading>Source Environment</Heading>
            <Flex alignItems={"center"} gap={"5px"}>
              <p>Requestor: </p>
              <User id={permissionRequest.requestor} />
            </Flex>
            <h3>
              <Link
                href={`/environments/${sourceEnvironment.id}`}
                color={"blue"}
              >{`${sourceEnvironment.name
                } (${sourceEnvironment.level.toUpperCase()})`}</Link>
            </h3>
          </VStack>
          <HStack alignItems={"center"}>
            <Image
              src="/bridge.png"
              title="Bridge"
              width={50}
              height={50}
              alt={"pontifex bridge icon"}
            />
          </HStack>
          <VStack m={2} p={5} shadow="md" borderWidth="1px" rounded="lg">
            {targetRole ? <Heading>Target Role</Heading> : <Heading>Target Scope</Heading>}
            <Flex alignItems={"center"} gap={"5px"}>
              <p>Approvers: </p>
              <List>{ownersItems}</List>
            </Flex>
            <h3>
              Name:{" "}
              <TargetPermissionLink
                targetPermissionType={permissionRequest.permissionType}
                targetPermissionId={permissionRequest.targetPermissionId}
                targetPermissionName={permissionRequest.targetPermissionName}
              />
            </h3>
            <h3>
              Environment:{" "}
              <Link
                href={`/environments/${targetEnvironment.id}`}
                color={"blue"}
              >{`${targetEnvironment.name
                } (${targetEnvironment.level.toUpperCase()})`}</Link>
            </h3>
            <h3>Sensitive: {JSON.stringify(targetRole?.sensitive)}</h3>
          </VStack>
        </Flex>

        {owners?.some((o) => isOwner(o.id)) ? (
          <>
            {
              targetRole ? (
                <VStack boxShadow={"md"} borderWidth={"1px"} rounded={"lg"} p={5}>
                  <Heading>Insights</Heading>
                  <Insights
                    id={targetRole.id}
                    sourceEnvironment={sourceEnvironment}
                  />
                  <AdminActions pr={permissionRequest} />
                </VStack>
              ) : <AdminActions pr={permissionRequest} />}
          </>
        ) : null}
      </VStack >
    </>
  );
};

const Insights = ({ id, sourceEnvironment }) => {
  const { data, error, isLoading } = useSwr(
      `/api/permission-requests/${id}`,
      readRole(id)
  );

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  const { environment } = data;

  return (
    <>
      <TableContainer>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Check</Th>
              <Th>Result</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td>
                Environments match (
                {`${environment.level} === ${sourceEnvironment.level}`})
              </Td>
              <Td textAlign={"center"}>
                {environment.level === sourceEnvironment.level ? (
                  <CheckIcon color="green" />
                ) : (
                  <WarningIcon color={"red"} />
                )}
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    </>
  );
}

const AdminActions = ({ pr }) => {
  const toast = useToast();
  const updateStatus = async (approved) => {
    toast({
      title: "Updating Permission Request Status",
      description: `Setting status to be ${approved ? "APPROVED" : "REJECTED"}`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    const res = await axios.patch(`/api/permission-requests/${pr.id}`, {
      status: approved ? "APPROVED" : "REJECTED",
    });
    toast({
      title: "Permission Request Status Updated",
      description: `Setting status updated`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    await mutate(`/api/permission-requets/${pr.id}`);
  };

  return (
    <>
      <VStack p={5} shadow="md" borderWidth="1px" rounded="lg">
        <Heading>Admin Actions</Heading>
        <HStack>
          {pr.status !== "APPROVED" ? (
            <Button colorScheme="green" onClick={() => updateStatus(true)}>
              Approve
            </Button>
          ) : null}
          {pr.status !== "REJECTED" ? (
            <Button colorScheme="red" onClick={() => updateStatus(false)}>
              Reject
            </Button>
          ) : null}
        </HStack>
      </VStack>
    </>
  );
};

export default PermissionRequestDetailsPage;
