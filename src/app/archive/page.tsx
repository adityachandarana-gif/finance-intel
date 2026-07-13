import { getSectionGroups, getSections, type SectionGroup, type Section } from "@/lib/supabase";
import { ArchiveClient } from "@/components/ArchiveClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Archive — FinPulse",
  description:
    "Browse and search the complete history of AI-curated finance news.",
};

export const revalidate = 1800;

export default async function ArchivePage() {
  let groups: SectionGroup[] = [];
  let sections: Section[] = [];

  try {
    [groups, sections] = await Promise.all([
      getSectionGroups(),
      getSections(),
    ]);
  } catch {
    // Supabase may not be configured yet
  }

  return (
    <ArchiveClient initialGroups={groups} initialSections={sections} />
  );
}
