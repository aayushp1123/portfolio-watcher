import { SampleNav } from "@/components/sample/SampleNav";

export default function SampleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SampleNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
