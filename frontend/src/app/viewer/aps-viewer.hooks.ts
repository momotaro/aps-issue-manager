"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api-client";

const APS_URN = process.env.NEXT_PUBLIC_APS_URN ?? "";

async function fetchAccessToken(): Promise<string> {
  const res = await apiClient.api.aps.token.$get();
  if (!res.ok) throw new Error("Failed to fetch APS token");
  const data = await res.json();
  return data.access_token;
}

function useApsToken() {
  return useQuery({
    queryKey: ["aps", "token"],
    queryFn: fetchAccessToken,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useApsViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Autodesk.Viewing.GuiViewer3D | null>(null);
  const [viewer, setViewer] = useState<Autodesk.Viewing.GuiViewer3D | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    data: accessToken,
    error: tokenError,
    isSuccess: tokenReady,
  } = useApsToken();

  const initViewer = useCallback(async (token: string) => {
    if (!APS_URN) {
      setError(
        "APS_URN が設定されていません。.env の NEXT_PUBLIC_APS_URN を設定してください。",
      );
      setIsLoading(false);
      return;
    }

    if (!containerRef.current) return;

    try {
      const options: Autodesk.Viewing.InitializerOptions = {
        env: "AutodeskProduction2",
        api: "streamingV2",
        getAccessToken: (onTokenReady) => {
          fetchAccessToken()
            .then((t) => onTokenReady(t, 3600))
            .catch(() => onTokenReady(token, 60));
        },
      };

      Autodesk.Viewing.Initializer(options, () => {
        if (!containerRef.current) return;

        const v = new Autodesk.Viewing.GuiViewer3D(containerRef.current, {});
        v.start();
        viewerRef.current = v;

        const documentId = `urn:${APS_URN}`;
        Autodesk.Viewing.Document.load(
          documentId,
          (doc) => {
            const viewable = doc.getRoot().getDefaultGeometry();
            if (!viewable) {
              setError("表示可能なジオメトリが見つかりません。");
              setIsLoading(false);
              return;
            }
            v.loadDocumentNode(doc, viewable).then(() => {
              setIsLoading(false);
              setViewer(v);
            });
          },
          (_errorCode, errorMsg) => {
            setError(`モデルの読み込みに失敗しました: ${errorMsg}`);
            setIsLoading(false);
          },
        );
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Viewer の初期化に失敗しました",
      );
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tokenError) {
      setError(
        tokenError instanceof Error
          ? tokenError.message
          : "APS トークンの取得に失敗しました",
      );
      setIsLoading(false);
      return;
    }

    if (!tokenReady || !accessToken) return;

    const loadViewerScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (typeof Autodesk !== "undefined") {
          resolve();
          return;
        }

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href =
          "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";
        document.head.appendChild(link);

        const script = document.createElement("script");
        script.src =
          "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("APS Viewer の読み込みに失敗"));
        document.head.appendChild(script);
      });
    };

    loadViewerScript()
      .then(() => initViewer(accessToken))
      .catch((err) => {
        setError(err.message);
        setIsLoading(false);
      });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.finish();
        viewerRef.current = null;
      }
    };
  }, [tokenReady, accessToken, tokenError, initViewer]);

  return { containerRef, viewer, isLoading, error };
}
