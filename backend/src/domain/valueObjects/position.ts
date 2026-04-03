/**
 * 指摘の3D位置を表す値オブジェクト。
 *
 * @remarks
 * 判別共用体で2種類の位置を表現する:
 * - `spatial`: 3D空間の任意の点（空間指摘）
 * - `component`: BIM 部材に紐づく位置（部材指摘、dbId を保持）
 *
 * 両方とも `worldPosition` を持つため、ピン描画やカメラ移動は共通処理で扱える。
 */

/** 3D空間上の座標。APS Viewer の THREE.Vector3 に対応する。 */
export type WorldPosition = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

/**
 * 空間指摘の位置。3Dモデル上の任意の点を指す。
 *
 * @remarks
 * 部材に紐づかない自由配置のピンに使用する。
 */
export type SpatialPosition = {
  readonly type: "spatial";
  readonly worldPosition: WorldPosition;
};

/**
 * 部材指摘の位置。APS Viewer の dbId で特定の BIM 部材を参照する。
 *
 * @remarks
 * dbId があることで部材ハイライト表示やプロパティ参照が可能になる。
 */
export type ComponentPosition = {
  readonly type: "component";
  readonly dbId: number;
  readonly worldPosition: WorldPosition;
};

/** 指摘の位置。空間指摘または部材指摘の判別共用体。 */
export type Position = SpatialPosition | ComponentPosition;

/**
 * 空間指摘の位置を生成する。
 *
 * @param x - X座標
 * @param y - Y座標
 * @param z - Z座標
 */
export const createSpatialPosition = (
  x: number,
  y: number,
  z: number,
): SpatialPosition =>
  Object.freeze({
    type: "spatial" as const,
    worldPosition: Object.freeze({ x, y, z }),
  });

/**
 * 部材指摘の位置を生成する。
 *
 * @param dbId - APS Viewer の部材 ID
 * @param x - X座標
 * @param y - Y座標
 * @param z - Z座標
 */
export const createComponentPosition = (
  dbId: number,
  x: number,
  y: number,
  z: number,
): ComponentPosition =>
  Object.freeze({
    type: "component" as const,
    dbId,
    worldPosition: Object.freeze({ x, y, z }),
  });
