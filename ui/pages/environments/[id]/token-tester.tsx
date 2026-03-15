import {
  Box,
  Card,
  CardBody,
  CardHeader,
  Flex,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  Link,
  Select,
  Text,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { docco } from "react-syntax-highlighter/dist/cjs/styles/hljs";
import useSwr from "swr";

import { readEnrichedEnvironment, readToken } from "../../../resources";

const EnvironmentTest = () => {
  const router = useRouter();
  const [id, setId] = useState("");
  useEffect(() => {
    if (router.isReady) {
      setId(router.query.id as string);
    }
  }, [router.isReady, router.query.id]);

  return <>{id ? <EnvironmentTestPage id={id} /> : null}</>;
};

const EnvironmentTestPage = ({ id }) => {
  const { data, error, isLoading } = useSwr(
    `/api/environments/${id}-enriched`,
    readEnrichedEnvironment(id)
  );

  const [state, setState] = useState({
    clientCredential: null,
    targetEnvironment: null,
  });

  if (isLoading) {
    return <Text>Loading environment...</Text>;
  }

  if (data.passwords.length == 0) {
    return (
      <Text>
        You must create a client credential before you can test your environment
      </Text>
    );
  }

  const clientCredentialOptions = (data.passwords ?? []).map((pw) => (
    <option value={pw.password} key={pw.displayName}>
      {pw.displayName}
    </option>
  ));

  const environmentOptions = (data.connectedEnvironments ?? []).map((env) => (
    <option value={env.clientId} key={env.id}>
      {env.name}
    </option>
  ));

  return (
    <Box>
      <Link href={`/environments/${id}`} color={"blue"}>
        Back to {data.environment.name}
      </Link>
      <Card variant={"outline"} mb={"15px"} mt={"15px"}>
        <CardHeader>
          <Heading as={"h2"} fontSize={"md"} mr="5px">
            Token Tester
          </Heading>
        </CardHeader>
        <CardBody>
          <Text>
            You can use this utility to acquire tokens to various environments{" "}
            {data.environment.name} is connected to. This can be useful when
            triaging access issues and ensuring the expected roles are
            incorporated in the tokens returned from a specific resource
            environment.
          </Text>
        </CardBody>
        <CardBody>
          <FormControl>
            <FormLabel>Client Credential</FormLabel>
            <Select
              placeholder={"Select Credential"}
              onChange={(e) =>
                setState({ ...state, clientCredential: e.target.value })
              }
            >
              {clientCredentialOptions}
            </Select>
            <FormHelperText>
              Which credential to use to obtain tokens.
            </FormHelperText>
            <FormLabel mt={"15px"}>Target Environment</FormLabel>
            <Select
              placeholder={"Select Target Environment"}
              onChange={(e) =>
                setState({ ...state, targetEnvironment: e.target.value })
              }
            >
              {environmentOptions}
            </Select>
            <FormHelperText>
              Which environment to get a token for.
            </FormHelperText>
          </FormControl>
        </CardBody>
      </Card>

      {state.targetEnvironment && state.clientCredential ? (
        <>
          <ExampleToken
            clientSecret={state.clientCredential}
            clientId={data.environment.clientId}
            resourceId={state.targetEnvironment}
          />
        </>
      ) : null}
    </Box>
  );
};

const ExampleToken = ({ clientSecret, clientId, resourceId }) => {
  const { data, error, isLoading } = useSwr(
    `/api/token/${clientId}/${resourceId}`,
    readToken(clientId, clientSecret, resourceId)
  );

  const [header, body, signature] = isLoading ? [] : data.token.split(".");

  return isLoading ? (
    <Text>Acquiring token...</Text>
  ) : (
    <Flex gap={"15px"}>
      <Card width={"50%"} variant={"outline"}>
        <CardBody>
          <Text>Raw JWT Token</Text>
          <SyntaxHighlighter
            language={"json"}
            style={docco}
            wrapLongLines={true}
          >
            {data.token}
          </SyntaxHighlighter>
        </CardBody>
      </Card>
      <Card width={"50%"} variant={"outline"}>
        <CardBody>
          <Text>Header</Text>
          <SyntaxHighlighter
            language={"json"}
            style={docco}
            wrapLongLines={true}
          >
            {JSON.stringify(
              JSON.parse(Buffer.from(header, "base64").toString()),
              null,
              4
            )}
          </SyntaxHighlighter>
        </CardBody>
        <CardBody>
          <Text>Body</Text>
          <SyntaxHighlighter
            language={"json"}
            style={docco}
            wrapLongLines={true}
          >
            {JSON.stringify(
              JSON.parse(Buffer.from(body, "base64").toString()),
              null,
              4
            )}
          </SyntaxHighlighter>
        </CardBody>
        <CardBody>
          <Text>Signature</Text>
          <SyntaxHighlighter
            language={"text"}
            style={docco}
            wrapLongLines={true}
          >
            {signature}
          </SyntaxHighlighter>
        </CardBody>
      </Card>
    </Flex>
  );
};

export default EnvironmentTest;
