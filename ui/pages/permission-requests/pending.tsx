import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Heading,
  HStack,
  Link,
  Table,
  Tbody,
  Th,
  Thead,
  Tr,
  useToast,
  VStack,
  Text,
} from "@chakra-ui/react";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import React, { useState } from "react";
import useSWR, { mutate } from "swr";
import {
  PendingPermissionRequestGroup,
  PermissionRequestApproval,
} from "../../components/permission-request";
import { PontifexUserBundle } from "../../models/axios";
import { readCurrentUserBundle } from "../../resources";
import { confirm } from "../../utils/confirm/Confirm";
const PendingPermissionRequestList = () => {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [state, setState] = useState({});
  const { data, isLoading, error } = useSWR<PontifexUserBundle>(
    "/api/user",
    readCurrentUserBundle
  );
  const envIdToFilterTo = searchParams.get("envId");

  if (isLoading) {
    return <></>;
  }

  if (Object.keys(data.groupedPendingPermissionRequests).length === 0) {
    return (
      <>
        <Link href={"/dashboard"} color={"blue"}>
          Back to dashboard
        </Link>
        <Text pt={"5px"}>No pending permission requests</Text>
      </>
    );
  }

  const setActionForAll = (action: "APPROVE" | "REJECT") => {
    const newState = {};
    for (const key in data.groupedPendingPermissionRequests) {
      for (const pr of data.groupedPendingPermissionRequests[key]) {
        newState[pr.id] = action;
      }
    }
    setState(newState);
  };

  const saveChanges = async () => {
    toast({
      title: "Updating Permission Request Statuses",
      description: `Updating statuses for ${
        Object.keys(state).length
      } permission requests`,
      status: "info",
      duration: 3000,
      isClosable: true,
    });
    const newState = { ...state };
    let successCount = 0;
    let failCount = 0;
    for (const key in newState) {
      const approved = newState[key] === "APPROVE";
      const res = await axios.patch(
        `/api/permission-requests/${key}`,
        {
          status: approved ? "APPROVED" : "REJECTED",
        },
        {
          validateStatus: () => true,
        }
      );
      if (res.status === 200) {
        successCount++;
        await mutate(`/api/permission-requets/${key}`);
        delete newState[key];
      } else {
        failCount++;
      }
    }
    if (failCount === 0) {
      toast({
        title: "Permission Request Statuses Updated",
        description: `${successCount} statuses updated`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } else {
      toast({
        title: "Some Permission Request Status Updates Failed",
        description: `${successCount} statuses were updated successfully, ${failCount} failed`,
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
    }
    await mutate(`/api/user`);
    setState(newState);
  };

  const elements = Object.keys(data.groupedPendingPermissionRequests)
    .filter((key) => {
      if (envIdToFilterTo) {
        return key === envIdToFilterTo;
      }
      return true;
    })
    .map((key) => (
      <PendingPermissionRequestGroup
        key={`${key}-group`}
        id={key}
        prs={data.groupedPendingPermissionRequests[key]}
        state={state}
        setState={setState}
      />
    ));

  return (
    <VStack>
      <Heading>Pending Permission Requests</Heading>
      <HStack>
        <Button
          colorScheme={"green"}
          onClick={() => setActionForAll("APPROVE")}
        >
          Approve All
        </Button>
        <Button colorScheme={"red"} onClick={() => setActionForAll("REJECT")}>
          Reject All
        </Button>
      </HStack>
      <Accordion
        allowMultiple
        allowToggle
        defaultIndex={[
          ...Array(
            Object.keys(data.groupedPendingPermissionRequests).length
          ).keys(),
        ]}
      >
        {elements}
      </Accordion>
      <Button
        colorScheme={"green"}
        onClick={confirm(
          "Are you sure you want to save these changes?",
          saveChanges
        )}
      >
        Save
      </Button>
    </VStack>
  );
};

export default PendingPermissionRequestList;
