import {
  addComment,
  applyEvent,
  changeStatus,
  createIssue,
  type Issue,
} from "../backend/src/domain/entities/issue.js";
import type { IssueDomainEvent } from "../backend/src/domain/events/issueEvents.js";
import type {
  CommentId,
  IssueId,
  ProjectId,
  UserId,
} from "../backend/src/domain/valueObjects/brandedId.js";
import { generateId } from "../backend/src/domain/valueObjects/brandedId.js";
import type { IssueCategory } from "../backend/src/domain/valueObjects/issueCategory.js";
import type { IssueStatus } from "../backend/src/domain/valueObjects/issueStatus.js";
import {
  MOCK_USER_CONTRACTOR_ID,
  MOCK_USER_SUPERVISOR_ID,
} from "../backend/src/domain/valueObjects/mockUsers.js";
import type { Position } from "../backend/src/domain/valueObjects/position.js";
import {
  createComponentPosition,
  createSpatialPosition,
} from "../backend/src/domain/valueObjects/position.js";
import { createEventProjector } from "../backend/src/infrastructure/persistence/eventProjectorImpl.js";
import { createEventStore } from "../backend/src/infrastructure/persistence/eventStoreImpl.js";
import { createIssueRepository } from "../backend/src/infrastructure/persistence/issueRepositoryImpl.js";
import {
  comments,
  issueEvents,
  issueSnapshots,
  issuesRead,
} from "../backend/src/infrastructure/persistence/schema.js";
import type { Db } from "../backend/src/infrastructure/persistence/types.js";

// ---------------------------------------------------------------------------
// シードデータ型定義
// ---------------------------------------------------------------------------

type SeedLifecycleStep =
  | {
      type: "status_change";
      status: IssueStatus;
      actorId: UserId;
      comment: string;
    }
  | { type: "comment"; actorId: UserId; body: string };

type SeedIssue = {
  title: string;
  category: IssueCategory;
  position: Position;
  assigneeId: UserId | null;
  initialComment: string;
  lifecycle: SeedLifecycleStep[];
};

// ---------------------------------------------------------------------------
// エイリアス
// ---------------------------------------------------------------------------

const SUPERVISOR = MOCK_USER_SUPERVISOR_ID;
const CONTRACTOR = MOCK_USER_CONTRACTOR_ID;

// ---------------------------------------------------------------------------
// 手書きシードデータ（8 件）
// ---------------------------------------------------------------------------

