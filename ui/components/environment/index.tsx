import {
  CheckCircleIcon,
  DeleteIcon,
  ExternalLinkIcon,
  PlusSquareIcon,
  QuestionIcon,
  WarningTwoIcon,
} from "@chakra-ui/icons";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
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
  Stack,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Textarea,
  Th,
  Thead,
  Tooltip,
  Tr,
  useDisclosure,
  useToast
} from "@chakra-ui/react";
import axios from "axios";
import { useState } from "react";
import useSwr, { mutate } from "swr";
import { v4 as uuid } from "uuid";
import { useIsApplicationOwner } from "../../hooks/useIsOwner";
import {
  PontifexRole,
  PontifexApplicationScope,
  PontifexGetEnvironmentResponse,
} from "../../models/axios";
import { readEnvironment } from "../../resources";
import {
  nonSensitiveHelpText,
  rolesHelpText,
  scopesHelpText,
  sensitiveHelpText,
} from "../../strings";
import { confirm } from "../../utils/confirm/Confirm";

export const EnvironmentListItem = ({ id }) => {
  const { data, error, isLoading } = useSwr(
    `/api/environments/${id}`,
    readEnvironment(id)
  );

  if (isLoading) {
    return <Tr key={Math.random()}></Tr>;
  }

  const { environment, permissionRequests } = data;

  const pendingRequestCount = permissionRequests.filter(
    (pr) => pr.status === "PENDING"
  ).length;

  return (
    <Tr key={environment.id}>
      <Td gap={"5px"}>
        <Link href={`/environments/${environment.id}`} color={"blue"}>
          {environment.level.toUpperCase()}
        </Link>
        {pendingRequestCount > 0 ? (
          <Badge
            marginLeft={5}
            colorScheme="yellow"
          >{`${pendingRequestCount} Pending Request${pendingRequestCount > 1 ? "s" : ""
            }`}</Badge>
        ) : null}
      </Td>
    </Tr>
  );
};

export const EnvironmentList = ({ environments }) => {
  const environmentItems = environments.map((env) => (
    <EnvironmentListItem key={env.id} id={env.id} />
  ));

  if (environmentItems.length === 0) {
    environmentItems.push(
      <Tr key={"no-envs"}>
        <Td>No Environments</Td>
      </Tr>
    );
  }

  return (
    <>
      <TableContainer>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Environment</Th>
            </Tr>
          </Thead>
          <Tbody>{environmentItems}</Tbody>
        </Table>
      </TableContainer>
    </>
  );
};

export const EnvironmentRoleList = ({ id }) => {
  return <EnvironmentRoleListResource id={id} />;
};

export const EnvironmentScopeList = ({ id }) => {
  return <EnvironmentScopeListResource id={id} />;
};

