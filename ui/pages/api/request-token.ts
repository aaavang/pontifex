import { ConfidentialClientApplication } from "@azure/msal-node";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { clientId, clientSecret, resourceId } = req.body;

  const config = {
    auth: {
      clientId,
      authority:
        process.env.NEXT_PUBLIC_AUTHORITY,
      clientSecret,
    },
  };

  const confidentialClientApplication = new ConfidentialClientApplication(
    config
  );

  const clientCredentialRequest = {
    scopes: [`${resourceId}/.default`],
  };

  const resp =
    await confidentialClientApplication.acquireTokenByClientCredential(
      clientCredentialRequest
    );

  return res.status(200).json({
    token: resp.accessToken,
  });
}
