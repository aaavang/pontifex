import { EmailIcon } from "@chakra-ui/icons";
import { Link, Text } from "@chakra-ui/react";
import useSwr from "swr";
import { readUser } from "../../resources";

export const User = ({ id }) => {
  const { data, error, isLoading } = useSwr(`/api/users/${id}`, readUser(id));

  if (isLoading) {
    return <Text>{id}</Text>;
  }

  return (
    <Link href={`mailto:${data.email}`} color={"blue.500"}>
      {data.name} <EmailIcon mx={"2px"} />
    </Link>
  );
};