export const EnvironmentRoleListResource = ({ id }) => {
  const { data, error, isLoading } = useSwr(
    `/api/environments/${id}`,
    readEnvironment(id)
  );

  const { roles, scopes, application }: PontifexGetEnvironmentResponse =
    data ??
    ({
      roles: [],
      scopes: [],
      application: {},
    } as PontifexGetEnvironmentResponse);

  const { isOwner } = useIsApplicationOwner(application.id);

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const updateModal = useDisclosure();
  const [newRole, setNewRole] = useState({
    id: uuid(),
    name: "",
    sensitive: false,
    description: "",
  } as PontifexRole);
  const [updatedRole, setUpdatedRole] = useState({
    id: uuid(),
    name: "",
    sensitive: false,
    description: "",
  } as PontifexRole);
  const generateHandler =
    (updateFunction, state, field, eventField) => (event) => {
      const updatedRole = { ...state };
      updatedRole[field] = event.target[eventField];
      updateFunction(updatedRole);
    };

  const updateRole = async () => {
    const newRoles = [...roles];
    const index = newRoles.findIndex(
      (e) => e.name === updatedRole.name
    );
    newRoles[index] = updatedRole;

    toast({
      title: "Updating Role",
      description: `Updating role`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });

    await updateRoles(newRoles);
    setUpdatedRole({
      id: uuid(),
      name: "",
      sensitive: false,
      description: "",
    } as PontifexRole);
    updateModal.onClose();
  };

  const addRole = async () => {
    const newRoles = [...roles];

    if (newRoles.some((e) => e.name === newRole.name)) {
      toast({
        title: "Cannot Add Duplicate Role",
        description: `A role with the name ${newRole.name} already exists.  Please choose a different name.`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (scopes.some((e) => e.name === newRole.name)) {
      toast({
        title: "Cannot Add Role with Same Name as Scope",
        description: `A scope with the name ${newRole.name} already exists.  Please choose a different name.`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    toast({
      title: "Adding Role",
      description: `Adding role`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });

    newRoles.push(newRole);

    await updateRoles(newRoles);
    setNewRole({
      id: uuid(),
      name: "",
      sensitive: false,
    } as PontifexRole);
  };

  const deleteRole = async (role) => {
    toast({
      title: "Deleting Role",
      description: `Deleting role`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    const newRoles = roles.filter((e) => e.name !== role.name);

    await updateRoles(newRoles);
  };

  const updateRoles = async (roles: PontifexRole[]) => {
    onClose();

    const roleDTOs = roles.map((e) => {
      return {
        displayName: e.name,
        description: e.description ?? "",
        claimValue: e.name,
        sensitive: e.sensitive,
      };
    });

    try {
      await axios.patch(`/api/applications/${application.id}/roles`, { roles: roleDTOs });
      setNewRole({
        id: uuid(),
        name: "",
        sensitive: false,
      } as PontifexRole);
      await mutate(`/api/environments/${id}`);
      toast({
        title: "Roles Updated",
        description: `Updated roles`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (e) {
      toast({
        title: "Error Updating Roles",
        description: `Error updating roles: ${e.response?.data?.errorMessage}`,
        status: "error",
        duration: 10000,
        isClosable: true,
      });
    }
  };

  const roleItems = roles.map((role) => {
    return (
      <Tr key={role.id}>
        <Td>{role.name}</Td>
        <Td>
          {role.sensitive ? (
            <Tooltip label={sensitiveHelpText} fontSize={"md"}>
              <WarningTwoIcon color={"orange"} />
            </Tooltip>
          ) : (
            <Tooltip label={nonSensitiveHelpText} fontSize={"md"}>
              <CheckCircleIcon color={"green"} />
            </Tooltip>
          )}
        </Td>
        <Td>
          <Text
            whiteSpace={"normal"}
            wordBreak={"break-word"}
            maxWidth={"500px"}
          >
            {role.description}
          </Text>
        </Td>
        <Td>
          {isOwner() ? (
            <>
              <IconButton
                aria-label="Edit Role"
                icon={<ExternalLinkIcon />}
                variant={"outline"}
                colorScheme={"blue"}
                onClick={() => {
                  setUpdatedRole(role);
                  updateModal.onOpen();
                }}
              />
              <IconButton
                aria-label="Remove Role"
                icon={<DeleteIcon />}
                color={"red"}
                variant={"outline"}
                onClick={confirm(
                  "Are you sure you want to delete this role?",
                  () => deleteRole(role)
                )}
              />
            </>
          ) : null}
        </Td>
      </Tr>
    );
  });

  if (roleItems.length === 0) {
    roleItems.push(
      <Tr key={"no-roles"}>
        <Td>No Roles</Td>
        <Td />
        <Td />
        <Td />
      </Tr>
    );
  }

  return (
    <Card variant={"outline"}>
      <CardHeader>
        <Flex alignItems={"center"} justifyContent={"space-between"}>
          <Flex gap="5px" alignItems="center">
            <Heading as={"h2"} fontSize={"md"}>
              Roles
            </Heading>
            <Tooltip label={rolesHelpText} fontSize="md" hasArrow>
              <QuestionIcon color="gray" />
            </Tooltip>
          </Flex>
          {isOwner() ? (
            <IconButton
              aria-label="Add Role"
              colorScheme={"green"}
              icon={<PlusSquareIcon />}
              onClick={onOpen}
            />
          ) : null}
        </Flex>
      </CardHeader>
      <CardBody>
        <TableContainer>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Sensitive</Th>
                <Th>Description</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>{roleItems}</Tbody>
          </Table>
        </TableContainer>
      </CardBody>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Role</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Input
                isInvalid={!newRole.name}
                placeholder="Name"
                size="lg"
                value={newRole.name}
                onChange={generateHandler(
                  setNewRole,
                  newRole,
                  "name",
                  "value"
                )}
              />
              <Checkbox
                isChecked={newRole.sensitive}
                onChange={generateHandler(
                  setNewRole,
                  newRole,
                  "sensitive",
                  "checked"
                )}
              >
                Sensitive
              </Checkbox>
              <Heading as={"h2"} fontSize={"md"}>
                Description
              </Heading>
              <Textarea
                value={newRole.description}
                onChange={generateHandler(
                  setNewRole,
                  newRole,
                  "description",
                  "value"
                )}
              />
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="green" mr={3} onClick={addRole} isDisabled={!newRole.name}>
              Save
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <Modal isOpen={updateModal.isOpen} onClose={updateModal.onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Update Role</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Checkbox
                isChecked={updatedRole.sensitive}
                onChange={generateHandler(
                  setUpdatedRole,
                  updatedRole,
                  "sensitive",
                  "checked"
                )}
              >
                Sensitive
              </Checkbox>
              <Heading as={"h2"} fontSize={"md"}>
                Description
              </Heading>
              <Textarea
                value={updatedRole.description}
                onChange={generateHandler(
                  setUpdatedRole,
                  updatedRole,
                  "description",
                  "value"
                )}
              />
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button
              colorScheme="green"
              mr={3}
              onClick={confirm(
                "Are you sure you want to update this role?",
                updateRole
              )}
            >
              Save
            </Button>
            <Button variant="ghost" onClick={updateModal.onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
};

export const EnvironmentScopeListResource = ({ id }) => {
  const { data, error, isLoading } = useSwr(
    `/api/environments/${id}`,
    readEnvironment(id)
  );

  const { scopes, roles, application }: PontifexGetEnvironmentResponse =
    data ??
    ({
      scopes: [],
      roles: [],
      application: {},
    } as PontifexGetEnvironmentResponse);

  const { isOwner } = useIsApplicationOwner(application.id);

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [newScope, setNewScope] = useState({
    id: uuid(),
    name: "",
    displayName: "",
    description: "",
  } as PontifexApplicationScope);
  const generateHandler = (field, eventField) => (event) => {
    const updatedScope = { ...newScope };
    updatedScope[field] = event.target[eventField];
    setNewScope(updatedScope);
  };

  const addScope = async () => {
    const newScopes = [...scopes];

    if (newScopes.some((e) => e.name === newScope.name)) {
      toast({
        title: "Cannot Add Duplicate Scope",
        description: `A scope with the name ${newScope.name} already exists.  Please choose a different name.`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (roles.some((e) => e.name === newScope.name)) {
      toast({
        title: "Cannot Add Scope with Same Name as Role",
        description: `A role with the name ${newScope.name} already exists.  Please choose a different name.`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    toast({
      title: "Adding Scope",
      description: `Adding Scope`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });

    newScopes.push(newScope);

    await updateScopes(newScopes);
    setNewScope({
      id: uuid(),
      name: "",
      displayName: "",
      description: "",
    } as PontifexApplicationScope);
  };

  const deleteScope = async (scope) => {
    toast({
      title: "Deleting Scope",
      description: `Deleting Scope`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    const newScopes = scopes.filter((e) => e.name !== scope.name);

    await updateScopes(newScopes);
  };

  const updateScopes = async (scopesInput: PontifexApplicationScope[]) => {
    onClose();

    const applicationScopes = scopesInput.map((e) => {
      return {
        name: e.name,
        displayName: e.displayName,
        description: e.description,
      };
    });

    try {
      await axios.patch(`/api/applications/${application.id}/scopes`, { scopes: applicationScopes });
      setNewScope({
        id: uuid(),
        name: "",
        displayName: "",
        description: "",
      } as PontifexApplicationScope);
      await mutate(`/api/environments/${id}`);
      toast({
        title: "Scopes Updated",
        description: `Updated scopes`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (e) {
      toast({
        title: "Error Updating Scopes",
        description: `Error updating scopes: ${e.response?.data?.errorMessage}`,
        status: "error",
        duration: 10000,
        isClosable: true,
      });
    }
  };

  const scopeItems = scopes.map((scope) => {
    return (
      <Tr key={scope.id}>
        <Td>{scope.name}</Td>
        <Td>{scope.displayName}</Td>
        <Td>{scope.description}</Td>
        <Td>
          {isOwner() ? (
            <IconButton
              aria-label="Remove Scope"
              icon={<DeleteIcon />}
              color={"red"}
              variant={"outline"}
              onClick={confirm(
                "Are you sure you want to delete this scope?",
                () => deleteScope(scope)
              )}
            />
          ) : null}
        </Td>
      </Tr>
    );
  });

  if (scopeItems.length === 0) {
    scopeItems.push(
      <Tr key={"no-scopes"}>
        <Td>No Scopes</Td>
        <Td />
        <Td />
        <Td />
      </Tr>
    );
  }

  return (
    <Card variant={"outline"}>
      <CardHeader>
        <Flex alignItems={"center"} justifyContent={"space-between"}>
          <Flex gap="5px" alignItems="center">
            <Heading as={"h2"} fontSize={"md"}>
              Scopes
            </Heading>
            <Tooltip label={scopesHelpText} fontSize="md" hasArrow>
              <QuestionIcon color="gray" />
            </Tooltip>
          </Flex>
          {isOwner() ? (
            <IconButton
              aria-label="Add Scope"
              colorScheme={"green"}
              icon={<PlusSquareIcon />}
              onClick={onOpen}
            />
          ) : null}
        </Flex>
      </CardHeader>
      <CardBody>
        <TableContainer>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Display Name</Th>
                <Th>Description</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>{scopeItems}</Tbody>
          </Table>
        </TableContainer>
      </CardBody>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Scope</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Input
                isInvalid={!newScope.name}
                placeholder="Name"
                size="lg"
                value={newScope.name}
                onChange={generateHandler("name", "value")}
              />
              <Input
                isInvalid={!newScope.displayName}
                placeholder="Display Name"
                size="lg"
                value={newScope.displayName}
                onChange={generateHandler("displayName", "value")}
              />
              <Textarea
                isInvalid={!newScope.description}
                placeholder="This is shown when the user is asked to approve the scope."
                size="lg"
                value={newScope.description}
                onChange={generateHandler("description", "value")}
              />
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="green" mr={3} onClick={addScope} isDisabled={!newScope.name || !newScope.displayName || !newScope.description}>
              Save
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  );
}