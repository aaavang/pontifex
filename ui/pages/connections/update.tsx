import { AuthenticatedTemplate } from "@azure/msal-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  Grid,
  Heading,
  Link,
  Skeleton,
  Text,
  useToast,
} from "@chakra-ui/react";
import axios from "axios";
import { useRouter } from "next/router";
import {useCallback, useEffect, useState} from "react";
import { useWizard, Wizard } from "react-use-wizard";
import useSwr from "swr";
import {
  MultiResourceSelector,
  SingleResourceSelector,
} from "../../components/selectors";
import { PontifexApplication } from "../../models/axios.js";
import {
  readApplication,
  readApplicationEnvironments,
  readEnvironment,
  readEnvironmentRolesScopesAndCurrentConnections,
  requestAccess,
} from "../../resources";

interface ConnectionState {
  sourceApplication?: string;
  sourceApplicationName?: string;
  sourceEnvironment?: string;
  sourceEnvironmentName?: string;
  sourceEnvironmentLevel?: string;
  targetApplication?: string;
  targetApplicationName?: string;
  targetEnvironment?: string;
  targetEnvironmentName?: string;
  targetEnvironmentLevel?: string;
}

const UpdateConnections = () => {
  const router = useRouter();
  const [state, updateState] = useState({} as ConnectionState);

  useEffect(() => {
    (async () => {
      if (router.isReady) {
        const newState = { ...router.query };

        if (newState.sourceApplication) {
          const app = await readApplication(
            newState.sourceApplication as string
          )();
          newState.sourceApplicationName = app.application.name;
        }
        if (newState.sourceEnvironment) {
          const env = await readEnvironment(
            newState.sourceEnvironment as string
          )();
          newState.sourceEnvironmentName = env.environment.name;
          newState.sourceEnvironmentLevel = env.environment.level;
        }
        if (newState.targetApplication) {
          const app = await readApplication(
            newState.targetApplication as string
          )();
          newState.targetApplicationName = app.application.name;
        }
        if (newState.targetEnvironment) {
          const env = await readEnvironment(
            newState.targetEnvironment as string
          )();
          newState.targetEnvironmentName = env.environment.name;
          newState.targetEnvironmentLevel = env.environment.level;
        }

        updateState(newState);
      }
    })();
  }, [router.isReady, router.query, router.query.id]);

  const updateForm = useCallback((key, value) => {
    updateState(state => {
      state[key] = value
      return state
    });
  }, [updateState]);

  return (
    <AuthenticatedTemplate>
      <Flex flexDirection={"column"} gap={"5px"} alignItems={"center"}>
        <Card variant={"outline"} w={"600px"}>
          {router.isReady ? (
            <CardBody>
              {state.sourceApplication ? (
                <Text>
                  Source Application:{" "}
                  <Link
                    href={`/applications/${state.sourceApplication}`}
                    color={"blue"}
                  >
                    {state.sourceApplicationName}
                  </Link>
                </Text>
              ) : null}
              {state.sourceEnvironment ? (
                <Text>
                  Source Environment:{" "}
                  <Link
                    href={`/environments/${state.sourceEnvironment}`}
                    color={"blue"}
                  >
                    {state.sourceEnvironmentName}
                  </Link>
                </Text>
              ) : null}
              {state.targetApplication ? (
                <Text>
                  Target Application:{" "}
                  <Link
                    href={`/applications/${state.targetApplication}`}
                    color={"blue"}
                  >
                    {state.targetApplicationName}
                  </Link>
                </Text>
              ) : null}
              {state.targetEnvironment ? (
                <Text>
                  Target Environment:{" "}
                  <Link
                    href={`/environments/${state.targetEnvironment}`}
                    color={"blue"}
                  >
                    {state.targetEnvironmentName}
                  </Link>
                </Text>
              ) : null}
            </CardBody>
          ) : null}
        </Card>
        <Card variant={"outline"} w={"600px"}>
          <CardBody>
            <Wizard footer={<Footer />}>
              {state.sourceApplication ? null : (
                <SelectSourceApplication update={updateForm} />
              )}
              {state.sourceEnvironment ? null : (
                <SelectSourceEnvironment update={updateForm} state={state} />
              )}
              {state.targetApplication ? null : (
                <SelectTargetApplication update={updateForm} state={state} />
              )}
              {state.targetEnvironment ? null : (
                <SelectTargetEnvironment update={updateForm} state={state} />
              )}
              <SelectTargetRolesAndScopes update={updateForm} state={state} />
              <RequestAccess state={state} />
              <RedirectToEnvironment />
            </Wizard>
          </CardBody>
        </Card>
      </Flex>
    </AuthenticatedTemplate>
  );
};

