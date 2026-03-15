import {
  Link,
  Skeleton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import useSwr from "swr";
import { readCurrentUserBundle, readGroup } from "../../resources";

export const GroupList = ({ groups }) => {

  const groupItems = groups.map((group) => (
    <Tr key={group.id}>
      <Td>
        <Link href={`/groups/${group.id}`} color={"blue"}>
          {group.name}
        </Link>
      </Td>
    </Tr>
  ));

  if (groupItems.length === 0) {
    groupItems.push(
      <Tr key={"no-groups"}>
        <Td>No Groups</Td>
      </Tr>
    );
  }

  return (
    <TableContainer width={"100%"}>
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Name</Th>
          </Tr>
        </Thead>
        <Tbody>{groupItems}</Tbody>
      </Table>
    </TableContainer>
  );
};

export const OwnedGroupList = () => {
  const { data, error, isLoading } = useSwr(`/api/user`, readCurrentUserBundle);

  if (isLoading) {
    return (
      <>
        <Skeleton height="20px" width={"500px"} />
        <Skeleton height="20px" width={"500px"} />
        <Skeleton height="20px" width={"500px"} />
      </>
    );
  }

  return <GroupList groups={data.ownerGroups ?? []} />;
};

export const MemberGroupList = () => {
  const { data, error, isLoading } = useSwr(`/api/user`, readCurrentUserBundle);

  if (isLoading) {
    return (
      <>
        <Skeleton height="20px" width={"500px"} />
        <Skeleton height="20px" width={"500px"} />
        <Skeleton height="20px" width={"500px"} />
      </>
    );
  }

  return <GroupList groups={data.memberGroups ?? []} />;
};

export const Group = ({ id }) => {
  const { data, error, isLoading } = useSwr(`/api/groups/${id}`, readGroup(id));

  if (isLoading) {
    return <Text>{id}</Text>;
  }

  return (
    <Link href={`/groups/${id}`} color={"blue.500"}>
      {data.group.name}
    </Link>
  );
};
