import Link from "next/link";
import { PageBody, PageHeader } from "@/components/shell/page-header";

// Shown inside the admin shell for an unknown admin address. When the check
// runs after streaming has started, Next.js keeps status 200 and adds noindex
// (documented behaviour with Cache Components); the page still says plainly
// that nothing is here.
export default function AdminNotFound() {
  return (
    <PageBody>
      <PageHeader
        title="Page not found"
        description="There is nothing at this address. It may have moved, or the link may be wrong."
      />
      <p>
        <Link href="/admin">Go to the dashboard</Link>
      </p>
    </PageBody>
  );
}
