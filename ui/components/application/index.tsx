import {
  Link,
  Skeleton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
} from "@chakra-ui/react";
import useSwr from "swr";
import { readCurrentUserBundle } from "../../resources";

export const ApplicationListResource = ({ applications }) => {
  const applicationItems = applications.map((app) => (
    <Tr key={app.id}>
      <Td>
        <Link href={`/applications/${app.id}`} color={"blue"}>
          {app.name}
        </Link>
      </Td>
      <Td>
        <Text whiteSpace={"normal"} wordBreak={"break-word"}>
          {app.description}
        </Text>
      </Td>
    </Tr>
  ));

  return (
    <>
      <TableContainer w={"100%"}>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Application</Th>
              <Th>Description</Th>
            </Tr>
          </Thead>
          <Tbody>{applicationItems}</Tbody>
        </Table>
      </TableContainer>
    </>
  );
};

export const OwnedApplicationList = () => {
  const { data, error, isLoading } = useSwr("/api/users/me", readCurrentUserBundle);

  if (isLoading) {
    return (
      <>
        <Skeleton height="20px" width={"500px"} />
        <Skeleton height="20px" width={"500px"} />
        <Skeleton height="20px" width={"500px"} />
      </>
    );
  }

  return (
    <ApplicationListResource applications={data.ownedApplications ?? []} />
  );
};
