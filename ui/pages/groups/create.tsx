import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  useToast,
} from "@chakra-ui/react";
import axios from "axios";

import { useFormik } from "formik";
import { useRouter } from "next/router";
import * as yup from "yup";

const CreateApplication = () => {
  const router = useRouter();
  const toast = useToast();

  const formik = useFormik({
    initialValues: {
      name: "",
    },
    onSubmit: async (values) => {
      toast({
        title: "Creating Group",
        description: `Creating group, ${values.name}`,
        status: "info",
        duration: 10000,
        isClosable: true,
      });
      const body = {
        name: values.name,
      };

      const res = await axios.post("/api/groups", body);
      toast({
        title: "Created Group",
        description: `Successfully created group, ${values.name}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      router.push(`/groups/${res.data.group.id}`);
    },
    validationSchema: yup.object({
      name: yup.string().trim().required("Name is required"),
    }),
    validateOnChange: true,
  });

  return (
    <Flex justifyContent={"space-around"}>
      <Card variant={"outline"} width={"470px"}>
        <CardHeader>
          <Heading>Create a new Group</Heading>
        </CardHeader>
        <CardBody>
          <form className="w-50">
            <FormControl
              isRequired
              isInvalid={formik.errors.name !== undefined}
              mb={"5px"}
            >
              <FormLabel htmlFor="name" className="form-label">
                Name
              </FormLabel>
              <Input
                type="text"
                name="name"
                className="form-control"
                placeholder="My Super Awesome Group"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <FormErrorMessage>{formik.errors.name}</FormErrorMessage>
            </FormControl>

            <Button colorScheme="green" onClick={() => formik.handleSubmit()}>
              Create
            </Button>
          </form>
        </CardBody>
      </Card>
    </Flex>
  );
};

export default CreateApplication;
