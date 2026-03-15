import { useMsal } from "@azure/msal-react";
import useSwr from "swr";
import { readApplication, readCurrentUserBundle } from "../resources";
import { useImpersonation } from "./useImpersonation";

export const useIsOwner = () => {
  const { accounts } = useMsal();
  const oid = accounts[0].idTokenClaims.oid;

  const { isImpersonating, impersonatingId } = useImpersonation();

  const isOwner = (id: string | string[]) => {
    if (Array.isArray(id)) {
      return id.includes(isImpersonating ? impersonatingId : oid);
    }

    return (
      (!isImpersonating && id === oid) ||
      (isImpersonating && impersonatingId === id)
    );
  };

  return {
    isOwner,
  };
};

export const useIsApplicationOwner = (appId: string) => {
  const { accounts } = useMsal();
  const oid = accounts[0].idTokenClaims.oid;

  const { isImpersonating, impersonatingId } = useImpersonation();
  const appResp = useSwr(`/api/applications/${appId}`, readApplication(appId));
  const userResp = useSwr(`/api/user`, readCurrentUserBundle);

  const isOwner = () => {
    return (
      !appResp.isLoading &&
      !userResp.isLoading &&
      (appResp.data?.owners?.some(
        (owner) => (isImpersonating ? impersonatingId : oid) === owner.id
      ) ||
        appResp.data?.ownerGroups?.some((group) =>
          userResp.data?.ownerGroups
            .concat(userResp.data.memberGroups)
            .some((userGroup) => userGroup.id === group.id)
        ))
    );
  };

  return {
    isLoading: appResp.isLoading || userResp.isLoading,
    isOwner,
  };
};