const RequestAccess = ({ state }) => {
  const { handleStep } = useWizard();
  const router = useRouter();

  handleStep(() => {
    router.push(`/environments/${state.sourceEnvironment}`);
  });
  return (
    <div>
      <AccessRequestStatus state={state} />
    </div>
  );
};

const AccessRequestStatus = ({ state }) => {
  const [payload, setPayload] = useState({ loading: true, status: 0 });

  useEffect(() => {
    (async () => {
      const status = await requestAccess(
        state.sourceEnvironment,
        state.targetEnvironment,
        state.targetRoles,
        state.targetScopes
      );
      setPayload({ loading: false, status });
    })();
  }, []);

  if (payload.loading) {
    return (
      <>
        <Heading>Synchronizing Access...</Heading>
        <Skeleton startColor="gray.500" endColor="white.500" height="40px" />
      </>
    );
  }

  return (
    <>
      <Heading>
        Access Synchronization:{" "}
        {payload.status === 204 ? "Successful" : "Failed"}
      </Heading>
      <p>Click the &apos;Next&apos; button to navigate to source environment</p>
    </>
  );
};

const RedirectToEnvironment = () => {
  return (
    <>
      <p>Redirecting to source environment</p>
    </>
  );
};

const SelectSourceApplication = ({ update }) => {
  return (
    <Card variant={"outline"}>
      <CardHeader>
        <Heading>Select Source Application</Heading>
      </CardHeader>
      <CardBody>
        <Text>
          This is the application that you own that needs to access a different
          application&apos;s roles/scopes
        </Text>
        <SingleResourceSelector
          loadOptions={loadApplicationOptions}
          update={update}
          selectPlaceholder="Select Source Application"
          fieldName="sourceApplication"
          nameResolver={(item) => `${item.name} : ${item.id}`}
          stateResolver={(item) => {
            update("sourceApplication", item);
          }}
        />
      </CardBody>
    </Card>
  );
};

const SelectSourceEnvironment = ({ update, state }) => {
  const { data, error, isLoading } = useSwr(
    `/api/applications/${state.sourceApplication}`,
    readApplicationEnvironments(state.sourceApplication)
  );

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  return (
    <Card>
      <CardHeader>
        <Heading>Select Source Environment</Heading>
      </CardHeader>
      <CardBody>
        <Text>
          This is the environment within the application where traffic will
          originate from
        </Text>
        <Text>
          Note: You shouldn&apos;t cross different environment stages. If you
          select a dev environment here, the target environment should also be
          dev
        </Text>
        <SingleResourceSelector
          loadOptions={async () => data}
          items={data}
          update={update}
          selectPlaceholder="Select Source Environment"
          fieldName="sourceEnvironment"
          nameResolver={(item) => item.level.toUpperCase()}
          stateResolver={(item) => {
            const [id, level] = item.split("|");
            update("sourceEnvironment", id);
            update("sourceEnvironmentLevel", level);
            update("targetEnvironmentLevel", level);
          }}
          valueResolver={(item) => `${item.id}|${item.level}`}
        />
      </CardBody>
    </Card>
  );
};

const loadApplicationOptions = async (
  inputValue: string
): Promise<PontifexApplication[]> => {
  const resp = await axios.get("/api/applications/search", {
    params: {
      prefix: inputValue,
    },
  });

  return resp.data.applications ?? [];
};

