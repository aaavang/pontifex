import { Flex, FlexProps } from "@chakra-ui/react";

export const Container: React.FunctionComponent<FlexProps> = (props) => (
  <Flex
    direction="column"
    alignItems="center"
    justifyContent="flex-start"
    minHeight="100vh"
    width="100%"
    {...props}
  />
);
