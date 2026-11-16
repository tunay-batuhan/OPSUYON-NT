import { Bone } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-4">
      <Bone className="h-8 w-40" />
      <Bone className="h-4 w-64" />
      <Bone className="mt-4 h-56 w-full rounded-2xl" />
      <Bone className="h-56 w-full rounded-2xl" />
    </div>
  );
}
