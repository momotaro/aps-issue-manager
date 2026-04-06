import { Suspense } from "react";
import { IssueListClient } from "./issue-list-client";

export default function IssueListPage() {
  return (
    <Suspense>
      <IssueListClient />
    </Suspense>
  );
}
