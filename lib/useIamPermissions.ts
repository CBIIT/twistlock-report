"use client";

import { useEffect, useState } from "react";

export type IamPermissions = {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

type IamState = IamPermissions & {
  isLoading: boolean;
};

const READ_ONLY: IamState = {
  canCreate: false,
  canUpdate: false,
  canDelete: false,
  isLoading: false,
};

export function useIamPermissions(service: string): IamState {
  const [state, setState] = useState<IamState>({ ...READ_ONLY, isLoading: true });

  useEffect(() => {
    const username =
      typeof window !== "undefined"
        ? (sessionStorage.getItem("twistlockUsername") ?? "")
        : "";

    if (!username) {
      setState(READ_ONLY);
      return;
    }

    let active = true;
    const params = new URLSearchParams({ username, service });

    fetch(`/api/iam/permissions?${params.toString()}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("IAM fetch failed");
        return res.json() as Promise<IamPermissions>;
      })
      .then((permissions) => {
        if (active) setState({ ...permissions, isLoading: false });
      })
      .catch(() => {
        if (active) setState(READ_ONLY);
      });

    return () => {
      active = false;
    };
  }, [service]);

  return state;
}
