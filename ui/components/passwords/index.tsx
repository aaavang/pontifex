import { CopyIcon, DeleteIcon } from "@chakra-ui/icons";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Icon,
  IconButton,
  Table,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";
import axios from "axios";
import moment from "moment";
import { MdCode } from "react-icons/md";
import { mutate } from "swr";
import { confirm } from "../../utils/confirm/Confirm";
import { PontifexEnvironment, PontifexPassword } from "../../models/axios";

interface PasswordListProps {
  passwords: PontifexPassword[];
  environment: PontifexEnvironment;
}

const generateCurlCommand = (
  clientId: string,
  clientSecret: string
): string => {
  return `curl --location --request POST 'https://login.microsoftonline.com/00e1df3d-9626-410c-898c-16aaa8c2afc9/oauth2/v2.0/token' \\
--header 'Content-Type: application/x-www-form-urlencoded' \\
--data-urlencode 'client_id=${clientId}' \\
--data-urlencode 'client_secret=${clientSecret}' \\
--data-urlencode 'grant_type=client_credentials' \\
--data-urlencode 'scope=RESOURCE_CLIENT_ID/.default'`;
};

export const PasswordList = (props: PasswordListProps) => {
  const toast = useToast();

  const { passwords, environment } = props;

  const passwordElements = passwords?.map((p) => {
    const deletePassword = async () => {
      toast({
        title: "Deleting Client Credential",
        description: `Deleting client credential, ${p.id}`,
        status: "info",
        duration: 3000,
        isClosable: true,
      });
      await axios.post(`/api/environments/${environment.id}/removePassword`, {
        id: p.id,
      });
      toast({
        title: "Client Credential Deleted",
        description: `Deleted client credential, ${p.id}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      await mutate(`/api/environments/${environment.id}`);
    };

    const copyCurl = async () => {
      const curlCommand = generateCurlCommand(environment.clientId, p.password);
      await navigator.clipboard.writeText(curlCommand);
      toast({
        title: "Curl Command Copied",
        description: `Copied example Curl command to clipboard`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    };

    const copyPassword = async () => {
      await navigator.clipboard.writeText(p.password);
      toast({
        title: "Client Secret Copied",
        description: `Copied client secret to clipboard`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    };

    const daysTill = (date: string): number => {
      const now = moment();
      const targetDate = moment(date);

      return targetDate.diff(now, "days");
    };

    return (
      <AccordionItem key={p.id}>
        <h2>
          <AccordionButton>
            <Box as="span" flex="1" textAlign="left">
              {p.displayName}
            </Box>
            <AccordionIcon />
          </AccordionButton>
        </h2>
        <AccordionPanel pb={4}>
          <TableContainer>
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>Secret</Th>
                  <Th>Create Date</Th>
                  <Th>Expiration Date</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                <Tr key={p.id}>
                  <Td>
                    {p.password}{" "}
                    <IconButton
                      aria-label="Copy Password"
                      icon={<CopyIcon />}
                      variant={"outline"}
                      size={"sm"}
                      onClick={copyPassword}
                    />
                  </Td>
                  <Td>{p.start}</Td>
                  <Td>{`${p.end} ~ ${daysTill(p.end)} days`}</Td>
                  <Td>
                    <IconButton
                      aria-label="Copy Example Curl Command"
                      icon={<Icon as={MdCode} />}
                      variant={"outline"}
                      size={"sm"}
                      onClick={copyCurl}
                    />{" "}
                    <IconButton
                      aria-label="Delete Password"
                      icon={<DeleteIcon />}
                      colorScheme="red"
                      size={"sm"}
                      variant="outline"
                      onClick={confirm(
                        "Are you sure you want to delete this credential?",
                        deletePassword
                      )}
                    />
                  </Td>
                </Tr>
              </Tbody>
            </Table>
          </TableContainer>
        </AccordionPanel>
      </AccordionItem>
    );
  });

  if (passwordElements.length === 0) {
    passwordElements.push(
      <TableContainer key={"no-passwords"}>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>ID</Th>
              <Th>Secret</Th>
              <Th>Start Date</Th>
              <Th>End Date</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr key={"no-passwords"}>
              <Td>No Client Credentials</Td>
              <Td />
              <Td />
              <Td />
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    );
  }

  return <Accordion allowMultiple>{passwordElements}</Accordion>;
};
