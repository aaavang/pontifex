import { useMsal } from "@azure/msal-react";
import axios from "axios";
import { useEffect, useState } from "react";

export const useImpersonation = () => {
  const { accounts } = useMsal();
  const roles = accounts[0].idTokenClaims.roles ?? [];

  const [impersonatingId, setImpersonatingId] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("pfx-impersonate")
      : null
  );

  const updateImpersonating = (id: string) => {
    if (typeof window !== "undefined") {
      if (id) {
        localStorage.setItem("pfx-impersonate", id);
        setImpersonatingId(id);
      } else {
        localStorage.removeItem("pfx-impersonate");
      }
      window.location.reload();
    }
  };

  const [impersonatingUsername, setImpersonatingUsername] =
    useState(impersonatingId);

  useEffect(() => {
    (async () => {
      if (impersonatingId) {
        const resp = await axios.get(`/api/users/${impersonatingId}`, {
          validateStatus: () => true,
        });

        if (resp.status === 200) {
          setImpersonatingUsername(resp.data.bundle.user.name);
        }
      }
    })();
  }, [impersonatingId]);

  return {
    canImpersonate: roles.includes("User.Impersonate"),
    isImpersonating:
      impersonatingId != null && roles.includes("User.Impersonate"),
    impersonatingId,
    impersonatingUsername,
    setImpersonating: updateImpersonating,
  };
};
