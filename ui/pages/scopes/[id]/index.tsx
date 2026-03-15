import { Heading, Link, Text } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import useSwr from "swr";
import { PermissionRequestList } from "../../../components/permission-request";
import { PontifexGetScopeResponse } from "../../../models/axios";
import { readScope } from "../../../resources";

const ScopeDetailsPage = () => {
    const router = useRouter();
    const [id, setId] = useState("");
    useEffect(() => {
        if (router.isReady) {
            setId(router.query.id as string);
        }
    }, [router.isReady, router.query.id]);

    return <>{id ? <ScopeDetails id={id} /> : null}</>;
};

const ScopeDetails = ({ id }) => {
    const { data, error, isLoading } = useSwr(
        `/api/scopes/${id}`,
        readScope(id)
    );

    if (error) {
        return <>Not authorized to see this resource</>;
    }

    if (isLoading) {
        return <Text>Loading scopes...</Text>;
    }

    const { scope, environment, requests }: PontifexGetScopeResponse =
        data;

    return (
        <>
            <Heading as={"h1"} fontSize={"lg"}>
                Name: {scope.name}
            </Heading>
            <Heading as={"h2"} fontSize={"md"}>
                Id: {scope.id}
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
                {scope.description}
            </Text>
            <Heading as={"h2"} fontSize={"md"}>
                Permission Requests:
            </Heading>
            <PermissionRequestList permissionRequests={requests} />
        </>
    );
};

export default ScopeDetailsPage;