const SelectTargetApplication = ({ update, state }) => {
  const { goToStep } = useWizard();
  const toast = useToast();

  // TODO: make a new resource that is only applications that contain the source environment level
  return (
    <Card>
      <CardHeader>
        <Heading>Select Target Application</Heading>
      </CardHeader>
      <CardBody>
        <Text>
          This is the application that your source application needs to access
        </Text>
        <SingleResourceSelector
          loadOptions={loadApplicationOptions}
          update={update}
          selectPlaceholder="Select Target Application"
          fieldName="targetApplication"
          nameResolver={(item) => `${item.name} : ${item.id}`}
          stateResolver={async (item) => {
            update("targetApplication", item);

            // lookup the corresponding environment
            const app = await readApplication(item)();
            update("targetApplicationName", app.application.name);
          }}
          filter={(item) => item.id !== state.sourceApplication}
        />
      </CardBody>
    </Card>
  );
};

const SelectTargetEnvironment = ({ update, state }) => {
  const { data, error, isLoading } = useSwr(
    `/api/applications/${state.targetApplication}`,
    readApplicationEnvironments(state.targetApplication)
  );

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  return (
    <Card>
      <CardHeader>
        <Heading>Select Target Environment</Heading>
      </CardHeader>
      <CardBody>
        <Text>
          This is the environment within the target application you want to
          connect to
        </Text>
        <Text>
          Note: You shouldn&apos;t cross different environment stages. If you
          had selected a dev environment previously, this environment should
          also be dev
        </Text>
        <SingleResourceSelector
          loadOptions={async () => data}
          items={data.map((item) => ({
            value: item.id,
            label: item.level.toUpperCase(),
          }))}
          update={update}
          selectPlaceholder="Select Target Environment"
          fieldName="targetEnvironment"
          nameResolver={(item) => item.level.toUpperCase()}
          stateResolver={async (item) => {
            update("targetEnvironment", item);
            const env = await readEnvironment(item)();
            update("targetEnvironmentName", env.environment.name);
          }}
        />
      </CardBody>
    </Card>
  );
};

const SelectTargetRolesAndScopes = ({ update, state }) => {
  const { data, error, isLoading } = useSwr(
      `/api/environments/${state.sourceEnvironment}/${state.targetEnvironment}`,
      readEnvironmentRolesScopesAndCurrentConnections(
      state.sourceEnvironment,
      state.targetEnvironment
    )
  );

  return (
    <Grid rowGap={"20px"}>
      <Card>
        <CardHeader>
          <Heading>Select Target Roles</Heading>
        </CardHeader>
        <CardBody>
          <Text>Select the roles you wish to access</Text>
          {isLoading ? (
            "Loading..."
          ) : (
            <MultiResourceSelector
              loadOptions={async () => data.availableRoles}
              items={data.availableRoles}
              update={update}
              selectPlaceholder="Select Target Roles"
              fieldName="targetRoles"
              nameResolver={(item) => item.name}
              keyResolver={(item) => item.id}
              isCheckedResolver={(item) =>
                data.alreadyRequestedRoles.some(
                  (role) => role.id === item.id
                )
              }
            />
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <Heading>Select Target Scopes</Heading>
        </CardHeader>
        <CardBody>
          <Text>Select the scopes you wish to access</Text>
          {isLoading ? (
            "Loading..."
          ) : (
            <MultiResourceSelector
              loadOptions={async () => data.availableScopes}
              items={data.availableScopes}
              update={update}
              selectPlaceholder="Select Target Scopes"
              fieldName="targetScopes"
              nameResolver={(item) => item.name}
              keyResolver={(item) => item.id}
              isCheckedResolver={(item) =>
                data.alreadyRequestedScopes.some(
                  (scope) => scope.id === item.id
                )
              }
            />
          )}
        </CardBody>
      </Card>
    </Grid >
  );
};

const Footer = () => {
  const {
    nextStep,
    previousStep,
    isLoading,
    activeStep,
    stepCount,
    isLastStep,
    isFirstStep,
  } = useWizard();

  return (
    <>
      <Flex marginTop={5} justify={"space-between"}>
        <Button
          onClick={() => previousStep()}
          disabled={isLoading || isFirstStep}
        >
          Previous
        </Button>
        <Button onClick={() => nextStep()} disabled={isLoading || isLastStep}>
          Next
        </Button>
      </Flex>
    </>
  );
};

export default UpdateConnections;
