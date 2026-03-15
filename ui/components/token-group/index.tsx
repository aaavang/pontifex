import {
  DeleteIcon,
  EditIcon,
  PlusSquareIcon,
  QuestionIcon,
} from "@chakra-ui/icons";
import {
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
  useToast,
} from "@chakra-ui/react";
import axios from "axios";
import { useState } from "react";
import useSwr from "swr";
import { useIsApplicationOwner } from "../../hooks/useIsOwner";
import { PontifexTokenGroup } from "../../models/axios";
import { readEnvironment } from "../../resources";
import { tokenGroupsHelpText } from "../../strings";
import { confirm } from "../../utils/confirm/Confirm";

export const TokenGroupList = ({ id }) => {
  const { data, mutate } = useSwr(
    `/api/environments/${id}`,
    readEnvironment(id)
  );

  const tokenGroups = data?.tokenGroups ?? [];

  const { isOwner } = useIsApplicationOwner(data?.application.id);

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const updateModal = useDisclosure();
  const [updatedTokenGroup, setUpdateTokenGroup] = useState({
    id: "",
    description: "",
  });
  const [newTokenGroup, setNewTokenGroup] = useState({
    name: "",
    claimValue: "",
    groupId: "",
    description: "",
  } as PontifexTokenGroup);
  const generateHandler = (field, eventField) => (event) => {
    const updatedTokenGroup = { ...newTokenGroup };
    updatedTokenGroup[field] = event.target[eventField];
    setNewTokenGroup(updatedTokenGroup);
  };

  const updateTokenGroup = async () => {
    updateModal.onClose();
    const toastId = toast({
      title: "Updating Token Group",
      description: `Updating token group, ${newTokenGroup.name}`,
      status: "info",
      duration: 10000,
      isClosable: true,
    });
    const resp = await axios.patch(
      `/api/applications/${data.application.id}/token-groups/${updatedTokenGroup.id}`,
      {
        description: updatedTokenGroup.description,
      },
      {
        validateStatus: () => true,
      }
    );
    toast.close(toastId);
    if (resp.status !== 201) {
      toast({
        title: "Token Group Update Failed",
        description: `Token group update failed - ${resp.data.errorMessage}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } else {
      setUpdateTokenGroup({
        id: "",
        description: "",
      });
      await mutate();
      toast({
        title: "Token Group Updated",
        description: "Token group updated",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const addTokenGroup = async () => {
    onClose();

    const toastId = toast({
      title: "Creating Token Group",
      description: `Creating token group, ${newTokenGroup.name}, which will be connected to group ID, ${newTokenGroup.groupId}`,
      status: "info",
      duration: 10000,
      isClosable: true,
    });
    const resp = await axios.post(
      `/api/applications/${data.application.id}/token-groups`,
      newTokenGroup,
      {
        validateStatus: () => true,
      }
    );

    if (resp.status === 201) {
      toast.close(toastId);
      toast({
        title: "Token Group Created",
        description: "Token group created",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      setNewTokenGroup({
        name: "",
        claimValue: "",
        groupId: "",
      } as PontifexTokenGroup);
    } else {
      toast.close(toastId);
      toast({
        title: "Token Group Creation Failed",
        description: `Token group creation failed - ${resp.data.errorMessage}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
    await mutate();
  };

  const removeTokenGroup = async (tokenGroup: PontifexTokenGroup) => {
    toast({
      title: "Deleting Token Group",
      description: `Deleting token group, ${tokenGroup.name}`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    await axios.delete(
      `/api/applications/${data.application.id}/token-groups`,
      {
        data: {
          name: tokenGroup.name,
        },
      }
    );
    toast({
      title: "Token Group Delete",
      description: "Token group deleted",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    await mutate();
  };

  const tokenGroupItems = tokenGroups.map((tg) => {
    return (
      <Tr key={tg.id}>
        <Td>{tg.name}</Td>
        <Td>{tg.claimValue}</Td>
        <Td>
          <Link
            color={"blue"}
            href={`https://portal.azure.com/#view/Microsoft_AAD_IAM/GroupDetailsMenuBlade/~/Overview/groupId/${tg.groupId}/menuId/`}
            isExternal
          >
            {tg.groupId}
          </Link>
        </Td>
        <Td maxWidth={"200px"}>
          <Text whiteSpace={"normal"} wordBreak={"break-all"}>
            {tg.description}
          </Text>
        </Td>
        <Td>
          {isOwner() ? (
            <>
              <IconButton
                aria-label={"Edit Token Group"}
                icon={<EditIcon />}
                colorScheme={"blue"}
                variant={"outline"}
                onClick={() => {
                  setUpdateTokenGroup({
                    id: tg.id,
                    description: tg.description,
                  });
                  updateModal.onOpen();
                }}
              />
              <IconButton
                aria-label="Remove Token Group"
                icon={<DeleteIcon />}
                color={"red"}
                variant={"outline"}
                onClick={confirm(
                  "Are you sure you want to delete this token group?",
                  () => removeTokenGroup(tg)
                )}
              />
            </>
          ) : null}
        </Td>
      </Tr>
    );
  });

  if (data && !isOwner()) {
    tokenGroupItems.push(
      <Tr key={"not-authorized-to-see-token-groups"}>
        <Td>Not Authorized to see Token Groups</Td>
        <Td />
        <Td />
        <Td />
      </Tr>
    );
  } else if (tokenGroups.length === 0) {
    tokenGroupItems.push(
      <Tr key={"no-token-groups"}>
        <Td>No Token Groups</Td>
        <Td />
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
              Token Groups
            </Heading>
            <Tooltip label={tokenGroupsHelpText} fontSize="md" hasArrow>
              <QuestionIcon color="gray" />
            </Tooltip>
          </Flex>
          {isOwner() ? (
            <IconButton
              aria-label="Add Token Group"
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
                <Th>Claim Value</Th>
                <Th>Group ID</Th>
                <Th>Description</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>{tokenGroupItems}</Tbody>
          </Table>
        </TableContainer>
      </CardBody>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Create New Token Group</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Input
                placeholder="Name"
                size="lg"
                value={newTokenGroup.name}
                onChange={generateHandler("name", "value")}
              />
              <Input
                placeholder="Claim Value"
                size="lg"
                value={newTokenGroup.claimValue}
                onChange={generateHandler("claimValue", "value")}
              />
              <Input
                placeholder="Azure AD Group ID"
                size="lg"
                value={newTokenGroup.groupId}
                onChange={generateHandler("groupId", "value")}
              />
              <Textarea
                placeholder="Description"
                size="lg"
                value={newTokenGroup.description}
                onChange={generateHandler("description", "value")}
              />
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="green" mr={3} onClick={addTokenGroup}>
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
          <ModalHeader>Update Token Group</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <Heading as={"h2"} fontSize={"md"}>
                Description
              </Heading>
              <Textarea
                value={updatedTokenGroup.description}
                onChange={(e) =>
                  setUpdateTokenGroup({
                    ...updatedTokenGroup,
                    description: e.target.value,
                  })
                }
              />
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button
              colorScheme="green"
              mr={3}
              onClick={() => updateTokenGroup()}
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

export const StandaloneTokenGroupList = ({
  tokenGroups,
}: {
  tokenGroups: PontifexTokenGroup[];
}) => {
  const tokenGroupItems = tokenGroups.map((tg) => {
    return (
      <Tr key={tg.id}>
        <Td>{tg.name}</Td>
        <Td>{tg.claimValue}</Td>
        <Td>
          <Link
            color={"blue"}
            href={`https://portal.azure.com/#view/Microsoft_AAD_IAM/GroupDetailsMenuBlade/~/Overview/groupId/${tg.groupId}/menuId/`}
            isExternal
          >
            {tg.groupId}
          </Link>
        </Td>
        <Td>
          <Text
            maxWidth={"400px"}
            whiteSpace={"normal"}
            wordBreak={"break-word"}
          >
            {tg.description}
          </Text>
        </Td>
      </Tr>
    );
  });

  if (tokenGroups.length === 0) {
    tokenGroupItems.push(
      <Tr key={"no-token-groups"}>
        <Td>No Token Groups</Td>
        <Td />
        <Td />
        <Td />
      </Tr>
    );
  }

  return (
    <TableContainer>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Claim Value</Th>
            <Th>Group ID</Th>
            <Th>Description</Th>
          </Tr>
        </Thead>
        <Tbody>{tokenGroupItems}</Tbody>
      </Table>
    </TableContainer>
  );
};
