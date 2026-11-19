"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, ReactNode, useContext, useMemo } from "react";

const ConvexAvailableContext = createContext(false);

export function useConvexAvailable(): boolean {
  return useContext(ConvexAvailableContext);
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Closed even if a legacy deployment URL is accidentally present.
  const deploymentUrl: string | undefined = undefined;

  const client = useMemo(() => {
    if (!deploymentUrl) return null;
    return new ConvexReactClient(deploymentUrl);
  }, [deploymentUrl]);

  if (!client) {
    return (
      <ConvexAvailableContext.Provider value={false}>
        {children}
      </ConvexAvailableContext.Provider>
    );
  }

  return (
    <ConvexAvailableContext.Provider value={true}>
      <ConvexProvider client={client}>{children}</ConvexProvider>
    </ConvexAvailableContext.Provider>
  );
}
