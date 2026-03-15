import {omit} from "@chakra-ui/utils";
import {NextApiRequest, NextApiResponse} from "next";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const {slug} = req.query;
    const slugParts = typeof slug === "string" ? [slug] : slug;
    let url = `${process.env.NEXT_PUBLIC_APIM_URL}/${slugParts.join("/")}`;

    console.log(`API call to ${url} with method ${req.method} and body ${JSON.stringify(req.body)}`);

    const queryParams: any = omit(req.query, ["slug"]);

    if (Object.keys(queryParams).length > 0) {
        url = `${url}?${new URLSearchParams(queryParams)}`;
    }

    const response = await fetch(url, {
        method: req.method,
        body: req.body ? JSON.stringify(req.body) : null,
        headers: {
            "Content-Type": "application/json",
            Authorization:
                req.headers["authorization"] ??
                (req.headers["Authorization"] as string),
            "pfx-impersonate": req.headers["pfx-impersonate"] as string,
            "x-functions-key": process.env.API_FUNCTION_KEY,
        },
    });

    console.log(
        `calling ${req.method} ${url} with ${JSON.stringify(
            req.body
        )} got response with status ${response.status}`
    );

    const responseBody = await response.text();
    console.log(`Response body: ${responseBody}`);
    res
        .status(response.status)
        .json(responseBody ? JSON.parse(responseBody) : {});
}
