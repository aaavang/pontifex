import React from 'react';
import {
  Box,
  Heading,
  Text,
  VStack,
  Icon,
  Flex,
} from "@chakra-ui/react";
import { WarningIcon } from "@chakra-ui/icons";

const ErrorPage = () => {
  return (
    <Flex direction="column" align="center" justify="center">
      <VStack spacing={6} textAlign="center">
        <Box>
          <Icon as={WarningIcon} w={24} h={24} color="red.600" />
        </Box>
        <VStack spacing={6}>
          <Heading as="h1" size="2xl">
            Oops, something went wrong!
          </Heading>
          <Text fontSize="2xl">
            An unexpected error has occurred.
          </Text>
          <Text fontSize="2xl">
            If the issue persists, please contact <a href="mailto:aaavang@creditacceptance.com">Alex Aavang</a>
          </Text>
        </VStack>
      </VStack>
    </Flex>
  );
};

export default ErrorPage;