import { Suspense } from "react";
import { ReaderLoader } from "@/components/reader/loader";
import { Splash } from "@/components/ui";

export default function ReadPage() {
  return (
    <Suspense fallback={<Splash />}>
      <ReaderLoader />
    </Suspense>
  );
}
