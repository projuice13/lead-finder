import PageHeader from "@/components/PageHeader";
import SearchWizard from "@/components/SearchWizard";

export default function NewSearchPage() {
  return (
    <div className="max-w-[960px] mx-auto px-16">
      <PageHeader
        emoji="✨"
        title="New Search"
        subtitle="Find food & drink business leads across a UK city"
        breadcrumbs={[{ label: "Projects", href: "/" }, { label: "New Search" }]}
      />
      <SearchWizard />
    </div>
  );
}