const HANDCRAFTED_ISSUES: readonly SeedIssue[] = [
  // --- open (2件) ---
  {
    title: "3F 廊下 天井ボード浮き",
    category: "quality_defect",
    position: createSpatialPosition(10.2, 8.5, 9.0),
    assigneeId: CONTRACTOR,
    initialComment:
      "3階廊下の天井ボードに浮きが見られます。範囲は約1m×0.5m。早めの対応をお願いします。",
    lifecycle: [],
  },
  {
    title: "2F 配管貫通部 耐火処理不備",
    category: "safety_hazard",
    position: createComponentPosition(142, 5.3, 4.1, 6.0),
    assigneeId: null,
    initialComment:
      "2階の配管貫通部で耐火処理が未施工の箇所を発見。消防検査前に必ず是正してください。",
    lifecycle: [],
  },

  // --- in_progress (2件) ---
  {
    title: "屋上防水層 施工不良",
    category: "construction_defect",
    position: createSpatialPosition(0.5, 15.0, 12.3),
    assigneeId: CONTRACTOR,
    initialComment:
      "屋上防水層の立ち上がり部分にシワが発生しています。防水性能に影響する可能性があるため、再施工を検討してください。",
    lifecycle: [
      {
        type: "status_change",
        status: "in_progress",
        actorId: CONTRACTOR,
        comment: "現場確認しました。防水業者と調整の上、来週中に再施工します。",
      },
    ],
  },
  {
    title: "1F エントランス タイル割れ",
    category: "quality_defect",
    position: createComponentPosition(87, 2.0, 0.0, 0.5),
    assigneeId: CONTRACTOR,
    initialComment:
      "1階エントランスの床タイルに割れが3箇所あります。来客の目に触れる場所なので優先対応をお願いします。",
    lifecycle: [
      {
        type: "comment",
        actorId: SUPERVISOR,
        body: "担当を佐藤さんに割り当てました。今週中に対応可能ですか？",
      },
      {
        type: "status_change",
        status: "in_progress",
        actorId: CONTRACTOR,
        comment:
          "承知しました。同じロットのタイルを発注済みです。入荷次第交換します。",
      },
    ],
  },

  // --- in_review (2件) ---
  {
    title: "5F 鉄骨接合部 溶接不良",
    category: "construction_defect",
    position: createSpatialPosition(5.0, 3.2, 15.8),
    assigneeId: CONTRACTOR,
    initialComment:
      "5階の鉄骨接合部で溶接不良（アンダーカット）を確認しました。構造に関わる部分のため、早急に補修してください。",
    lifecycle: [
      {
        type: "status_change",
        status: "in_progress",
        actorId: CONTRACTOR,
        comment: "溶接工を手配しました。明日から補修作業に入ります。",
      },
      {
        type: "status_change",
        status: "in_review",
        actorId: CONTRACTOR,
        comment:
          "補修溶接が完了しました。UT検査も実施済みで問題ありません。確認をお願いします。",
      },
    ],
  },
  {
    title: "B1 防火区画 貫通部処理漏れ",
    category: "design_change",
    position: createComponentPosition(234, -3.0, 8.5, -3.0),
    assigneeId: CONTRACTOR,
    initialComment:
      "地下1階の防火区画で、設計変更に伴う貫通部の耐火処理が漏れています。変更図面を確認の上、対応してください。",
    lifecycle: [
      {
        type: "comment",
        actorId: CONTRACTOR,
        body: "変更図面を確認しました。耐火処理の仕様について確認させてください。認定工法のフィブロックでよろしいでしょうか？",
      },
      {
        type: "comment",
        actorId: SUPERVISOR,
        body: "フィブロックで問題ありません。認定番号は図面に記載の通りです。",
      },
      {
        type: "status_change",
        status: "in_progress",
        actorId: CONTRACTOR,
        comment: "了解しました。材料を発注し、施工に入ります。",
      },
      {
        type: "status_change",
        status: "in_review",
        actorId: CONTRACTOR,
        comment:
          "耐火処理の施工が完了しました。施工写真を添付しますのでご確認ください。",
      },
    ],
  },

  // --- done (2件) ---
  {
    title: "外壁タイル 白華現象",
    category: "quality_defect",
    position: createSpatialPosition(20.0, 0.0, 6.5),
    assigneeId: CONTRACTOR,
    initialComment:
      "南面外壁の2~3階部分で白華現象が発生しています。美観に影響するため、洗浄と原因調査をお願いします。",
    lifecycle: [
      {
        type: "status_change",
        status: "in_progress",
        actorId: CONTRACTOR,
        comment:
          "高圧洗浄で白華を除去します。目地からの漏水が原因と思われるため、防水処理も実施予定です。",
      },
      {
        type: "status_change",
        status: "in_review",
        actorId: CONTRACTOR,
        comment:
          "洗浄と目地の防水処理が完了しました。経過観察が必要ですが、現時点での対応は完了です。",
      },
      {
        type: "status_change",
        status: "done",
        actorId: SUPERVISOR,
        comment: "確認しました。きれいに処理されています。承認します。",
      },
    ],
  },
  {
    title: "非常階段 手すり高さ不足",
    category: "safety_hazard",
    position: createComponentPosition(301, 12.0, 1.5, 10.0),
    assigneeId: CONTRACTOR,
    initialComment:
      "非常階段の手すり高さが建築基準法の基準（1,100mm以上）を満たしていません。実測で1,050mm。是正が必要です。",
    lifecycle: [
      {
        type: "comment",
        actorId: CONTRACTOR,
        body: "確認しました。手すりの嵩上げで対応可能か、金物メーカーに確認中です。",
      },
      {
        type: "status_change",
        status: "in_progress",
        actorId: CONTRACTOR,
        comment: "嵩上げ用のアダプター金物が見つかりました。来週施工予定です。",
      },
      {
        type: "status_change",
        status: "in_review",
        actorId: CONTRACTOR,
        comment:
          "手すり嵩上げ完了しました。実測1,120mmで基準をクリアしています。ご確認お願いします。",
      },
      {
        type: "status_change",
        status: "done",
        actorId: SUPERVISOR,
        comment:
          "現地確認し、1,120mmであることを確認しました。問題ありません。承認します。",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// テンプレートベースの自動生成（116 件）
// ---------------------------------------------------------------------------

const FLOORS = ["B1", "1F", "2F", "3F", "4F", "5F", "RF"] as const;

const LOCATIONS = [
  "廊下",
  "階段室",
  "エレベーターホール",
  "事務室",
  "会議室",
  "トイレ",
  "給湯室",
  "機械室",
  "電気室",
  "倉庫",
  "エントランス",
  "バルコニー",
  "PS",
  "EPS",
  "屋上",
  "外壁",
  "駐車場",
] as const;

type DefectTemplate = {
  defect: string;
  category: IssueCategory;
  commentTemplate: string;
};

const DEFECT_TEMPLATES: readonly DefectTemplate[] = [
  // quality_defect
  {
    defect: "天井ボード浮き",
    category: "quality_defect",
    commentTemplate:
      "天井ボ��ドに浮きが見られます。範囲を確認の上、是正してください。",
  },
  {
    defect: "壁クロス剥がれ",
    category: "quality_defect",
    commentTemplate:
      "壁クロスの剥がれを確認しました。下地処理を含めて貼り直しが必要です。",
  },
  {
    defect: "床タイル割れ",
    category: "quality_defect",
    commentTemplate:
      "床タイルに割れが発生しています。同ロットのタイルで交換してください。",
  },
  {
    defect: "塗装ムラ",
    category: "quality_defect",
    commentTemplate:
      "塗装にムラが見られます。再塗装で仕上げを均一にしてください。",
  },
  {
    defect: "巾木の浮き",
    category: "quality_defect",
    commentTemplate: "巾木が壁面から浮いています。接着剤で再固定してください。",
  },
  {
    defect: "建具の建付け不良",
    category: "quality_defect",
    commentTemplate: "ドアの開閉がスムーズでありません。丁番の調整が必要です。",
  },
  {
    defect: "サッシ廻りシーリング不良",
    category: "quality_defect",
    commentTemplate:
      "サッシ廻りのシーリングに隙間があります。打ち直しが必要です。",
  },
  {
    defect: "天井点検口の閉まり不良",
    category: "quality_defect",
    commentTemplate:
      "天井点検口が完全に閉まりません。金具の調整をお願いします。",
  },

  // safety_hazard
  {
    defect: "手すり固定不良",
    category: "safety_hazard",
    commentTemplate:
      "手すりにぐらつきがあります。ボルトの増し締めまたは補強が必要です。",
  },
  {
    defect: "避難経路表示欠落",
    category: "safety_hazard",
    commentTemplate:
      "避難経路の誘導灯が未設置です。消防検査前に必ず設置してください。",
  },
  {
    defect: "開口部養生不備",
    category: "safety_hazard",
    commentTemplate:
      "開口部の養生が不十分です。転落防止のため至急対応してください。",
  },
  {
    defect: "耐火処理不備",
    category: "safety_hazard",
    commentTemplate:
      "貫通部の耐火処理が未施工です。認定工法で早急に施工してください。",
  },
  {
    defect: "非常照明不点灯",
    category: "safety_hazard",
    commentTemplate:
      "非常照明が点灯しません。バッテリー交換または器具交換が必要です。",
  },
  {
    defect: "防火戸閉鎖不良",
    category: "safety_hazard",
    commentTemplate:
      "防火戸が完全に閉鎖しません。ドアクローザーの調整をお願いします。",
  },

  // construction_defect
  {
    defect: "鉄筋かぶり不足",
    category: "construction_defect",
    commentTemplate:
      "鉄筋のかぶり厚が設計値を下��っています。断面修復工法での対応を検討してください。",
  },
  {
    defect: "コンクリート打設不良",
    category: "construction_defect",
    commentTemplate:
      "コンクリートにジャンカが発生しています。補修方法を検討の上、対応してください。",
  },
  {
    defect: "配管勾配不足",
    category: "construction_defect",
    commentTemplate: "排水管の勾配が不足しています。配管の再施工が必要です。",
  },
  {
    defect: "ダクト接続部隙間",
    category: "construction_defect",
    commentTemplate:
      "ダクト接続部に隙間があります。テープ処理またはフランジの増し締めが必要です。",
  },
  {
    defect: "防水層の膨れ",
    category: "construction_defect",
    commentTemplate:
      "防水層に膨れが発生しています。原因を特定し、再施工を検討してください。",
  },
  {
    defect: "溶接ビード不良",
    category: "construction_defect",
    commentTemplate:
      "溶接ビードに欠陥があります。グラインダー処理後に再溶接してください。",
  },

  // design_change
  {
    defect: "設計変更に伴う開口追加",
    category: "design_change",
    commentTemplate:
      "設計変更により新規開口が必要です。変更図面に従い施工してください。",
  },
  {
    defect: "仕様変更（材料グレード変更）",
    category: "design_change",
    commentTemplate:
      "材料仕様が変更されました。新仕様の材料に差し替えてください。",
  },
  {
    defect: "間仕切り位置変更",
    category: "design_change",
    commentTemplate:
      "間仕切りの位置が変更されました。既設を撤去し、新位置に再施工してください。",
  },
  {
    defect: "設備ルート変更",
    category: "design_change",
    commentTemplate:
      "配管・ダクトのルートが変更さ��ています。変更図面に従���施工し直してください。",
  },
];

const START_COMMENTS = [
  "現場確認しました。対応を開始します。",
  "状況を確認しました。業者を手配し、今週中に着手します。",
  "承知しました。材料を発注の上、来週から作業に入ります。",
  "確認しました。明日から作業を開始します。",
  "了解しました。関連業者と調整の��、速やかに対応します。",
];

const REVIEW_COMMENTS = [
  "是正が完了しまし��。ご確認をお願いします。",
  "対応完了しまし��。仕上がりをご確認ください。",
  "施工完了しました。検査をお願いいたします。",
  "補修が完了しました。ご確認のほどよろしくお願いします。",
  "作業完了です。問題がないかご確認ください。",
];

const APPROVE_COMMENTS = [
  "確認しました。問題ありません。承認します。",
  "是正内容を確認しました。良好です。",
  "現地確認済みです。適切に処理されています。承認します。",
  "確認しました。基準を満たしています。",
];

const REJECT_COMMENTS = [
  "確認しましたが、仕上が��が不十分です。再施工をお願いします。",
  "一部未処理の箇所があります。再度対応してください。",
  "基準を満たしていない部分があります。再確認の上、修正してください。",
];

/** 決定論的に配列から要素を選択する */
const pick = <T>(arr: readonly T[], index: number): T =>
  arr[index % arr.length];

/**
 * 決定論的ハッシュ��� 0~1 の浮動小数点を返す。
 * 同じ seed には同じ値を返すが、連続する seed 間で値が大きく飛ぶ。
 */
const hash = (seed: number): number => {
  let h = (seed * 2654435761) >>> 0; // Knuth multiplicative hash
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = (h >>> 16) ^ h;
  return (h >>> 0) / 0xffffffff;
};

/** seed ベースで min~max の範囲の数値を返す（小数点1桁） */
const hashRange = (seed: number, min: number, max: number): number =>
  Math.round((min + hash(seed) * (max - min)) * 10) / 10;

/** seed ベースで min~max の範囲の整数を返す */
const hashInt = (seed: number, min: number, max: number): number =>
  min + Math.floor(hash(seed) * (max - min + 1));

/** ステータスごとのライフサイクルを生成する */
const buildLifecycle = (
  targetStatus: IssueStatus,
  index: number,
): SeedLifecycleStep[] => {
  const steps: SeedLifecycleStep[] = [];

  if (targetStatus === "open") return steps;

  // open -> in_progress
  steps.push({
    type: "status_change",
    status: "in_progress",
    actorId: CONTRACTOR,
    comment: pick(START_COMMENTS, index),
  });
  if (targetStatus === "in_progress") return steps;

  // in_progress -> in_review
  steps.push({
    type: "status_change",
    status: "in_review",
    actorId: CONTRACTOR,
    comment: pick(REVIEW_COMMENTS, index),
  });
  if (targetStatus === "in_review") return steps;

  // 一部の done は差し戻し -> 再是正 -> 再レビュー -> 承認
  if (index % 5 === 0) {
    steps.push({
      type: "status_change",
      status: "in_progress",
      actorId: SUPERVISOR,
      comment: pick(REJECT_COMMENTS, index),
    });
    steps.push({
      type: "status_change",
      status: "in_review",
      actorId: CONTRACTOR,
      comment: "再施工が完了しました。改めてご確認をお願いします。",
    });
  }

  // in_review -> done
  steps.push({
    type: "status_change",
    status: "done",
    actorId: SUPERVISOR,
    comment: pick(APPROVE_COMMENTS, index),
  });

  return steps;
};

/**
 * テンプレートから 120 件の Issue を生成する。
 * ステータス分布: open 30件, in_progress 30件, in_review 30件, done 30件
 */
const generateIssues = (): SeedIssue[] => {
  const statuses: IssueStatus[] = [];
  for (let i = 0; i < 30; i++) statuses.push("open");
  for (let i = 0; i < 30; i++) statuses.push("in_progress");
  for (let i = 0; i < 30; i++) statuses.push("in_review");
  for (let i = 0; i < 30; i++) statuses.push("done");

  const issues: SeedIssue[] = [];

  for (let i = 0; i < 120; i++) {
    const floor = pick(FLOORS, i);
    const location = pick(LOCATIONS, i * 3 + 1);
    const template = pick(DEFECT_TEMPLATES, i * 7 + 3);
    const targetStatus = statuses[i];
    const useSpatial = hash(i * 97) > 0.4; // 約60% spatial, 40% component
    const assigned = targetStatus !== "open" || hash(i * 53) > 0.3;

    // 位置をハッシュで散らす（建物サイズ想定: x=0~25, y=0~20, z=-3~18）
    const x = hashRange(i * 13 + 1, 0, 25);
    const y = hashRange(i * 17 + 2, 0, 20);
    const baseZ =
      floor === "B1" ? -3 : floor === "RF" ? 15 : Number.parseInt(floor) * 3;
    const z = hashRange(i * 23 + 3, baseZ, baseZ + 2.8);

    // BIM モデルの部材 ID を散らす（梁: 100-299, 柱: 300-499, 壁: 500-699, 設備: 700-999）
    const dbId = hashInt(i * 31 + 7, 100, 999);

    const position = useSpatial
      ? createSpatialPosition(x, y, z)
      : createComponentPosition(dbId, x, y, z);

    issues.push({
      title: `${floor} ${location} ${template.defect}`,
      category: template.category,
      position,
      assigneeId: assigned ? CONTRACTOR : null,
      initialComment: `${floor}の${location}にて指摘。${template.commentTemplate}`,
      lifecycle: buildLifecycle(targetStatus, i),
    });
  }

  return issues;
};

// ---------------------------------------------------------------------------
// 全シードデータ（手書き 8 件 + 自動生成 120 件 = 128 件）
// ---------------------------------------------------------------------------

const SEED_ISSUES: readonly SeedIssue[] = [
  ...HANDCRAFTED_ISSUES,
  ...generateIssues(),
];

// ---------------------------------------------------------------------------
// シード投入関数
// ---------------------------------------------------------------------------

export const seedIssues = async (
  db: Db,
  projectId: ProjectId,
): Promise<void> => {
  // 既存データを全削除（順序: FK 制約を考慮）
  await db.delete(issueSnapshots);
  await db.delete(comments);
  await db.delete(issuesRead);
  await db.delete(issueEvents);

  const issueRepo = createIssueRepository(
    db,
    createEventStore(db),
    createEventProjector(db),
  );

  for (const seed of SEED_ISSUES) {
    // 1. Issue 作成
    const issueId = generateId<IssueId>();
    const createResult = createIssue({
      issueId,
      projectId,
      title: seed.title,
      category: seed.category,
      position: seed.position,
      reporterId: SUPERVISOR,
      assigneeId: seed.assigneeId,
      actorId: SUPERVISOR,
      comment: {
        commentId: generateId<CommentId>(),
        body: seed.initialComment,
      },
    });

    if (!createResult.ok) {
      throw new Error(
        `Failed to create issue "${seed.title}": ${createResult.error.message}`,
      );
    }

    await issueRepo.save(issueId, createResult.value, 0);

    // 2. ライフサイクルステップを順次適用
    for (const step of seed.lifecycle) {
      const issue = await issueRepo.load(issueId);
      if (!issue) throw new Error(`Issue not found: ${issueId}`);

      if (step.type === "status_change") {
        const events: IssueDomainEvent[] = [];
        let current: Issue = issue;

        // ステータス変更イベント
        const statusResult = changeStatus(current, step.status, step.actorId);
        if (!statusResult.ok) {
          throw new Error(
            `Failed to change status for "${seed.title}": ${statusResult.error.message}`,
          );
        }
        events.push(statusResult.value);
        current = applyEvent(current, statusResult.value);

        // コメントイベント
        const commentResult = addComment(
          current,
          generateId<CommentId>(),
          step.comment,
          step.actorId,
        );
        if (!commentResult.ok) {
          throw new Error(
            `Failed to add comment for "${seed.title}": ${commentResult.error.message}`,
          );
        }
        events.push(commentResult.value);

        await issueRepo.save(issueId, events, issue.version);
      } else {
        // コメントのみ
        const commentResult = addComment(
          issue,
          generateId<CommentId>(),
          step.body,
          step.actorId,
        );
        if (!commentResult.ok) {
          throw new Error(
            `Failed to add comment for "${seed.title}": ${commentResult.error.message}`,
          );
        }
        await issueRepo.save(issueId, [commentResult.value], issue.version);
      }
    }
  }
};
