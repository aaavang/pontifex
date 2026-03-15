import {
  DeleteIcon,
  HamburgerIcon,
  QuestionIcon,
  SettingsIcon,
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
  Menu,
  MenuButton,
  MenuDivider,
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
  Text,
  Textarea,
  Tooltip,
  VStack,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import axios from "axios";
import { useRouter } from "next/router";
import {useEffect, useMemo, useState} from "react";
import { MdShare } from "react-icons/md";
import AsyncSelect from "react-select/async";
import useSwr, { mutate } from "swr";
import {
  EnvironmentRoleList,
  EnvironmentList,
  EnvironmentScopeList,
} from "../../components/environment";
import { Group } from "../../components/groups";
import { Option } from "../../components/selectors";
import { TokenGroupList } from "../../components/token-group";
import { User } from "../../components/user";
import { useIsApplicationOwner } from "../../hooks/useIsOwner";
import { PontifexGetApplicationResponse } from "../../models/axios";
import { readApplication } from "../../resources";
import { environmentsHelpText, secretHelpText } from "../../strings";
import { confirm } from "../../utils/confirm/Confirm";

const ApplicationDetails = () => {
  const router = useRouter();
  const [id, setId] = useState("");

  useEffect(() => {
    if (router.isReady) {
      setId(router.query.id as string);
    }
  }, [router.isReady, router.query.id]);

  return <>{id ? <Application id={id} /> : null}</>;
};

interface ApplicationProps {
  id: string;
}

const Application = ({ id }: ApplicationProps) => {
  const router = useRouter();
  const { data } = useSwr(`/api/applications/${id}`, readApplication(id));
  const { application, environments, owners, ownerGroups } =
    data ??
    ({
      application: {},
      environments: [],
      owners: [],
      ownerGroups: [],
      description: "",
    } as PontifexGetApplicationResponse);
  const [selectedOwnersOptions, setSelectedOwnersOptions] = useState(
    [] as Option[]
  );

  const ownerIds = owners.map((owner) => owner.id);

  useEffect(() => {
    if (data) {
      setSelectedOwnersOptions(
        owners
          .map(
            (owner) =>
            ({
              value: owner.id,
              label: `${owner.name} - ${owner.email}`,
            } as Option)
          )
          .concat(
            ownerGroups.map(
              (group) =>
              ({
                value: group.id,
                label: `${group.name} (Group)`,
              } as Option)
            )
          )
      );
    }
  }, [data, owners, ownerGroups]);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const { isOwner } = useIsApplicationOwner(id);

  const possibleEnvs = useMemo(() => ["dev", "test", "qa", "prod"], []);

  const [checkboxes, setCheckboxes] = useState(
    possibleEnvs.map((env) => ({
      name: env,
      isChecked: environments.some((env2) => env2.level === env),
    }))
  );

  const [isSecret, setIsSecret] = useState(application.secret);
  const [description, setDescription] = useState(application.description);

  useEffect(() => {
    if (data) {
      setIsSecret(application.secret);
      setDescription(application.description);
    }
  }, [application, data]);

  useEffect(() => {
    if (data) {
      setCheckboxes(
        possibleEnvs.map((env) => ({
          name: env,
          isChecked: environments.some((env2) => env2.level === env),
        }))
      );
    }
  }, [data, environments, possibleEnvs]);

  const deleteApplication = async () => {
    toast({
      title: "Deleting Application",
      description: `Deleting application, ${application.name}`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    try {
      await axios.delete(`/api/applications/${application.id}`);
      toast({
        title: "Deleted Application",
        description: `Deleted application, ${application.name}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      await router.push("/dashboard");
    } catch (e: any) {
      toast({
        title: "Unable to delete Application",
        description: e.response?.data?.errorMessage,
        status: "error",
        duration: 10000,
        isClosable: true,
      });
    }
  };

  const confirmDelete = confirm(
    "Are you sure you want to delete this application?",
    deleteApplication
  );

  const onEnvironmentChecked = (e) => {
    const updatedCheckboxes = [...checkboxes];
    const box = updatedCheckboxes.find((box) => box.name === e.target.value);
    if (box) {
      box.isChecked = e.target.checked;
    }
    setCheckboxes(updatedCheckboxes);
  };

  const checkboxElements = data
    ? checkboxes.map((checkbox, index) => (
      <Checkbox
        key={checkbox.name}
        value={checkbox.name}
        isChecked={checkbox.isChecked}
        onChange={onEnvironmentChecked}
      >
        {checkbox.name}
      </Checkbox>
    ))
    : [];

  const updateApplication = async () => {
    toast({
      title: "Updating Application",
      description: `Updating application, ${application.name}`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    await axios.patch(`/api/applications/${application.id}`, {
      secret: isSecret,
      description: description,
      environments: checkboxes
        .filter((checkbox) => checkbox.isChecked)
        .map((checkbox) => checkbox.name),
    });

    const newOwnerIds = selectedOwnersOptions.map((option) => option.value);

    // we have to make sure to merge both owning users and groups together
    const oldOwnerIds = owners
      .map((owner) => owner.id)
      .concat(ownerGroups.map((group) => group.id));

    const containsAll = (arr1, arr2) =>
      arr2.every((arr2Item) => arr1.includes(arr2Item));

    const sameMembers = (arr1, arr2) =>
      containsAll(arr1, arr2) && containsAll(arr2, arr1);

    if (!sameMembers(newOwnerIds, oldOwnerIds)) {
      toast({
        title: "Updating Application Ownership",
        description: `Ownership has changed, updating application owners`,
        status: "info",
        duration: 3000,
        isClosable: true,
      });
      await axios.patch(`/api/applications/${application.id}/owners`, {
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

    toast({
      title: "Updated Application",
      description: `Updated application, ${application.name}`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
    await mutate(`/api/applications/${id}`);
    await onClose();
  };

  const copyConnectionUrl = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/connections/update?targetApplication=${application.id}`
    );
    toast({
      title: "Copied Connection Link",
      description: `Copied link to connect with this application to your clipboard`,
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };

  if (!data) {
    return <Text>Loading application...</Text>;
  }

  const loadUserOptions = async (inputValue: string): Promise<Option[]> => {
    const resp = await axios.get("/api/users/search", {
      params: {
        prefix: inputValue,
      },
    });

    const groupResp = await axios.get("/api/groups/search", {
      params: {
        prefix: inputValue,
      },
    });

    const userOptions =
      resp.data.users?.map(
        (owner) =>
        ({
          value: owner.id,
          label: `${owner.name} - ${owner.email}`,
        } as Option)
      ) ?? [];

    const groupOptions =
      groupResp.data.groups?.map(
        (group) =>
        ({
          value: group.id,
          label: `${group.name} (Group)`,
        } as Option)
      ) ?? [];

    return [...userOptions, ...groupOptions];
  };

    return (
    <Flex width={"100%"} gap="10px">
      <Card variant={"outline"}>
        <CardHeader>
          <Flex justifyContent={"space-between"} gap={"10px"}>
            <Heading as={"h1"} fontSize={"lg"}>
              {application.name}
            </Heading>

            {isOwner() ? (
              <Menu>
                <MenuButton
                  as={IconButton}
                  aria-label="Options"
                  icon={<HamburgerIcon />}
                  variant="outline"
                />
                <MenuList>
                  <MenuItem icon={<SettingsIcon />} onClick={onOpen}>
                    Update
                  </MenuItem>
                  <MenuItem icon={<MdShare />} onClick={copyConnectionUrl}>
                    Copy Connection URL
                  </MenuItem>
                  <MenuDivider />
                  <MenuGroup title="Danger Zone" color="red">
                    <MenuItem
                      color={"red"}
                      icon={<DeleteIcon />}
                      onClick={confirmDelete}
                    >
                      Delete
                    </MenuItem>
                  </MenuGroup>
                </MenuList>
              </Menu>
            ) : null}
          </Flex>
        </CardHeader>
        <CardBody>
          <VStack alignItems={"start"}>
            <Flex gap={"5px"}>
              <Heading as={"h2"} fontSize={"md"}>
                Visibility:
              </Heading>
              <Badge colorScheme={application.secret ? "red" : "green"}>
                {application.secret ? "SECRET" : "PUBLIC"}
              </Badge>
              <Tooltip label={secretHelpText} fontSize="md" hasArrow>
                <QuestionIcon color="gray" />
              </Tooltip>
            </Flex>
            <Flex>
              <Heading as={"h2"} fontSize={"md"} mr={"5px"}>
                Creator:
              </Heading>
              <User id={application.creator} />
            </Flex>
            <Flex>
              <Heading as={"h2"} fontSize={"md"} mr={"5px"}>
                Owners:
              </Heading>
              <VStack>
                {owners.map((owner) => (
                  <User key={owner.id} id={owner.id} />
                ))}
              </VStack>
            </Flex>
            <Flex>
              <Heading as={"h2"} fontSize={"md"} mr={"5px"}>
                Owning Groups:
              </Heading>
              <VStack>
                {ownerGroups.map((group) => (
                  <Group key={group.id} id={group.id} />
                ))}
              </VStack>
            </Flex>
            <VStack alignItems={"left"}>
              <Heading as={"h2"} fontSize={"md"} mr={"5px"}>
                Description:
              </Heading>
              <Text maxWidth={"300px"}>{application.description}</Text>
            </VStack>
          </VStack>
        </CardBody>
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
            <Flex gap="5px" alignItems="center">
              <Heading as={"h2"} fontSize={"md"}>
                Environments
              </Heading>
              <Tooltip label={environmentsHelpText} fontSize="md" hasArrow>
                <QuestionIcon color="gray" />
              </Tooltip>
            </Flex>
          </CardHeader>
          <CardBody>
            <EnvironmentList environments={environments} />
          </CardBody>
        </Card>
        {environments.length > 0 ? (
          <EnvironmentRoleList id={environments[0].id} />
        ) : null}
        {environments.length > 0 ? (
          <EnvironmentScopeList id={environments[0].id} />
        ) : null}
        {environments.length > 0 ? (
          <TokenGroupList id={environments[0].id} />
        ) : null}
      </Flex>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Update Application</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex justifyContent="space-between" pl="15px" pr="15px">
              <Stack spacing={3}>
                <Heading as={"h4"} fontSize={"md"}>
                  Environments
                </Heading>
                {checkboxElements}
              </Stack>
              <Stack spacing={3}>
                <Heading as={"h4"} fontSize={"md"}>
                  Metadata
                </Heading>
                <Checkbox
                  key={"secret"}
                  isChecked={isSecret}
                  onChange={(e) => {
                    setIsSecret(e.target.checked);
                  }}
                >
                  Secret
                </Checkbox>
              </Stack>
            </Flex>
            <Stack spacing={3} alignItems={"center"}>
              <Heading as={"h4"} fontSize={"md"}>
                Description
              </Heading>
              <Textarea
                key={"description"}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                }}
              />
            </Stack>
            <Stack mt={"5px"} alignItems={"center"}>
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
          </ModalBody>

          <ModalFooter>
            <Button colorScheme="green" mr={3} onClick={updateApplication}>
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

export default ApplicationDetails;
