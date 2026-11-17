import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { NewClientForm } from "./new-client-form";

export const metadata: Metadata = { title: "New client" };

export default function NewClientPage() {
  return (
    <PageBody>
      <p className="text-small">
        <Link href="/console">← Clients</Link>
      </p>
      <PageHeader
        title="New client"
        description="The client gets its own portal at its address straight away. You can change everything except the address later."
      />
      <NewClientForm />
    </PageBody>
  );
}
