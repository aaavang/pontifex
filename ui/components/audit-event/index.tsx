import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
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
import { readApplicationAuditEvents } from "../../resources";
import { User } from "../user";

export const AuditEventListResource = ({ id }) => {
  const { data, error, isLoading } = useSwr(
    `/api/applications/${id}/audit`,
    readApplicationAuditEvents(id)
  );

  if (isLoading) {
    return <Text>Loading audit events...</Text>;
  }

  const eventItems = data.events
    .sort(function (a, b) {
      return a.createDate < b.createDate
        ? -1
        : a.createDate > b.createDate
        ? 1
        : 0;
    })
    .map((event) => (
      <Tr key={event.id}>
        <Td>{event.createDate}</Td>
        <Td>{event.id}</Td>
        <Td>{event.action}</Td>
        <Td>
          <User id={event.associatedUserId} />
        </Td>
      </Tr>
    ));

  return (
    <>
      <Accordion allowToggle border={"1px"} rounded={"lg"}>
        <AccordionItem>
          <h2>
            <AccordionButton>
              <Box flex="1" textAlign="left">
                Click for Events
              </Box>
              <AccordionIcon />
            </AccordionButton>
          </h2>
          <AccordionPanel>
            <TableContainer>
              <Table variant="simple">
                <Thead>
                  <Tr>
                    <Th>Timestamp</Th>
                    <Th>Event ID</Th>
                    <Th>Action</Th>
                    <Th>Associated User ID</Th>
                  </Tr>
                </Thead>
                <Tbody>{eventItems}</Tbody>
              </Table>
            </TableContainer>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </>
  );
};

export const AuditEventList = ({ id }) => {
  return <AuditEventListResource id={id} />;
};
