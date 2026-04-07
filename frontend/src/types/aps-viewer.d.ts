declare namespace Autodesk {
  namespace Viewing {
    interface InitializerOptions {
      env: string;
      api?: string;
      getAccessToken: (
        onTokenReady: (token: string, expires: number) => void,
      ) => void;
    }

    function Initializer(
      options: InitializerOptions,
      callback: () => void,
    ): void;

    class GuiViewer3D {
      container: HTMLElement;
      model: Model | null;
      impl: {
        camera: THREE.Camera;
        canvas: HTMLCanvasElement;
        hitTest(
          x: number,
          y: number,
          ignoreTransparent: boolean,
        ): HitTestResult | null;
      };
      constructor(container: HTMLElement, config?: Record<string, unknown>);
      start(): void;
      finish(): void;
      loadDocumentNode(doc: Document, viewable: BubbleNode): Promise<Model>;
      addEventListener(
        event: string,
        callback: (e: CameraChangedEvent) => void,
      ): void;
      removeEventListener(
        event: string,
        callback: (e: CameraChangedEvent) => void,
      ): void;
      resize(): void;
      fitToView(dbIds?: number[], model?: Model, immediate?: boolean): void;
      navigation: Navigation;
      worldToClient(point: THREE.Vector3): THREE.Vector3;
      getProperties(
        dbId: number,
        onSuccess: (result: PropertyResult) => void,
        onError?: (errorCode: number, errorMsg: string) => void,
      ): void;
    }

    interface PropertyResult {
      dbId: number;
      name: string;
      externalId: string;
      properties: PropertyEntry[];
    }

    interface PropertyEntry {
      attributeName: string;
      displayCategory: string;
      displayName: string;
      displayValue: string;
      hidden: boolean;
      type: number;
      units: string;
    }

    interface CameraChangedEvent {
      type: string;
    }

    interface Navigation {
      setView(position: THREE.Vector3, target: THREE.Vector3): void;
      getEyeVector(): THREE.Vector3;
    }

    const CAMERA_CHANGE_EVENT: string;
    const GEOMETRY_LOADED_EVENT: string;

    interface HitTestResult {
      intersectPoint: THREE.Vector3;
      dbId: number;
    }

    class Model {
      getData(): unknown;
      isLoadDone(): boolean;
    }

    class Document {
      static load(
        documentId: string,
        onSuccess: (doc: Document) => void,
        onError: (errorCode: number, errorMsg: string) => void,
      ): void;
      getRoot(): BubbleNode;
    }

    class BubbleNode {
      getDefaultGeometry(): BubbleNode | null;
    }
  }
}

declare namespace THREE {
  class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    clone(): Vector3;
    add(v: Vector3): Vector3;
    sub(v: Vector3): Vector3;
    normalize(): Vector3;
    multiplyScalar(s: number): Vector3;
  }

  class Camera {}
}
