import {
    EditIcon,
    ExternalLinkIcon
} from "@chakra-ui/icons";
import {
    AccordionButton,
    AccordionIcon,
    AccordionItem,
    AccordionPanel,
    Badge,
    Box,
    Button,
    Flex,
    HStack,
    Heading,
    IconButton,
    Link,
    Radio,
    RadioGroup,
    Skeleton,
    Stack,
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
import useSwr from "swr";
import {
    PontifexGetEnvironmentResponse,
    PontifexGetPermissionRequestResponse,
} from "../../models/axios";
import {
    readCurrentUserBundle,
    readEnvironment,
    readEnvironmentPermissionRequests,
    readPermissionRequest
} from "../../resources";

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

export const PermissionRequestByEnvIdList = ({environmentId, direction}) => {
    const toast = useToast();

    const {data, error, isLoading} = useSwr(
        `api/${environmentId}}`,
        readEnvironment(environmentId)
    );

    const permissionRequests = direction === "outbound" ? data?.outboundPermissionRequests : data?.inboundPermissionRequests;

    console.log('permissionRequests', permissionRequests);

    const permissionRequestsElements = isLoading || error ?
        [(
             <Tr key={`loading-${direction}-prs`}>
                 <Td>
                     <Skeleton height="20px"/>
                 </Td>
                 <Td>
                     <Skeleton height="20px"/>
                 </Td>
                 <Td>
                     <Skeleton height="20px"/>
                 </Td>
                 <Td>
                     <Skeleton height="20px"/>
                 </Td>
                 <Td>
                     <Skeleton height="20px"/>
                 </Td>
             </Tr>
         )] : permissionRequests?.map((pr) => (
            <NoFetchPermissionRequest key={`${environmentId}-pr-group-${direction}`} permissionRequest={pr}/>
        ));

    if (permissionRequestsElements.length === 0) {
        permissionRequestsElements.push(
            <Tr key={"no-prs"}>
                <Td>No Permission Requests</Td>
                <Td/>
                <Td/>
                <Td/>
                <Td/>
            </Tr>
        );
    }

    if (error) {
        toast({
                  title: "Error loading permission requests",
                  description: error.message,
                  status: "error",
                  duration: 10000,
                  isClosable: true,
              });
    }

    return (
        <>
            <TableContainer width={"100%"} key={"prs"}>
                <Table variant="simple">
                    <Thead>
                        <Tr>
                            <Th>Source Environment</Th>
                            <Th>Target Environment</Th>
                            <Th>Target Permission Name</Th>
                            <Th>Status</Th>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>{permissionRequestsElements}</Tbody>
                </Table>
            </TableContainer>
        </>
    );
}

export const PermissionRequestList = ({permissionRequests}) => {
    const permissionRequestsElements = permissionRequests?.map((pr) => (
        <PermissionRequest key={pr.id} id={pr.id}/>
    ));

    if (permissionRequestsElements.length === 0) {
        permissionRequestsElements.push(
            <Tr key={"no-prs"}>
                <Td>No Permission Requests</Td>
                <Td/>
                <Td/>
                <Td/>
                <Td/>
            </Tr>
        );
    }

    return (
        <>
            <TableContainer width={"100%"} key={"prs"}>
                <Table variant="simple">
                    <Thead>
                        <Tr>
                            <Th>Source Environment</Th>
                            <Th>Target Environment</Th>
                            <Th>Target Permission Name</Th>
                            <Th>Status</Th>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>{permissionRequestsElements}</Tbody>
                </Table>
            </TableContainer>
        </>
    );
};

export const GroupedPermissionRequestList = ({groupedPermissionRequests}) => {
    const permissionRequestsElements = Object.keys(groupedPermissionRequests).map(
        (envId) => (
            <PermissionRequestGroup
                key={`${envId}-pr-group`}
                id={envId}
                prs={groupedPermissionRequests[envId]}
            />
        )
    );

    if (permissionRequestsElements.length === 0) {
        permissionRequestsElements.push(
            <Tr key={"no-prs"}>
                <Td>No Permission Requests</Td>
                <Td/>
            </Tr>
        );
    }

    return (
        <Flex width={"100%"}>
            <TableContainer width={"100%"} key={"prs"}>
                <Table variant="simple">
                    <Thead>
                        <Tr>
                            <Th>Target Environment</Th>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>{permissionRequestsElements}</Tbody>
                </Table>
            </TableContainer>
        </Flex>
    );
};

export const PermissionRequestGroup = ({id, prs}) => {
    const {data, error, isLoading} = useSwr(
        `api/environment/${id}`,
        readEnvironment(id)
    );

    const prData = useSwr(
        `api/permission-request/${prs[0].id}`,
        readPermissionRequest(prs[0].id)
    );

    if (isLoading || prData.isLoading) {
        return (
            <Tr>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
            </Tr>
        );
    }

    const {environment, application}: PontifexGetEnvironmentResponse = data;

    return (
        <Tr key={environment.id}>
            <Td>
                <Flex justifyContent={"space-between"} gap={"5px"}>
                    <Link
                        href={`/permission-requests/pending?envId=${environment.id}`}
                        color={"blue"}
                        aria-label={`Manage pending permission requests for ${environment.name}`}
                    >
                        {application.name} ({environment.level.toUpperCase()})
                    </Link>
                    <Badge colorScheme={"yellow"}>
                        {prs.length} Pending PR{prs.length > 1 ? "s" : ""}
                    </Badge>
                </Flex>
            </Td>
            <Td>
                <Link href={`/permission-requests/pending?envId=${environment.id}`}>
                    <IconButton
                        aria-label={`Manage pending permission requests for ${environment.name}`}
                        colorScheme={"blue"}
                        icon={<EditIcon/>}
                    />
                </Link>
            </Td>
        </Tr>
    );
};


export const NoFetchPermissionRequest = ({
                                             permissionRequest
                                         }) => {
    return (
        <Tr key={permissionRequest.id}>
            <Td>
                <Link href={`/environments/${permissionRequest.sourceEnvironmentId}`} color={"blue"}>{`${permissionRequest.sourceEnvironmentName}`}</Link>
            </Td>
            <Td>
                <Link href={`/environments/${permissionRequest.targetEnvironmentId}`} color={"blue"}>{`${permissionRequest.targetEnvironmentName}`}</Link>
            </Td>
            <Td>
                <TargetPermissionLink
                    targetPermissionType={permissionRequest.permissionType}
                    targetPermissionId={permissionRequest.targetPermissionId}
                    targetPermissionName={permissionRequest.targetPermissionName}
                />
            </Td>
            <Td>
                <Badge colorScheme={getBadgeColor(permissionRequest.status)}>
                    {permissionRequest.status}
                </Badge>
            </Td>
            <Td>
                <a
                    key={permissionRequest.id}
                    href={`/permission-requests/${permissionRequest.id}`}
                >
                    <ExternalLinkIcon/>
                </a>
            </Td>
        </Tr>
    );
};

export const PermissionRequest = ({id}) => {
    const {data, error, isLoading} = useSwr(
        `api/permission-requests/${id}`,
        readPermissionRequest(id)
    );

    if (isLoading) {
        return (
            <Tr>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
            </Tr>
        );
    }

    const {
        sourceEnvironment,
        targetEnvironment,
        targetRole,
        targetScope,
        permissionRequest,
    }: PontifexGetPermissionRequestResponse = data;

    return (
        <Tr key={permissionRequest.id}>
            <Td>
                <Link href={`/environments/${sourceEnvironment.id}`} color={"blue"}>{`${sourceEnvironment.name
                } (${sourceEnvironment.level.toUpperCase()})`}</Link>
            </Td>
            <Td>
                <Link href={`/environments/${targetEnvironment.id}`} color={"blue"}>{`${targetEnvironment.name
                } (${targetEnvironment.level.toUpperCase()})`}</Link>
            </Td>
            <Td>
                <TargetPermissionLink
                    targetPermissionType={permissionRequest.permissionType}
                    targetPermissionId={permissionRequest.targetPermissionId}
                    targetPermissionName={permissionRequest.targetPermissionName}
                />
            </Td>
            <Td>
                <Badge colorScheme={getBadgeColor(permissionRequest.status)}>
                    {permissionRequest.status}
                </Badge>
            </Td>
            <Td>
                <a
                    key={permissionRequest.id}
                    href={`/permission-requests/${permissionRequest.id}`}
                >
                    <ExternalLinkIcon/>
                </a>
            </Td>
        </Tr>
    );
};

export const PermissionRequestApproval = ({id, onRadioChange, state}) => {
    const {data, error, isLoading} = useSwr(
        `api/permission-requests/${id}`,
        readPermissionRequest(id)
    );

    if (isLoading) {
        return (
            <Tr key={id}>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
                <Td>
                    <Skeleton height="20px"/>
                </Td>
            </Tr>
        );
    }

    const {
        sourceEnvironment,
        targetEnvironment,
        targetRole,
        targetScope,
        permissionRequest,
    }: PontifexGetPermissionRequestResponse = data;

    return (
        <Tr key={permissionRequest.id}>
            <Td>
                <Link href={`/environments/${sourceEnvironment.id}`} color={"blue"}>{`${sourceEnvironment.name
                } (${sourceEnvironment.level.toUpperCase()})`}</Link>
            </Td>
            <Td>
                <Link href={`/environments/${targetEnvironment.id}`} color={"blue"}>{`${targetEnvironment.name
                } (${targetEnvironment.level.toUpperCase()})`}</Link>
            </Td>
            <Td>
                <TargetPermissionLink
                    targetPermissionType={permissionRequest.permissionType}
                    targetPermissionId={permissionRequest.targetPermissionId}
                    targetPermissionName={permissionRequest.targetPermissionName}
                />
            </Td>
            <Td>
                <Badge colorScheme={getBadgeColor(permissionRequest.status)}>
                    {permissionRequest.status}
                </Badge>
            </Td>
            <Td>
                <RadioGroup onChange={onRadioChange} value={state[id]}>
                    <Stack direction="row">
                        <Radio value="APPROVE">Approve</Radio>
                        <Radio value="REJECT">Reject</Radio>
                    </Stack>
                </RadioGroup>
            </Td>
        </Tr>
    );
};

export const TargetPermissionLink = ({targetPermissionType, targetPermissionId, targetPermissionName}) => {
    if (targetPermissionType === "Role") {
        return (
            <Link href={`/roles/${targetPermissionId}`} color={"blue"}>
                {targetPermissionName}
            </Link>
        );
    }

    return (
        <Link href={`/scopes/${targetPermissionId}`} color={"blue"}>
            {targetPermissionName}
        </Link>
    );
}

export const PendingPermissionRequestList = () => {
    const {data, error, isLoading} = useSwr("/api/users/me", readCurrentUserBundle);

    if (isLoading) {
        return (
            <>
                <Skeleton height="20px" width={"500px"}/>
                <Skeleton height="20px" width={"500px"}/>
                <Skeleton height="20px" width={"500px"}/>
            </>
        );
    }

    const {groupedPendingPermissionRequests} = data;

    return (
        <VStack m="5" rounded="lg" borderWidth="1px" boxShadow="xl" padding={5}>
            <Heading width="100%" as={"h3"} fontSize={"lg"}>
                <HStack justifyContent={"space-between"}>
                    <Text>Pending Permission Requests</Text>
                    <Link href={"/permission-requests/pending"} aria-label='Manage pending permission requests'>
                        {Object.keys(groupedPendingPermissionRequests).length > 0 ? (
                            <Button
                                aria-label={"manage pending permission requests"}
                                colorScheme={"blue"}
                            >
                                Manage All
                            </Button>
                        ) : null}
                    </Link>
                </HStack>
            </Heading>
            <GroupedPermissionRequestList
                groupedPermissionRequests={groupedPendingPermissionRequests}
            />
        </VStack>
    );
};

export const OwnedPendingPermissionRequestList = () => {
    return <PendingPermissionRequestList/>;
};

export const PendingPermissionRequestGroup = ({id, prs, state, setState}) => {
    const {data, error, isLoading} = useSwr(
        `api/environment/${id}`,
        readEnvironment(id)
    );

    if (isLoading) {
        return <p>Loading...</p>;
    }

    const prElements = prs.map((pr) => {
        const onChange = (newValue: string) => {
            const newState = {...state};
            newState[pr.id] = newValue;
            setState(newState);
        };
        return (
            <PermissionRequestApproval
                key={pr.id}
                id={pr.id}
                onRadioChange={onChange}
                state={state}
            />
        );
    });

    return (
        <div key={`${id}-container`}>
            <AccordionItem mb={"5px"}>
                <h2>
                    <AccordionButton>
                        <Box as="span" flex="1" textAlign="left">
                            {data.application.name} ({data.environment.level.toUpperCase()})
                        </Box>
                        <AccordionIcon/>
                    </AccordionButton>
                </h2>
                <AccordionPanel>
                    <TableContainer width={"100%"} key={`${id}-prs`}>
                        <Table>
                            <Thead>
                                <Tr>
                                    <Th>Source Environment</Th>
                                    <Th>Target Environment</Th>
                                    <Th>Target Permission Name</Th>
                                    <Th>Status</Th>
                                    <Th>Actions</Th>
                                </Tr>
                            </Thead>
                            <Tbody>{prElements}</Tbody>
                        </Table>
                    </TableContainer>
                </AccordionPanel>
            </AccordionItem>
        </div>
    );
};
