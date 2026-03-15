import {
  CheckCircleIcon,
  ExternalLinkIcon,
  WarningTwoIcon,
} from "@chakra-ui/icons";
import {
  Link,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from "@chakra-ui/react";
import { nonSensitiveHelpText, sensitiveHelpText } from "../../strings";

export const RolesList = ({ roles, isOwner }) => {
  const environmentItems = roles.map((role) => (
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
        <Text whiteSpace={"normal"} wordBreak={"break-word"} maxWidth={"500px"}>
          {role.description}
        </Text>
      </Td>
      <Td>
        {isOwner ? (
          <Link href={`/roles/${role.id}`}>
            <ExternalLinkIcon />
          </Link>
        ) : null}
      </Td>
    </Tr>
  ));

  if (environmentItems.length === 0) {
    environmentItems.push(
      <Tr key={"no-roles"}>
        <Td>No Roles</Td>
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
            <Th>Role Name</Th>
            <Th>Sensitive</Th>
            <Th>Description</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>{environmentItems}</Tbody>
      </Table>
    </TableContainer>
  );
};
