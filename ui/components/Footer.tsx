import { Flex, Stack, Text } from "@chakra-ui/react";

export const Footer = (props) => {
  const copyRightText = `© ${new Date().getFullYear()} Alex Aavang. All rights reserved.`;
  const TosText =
    "Your use of this product is governed by the terms of your company agreement. You may not use or disclose this product or allow others to use it or disclose it, except as permitted by your agreement with Credit Acceptance.";

  return (
    <Flex
      as="footer"
      align="center"
      direction="row"
      width="100%"
      backgroundColor="white"
      borderTopColor="gray.400"
      borderTopWidth="1px"
      right={0}
      bottom={0}
      marginTop="0.75rem"
      padding="0.75rem"
      {...props}
    >
      <Stack>
        <Text
          color="uimf_primary"
          marginRight="2.5rem"
          marginTop="0.75rem"
          marginBottom="0.75rem"
        >
          {copyRightText}
        </Text>
        <Text fontSize="0.75rem" color="gray.600">
          {TosText}
        </Text>
      </Stack>
    </Flex>
  );
};
