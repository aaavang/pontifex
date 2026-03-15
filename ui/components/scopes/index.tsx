import {
    ExternalLinkIcon
} from "@chakra-ui/icons";
import {
    Link,
    Table,
    TableContainer,
    Tbody,
    Td,
    Th,
    Thead,
    Tr
} from "@chakra-ui/react";

export const ScopesList = ({ scopes, isOwner }) => {
    const scopeItems = scopes.map((scope) => (
        <Tr key={scope.id}>
            <Td>{scope.name}</Td>
            <Td>{scope.displayName}</Td>
            <Td>{scope.description}</Td>
            <Td>
                {isOwner ? (
                    <Link href={`/scopes/${scope.id}`}>
                        <ExternalLinkIcon />
                    </Link>
                ) : null}
            </Td>
        </Tr>
    ));

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
        <TableContainer>
            <Table variant="simple">
                <Thead>
                    <Tr>
                        <Th>Scope Name</Th>
                        <Th>Display Name</Th>
                        <Th>Description</Th>
                        <Th>Actions</Th>
                    </Tr>
                </Thead>
                <Tbody>{scopeItems}</Tbody>
            </Table>
        </TableContainer>
    );
};
