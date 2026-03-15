import { DeleteIcon, HamburgerIcon, SettingsIcon } from "@chakra-ui/icons";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Heading,
  IconButton,
  Menu,
  MenuButton,
  MenuGroup,
  MenuItem,
  MenuList,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  useDisclosure,
  useToast,
  VStack,
} from "@chakra-ui/react";
import axios from "axios";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AsyncSelect from "react-select/async";
import useSwr, { mutate } from "swr";
import { ApplicationListResource } from "../../components/application";
import { Option } from "../../components/selectors/index.js";
import { User } from "../../components/user";
import { useIsOwner } from "../../hooks/useIsOwner";
import { readGroup } from "../../resources";

const GroupDetails = () => {
  const router = useRouter();
  const [id, setId] = useState("");
  useEffect(() => {
    if (router.isReady) {
      setId(router.query.id as string);
    }
  }, [router.isReady, router.query.id]);

  return <>{id ? <Group id={id} /> : null}</>;
};

const Group = ({ id }) => {
  const { data, error, isLoading } = useSwr(`/api/groups/${id}`, readGroup(id));
  const { isOwner } = useIsOwner();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const [selectedOwnersOptions, setSelectedOwnersOptions] = useState(
    [] as Option[]
  );
  const [selectedMembersOptions, setSelectedMembersOptions] = useState(
    [] as Option[]
  );

  const { group, owners, members, ownedApplications } = data ?? {
    group: {},
    owners: [],
    members: [],
    ownedApplications: [],
  };

  const ownerIds = owners.map((owner) => owner.id);
  useEffect(() => {
    if (!isLoading) {
      setSelectedOwnersOptions(
        owners.map(
          (owner) =>
            ({
              value: owner.id,
              label: `${owner.name} - ${owner.email}`,
            } as Option)
        )
      );
      setSelectedMembersOptions(
        members.map(
          (member) =>
            ({
              value: member.id,
              label: `${member.name} - ${member.email}`,
            } as Option)
        )
      );
    }
  }, [isLoading, owners, members]);

  if (isLoading) {
    return <>Loading group...</>;
  }

  const deleteGroup = async (e) => {
    e.preventDefault();
    toast({
      title: "Deleting Group",
      description: `Deleting group, ${group.name}`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    try {
      await axios.delete(`/api/groups/${group.id}`);
      toast({
        title: "Deleted Group",
        description: `Deleted group, ${group.name}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      await mutate("/api/users/me");
      // router.push("/dashboard");
      // todo: figure out why router.push doesn't work
      window.location.replace("/dashboard");
    } catch (e) {
      toast({
        title: "Error!",
        description: `Couldn't delete group, ${group.name} - ${e.response?.data?.message}`,
        status: "error",
        duration: 10000,
        isClosable: true,
      });
    }
  };

  const loadUserOptions = async (inputValue: string): Promise<Option[]> => {
    const resp = await axios.get("/api/users/search", {
      params: {
        prefix: inputValue,
      },
    });

    return (
      resp.data.users?.map(
        (owner) =>
          ({
            value: owner.id,
            label: `${owner.name} - ${owner.email}`,
          } as Option)
      ) ?? []
    );
  };

  const updateGroup = async () => {
    toast({
      title: "Updating Group",
      description: `Updating group, ${group.name}`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });

    const newOwnerIds = selectedOwnersOptions.map((option) => option.value);

    const oldOwnerIds = owners.map((owner) => owner.id);

    const newMemberIds = selectedMembersOptions.map((option) => option.value);

    const oldMemberIds = members.map((owner) => owner.id);

    const containsAll = (arr1, arr2) =>
      arr2.every((arr2Item) => arr1.includes(arr2Item));

    const sameMembers = (arr1, arr2) =>
      containsAll(arr1, arr2) && containsAll(arr2, arr1);

    if (!sameMembers(newOwnerIds, oldOwnerIds)) {
      toast({
        title: "Updating Group Ownership",
        description: `Ownership has changed, updating group owners`,
        status: "info",
        duration: 3000,
        isClosable: true,
      });
      await axios.patch(`/api/groups/${group.id}/owners`, {
        ownerIds: selectedOwnersOptions.map((option) => option.value),
      });
      toast({
        title: "Updated Application Ownership",
        description: `Updated application ownership`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    }

    if (!sameMembers(newMemberIds, oldMemberIds)) {
      toast({
        title: "Updating Group Membership",
        description: `Membership has changed, updating group members`,
        status: "info",
        duration: 3000,
        isClosable: true,
      });
      await axios.patch(`/api/groups/${group.id}/members`, {
        memberIds: selectedMembersOptions.map((option) => option.value),
      });
      toast({
        title: "Updated Application Membership",
        description: `Updated application membership`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    }

    await mutate(`/api/groups/${id}`);
    await onClose();
  };

  return (
    <Flex width={"100%"} gap="10px">
      <Card variant={"outline"}>
        <CardHeader>
          <Flex justifyContent={"space-between"} gap={"10px"}>
            <Heading as={"h1"} fontSize={"lg"}>
              {data.group.name}
            </Heading>

            {isOwner(data.owners.map((owner) => owner.id)) ? (
              <Menu>
                <MenuButton
                  as={IconButton}
                  aria-label="Options"
                  icon={<HamburgerIcon />}
                  variant="outline"
                />
                <MenuList>
                  <MenuGroup title="Danger Zone" color="red">
                    <MenuItem
                      color={"red"}
                      icon={<DeleteIcon />}
                      onClick={deleteGroup}
                    >
                      Delete
                    </MenuItem>
                  </MenuGroup>
                </MenuList>
              </Menu>
            ) : null}
          </Flex>
        </CardHeader>
      </Card>
      <Flex
        direction={"column"}
        grow={1}
        shrink={0}
        overflow={"auto"}
        gap={"15px"}
      >
        <Card variant={"outline"}>
          <CardHeader>
            <Flex
              gap="5px"
              justifyContent={"space-between"}
              alignItems="center"
            >
              <Heading as={"h2"} fontSize={"md"}>
                Owners
              </Heading>
              {isOwner(data.owners.map((owner) => owner.id)) ? (
                <IconButton
                  aria-label="Modify Group Ownership"
                  colorScheme={"blue"}
                  size={"md"}
                  icon={<SettingsIcon />}
                  onClick={onOpen}
                />
              ) : null}
            </Flex>
          </CardHeader>
          <CardBody>
            <VStack alignItems={"start"}>
              {data.owners.map((owner) => (
                <User key={owner.id} id={owner.id} />
              ))}
            </VStack>
          </CardBody>
        </Card>
        <Card variant={"outline"}>
          <CardHeader>
            <Flex
              gap="5px"
              justifyContent={"space-between"}
              alignItems="center"
            >
              <Heading as={"h2"} fontSize={"md"}>
                Members
              </Heading>
              {isOwner(data.owners.map((owner) => owner.id)) ? (
                <IconButton
                  aria-label="Modify Group Ownership"
                  colorScheme={"blue"}
                  size={"md"}
                  icon={<SettingsIcon />}
                  onClick={onOpen}
                />
              ) : null}
            </Flex>
          </CardHeader>
          <CardBody>
            <VStack alignItems={"start"}>
              {data.members.map((member) => (
                <User key={member.id} id={member.id} />
              ))}
            </VStack>
          </CardBody>
        </Card>
        {isOwner(data.owners.map((owner) => owner.id)) ||
        isOwner(data.members.map((member) => member.id)) ? (
          <Card variant={"outline"}>
            <CardHeader>
              <Flex gap="5px" alignItems="center">
                <Heading as={"h2"} fontSize={"md"}>
                  Owned Applications
                </Heading>
              </Flex>
            </CardHeader>
            <CardBody>
              <ApplicationListResource applications={data.ownedApplications} />
            </CardBody>
          </Card>
        ) : null}
      </Flex>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Update Group</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack mt={"5px"} pl="15px" pr="15px">
              <Heading as={"h4"} fontSize={"md"}>
                Owners
              </Heading>
              <AsyncSelect
                isMulti
                cacheOptions
                value={selectedOwnersOptions}
                loadOptions={loadUserOptions}
                onChange={(selection: Option[]) => {
                  setSelectedOwnersOptions(selection);
                }}
              />
            </Stack>
            <Stack mt={"5px"} pl="15px" pr="15px">
              <Heading as={"h4"} fontSize={"md"}>
                Members
              </Heading>
              <AsyncSelect
                isMulti
                cacheOptions
                value={selectedMembersOptions}
                loadOptions={loadUserOptions}
                onChange={(selection: Option[]) => {
                  setSelectedMembersOptions(selection);
                }}
              />
            </Stack>
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="green" mr={3} onClick={updateGroup}>
              Save
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

export default GroupDetails;
