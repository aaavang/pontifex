import { Heading, Link, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useSwr from "swr";
import { PermissionRequestList } from "../../../components/permission-request";
import { PontifexGetRoleResponse } from "../../../models/axios";
import { readRole } from "../../../resources";

const RoleDetailsPage = () => {
  const router = useRouter();
  const [id, setId] = useState("");
  useEffect(() => {
    if (router.isReady) {
      setId(router.query.id as string);
    }
  }, [router.isReady, router.query.id]);

  return <>{id ? <RoleDetails id={id} /> : null}</>;
};

const RoleDetails = ({ id }) => {
  const { data, error, isLoading } = useSwr(
      `/api/roles/${id}`,
      readRole(id)
  );

  if (error) {
    return <>Not authorized to see this resource</>;
  }

  if (isLoading) {
    return <Text>Loading Role...</Text>;
  }

  const { role, environment, requests }: PontifexGetRoleResponse =
    data;

  return (
    <>
      <Heading as={"h1"} fontSize={"lg"}>
        Name: {role.name}
      </Heading>
      <Heading as={"h2"} fontSize={"md"}>
        Id: {role.id}
      </Heading>
      <Heading as={"h2"} fontSize={"md"}>
        Environment:{" "}
        <Link color="blue" href={`/environments/${environment.id}`}>
          {environment.name}
        </Link>
      </Heading>
      <Heading as={"h2"} fontSize={"md"}>
        Description:{" "}
      </Heading>
      <Text whiteSpace={"normal"} wordBreak={"break-word"}>
        {role.description}
      </Text>
      <Heading as={"h2"} fontSize={"md"}>
        Permission Requests:
      </Heading>
      <PermissionRequestList permissionRequests={requests} />
    </>
  );
};

export default RoleDetailsPage;
