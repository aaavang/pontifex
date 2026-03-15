import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  CheckboxGroup,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Stack,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import axios from "axios";

import { useFormik } from "formik";
import { useRouter } from "next/router";
import * as yup from "yup";

const envs = ["dev", "test", "qa", "prod"];

const CreateApplication = () => {
  const router = useRouter();
  const toast = useToast();

  const formik = useFormik({
    initialValues: {
      name: "",
      description: "",
      secret: false,
      environments: [],
    },
    onSubmit: async (values) => {
      toast({
        title: "Creating Application",
        description: `Creating application, ${values.name}`,
        status: "info",
        duration: 10000,
        isClosable: true,
      });
      const body = {
        applicationName: values.name,
        environments: values.environments,
        description: values.description,
      };

      const res = await axios.post("/api/applications", body);
      toast({
        title: "Created Application",
        description: `Successfully created application, ${values.name}`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      router.push(`/applications/${res.data.id}`);
    },
    validationSchema: yup.object({
      name: yup.string().trim().required("Name is required"),
      secret: yup.bool().required("Is Secret is required"),
      environments: yup.array().min(1),
    }),
    validateOnChange: true,
  });

  const handleChange = (e) => {
    const { checked, name } = e.target;
    if (checked) {
      formik.setFieldValue("environments", [
        ...formik.values.environments,
        name,
      ]);
    } else {
      formik.setFieldValue(
        "environments",
        formik.values.environments.filter((v) => v !== name)
      );
    }
  };

  return (
    <Flex justifyContent={"space-around"}>
      <Card variant={"outline"} width={"470px"}>
        <CardHeader>
          <Heading>Create a new Application</Heading>
        </CardHeader>
        <CardBody>
          <form className="w-50">
            <FormControl
              isRequired
              isInvalid={formik.errors.name !== undefined}
            >
              <FormLabel htmlFor="name" className="form-label">
                Name
              </FormLabel>
              <Input
                type="text"
                name="name"
                className="form-control"
                placeholder="My Super Awesome Application"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <FormErrorMessage>{formik.errors.name}</FormErrorMessage>
            </FormControl>

            <FormLabel htmlFor="description" className="form-label">
              Description
            </FormLabel>
            <Textarea
              name="description"
              className="form-control"
              placeholder="My Super Awesome Application's description"
              value={formik.values.description}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
            />

            <div className="mb-3">
              <FormLabel htmlFor="secret" className="form-label">
                Secret
              </FormLabel>
              <Checkbox
                type="checkbox"
                name="secret"
                className="form-control"
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <FormErrorMessage>{formik.errors.secret}</FormErrorMessage>
            </div>

            <div id="checkbox-group">Environments</div>
            <FormControl isInvalid={formik.errors.name !== undefined}>
              <CheckboxGroup aria-labelledby="checkbox-group">
                <Stack spacing={[1, 5]} direction={["column", "row"]}>
                  {envs.map((env) => (
                    <div key={env}>
                      <Checkbox
                        id={env}
                        type="checkbox"
                        name={env}
                        checked={formik.values.environments.includes(env)}
                        onChange={handleChange}
                      />
                      <FormLabel htmlFor={env}>{env}</FormLabel>
                    </div>
                  ))}
                </Stack>
              </CheckboxGroup>
              <FormErrorMessage>
                {formik.errors.environments as string}
              </FormErrorMessage>
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
